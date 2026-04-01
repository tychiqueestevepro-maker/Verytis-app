import { tool, jsonSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createAdminClient } from '@/lib/supabase/admin';
import { getValidGitHubToken } from '@/lib/github/tokens';
import { getValidShopifyToken } from '@/lib/shopify/tokens';
import { getValidGoogleToken } from '@/lib/google/tokens';
import { getValidStripeToken } from '@/lib/stripe/tokens';
import { getStripeClient } from '@/lib/stripe';

/**
 * STEP 3: Multi-Provider Model Resolver
 */
export function resolveModel(modelId) {
    if (!modelId) return openai('gpt-4o'); 
    const id = modelId.toLowerCase();
    if (id.includes('claude')) return anthropic(modelId);
    if (id.includes('gemini')) return google(modelId);
    return openai(modelId);
}

/**
 * STEP 2: Dynamic Tool Discovery from Visual Config
 */
export function discoverTools(visualConfig, isSimulation = false, organizationId = null, isGoogleWsConnected = false) {
    if (!visualConfig?.nodes) return { toolMap: {}, autoProviders: new Set() };

    const toolNodes = visualConfig.nodes.filter(n =>
        n.type === 'toolNode' && n.data?.auth_requirement?.type !== 'none'
    );
    
    const toolMap = {};
    const autoProviders = new Set();
    if (isGoogleWsConnected) autoProviders.add('google_workspace');

    for (const node of toolNodes) {
        node._orgId = organizationId;
        const label = node.data?.label || 'tool';
        const appLabel = label.toLowerCase();
        const toolId = appLabel.replace(/[^a-z0-9_]/g, '_').substring(0, 64);
        const description = node.data?.description || `Exécute l'outil "${label}".`;

        toolMap[toolId] = tool({
            description: description,
            inputSchema: jsonSchema({
                type: 'object',
                properties: {
                    payload: { 
                        type: 'object', 
                        description: (appLabel.includes('github') || appLabel.includes('trello'))
                            ? "Contenu de l'action (Titre, Description). Ne spécifiez PAS le dépôt ou la liste, ils sont déjà configurés."
                            : appLabel.includes('streamlabs')
                            ? `Outil de Montage/Production. Configuré en mode: ${node.data?.config?.active_tab || 'montage'}. Format: ${node.data?.config?.format || '9:16'}.`
                            : "Objet JSON natif contenant les paramètres requis par l'API cible.",
                        properties: (appLabel.includes('github') || appLabel.includes('trello'))
                            ? {
                                title: { type: 'string', description: "Titre du ticket ou de la carte." },
                                body: { type: 'string', description: "Description détaillée du contenu." }
                              }
                            : appLabel.includes('streamlabs')
                            ? {
                                video_url: { type: 'string' },
                                start_time: { type: 'number' },
                                end_time: { type: 'number' },
                                title: { type: 'string' }
                              }
                            : undefined,
                        additionalProperties: true 
                    }
                }
            }),
            execute: async ({ payload }) => {
                let targetUrl = node.data?.credentials?.api_key || node.data?.credentials?.webhook_url;

                if (!targetUrl || !targetUrl.startsWith('http')) {
                    return `[SIMULATION] Outil "${label}" non configuré. Payload: ${JSON.stringify(payload)}`;
                }

                try {
                    const headers = { 'Content-Type': 'application/json' };
                    
                    // --- Provider Guards (GitHub, Shopify, Google, Streamlabs, TikTok, Trello) ---
                    if (appLabel.includes('github')) {
                        const token = await getValidGitHubToken({ organizationId: node._orgId });
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                    }
                    if (appLabel.includes('shopify')) {
                        const token = await getValidShopifyToken({ organizationId: node._orgId });
                        if (token) headers['X-Shopify-Access-Token'] = token;
                    }
                    if (appLabel.includes('google') || appLabel.includes('drive') || appLabel.includes('calendar')) {
                        const token = await getValidGoogleToken({ organizationId: node._orgId });
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                    }
                    if (appLabel.includes('streamlabs')) {
                        const admin = createAdminClient();
                        const { data } = await admin.from('user_connections').select('access_token').eq('organization_id', node._orgId).eq('provider', 'streamlabs').maybeSingle();
                        if (data?.access_token) headers['Authorization'] = `Bearer ${data.access_token}`;
                    }
                    if (appLabel.includes('trello')) {
                        const admin = createAdminClient();
                        const { data } = await admin.from('user_connections').select('access_token').eq('organization_id', node._orgId).eq('provider', 'trello').maybeSingle();
                        if (data?.access_token) {
                            const separator = targetUrl.includes('?') ? '&' : '?';
                            targetUrl = `${targetUrl}${separator}key=${process.env.TRELLO_API_KEY}&token=${data.access_token}`;
                        }
                    }

                    // --- Target Targeting (config injection) ---
                    const config = node.data?.config || {};
                    const finalPayload = { ...payload };
                    if (appLabel.includes('trello') && config.list_id) finalPayload.idList = config.list_id;
                    if (appLabel.includes('github') && config.repo_name) finalPayload.repo = config.repo_name;

                    const response = await fetch(targetUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(finalPayload)
                    });
                    const resData = await response.text();
                    return response.ok ? `[SUCCÈS] ${label} OK: ${resData}` : `[ERREUR] ${response.status}: ${resData}`;
                } catch (error) {
                    return `[ERREUR RÉSEAU] ${error.message}`;
                }
            }
        });

        // Track autoProviders for Listing Tools (Discovery)
        const config = node.data?.config || {};
        const logoDomain = (node.data?.logoDomain || '').toLowerCase();
        
        if (appLabel.includes('slack') || logoDomain.includes('slack')) autoProviders.add('slack');
        if (appLabel.includes('stripe') || logoDomain.includes('stripe')) autoProviders.add('stripe');
        if (appLabel.includes('github') || appLabel.includes('git')) autoProviders.add('github');
        if (appLabel.includes('trello')) autoProviders.add('trello');
        if (appLabel.includes('youtube')) autoProviders.add('youtube');
        if (appLabel.includes('tiktok')) autoProviders.add('tiktok');
        if (appLabel.includes('shopify')) autoProviders.add('shopify');
        if (appLabel.includes('streamlabs')) autoProviders.add('streamlabs');
    }

    // --- Inject Stripe Specific Tools ---
    if (autoProviders.has('stripe')) {
        toolMap['stripe_create_refund'] = tool({
            description: "Crée un remboursement Stripe.",
            inputSchema: jsonSchema({
                type: 'object',
                properties: { charge_id: { type: 'string' }, amount: { type: 'number' }, reason: { type: 'string' } },
                required: ['charge_id']
            }),
            execute: async ({ charge_id, amount, reason }) => {
                const token = await getValidStripeToken({ organizationId });
                const stripe = getStripeClient(token);
                const refund = await stripe.refunds.create({ charge: charge_id, amount, reason });
                return `[SUCCÈS] Remboursement ID: ${refund.id}`;
            }
        });
        // (Other Stripe tools like analytics, subscription, etc. remain logically here...)
    }

    return { toolMap, autoProviders };
}

