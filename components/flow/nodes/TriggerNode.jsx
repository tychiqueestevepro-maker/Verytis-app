import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Zap, Radio, Copy, Check, Clock, Globe, ChevronDown, ChevronUp, Shield, Lock, Webhook } from 'lucide-react';

const TRIGGER_TYPES = [
    {
        id: 'webhook', label: 'Webhook Inbound', icon: Webhook, color: 'emerald',
        activeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm'
    },
    {
        id: 'schedule', label: 'Planifié (Cron)', icon: Clock, color: 'blue',
        activeClass: 'bg-blue-100 text-blue-700 border border-blue-300 shadow-sm'
    },
    {
        id: 'app_event', label: 'App Event', icon: Globe, color: 'violet',
        activeClass: 'bg-violet-100 text-violet-700 border border-violet-300 shadow-sm'
    },
];

const APP_EVENT_SOURCES = [
    { id: 'github.push', label: 'GitHub — Push (Code)' },
    { id: 'github.pr', label: 'GitHub — Pull Request' },
    { id: 'github.issue', label: 'GitHub — Issue' },
    { id: 'stripe.payment', label: 'Stripe — Paiement Réussi' },
    { id: 'stripe.subscription', label: 'Stripe — Nouvel Abonnement' },
    { id: 'typeform.submit', label: 'Typeform — Formulaire Soumis' },
    { id: 'custom', label: 'Autre événement personnalisé...' },
];

