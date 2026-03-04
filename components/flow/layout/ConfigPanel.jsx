'use client';

import React, { useState, useEffect } from 'react';
import { Settings2, X, Sparkles, AlertTriangle, DollarSign, Ban, Database, Clock, Cpu, Save, CheckCircle2 } from 'lucide-react';

// ────────────────────────────────────────────────────────────────
// Reusable Tag Input (for config panel)
// ────────────────────────────────────────────────────────────────
const PanelTagInput = ({ tags = [], onChange, placeholder }) => {
    const [input, setInput] = useState('');

    const addTag = () => {
        const val = input.trim().toUpperCase();
        if (val && !tags.includes(val)) onChange([...tags, val]);
        setInput('');
    };

    return (
        <div className="flex flex-wrap gap-1.5 items-center bg-white border border-slate-200 rounded-xl px-2.5 py-2 min-h-[36px] focus-within:border-rose-300 transition-colors">
            {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-0.5 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[9px] font-mono font-bold">
                    {tag}
                    <button onClick={() => onChange(tags.filter(t => t !== tag))} className="text-rose-400 hover:text-rose-600 ml-0.5 transition-colors">×</button>
                </span>
            ))}
            <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                onBlur={addTag}
                placeholder={tags.length === 0 ? placeholder : '+ ajouter'}
                className="flex-1 min-w-[80px] bg-transparent text-[9px] text-slate-700 outline-none placeholder:text-slate-400 font-mono py-0.5"
            />
        </div>
    );
};

// ────────────────────────────────────────────────────────────────
// Numeric field helper
// ────────────────────────────────────────────────────────────────
const PanelNumField = ({ label, value, onChange, placeholder, hint, step, min, max }) => (
    <div>
        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">{label}</label>
        <input
            type="number"
            step={step}
            min={min}
            max={max}
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            placeholder={placeholder}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-rose-300 focus:border-rose-300 placeholder:text-slate-400 transition-colors"
        />
        {hint && <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{hint}</p>}
    </div>
);

// ────────────────────────────────────────────────────────────────
// Main ConfigPanel
// ────────────────────────────────────────────────────────────────
const DEFAULT_POLICIES = {
    budget_daily_max: null,
    budget_per_request_max: null,
    blocked_actions: [],
    require_approval: [],
    allowed_scopes: [],
    forbidden_keywords: [],
    max_consecutive_failures: 3,
    active_hours_start: null,
    active_hours_end: null,
    min_confidence_score: null,
    max_tokens_per_action: null,
    max_retries: 5,
    rate_limit_per_min: 100,
};