/**
 * STEP 2b: Internal AI Skills Discovery
 */
export function discoverInternalSkills(visualConfig) {
    if (!visualConfig?.nodes) return "";
    const skillNodes = visualConfig.nodes.filter(n =>
        n.type === 'toolNode' && n.data?.auth_requirement?.type === 'none'
    );
    return skillNodes.map(n => `- ${n.data?.label}: ${n.data?.description}`).join('\n');
}

/**
 * STEP 2c: Building Listing Tools (Metadata search)
 */
export function buildListingTools(providers, organizationId, req) {
    const toolMap = {};
    const internalMeta = async (path, params = {}) => {
        // [STABILITY] Always use local bypass for server-to-server metadata fetching
        // This avoids 404/Timeouts if Ngrok is unstable or DNS is slow.
        const localBase = `http://127.0.0.1:3000`;
        const publicHost = req.headers.get('host') || 'localhost:3000';
        const authHeader = req.headers.get('authorization') || '';
        
        const url = new URL(path.startsWith('/') ? path : `/api/integrations/${path}`, localBase);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        
        console.log(`[DISCOVERY] Internal Metadata Local Bypass: ${url.toString()} (Host: ${publicHost})`);
        const res = await fetch(url.toString(), { 
            headers: { 
                'cookie': req.headers.get('cookie') || '',
                'host': publicHost, // Forward original host for Next.js routing
                'authorization': authHeader // CRITICAL: Forward auth for internal security context
            },
            cache: 'no-store'
        });
        
        if (!res.ok) {
            console.error(`[DISCOVERY] Metadata Call Failed: ${res.status} ${res.statusText}`);
            return null;
        }
        return res.json();
    };

    if (providers.has('slack')) {
        toolMap['slack_list_channels'] = tool({
            description: "Liste les canaux Slack réels depuis ta connexion. Appelle cet outil dès que l'utilisateur mentionne Slack. Retourne les vrais noms de canaux pour le sélecteur.",
            inputSchema: jsonSchema({ type: 'object', properties: {} }),
            execute: async () => {
                const data = await internalMeta('/api/slack/channels');
                return { 
                    options: data?.channels ? data.channels.map(c => c.name.startsWith('#') ? c.name : `#${c.name}`) : [],
                    hitl_config: { label: 'Sélection du Canal Slack', field: 'Slack_Channel' }
                };
            }
        });
    }

    if (providers.has('trello')) {
        toolMap['trello_list_boards'] = tool({
            description: "Liste les Tableaux Trello réels. Appelle cet outil si l'utilisateur mentionne Trello.",
            inputSchema: jsonSchema({ type: 'object', properties: { board_id: { type: 'string' } } }),
            execute: async ({ board_id }) => {
                const data = await internalMeta('trello/metadata', board_id ? { boardId: board_id } : {});
                return {
                    options: data?.items ? data.items.map(i => i.label) : [],
                    hitl_config: { label: 'Sélection du Tableau Trello', field: 'Trello_List' }
                };
            }
        });
    }

    if (providers.has('github')) {
        toolMap['github_list_repos'] = tool({
            description: "Liste les dépôts GitHub réels. Appelle cet outil dès que l'utilisateur mentionne GitHub.",
            inputSchema: jsonSchema({ type: 'object', properties: {} }),
            execute: async () => {
                const data = await internalMeta('github/metadata');
                return {
                    options: data?.items ? data.items.map(i => i.label) : [],
                    hitl_config: { label: 'Sélection du Dépôt GitHub', field: 'Github_Repo' }
                };
            }
        });
    }

    if (providers.has('youtube')) {
        toolMap['youtube_list_channels'] = tool({
            description: "Liste les Chaînes YouTube disponibles. Appelle OBLIGATOIREMENT cet outil si l'utilisateur mentionne YouTube ou des Shorts. Retourne les noms de comptes pour le sélecteur.",
            inputSchema: jsonSchema({ type: 'object', properties: {} }),
            execute: async () => {
                const data = await internalMeta('youtube/metadata');
                return {
                    options: data?.items ? data.items.map(i => i.label) : [],
                    hitl_config: { label: 'Sélection du Compte YouTube', field: 'Youtube_Channel' }
                };
            }
        });
    }

    if (providers.has('tiktok')) {
        toolMap['tiktok_get_account'] = tool({
            description: "Récupère les infos du compte TikTok.",
            inputSchema: jsonSchema({ type: 'object', properties: {} }),
            execute: async () => {
                const data = await internalMeta('tiktok/metadata');
                return {
                    options: data?.user ? [`${data.user.display_name} (TikTok)`] : [],
                    hitl_config: { label: 'Vérification du Compte TikTok', field: 'Tiktok_Account' }
                };
            }
        });
    }
    
    return toolMap;
}
