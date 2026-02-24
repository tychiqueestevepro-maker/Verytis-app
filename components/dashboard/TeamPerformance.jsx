'use client';

import React, { memo } from 'react';
import { Users, UserCheck, UserX } from 'lucide-react';
import { Card } from '../ui';

const TeamPerformance = ({ performance }) => {
    return (
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
                {performance.map((user, idx) => (
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
    );
};

export default memo(TeamPerformance);
