import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Box, Check, AlertCircle, Key, Save, Loader2, ExternalLink, Brain, Sparkles, Plus, Shield } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useSWRConfig } from 'swr';
import { useRole } from '@/lib/providers';
import { createClient } from '@/lib/supabase/client';

const ToolNode = ({ data, isConnectable }) => {
    const { showToast } = useToast();
    const [showInput, setShowInput] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [tempKey, setTempKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { currentUser } = useRole();
    const isAdmin = currentUser?.role === 'Admin';
    const isPrivileged = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';

    const { mutate } = useSWRConfig();

    React.useEffect(() => {
        const handleRefresh = (event) => {
            if (event.origin !== window.location.origin) return;
            if (['SLACK_CONNECTED', 'GITHUB_CONNECTED', 'TRELLO_CONNECTED', 'TRELLO_LINKED', 'GITHUB_LINKED', 'GOOGLE_WORKSPACE_CONNECTED'].includes(event.data?.type)) {
                // If the builder parent already refreshes, this might be redundant but safer
                mutate('/api/settings');
            }
        };
        window.addEventListener('message', handleRefresh);
        return () => window.removeEventListener('message', handleRefresh);
    }, [mutate]);

    const label = data.label || 'Action / Integration';
    const description = data.description || '';
    const authRecord = data.auth_requirement || {
        type: 'api_key',
        label: 'Clé API / Token',
        placeholder: 'Collez Token / Clé API...'
    };

    // ─── Internal Skill Detection ──────────────────────────────
    // If auth_requirement.type is 'none', this is a built-in AI skill
    // that requires no external API key.
    const isInternalSkill = authRecord.type === 'none';

    // Dynamic Branding Logic
    const toolMapping = {
        'stripe': 'stripe.com',
        'lemlist': 'lemlist.com',
        'hubspot': 'hubspot.com',
        'salesforce': 'salesforce.com',
        'notion': 'notion.so',
        'airtable': 'airtable.com',
        'github': 'github.com',
        'linkedin': 'linkedin.com',
        'slack': 'slack.com',
        'scrap': 'scrapingbee.com',
        'analyzer': 'google.com',
        'search': 'google.com',
        'openai': 'openai.com',
        'postgres': 'postgresql.org',
        'mongodb': 'mongodb.com',
        'mysql': 'mysql.com',
        'firebase.google': 'firebase.google.com',
        'supabase': 'supabase.com',
        'sql': 'postgresql.org',
        'gmail': 'google.com',
        'drive': 'google.com',
        'calendar': 'google.com',
    };

    const getDomain = () => {
        if (data.logoDomain) return data.logoDomain;
        const combined = (label + ' ' + description).toLowerCase();
        for (const [key, domain] of Object.entries(toolMapping)) {
            if (combined.includes(key)) return domain;
        }
        return null;
    };

    const domain = getDomain();
    const providerName = domain ? domain.split('.')[0] : 'tool';
    
    const connectedOrg = data.connectedProviders?.find(p => {
        const pId = (p.id || '').toLowerCase();
        const pDomain = (p.domain || '').toLowerCase();
        const targetDomain = domain?.toLowerCase();
        
        // Robust Google Match: matches if p.id or p.domain contains 'google' or 'workspace' 
        // and targetDomain is google.com
        const isGoogleProvider = pId.includes('google') || pId.includes('workspace') || pDomain.includes('google');
        const isGoogleTarget = targetDomain === 'google.com' || 
                               ['google', 'google_workspace', 'gmail', 'drive', 'calendar'].includes(providerName.toLowerCase());
        
        const isMatch = (pDomain && targetDomain && (pDomain.includes(targetDomain) || targetDomain.includes(pDomain))) ||
                        (isGoogleProvider && isGoogleTarget);

        return isMatch && 
               p.status === 'Connected' && (p.connection_type === 'team' || (!p.is_perso && p.connection_type !== 'personal'));
    });

    const connectedPerso = data.connectedProviders?.find(p => {
        const pId = (p.id || '').toLowerCase();
        const pDomain = (p.domain || '').toLowerCase();
        const targetDomain = domain?.toLowerCase();

        const isGoogleProvider = pId.includes('google') || pId.includes('workspace') || pDomain.includes('google');
        const isGoogleTarget = targetDomain === 'google.com';

        const isMatch = (pDomain && targetDomain && (pDomain.includes(targetDomain) || targetDomain.includes(pDomain))) ||
                        (isGoogleProvider && isGoogleTarget);

        return isMatch && 
               p.status === 'Connected' && (p.connection_type === 'personal' || p.is_perso);
    });

    const isGlobalConnected = !!(connectedOrg || connectedPerso);
    const isOrgLevel = !!connectedOrg;

    const isConnected = isGlobalConnected || isSynced || isInternalSkill;

    // Categorization for specialized messaging
    const dataBridgeProviders = ['postgresql.org', 'mongodb.com', 'mysql.com', 'firebase.google.com', 'supabase.com', 'google.com/sheets'];
    const isDataBridge = dataBridgeProviders.includes(domain);

    const handleSyncKey = async () => {
        if (!tempKey.trim()) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: providerName, apiKey: tempKey, scope: 'workspace' })
            });

            if (res.ok) {
                setIsSynced(true);
                setShowInput(false);
                showToast({
                    title: 'Vault Mis à Jour',
                    message: `L'intégration ${providerName} est configurée pour tout le Workspace.`,
                    type: 'success'
                });
                if (data.onChange) data.onChange('apiKey', tempKey);
            } else {
                showToast({ title: 'Erreur', message: 'Impossible de sauvegarder dans le Vault.', type: 'error' });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Visual Theming ─────────────────────────────────────────
    // Internal Skills: purple/indigo theme
    // External Connected: emerald theme
    // External Pending: red theme
    // Default: slate/blue
    const getContainerClass = () => {
        if (isInternalSkill) return 'border-indigo-400 bg-indigo-50/20';
        if (!isConnected && domain) return 'border-red-500 bg-red-50/30';
        if (isConnected) return 'border-blue-500 bg-blue-50/10';
        return 'border-slate-200 hover:border-blue-400';
    };

    const getHeaderBgClass = () => {
        if (isInternalSkill) return 'bg-gradient-to-b from-indigo-50 to-violet-50/30';
        if (!isConnected && domain) return 'bg-red-50';
        if (isConnected) return 'bg-blue-50/20';
        return 'bg-blue-50/20';
    };

    const getStatusColor = () => {
        if (isInternalSkill) return 'text-indigo-600/50';
        if (!isConnected && domain) return 'text-red-600/50';
        if (isConnected) return 'text-blue-600/60';
        return 'text-blue-600/50';
    };

    const getStatusLabel = () => {
        if (isInternalSkill) return 'Compétence IA';
        if (isConnected) return 'Connecté (Vault)';
        if (!domain) return 'Tool Node';
        return 'En attente de clé';
    };

    return (
        <div className={`bg-white border-2 rounded-2xl shadow-sm hover:shadow-xl transition-all group overflow-hidden min-w-[240px] ${getContainerClass()}`}>
            {/* Header */}
            <div className={`p-4 flex flex-col items-center gap-3 border-b ${isInternalSkill ? 'border-indigo-100' : 'border-slate-100'} ${getHeaderBgClass()}`}>
                <div className={`p-3 rounded-2xl transition-all group-hover:scale-110 duration-300 flex items-center justify-center ${isInternalSkill
                    ? 'bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 w-16 h-16'
                    : domain
                        ? 'bg-white shadow-md border border-slate-100 w-16 h-16 overflow-hidden'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                    {isInternalSkill ? (
                        <Brain className="w-8 h-8 text-indigo-600" />
                    ) : domain ? (
                        <img
                            src={domain === 'trello.com' ? '/icon-trello.png' : `https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                            alt={label}
                            className={`w-10 h-10 object-contain`}
                        />
                    ) : (
                        <Box className="w-8 h-8 fill-blue-600" />
                    )}
                    {isConnected && !isInternalSkill && (
                        <div className="absolute top-0 right-0 bg-blue-500 text-white p-1 rounded-bl-lg shadow-sm">
                            <Check className="w-3 h-3" />
                        </div>
                    )}
                    {isInternalSkill && (
                        <div className="absolute top-0 right-0 bg-indigo-500 text-white p-1 rounded-bl-lg shadow-sm">
                            <Sparkles className="w-3 h-3" />
                        </div>
                    )}
                </div>
                <div className="text-center">
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${getStatusColor()}`}>
                        {getStatusLabel()}
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1 px-4 tracking-tight">
                        {label}
                    </div>
                </div>
            </div>

            {/* Content / Interaction */}
            <div className="px-5 py-4 space-y-3">
                {isInternalSkill ? (
                    /* ─── Internal Skill: No config needed badge ─── */
                    <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                        <span className="text-[10px] font-bold text-indigo-700 tracking-tight">
                            🧠 Compétence Native
                        </span>
                    </div>
                ) : (
                    /* ─── External Tool: Connection status + key input ─── */
                    <>
                    <div className="flex flex-col gap-2">
                        {/* Status Row */}
                        {/* Status Row */}
                        <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1.5">
                                {/* Single Status Badge */}
                                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ring-1 ${isConnected ? 'bg-blue-600 text-white ring-blue-600 shadow-sm' : 'bg-slate-50 text-slate-300 ring-slate-100'}`}>
                                    {isConnected ? (
                                        <>
                                            <Shield className="w-2.5 h-2.5" /> Workspace Linked
                                        </>
                                    ) : (
                                        <>
                                            <AlertCircle className="w-2.5 h-2.5" /> Disconnected
                                        </>
                                    )}
                                </div>
                                
                                {/* Slack Thread Mode specific badge */}
                                {data.provider === 'slack' && data.config?.thread_mode && (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter ring-1 bg-purple-600 text-white ring-purple-600">
                                        Threads
                                    </div>
                                )}
                            </div>

                            {/* Action / Modifier for API keys or custom config */}
                            {isConnected && !isInternalSkill && (
                                <button
                                    onClick={() => setShowInput(!showInput)}
                                    className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                    {showInput ? 'Annuler' : 'Config'}
                                </button>
                            )}
                        </div>
                    </div>

                        {/* OAuth Connection Zone */}
                        {(!isConnected || showInput) && domain && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-3">
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center gap-3 text-center transition-all group-hover:border-blue-200 group-hover:bg-blue-50/30">
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100">
                                        <img 
                                            src={domain === 'trello.com' ? '/icon-trello.png' : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                            className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all"
                                            alt=""
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-900 font-black uppercase tracking-tighter">CONNECTION SÉCURISÉE</p>
                                        <p className="text-[9px] text-slate-500 font-medium leading-tight px-2">
                                            Autorisez Verytis à interagir avec {label} via OAuth 2.0.
                                        </p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            setIsSaving(true);
                                            try {
                                                const supabase = createClient();
                                                const { data: { user } } = await supabase.auth.getUser();
                                                
                                                if (!user) {
                                                    showToast({ title: 'Erreur', message: 'Veuillez vous reconnecter.', type: 'error' });
                                                    return;
                                                }

                                                let authUrl = '';
                                                
                                                // Fetch organization_id
                                                const { data: profile } = await supabase
                                                    .from('profiles')
                                                    .select('organization_id')
                                                    .eq('id', user.id)
                                                    .single();
                                                const orgId = profile?.organization_id;

                                                if (providerName === 'github') {
                                                    authUrl = `/api/auth/github/login?organizationId=${orgId}`;
                                                } else if (providerName === 'trello') {
                                                    authUrl = `/api/auth/trello/login?organizationId=${orgId}`;
                                                } else if (providerName === 'slack') {
                                                    authUrl = `/api/slack/install?organizationId=${orgId}`;
                                                } else if (providerName === 'shopify') {
                                                    const storeUrl = prompt("Veuillez entrer l'URL de votre boutique Shopify (ex: mat-boutique.myshopify.com) :");
                                                    if (storeUrl) {
                                                        authUrl = `/api/auth/shopify/login?store_url=${storeUrl}&scope=team&organizationId=${orgId}`;
                                                    }
                                                }

                                                if (authUrl) {
                                                    // Open in a popup to avoid "redirecting" the user away from the builder
                                                    const width = 600;
                                                    const height = 700;
                                                    const left = window.screenX + (window.outerWidth - width) / 2;
                                                    const top = window.screenY + (window.outerHeight - height) / 2;
                                                    
                                                    const popup = window.open(
                                                        authUrl,
                                                        `Connecter ${label}`,
                                                        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
                                                    );

                                                    // Simple check for popup closure to refresh status
                                                    const timer = setInterval(() => {
                                                        if (popup.closed) {
                                                            clearInterval(timer);
                                                            showToast({
                                                                title: 'Vérification',
                                                                message: 'Vérification de la connexion en cours...',
                                                                type: 'info'
                                                            });
                                                            // Logic to refresh node status would go here
                                                            // Suggesting manual refresh for now if needed
                                                            showToast({
                                                                title: 'Actualisation',
                                                                message: 'Veillez à sauvegarder votre flux.',
                                                                type: 'success'
                                                            });
                                                        }
                                                    }, 1000);
                                                }
                                            } catch (e) {
                                                console.error(e);
                                                showToast({ title: 'Erreur', message: 'Impossible de lancer la connexion.', type: 'error' });
                                            } finally {
                                                setIsSaving(false);
                                            }
                                        }}
                                        disabled={isSaving}
                                        className="w-full h-11 flex items-center justify-center gap-3 bg-[#111827] hover:bg-[#1f2937] text-white rounded-xl text-[11px] font-bold transition-all active:scale-[0.98] shadow-md group/btn"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                                        ) : (
                                            <>
                                                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center p-1 shadow-sm">
                                                    <img 
                                                        src={domain === 'trello.com' ? '/icon-trello.png' : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                                                        className="w-4 h-4 object-contain"
                                                        alt=""
                                                    />
                                                </div>
                                                <span>Connecter {label}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className={`w-3 h-3 border-2 border-white rounded-full ${isInternalSkill ? 'bg-indigo-500' : 'bg-blue-600'}`}
            />

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className={`w-3 h-3 border-2 border-white rounded-full transition-colors ${isInternalSkill ? 'bg-indigo-400 hover:bg-indigo-600' : 'bg-blue-400 hover:bg-blue-600'}`}
            />
        </div>
    );
};

export default memo(ToolNode);
