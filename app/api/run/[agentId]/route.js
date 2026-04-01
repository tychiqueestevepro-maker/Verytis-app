import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateText } from 'ai';
import crypto from 'crypto';
import { scrubText } from '@/lib/security/scrubber';
import { calculateCost } from '@/lib/security/pricing';
import { createClient } from '@/lib/supabase/server';

// Modular Imports
import { resolveModel, discoverTools, buildListingTools, discoverInternalSkills } from './lib/tool-discovery';
import { processHITL } from './lib/hitl-manager';
import { logDiagnostic } from './lib/diagnostic';

export const dynamic = 'force-dynamic';

/**
 * Enterprise Agent Execution Gateway v3.1
 * Secure internal/external routing with HITL (Human-In-The-Loop) orchestration.
 */
export async function POST(req, { params }) {
    const { agentId } = await params;
    const startTime = Date.now();
    const traceId = crypto.randomUUID();
    const adminClient = createAdminClient();

    try {
        const { messages, message, isSimulation = false } = await req.json();

        // 1. Authorization
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
        const supabase = await createClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        // 2. Fetch Agent & Validate Access
        const { data: agent } = await adminClient.from('ai_agents').select('*').eq('id', agentId).single();
        if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

        const isAuthorized = sessionUser || 
                             (token && (agent.api_key === token || token === process.env.VERYTIS_INTERNAL_KEY));

        if (!isAuthorized) {
            return NextResponse.json({ 
                error: 'Unauthorized', 
                message: 'Invalid API Key or Session expired. Please refresh the page.' 
            }, { 
                status: 403,
                headers: { 'Cache-Control': 'no-store, max-age=0' }
            });
        }

        // 3. Security: Scrub Input PII
        const safeMessages = messages.map(m => ({ ...m, content: m.role === 'user' ? scrubText(m.content) : m.content }));

        // 4. Discovery: Tools & Skills (Contextual Filter)
        const { toolMap, autoProviders } = discoverTools(agent.visual_config, isSimulation, agent.organization_id);
        
        // [LEAST PRIVILEGE] Filter providers based on user message context
        const msgLower = (message || '').toLowerCase();
        const contextualProviders = new Set();
        
        const providerKeywords = {
            slack: ['slack', 'canal', 'message', 'notification', 'alerte', 'mp'],
            tiktok: ['tiktok', 'compte tiktok'],
            youtube: ['youtube', 'short', 'repertorie', 'visibilite', 'chaine', 'video'],
            github: ['github', 'git', 'depot', 'repo'],
            trello: ['trello', 'tableau', 'carte', 'list'],
            stripe: ['stripe', 'paiement', 'remboursement', 'facture'],
            shopify: ['shopify', 'produit', 'commande', 'boutique'],
            streamlabs: ['streamlabs', 'clip', 'montage', 'stream']
        };

        autoProviders.forEach(p => {
            const keywords = providerKeywords[p] || [p];
            if (keywords.some(k => msgLower.includes(k))) {
                contextualProviders.add(p);
            }
        });

        const internalSkills = discoverInternalSkills(agent.visual_config);
        const listingTools = buildListingTools(contextualProviders, agent.organization_id, req);
        const discoveredTools = { ...toolMap, ...listingTools };
        
        // [LIVE CONFIG MEMORY] Extract current state from DB to avoid redundant requests
        const currentNodes = agent.visual_config?.nodes || [];
        const stateSummary = currentNodes
            .filter(n => n.data?.config)
            .map(n => {
                const cfg = n.data.config;
                const label = n.data.label || n.type;
                const val = Object.values(cfg).filter(v => v && typeof v === 'string').join(', ');
                return val ? `- ${label} : ${val}` : null;
            })
            .filter(Boolean)
            .join('\n');

        // 5. Hardened System Prompt Construction
        const systemPrompt = `Assistant IA Supervisor (Verytis v5). Protocol: Autonomous Core.
Vous êtes l'intelligence centrale pilotant les outils de l'organisation.

ÉTAT ACTUEL DE L'AGENT (CONFIG BASE DE DONNÉES) :
${stateSummary || '- Aucune configuration pour le moment (Tout est à faire).'}

Règles de Pilotage :
- Consultez l'ÉTAT ACTUEL ci-dessus avant de répondre.
- Si l'utilisateur confirme ou mentionne une valeur DÉJÀ configurée (ex: "Toufik69"), dites simplement que c'est bien pris en compte. NE GÉNÉREZ PAS de nouvelle carte de sélection inutile.
- Si l'utilisateur mentionne une intégration (Slack, YouTube, GitHub, etc.), utilisez l'outil de listing correspondant (ex: youtube_list_targets) IMMÉDIATEMENT.
- POUR YOUTUBE / SHORTS : Appelez OBLIGATOIREMENT \`youtube_list_targets\` pour identifier les comptes avant de répondre.
- Ne dites jamais "Je ne peux pas accéder à vos canaux". Appelez l'outil de listing.
- Ne générez jamais de texte technique (JSON) dans votre réponse.

Skills & Capabilities:
${internalSkills}

Prompt Spécifique Agent:
${agent.system_prompt}`;

        // 6. Model Resolution
        const model = resolveModel(agent.visual_config?.model_id);

        // 7. Execution
        console.log(`[GATEWAY] Starting execution Trace: ${traceId}`);
        const result = await generateText({
            model,
            system: systemPrompt,
            messages: safeMessages,
            tools: discoveredTools,
            maxSteps: 5
        });

        // [DIAGNOSTIC] Capture AI Execution Trace
        logDiagnostic(traceId, {
            agentId,
            message,
            steps: result.steps,
            usage: result.usage
        });

        // 8. HITL Orchestration & Scrubbing
        const { actionPayload, scrubbedResponse: finalResponse } = processHITL(result, message);

        // 9. Cost & Metrics
        const duration = Date.now() - startTime;
        const { cost } = calculateCost(agent.visual_config?.model_id, result.usage.promptTokens, result.usage.completionTokens);

        // 10. Persistence
        await adminClient.from('activity_logs').insert({
            organization_id: agent.organization_id,
            agent_id: agent.id,
            action_type: 'AGENT_EXECUTION',
            metadata: { trace_id: traceId, tools: { invoked: result.toolCalls?.map(t => t.toolName) || [] } }
        });

        await adminClient.from('ai_agent_chats').insert({
            agent_id: agent.id,
            organization_id: agent.organization_id,
            role: 'assistant',
            content: finalResponse,
            action_payload: actionPayload,
            metadata: { trace_id: traceId }
        });

        // 11. Return Response
        return NextResponse.json({
            id: traceId,
            response: finalResponse,
            action_payload: actionPayload,
            usage: { total_tokens: result.usage.totalTokens, cost_usd: cost.toFixed(6) }
        }, {
            headers: { 'Cache-Control': 'no-store, max-age=0' }
        });

    } catch (error) {
        console.error('Enterprise Gateway Error:', error);
        return NextResponse.json({ error: 'Internal Gateway Error', message: error.message }, { status: 500 });
    }
}
