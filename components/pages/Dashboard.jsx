import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { RefreshCw, Users, Download, Shield, Trophy, CheckCircle, Clock, MessageSquare, Activity } from 'lucide-react';
import { Card, Button } from '../ui';

import MetricGrid from '../dashboard/MetricGrid';
import ActivityHeatmap from '../dashboard/ActivityHeatmap';
import TeamPerformance from '../dashboard/TeamPerformance';
import ActiveAlerts from '../dashboard/ActiveAlerts';
import SuccessStories from '../dashboard/SuccessStories';

// Dynamic imports for heavy charts
const VelocityChart = dynamic(() => import('../dashboard/VelocityChart'), {
    ssr: false,
    loading: () => <div className="h-48 w-full bg-slate-50 animate-pulse rounded-lg" />
});

const DistributionChart = dynamic(() => import('../dashboard/DistributionChart'), {
    ssr: false,
    loading: () => <div className="h-48 w-full bg-slate-50 animate-pulse rounded-lg" />
});

const fetcher = (url) => fetch(url).then((res) => res.json());

const swrOptions = {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
};

const AdminDashboard = () => {
    const { data: dashboardData, isLoading: dashboardLoading } = useSWR('/api/dashboard', fetcher, swrOptions);
    const { data: teamsData, isLoading: teamsLoading } = useSWR('/api/teams', fetcher, swrOptions);
    const { data: resourcesData, isLoading: resourcesLoading } = useSWR('/api/resources/list', fetcher, swrOptions);

    const metrics = useMemo(() => dashboardData?.metrics || {}, [dashboardData]);
    const alerts = useMemo(() => dashboardData?.alerts || [], [dashboardData]);
    const stories = useMemo(() => dashboardData?.stories || [], [dashboardData]);
    const performance = useMemo(() => dashboardData?.performance || [], [dashboardData]);

    // Connect live data from API
    const velocityData = useMemo(() => dashboardData?.velocity || [], [dashboardData]);
    const distributionData = useMemo(() => dashboardData?.distribution || [], [dashboardData]);

    if (dashboardLoading || teamsLoading || resourcesLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-slate-500 text-sm font-medium">Synchronizing live audit data...</p>
            </div>
        );
    }

    const TOP_TEAMS = (teamsData?.teams || []).slice(0, 5).map(t => ({
        name: t.name,
        actions: t.stats?.total_actions || 0,
        delay: t.stats?.avg_cycle_time || "N/A"
    }));

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
                    <Button variant="secondary" icon={Download}>Global Report</Button>
                </div>
            </header>

            <MetricGrid metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                {/* Evolution Curve (Dynamic Chart) */}
                <Card className="lg:col-span-2 p-5 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-blue-500" />
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Productivity Velocity (Commits/Day)</h3>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 leading-tight">Code output normalized against project tickets.</p>
                        </div>
                    </div>
                    <VelocityChart data={velocityData} />
                </Card>

                {/* Activity Heatmap */}
                <ActivityHeatmap />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
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

                {/* Interaction Scale (Dynamic Chart) */}
                <Card className="p-5 flex flex-col justify-center items-center relative">
                    <div className="absolute top-4 left-5 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-slate-400" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Interaction Distribution</h3>
                    </div>
                    <DistributionChart data={distributionData} />
                    <div className="absolute inset-x-0 bottom-8 flex justify-center items-center pointer-events-none">
                        <div className="text-center">
                            <div className="text-xl font-bold text-slate-900">{metrics.totalAuditedEvents || 0}</div>
                            <div className="text-[9px] text-slate-400 uppercase">Actions</div>
                        </div>
                    </div>
                </Card>

                <div className="space-y-4">
                    <Card className="p-4 flex flex-col items-center justify-center border-l-4 border-l-emerald-500 h-1/2">
                        <Shield className="w-6 h-6 text-emerald-500 mb-2" />
                        <div className="text-2xl font-bold text-slate-900">{metrics.traceabilityScore || 100}%</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">Rule Compliance</div>
                    </Card>
                    <Card className="p-4 flex flex-col items-center justify-center border-l-4 border-l-blue-500 h-1/2">
                        <CheckCircle className="w-6 h-6 text-blue-500 mb-2" />
                        <div className="text-2xl font-bold text-slate-900">{metrics.traceabilityScore || 0}%</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide text-center">Traceability Rate</div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ActiveAlerts alerts={alerts} />
                <TeamPerformance performance={performance} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SuccessStories stories={stories} />
            </div>
        </div>
    );
};

const Dashboard = ({ userRole }) => {
    if (userRole === 'Admin') {
        return <AdminDashboard />;
    }

    // Default to a simplified view or another component if needed
    return <AdminDashboard />;
};

export default Dashboard;