export default function ConfigPanel({ selectedNode, onUpdateNode, onClose }) {
    const [draftData, setDraftData] = useState({});
    const [policies, setPolicies] = useState(DEFAULT_POLICIES);
    const [policiesSaved, setPoliciesSaved] = useState(false);

    // Sync draft when selected node changes (by id or critical fields)
    useEffect(() => {
        if (selectedNode) {
            setDraftData(selectedNode.data || {});
            // Normalize legacy key: forbidden_words → forbidden_keywords
            const rawPolicies = selectedNode.data?.policies || {};
            const normalized = {
                ...DEFAULT_POLICIES,
                ...rawPolicies,
                forbidden_keywords: rawPolicies.forbidden_keywords?.length
                    ? rawPolicies.forbidden_keywords
                    : (rawPolicies.forbidden_words || DEFAULT_POLICIES.forbidden_keywords),
            };
            setPolicies(normalized);
            setPoliciesSaved(false);
        }
    }, [
        selectedNode?.id,
        selectedNode?.data?.provider,
        selectedNode?.data?.model,
        selectedNode?.data?.description,
        selectedNode?.data?.system_prompt,
    ]);

    if (!selectedNode) return null;

    // ── Handlers ─────────────────────────────────────────────────
    const handleInstantChange = (field, value) => {
        const newData = { ...selectedNode.data, [field]: value };
        if (field === 'model') {
            const val = value.toLowerCase();
            if (val.includes('claude')) newData.provider = 'anthropic';
            else if (val.includes('gpt') || val.includes('o1')) newData.provider = 'openai';
            else if (val.includes('gemini')) newData.provider = 'google';
            else if (val.includes('custom')) newData.provider = 'custom';
        }
        onUpdateNode(selectedNode.id, newData);
    };

    const handleDraftChange = (field, value) => setDraftData(prev => ({ ...prev, [field]: value }));

    const handleSaveText = (field) => {
        if (draftData[field] !== selectedNode.data[field]) {
            onUpdateNode(selectedNode.id, { [field]: draftData[field] });
        }
    };

    const updatePolicy = (field, value) => {
        setPolicies(prev => ({ ...prev, [field]: value }));
        setPoliciesSaved(false);
    };

    const handleSavePolicies = () => {
        onUpdateNode(selectedNode.id, { policies });
        setPoliciesSaved(true);
        setTimeout(() => setPoliciesSaved(false), 2500);
    };

    // ── Provider & Models ─────────────────────────────────────────
    const provider = selectedNode.data.provider;

    const modelInventory = {
        openai: [
            { id: 'gpt-4o', label: 'GPT-4o (Standard)' },
            { id: 'gpt-4o-mini', label: 'GPT-4o-mini (Rapide)' },
            { id: 'o1', label: 'o1 (Reasoning)' },
            { id: 'o1-mini', label: 'o1-mini' },
            { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { id: 'gpt-4', label: 'GPT-4 Legacy' },
            { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ],
        anthropic: [
            { id: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
            { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
            { id: 'claude-3-opus-latest', label: 'Claude 3 Opus' },
            { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet v2' },
            { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus (Original)' }
        ],
        google: [
            { id: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Exp)' },
            { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
            { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
            { id: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' }
        ],
        custom: [{ id: 'custom-model', label: 'Custom Model' }]
    };

    const providerConfig = {
        openai: { name: 'OpenAI', color: 'text-emerald-500', border: 'border-emerald-100', bg: 'bg-emerald-50/30' },
        anthropic: { name: 'Anthropic', color: 'text-orange-500', border: 'border-orange-100', bg: 'bg-orange-50/30' },
        google: { name: 'Google Gemini', color: 'text-blue-500', border: 'border-blue-100', bg: 'bg-blue-50/30' },
        custom: { name: 'Custom LLM', color: 'text-purple-500', border: 'border-purple-100', bg: 'bg-purple-50/30' }
    };

    const theme = providerConfig[provider] || { name: 'Configuration', color: 'text-slate-500', border: 'border-slate-100', bg: 'bg-slate-50/50' };
    const isGuardrail = selectedNode.type === 'guardrailNode';
    const isLLM = selectedNode.type === 'llmNode' || selectedNode.type === 'placeholderNode';

    return (
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-full z-10 shadow-xl shrink-0 right-0 top-0 absolute lg:relative animate-in slide-in-from-right-8 duration-200">

            {/* Header */}
            <div className={`p-4 border-b border-slate-100 flex items-center justify-between ${isGuardrail ? 'bg-rose-50/30' : theme.bg}`}>
                <div className="flex items-center gap-2">
                    {isGuardrail
                        ? <AlertTriangle className="w-4 h-4 text-rose-500" />
                        : <Settings2 className={`w-4 h-4 ${theme.color}`} />
                    }
                    <h2 className="text-sm font-black uppercase tracking-tight text-slate-900">
                        {isGuardrail ? 'Verytis Governance' : (provider ? `${theme.name} DROPZONE` : 'DROPZONE')}
                    </h2>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">

                {/* ── Node Info (description for all types) ──────── */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-2">
                        Informations ({selectedNode.type})
                    </h3>
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Description / Rôle</label>
                        <textarea
                            rows={3}
                            value={draftData.description || ''}
                            onChange={e => handleDraftChange('description', e.target.value)}
                            onBlur={() => handleSaveText('description')}
                            className="w-full text-[11px] px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none font-medium text-slate-600 shadow-sm"
                            placeholder="A quoi sert ce bloc ?"
                        />
                    </div>
                </div>

                {/* ── LLM / PlaceholderNode: Model + System Prompt ── */}
                {isLLM && (
                    <div className="space-y-5 pt-2">
                        <h3 className={`text-[10px] font-bold uppercase tracking-wider ${theme.color} border-b ${theme.border} pb-2`}>
                            Modèle &amp; Intelligence
                        </h3>

                        {provider ? (
                            <>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-700">Modèles disponibles ({theme.name})</label>
                                    <div className="relative group">
                                        <select
                                            value={selectedNode.data.model || ''}
                                            onChange={e => handleInstantChange('model', e.target.value)}
                                            className="w-full text-xs font-bold px-3 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 appearance-none bg-white cursor-pointer shadow-sm transition-all"
                                        >
                                            <option value="">-- Choisir un modèle --</option>
                                            {(modelInventory[provider] || []).map(m => (
                                                <option key={m.id} value={m.id}>{m.label}</option>
                                            ))}
                                        </select>
                                        <Sparkles className={`absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.color} pointer-events-none`} />
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3 text-purple-500" />
                                        System Prompt (Personalité IA)
                                    </label>
                                    <textarea
                                        rows={10}
                                        value={draftData.system_prompt || ''}
                                        onChange={e => handleDraftChange('system_prompt', e.target.value)}
                                        onBlur={() => handleSaveText('system_prompt')}
                                        placeholder="Ici, définissez la personnalité et les instructions de votre agent..."
                                        className="w-full text-[10px] leading-relaxed font-mono px-3 py-3 border border-purple-100 bg-purple-50/10 rounded-xl outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 resize-none shadow-inner"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Veuillez d&apos;abord sélectionner un moteur sur le nœud du canvas.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── GuardrailNode: Full Verytis Policies ──────────── */}
                {isGuardrail && (
                    <div className="space-y-5 pt-2">

                        {/* Budget */}
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 border-b border-rose-100 pb-2 flex items-center gap-1.5 mb-3">
                                <DollarSign className="w-3.5 h-3.5" /> Budget Limits
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <PanelNumField label="daily_max_usd ($)" value={policies.budget_daily_max} onChange={v => updatePolicy('budget_daily_max', v)} placeholder="null" hint="par 24h" step={0.01} />
                                <PanelNumField label="per_request_max ($)" value={policies.budget_per_request_max} onChange={v => updatePolicy('budget_per_request_max', v)} placeholder="null" hint="par appel" step={0.01} />
                            </div>
                        </div>

                        {/* Action Restrictions */}
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 border-b border-rose-100 pb-2 flex items-center gap-1.5 mb-3">
                                <Ban className="w-3.5 h-3.5" /> Action Restrictions
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">blocked_actions</label>
                                    <PanelTagInput tags={policies.blocked_actions} onChange={v => updatePolicy('blocked_actions', v)} placeholder="DELETE, DROP_TABLE" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">require_approval</label>
                                    <PanelTagInput tags={policies.require_approval} onChange={v => updatePolicy('require_approval', v)} placeholder="DEPLOY, WRITE_PROD" />
                                </div>
                            </div>
                        </div>

                        {/* Data Access */}
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 border-b border-rose-100 pb-2 flex items-center gap-1.5 mb-3">
                                <Database className="w-3.5 h-3.5" /> Data Access
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">forbidden_keywords</label>
                                    <PanelTagInput tags={policies.forbidden_keywords} onChange={v => updatePolicy('forbidden_keywords', v)} placeholder="SALARY, SSN, PASSWORD" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">allowed_scopes</label>
                                    <PanelTagInput tags={policies.allowed_scopes} onChange={v => updatePolicy('allowed_scopes', v)} placeholder="PUBLIC, MARKETING" />
                                </div>
                            </div>
                        </div>

                        {/* Time Fencing */}
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 border-b border-rose-100 pb-2 flex items-center gap-1.5 mb-3">
                                <Clock className="w-3.5 h-3.5" /> Time Fencing
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">active_hours_start</label>
                                    <input type="time" value={policies.active_hours_start || ''} onChange={e => updatePolicy('active_hours_start', e.target.value || null)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-300 focus:border-rose-300" />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1 font-mono">active_hours_end</label>
                                    <input type="time" value={policies.active_hours_end || ''} onChange={e => updatePolicy('active_hours_end', e.target.value || null)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-rose-300 focus:border-rose-300" />
                                    <p className="text-[9px] text-slate-400 mt-0.5 font-mono">null = 24/7</p>
                                </div>
                            </div>
                        </div>

                        {/* Output Controls */}
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 border-b border-rose-100 pb-2 flex items-center gap-1.5 mb-3">
                                <Cpu className="w-3.5 h-3.5" /> Output Controls
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <PanelNumField label="max_consecutive_failures" value={policies.max_consecutive_failures} onChange={v => updatePolicy('max_consecutive_failures', v)} placeholder="3" step={1} />
                                <PanelNumField label="rate_limit_per_min" value={policies.rate_limit_per_min} onChange={v => updatePolicy('rate_limit_per_min', v)} placeholder="100" hint="req/min" step={1} />
                                <PanelNumField label="min_confidence" value={policies.min_confidence_score} onChange={v => updatePolicy('min_confidence_score', v)} placeholder="0.80" hint="0.0 → 1.0" step={0.01} min={0} max={1} />
                                <PanelNumField label="max_tokens" value={policies.max_tokens_per_action} onChange={v => updatePolicy('max_tokens_per_action', v)} placeholder="4096" hint="cap/action" step={1} />
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSavePolicies}
                            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${policiesSaved ? 'bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                        >
                            {policiesSaved
                                ? <><CheckCircle2 className="w-4 h-4" /> Policies Sauvegardées</>
                                : <><Save className="w-4 h-4" /> Sauvegarder les Policies</>
                            }
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
