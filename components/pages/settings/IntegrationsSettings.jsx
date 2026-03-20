'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Card, Button, SkeletonSettingsItem } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { useRole } from '@/lib/providers';
import { 
    Blocks, Key, Plus, Github, Box, Settings2, Trash2, X, CheckCircle2, Loader2, RefreshCw,
    Shield, User, Lock, ExternalLink, MessageSquare, List, Layout, ShieldCheck, Activity, Flame
} from 'lucide-react';

const fetcher = (url) => fetch(url).then(res => res.json());

const DEFAULT_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', domain: 'openai.com', status: 'Not Configured', tokenPreview: '', logo: '/logos/openai.svg' },
    { id: 'anthropic', name: 'Anthropic Claude', domain: 'anthropic.com', status: 'Not Configured', tokenPreview: '', logo: '/logos/anthropic.svg' },
    { id: 'google', name: 'Google Gemini', domain: 'gemini.google.com', logo: '/logos/google-gemini.svg', status: 'Not Configured', tokenPreview: '' },
    { id: 'google_workspace', name: 'Google Workspace', domain: 'workspace.google.com', logo: '/logos/google.svg', status: 'Not Configured' },
    { id: 'github', name: 'GitHub', domain: 'github.com', status: 'Not Configured', tokenPreview: '', logo: '/logos/github.svg' },
    { id: 'slack', name: 'Slack', domain: 'slack.com', status: 'Not Configured', tokenPreview: '', logo: '/logos/slack.svg' },
    { id: 'trello', name: 'Trello', domain: 'trello.com', status: 'Not Configured', tokenPreview: '', logo: '/logos/trello.svg' },
    { id: 'shopify', name: 'Shopify', domain: 'shopify.com', status: 'Not Configured', tokenPreview: '', logo: '/logos/shopify.svg' },
];

const OAUTH_PROVIDERS = ['github', 'slack', 'trello', 'shopify', 'google_workspace'];

