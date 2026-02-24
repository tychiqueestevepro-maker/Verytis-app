'use client';

import React, { memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const DistributionChart = ({ data }) => {
    // Default mock data if none provided
    const chartData = data || [
        { name: 'Commits', value: 400 },
        { name: 'Reviews', value: 300 },
        { name: 'Tickets', value: 300 },
        { name: 'Alerts', value: 200 },
    ];

    return (
        <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        animationDuration={1500}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            fontSize: '10px'
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};

export default memo(DistributionChart);
