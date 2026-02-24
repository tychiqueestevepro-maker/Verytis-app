'use client';

import { useState } from 'react';
import {
    Activity, AlertCircle, AlertTriangle, ArrowUpRight, Clock, Download,
    FileText, Mail, MessageSquare, Shield, Zap, Hash,
    TrendingUp, Flame, Trophy, UserCheck, UserX, BarChart3, Users, HelpCircle, Info, ChevronDown, CheckCircle, Lock, MousePointer2, RefreshCw, Check
} from 'lucide-react';
import { Card, Button, DashboardEmptyState } from '../ui';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

const AdminDashboard = () => {
    const { data: dashboardData, isLoading: dashboardLoading } = useSWR('/api/dashboard', fetcher);
    const { data: teamsData, isLoading: teamsLoading } = useSWR('/api/teams', fetcher);
    const { data: resourcesData, isLoading: resourcesLoading } = useSWR('/api/resources/list', fetcher);

    const [selectedTeam, setSelectedTeam] = useState('all');
    const [selectedChannel, setSelectedChannel] = useState('all');
    const [activeDropdown, setActiveDropdown] = useState(null);

    if (dashboardLoading || teamsLoading || resourcesLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-slate-500 text-sm font-medium">Synchronizing live audit data...</p>
            </div>
        );
    }

    // Filter Logic
    const availableTeams = [
        { id: 'all', name: 'All Teams' },
        ...(teamsData?.teams || [])
    ];

    const allChannels = resourcesData?.resources || [];
    const availableChannels = selectedTeam === 'all'
        ? allChannels
        : allChannels.filter(c => c.teamId === selectedTeam);

    const metrics = dashboardData?.metrics || {};
    const isFiltered = selectedTeam !== 'all' || selectedChannel !== 'all';

    // 1. Global Operational Performance (Real Data + Fallbacks)
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

    // 2. Engagement Data (Derived from Teams)
    const TOP_TEAMS = (teamsData?.teams || []).slice(0, 5).map(t => ({
        name: t.name,
        actions: t.stats?.total_actions || 0,
        delay: t.stats?.avg_cycle_time || "N/A"
    }));

    // 3. Structural Alerts (Mocked for now, but scoped)
    const STRUCTURAL_ALERTS = dashboardData?.alerts || [];

    // 5. Quick Wins
    const QUICK_WINS = [
        "System operational with 100% traceability",
        `${metrics.totalAuditedEvents || 0} events captured in the last 30 days`,
        `${metrics.activeAgents || 0} AI agents active and monitoring`
    ];

    // Get the currently selected team object for display
    const currentTeam = selectedTeam !== 'all'
        ? availableTeams.find(t => t.id === selectedTeam)
        : null;

    // --- TEAM DASHBOARD VIEW (Manager-style) ---
    if (currentTeam) {
        // Team-specific KPIs (simulated)
        const TEAM_METRICS = [
            { label: "Total Ships", value: availableChannels.reduce((sum, c) => sum + c.decisions, 0), trend: "+8%", icon: Activity, color: "text-emerald-500", border: "border-t-emerald-500" },
            { label: "Avg Validation Time", value: selectedTeam === '1' ? "2.1h" : "3.5h", trend: "-20m", icon: Clock, color: "text-blue-500", border: "border-t-blue-500" },
            { label: "Pending Actions", value: Math.ceil(availableChannels.reduce((sum, c) => sum + c.decisions, 0) * 0.08), trend: "-2", icon: AlertCircle, color: "text-amber-500", border: "border-t-amber-500" },
            { label: "Loop Closure", value: "96%", trend: "Stable", icon: RefreshCw, color: "text-blue-500", border: "border-t-blue-500" }
        ];

        // Team-specific Alerts
        const TEAM_ALERTS = STRUCTURAL_ALERTS.filter(a => currentTeam.name.includes(a.source) || a.source === 'Marketing' || a.source === 'Legal');

        // Team-specific Quick Wins
        const TEAM_WINS = [
            `${currentTeam.name} resolved 5 blockers in under 6h`,
            `Channel sync improved by 15% this week`,
            `All pending reviews closed within SLA`
        ];

        return (
            <div className="space-y-8 animate-in fade-in duration-300">
                <header className="flex justify-between items-end pb-4 border-b border-slate-200/60 transition-all duration-300">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{currentTeam.name}</h1>
                        <p className="text-slate-500 mt-1 text-xs font-medium flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Team View • {availableChannels.length} Channels • Last synced 1 min ago
                        </p>
                    </div>
                    <div className="flex gap-2 items-center relative z-20">
                        {/* Team Filter */}
                        <div className="relative">
                            {activeDropdown === 'team' && <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />}
                            <button
                                onClick={() => setActiveDropdown(activeDropdown === 'team' ? null : 'team')}
                                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm hover:bg-slate-50 transition-all min-w-[140px] justify-between z-40 relative"
                            >
                                <span className="truncate">{availableTeams.find(t => t.id.toString() === selectedTeam.toString())?.name || 'All Teams'}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeDropdown === 'team' ? 'rotate-180' : ''}`} />
                            </button>

                            {activeDropdown === 'team' && (
                                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200 max-h-64 overflow-y-auto">
                                    {availableTeams.map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                setSelectedTeam(t.id);
                                                setSelectedChannel('all');
                                                setActiveDropdown(null);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedTeam.toString() === t.id.toString() ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                        >
                                            {t.name}
                                            {selectedTeam.toString() === t.id.toString() && <Check className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Channel Filter */}
                        <div className="relative">
                            {activeDropdown === 'channel' && <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />}
                            <button
                                onClick={() => setActiveDropdown(activeDropdown === 'channel' ? null : 'channel')}
                                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm hover:bg-slate-50 transition-all min-w-[140px] justify-between z-40 relative"
                            >
                                <span className="truncate">{selectedChannel === 'all' ? 'All Channels' : availableChannels.find(c => c.id.toString() === selectedChannel.toString())?.name || 'All Channels'}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeDropdown === 'channel' ? 'rotate-180' : ''}`} />
                            </button>

                            {activeDropdown === 'channel' && (
                                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200 max-h-64 overflow-y-auto">
                                    <button
                                        onClick={() => { setSelectedChannel('all'); setActiveDropdown(null); }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedChannel === 'all' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                    >
                                        All Channels
                                        {selectedChannel === 'all' && <Check className="w-3 h-3" />}
                                    </button>
                                    {availableChannels.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedChannel(c.id);
                                                setActiveDropdown(null);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedChannel.toString() === c.id.toString() ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                        >
                                            {c.name}
                                            {selectedChannel.toString() === c.id.toString() && <Check className="w-3 h-3" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button variant="secondary" icon={Download}>Team Report</Button>
                    </div>
                </header>

                {/* Team KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {TEAM_METRICS.map((m, i) => (
                        <Card key={i} className={`p-5 flex flex-col justify-between h-32 border-t-4 ${m.border}`}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">{m.label}</span>
                                <m.icon className={`w-4 h-4 ${m.color}`} />
                            </div>
                            <div>
                                <div className="text-3xl font-bold text-slate-900 tracking-tight">{m.value}</div>
                                <div className="text-xs text-slate-400 mt-1 font-medium">Trend: <span className="text-slate-600">{m.trend}</span></div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Team Velocity Chart & Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Velocity Chart */}
                    <Card className="p-5 flex flex-col h-64">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-blue-500" />
                                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Shipping Velocity (Team Trend)</h3>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1 leading-tight">Total items shipped by {currentTeam.name}.</p>
                            </div>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium h-fit">This Week</span>
                        </div>
                        <div className="flex-1 flex items-end justify-between px-2 gap-3 h-36">
                            {[25, 40, 20, 55, 65, 35, 50].map((h, i) => (
                                <div key={i} className="flex flex-col items-center gap-1 flex-1 group cursor-pointer h-full justify-end">
                                    <div className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">{h}</div>
                                    <div
                                        className="w-full max-w-8 bg-blue-200 hover:bg-blue-500 rounded-t transition-all duration-300 group-hover:shadow-lg"
                                        style={{ height: `${h}%`, minHeight: '4px' }}
                                    ></div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-1">D{i + 1}</div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Team Alerts */}
                    <Card className="p-0 overflow-hidden flex flex-col">
                        <div className="px-5 py-3 border-b border-slate-100 bg-rose-50/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-700" />
                                <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide">Team Alerts</h3>
                            </div>
                            <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded">{TEAM_ALERTS.length} Open</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {TEAM_ALERTS.length > 0 ? TEAM_ALERTS.map((alert) => (
                                <div key={alert.id} className="p-3 hover:bg-slate-50 transition-colors group cursor-pointer">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                            <span className="text-xs font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{alert.text}</span>
                                        </div>
                                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{alert.source}</span>
                                    </div>
                                </div>
                            )) : (
                                <DashboardEmptyState
                                    title="No Active Alerts"
                                    description="This team is currently operating within normal parameters. No structural friction detected."
                                    icon={Shield}
                                />
                            )}
                        </div>
                    </Card>
                </div>

                {/* Team Quick Wins */}
                <Card className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-5 shadow-lg border-none relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Trophy className="w-24 h-24" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-wide text-amber-300 mb-3 flex items-center gap-2">
                        <Trophy className="w-4 h-4" /> Team Highlights
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {TEAM_WINS.map((win, i) => (
                            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10 flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                <p className="text-xs font-medium leading-relaxed opacity-90">{win}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        );
    }

    // --- ADMIN/EXECUTIVE OVERVIEW (Global View) ---
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <header className="flex justify-between items-end pb-4 border-b border-slate-200/60 transition-all duration-300">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Executive Overview</h1>
                    <p className="text-slate-500 mt-1 text-xs font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        System Operational • Global Admin View • Last synced 1 min ago
                    </p>
                </div>
                <div className="flex gap-2 items-center relative z-20">
                    {/* Team Filter */}
                    <div className="relative">
                        {activeDropdown === 'team' && <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />}
                        <button
                            onClick={() => setActiveDropdown(activeDropdown === 'team' ? null : 'team')}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm hover:bg-slate-50 transition-all min-w-[140px] justify-between z-40 relative"
                        >
                            <span className="truncate">{availableTeams.find(t => t.id.toString() === selectedTeam.toString())?.name || 'All Teams'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeDropdown === 'team' ? 'rotate-180' : ''}`} />
                        </button>

                        {activeDropdown === 'team' && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200 max-h-64 overflow-y-auto">
                                {availableTeams.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            setSelectedTeam(t.id);
                                            setSelectedChannel('all');
                                            setActiveDropdown(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedTeam.toString() === t.id.toString() ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                    >
                                        {t.name}
                                        {selectedTeam.toString() === t.id.toString() && <Check className="w-3 h-3" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Channel Filter (Conditional) */}
                    <div className={`relative transition-opacity duration-200 ${selectedTeam === 'all' ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'}`}>
                        {activeDropdown === 'channel' && <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />}
                        <button
                            disabled={selectedTeam === 'all'}
                            onClick={() => setActiveDropdown(activeDropdown === 'channel' ? null : 'channel')}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm hover:bg-slate-50 transition-all min-w-[140px] justify-between z-40 relative"
                        >
                            <span className="truncate">{selectedChannel === 'all' ? 'All Channels' : availableChannels.find(c => c.id.toString() === selectedChannel.toString())?.name || 'All Channels'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeDropdown === 'channel' ? 'rotate-180' : ''}`} />
                        </button>

                        {activeDropdown === 'channel' && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200 max-h-64 overflow-y-auto">
                                <button
                                    onClick={() => { setSelectedChannel('all'); setActiveDropdown(null); }}
                                    className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedChannel === 'all' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                >
                                    All Channels
                                    {selectedChannel === 'all' && <Check className="w-3 h-3" />}
                                </button>
                                {availableChannels.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            setSelectedChannel(c.id);
                                            setActiveDropdown(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedChannel.toString() === c.id.toString() ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                    >
                                        {c.name}
                                        {selectedChannel.toString() === c.id.toString() && <Check className="w-3 h-3" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button variant="secondary" icon={Download}>Global Report</Button>
                </div>
            </header>

            {/* SECTION 1: Operational Performance (Admin Level) */}
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

            {/* SECTION 2: Engagement Mapping */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Top Teams - Productivity Based */}
                <Card className="p-0 overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Top Shipping Teams</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {TOP_TEAMS.map((team, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                                    <span className="text-xs font-bold text-slate-800">{team.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-slate-900">{team.actions} <span className="text-[9px] font-normal text-slate-400">ships</span></div>
                                    <div className="text-[9px] text-slate-400">Avg cycle: {team.delay}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Interaction Types Chart (Simulated) */}
                <Card className="p-5 flex flex-col justify-center items-center relative">
                    <div className="absolute top-4 left-5 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Interaction Types</h3>
                    </div>
                    {/* CSS Donut Chart */}
                    <div className="w-32 h-32 rounded-full border-[12px] border-blue-500 border-r-emerald-400 border-b-amber-400 border-l-rose-400 transform rotate-45 flex items-center justify-center shadow-sm">
                        <div className="text-center transform -rotate-45">
                            <div className="text-xl font-bold text-slate-900">1.2k</div>
                            <div className="text-[9px] text-slate-400 uppercase">Total</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 w-full px-4">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-[10px] text-slate-600">Ships (40%)</span></div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div><span className="text-[10px] text-slate-600">Update (25%)</span></div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400"></div><span className="text-[10px] text-slate-600">Request (20%)</span></div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-400"></div><span className="text-[10px] text-slate-600">Escalation (15%)</span></div>
                    </div>
                </Card>

                {/* Heatmap (Compact) */}
                <Card className="p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <Flame className="w-4 h-4 text-rose-500" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Friction Heatmap</h3>
                    </div>
                    <div className="flex-1 flex flex-col gap-1 justify-center">
                        <div className="flex justify-between text-[8px] text-slate-400 px-1 font-mono uppercase mb-1">
                            <span>Morn</span><span>Noon</span><span>Eve</span>
                        </div>
                        {['M', 'T', 'W', 'T', 'F'].map((day, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-400 w-3">{day}</span>
                                <div className="flex-1 grid grid-cols-12 gap-0.5 h-4">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className={`rounded-[1px] ${Math.random() > 0.7 ? 'bg-rose-500' : Math.random() > 0.5 ? 'bg-amber-400' : 'bg-slate-100'}`}></div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* SECTION 3 & 4: Alerts & Compliance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Structural Alerts */}
                <Card className="p-0 overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-slate-100 bg-rose-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-700" />
                            <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide">Structural Friction Points</h3>
                        </div>
                        <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded">4 Critical</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {STRUCTURAL_ALERTS.map((alert) => (
                            <div key={alert.id} className="p-3 hover:bg-slate-50 transition-colors group cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                                        <span className="text-xs font-medium text-slate-800 group-hover:text-blue-600 transition-colors">{alert.text}</span>
                                    </div>
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{alert.source}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Compliance & Governance */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="p-4 flex flex-col items-center justify-center border-l-4 border-l-emerald-500">
                        <Shield className="w-6 h-6 text-emerald-500 mb-2" />
                        <div className="text-2xl font-bold text-slate-900">{metrics.traceabilityScore || 100}%</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">Rule Compliance</div>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center border-l-4 border-l-blue-500">
                        <CheckCircle className="w-6 h-6 text-blue-500 mb-2" />
                        <div className="text-2xl font-bold text-slate-900">{metrics.traceabilityScore || 0}%</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">Traceability Rate</div>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center border-l-4 border-l-amber-500">
                        <Lock className="w-6 h-6 text-amber-500 mb-2" />
                        <div className="text-2xl font-bold text-slate-900">{metrics.totalAuditedEvents || 0}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">Total Audit Logs</div>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center border-l-4 border-l-indigo-500">
                        <MousePointer2 className="w-6 h-6 text-indigo-500 mb-2" />
                        <div className="text-lg font-bold text-slate-900">Auto: {metrics.autonomyIndex || 0}%</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">AI Autonomy</div>
                    </Card>
                </div>
            </div>

            {/* SECTION 5: Quick Wins */}
            <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 shadow-lg border-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Trophy className="w-24 h-24" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-amber-300 mb-3 flex items-center gap-2">
                    <Trophy className="w-4 h-4" /> Quick Wins & Momentum
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {QUICK_WINS.map((win, i) => (
                        <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/10 flex items-start gap-3">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-xs font-medium leading-relaxed opacity-90">{win}</p>
                        </div>
                    ))}
                </div>
            </Card>
        </div >
    );
};

const Dashboard = ({ userRole }) => {
    const [selectedChannel, setSelectedChannel] = useState('all');
    const [activeDropdown, setActiveDropdown] = useState(null);

    if (userRole === 'Admin') {
        return <AdminDashboard />;
    }


    // Filter Logic
    const getManagerTeams = () => ['Engineering', 'Engineering & Product', 'Product']; // Simulate Manager managing these

    const availableChannels = userRole === 'Admin'
        ? MOCK_CHANNELS
        : MOCK_CHANNELS.filter(c => getManagerTeams().some(t => c.team.includes(t) || c.name.includes('product')));

    const currentChannel = selectedChannel === 'all'
        ? null
        : availableChannels.find(c => c.id === parseInt(selectedChannel));

    // Calculate aggregations
    const calculateAggregates = (channels) => {
        const totalDecisions = channels.reduce((sum, c) => sum + c.decisions, 0);
        return {
            decisions: totalDecisions,
            avgValidationTime: '3.1h', // Weighted average simulation
            pending: Math.ceil(totalDecisions * 0.08),
            orphaned: Math.floor(totalDecisions * 0.01)
        };
    };

    const teamAggregates = calculateAggregates(availableChannels);

    const displayMetrics = currentChannel ? {
        decisions: currentChannel.decisions,
        avgTime: '2.5h', // Mock specific
        pending: Math.floor(currentChannel.decisions * 0.12),
        orphaned: 0
    } : (userRole === 'Admin' ? {
        decisions: MOCK_DECISION_METRICS.last7Days,
        avgTime: MOCK_DECISION_METRICS.avgValidationTime,
        pending: MOCK_DECISION_METRICS.pendingReview,
        orphaned: MOCK_DECISION_METRICS.withoutOwner
    } : {
        decisions: teamAggregates.decisions,
        avgTime: teamAggregates.avgValidationTime,
        pending: teamAggregates.pending,
        orphaned: teamAggregates.orphaned
    });

    // Mock Data for New Features
    // --- OPERATIONAL MOCK DATA (Hard KPIs) ---
    const OPS_METRICS = currentChannel ? {
        ghostWork: '8%',
        cycleTime: '1.2d',
        rework: '5%',
        staleBranches: 1
    } : {
        ghostWork: '14%', // Aggregated
        cycleTime: '2.4d',
        rework: '12%',
        staleBranches: 7
    };

    const ALL_PERFORMANCE = [
        { name: "Elena Ross", metric: "0.8d Cycle", type: "top", label: "Fastest Shipper" },
        { name: "Sarah Connor", metric: "98% Ticket Link", type: "top", label: "Process Hero" },
        { name: "Mike Ross", metric: "35% Ghost Work", type: "blocker", label: "Rogue Coder" },
    ];

    const ALL_STORIES = [
        { id: 1, text: "Elena merged 'Auth Fix' (2h cycle)", time: "10:30 AM", channel: "#engineering" },
        { id: 2, text: "David pushed 5 commits without ticket", time: "Yesterday", channel: "#backend-dev" },
        { id: 3, text: "Product Roadmap v2 deployed", time: "2 days ago", channel: "#releases", team: "Engineering" },
    ];

    const ALL_ALERTS = [
        { id: 1, type: "high", text: "Recurrent friction in #legal-approvals", metric: "5 delays", channel: "#legal-approvals" },
        { id: 2, type: "medium", text: "Abnormal validation time > 4h", metric: "#engineering", channel: "#engineering" },
        { id: 3, type: "medium", text: "Specs validation pending > 48h", metric: "#product-roadmap", channel: "#product-roadmap" },
    ];

    // Apply Filters
    // 1. Filter by Scope (what user is ALLOWED to see)
    // 2. Filter by Selection (what user WANTS to see)

    const filterByScopeAndSelection = (items) => {
        return items.filter(item => {
            // First check if item belongs to an available channel/team
            const isInScope = availableChannels.some(c =>
                (item.channel && (c.name.includes(item.channel) || item.channel.includes(c.name))) ||
                (item.team && c.team.includes(item.team)) ||
                (userRole === 'Admin') // Admin sees everything by default if not strictly matched
            );

            if (!isInScope) return false;

            // Then check specific selection
            if (currentChannel) {
                return (item.channel && item.channel.includes(currentChannel.name)) ||
                    (item.text && item.text.includes(currentChannel.name));
            }
            return true;
        });
    };

    const filteredStories = filterByScopeAndSelection(ALL_STORIES);
    const filteredAlerts = filterByScopeAndSelection(ALL_ALERTS);
    const filteredPerformance = ALL_PERFORMANCE; // Performance might eventually need similar filtering

    const velocityData = currentChannel
        ? [15, 25, 10, 30, 45, 20, 35]
        : (userRole === 'Manager' ? [20, 30, 15, 40, 50, 25, 40] : [35, 45, 30, 60, 75, 50, 65]);

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <header className="flex justify-between items-end pb-4 border-b border-slate-200/60 transition-all duration-300">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 mt-1 text-xs font-medium flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        System Operational • {userRole === 'Manager' ? 'Team View' : 'Global View'} • {currentChannel ? `Channel: ${currentChannel.name}` : 'All Channels'}
                    </p>
                </div>
                <div className="flex gap-2 items-center relative z-20">
                    {/* Channel Filter */}
                    <div className="relative">
                        {activeDropdown === 'channel' && <div className="fixed inset-0 z-30" onClick={() => setActiveDropdown(null)} />}
                        <button
                            onClick={() => setActiveDropdown(activeDropdown === 'channel' ? null : 'channel')}
                            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm hover:bg-slate-50 transition-all min-w-[140px] justify-between z-40 relative"
                        >
                            <span className="truncate">{selectedChannel === 'all' ? 'All Channels' : availableChannels.find(c => c.id.toString() === selectedChannel.toString())?.name || 'All Channels'}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${activeDropdown === 'channel' ? 'rotate-180' : ''}`} />
                        </button>

                        {activeDropdown === 'channel' && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200 max-h-64 overflow-y-auto">
                                <button
                                    onClick={() => { setSelectedChannel('all'); setActiveDropdown(null); }}
                                    className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedChannel === 'all' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                >
                                    All Channels
                                    {selectedChannel === 'all' && <Check className="w-3 h-3" />}
                                </button>
                                {availableChannels.map(channel => (
                                    <button
                                        key={channel.id}
                                        onClick={() => {
                                            setSelectedChannel(channel.id);
                                            setActiveDropdown(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${selectedChannel.toString() === channel.id.toString() ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                                    >
                                        {channel.name}
                                        {selectedChannel.toString() === channel.id.toString() && <Check className="w-3 h-3" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <Button variant="secondary" icon={Download}>Report</Button>
                </div>
            </header>

            {/* Row 1: OPERATIONAL & EFFICIENCY KPIs (The "Hard" Numbers) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: Ghost Work */}
                <Card className="p-5 flex flex-col justify-between h-32 border-t-4 border-t-rose-500 bg-rose-50/10" title="% of Commits/PRs not linked to a Trello Card.">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase text-rose-600 tracking-wide">Ghost Work Ratio</span>
                            <HelpCircle className="w-3 h-3 text-rose-400 hover:text-rose-600 cursor-help" title="Work performed without a ticket. High ratio = Hidden costs & lack of visibility." />
                        </div>
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900 tracking-tight">{OPS_METRICS.ghostWork}</div>
                        <div className="text-xs text-rose-600 mt-1 font-medium flex items-center gap-1">
                            Untracked activity detected
                        </div>
                    </div>
                </Card>

                {/* KPI 2: Cycle Time */}
                <Card className="p-5 flex flex-col justify-between h-32 border-t-4 border-t-blue-500" title="Average time from First Commit to Production Deploy.">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">Avg Cycle Time</span>
                            <HelpCircle className="w-3 h-3 text-slate-300 hover:text-slate-500 cursor-help" title="Speed of delivery. Lower is better." />
                        </div>
                        <Zap className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900 tracking-tight">{OPS_METRICS.cycleTime}</div>
                        <div className="text-xs text-slate-500 mt-1 font-medium">Idea to Production</div>
                    </div>
                </Card>

                {/* KPI 3: Rework / Churn */}
                <Card className="p-5 flex flex-col justify-between h-32 border-t-4 border-t-amber-500" title="% of code rewritten within 24h of merge.">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase text-amber-600 tracking-wide">Code Churn / Rework</span>
                            <HelpCircle className="w-3 h-3 text-amber-400 hover:text-amber-600 cursor-help" title="High churn indicates unclear specs or poor quality." />
                        </div>
                        <RefreshCw className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900 tracking-tight">{OPS_METRICS.rework}</div>
                        <div className="text-xs text-amber-600 mt-1 font-medium">Re-written post-merge</div>
                    </div>
                </Card>

                {/* KPI 4: Stale Branches */}
                <Card className="p-5 flex flex-col justify-between h-32 border-t-4 border-t-indigo-500" title="Open branches with no activity over 7 days.">
                    <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wide">Stale Branches</span>
                            <HelpCircle className="w-3 h-3 text-slate-300 hover:text-slate-500 cursor-help" title="Abandoned work or blocked features cluttering the repo." />
                        </div>
                        <Hash className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                        <div className="text-3xl font-bold text-slate-900 tracking-tight">{OPS_METRICS.staleBranches}</div>
                        <div className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
                            Inactive {'>'} 7 days
                        </div>
                    </div>
                </Card>
            </div>

            {/* Row 2: Charts & Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Evolution Curve */}
                <Card className="lg:col-span-2 p-5 flex flex-col h-64">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-500" />
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Productivity Velocity (Tickets vs Commits)</h3>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">Code output normalized against project tickets.</p>
                        </div>
                        <div className="flex gap-2">
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium h-fit">This Week</span>
                        </div>
                    </div>
                    <div className="flex-1 flex items-end justify-between px-2 gap-3 h-36">
                        {/* Simulated Bar Chart with CSS */}
                        {velocityData.map((h, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1 group cursor-pointer h-full justify-end">
                                <div className="text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">{h}</div>
                                <div
                                    className="w-full max-w-8 bg-blue-200 hover:bg-blue-500 rounded-t transition-all duration-300 group-hover:shadow-lg"
                                    style={{ height: `${h}%`, minHeight: '4px' }}
                                ></div>
                                <div className="text-[10px] text-slate-400 font-mono mt-1">D{i + 1}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Heatmap (Friction) */}
                <Card className="p-5 flex flex-col h-64">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Activity Heatmap</h3>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight max-w-xs">Visual overview of commit frequency and code pushes during the week.</p>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col gap-1 justify-center">
                        <div className="flex justify-between text-[9px] text-slate-400 px-1 font-mono uppercase">
                            <span>Morning</span>
                            <span>Noon</span>
                            <span>Evening</span>
                        </div>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                            <div key={day} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 w-6">{day}</span>
                                <div className="flex-1 grid grid-cols-12 gap-0.5 h-6">
                                    {[...Array(12)].map((_, i) => {
                                        // Randomize intensity for demo
                                        const intensity = Math.random();
                                        const colorClass = intensity > 0.8 ? 'bg-rose-500' : intensity > 0.6 ? 'bg-amber-400' : 'bg-slate-100';
                                        return <div key={i} className={`rounded-sm ${colorClass} hover:opacity-80 transition-opacity`} title="Activity Level"></div>
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Row 3: Insights & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Active Alerts */}
                <Card className="p-0 overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-slate-100 bg-rose-50/30 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-700" />
                                <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide">Active Alerts</h3>
                            </div>
                            <p className="text-[10px] text-rose-600/80 mt-1 leading-tight">Real-time notifications of abnormal delays requiring attention.</p>
                        </div>
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">{filteredAlerts.length} New</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {filteredAlerts.length > 0 ? (
                            filteredAlerts.map(alert => (
                                <div key={alert.id} className="p-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${alert.type === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>{alert.type}</span>
                                        <span className="text-[10px] font-mono text-slate-400">{alert.metric}</span>
                                    </div>
                                    <p className="text-xs font-medium text-slate-800 mt-1">{alert.text}</p>
                                </div>
                            ))
                        ) : (
                            <DashboardEmptyState
                                title="All Quiet"
                                description="No real-time anomalies detected. Your systems are performing as expected."
                                icon={CheckCircle}
                            />
                        )}
                    </div>
                </Card>

                {/* Performance Radar */}
                <Card className="p-0 overflow-hidden flex flex-col">
                    <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500" />
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Team Performance</h3>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">Tracks average response times to identify bottlenecks.</p>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {filteredPerformance.map((user, idx) => (
                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`p-1.5 rounded-full ${user.type === 'top' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                        {user.type === 'top' ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-900">{user.name}</div>
                                        <div className="text-[10px] text-slate-500">{user.label}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold font-mono text-slate-800">{user.metric}</div>
                                    <div className="text-[9px] text-slate-400 uppercase">Avg Time</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Success Stories */}
                <Card className="p-0 overflow-hidden flex flex-col bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
                    <div className="px-5 py-3 border-b border-blue-400/30 flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-amber-300" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wide">Success Spotlight</h3>
                            </div>
                            <p className="text-[10px] text-blue-100 mt-1 leading-tight">Highlighting quick wins and resolved blockers.</p>
                        </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col gap-4">
                        {filteredStories.length > 0 ? (
                            filteredStories.map(story => (
                                <div key={story.id} className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors cursor-pointer">
                                    <p className="text-sm font-medium leading-relaxed">
                                        "{story.text}"
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 opacity-70">
                                        <Clock className="w-3 h-3" />
                                        <span className="text-[10px]">{story.time}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <DashboardEmptyState
                                title="No Spotlight Stories"
                                description="Once your teams start resolving blockers and shipping features, highlights will appear here."
                                icon={Trophy}
                                className="text-blue-100"
                            />
                        )}
                        <Button variant="secondary" className="mt-auto w-full text-xs bg-white/10 border-white/20 text-white hover:bg-white/20">
                            View All Wins
                        </Button>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default Dashboard;
