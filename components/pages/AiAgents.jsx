'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Search, Filter, Plus, ChevronRight, X, MoreVertical, Trash2, Users, Activity, Settings, Bot, ShieldAlert, Copy, Cpu, RefreshCw, Layers, CheckCircle2 } from 'lucide-react';
import { Card, Button, StatusBadge, PlatformIcon, Modal, EmptyState } from '../ui';

const fetcher = (url) => fetch(url).then(r => r.json());

const SDKSnippet = ({ apiKey }) => {
    const snippet = `// 1. Install node-fetch or use native fetch
const fetch = require('node-fetch');

// 2. Call the Telemetry API
async function logAiAction() {
  const response = await fetch('https://api.verytis.com/api/ingest/agent', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ${apiKey}',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      trace_id: "req-12345",
      step: "TOOL_CALL",
      message: "Searching vector DB for relevant context",
      metrics: { tokens_used: 154, cost_usd: 0.003, duration_ms: 450 },
      cognitive_load: { retry_count: 1, tools_called: ["search"] },
      ai_context: { model: "gpt-4", provider: "openai", temperature: 0 }
    })
  });
  
  const result = await response.json();
  console.log('Logged:', result);
}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(snippet);
    };

    return (
        <div className="mt-4 bg-slate-900 rounded-lg p-4 font-mono text-xs text-blue-300 overflow-x-auto relative">
            <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                <Copy className="w-4 h-4" />
            </button>
            <pre className="whitespace-pre-wrap">{snippet}</pre>
        </div>
    );
};

export default function AiAgents({ userRole }) {
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Store new agent to display API key once
    const [newAgentResult, setNewAgentResult] = useState(null);

    const { data, error, isLoading, mutate } = useSWR('/api/agents', fetcher);
    const agents = data?.agents || [];

    const handleRegister = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/agents/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await res.json();
            if (res.ok) {
                setNewAgentResult(result);
                mutate(); // refresh agents list
            } else {
                alert(result.error || 'Failed to register agent');
            }
        } catch (err) {
            console.error(err);
            alert('An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const closeRegisterModal = () => {
        setIsRegisterModalOpen(false);
        setFormData({ name: '', description: '' });
        setNewAgentResult(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 p-6">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Bot className="w-6 h-6 text-blue-600" />
                        AI Agents Telemetry
                    </h1>
                    <p className="text-slate-500 mt-1 text-xs font-medium">Register autonomous agents and monitor their execution trails securely.</p>
                </div>
                <Button variant="primary" icon={Plus} onClick={() => setIsRegisterModalOpen(true)}>Register New Agent</Button>
            </header>

            {isLoading ? (
                <Card className="p-12 text-center text-slate-500">Loading agents...</Card>
            ) : error ? (
                <Card className="p-12 text-center text-rose-500 flex flex-col items-center">
                    <ShieldAlert className="w-8 h-8 mb-2" />
                    Failed to load AI Agents
                </Card>
            ) : agents.length === 0 ? (
                <EmptyState
                    title="No Agents Registered"
                    description="You have not registered any AI Agents yet. Start monitoring your autonomous agents by creating your first identity."
                    icon={Bot}
                    actionText="Register New Agent"
                    onAction={() => setIsRegisterModalOpen(true)}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {agents.map(agent => (
                        <Card key={agent.id} className="overflow-hidden flex flex-col h-[400px]">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-900 text-sm hover:text-indigo-600 transition-colors">
                                        <Link href={`/agents/${agent.id}`}>{agent.name}</Link>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">{agent.description || 'No description provided'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <StatusBadge status={agent.status} />
                                    <Link href={`/agents/${agent.id}`} className="text-[10px] font-semibold text-slate-500 hover:text-indigo-600 border border-slate-200 bg-white px-2 py-1 rounded transition-colors">
                                        View Full Audit
                                    </Link>
                                </div>
                            </div>

                            <div className="flex-1 p-0 overflow-y-auto bg-slate-50/30">
                                {agent.telemetry?.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                        No telemetry recorded yet.
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-slate-100">
                                        {agent.telemetry?.slice(0, 10).map((log, i) => (
                                            <li key={log.id} className="p-3 bg-white hover:bg-slate-50 transition-colors text-xs">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <span className="font-semibold text-slate-700">{log.summary || 'AI Step'}</span>
                                                        <span className="text-slate-400 block mt-0.5 text-[10px]">Trace: {log.metadata?.trace_id}</span>
                                                    </div>
                                                    <span className="text-slate-400 text-[10px]">
                                                        {new Date(log.created_at).toLocaleTimeString()}
                                                    </span>
                                                </div>

                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {log.metadata?.ai_context?.model && (
                                                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                                            <Cpu className="w-3 h-3" /> {log.metadata.ai_context.model}
                                                        </span>
                                                    )}

                                                    {log.metadata?.cognitive_load?.retry_count > 0 && (
                                                        <span className={`inline-flex items-center gap-1 border px-1.5 py-0.5 rounded text-[10px] font-medium ${log.metadata.cognitive_load.retry_count > 2 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                            <RefreshCw className="w-3 h-3" /> Retry: {log.metadata.cognitive_load.retry_count}
                                                        </span>
                                                    )}

                                                    {log.metadata?.cognitive_load?.tools_called?.length > 0 && (
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[120px]">
                                                            <Layers className="w-3 h-3" /> {log.metadata.cognitive_load.tools_called.join(', ')}
                                                        </span>
                                                    )}
                                                </div>

                                                {log.metadata?.message && (
                                                    <div className="mt-2 bg-slate-100 text-slate-600 p-1.5 rounded text-[10px] border border-slate-200 font-mono italic">
                                                        "{log.metadata.message}"
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Registration Modal */}
            <Modal
                isOpen={isRegisterModalOpen}
                onClose={closeRegisterModal}
                title="Register AI Agent"
                maxWidth="max-w-2xl"
            >
                {newAgentResult ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex gap-3 items-start">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm">Agent Registered Successfully</h4>
                                <p className="text-xs mt-1 leading-relaxed">Please copy your API key now. For security reasons, <strong>it will not be shown again</strong>.</p>

                                <div className="mt-3 flex items-center gap-2">
                                    <code className="flex-1 bg-white border border-emerald-300 rounded px-2 py-1 text-sm font-mono text-emerald-900 break-all">
                                        {newAgentResult.apiKey}
                                    </code>
                                    <Button variant="secondary" icon={Copy} className="!py-1.5" onClick={() => navigator.clipboard.writeText(newAgentResult.apiKey)}>Copy</Button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 border-t border-slate-100 pt-4">
                            <h4 className="font-bold text-sm text-slate-900 mb-1">How to use the SDK</h4>
                            <p className="text-xs text-slate-500 mb-2">Use the snippet below to start logging your agent's thoughts into the immutable ledger.</p>
                            <SDKSnippet apiKey={newAgentResult.apiKey} />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button variant="primary" onClick={closeRegisterModal}>I have saved the key</Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-md mb-4 text-xs text-blue-800 flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <p>Registering an agent creates a secure identity for telemetry logging. The API key generated should be kept secret and injected into the agent's environment variables.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Agent Name <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Code Review Agent"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                            <input
                                type="text"
                                placeholder="e.g. Scans PRs and detects vulnerabilities"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>

                        <div className="flex justify-end pt-4 gap-2">
                            <Button variant="ghost" type="button" onClick={closeRegisterModal} disabled={isSubmitting}>Cancel</Button>
                            <Button variant="primary" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Generating Identity...' : 'Generate API Key'}
                            </Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}
