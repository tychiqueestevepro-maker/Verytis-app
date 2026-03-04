import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Bot, Plus, AlertCircle, Key, Save, Loader2, Sparkles, Settings2, HelpCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

const PlaceholderNode = ({ data, isConnectable }) => {
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
            ring: 'focus:ring-emerald-100',
            inputBorder: 'border-emerald-200',
            inputFocus: 'focus:border-emerald-500',
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
            ring: 'focus:ring-orange-100',
            inputBorder: 'border-orange-200',
            inputFocus: 'focus:border-orange-500',
            shadowRgb: '249, 115, 22',
            defaultModel: 'claude-3-5-sonnet-latest'
        },
        google: {
            name: 'Google Gemini',
            domain: 'google.com',
            baseColor: 'blue',
            text: 'text-blue-600',
            bg: 'bg-blue-100',
            border: 'border-blue-200',
            accent: 'bg-blue-600',
            hover: 'hover:bg-blue-700',
            ring: 'focus:ring-blue-100',
            inputBorder: 'border-blue-200',
            inputFocus: 'focus:border-blue-500',
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
            ring: 'focus:ring-purple-100',
            inputBorder: 'border-purple-200',
            inputFocus: 'focus:border-purple-500',
            shadowRgb: '147, 51, 234',
            defaultModel: 'custom-model'
        }
    };

    const config = providerConfig[selectedProvider] || null;
    const isConnected = selectedProvider && (data.connectedProviders?.some(p => p.id === selectedProvider && p.status === 'Connected') || isSynced);

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
                    title: 'Clé Activée',
                    message: `L'agent ${config.name} est maintenant opérationnel.`,
                    type: 'success'
                });
                if (data.onChange) {
                    data.onChange('apiKey', tempKey);
                    data.onChange('provider', selectedProvider);
                }
            } else {
                showToast({ title: 'Erreur', message: 'Impossible d\'activer la clé.', type: 'error' });
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
            // Crucial: Set a default model to ensure the sidebar filters correctly immediately
            if (newProvider && providerConfig[newProvider]) {
                data.onChange('model', providerConfig[newProvider].defaultModel);
            } else {
                data.onChange('model', null);
            }
        }
    };

    // Color dynamic classes helper
    const getContainerClass = () => {
        if (isConnected) return `border-${config.baseColor}-500 shadow-lg`;
        if (selectedProvider) return `border-${config.baseColor}-400 bg-${config.baseColor}-50/5`;
        return 'border-slate-300 border-dashed hover:border-slate-400 bg-slate-50/10';
    };

    const getLogoClass = () => {
        if (selectedProvider) return `bg-${config.baseColor}-50 border border-${config.baseColor}-200 shadow-sm`;
        return 'bg-white border-slate-200 border-dashed';
    };

    const getSelectClass = () => {
        if (selectedProvider) return `bg-white border-${config.baseColor}-200 text-slate-900 focus:ring-${config.baseColor}-100`;
        return 'bg-slate-100 border-slate-200 text-slate-500 focus:ring-slate-100';
    };

    return (
        <div className={`bg-white border-2 rounded-2xl w-[260px] transition-all duration-300 flex flex-col items-center justify-center p-5 gap-3 group relative overflow-hidden ${getContainerClass()}`}>

            {/* Header / Logo Zone */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 relative shrink-0 ${getLogoClass()}`}>
                {selectedProvider ? (
                    <img
                        src={`https://www.google.com/s2/favicons?domain=${config.domain}&sz=128`}
                        alt={config.name}
                        className={`w-10 h-10 object-contain transition-all ${!isConnected ? 'grayscale opacity-60' : ''}`}
                    />
                ) : (
                    <HelpCircle className="w-8 h-8 text-slate-300 animate-pulse" />
                )}
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-md border border-slate-100">
                    {isConnected ? <Sparkles className={`w-3.5 h-3.5 text-${config.baseColor}-500 fill-${config.baseColor}-500`} /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                </div>
            </div>

            <div className="text-center w-full space-y-3">
                <div className="space-y-1">
                    <p className={`text-[10px] font-black uppercase tracking-widest transition-colors ${selectedProvider ? config.text : 'text-slate-400'}`}>
                        {isConnected ? config.name + ' Configuré' : selectedProvider ? 'Validation Requise' : 'Selection du Cerveau'}
                    </p>
                    <div className="relative px-2">
                        <select
                            value={selectedProvider || ''}
                            onChange={handleProviderChange}
                            className={`w-full border rounded-xl py-2 px-3 text-[10px] font-bold appearance-none outline-none focus:ring-2 transition-all cursor-pointer text-center ${getSelectClass()}`}
                        >
                            <option value="">-- Choisir un moteur IA --</option>
                            <option value="openai">OpenAI (Green Core)</option>
                            <option value="anthropic">Anthropic (Orange Core)</option>
                            <option value="google">Google (Blue Core)</option>
                            <option value="custom">-- Custom LLM (URL) --</option>
                        </select>
                        <Settings2 className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {selectedProvider === 'custom' && (
                    <div className="px-2 animate-in slide-in-from-top-1">
                        <input
                            type="text"
                            placeholder="https://votre-api.com/v1"
                            value={data.apiUrl || ''}
                            onChange={(e) => data.onChange?.('apiUrl', e.target.value)}
                            className={`w-full bg-slate-50 border ${config.inputBorder} rounded-xl py-1.5 px-3 text-[9px] font-mono outline-none ${config.inputFocus} shadow-inner`}
                        />
                    </div>
                )}

                {!selectedProvider ? (
                    <div className="flex flex-col items-center gap-2 py-2 px-4 bg-slate-100/50 rounded-xl border border-slate-100/50">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-tight italic">
                            Sélectionnez un cerveau pour débloquer les options.
                        </p>
                    </div>
                ) : data.system_prompt ? (
                    <div className="flex flex-col items-center gap-2 w-full px-2">
                        {!isConnected ? (
                            <div className="relative w-full group/input mt-1">
                                <Key className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-${config.baseColor}-500`} />
                                <input
                                    type="password"
                                    placeholder={`Collez Clé ${config.name}...`}
                                    value={tempKey}
                                    onChange={(e) => setTempKey(e.target.value)}
                                    className={`w-full bg-white border ${config.inputBorder} rounded-xl py-2 pl-8 pr-10 text-[9px] font-mono outline-none ${config.inputFocus} transition-all shadow-inner placeholder:text-${config.baseColor}-300`}
                                />
                                {tempKey.trim() && (
                                    <button
                                        onClick={handleSyncKey}
                                        disabled={isSaving}
                                        className={`absolute right-1 top-1/2 -translate-y-1/2 p-1.5 ${config.accent} text-white rounded-lg ${config.hover} transition-all active:scale-95 shadow-md`}
                                    >
                                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className={`flex items-center gap-2 bg-${config.baseColor}-50 px-3 py-1 rounded-full border border-${config.baseColor}-100 transition-all animate-in zoom-in-95`}>
                                <div className={`w-1.5 h-1.5 rounded-full bg-${config.baseColor}-500 shadow-[0_0_8px_rgba(${config.shadowRgb},0.5)]`}></div>
                                <span className={`text-[9px] font-black uppercase text-${config.baseColor}-700 tracking-tight`}>Prêt à l'action</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1.5 px-4 opacity-50">
                        <div className={`w-full h-px bg-gradient-to-r from-transparent via-${config.baseColor}-200 to-transparent`}></div>
                        <p className={`text-[9px] text-${config.baseColor}-700 font-bold uppercase tracking-tighter leading-tight italic`}>
                            Configurez la personnalité dans le sidebar.
                        </p>
                    </div>
                )}
            </div>

            {/* Handles for connections */}
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className={`w-3 h-3 bg-slate-300 border-2 border-white rounded-full transition-all hover:bg-${selectedProvider ? config.baseColor : 'blue'}-500`}
            />
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className={`w-3 h-3 bg-slate-300 border-2 border-white rounded-full transition-all hover:bg-${selectedProvider ? config.baseColor : 'blue'}-500`}
            />
        </div>
    );
};

export default memo(PlaceholderNode);
