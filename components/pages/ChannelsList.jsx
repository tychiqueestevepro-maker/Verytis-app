'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Search, Filter, Plus, ChevronRight, X, MoreVertical, Trash2, Users, Activity, Settings, Hash } from 'lucide-react';
import Link from 'next/link';
import { Card, Button, StatusBadge, PlatformIcon, Modal, EmptyState } from '../ui';
import { MOCK_CHANNELS, MOCK_TEAMS } from '../../data/mockData';

const ChannelsList = ({ userRole }) => {
    // Basic state
    const fetcher = (...args) => fetch(...args).then(res => res.json());

    // SWR Hook for channels
    const { data: channelsData, isLoading: isChannelsLoading, mutate } = useSWR('/api/resources/list', fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 30000
    });

    const channels = channelsData?.resources || [];
    const isLoading = isChannelsLoading && channels.length === 0;

    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({ platform: '', status: '' });
    const [openMenuId, setOpenMenuId] = useState(null);

    // Global click handler to close menu
    useEffect(() => {
        const closeMenu = () => setOpenMenuId(null);
        if (openMenuId) {
            window.addEventListener('click', closeMenu);
        }
        return () => window.removeEventListener('click', closeMenu);
    }, [openMenuId]);

    const handleMenuClick = (e, id) => {
        e.stopPropagation(); // Stop bubbling to prevent immediate closure
        setOpenMenuId(openMenuId === id ? null : id);
    };

    // Filtering logic
    const filteredChannels = channels.filter(channel => {
        const isSlack = (channel.platform || 'slack').toLowerCase() === 'slack';
        const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPlatform = filters.platform === '' || (channel.platform || 'slack').toLowerCase() === filters.platform.toLowerCase();
        const matchesStatus = filters.status === '' || (channel.status || 'active').toLowerCase() === filters.status.toLowerCase();
        return isSlack && matchesSearch && matchesPlatform && matchesStatus;
    });

    if (isLoading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="space-y-2">
                        <div className="h-7 w-32 bg-slate-200 animate-pulse rounded-lg" />
                        <div className="h-4 w-64 bg-slate-100 animate-pulse rounded-md" />
                    </div>
                    <div className="h-10 w-64 bg-slate-100 animate-pulse rounded-lg" />
                </header>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-50 h-10 border-b border-slate-200" />
                    <div className="p-6 space-y-6">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="flex items-center gap-6">
                                <div className="h-4 w-1/4 bg-slate-100 animate-pulse rounded" />
                                <div className="h-4 w-1/6 bg-slate-100 animate-pulse rounded" />
                                <div className="h-5 w-20 bg-slate-100 animate-pulse rounded-md" />
                                <div className="h-4 w-12 bg-slate-100 animate-pulse rounded" />
                                <div className="h-4 w-1/4 bg-slate-100 animate-pulse rounded ml-auto" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Channels</h1>
                    <p className="text-slate-500 mt-1 text-xs font-medium">Manage authorized communication channels.</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search channels..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-64 transition-all"
                    />
                </div>
            </header>

            <Card className="overflow-visible shadow-sm ring-1 ring-slate-200">
                {filteredChannels.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 uppercase tracking-wide">Name</th>
                                    <th className="px-6 py-3 uppercase tracking-wide">Platform</th>
                                    <th className="px-6 py-3 uppercase tracking-wide">Status</th>
                                    <th className="px-6 py-3 uppercase tracking-wide">Last Activity</th>
                                    {userRole === 'Admin' && <th className="px-6 py-3 text-right uppercase tracking-wide">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredChannels.map(channel => (
                                    <tr key={channel.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <Link href={`/channels/${channel.id}`} className="font-bold text-slate-900 hover:text-blue-600 transition-colors">
                                                #{channel.name}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={`https://www.google.com/s2/favicons?domain=${(channel.platform || 'slack')}.com&sz=32`}
                                                    alt={channel.platform}
                                                    className="w-5 h-5 rounded"
                                                />
                                                <span className="capitalize text-slate-600 font-medium">{channel.platform || 'Slack'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={channel.status || 'active'} />
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">
                                            {channel.lastActive ? new Date(channel.lastActive).toLocaleString() : '-'}
                                        </td>
                                        {userRole === 'Admin' && (
                                            <td className="px-6 py-4 text-right relative">
                                                <button
                                                    onClick={(e) => handleMenuClick(e, channel.id)}
                                                    className={`p-1.5 rounded-lg transition-colors ${openMenuId === channel.id ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>

                                                {/* Dropdown Menu */}
                                                {openMenuId === channel.id && (
                                                    <div className="absolute right-8 top-8 z-50 w-48 bg-white rounded-xl shadow-xl border border-slate-100 ring-1 ring-slate-900/5 animate-in fade-in zoom-in-95 duration-200 overflow-hidden text-left origin-top-right">
                                                        <div className="p-1">
                                                            <Link
                                                                href={`/timeline/${channel.platform || 'slack'}/${channel.id}`}
                                                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors"
                                                            >
                                                                <Activity className="w-4 h-4 text-slate-400" />
                                                                View Timeline
                                                            </Link>
                                                            <button
                                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors"
                                                                onClick={() => alert('Assign Team feature coming soon')}
                                                            >
                                                                <Users className="w-4 h-4 text-slate-400" />
                                                                Assign to Team
                                                            </button>
                                                            <div className="h-px bg-slate-100 my-1"></div>
                                                            <button
                                                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    alert('Archive feature coming soon');
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                Archive Channel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12">
                        <EmptyState
                            title={searchQuery ? "No channels match your search" : "No channels monitored"}
                            description={searchQuery ? "Try adjusting your filters or search terms." : `Connect your ${filters.platform === 'Slack' ? 'Slack workspace' : filters.platform === 'GitHub' ? 'GitHub organization' : 'platform'} to start monitoring ${filters.platform === 'GitHub' ? 'repositories' : 'channels'} for automated action tracking.`}
                            icon={Hash}
                            actionText={!searchQuery ? "Sync Channels" : undefined}
                            onAction={!searchQuery ? () => mutate() : undefined}
                        />
                    </div>
                )}
            </Card>
        </div >
    );
};

export default ChannelsList;
