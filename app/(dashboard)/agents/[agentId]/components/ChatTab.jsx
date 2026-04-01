'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bot, 
    Hash, 
    Settings, 
    Sparkles, 
    Lock, 
    Send, 
    Cpu, 
    ShieldCheck 
} from 'lucide-react';
import { Card, Button } from '@/components/ui';
import ChatMessage from './ChatMessage';
import { useAgentChat } from '../hooks/useAgentChat';

export default function ChatTab({ agentId }) {
    const {
        messages,
        chatInput,
        setChatInput,
        isChatting,
        resolvedActions,
        executeAction,
        sendMessage,
        isGrouped,
        chatEndRef,
        agent,
        agentName,
        isLoading,
        actionSelectionsRef,
        globalApiKey
    } = useAgentChat(agentId);

    if (isLoading) return <div className="p-12 text-center text-slate-500 font-medium animate-pulse">Chargement de la session...</div>;

    return (
        <div className="flex gap-6 h-[700px] animate-in fade-in duration-500">
            {/* Main Chat Hub */}
            <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
                {/* Status Bar */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10 sticky top-0 shadow-sm shadow-slate-50">
                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                            <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center shadow-sm">
                                <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-sm">
                                <Hash className="w-4 h-4 text-white" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-[13px] font-bold text-slate-900 leading-none">Conversation Multi-Canal</h3>
                                <div className="px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100 uppercase tracking-tight">Active</div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <Hash className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{agentName?.toLowerCase().replace(/\s+/g, '-')}-ops</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-50 border border-slate-100 rounded-lg">
                            <Settings className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Context Dock */}
                <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex gap-6 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Membres: {agent?.organization_id ? 'Équipe Ops' : 'Privé'}</span>
                    </div>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Session Chiffrée</span>
                    </div>
                </div>

                {/* Scrollable Conversation */}
                <div className="flex-1 overflow-y-auto p-8 space-y-2 scroll-smooth bg-slate-50/30">
                    <AnimatePresence initial={false}>
                        {messages.length === 0 && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto"
                            >
                                <div className="w-20 h-20 bg-white shadow-xl shadow-blue-500/10 rounded-3xl flex items-center justify-center mb-6 rotate-3 border border-slate-100">
                                    <Sparkles className="w-10 h-10 text-blue-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">Assistant Verytis Ops</h3>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                    Pilotage stratégique multi-canal. Testez les déploiements, ajustez les protocoles ou activez de nouveaux modules en temps réel.
                                </p>
                            </motion.div>
                        )}

                        {messages.map((m, i) => (
                            <ChatMessage 
                                key={m.id || i} 
                                m={m} 
                                i={i} 
                                isFirstInGroup={!isGrouped(i)}
                                isLastInGroup={i === messages.length - 1 || messages[i+1].role !== m.role}
                                isGrouped={isGrouped}
                                agentName={agentName}
                                resolvedActions={resolvedActions}
                                executeAction={executeAction}
                                actionSelectionsRef={actionSelectionsRef}
                            />
                        ))}

                        {isChatting && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 mt-4">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-5 py-4 flex gap-1.5 items-center shadow-sm">
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-duration:0.8s]"></div>
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></div>
                                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div ref={chatEndRef} />
                </div>

                {/* Input Dock */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100">
                    <form
                        className="relative flex items-end gap-3 max-w-4xl mx-auto"
                        onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                    >
                        <div className="flex-1 relative group bg-white rounded-2xl shadow-sm border border-slate-200 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-600/5 transition-all overflow-hidden flex items-center">
                            <div className="pl-4 pr-1 text-blue-500">
                                <Sparkles className="w-5 h-5 animate-pulse" />
                            </div>
                            <input
                                type="text"
                                placeholder="Piloter l'intelligence de votre agent..."
                                className="w-full bg-transparent border-none px-3 py-4 text-[13px] font-medium outline-none text-slate-800 placeholder:text-slate-400"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={isChatting}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!chatInput.trim() || isChatting}
                            className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all active:scale-90 ${
                                !chatInput.trim() || isChatting ? 'bg-slate-100 text-slate-300' : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700'
                            }`}
                        >
                            {isChatting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send className="w-4 h-4" />}
                        </button>
                    </form>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center mt-4 opacity-50">
                        Les actions structurelles demandent votre approbation explicite.
                    </p>
                </div>
            </div>

            {/* Intelligence Sidebar */}
            <div className="w-80 flex flex-col gap-4">
                <Card className="p-6 bg-slate-900 border-none relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 text-blue-500 opacity-5 group-hover:scale-110 transition-transform duration-700">
                        <Cpu className="w-32 h-32" />
                    </div>
                    <div className="relative">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">Prompt Système Actif</h4>
                        <div className="text-[11px] text-slate-300 font-medium leading-relaxed italic line-clamp-[12] hover:line-clamp-none transition-all duration-300 cursor-help">
                            "{agent?.system_prompt || 'Standard Autonomous Protocol Active'}"
                        </div>
                    </div>
                </Card>

                <Card className="p-6">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        Gouvernance & Limites
                    </h4>
                    <div className="space-y-4">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Budget Max Quotidien</div>
                            <div className="text-sm font-black text-blue-600">${agent?.policies?.budget_daily_max || '0.00'}</div>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="text-[9px] font-bold text-slate-500 uppercase mb-1">Mots-clés Restreints</div>
                            <div className="text-sm font-black text-rose-600">{agent?.policies?.forbidden_keywords?.length || 0}</div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
