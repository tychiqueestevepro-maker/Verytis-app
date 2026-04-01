'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';

const fetcher = (url) => fetch(url).then(r => r.json());

export function useAgentChat(agentId) {
    const { showToast } = useToast();
    const { mutate: globalMutate } = useSWRConfig();
    
    // Fetch Agent Data
    const { data, error, isLoading, mutate } = useSWR(agentId ? `/api/agents/${agentId}` : null, fetcher);
    // Fetch Global Settings (for API Key)
    const { data: settingsData } = useSWR('/api/settings', fetcher);

    const agent = data?.agent;
    const globalApiKey = settingsData?.verytis_api_key || agent?.api_key || 'vrt_live_xxxxxxxxxxxxxxxx';
    const agentName = agent ? agent.name : "Loading...";

    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [resolvedActions, setResolvedActions] = useState({}); // { [messageId]: { confirmed: bool, value: string } }
    
    // Performance & Conflict Protection (Principal Engineer Strategy)
    const abortControllerRef = useRef(null);
    const lastMutationTimestamp = useRef(0);
    const actionSelectionsRef = useRef({});
    const chatEndRef = useRef(null);

    const scrollToBottom = (behavior = "smooth") => {
        chatEndRef.current?.scrollIntoView({ behavior });
    };

    // Only scroll when a NEW message arrives or while chatting
    useEffect(() => {
        scrollToBottom();
    }, [messages.length, isChatting]);

    // Durable Chat Loader (Non-Destructive Merge + Request Versioning)
    useEffect(() => {
        if (data?.chatHistory) {
            // Protect against stale re-fetches if a mutation was recently completed
            const serverTimestamp = data.serverTimestamp || Date.now();
            if (serverTimestamp < lastMutationTimestamp.current) return;

            setMessages(data.chatHistory);

            // Scan history to restore resolved action states
            setResolvedActions(prev => {
                const restored = { ...prev };
                data.chatHistory.forEach((msg, idx) => {
                    if (msg.action_payload && msg.id) {
                        for (let j = idx + 1; j < data.chatHistory.length; j++) {
                            const next = data.chatHistory[j];
                            if (next.role === 'user' && next.content) {
                                if (next.content.includes('[SIGNAL: CONFIRMED]')) {
                                    const match = next.content.match(/=\s*(.+?)\.\s*Tu peux/s) || next.content.match(/=\s*(.+)$/s);
                                    const value = match ? match[1].split('.')[0].trim() : msg.action_payload.new_value;
                                    restored[msg.id] = { confirmed: true, value };
                                    break;
                                } else if (next.content.includes('[SIGNAL: REFUSED]')) {
                                    restored[msg.id] = { confirmed: false, value: null };
                                    break;
                                }
                            }
                            if (next.action_payload) break;
                        }
                    }
                });
                return restored;
            });
        }
    }, [data?.chatHistory]);

    // Human-in-the-Loop: Execute Action (Signal back to Agent)
    const executeAction = async (payload, confirmed, messageId, index) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        const { signal: abortSignal } = abortControllerRef.current;

        lastMutationTimestamp.current = Date.now();
        const finalValue = actionSelectionsRef.current[index] 
            ? (Array.isArray(actionSelectionsRef.current[index]) 
                ? actionSelectionsRef.current[index].join(', ') 
                : actionSelectionsRef.current[index])
            : payload.new_value;

        if (messageId || index !== undefined) {
            const key = messageId || index;
            setResolvedActions(prev => ({ ...prev, [key]: { confirmed, value: finalValue } }));
        }

        const signalMessage = confirmed 
            ? `[SIGNAL: CONFIRMED] J'approuve la modification : ${payload.target_field} = ${finalValue}. Tu peux synchroniser la mémoire.`
            : `[SIGNAL: REFUSED] Je refuse cette modification : ${payload.target_field}. N'effectue pas ce changement.`;
            
        const userMsg = { role: 'user', content: signalMessage };
        const optimisticHistory = [...messages, userMsg];
        
        setMessages(optimisticHistory);
        setIsChatting(true);

        try {
            const res = await fetch(`/api/run/${agentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalApiKey}`
                },
                body: JSON.stringify({ messages: optimisticHistory, message: signalMessage }),
                signal: abortSignal,
                credentials: 'include'
            });
            
            const resultMsg = await res.json();
            
            if (res.ok) {
                const finalAssistantMsg = { role: 'assistant', content: resultMsg.response, action_payload: resultMsg.action_payload, id: resultMsg.id };
                const fullHistory = [...optimisticHistory, finalAssistantMsg];
                setMessages(fullHistory);
                
                mutate({ ...data, chatHistory: fullHistory, serverTimestamp: Date.now() }, { revalidate: false });
                if (confirmed) showToast({ title: 'Succès', message: 'Paramètres mis à jour avec succès', type: 'success' });
            } else {
                setMessages([...optimisticHistory, { role: 'system', content: `Erreur: ${resultMsg.error}` }]);
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            setMessages(prev => [...prev, { role: 'system', content: 'Échec de la validation.' }]);
        } finally {
            setIsChatting(false);
        }
    };

    // Helper to check if a message should be grouped with the previous one
    const isGrouped = (index) => {
        if (index === 0) return false;
        const current = messages[index];
        const previous = messages[index - 1];
        return current.role === previous.role;
    };

    const sendMessage = async (customMessage = null) => {
        const text = customMessage || chatInput;
        if (!text.trim() || isChatting) return;

        const userMsg = { role: 'user', content: text };
        const newHistory = [...messages, userMsg];
        
        setMessages(newHistory);
        setChatInput('');
        setIsChatting(true);
        lastMutationTimestamp.current = Date.now();

        try {
            const res = await fetch(`/api/run/${agentId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${globalApiKey}`
                },
                body: JSON.stringify({ messages: newHistory, message: text }),
                credentials: 'include'
            });
            
            const resultMsg = await res.json();
            if (res.ok) {
                const assistantMsg = { role: 'assistant', content: resultMsg.response, action_payload: resultMsg.action_payload, id: resultMsg.id };
                const finalHistory = [...newHistory, assistantMsg];
                setMessages(finalHistory);
                mutate({ ...data, chatHistory: finalHistory, serverTimestamp: Date.now() }, { revalidate: false });
            } else {
                setMessages([...newHistory, { role: 'system', content: `Erreur: ${resultMsg.error}` }]);
            }
        } catch (err) {
            setMessages(prev => [...prev, { role: 'system', content: 'Échec de la connexion.' }]);
        } finally {
            setIsChatting(false);
        }
    };

    return {
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
        error,
        actionSelectionsRef,
        globalApiKey
    };
}
