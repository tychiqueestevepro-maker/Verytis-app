'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { 
    BarChart2, 
    DollarSign, 
    Cpu, 
    Layers, 
    ShieldAlert, 
    Trophy, 
    Link as LinkIcon, 
    ExternalLink, 
    Database 
} from 'lucide-react';
import { Card } from '@/components/ui';

export default function TelemetryTab({ logs, agentId }) {
    const router = useRouter();

    // Calculate dynamic stats
    const stats = {
        totalSpend: "$0.00",
        totalTokens: 0,
        requests: 0,
        policyBlocks: 0,
        successRate: "100%",
        velocity: "0ms"
    };

    if (logs.length > 0) {
        const total = logs.length;
        stats.requests = total;
        const totalCost = logs.reduce((sum, l) => sum + parseFloat(l.metadata?.metrics?.cost_usd || 0), 0);
        stats.totalSpend = `$${totalCost.toFixed(3)}`;
        const totalTokensUsed = logs.reduce((sum, l) => sum + parseInt(l.metadata?.metrics?.tokens_used || 0), 0);
        stats.totalTokens = new Intl.NumberFormat().format(totalTokensUsed);
        stats.policyBlocks = logs.filter(l => l.metadata?.status === 'BLOCKED').length;
        const successCount = logs.filter(l => l.metadata?.status !== 'BLOCKED').length;
        stats.successRate = `${Math.round((successCount / total) * 100)}%`;
        const totalDuration = logs.reduce((sum, l) => sum + parseInt(l.metadata?.metrics?.duration_ms || 0), 0);
        stats.velocity = `${Math.round(totalDuration / total)}ms`;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Section FinOps & Usage */}
            <div className="pt-2">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-slate-700" />
                        FinOps & Usage Overview
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard title="Total Spend" value={stats.totalSpend} sub="Coût cumulé de l'agent" icon={DollarSign} color="emerald"Headline />
                    <StatCard title="Total Tokens" value={stats.totalTokens} sub="Jetons traités (in/out)" icon={Cpu} color="blue" />
                    <StatCard title="Requests / Prompts" value={stats.requests} sub="Invocations AI réussies" icon={Layers} color="sky" />
                    <StatCard title="Blocked Actions" value={stats.policyBlocks} sub="Tentatives bloquées par Verytis" icon={ShieldAlert} color="rose" />
                </div>
            </div>

            {/* Efficiency */}
            <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-slate-700" />
                        Efficiency & Performance
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="p-5">
                        <div className="text-sm font-semibold text-slate-600 mb-3">Success Rate</div>
                        <div className="text-2xl font-bold text-slate-900">{stats.successRate}</div>
                    </Card>
                    <Card className="p-5">
                        <div className="text-sm font-semibold text-slate-600 mb-3">Cost Analysis</div>
                        <div className="text-2xl font-bold text-slate-900">{stats.totalSpend}</div>
                    </Card>
                    <Card className="p-5">
                        <div className="text-sm font-semibold text-slate-600 mb-3">Avg Latency</div>
                        <div className="text-2xl font-bold text-slate-900">{stats.velocity}</div>
                    </Card>
                </div>
            </div>

            {/* Activity Ledger */}
            <div className="pt-4 pb-12">
                <Card className="border-l-4 border-l-blue-600 shadow-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-blue-50/20">
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tighter">
                            <LinkIcon className="w-5 h-5 text-blue-600" />
                            Activity Ledger
                        </h3>
                        <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest leading-tight">
                            Transparent audit trail of all agent operations.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-slate-400 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3.5 w-8"></th>
                                    <th className="px-6 py-3.5">Timestamp</th>
                                    <th className="px-6 py-3.5">Operation</th>
                                    <th className="px-6 py-3.5">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-slate-400 text-sm">
                                            No activity logs found for this agent.
                                        </td>
                                    </tr>
                                ) : logs.map((log) => (
                                    <tr 
                                        key={log.id} 
                                        className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                                        onClick={() => router.push(`/agents/${agentId}/trace/${log.metadata?.trace_id}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <ExternalLink className="w-4 h-4" />
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-[13px] text-slate-900 font-bold">
                                            <div className="flex items-center gap-2">
                                                {log.summary || log.action_type}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wide border ${
                                                log.metadata?.status === 'CLEAN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                log.metadata?.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                'bg-slate-50 text-slate-700 border-slate-200'
                                            }`}>
                                                {log.metadata?.status || 'VERIFIED'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ title, value, sub, icon: Icon, color }) {
    const colors = {
        emerald: "border-t-emerald-500 text-emerald-700",
        blue: "border-t-blue-500 text-blue-700",
        sky: "border-t-sky-500 text-sky-700",
        rose: "border-t-rose-500 text-rose-700"
    };
    
    return (
        <Card className={`p-5 flex flex-col justify-between border-t-4 ${colors[color]} shadow-md transition-transform hover:scale-[1.02]`}>
            <div className="flex items-center gap-2 text-sm font-black mb-3 uppercase tracking-tighter">
                <Icon className="w-4 h-4 opacity-70" />
                {title}
            </div>
            <div>
                <div className="text-2xl font-black text-slate-900">{value}</div>
                <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">{sub}</p>
            </div>
        </Card>
    );
}
