'use client';

import React, { useState } from 'react';
import { Send, Bot, Loader2, Sparkles, Copy, Trash2 } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(r => r.json());

export default function AgentPlaygroundSection({ agentId, agentName }) {
    const { showToast } = useToast();
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isChatting, setIsChatting] = useState(false);

    // Simulation mode uses session cookies, no API key needed

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        if (!chatInput.trim() || isChatting) return;
        if (!agentId) {
            showToast({
                title: 'Agent non enregistré',
                message: 'Veuillez enregistrer votre agent pour pouvoir le tester.',
                type: 'warning'
            });
            return;
        }

        const userMsg = { role: 'user', content: chatInput };
        const currentHistory = [...messages, userMsg];
        setMessages(currentHistory);
        setChatInput('');
        setIsChatting(true);

        try {
            const res = await fetch(`/api/run/${agentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // No Authorization header needed: backend will use session cookie
                },
                body: JSON.stringify({ messages: currentHistory, message: chatInput })
            });
            const data = await res.json();
            if (res.ok) {
                setMessages([...currentHistory, { role: 'assistant', content: data.response }]);
            } else {
                const errorMsg = data.message ? `${data.error}: ${data.message}` : (data.error || 'Gateway inaccessible');
                setMessages([...currentHistory, { role: 'system', content: `Erreur: ${errorMsg}` }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'system', content: 'Échec de la connexion au serveur.' }]);
        } finally {
            setIsChatting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden animate-in fade-in duration-500">
            {!agentId ? (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <div className="p-4 bg-indigo-50 rounded-full border border-indigo-100 mb-6">
                        <Sparkles className="w-12 h-12 text-indigo-600 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Activez d'abord votre Agent</h2>
                    <p className="text-slate-500 max-w-md text-sm leading-relaxed">
                        Le Chat permet de simuler une interaction bidirectionnelle. Sauvegardez votre configuration pour que l'IA puisse commencer à discuter.
                    </p>
                </div>
            ) : (
                <div className="flex-1 flex gap-6 p-6 h-full overflow-hidden">
                    {/* Chat Area */}
                    <Card className="flex-1 flex flex-col bg-white shadow-xl border-slate-200/60 rounded-[32px] overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Bot className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{agentName || 'Agent'}</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Interactive Chat</span>
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" onClick={() => setMessages([])} className="h-9 px-4 rounded-xl text-xs font-bold hover:bg-slate-200/50">
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Effacer
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                                    <Bot className="w-20 h-20 text-indigo-400 mb-4 stroke-[1.5]" />
                                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">Prêt pour le test</h4>
                                    <p className="text-sm font-medium text-slate-500 max-w-xs">Envoyez une commande pour voir comment votre agent utilise ses outils.</p>
                                </div>
                            )}
                            {messages.map((m, i) => (
                                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                    <div className={`max-w-[75%] rounded-[24px] px-5 py-3 text-[13px] font-medium leading-relaxed shadow-sm ${
                                        m.role === 'user' 
                                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                                            : m.role === 'system'
                                                ? 'bg-rose-50 border border-rose-200 text-rose-700 font-bold italic'
                                                : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                                    }`}>
                                        <div className="text-[9px] font-black uppercase opacity-60 mb-1.5 flex items-center gap-1">
                                            {m.role === 'user' ? 'Utilisateur' : (m.role === 'assistant' ? agentName : 'System Error')}
                                        </div>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isChatting && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 rounded-[20px] rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-400 uppercase animate-pulse">IA Réfléchit...</span>
                                        <div className="flex gap-1.5 items-center">
                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.02)] relative shrink-0">
                            <form className="flex gap-3" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    placeholder="Simulez une requête utilisateur..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3.5 text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400 shadow-inner"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={isChatting || !chatInput.trim()}
                                    className="px-6 py-3.5 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                                >
                                    {isChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    </Card>

                    {/* Quick Settings / context Sidebar */}
                    <div className="w-80 space-y-4 shrink-0 overflow-y-auto pr-1">
                        <Card className="p-6 border-slate-200/60 bg-white/50 backdrop-blur">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                Mode Simulation
                            </h4>
                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed mb-4">
                                Testez l'agent tel qu'il sera déployé. Cela inclut la vérification des Guardrails et l'appel réel de vos outils.
                            </p>
                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 mb-2">
                                <p className="text-[10px] font-bold text-amber-800 leading-tight">
                                    💡 Pensez à enregistrer avant de tester pour appliquer vos dernières modifications visuelles.
                                </p>
                            </div>
                        </Card>

                        <Card className="p-6 border-slate-200/60 bg-white/50 backdrop-blur">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Auth Status</h4>
                            <div className="space-y-3">
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <div className="text-[9px] font-bold text-emerald-600 uppercase mb-1">Session Active</div>
                                    <div className="text-[10px] font-bold text-slate-700">Authenticated as Owner</div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
