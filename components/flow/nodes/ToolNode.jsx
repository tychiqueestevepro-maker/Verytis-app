import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Box, Check, AlertCircle, Key, Save, Loader2, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const ToolNode = ({ data, isConnectable }) => {
    const { showToast } = useToast();
    const [showInput, setShowInput] = useState(false);
    const [isSynced, setIsSynced] = useState(false);
    const [tempKey, setTempKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const label = data.label || 'Action / Integration';
    const description = data.description || '';
    const authRecord = data.auth_requirement || {
        type: 'api_key',
        label: 'Clé API / Token',
        placeholder: 'Collez Token / Clé API...'
    };

    // Dynamic Branding Logic
    const toolMapping = {
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
    const isGlobalConnected = data.connectedProviders?.some(p => p.domain === domain && p.status === 'Connected');
    const isConnected = isGlobalConnected || isSynced;

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

    return (
        <div className={`bg-white border-2 rounded-2xl shadow-sm hover:shadow-xl transition-all group overflow-hidden min-w-[240px] ${!isConnected && domain ? 'border-red-500 bg-red-50/30' : isConnected ? 'border-emerald-500 bg-emerald-50/10' : 'border-slate-200 hover:border-blue-400'}`}>
            {/* Header */}
            <div className={`p-4 flex flex-col items-center gap-3 border-b border-slate-100 ${!isConnected && domain ? 'bg-red-50' : isConnected ? 'bg-emerald-50/20' : 'bg-blue-50/20'}`}>
                <div className={`p-3 rounded-2xl transition-all group-hover:scale-110 duration-300 flex items-center justify-center ${domain ? 'bg-white shadow-md border border-slate-100 w-16 h-16 overflow-hidden' : 'bg-blue-100 text-blue-600'}`}>
                    {domain ? (
                        <img
                            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                            alt={label}
                            className={`w-10 h-10 object-contain ${!isConnected ? 'grayscale-[0.5]' : ''}`}
                        />
                    ) : (
                        <Box className="w-8 h-8 fill-blue-600" />
                    )}
                    {isConnected && (
                        <div className="absolute top-0 right-0 bg-emerald-500 text-white p-1 rounded-bl-lg shadow-sm">
                            <Check className="w-3 h-3" />
                        </div>
                    )}
                </div>
                <div className="text-center">
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${!isConnected && domain ? 'text-red-600/50' : isConnected ? 'text-emerald-600/50' : 'text-blue-600/50'}`}>
                        {isConnected ? 'Connecté (Vault)' : !domain ? 'Tool Node' : 'En attente de clé'}
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1 px-4 tracking-tight">
                        {label}
                    </div>
                </div>
            </div>

            {/* Content / Interaction */}
            <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                        <span className={`text-[10px] font-bold tracking-tight ${isConnected ? 'text-emerald-600' : 'text-slate-500'}`}>
                            {isConnected ? 'Opérationnel' : 'Non configuré'}
                        </span>
                    </div>
                    {isConnected && (
                        <button
                            onClick={() => setShowInput(!showInput)}
                            className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            {showInput ? 'Annuler' : 'Modifier'}
                        </button>
                    )}
                </div>

                {/* Interaction Zone */}
                {(!isConnected || showInput) && domain && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">{authRecord.label}</span>
                        </div>
                        <div className="relative group/input">
                            <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            {authRecord.type === 'connection_string' ? (
                                <textarea
                                    placeholder={authRecord.placeholder}
                                    value={tempKey}
                                    onChange={(e) => setTempKey(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-8 pr-8 text-[10px] font-mono outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-300 resize-none h-16"
                                />
                            ) : (
                                <input
                                    type="password"
                                    placeholder={authRecord.placeholder}
                                    value={tempKey}
                                    onChange={(e) => setTempKey(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl py-1.5 pl-8 pr-8 text-[10px] font-mono outline-none focus:border-blue-500 transition-all shadow-inner placeholder:text-slate-300"
                                />
                            )}
                            {tempKey.trim() && (
                                <button
                                    onClick={handleSyncKey}
                                    disabled={isSaving}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all active:scale-95 shadow-md"
                                >
                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                </button>
                            )}
                        </div>
                    </div>
                )}


            </div>

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-blue-600 border-2 border-white rounded-full"
            />

            {/* Output Handle for Sequential Tools */}
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-blue-400 border-2 border-white rounded-full transition-colors hover:bg-blue-600"
            />
        </div>
    );
};

export default memo(ToolNode);
