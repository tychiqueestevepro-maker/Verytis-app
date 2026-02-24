'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ChevronRight,
    ChevronDown,
    ShieldCheck,
    Server,
    AlertTriangle,
    FileText,
    Users,
    ShieldAlert,
    Globe,
    Settings,
    BarChart2,
    Trophy,
    DollarSign,
    Clock,
    CheckCircle2,
    Ban,
    Link as LinkIcon,
    Fingerprint,
    Cpu,
    Layers,
    RefreshCw,
    Bot,
    ExternalLink,
    Slack,
    Github,
    Database
} from 'lucide-react';
import { Card, Button, StatusBadge } from '@/components/ui';

import useSWR from 'swr';

const fetcher = (url) => fetch(url).then(r => r.json());

export default function AgentGovernancePage({ params }) {
    const router = useRouter();
    const [expandedRow, setExpandedRow] = useState(null);

    const { data, error, isLoading, mutate } = useSWR(`/api/agents/${params.agentId}`, fetcher);
    const agent = data?.agent;
    const logs = data?.logs || [];

    const agentName = agent ? agent.name : "Loading...";

    // Calculate dynamic stats based on logs
    const stats = {
        overrideRate: "0%",
        complianceIncidents: 0,
        blastRadius: "None",
        autonomyIndex: "100%",
        successRate: "100%",
        cost: "$0.00",
        velocity: "0ms"
    };

    if (logs.length > 0) {
        const total = logs.length;

        // 1. Override Rate: percentage of logs with a human actor_id (meaning human intervened/verified)
        const overridden = logs.filter(l => l.actor_id).length;
        stats.overrideRate = `${Math.round((overridden / total) * 100)}%`;

        // 2. Compliance Incidents: count of BLOCKED statuses in metadata
        stats.complianceIncidents = logs.filter(l => l.metadata?.status === 'BLOCKED').length;

        // 3. Autonomy Index: percentage of logs where NO human actor_id is present
        stats.autonomyIndex = `${Math.round(((total - overridden) / total) * 100)}%`;

        // 4. Success Rate: percentage of logs that are NOT BLOCKED
        const successCount = logs.filter(l => l.metadata?.status !== 'BLOCKED').length;
        stats.successRate = `${Math.round((successCount / total) * 100)}%`;

        // 5. Total Cost
        const totalCost = logs.reduce((sum, l) => sum + parseFloat(l.metadata?.metrics?.cost_usd || 0), 0);
        stats.cost = `$${totalCost.toFixed(3)}`;

        // 6. Avg Velocity (Duration)
        const totalDuration = logs.reduce((sum, l) => sum + parseInt(l.metadata?.metrics?.duration_ms || 0), 0);
        stats.velocity = `${Math.round(totalDuration / total)}ms`;

        // 7. Blast Radius: Targeted systems/actions
        const systems = [...new Set(logs.map(l => l.metadata?.step || l.action_type))].slice(0, 2);
        stats.blastRadius = systems.length > 0 ? systems.join(' & ') : "None";
    }

    const toggleRow = (id) => {
        if (expandedRow === id) {
            setExpandedRow(null);
        } else {
            setExpandedRow(id);
        }
    };

    const renderValidatorBadge = (log) => {
        if (log.actor_id) return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" />Verified by Human</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><Settings className="w-3 h-3" />AI Autonomous</span>;
    };

    if (isLoading) return <div className="p-12 text-center text-slate-500 font-medium">Loading Agent details...</div>;
    if (error || !agent) return <div className="p-12 text-center text-rose-500 font-medium">Error loading AI Agent. Make sure it exists.</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    <Link href="/agents" className="cursor-pointer hover:text-slate-900 transition-colors">Agents</Link>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-slate-900">{agentName}</span>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <ShieldCheck className="w-8 h-8 text-indigo-600" />
                            {agentName}
                        </h1>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" icon={FileText}>
                            Export Legal Audit Trail
                        </Button>
                        <Button
                            variant={agent.status === 'active' ? 'danger' : 'primary'}
                            icon={agent.status === 'active' ? ShieldAlert : CheckCircle2}
                            onClick={async () => {
                                if (confirm(`Are you sure you want to ${agent.status === 'active' ? 'SUSPEND' : 'ACTIVATE'} this agent?`)) {
                                    const res = await fetch(`/api/agents/${agent.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: agent.status === 'active' ? 'suspended' : 'active' })
                                    });
                                    if (res.ok) mutate();
                                }
                            }}
                        >
                            {agent.status === 'active' ? 'Suspend Agent (Kill Switch)' : 'Activate Agent'}
                        </Button>
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-4">
                    <span className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/80 border border-slate-200 px-2.5 py-1 rounded">
                        <Fingerprint className="w-3.5 h-3.5" />
                        Identity: Verified AI ({agent.id.substring(0, 8)})
                    </span>
                    <span className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/80 border border-slate-200 px-2.5 py-1 rounded">
                        <Server className="w-3.5 h-3.5" />
                        Storage: WORM Secured
                    </span>
                    <StatusBadge status={agent.status} />
                </div>
            </div>

            {/* Section Risk Controls */}
            <div className="pt-2">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-slate-700" />
                        Governance & Risk Controls
                    </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-3">
                            <Users className="w-4 h-4 text-amber-500" />
                            Human Override Rate
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{stats.overrideRate}</div>
                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Actions corrigées ou rejetées</p>
                        </div>
                    </Card>

                    <Card className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-3">
                            <Ban className="w-4 h-4 text-rose-500" />
                            Compliance Incidents
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{stats.complianceIncidents}</div>
                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Tentatives de bypass refusées</p>
                        </div>
                    </Card>

                    <Card className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-3">
                            <Globe className="w-4 h-4 text-indigo-500" />
                            Blast Radius
                        </div>
                        <div>
                            <div className="text-lg font-bold text-slate-900 truncate">{stats.blastRadius}</div>
                            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-wide">Applications impactées (30j)</p>
                        </div>
                    </Card>

                    <Card className="p-5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-3">
                            <Settings className="w-4 h-4 text-blue-500" />
                            Autonomy Index
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{stats.autonomyIndex}</div>
                            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide">Tasks approved without supervision</p>
                        </div>
                    </Card>
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
                        <div className="text-2xl font-bold text-slate-900">{stats.cost}</div>
                    </Card>

                    <Card className="p-5">
                        <div className="text-sm font-semibold text-slate-600 mb-3">Avg Latency</div>
                        <div className="text-2xl font-bold text-slate-900">{stats.velocity}</div>
                    </Card>
                </div>
            </div>

            {/* Activity Ledger */}
            <div className="pt-4 pb-12">
                <Card>
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/30">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <LinkIcon className="w-5 h-5 text-indigo-600" />
                            Immutable Activity Ledger
                        </h3>
                        <p className="text-xs font-medium text-slate-500 mt-1">
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
                                    <th className="px-6 py-3.5">Verification</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400 text-sm">
                                            No activity logs found for this agent.
                                        </td>
                                    </tr>
                                ) : logs.map((log) => (
                                    <React.Fragment key={log.id}>
                                        <tr
                                            className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                            onClick={() => router.push(`/agents/${params.agentId}/trace/${log.metadata?.trace_id}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    <ExternalLink className="w-4 h-4" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-500">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-[13px] text-slate-900 font-bold">
                                                <div className="flex items-center gap-2">
                                                    {log.metadata?.platform && (
                                                        <span className="p-1 px-1.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                                            {log.metadata.platform === 'slack' && <Slack className="w-3 h-3" />}
                                                            {log.metadata.platform === 'github' && <Github className="w-3 h-3" />}
                                                            {log.metadata.platform === 'internal_db' && <Database className="w-3 h-3" />}
                                                            {log.metadata.platform === 'agent_brain' && <Cpu className="w-3 h-3" />}
                                                        </span>
                                                    )}
                                                    {log.summary || log.action_type}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wide border ${log.metadata?.status === 'CLEAN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    log.metadata?.status === 'BLOCKED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                    {log.metadata?.status || 'VERIFIED'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {renderValidatorBadge(log)}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
