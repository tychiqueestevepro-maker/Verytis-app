import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Shield, DollarSign, Database, Ban, Activity } from 'lucide-react';

const GuardrailNode = ({ data, isConnectable }) => {
    const policies = data.policies || {};
    // Normalize: support both old key (forbidden_words) and new key (forbidden_keywords)
    const forbiddenKeywords = policies.forbidden_keywords?.length
        ? policies.forbidden_keywords
        : (policies.forbidden_words || []);
    const blockedActions = policies.blocked_actions || [];

    return (
        <div className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm hover:shadow-xl hover:border-rose-400 transition-all group overflow-hidden min-w-[220px]">
            {/* Minimal Square Header */}
            <div className="p-4 flex flex-col items-center gap-3 border-b border-slate-100 bg-rose-50/20">
                <div className="w-16 h-16 rounded-2xl transition-all group-hover:scale-110 duration-500 flex items-center justify-center overflow-hidden bg-white shadow-md border border-slate-100">
                    <img
                        src="https://www.google.com/s2/favicons?domain=verytis.com&sz=128"
                        alt="Verytis"
                        className="w-10 h-10 object-contain"
                    />
                </div>
                <div className="text-center">
                    <div className="text-[10px] font-black uppercase tracking-widest text-rose-500/50 mb-0.5">
                        Verytis Governance
                    </div>
                    <div className="text-xs font-bold text-slate-900 line-clamp-1 px-2">
                        {data.label || 'Verytis Shield'}
                    </div>
                </div>
            </div>

            {/* Content - Compact Policies */}
            <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-600">
                        <DollarSign className="w-3 h-3 text-emerald-500" /> Budget
                    </div>
                    <span className="font-mono text-slate-500">
                        {policies.budget_daily_max != null ? `$${policies.budget_daily_max.toFixed(2)}/jour` : '—'}
                    </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-600">
                        <Ban className="w-3 h-3 text-rose-500" /> Banned
                    </div>
                    <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${forbiddenKeywords.length > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'
                        }`}>
                        {forbiddenKeywords.length > 0 ? `${forbiddenKeywords.length} mots` : '0 mots'}
                    </span>
                </div>

                {blockedActions.length > 0 && (
                    <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1.5 font-bold text-slate-600">
                            <Database className="w-3 h-3 text-orange-500" /> Bloqué
                        </div>
                        <span className="bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-md font-bold text-[9px]">
                            {blockedActions.length} actions
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 border-t border-slate-50 pt-2">
                    <Activity className="w-3 h-3 text-indigo-400" />
                    <span>Monitoring actif</span>
                </div>
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Top}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-slate-200 border-2 border-white rounded-full transition-colors hover:bg-rose-500"
            />
            {/* Source handle (optional if it's the end of flow, but useful for chaining custom logic) */}
            <Handle
                type="source"
                position={Position.Bottom}
                isConnectable={isConnectable}
                className="w-3 h-3 bg-slate-300 border-2 border-white rounded-full transition-colors hover:bg-rose-500"
            />
        </div>
    );
};

export default memo(GuardrailNode);
