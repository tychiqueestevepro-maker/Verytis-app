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
    const p = platform?.toLowerCase() || '';
    const getFavicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

    if (p === 'slack') return <img src={getFavicon('slack.com')} alt="Slack" className="w-6 h-6" />;
    if (p.includes('github')) return <img src={getFavicon('github.com')} alt="GitHub" className="w-6 h-6 inv-img" />;
    if (p === 'trello') return <img src={getFavicon('trello.com')} alt="Trello" className="w-6 h-6" />;
    if (p === 'shopify') return <img src={getFavicon('shopify.com')} alt="Shopify" className="w-6 h-6 transition-all hover:scale-110" />;
    if (p === 'stripe') return <img src={getFavicon('stripe.com')} alt="Stripe" className="w-6 h-6" />;
    if (p === 'google' || p.includes('workspace')) return <img src={getFavicon('workspace.google.com')} alt="Google" className="w-6 h-6" />;
    if (p === 'youtube') return <img src={getFavicon('youtube.com')} alt="YouTube" className="w-6 h-6" />;
    if (p === 'streamlabs') return <img src={getFavicon('streamlabs.com')} alt="Streamlabs" className="w-6 h-6" />;
    if (p === 'tiktok') return <img src={getFavicon('tiktok.com')} alt="TikTok" className="w-6 h-6" />;
    if (p === 'internal_db') return <Database className="w-6 h-6 text-blue-500" />;
    if (p === 'agent_brain' || p.includes('gateway')) return <Cpu className="w-6 h-6 text-blue-500" />;

    return <Zap className="w-6 h-6 text-amber-500 animate-pulse" />;
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
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
                        <Map className="w-8 h-8 text-blue-600" />
                        Cross-Platform Action Mapping
                    </h1>
                    <Link href={`/agents/${agentId}`}>
                        <Button variant="secondary" size="sm" className="font-bold border-blue-100 text-blue-700 bg-blue-50/50 hover:bg-blue-600 hover:text-white transition-all">
                            Back to Agent
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Platform Traversal Map */}
            <Card className="p-8 bg-gradient-to-br from-white to-slate-50 border-slate-200">
                <div className="flex items-center justify-between mb-10">
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        Environment Traversal Map
                    </h2>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" /> Success Path
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-200" /> Platform Hop
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
                                        <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[9px] font-black text-blue-600 -mt-16 mb-4 shadow-sm uppercase tracking-tighter">
                                            PLATFORM HOP
                                        </div>
                                        <ArrowRight className="w-6 h-6 text-blue-400 animate-pulse" />
                                    </div>
                                )}
                                <div className="flex flex-col items-center group relative cursor-help">
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-all duration-300 ${log.metadata?.status === 'BLOCKED'
                                            ? 'bg-rose-50 border-rose-400 text-rose-500 shadow-lg shadow-rose-100 animate-pulse'
                                            : 'bg-white border-slate-200 text-slate-600 shadow-sm group-hover:border-blue-500 group-hover:scale-110 group-hover:shadow-blue-100 group-hover:shadow-lg'
                                        }`}>
                                        <PlatformIcon platform={log.metadata?.platform} />
                                    </div>
                                    <div className="mt-3 text-center">
                                        <div className="text-[10px] font-bold uppercase text-slate-900 tracking-tight">{log.metadata?.platform}</div>
                                        <div className="text-[9px] font-medium text-slate-400">{log.metadata?.step}</div>
                                    </div>

                                    {/* Hover Details Card */}
                                    <div className="absolute top-24 left-1/2 -translate-x-1/2 w-72 bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-5 shadow-2xl opacity-0 group-hover:opacity-100 transition-all z-50 pointer-events-none translate-y-2 group-hover:translate-y-0 border border-white/10">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Step Execution</div>
                                            <StatusBadge status={log.metadata?.status === 'CLEAN' ? 'active' : 'rejected'} />
                                        </div>
                                        <p className="text-xs leading-relaxed mb-4 font-medium italic">"{log.metadata?.message || log.summary}"</p>
                                        <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[8px] font-black text-slate-500 uppercase">Duration</span>
                                                <div className="flex items-center gap-1.5 text-slate-300 text-[10px] font-bold">
                                                    <Clock className="w-3.5 h-3.5 text-blue-400" /> {log.metadata?.metrics?.duration_ms || '0'}ms
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[8px] font-black text-slate-500 uppercase">Cost (USD)</span>
                                                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black">
                                                    <DollarSign className="w-3.5 h-3.5" /> ${parseFloat(log.metadata?.metrics?.cost_usd || 0).toFixed(4)}
                                                </div>
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
                <Card className="lg:col-span-1 p-6 border-slate-200 border-l-4 border-l-blue-600 shadow-lg">
                    <h3 className="text-base font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">
                        <Terminal className="w-5 h-5 text-blue-600" />
                        Platform Transitions
                    </h3>
                    <div className="space-y-4">
                        {hops.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                                <Box className="w-12 h-12 text-slate-300 mb-2" />
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No jumps detected</p>
                            </div>
                        ) : hops.map((hop, i) => (
                            <div key={i} className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase text-blue-500 tracking-widest">Hop #{i + 1}</span>
                                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-full">{new Date(hop.at).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 flex items-center gap-2.5 bg-slate-50/50 px-3 py-2 rounded-xl border border-slate-200/50 text-xs font-black text-slate-800">
                                        <PlatformIcon platform={hop.from} /> {hop.from}
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-blue-400 animate-pulse" />
                                    <div className="flex-1 flex items-center gap-2.5 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 text-xs font-black text-blue-700">
                                        <PlatformIcon platform={hop.to} /> {hop.to}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="lg:col-span-2 p-6 border-slate-200 overflow-hidden shadow-lg border-l-4 border-l-emerald-500">
                    <h3 className="text-base font-black text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tighter">
                        <Layout className="w-5 h-5 text-emerald-600" />
                        Step-by-Step Context
                    </h3>
                    <div className="space-y-4">
                        {traceLogs.map((log, idx) => (
                            <div key={log.id} className={`flex gap-5 p-5 transition-all border rounded-2xl ${log.metadata?.status === 'BLOCKED' ? 'bg-rose-50/50 border-rose-100 ring-4 ring-rose-500/5' : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'} relative group`}>
                                <div className="flex flex-col items-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${log.metadata?.status === 'BLOCKED' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white'} shadow-lg`}>
                                        {idx + 1}
                                    </div>
                                    {idx < traceLogs.length - 1 && <div className="w-0.5 grow mt-2 bg-slate-100" />}
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.metadata?.step}</span>
                                            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-100 text-[10px] font-black text-slate-600 uppercase flex items-center gap-2 shadow-sm">
                                                <PlatformIcon platform={log.metadata?.platform} /> {log.metadata?.platform}
                                            </span>
                                        </div>
                                        <StatusBadge status={log.metadata?.status === 'CLEAN' ? 'active' : 'rejected'} />
                                    </div>
                                    <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                        <p className="text-[13px] text-slate-700 font-medium leading-relaxed italic">
                                            "{log.metadata?.message || log.summary}"
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6 pt-1">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 rounded bg-blue-50 text-blue-600"><Clock className="w-3 h-3" /></div>
                                            <span className="text-[10px] font-black text-slate-600 uppercase">{log.metadata?.metrics?.duration_ms || '0'}ms</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 rounded bg-emerald-50 text-emerald-600"><DollarSign className="w-3 h-3" /></div>
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">${parseFloat(log.metadata?.metrics?.cost_usd || 0).toFixed(4)}</span>
                                        </div>
                                        {log.metadata?.ai_context?.model && (
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 rounded bg-slate-100 text-slate-600"><Terminal className="w-3 h-3" /></div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{log.metadata.ai_context.model}</span>
                                            </div>
                                        )}
                                        {log.metadata?.status === 'BLOCKED' && (
                                            <div className="ml-auto flex items-center gap-2 bg-rose-100 px-3 py-1 rounded-full animate-pulse border border-rose-200">
                                                <Zap className="w-3 h-3 text-rose-600 fill-current" />
                                                <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Error & Retry Needed</span>
                                            </div>
                                        )}
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
