'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, PlatformIcon, StatusBadge } from '@/components/ui';
import { Layers, ChevronRight, Activity, Users } from 'lucide-react';

export default function StacksPage() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch teams - in a real app this would be an API call
        // For now we simulate with mock data or local state if available, 
        // but since we don't have a reliable mock import here without risk,
        // we'll fetch from the /api/teams endpoint if it exists, or use hardcoded fallback for display.

        async function fetchTeams() {
            try {
                const res = await fetch('/api/teams');
                if (res.ok) {
                    const data = await res.json();
                    setTeams(data.teams || []);
                } else {
                    setTeams([]);
                }
            } catch (err) {
                console.error("Failed to fetch teams", err);
            } finally {
                setLoading(false);
            }
        }

        fetchTeams();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 p-8">
                <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tech Stacks</h1>
                    <p className="text-slate-500 text-sm mt-1">Operational view of team integrations and activity.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams.map(team => (
                    <Link key={team.id} href={`/stacks/${team.id}`} className="block group">
                        <Card className="h-full hover:shadow-lg transition-all duration-300 border-slate-200 hover:border-blue-200 group-hover:-translate-y-1 relative overflow-hidden">

                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50 to-slate-100 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>

                            <div className="p-5 h-full flex flex-col relative z-10">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100">
                                        <Layers className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <StatusBadge status="Active" />
                                </div>

                                <h3 className="text-base font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {team.name}
                                </h3>
                                <p className="text-xs text-slate-500 line-clamp-2 mb-4 flex-1">
                                    {team.description}
                                </p>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                        <Users className="w-3 h-3" />
                                        <span>{team.members} Members</span>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                                            Active Stack
                                        </div>
                                        <div className="flex -space-x-2">
                                            {team.integrations?.map((tool, idx) => (
                                                <div key={idx} className="w-7 h-7 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center p-0.5 relative z-0 hover:z-10 hover:scale-110 transition-transform">
                                                    <PlatformIcon platform={tool} className="w-full h-full" />
                                                </div>
                                            ))}
                                            <div className="w-7 h-7 rounded-full bg-slate-50 border-2 border-white shadow-sm flex items-center justify-center text-[9px] font-bold text-slate-400">
                                                +
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