const TriggerNode = ({ data, isConnectable }) => {
    const label = data.label || 'Verytis Webhook Inbound';
    const description = data.description || '';
    const agentId = data.agentId || 'bcb58aa1-31d7-4aa2-a735-c1886662a723';
    const webhookUrl = `https://api.verytis-ops.com/api/run/${agentId}`;

    const [copied, setCopied] = useState(false);
    const [showSecurity, setShowSecurity] = useState(false);

    // Local state for trigger type (instant UI switch, synced via onChange)
    const [localTriggerType, setLocalTriggerType] = useState(data.trigger_type || 'webhook');
    const triggerType = localTriggerType;
    const security = data.security || { requires_ip_whitelist: false, header_secret: null };

    const [cronExpression, setCronExpression] = useState(data.cron_expression || '0 8 * * *');
    const [eventSource, setEventSource] = useState(data.event_source || 'slack.message');
    const [ipWhitelist, setIpWhitelist] = useState(security.ip_whitelist || '');
    const [headerSecret, setHeaderSecret] = useState(security.header_secret || '');

    // Dropdown state for App Event
    const [isEventDropdownOpen, setIsEventDropdownOpen] = useState(false);

    // Trigger type config
    const currentType = TRIGGER_TYPES.find(t => t.id === triggerType) || TRIGGER_TYPES[0];
    const TypeIcon = currentType.icon;

    // App event branding
    const appEventDomains = {
        'github': 'github.com',
        'stripe': 'stripe.com',
        'typeform': 'typeform.com',
    };

    const getAppEventDomain = () => {
        const src = eventSource || '';
        const prefix = src.split('.')[0];
        return appEventDomains[prefix] || null;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTriggerTypeChange = (newType) => {
        setLocalTriggerType(newType);
        if (data.onChange) data.onChange('trigger_type', newType);
    };

    const handleFieldChange = (field, value) => {
        if (data.onChange) data.onChange(field, value);
    };

    // Color theming per trigger type
    const colorMap = {
        emerald: {
            border: 'border-emerald-400 hover:border-emerald-500',
            bg: 'bg-emerald-50/30',
            icon: 'bg-emerald-100 text-emerald-600',
            label: 'text-emerald-600/50',
            handle: 'bg-emerald-600',
            dot: 'text-emerald-500',
        },
        blue: {
            border: 'border-blue-400 hover:border-blue-500',
            bg: 'bg-blue-50/30',
            icon: 'bg-blue-100 text-blue-600',
            label: 'text-blue-600/50',
            handle: 'bg-blue-600',
            dot: 'text-blue-500',
        },
        violet: {
            border: 'border-violet-400 hover:border-violet-500',
            bg: 'bg-violet-50/30',
            icon: 'bg-violet-100 text-violet-600',
            label: 'text-violet-600/50',
            handle: 'bg-violet-600',
            dot: 'text-violet-500',
        },
    };

    const theme = colorMap[currentType.color] || colorMap.emerald;
    const appDomain = triggerType === 'app_event' ? getAppEventDomain() : null;

    return (
        <div className={`bg-white border-2 rounded-2xl shadow-sm hover:shadow-xl transition-all group overflow-hidden min-w-[260px] ${theme.border}`}>
            {/* Header */}
            <div className={`p-4 flex flex-col items-center gap-3 border-b border-slate-100 ${theme.bg}`}>
                <div className={`p-3 rounded-2xl transition-all group-hover:scale-110 duration-300 flex items-center justify-center w-16 h-16 ${appDomain
                    ? 'bg-white shadow-md border border-slate-100 overflow-hidden'
                    : theme.icon
                    }`}>
                    {appDomain ? (
                        <img
                            src={`https://www.google.com/s2/favicons?domain=${appDomain}&sz=128`}
                            alt={label}
                            className="w-10 h-10 object-contain"
                        />
                    ) : (
                        <TypeIcon className="w-8 h-8" />
                    )}
                </div>
                <div className="text-center px-2">
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${theme.label}`}>
                        Déclencheur Verytis
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                        {label}
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
                                {t.id === 'webhook' ? 'Webhook' : t.id === 'schedule' ? 'Planifié' : 'App'}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Dynamic Content Zone */}
            <div className="px-4 py-3 space-y-3">
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

                {/* ─── Schedule Mode ─── */}
                {triggerType === 'schedule' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Clock className={`w-3.5 h-3.5 ${theme.dot}`} />
                            <span className="text-[10px] font-bold text-slate-500 tracking-tight">Exécution planifiée</span>
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter block mb-1 px-0.5">Expression Cron</label>
                            <input
                                type="text"
                                value={cronExpression}
                                onChange={e => { setCronExpression(e.target.value); handleFieldChange('cron_expression', e.target.value); }}
                                placeholder="0 8 * * *"
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-mono text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                            />
                            <p className="text-[8px] text-slate-400 mt-1 font-mono px-0.5">ex: "0 8 * * *" = tous les jours à 8h</p>
                        </div>
                    </div>
                )}

                {/* ─── App Event Mode ─── */}
                {triggerType === 'app_event' && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Globe className={`w-3.5 h-3.5 ${theme.dot}`} />
                            <span className="text-[10px] font-bold text-slate-500 tracking-tight">Événement applicatif</span>
                        </div>
                        <div className="relative nodrag">
                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-tighter block mb-1 px-0.5">Source de l'événement</label>

                            {/* Custom Dropdown Toggle */}
                            <div
                                onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 flex justify-between items-center cursor-pointer hover:border-violet-300 transition-colors"
                            >
                                <span>{APP_EVENT_SOURCES.find(s => s.id === eventSource)?.label || 'Sélectionner...'}</span>
                                {isEventDropdownOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                            </div>

                            {/* Custom Dropdown Menu */}
                            {isEventDropdownOpen && (
                                <div className="absolute top-full left-0 right-[-20px] mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] z-[9999] py-1 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                                    {APP_EVENT_SOURCES.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => {
                                                setEventSource(s.id);
                                                handleFieldChange('event_source', s.id);
                                                setIsEventDropdownOpen(false);
                                            }}
                                            className={`px-3 py-2 text-[10px] shadow-sm cursor-pointer transition-colors ${eventSource === s.id ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}
                                        >
                                            {s.label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Description */}
                {description && (
                    <div className="text-[9px] text-slate-400 font-medium leading-tight pt-1">
                        {description}
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
