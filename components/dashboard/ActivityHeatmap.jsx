'use client';

import React, { memo } from 'react';
import { Activity } from 'lucide-react';
import { Card } from '../ui';

const ActivityHeatmap = () => {
    return (
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
                                const intensity = Math.random();
                                const colorClass = intensity > 0.8 ? 'bg-rose-500' : intensity > 0.6 ? 'bg-amber-400' : 'bg-slate-100';
                                return <div key={i} className={`rounded-sm ${colorClass} hover:opacity-80 transition-opacity`} title="Activity Level"></div>
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export default memo(ActivityHeatmap);
