import React, { memo, useState, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Key, Settings2, AlertCircle, Save, CheckCircle2, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const LLMNodeV3 = ({ data, isConnectable }) => {
    const { showToast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [tempKey, setTempKey] = useState('');
    const [isSynced, setIsSynced] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState(data.provider || null);

    const providerConfig = {
        openai: {
            name: 'OpenAI',
            domain: 'openai.com',
            baseColor: 'emerald',
            text: 'text-emerald-600',
            bg: 'bg-emerald-100',
            border: 'border-emerald-200',
            accent: 'bg-emerald-600',
            hover: 'hover:bg-emerald-700',
            light: 'bg-emerald-50/30',
            shadowRgb: '16, 185, 129',
            defaultModel: 'gpt-4o'
        },
        anthropic: {
            name: 'Anthropic',
            domain: 'anthropic.com',
            baseColor: 'orange',
            text: 'text-orange-600',
            bg: 'bg-orange-100',
            border: 'border-orange-200',
            accent: 'bg-orange-600',
            hover: 'hover:bg-orange-700',
            light: 'bg-orange-50/30',
            shadowRgb: '249, 115, 22',
            defaultModel: 'claude-3-5-sonnet-latest'
        },
        google: {
            name: 'Google',
            domain: 'google.com',
            baseColor: 'blue',
            text: 'text-blue-600',
            bg: 'bg-blue-100',
            border: 'border-blue-200',
            accent: 'bg-blue-600',
            hover: 'hover:bg-blue-700',
            light: 'bg-blue-50/30',
            shadowRgb: '59, 130, 246',
            defaultModel: 'gemini-1.5-pro'
        },
        custom: {
            name: 'Custom LLM',
            domain: 'api.openai.com',
            baseColor: 'purple',
            text: 'text-purple-600',
            bg: 'bg-purple-100',
            border: 'border-purple-200',
            accent: 'bg-purple-600',
            hover: 'hover:bg-purple-700',
            light: 'bg-purple-50/30',
            shadowRgb: '147, 51, 234',
            defaultModel: 'custom-model'
        }
    };

    // Sync state when data prop changes (from sidebar or other sources)
    useEffect(() => {
        if (data.provider) setSelectedProvider(data.provider);
    }, [data.provider]);

    const config = providerConfig[selectedProvider] || null;
    const model = data.model || (config ? config.defaultModel : null);
    const label = data.label || (config ? config.name + ' Agent' : 'Agent IA');

    const isGloballyConnected = selectedProvider && data.connectedProviders?.some(p => p.id === selectedProvider && p.status === 'Connected');
    const hasApiKey = (!!data.apiKey || isSynced || isGloballyConnected) && !!selectedProvider;

    const handleSyncKey = async () => {
        if (!tempKey.trim() || !selectedProvider) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/settings/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider: selectedProvider, apiKey: tempKey })
            });

            if (res.ok) {
                setIsSynced(true);
                showToast({
                    title: 'Clé Synchronisée',
                    message: `La clé ${config.name} est maintenant active pour tout le Workspace.`,
                    type: 'success'
                });
                if (data.onChange) {
                    data.onChange('apiKey', tempKey);
                    data.onChange('provider', selectedProvider);
                }
            } else {
                showToast({ title: 'Erreur Sync', message: 'Impossible de sauvegarder la clé.', type: 'error' });
            }
        } catch (error) {
            console.error(error);
            showToast({ title: 'Erreur', message: 'Erreur réseau.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleProviderChange = (e) => {
        const newProvider = e.target.value;
        setSelectedProvider(newProvider || null);
        setIsSynced(false);
        if (data.onChange) {
            data.onChange('provider', newProvider || null);
            if (newProvider && providerConfig[newProvider]) {
                data.onChange('model', providerConfig[newProvider].defaultModel);
            }
        }
    };

    const getContainerClass = () => {
        if (!selectedProvider) return 'border-dashed border-slate-300';
        if (!hasApiKey) return 'border-red-500 bg-red-50/30';
        return `border-${config.baseColor}-200 shadow-sm hover:border-${config.baseColor}-400`;
    };

    const getHeaderClass = () => {
        if (!selectedProvider) return 'bg-slate-50/50';
        if (!hasApiKey) return 'bg-red-50';
        return config.light;
    };

    const getLogoContainerClass = () => {
        if (!selectedProvider) return 'bg-white border-dashed border-2 border-slate-200';
        if (!hasApiKey) return 'bg-white shadow-sm border-2 border-red-200';
        return `bg-${config.baseColor}-50 shadow-md border border-${config.baseColor}-100`;
    };

    return (
        <div className={`bg-white border-2 rounded-2xl transition-all group overflow-hidden min-w-[240px] ${getContainerClass()}`}>
            {/* Logo Zone */}
            <div className={`p-4 flex flex-col items-center gap-3 border-b border-slate-100/50 ${getHeaderClass()}`}>
                <div className={`w-16 h-16 rounded-2xl transition-all group-hover:scale-110 duration-500 flex items-center justify-center overflow-hidden relative ${getLogoContainerClass()}`}>
                    {selectedProvider ? (
                        <img
                            src={selectedProvider === 'custom' ? 'https://www.google.com/s2/favicons?domain=openai.com&sz=128' : `https://www.google.com/s2/favicons?domain=${config.domain}&sz=128`}
                            alt={config.name}
                            className={`w-10 h-10 object-contain ${!hasApiKey ? 'grayscale-[0.5]' : ''}`}
                        />
                    ) : (
                        <HelpCircle className="w-8 h-8 text-slate-300 animate-pulse" />
                    )}
                </div>
                <div className="text-center w-full">
                    <div className="relative inline-block mb-1">
                        <select
                            value={selectedProvider || ''}
                            onChange={handleProviderChange}
                            className={`text-[9px] font-black uppercase tracking-widest bg-transparent border-none appearance-none outline-none cursor-pointer text-center underline decoration-dotted underline-offset-2 transition-colors ${!selectedProvider ? 'text-slate-400' : !hasApiKey ? 'text-red-500' : config.text} hover:text-blue-600`}
                        >
                            <option value="">Sélectionner Moteur</option>
                            <option value="openai">OpenAI (Green Core)</option>
                            <option value="anthropic">Anthropic (Orange Core)</option>
                            <option value="google">Google (Blue Core)</option>
                            <option value="custom">-- Custom LLM --</option>
                        </select>
                    </div>
                    <div className={`text-[13px] font-black line-clamp-1 px-4 tracking-tight ${!selectedProvider ? 'text-slate-400 italic' : !hasApiKey ? 'text-red-900' : 'text-slate-900'}`}>
                        {label}
                    </div>
                </div>
            </div>

            {/* Content Zone: Authentification strictly on visual node */}
            <div className="px-5 py-4 space-y-4">
                {selectedProvider === 'custom' && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-1">
                        <label className="text-[9px] font-black uppercase text-slate-400">Endpoint URL</label>
                        <input
                            type="text"
                            placeholder="https://votre-api.com/v1"
                            value={data.apiUrl || ''}
                            onChange={(e) => data.onChange?.('apiUrl', e.target.value)}
                            className={`w-full bg-slate-50 border border-${config.baseColor}-200 rounded-xl py-2 px-3 text-[10px] font-mono outline-none focus:border-${config.baseColor}-500`}
                        />
                    </div>
                )}

                {!selectedProvider ? (
                    <div className="py-2 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-tight">
                            Choisissez un moteur pour commencer la configuration.
                        </p>
                    </div>
                ) : !hasApiKey ? (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="relative group/input">
                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-400" />
                            <input
                                type="password"
                                placeholder={`Coller Clé ${config.name}...`}
                                value={tempKey}
                                onChange={(e) => setTempKey(e.target.value)}
                                className="w-full bg-white border border-red-200 rounded-xl py-2 pl-9 pr-10 text-xs font-mono outline-none focus:border-red-500 transition-all shadow-inner placeholder:text-red-300"
                            />
                            {tempKey.trim() && (
                                <button
                                    onClick={handleSyncKey}
                                    disabled={isSaving}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md active:scale-95"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between text-[11px] font-black text-slate-600 uppercase tracking-tight">
                            <div className="flex items-center gap-2">
                                <Sparkles className={`w-3.5 h-3.5 ${config.color}`} />
                                <span>Moteur Prêt</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full bg-${config.baseColor}-500 shadow-[0_0_8px_rgba(${config.shadowRgb},0.5)]`}></div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium leading-tight">
                            La configuration détaillée s'affiche dans le panneau latéral.
                        </p>
                    </div>
                )}
            </div>

            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className={`w-4 h-4 bg-slate-200 border-4 border-white rounded-full transition-all hover:bg-${selectedProvider ? config.baseColor : 'blue'}-500 z-10 -top-2`}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className={`w-4 h-4 bg-${selectedProvider ? config.baseColor : 'blue'}-600 border-4 border-white rounded-full transition-all hover:bg-${selectedProvider ? config.baseColor : 'blue'}-700 z-10 -bottom-2`}
            />
        </div>
    );
};

export default memo(LLMNodeV3);
