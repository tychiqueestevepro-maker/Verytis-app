'use client';
import React, { memo, useState, useEffect } from 'react';
import useSWR from 'swr';
import { Handle, Position } from '@xyflow/react';
import { Zap, Radio, Copy, Check, Clock, Globe, ChevronDown, ChevronUp, Shield, Lock, Webhook, AlertCircle, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

// ─── Allowed trigger types (no API Key / Token – OAuth only) ───
const TRIGGER_TYPES = [
    {
        id: 'app',
        label: 'App (OAuth)',
        icon: Globe,
        color: 'violet',
        activeClass: 'bg-violet-100 text-violet-700 border border-violet-300 shadow-sm'
    },
    {
        id: 'webhook',
        label: 'Webhook',
        icon: Webhook,
        color: 'emerald',
        activeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm'
    },
    {
        id: 'scheduled',
        label: 'Planifié',
        icon: Clock,
        color: 'blue',
        activeClass: 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
    },
];

// Known OAuth providers and their display info
const OAUTH_PROVIDERS = {
    slack:   { label: 'Slack',   domain: 'slack.com',  events: ['message', 'app_mention', 'member_joined_channel', 'file_share'] },
    github:  { label: 'GitHub',  domain: 'github.com', events: ['push', 'pull_request'] },
    trello:  { label: 'Trello',  domain: 'trello.com', events: ['updateCard', 'addMemberToCard', 'addAttachmentToCard', 'updateCheckItemStateOnCard'] },
    shopify: { 
        label: 'Shopify', 
        domain: 'shopify.com', 
        events: [
            { value: 'orders/create', label: 'Nouvelle commande (non payée)' },
            { value: 'orders/paid', label: 'Nouvelle commande payée' },
            { value: 'checkouts/update', label: 'Panier abandonné' },
            { value: 'inventory_levels/update', label: 'Rupture de stock' },
            { value: 'orders/cancelled', label: 'Commande annulée' },
            { value: 'customers/create', label: 'Nouveau client' }
        ] 
    },
    google_workspace: { 
        label: 'Google Workspace', 
        domain: 'workspace.google.com', 
        events: [
            { value: 'gmail_new_message', label: '📧 Gmail : Nouvel email reçu' },
            { value: 'drive_new_file', label: '🗂️ Drive : Nouveau fichier ajouté' },
            { value: 'calendar_new_event', label: '📅 Calendar : Nouvel événement créé' }
        ] 
    },
    stripe: {
        label: 'Stripe',
        domain: 'stripe.com',
        events: [
            { value: 'checkout.session.completed', label: '💰 Vente : Session terminée', description: 'Récupère les détails du client et du produit vendu.' },
            { value: 'checkout.session.expired', label: '⏳ Abandon : Panier expiré', description: 'Déclenche une relance automatique pour panier abandonné.' },
            { value: 'invoice.paid', label: '🧾 Facturation : Facture payée', description: 'Idéal pour déclencher une livraison sur Shopify.' },
            { value: 'charge.refunded', label: '🔄 Retour : Remboursement effectué', description: 'Pour ajuster les stocks ou révoquer des accès.' },
            { value: 'customer.subscription.deleted', label: '📉 Churn : Abonnement annulé', description: 'Déclenche une procédure de rétention client.' },
            { value: 'customer.subscription.updated', label: '🔄 Abonnement : Changement de plan', description: 'Pour synchroniser les accès ou CRM.' },
            { value: 'dispute.opened', label: '🚨 Alerte : Litige ouvert', description: 'Déclenchement immédiat pour défense automatique.' },
            { value: 'payout.failed', label: '⚠️ Erreur : Virement échoué', description: 'Alerte immédiate pour le suivi financier.' }
        ]
    }
};

const TriggerNode = ({ data, isConnectable }) => {
    const { showToast } = useToast();
    const label = data.label || 'Verytis Trigger';
    const agentId = data.agentId || 'bcb58aa1-31d7-4aa2-a735-c1886662a723';
    const webhookUrl = `https://api.verytis-ops.com/api/run/${agentId}`;

    const [copied, setCopied] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);
    const [oauthConnections, setOauthConnections] = useState([]);
    const [isLoadingConnections, setIsLoadingConnections] = useState(false);

    // Sync from node data
    const [localTriggerType, setLocalTriggerType] = useState(data.trigger_type || 'webhook');
    const [selectedProvider, setSelectedProvider] = useState(
        ['google', 'gmail', 'drive', 'calendar'].includes(data.provider) ? 'google_workspace' : (data.provider || '')
    );
    const [selectedEvent, setSelectedEvent] = useState(data.event_name || '');
    const [selectedConnectionId, setSelectedConnectionId] = useState(data.connection_id || '');
    const [cronExpression, setCronExpression] = useState(data.cron_expression || '0 8 * * *');
    const [triggerConfig, setTriggerConfig] = useState(data.trigger_config || {});
    const [metadata, setMetadata] = useState({ drive_folders: [], calendars: [] });
    const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

    // Scheduled states
    const [schFreq, setSchFreq] = useState(triggerConfig.frequency || 'daily');
    const [schTime, setSchTime] = useState(triggerConfig.time || '08:00');
    const [schTz, setSchTz] = useState(triggerConfig.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Security for webhook mode
    const security = data.security || { requires_ip_whitelist: false, header_secret: null };
    const [ipWhitelist, setIpWhitelist] = useState(security.ip_whitelist || '');
    const [headerSecret, setHeaderSecret] = useState(security.header_secret || '');

    const triggerType = localTriggerType;
    const currentType = TRIGGER_TYPES.find(t => t.id === triggerType) || TRIGGER_TYPES[0];
    const TypeIcon = currentType.icon;

    // Color theming
    const colorMap = {
        violet: { border: 'border-violet-400 hover:border-violet-500', bg: 'bg-violet-50/30', icon: 'bg-violet-100 text-violet-600', label: 'text-violet-600/50', handle: 'bg-violet-600', dot: 'text-violet-500' },
        emerald: { border: 'border-emerald-400 hover:border-emerald-500', bg: 'bg-emerald-50/30', icon: 'bg-emerald-100 text-emerald-600', label: 'text-emerald-600/50', handle: 'bg-emerald-600', dot: 'text-emerald-500' },
        blue: { border: 'border-blue-400 hover:border-blue-500', bg: 'bg-blue-50/30', icon: 'bg-blue-100 text-blue-600', label: 'text-blue-600/50', handle: 'bg-blue-600', dot: 'text-blue-500' },
    };
    const theme = colorMap[currentType.color] || colorMap.emerald;

    const fetcher = (url) => fetch(url).then(r => r.json());
    const { data: settingsData } = useSWR('/api/settings', fetcher);

    useEffect(() => {
        if (!settingsData) return;
        const connections =
            settingsData.user_connections ||
            settingsData.settings?.user_connections ||
            (Array.isArray(settingsData.providers)
                ? settingsData.providers.filter(p => p?.connection_type === 'team' || p?.connection_type === 'personal')
                : []);
        setOauthConnections(connections);
    }, [settingsData]);

    // Fetch Google metadata if needed
    useEffect(() => {
        if (selectedProvider !== 'google_workspace' || !['drive_new_file', 'calendar_new_event'].includes(selectedEvent)) return;
        
        const fetchGoogleMetadata = async () => {
            setIsLoadingMetadata(true);
            try {
                const type = selectedEvent === 'drive_new_file' ? 'drive_folders' : 'calendars';
                const res = await fetch(`/api/integrations/google/metadata?type=${type}`);
                const data = await res.json();
                if (res.ok) {
                    setMetadata(prev => ({ 
                        ...prev, 
                        [type]: data || [] 
                    }));
                }
            } catch (err) {
                console.error('[TriggerNode] Failed to fetch Google metadata', err);
            } finally {
                setIsLoadingMetadata(false);
            }
        };
        fetchGoogleMetadata();
    }, [selectedProvider, selectedEvent]);

    const updateScheduledConfig = (updates) => {
        const next = { ...triggerConfig, ...updates };
        setTriggerConfig(next);
        if (data.onChange) data.onChange('trigger_config', next);

        // Also update cron expression if frequency/time changed
        const f = updates.frequency || schFreq;
        const t = updates.time || schTime;
        const [hour, minute] = t.split(':');
        let cron = '';
        if (f === 'hourly') cron = `0 * * * *`;
        else if (f === 'daily') cron = `${parseInt(minute)} ${parseInt(hour)} * * *`;
        else if (f === 'weekly') cron = `${parseInt(minute)} ${parseInt(hour)} * * 1`;
        
        if (cron) {
            setCronExpression(cron);
            if (data.onChange) data.onChange('cron_expression', cron);
        }
    };

    const handleTriggerTypeChange = (newType) => {
        setLocalTriggerType(newType);
        if (data.onChange) data.onChange('trigger_type', newType);
    };

    const handleFieldChange = (field, value) => {
        if (data.onChange) data.onChange(field, value);
    };

    const handleProviderChange = (provider) => {
        setSelectedProvider(provider);
        setSelectedEvent('');
        setSelectedConnectionId('');
        handleFieldChange('provider', provider);
        handleFieldChange('event_name', '');
        handleFieldChange('connection_id', '');
    };

    const handleEventChange = (event) => {
        setSelectedEvent(event);
        handleFieldChange('event_name', event);
    };

    const handleConnectionChange = (connId) => {
        setSelectedConnectionId(connId);
        handleFieldChange('connection_id', connId);
        // Mark as governance + schema linked (mandatory for all flows)
        handleFieldChange('governance_linked', true);
        handleFieldChange('schema_linked', true);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Resolve favicon
    const providerInfo = selectedProvider ? OAUTH_PROVIDERS[selectedProvider.toLowerCase()] : null;
    const faviconDomain = providerInfo?.domain || null;
    const availableEvents = providerInfo?.events || [];

    // Find connections filtered by selected provider
    const connectedProviderConnections = oauthConnections.filter(conn => {
        const p = (conn.provider || '').toLowerCase();
        const sel = (selectedProvider || '').toLowerCase();
        if (!sel) return true;
        
        // Flexible matching for Google: 'google' or 'google_workspace' or 'workspace'
        if ((sel.includes('google') || sel.includes('workspace')) && 
            (p.includes('google') || p.includes('workspace'))) return true;
            
        return p === sel;
    });

    // Status of the app trigger
    const isAppFullyConfigured = triggerType === 'app'
        ? !!selectedProvider && !!selectedEvent && !!selectedConnectionId
        : true;

    const getBorderClass = () => {
        if (triggerType === 'app') {
            return isAppFullyConfigured
                ? 'border-emerald-500 hover:border-emerald-600'
                : 'border-amber-400 hover:border-amber-500';
        }
        return theme.border;
    };

    // Display logo or icon
    const renderIcon = () => {
        if ((triggerType === 'app' || triggerType === 'scheduled') && faviconDomain) {
            return (
                <div className="w-16 h-16 bg-white shadow-md border border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                    <img
                        src={selectedProvider?.toLowerCase() === 'trello' ? '/icon-trello.png' :
                             ['shopify', 'github', 'slack', 'google_workspace'].includes(selectedProvider?.toLowerCase()) 
                                ? `/logos/${selectedProvider.toLowerCase() === 'google_workspace' ? 'google' : selectedProvider.toLowerCase()}.svg` 
                                : `https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=128`}
                        alt={selectedProvider}
                        className="w-10 h-10 object-contain"
                    />
                </div>
            );
        }
        return (
            <div className={`p-3 rounded-2xl transition-all group-hover:scale-110 duration-300 flex items-center justify-center w-16 h-16 ${theme.icon}`}>
                <TypeIcon className="w-8 h-8" />
            </div>
        );
    };

    return (
        <div className={`bg-white border-2 rounded-2xl shadow-sm hover:shadow-xl transition-all group min-w-[280px] max-w-[320px] ${getBorderClass()}`}>
            {/* Header */}
            <div className={`p-4 flex flex-col items-center gap-3 border-b border-slate-100 rounded-t-2xl ${theme.bg}`}>
                {renderIcon()}
                <div className="text-center px-2">
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${theme.label}`}>
                        Déclencheur Verytis
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        {(triggerType === 'app' || triggerType === 'scheduled') && selectedProvider
                            ? `${OAUTH_PROVIDERS[selectedProvider.toLowerCase()]?.label || selectedProvider} Routine`
                            : label}
                    </div>
                </div>
            </div>

            {/* Trigger Type Selector */}
            <div className="px-4 py-3 border-b border-slate-50">
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-tighter mb-2 px-0.5">Type de déclencheur</div>
                <div className="flex gap-1">
                    {TRIGGER_TYPES.map(t => {
                        const TIcon = t.icon;
                        const isActive = triggerType === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => handleTriggerTypeChange(t.id)}
                                className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-[8px] font-bold uppercase tracking-tight transition-all ${isActive
                                    ? t.activeClass
                                    : 'bg-slate-50 text-slate-400 border border-transparent hover:bg-slate-100'
                                    }`}
                            >
                                <TIcon className="w-3.5 h-3.5" />
                                {t.id === 'webhook' ? 'Webhook' : t.id === 'scheduled' ? 'Planifié' : 'App'}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Dynamic Content Zone */}
            <div className="px-4 py-3 space-y-3">
                {/* ─── Shared Provider/Connection Selection (App & Scheduled) ─── */}
                {(triggerType === 'app' || triggerType === 'scheduled') && (
                    <div className="space-y-3 pb-3 border-b border-slate-50">
                        {/* Provider Selector */}
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter block mb-1 px-0.5">
                                Application Source
                            </label>
                            <select
                                value={selectedProvider}
                                onChange={e => handleProviderChange(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 nodrag"
                            >
                                <option value="">-- Choisir une app --</option>
                                {Object.entries(OAUTH_PROVIDERS).map(([key, val]) => (
                                    <option key={key} value={key} selected={selectedProvider === 'google' && key === 'google_workspace'}>
                                        {val.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* OAuth Connection Selector */}
                        {selectedProvider && (
                            <div>
                                <div className="flex items-center justify-between mb-1 px-0.5">
                                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">
                                        Compte à utiliser
                                    </label>
                                    <a
                                        href="/settings?tab=integrations"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[8px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-0.5 transition-colors"
                                    >
                                        Gérer <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                </div>

                                {isLoadingConnections ? (
                                    <div className="flex items-center gap-2 text-slate-400 text-[10px] py-2">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        Chargement des connexions...
                                    </div>
                                ) : connectedProviderConnections.length === 0 ? (
                                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span className="text-[10px] font-bold text-amber-700">
                                                Aucune connexion {OAUTH_PROVIDERS[selectedProvider]?.label} trouvée
                                            </span>
                                        </div>
                                        <p className="text-[9px] text-amber-600 leading-tight">
                                            Connectez votre compte dans <strong>Paramètres → Intégrations</strong>.
                                        </p>
                                    </div>
                                ) : (
                                    <select
                                        value={selectedConnectionId}
                                        onChange={e => handleConnectionChange(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 nodrag"
                                    >
                                        <option value="">-- Choisir une connexion --</option>
                                        {connectedProviderConnections.map(conn => (
                                            <option key={conn.id} value={conn.id}>
                                                {conn.account_label || conn.account_name || conn.metadata?.store_url || conn.metadata?.email}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── App OAuth Mode Specifics ─── */}
                {triggerType === 'app' && (
                    <div className="space-y-3">
                        {/* Event Selector */}
                        {selectedProvider && (
                            <div>
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter block mb-1 px-0.5">
                                    Événement déclencheur
                                </label>
                                <select
                                    value={selectedEvent}
                                    onChange={e => handleEventChange(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 nodrag"
                                >
                                    <option value="">-- Choisir un événement --</option>
                                    {availableEvents.map(evt => {
                                        const val = typeof evt === 'string' ? evt : evt.value;
                                        const label = typeof evt === 'string' ? evt.replace(/_/g, ' ') : evt.label;
                                        return (
                                            <option key={val} value={val}>{label}</option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}

                        {/* Google Specific Config Fields */}
                        {selectedProvider === 'google_workspace' && selectedConnectionId && (
                            <div className="space-y-3 p-3 bg-violet-50/50 border border-violet-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                                {selectedEvent === 'gmail_new_message' && (
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-violet-700 tracking-tighter block mb-1">
                                            Filtre de recherche (optionnel)
                                        </label>
                                        <input
                                            type="text"
                                            value={triggerConfig.filter_query || ''}
                                            onChange={e => {
                                                const next = { ...triggerConfig, filter_query: e.target.value };
                                                setTriggerConfig(next);
                                                handleFieldChange('trigger_config', next);
                                            }}
                                            placeholder="ex: subject:Urgent ou from:vip@..."
                                            className="w-full px-2.5 py-1.5 bg-white border border-violet-200 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-slate-400 nodrag"
                                        />
                                    </div>
                                )}

                                {selectedEvent === 'drive_new_file' && (
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-violet-700 tracking-tighter block mb-1">
                                            Dossier Drive à surveiller
                                        </label>
                                        <select
                                            value={triggerConfig.folder_id || ''}
                                            onChange={e => {
                                                const next = { ...triggerConfig, folder_id: e.target.value };
                                                setTriggerConfig(next);
                                                handleFieldChange('trigger_config', next);
                                            }}
                                            className="w-full px-2.5 py-1.5 bg-white border border-violet-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-violet-400 nodrag"
                                        >
                                            <option value="">-- Choisir un dossier --</option>
                                            {metadata.drive_folders.map(f => (
                                                <option key={f.value} value={f.value}>{f.label}</option>
                                            ))}
                                        </select>
                                        {isLoadingMetadata && <p className="text-[8px] text-violet-400 mt-1 animate-pulse italic">Chargement des dossiers...</p>}
                                    </div>
                                )}

                                {selectedEvent === 'calendar_new_event' && (
                                    <div>
                                        <label className="text-[9px] font-black uppercase text-violet-700 tracking-tighter block mb-1">
                                            Agenda à surveiller
                                        </label>
                                        <select
                                            value={triggerConfig.calendar_id || ''}
                                            onChange={e => {
                                                const next = { ...triggerConfig, calendar_id: e.target.value };
                                                setTriggerConfig(next);
                                                handleFieldChange('trigger_config', next);
                                            }}
                                            className="w-full px-2.5 py-1.5 bg-white border border-violet-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:ring-1 focus:ring-violet-400 nodrag"
                                        >
                                            <option value="">-- Choisir un agenda --</option>
                                            {metadata.calendars.map(c => (
                                                <option key={c.value} value={c.value}>{c.label}</option>
                                            ))}
                                        </select>
                                        {isLoadingMetadata && <p className="text-[8px] text-violet-400 mt-1 animate-pulse italic">Chargement des agendas...</p>}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Status indicator */}
                        <div className="flex flex-col gap-2 pt-1">
                            <div className="flex items-center gap-2">
                                {isAppFullyConfigured ? (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <span className="text-[10px] font-bold text-emerald-600">✅ Trigger configuré</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                                        <span className="text-[10px] font-bold text-amber-600">⚠️ Configuration incomplète</span>
                                    </>
                                )}
                            </div>

                            {/* Webhook indicator for Google Workspace (managed by Verytis) */}
                            {selectedProvider === 'google_workspace' && (
                                <div className="p-2.5 bg-violet-50/50 border border-violet-100 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Webhook className="w-3.5 h-3.5 text-violet-500" />
                                        <span className="text-[9px] font-black text-violet-700 uppercase tracking-tighter">Webhook Workspace Actif</span>
                                    </div>
                                    <div className="relative group/copy">
                                        <input
                                            type="text"
                                            readOnly
                                            value={webhookUrl}
                                            className="w-full bg-white/50 border border-violet-100 rounded-lg py-1 pl-2 pr-8 text-[8px] font-mono text-violet-400 outline-none"
                                        />
                                        <button
                                            onClick={handleCopy}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-violet-300 hover:text-violet-600"
                                        >
                                            {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                        </button>
                                    </div>
                                    <p className="text-[8px] text-violet-400 italic leading-tight">
                                        Verytis s'occupe de l'enregistrement du webhook auprès de Google.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Mandatory governance indicator */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                            <Shield className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tight">
                                Flux protégé par Verytis Governance
                            </span>
                        </div>
                    </div>
                )}

                {/* ─── Webhook Mode ─── */}
                {triggerType === 'webhook' && (
                    <>
                        <div className="flex items-center gap-2">
                            <Radio className={`w-3.5 h-3.5 ${theme.dot} animate-pulse`} />
                            <span className="text-[10px] font-bold text-slate-500 tracking-tight">Listening for POST...</span>
                        </div>
                        <div className="space-y-1.5">
                            <div className="text-[9px] font-black uppercase text-slate-400 tracking-tighter px-0.5">Webhook URL (Verytis)</div>
                            <div className="relative group/copy">
                                <input
                                    type="text"
                                    readOnly
                                    value={webhookUrl}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-1.5 pl-3 pr-10 text-[9px] font-mono text-slate-500 outline-none"
                                />
                                <button
                                    onClick={handleCopy}
                                    className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all active:scale-90 ${copied ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-100 text-slate-400 hover:text-emerald-600 shadow-sm'}`}
                                >
                                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                </button>
                            </div>
                        </div>

                        {/* Zero-Trust Security Accordion */}
                        <button
                            onClick={() => setShowSecurity(!showSecurity)}
                            className="w-full flex items-center justify-between px-2.5 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-bold text-slate-600 hover:bg-slate-100 transition-all"
                        >
                            <span className="flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-amber-500" />
                                Sécurité Avancée (Zero-Trust)
                            </span>
                            {showSecurity ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {showSecurity && (
                            <div className="space-y-2 p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                <div>
                                    <label className="text-[8px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                                        <Lock className="w-2.5 h-2.5 inline mr-1" />
                                        Restreindre aux IPs (votre ERP, serveur...)
                                    </label>
                                    <input
                                        type="text"
                                        value={ipWhitelist}
                                        onChange={e => { setIpWhitelist(e.target.value); handleFieldChange('security', { ...security, ip_whitelist: e.target.value, requires_ip_whitelist: !!e.target.value.trim() }); }}
                                        placeholder="192.168.1.0/24, 10.0.0.1"
                                        className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-[10px] font-mono outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-slate-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-[8px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                                        Header Secret exigé (optionnel)
                                    </label>
                                    <input
                                        type="password"
                                        value={headerSecret}
                                        onChange={e => { setHeaderSecret(e.target.value); handleFieldChange('security', { ...security, header_secret: e.target.value || null }); }}
                                        placeholder="X-Verytis-Secret: sk_live_..."
                                        className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-[10px] font-mono outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ─── Scheduled Mode ─── */}
                {triggerType === 'scheduled' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Clock className={`w-3.5 h-3.5 ${theme.dot} animate-pulse`} />
                            <span className="text-[10px] font-bold text-slate-500 tracking-tight">Exécution planifiée</span>
                        </div>

                        {/* Scheduling Grid */}
                        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400">Fréquence</label>
                                <select
                                    value={schFreq}
                                    onChange={e => {
                                        setSchFreq(e.target.value);
                                        updateScheduledConfig({ frequency: e.target.value });
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-violet-400 nodrag"
                                >
                                    <option value="hourly">Horaire</option>
                                    <option value="daily">Quotidien</option>
                                    <option value="weekly">Hebdo (Lundi)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400">Heure (GMT)</label>
                                <input
                                    type="time"
                                    value={schTime}
                                    disabled={schFreq === 'hourly'}
                                    onChange={e => {
                                        setSchTime(e.target.value);
                                        updateScheduledConfig({ time: e.target.value });
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-violet-400 nodrag disabled:opacity-50"
                                />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-[8px] font-black uppercase text-slate-400">Fuseau Horaire</label>
                                <select
                                    value={schTz}
                                    onChange={e => {
                                        setSchTz(e.target.value);
                                        updateScheduledConfig({ timezone: e.target.value });
                                    }}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-violet-400 nodrag"
                                >
                                    <option value={schTz}>{schTz}</option>
                                    <option value="UTC">UTC</option>
                                    <option value="Europe/Paris">Europe/Paris</option>
                                    <option value="America/New_York">America/New_York</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[9px] font-bold text-emerald-600">✅ Automatisé via le système Verytis</span>
                        </div>

                        {/* Mandatory governance indicator for scheduled too */}
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                            <Shield className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tight">
                                Flux protégé par Verytis Governance
                            </span>
                        </div>
                    </div>
                )}

                {/* Description */}
                {data.description && (
                    <div className="text-[9px] text-slate-400 font-medium leading-tight pt-1">
                        {data.description}
                    </div>
                )}
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className={`w-3 h-3 ${theme.handle} border-2 border-white rounded-full transition-colors`}
            />
        </div>
    );
};

export default memo(TriggerNode);
