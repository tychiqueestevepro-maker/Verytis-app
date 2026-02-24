'use client';

import React, { memo } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, DashboardEmptyState } from '../ui';

const ActiveAlerts = ({ alerts }) => {
    return (
        <Card className="p-0 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 bg-rose-50/30 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-700" />
                        <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wide">Active Alerts</h3>
                    </div>
                    <p className="text-[10px] text-rose-600/80 mt-1 leading-tight">Real-time notifications of abnormal delays requiring attention.</p>
                </div>
                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold shrink-0 ml-2">{alerts.length} New</span>
            </div>
            <div className="divide-y divide-slate-100">
                {alerts.length > 0 ? (
                    alerts.map(alert => (
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
    );
};

export default memo(ActiveAlerts);