export default function IntegrationsSettings() {
    const { currentUser } = useRole();
    const isAdmin = currentUser?.role === 'Admin';
    const isPrivileged = currentUser?.role === 'Admin' || currentUser?.role === 'Manager';
    const { data, isLoading, mutate } = useSWR('/api/settings', fetcher);

    const [providers, setProviders] = useState(DEFAULT_PROVIDERS);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeProvider, setActiveProvider] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [processingIds, setProcessingIds] = useState([]); // Track individual button loading

    // Shopify modal
    const [isShopifyModalOpen, setIsShopifyModalOpen] = useState(false);
    const [shopifyStoreUrl, setShopifyStoreUrl] = useState('');

    // Form fields for modal
    const [modalApiKey, setModalApiKey] = useState('');
    const [modalProviderName, setModalProviderName] = useState('');
    const [modalEndpoint, setModalEndpoint] = useState('');

    useEffect(() => {
        const handleRefresh = (event) => {
            console.log("[SETTINGS] Message received from:", event.origin, "Data:", event.data);
            
            // Relaxed origin check for development/ngrok environments
            const baseDomain = window.location.origin.replace(/^https?:\/\//, '').split(':')[0];
            const eventDomain = event.origin.replace(/^https?:\/\//, '').split(':')[0];
            
            if (eventDomain !== baseDomain && event.origin !== 'null') {
                console.warn("[SETTINGS] Origin mismatch ignored, but logging:", event.origin, "vs", window.location.origin);
            }

            if (['SLACK_CONNECTED', 'GITHUB_CONNECTED', 'TRELLO_CONNECTED', 'TRELLO_LINKED', 'GITHUB_LINKED', 'GOOGLE_CONNECTED', 'GOOGLE_WORKSPACE_CONNECTED'].includes(event.data?.type)) {
                console.log("[SETTINGS] Connection SUCCESS detected, forcing re-fetch...", event.data.type);
                mutate();
            }

            if (event.data?.type === 'SHOPIFY_CONNECTED') {
                mutate();
            }
        };

        window.addEventListener('message', handleRefresh);
        return () => window.removeEventListener('message', handleRefresh);
    }, [mutate]);

    useEffect(() => {
        if (data?.providers) {
            // Synchronisation de l'état local avec la réalité du serveur (LLM)
            setProviders(prev => prev.map(p => {
                const found = data.providers.find(bp => bp.id === p.id && bp.connection_type === 'llm');
                if (found) {
                    return { 
                        ...p, 
                        status: found.status || 'Connected', 
                        tokenPreview: found.tokenPreview || '...'
                    };
                }
                return p;
            }));
        }
    }, [data]);

    const handleOpenModal = (provider = null) => {
        setActiveProvider(provider);
        setModalApiKey('');
        setModalProviderName(provider ? provider.name : '');
        setModalEndpoint(provider ? `https://api.${provider.domain}/v1` : '');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let updatedProviders = [...providers];
            const newPreview = modalApiKey.length > 8
                ? `${modalApiKey.substring(0, 4)}...${modalApiKey.substring(modalApiKey.length - 4)}`
                : '...';

            if (activeProvider) {
                // Update existing
                updatedProviders = updatedProviders.map(p =>
                    p.id === activeProvider.id
                        ? { ...p, status: 'Connected', tokenPreview: newPreview, rawToken: modalApiKey, connection_type: 'llm' }
                        : p
                );
            } else {
                // Add custom (Simplified)
                const newId = modalProviderName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                const domainMatch = modalEndpoint.match(/https?:\/\/(?:api\.)?([^/]+)/);
                const domain = domainMatch ? domainMatch[1] : 'example.com';
                updatedProviders.push({
                    id: newId,
                    name: modalProviderName,
                    domain: domain,
                    status: 'Connected',
                    tokenPreview: newPreview,
                    rawToken: modalApiKey,
                    connection_type: 'llm'
                });
            }

            // Save to API
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providers: updatedProviders })
            });

            if (!res.ok) throw new Error('Failed to save integration');

            setProviders(updatedProviders);
            await mutate(); // Refresh UI cleanly
            setIsModalOpen(false);
            alert('Integration secret secured and saved!');
        } finally {
            setIsSaving(false);
        }
    };

    const getConnectionStatus = (appName, type) => {
        // Isolation parfaite : On cherche une ligne qui a EXACTEMENT le bon nom d'app ET le bon type
        return data?.providers?.some(p => 
            p.id === appName && 
            p.connection_type === type
        );
    };

    const handleDisconnect = async (appName, connectionType = 'llm') => {
        const processKey = `${appName}-${connectionType}`;
        if (processingIds.includes(processKey)) return;

        // SAFEGUARD: Confirmation before action
        const isGitHubTeam = appName === 'github' && connectionType === 'team';
        const confirmMsg = isGitHubTeam
            ? "Note : La déconnexion ici supprime le lien avec Verytis. Pour révoquer totalement l'accès ou changer d'organisation, vous devez également désinstaller l'application dans vos paramètres GitHub. Continuer ?"
            : (connectionType === 'team' 
                ? `Êtes-vous sûr de vouloir déconnecter l'intégration d'équipe "${appName}" ? Cela affectera toute l'organisation.`
                : `Voulez-vous déconnecter votre compte personnel "${appName}" ?`);
        
        if (!window.confirm(confirmMsg)) return;
        
        setProcessingIds(prev => [...prev, processKey]);
        console.log(`[SETTINGS] Requesting Granular Disconnect for ${appName} (${connectionType})...`);
        
        try {
            // Use specialized route for team/personal, fallback to settings for llm
            const endpoint = connectionType === 'llm' ? '/api/settings' : '/api/integrations/disconnect';
            const method = connectionType === 'llm' ? 'DELETE' : 'POST';

            const res = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: appName, // field used by /api/settings
                    appName: appName, // field used by /api/integrations/disconnect
                    type: connectionType, // field used by /api/settings
                    connectionType: connectionType // field used by /api/integrations/disconnect
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to disconnect');
            }

            console.log('[SETTINGS] Disconnection successful, triggering mutate()...');
            // INSTANT UI SYNC: Update local SWR cache or revalidation
            await mutate(); 
        } catch (err) {
            console.error('[SETTINGS] Error during disconnection:', err);
            alert(`Erreur lors de la déconnexion : ${err.message}`);
        } finally {
            // Revalidation safeguard
            setTimeout(() => {
                mutate();
                setProcessingIds(prev => prev.filter(k => k !== processKey));
            }, 600);
        }
    };

    const isProcessing = (id, type) => processingIds.includes(`${id}-${type}`);
    const openCenteredPopup = (url, title) => {
        const width = 640;
        const height = 760;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        window.open(url, title, `width=${width},height=${height},top=${top},left=${left}`);
    };

    if (isLoading) return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <SkeletonSettingsItem />
            <SkeletonSettingsItem />
        </div>
    );

    // Deduplicate providers by ID for the UI cards
    const uniqueProviders = providers.filter((p, index, self) => 
        index === self.findIndex((t) => t.id === p.id)
    );

    const llmProviders = uniqueProviders.filter(p => !OAUTH_PROVIDERS.includes(p.id));
    const oauthProviders = uniqueProviders.filter(p => OAUTH_PROVIDERS.includes(p.id));


    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="pb-2 border-b border-slate-100 flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Blocks className="w-6 h-6 text-indigo-600" />
                        Integrations & Providers
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage global API keys and secrets for external LLMs and developer tools.
                    </p>
                </div>
                <Button variant="primary" icon={Plus} onClick={() => handleOpenModal(null)}>Add Integration</Button>
            </div>

            {/* LLM Section (Admin Only Config) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Intelligence (Team)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {llmProviders.map((p) => (
                        <Card key={p.id} className="p-5 flex flex-col relative overflow-hidden group hover:border-blue-200 transition-colors">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                                    <img src={p.logo || `https://www.google.com/s2/favicons?domain=${p.domain}&sz=128&alt=404`} 
                                         onError={(e) => { e.target.src = `https://logo.clearbit.com/${p.domain}`; }}
                                         alt={p.name} className="w-6 h-6 object-contain" />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${p.status === 'Connected' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {p.status}
                                </span>
                            </div>

                            <h3 className="font-bold text-slate-900 mb-1">{p.name}</h3>
                            <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                                {isAdmin ? 'Configurez la clé API globale pour toute l\'organisation.' : 'Licence Entreprise gérée par l\'administrateur.'}
                            </p>

                            <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                                {p.status === 'Connected' ? (
                                    <>
                                        <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-md border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <Key className="w-3.5 h-3.5 text-slate-400" />
                                                <code className="text-xs font-mono text-slate-700">{p.tokenPreview}</code>
                                            </div>
                                        </div>
                                        {isAdmin ? (
                                            <Button variant="secondary" className="w-full text-xs py-1.5 h-auto text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDisconnect(p.id)}>Déconnecter</Button>
                                        ) : (
                                            <div className="w-full py-2 bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest text-center rounded-lg border border-blue-100">
                                                Vault Protégé
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    isAdmin ? (
                                        <Button variant="secondary" className="w-full text-xs h-9 border-dashed border-2 bg-slate-50 hover:bg-slate-100 text-slate-500" onClick={() => handleOpenModal(p)}>
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Secure Key
                                        </Button>
                                    ) : (
                                        <div className="w-full py-2 bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest text-center rounded-lg border border-dashed border-slate-200">
                                            Contactez l'Admin
                                        </div>
                                    )
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Apps Section (Hybrid Org/Perso) */}
            <div className="space-y-4 pt-8">
                <div className="flex items-center gap-2">
                    <Blocks className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Applications & Outils</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {oauthProviders.map((p) => {
                        const isConnected = getConnectionStatus(p.id, 'team');
                        const conn = data?.providers?.find(c => c.id === p.id && (c.connection_type === 'team' || c.connection_type === 'personal'));

                        return (
                            <Card key={p.id} className="p-0 flex flex-col relative overflow-hidden group hover:border-blue-200 transition-all border-slate-200">
                                <div className="p-5 border-b border-slate-100 bg-white">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                                            <img src={p.logo || `https://www.google.com/s2/favicons?domain=${p.domain}&sz=128&alt=404`} 
                                                 onError={(e) => { e.target.src = `https://logo.clearbit.com/${p.domain}`; }}
                                                 alt={p.name} className="w-6 h-6 object-contain" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 mt-2 mr-auto ml-3">
                                            {p.id === 'github' ? 'GitHub' : 
                                             p.id === 'slack' ? 'Slack' : 
                                             p.id === 'trello' ? 'Trello' : 
                                             p.id === 'google_workspace' ? 'Google Workspace' :
                                             p.name}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                        Liez votre workspace pour permettre à vos agents de collaborer.
                                    </p>
                                </div>

                                <div className="p-5 space-y-6 bg-slate-50/50 flex-grow">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Shield className="w-3.5 h-3.5 text-blue-600" />
                                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Workspace Link</span>
                                            </div>
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                                                {isConnected ? 'Connecté' : 'Non Config'}
                                            </span>
                                        </div>
                                        
                                        {isConnected && p.id === 'github' ? (
                                            <div className="space-y-3">
                                                <button 
                                                    className="w-full py-4 px-4 h-auto text-[11px] font-bold uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-3 active:scale-95 bg-white border border-blue-100 text-blue-600 hover:bg-blue-50"
                                                    onClick={() => {
                                                        const instId = conn?.metadata?.installation_id;
                                                        const orgName = conn?.account_name;
                                                        let url = `https://github.com/settings/installations`;
                                                        if (instId) {
                                                            url = orgName 
                                                                ? `https://github.com/organizations/${orgName}/settings/installations/${instId}`
                                                                : `https://github.com/settings/installations/${instId}`;
                                                        }
                                                        window.open(url, '_blank');
                                                    }}
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                    GÉRER L'APP
                                                </button>
                                                <button 
                                                    onClick={() => handleDisconnect(p.id, conn.connection_type)}
                                                    className="w-full text-center text-[9px] text-slate-400 hover:text-rose-500 transition-colors uppercase font-black tracking-widest"
                                                >
                                                    Déconnecter l'intégration
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                disabled={isProcessing(p.id, 'team')}
                                                className={`w-full py-4 px-4 h-auto text-[11px] font-bold uppercase tracking-wider rounded-2xl transition-all shadow-md flex items-center justify-center gap-3 active:scale-95 ${isProcessing(p.id, 'team') ? 'opacity-50 cursor-not-allowed' : ''} ${isConnected ? 'bg-white border border-rose-100 text-rose-500 hover:bg-rose-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                                                onClick={isConnected ? () => handleDisconnect(p.id, conn.connection_type) : async () => {
                                                    const processKey = `${p.id}-team`;
                                                    setProcessingIds(prev => [...prev, processKey]);
                                                    try {
                                                        const supabase = createClient();
                                                        const { data: { user } } = await supabase.auth.getUser();
                                                        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
                                                        
                                                        if (p.id === 'shopify') {
                                                            setShopifyStoreUrl('');
                                                            setIsShopifyModalOpen(true);
                                                            return;
                                                        }

                                                        const authUrl = p.id === 'github' ? `/api/auth/github/install?organizationId=${profile?.organization_id}&userId=${user.id}` :
                                                                        p.id === 'trello' ? `/api/auth/trello/login?userId=${user.id}&organizationId=${profile?.organization_id}` :
                                                                        p.id === 'google_workspace' ? `/api/auth/google/login?userId=${user.id}&organizationId=${profile?.organization_id}` :
                                                                        `/api/slack/install?userId=${user.id}&organizationId=${profile?.organization_id}`;
                                                        openCenteredPopup(authUrl, `Connecter ${p.name}`);
                                                    } finally {
                                                        setTimeout(() => setProcessingIds(prev => prev.filter(k => k !== processKey)), 2000);
                                                    }
                                                }}
                                            >
                                                {isProcessing(p.id, 'team') ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                                    p.id === 'github' ? <Github size={18} /> : 
                                                    <img src={p.logo || `https://www.google.com/s2/favicons?domain=${p.domain}&sz=128&alt=404`} 
                                                         onError={(e) => { e.target.src = `https://logo.clearbit.com/${p.domain}`; }}
                                                         className="w-5 h-5 shrink-0 object-contain" />
                                                )}
                                                {isConnected ? `DÉCONNECTER ${p.name.toUpperCase()}` : `CONNECTER ${p.name.toUpperCase()}`}
                                            </button>
                                        )}

                                         {conn?.account_name && (
                                            <p className="text-[10px] font-medium text-slate-500 mt-2 flex items-center gap-2 px-1 truncate">
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-sm shadow-blue-200" />
                                                {conn.account_name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <div className="pt-4">
                <Card className="p-5 bg-blue-50/50 border-blue-100 flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Unified Workspace Connection</h3>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Votre workspace bénéficie d'une connexion unique par outil. La visibilité et les actions des agents sont restreintes par les configurations spécifiques de chaque Flow et la gouvernance globale.
                        </p>
                    </div>
                </Card>
            </div>

            <Card className="p-6 bg-blue-50/50 border-blue-100">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Settings2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-900">Zero-Trust Vault</h3>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                            All provider secrets are encrypted using AES-256-GCM before being stored in the database. Verytis agents never have direct access to these raw credentials—they interact strictly through the Proxy Gateway which injects the tokens securely at runtime.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Config Modal Overlay */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                {activeProvider ? (
                                    <>
                                        <img src={activeProvider.logo || `https://www.google.com/s2/favicons?domain=${activeProvider.domain}&sz=128`} className="w-5 h-5" />
                                        Configure {activeProvider.name}
                                    </>
                                ) : (
                                    <>
                                        <Blocks className="w-5 h-5 text-indigo-600" />
                                        Add Custom Integration
                                    </>
                                )}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {!activeProvider && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Provider Name</label>
                                    <input
                                        type="text"
                                        value={modalProviderName}
                                        onChange={e => setModalProviderName(e.target.value)}
                                        placeholder="e.g. HuggingFace"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">API Endpoint URL (Optional)</label>
                                <input
                                    type="url"
                                    placeholder="https://api..."
                                    value={modalEndpoint}
                                    onChange={e => setModalEndpoint(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono text-slate-600"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex justify-between">
                                    <span>Secure API Key</span>
                                    {activeProvider?.status === 'Connected' && <span className="text-emerald-600 flex items-center gap-1 text-[10px] uppercase tracking-wider"><CheckCircle2 className="w-3 h-3" /> Encrypted in Vault</span>}
                                </label>
                                <input
                                    type="password"
                                    value={modalApiKey}
                                    onChange={e => setModalApiKey(e.target.value)}
                                    placeholder={activeProvider?.status === 'Connected' ? '••••••••••••••••••••••••' : 'sk-...'}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono"
                                />
                                <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5" /> Key will be encrypted via AES-256-GCM.
                                </p>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? 'Encrypting & Saving...' : 'Save Configuration'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shopify Modal */}
            {isShopifyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                <img src="/logos/shopify.svg" className="w-5 h-5" />
                                Connecter Shopify
                            </h3>
                            <button onClick={() => setIsShopifyModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1.5">URL de votre boutique</label>
                                <input
                                    type="text"
                                    value={shopifyStoreUrl}
                                    onChange={e => setShopifyStoreUrl(e.target.value)}
                                    placeholder="maboutique.myshopify.com"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono"
                                />
                                <p className="text-[11px] text-slate-500 mt-2">
                                    Exemple: <code className="font-mono">maboutique.myshopify.com</code>
                                </p>
                            </div>

                            <div className="pt-2">
                                <button
                                    className="w-full py-4 px-4 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition shadow-lg active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!shopifyStoreUrl.trim()}
                                    onClick={() => {
                                        const url = `/api/auth/shopify/login?store_url=${encodeURIComponent(shopifyStoreUrl.trim())}&scope=workspace`;
                                        openCenteredPopup(url, 'Shopify Workspace Connect');
                                        setIsShopifyModalOpen(false);
                                    }}
                                >
                                    <Box className="w-4 h-4" />
                                    CONNECTER SHOPIFY
                                </button>
                                <p className="text-[10px] text-slate-400 mt-3 text-center font-medium">
                                    L'installation nécessite les droits administrateur sur la boutique Shopify.
                                </p>
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <Button variant="secondary" onClick={() => setIsShopifyModalOpen(false)}>Fermer</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
