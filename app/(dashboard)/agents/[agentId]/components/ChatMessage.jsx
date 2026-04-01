'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
    Bot, 
    UserCircle, 
    CheckCircle2, 
    X, 
    Check, 
    Sparkles, 
    Cpu 
} from 'lucide-react';
import MetadataMultiSelect from './MetadataMultiSelect';

export default function ChatMessage({ 
    m, 
    i, 
    isLastInGroup, 
    isFirstInGroup, 
    isGrouped, 
    agentName, 
    resolvedActions, 
    executeAction, 
    actionSelectionsRef 
}) {
    const isUser = m.role === 'user';
    const isBot = m.role === 'assistant';
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            layout
            className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-6' : 'mt-1'}`}
        >
            {isBot && !isGrouped(i) && (
                <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0 shadow-lg shadow-slate-200 mt-1">
                    <Bot className="w-4 h-4 text-white" />
                </div>
            )}
            {isBot && isGrouped(i) && <div className="w-8 flex-shrink-0" />}

            <div className={`max-w-[85%] group relative ${isUser ? 'text-right' : 'text-left'}`}>
                {!isGrouped(i) && (
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 text-slate-400 ${isUser ? 'mr-1' : 'ml-1'}`}>
                        {isUser ? 'Propriétaire' : agentName}
                    </div>
                )}
                
                <div className={`
                    inline-block px-5 py-3.5 text-[13px] leading-relaxed transition-all relative
                    ${isUser 
                        ? 'bg-blue-600 text-white shadow-blue-500/10 shadow-lg font-medium' 
                        : 'bg-white border border-slate-100 text-slate-800 font-medium shadow-sm'
                    }
                    ${isFirstInGroup && isUser ? 'rounded-2xl rounded-tr-none' : ''}
                    ${isFirstInGroup && isBot ? 'rounded-2xl rounded-tl-none' : ''}
                    ${!isFirstInGroup && !isLastInGroup ? 'rounded-2xl' : ''}
                    ${isLastInGroup && !isFirstInGroup ? 'rounded-2xl' : ''}
                    ${!isFirstInGroup ? 'rounded-2xl' : ''}
                `}>
                    <div className="whitespace-pre-wrap">
                        {m.content
                            .replace(/\[SIGNAL: CONFIRMED\].*/, 'Je confirme ce paramétrage.')
                            .replace(/\[SIGNAL: REFUSED\].*/, 'J\'annule cette opération.')
                            .replace(/\*\*/g, '')
                            .replace(/###\s*/g, '')}
                    </div>

                    {m.action_payload && (() => {
                        const resolved = resolvedActions[m.id] || resolvedActions[i];
                        
                        // ─── RESOLVED MODE: show summary card ───
                        if (resolved) {
                            return (
                                <div className="mt-4 p-5 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[24px] shadow-md text-left animate-in fade-in duration-300 relative overflow-hidden">
                                    <div className={`absolute inset-0 opacity-5 ${resolved.confirmed ? 'bg-green-500' : 'bg-slate-400'}`} />
                                    <div className="flex items-start gap-3 relative z-10">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                            resolved.confirmed ? 'bg-emerald-100' : 'bg-slate-100'
                                        }`}>
                                            {resolved.confirmed 
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                : <X className="w-4 h-4 text-slate-400" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                                                resolved.confirmed ? 'text-emerald-600' : 'text-slate-400'
                                            }`}>
                                                {resolved.confirmed ? '✅ Déployé' : '❌ Annulé'}
                                            </div>
                                            <div className="text-[12px] font-bold text-slate-700 truncate">{m.action_payload.change_detected}</div>
                                            {resolved.confirmed && resolved.value && resolved.value !== '✨ Automatique' && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {resolved.value.split(', ').map(v => (
                                                        <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg text-[11px] font-bold">
                                                            <Check className="w-2.5 h-2.5" /> {v}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {resolved.confirmed && resolved.value === '✨ Automatique' && (
                                                <div className="mt-2">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[11px] font-bold">
                                                        <Sparkles className="w-2.5 h-2.5" /> Mode Automatique
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // ─── ACTIVE MODE: show full card with selection + buttons ───
                        return (
                            <div className="mt-4 p-6 bg-white/40 backdrop-blur-xl border border-white/60 rounded-[24px] shadow-2xl shadow-blue-500/10 overflow-hidden animate-in zoom-in-95 duration-500 relative group text-left">
                                <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/15 transition-all duration-700"></div>
                                <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-indigo-500/5 rounded-full blur-2xl"></div>
                                
                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                                            <Cpu className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] leading-none mb-1">Configuration Requise</div>
                                            <div className="text-[11px] font-bold text-slate-400 leading-none uppercase tracking-tight">Pilotage Verytis v1</div>
                                        </div>
                                    </div>
                                    
                                    {(() => {
                                        const text = (m.action_payload.change_detected || '').toLowerCase();
                                        let logoSrc = null;
                                        if (text.includes('youtube')) logoSrc = '/logos/youtube.svg';
                                        else if (text.includes('slack')) logoSrc = '/logos/slack.svg';
                                        else if (text.includes('shopify')) logoSrc = '/logos/shopify.svg';
                                        else if (text.includes('github') || text.includes('git')) logoSrc = '/logos/github.svg';
                                        else if (text.includes('trello')) logoSrc = '/logos/trello.svg';
                                        else if (text.includes('tiktok')) logoSrc = 'https://www.google.com/s2/favicons?domain=tiktok.com&sz=128';
                                        else if (text.includes('google')) logoSrc = '/logos/google.svg';
                                        else if (text.includes('stripe')) logoSrc = 'https://www.google.com/s2/favicons?domain=stripe.com&sz=128';
                                        
                                        return logoSrc ? (
                                            <div className="bg-white p-1.5 rounded-xl border border-slate-100 shadow-sm">
                                                <img src={logoSrc} className="w-5 h-5 object-contain" alt="Provider" />
                                            </div>
                                        ) : null;
                                    })()}
                                </div>

                                <div className="bg-white/60 p-4 rounded-2xl mb-5 border border-white shadow-sm relative z-10 backdrop-blur-sm">
                                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                        <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                                        Impact Système Détecté
                                    </div>
                                    <div className="text-[14px] text-slate-900 font-black leading-snug tracking-tight">{m.action_payload.change_detected}</div>
                                </div>

                                {m.action_payload.type === 'CONFIG_UPDATE' && (
                                    <div className="mb-6 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2 pl-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></div>
                                            Configuration de la Cible
                                        </div>
                                        <MetadataMultiSelect
                                            payload={m.action_payload}
                                            onChange={(vals) => { actionSelectionsRef.current[i] = vals; }}
                                        />
                                    </div>
                                )}

                                <div className="flex gap-3 relative z-10">
                                    <button 
                                        onClick={() => executeAction(m.action_payload, true, m.id, i)}
                                        className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-[11px] font-black transition-all active:scale-[0.98] shadow-xl shadow-blue-500/20"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> DÉPLOYER LE CHANGEMENT
                                    </button>
                                    <button 
                                        onClick={() => executeAction(m.action_payload, false, m.id, i)}
                                        className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl text-[11px] font-black transition-all active:scale-[0.98]"
                                    >
                                        ANNULER
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {isUser && !isGrouped(i) && (
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-100 mt-1">
                    <UserCircle className="w-5 h-5 text-white" />
                </div>
            )}
            {isUser && isGrouped(i) && <div className="w-8 flex-shrink-0" />}
        </motion.div>
    );
}
