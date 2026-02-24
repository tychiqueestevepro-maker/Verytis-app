'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ChevronRight,
    ShieldCheck,
    Cpu,
    Slack,
    Github,
    Database,
    Zap,
    ArrowRight,
    Layout,
    Clock,
    DollarSign,
    Box,
    Globe,
    ExternalLink,
    Terminal,
    Map
} from 'lucide-react';
import { Card, Button, StatusBadge } from '@/components/ui';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(r => r.json());

const PlatformIcon = ({ platform }) => {
    switch (platform?.toLowerCase()) {
        case 'slack': return <Slack className="w-5 h-5 text-indigo-500" />;
        case 'github':
        case 'github_actions': return <Github className="w-5 h-5 text-slate-800" />;
        case 'internal_db': return <Database className="w-5 h-5 text-emerald-500" />;
        case 'agent_brain': return <Cpu className="w-5 h-5 text-blue-500" />;
        default: return <Zap className="w-5 h-5 text-amber-500" />;
    }
};

export default function TraceDetailPage() {
    const { agentId, traceId } = useParams();
    const { data: agentData } = useSWR(`/api/agents/${agentId}`, fetcher);
    const agent = agentData?.agent;
    const allLogs = agentData?.logs || [];

    // Filter logs for this specific trace
    const traceLogs = [...allLogs]
        .filter(l => l.metadata?.trace_id === traceId)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (!agent) return <div className="p-12 text-center text-slate-400">Loading Trace Detail...</div>;

    // Calculate cross-platform hops
    const hops = [];
    for (let i = 0; i < traceLogs.length; i++) {
        const current = traceLogs[i];
        const next = traceLogs[i + 1];
        if (next && current.metadata?.platform !== next.metadata?.platform) {
            hops.push({
                from: current.metadata?.platform,
                to: next.metadata?.platform,
                at: next.created_at
            });
        }
    }

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    <Link href="/agents" className="hover:text-slate-900 transition-colors">Agents</Link>
                    <ChevronRight className="w-3 h-3" />
                    <Link href={`/agents/${agentId}`} className="hover:text-slate-900 transition-colors uppercase">{agent.name}</Link>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-slate-900 uppercase">Trace: {traceId}</span>
                </div>

                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Map className="w-7 h-7 text-indigo-600" />
                        Cross-Platform Action Mapping
                    </h1>
                    <Link href={`/agents/${agentId}`}>
                        <Button variant="secondary" size="sm">Back to Agent</Button>
                    </Link>
                </div>
            </div>

            {/* Platform Traversal Map */}
            <Card className="p-8 bg-gradient-to-br from-white to-slate-50 border-slate-200">
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Environment Traversal Map</h2>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> Success Path
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" /> Cross-Platform Hop
                        </div>
                    </div>
                </div>

                <div className="relative flex justify-between items-center px-12">
                    {/* Connecting Line Backdrop */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-[45px]" />

                    {traceLogs.map((log, idx) => {
                        const isHop = idx > 0 && traceLogs[idx - 1].metadata?.platform !== log.metadata?.platform;
                        return (
                            <React.Fragment key={log.id}>
                                {isHop && (
                                    <div className="flex flex-col items-center animate-in zoom-in-50 duration-500 delay-200">
                                        <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-[9px] font-bold text-indigo-600 -mt-16 mb-4 shadow-sm">
                                            PLATFORM HOP
                                        </div>
                                        <ArrowRight className="w-6 h-6 text-indigo-400 animate-pulse" />
                                    </div>
                                )}
                                <div className="flex flex-col items-center group relative cursor-help">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${log.metadata?.status === 'BLOCKED'
                                            ? 'bg-rose-50 border-rose-400 text-rose-500 shadow-lg shadow-rose-100'
                                            : 'bg-white border-slate-200 text-slate-600 shadow-sm group-hover:border-indigo-500 group-hover:scale-110'
                                        }`}>
                                        <PlatformIcon platform={log.metadata?.platform} />
                                    </div>
                                    <div className="mt-3 text-center">
                                        <div className="text-[10px] font-bold uppercase text-slate-900 tracking-tight">{log.metadata?.platform}</div>
                                        <div className="text-[9px] font-medium text-slate-400">{log.metadata?.step}</div>
                                    </div>

                                    {/* Hover Details Card */}
                                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-64 bg-slate-900 text-white rounded-xl p-4 shadow-2xl opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-none translate-y-2 group-hover:translate-y-0">
                                        <div className="text-[10px] font-bold text-indigo-400 uppercase mb-2">Step Execution</div>
                                        <p className="text-[11px] leading-relaxed mb-3 italic">"{log.metadata?.message}"</p>
                                        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2 text-[9px]">
                                            <div className="flex items-center gap-1.5 text-slate-300">
                                                <Clock className="w-3 h-3" /> {log.metadata?.metrics?.duration_ms}ms
                                            </div>
                                            <div className="flex items-center gap-1.5 text-emerald-400">
                                                <DollarSign className="w-3 h-3" /> ${log.metadata?.metrics?.cost_usd}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </Card>

            {/* Detailed Hop Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1 p-5 border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-slate-400" />
                        Platform Transitions
                    </h3>
                    <div className="space-y-4">
                        {hops.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-8">No platform jumps detected in this trace.</p>
                        ) : hops.map((hop, i) => (
                            <div key={i} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase text-slate-400">Hop #{i + 1}</span>
                                    <span className="text-[9px] text-slate-400 font-mono">{new Date(hop.at).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200 text-xs font-bold text-slate-700">
                                        <PlatformIcon platform={hop.from} /> {hop.from}
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300" />
                                    <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 text-xs font-bold text-indigo-700">
                                        <PlatformIcon platform={hop.to} /> {hop.to}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="lg:col-span-2 p-5 border-slate-200 overflow-hidden">
                    <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Layout className="w-4 h-4 text-slate-400" />
                        Step-by-Step Context
                    </h3>
                    <div className="space-y-3">
                        {traceLogs.map((log, idx) => (
                            <div key={log.id} className="flex gap-4 p-4 hover:bg-slate-50 transition-colors border-b last:border-0 border-slate-100 group">
                                <div className="text-xs font-mono text-slate-400 pt-1">
                                    0{idx + 1}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900 uppercase">{log.metadata?.step}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                                                <PlatformIcon platform={log.metadata?.platform} /> {log.metadata?.platform}
                                            </span>
                                        </div>
                                        <StatusBadge status={log.metadata?.status === 'CLEAN' ? 'active' : 'blocked'} />
                                    </div>
                                    <p className="text-[13px] text-slate-600 leading-relaxed italic">
                                        "{log.metadata?.message}"
                                    </p>
                                    <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {log.metadata?.metrics?.duration_ms}ms</span>
                                        <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${log.metadata?.metrics?.cost_usd}</span>
                                        <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> {log.metadata?.ai_context?.model}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
