'use client';

import React, { memo } from 'react';
import { Trophy, Clock } from 'lucide-react';
import { Card, Button, DashboardEmptyState } from '../ui';

const SuccessStories = ({ stories }) => {
    return (
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
                {stories.length > 0 ? (
                    stories.map(story => (
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
    );
};

export default memo(SuccessStories);
