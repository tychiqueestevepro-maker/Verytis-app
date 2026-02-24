'use client';

import React, { memo } from 'react';
import { MousePointer2, Activity, Zap, Users, HelpCircle } from 'lucide-react';
import { Card } from '../ui';

const MetricGrid = ({ metrics }) => {
    const ADMIN_OPS_METRICS = [
        {
            label: "AI Agents",
            value: metrics.activeAgents || 0,
            trend: "Real-time",
            icon: MousePointer2,
            color: "text-blue-500",
            border: "border-t-blue-500",
            help: "Number of active AI monitoring agents."
        },
        {
            label: "Total Events",
            value: metrics.totalAuditedEvents || 0,
            trend: "Last 30d",
            icon: Activity,
            color: "text-emerald-500",
            border: "border-t-emerald-500",
            help: "Total audited activity logs across all integrations."
        },
        {
            label: "Autonomy Index",
            value: `${metrics.autonomyIndex || 0}%`,
            trend: "Systemic",
            icon: Zap,
            color: "text-amber-500",
            border: "border-t-amber-500",
            help: "Ratio of AI-driven actions vs human actions."
        },
        {
            label: "Monitored Users",
            value: metrics.monitoredUsers || 0,
            trend: "Identity",
            icon: Users,
            color: "text-indigo-500",
            border: "border-t-indigo-500",
            help: "Total verified profiles across the organization."
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ADMIN_OPS_METRICS.map((m, i) => (
                <Card key={i} className={`p-5 flex flex-col justify-between h-32 border-t-4 ${m.border}`} title={m.help}>
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">{m.label}</span>
                            <HelpCircle className="w-3 h-3 text-slate-300 hover:text-slate-500 cursor-help" />
                        </div>
                        <m.icon className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900 tracking-tight">{m.value}</div>
                        <div className="text-xs text-slate-400 mt-1 font-medium">Trend: <span className="text-slate-600">{m.trend}</span></div>
                    </div>
                </Card>
            ))}
        </div>
    );
};

export default memo(MetricGrid);
