'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Activity, CheckCircle, Settings, FileText, UserPlus, FilterX, XCircle, RefreshCw, Edit2, GitCommit, GitPullRequest, GitMerge, Archive as ArchiveIcon, Paperclip, CheckSquare, Layout, Award, Kanban, ListChecks, ArrowRightCircle, Trophy, ChevronDown, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Card, Button, PlatformIcon, EmptyState } from '@/components/ui';

export default function TimelineFeed({ userRole }) {
    const { provider, resourceId } = useParams();
    const router = useRouter();
    const supabase = createClient();

    // We already have the resourceId, so 'selectedChannelId' refers to that
    const [filterType, setFilterType] = useState('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [resourceInfo, setResourceInfo] = useState(null);

    const FILTER_OPTIONS = {
        github: [
            { value: 'all', label: 'All Events' },
            { value: 'commits', label: 'Pushes' },
            { value: 'prs', label: 'Pull Requests' },
            { value: 'system', label: 'System' }
        ],
        trello: [
            { value: 'all', label: 'All Events' },
            { value: 'moves', label: 'Moves & Status' },
            { value: 'tasks', label: 'Checklists & Tasks' },
            { value: 'team', label: 'Team & Members' },
            { value: 'files', label: 'Files & Attachments' },
            { value: 'system', label: 'System' }
        ],
        default: [
            { value: 'all', label: 'All Events' },
            { value: 'code', label: 'Code Activity' },
            { value: 'decisions', label: 'Decisions Only' },
            { value: 'system', label: 'System & Meta' }
        ]
    };

    const currentProvider = provider?.toLowerCase();
    const currentOptions = FILTER_OPTIONS[currentProvider] || FILTER_OPTIONS.default;
    const selectedLabel = currentOptions.find(o => o.value === filterType)?.label || 'All Events';

    // Fetch Resource Info (Name, etc.)
    useEffect(() => {
        const fetchResourceInfo = async () => {
            try {
                // In a real app we might have a specific endpoint for single resource details
                // For now, let's reuse the list and find it, or fallback
                const res = await fetch('/api/resources/list');
                if (res.ok) {
                    const data = await res.json();
                    const found = data.resources?.find(r => r.id.toString() === resourceId);
                    if (found) setResourceInfo(found);
                }
            } catch (e) {
                console.error('Error fetching resource details:', e);
            }
        };
        fetchResourceInfo();
    }, [resourceId]);

    const fetchEvents = async () => {
        if (!resourceId) return;

        // Only show loading on initial fetch if we don't have events yet
        if (events.length === 0) setLoading(true);

        try {
            // Assumption: API supports fetching by ID directly
            const res = await fetch(`/api/activity?channelId=${resourceId}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`📊 Timeline fetched ${data.events?.length} events. Top event:`, data.events?.[0]);
                setEvents(data.events || []);
            }
        } catch (e) {
            console.error('Error fetching events:', e);
        } finally {
            setLoading(false);
        }
    };

    // Fetch real events & Subscribe to Realtime
    useEffect(() => {
        fetchEvents();

        // REAL-TIME: Listen for new activity logs for this resource
        const channel = supabase
            .channel(`resource-activity-${resourceId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_logs',
                    filter: `resource_id=eq.${resourceId}`
                },
                (payload) => {
                    console.log('🔥 New Activity Detected (DB)!', payload);
                    fetchEvents();
                }
            )
            .on(
                'broadcast',
                { event: 'new_activity' },
                (payload) => {
                    console.log('🔥 New Activity Detected (Broadcast)!', payload);
                    // Add delay to allow DB propagation
                    setTimeout(() => {
                        fetchEvents();
                    }, 1000);
                }
            )
            .subscribe((status) => {
                console.log(`📡 Realtime Status: ${status}`);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [resourceId]);

    // Format Action Name Helper
    const formatActionName = (action) => {
        if (!action) return 'Unknown Action';
        if (action === 'CARD_COMPLETED') return 'Card Completed';
        if (action === 'CARD_MOVED') return 'Card Moved';
        if (action === 'CARD_ARCHIVED') return 'Card Archived';
        if (action === 'CHECKLIST_DONE') return 'Checklist Done';
        if (action === 'MEMBER_ASSIGNED') return 'Member Assigned';
        if (action === 'ATTACHMENT_ADDED') return 'Attachment Added';
        return action;
    };

    // Helper for loose matching
    const matchAction = (action, keywords) => {
        if (!action) return false;
        const lower = action.toLowerCase();
        return keywords.some(k => lower.includes(k));
    };

    // Filter events
    const filteredEvents = events.filter(event => {
        if (filterType === 'all') return true;

        const currentProvider = provider?.toLowerCase();
        const action = event.action;

        // GitHub Specific Filters
        if (currentProvider === 'github') {
            if (filterType === 'commits' && action === 'Pushed Commit') return true;
            if (filterType === 'prs' && ['Opened PR', 'Merged PR'].includes(action)) return true;
            if (filterType === 'system' && ['system', 'anonymous'].includes(event.type)) return true;
            return false;
        }

        // Trello Specific Filters (Robust Matching)
        if (currentProvider === 'trello') {
            if (filterType === 'moves' && matchAction(action, ['move', 'archive', 'complete', 'status'])) return true;
            if (filterType === 'tasks' && matchAction(action, ['checklist', 'task', 'todo', 'check'])) return true;
            if (filterType === 'team' && matchAction(action, ['member', 'assign', 'join'])) return true;
            if (filterType === 'files' && matchAction(action, ['attachment', 'file', 'upload'])) return true;
            if (filterType === 'system' && ['system', 'anonymous'].includes(event.type)) return true;
            return false;
        }

        // Default / Slack Filters
        if (filterType === 'decisions' && event.type === 'decision') return true;
        if (filterType === 'code' && (event.type === 'file' || event.type === 'comment' || action === 'Merged PR')) return true;
        if (filterType === 'system' && ['system', 'anonymous'].includes(event.type)) return true;
        return false;
    });

    const groupedEvents = filteredEvents.reduce((groups, event) => {
        const date = new Date(event.timestamp).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        if (!groups[date]) groups[date] = [];
        groups[date].push(event);
        return groups;
    }, {});

    const getEventIcon = (event) => {
        let style = { icon: Activity, color: 'text-slate-400' };
        const currentProvider = provider?.toLowerCase();
        const action = event.action;

        if (event.type === 'decision') {
            const decisionStyles = {
                'Approval': { icon: CheckCircle, color: 'text-emerald-600' },
                'Rejection': { icon: XCircle, color: 'text-rose-600' },
                'Transfer': { icon: RefreshCw, color: 'text-purple-600' },
                'Edit': { icon: Edit2, color: 'text-blue-600' },
                'Archive': { icon: ArchiveIcon, color: 'text-slate-600' },
                'Merged PR': { icon: GitMerge, color: 'text-purple-600' }
            };
            style = decisionStyles[action] || decisionStyles['Approval'];
        } else if (event.type === 'file') {
            if (action === 'Pushed Commit') {
                style = { icon: GitCommit, color: 'text-orange-500' };
            } else {
                style = { icon: FileText, color: 'text-orange-500' };
            }
        } else if (event.type === 'comment') {
            if (action === 'Opened PR') {
                style = { icon: GitPullRequest, color: 'text-blue-500' };
            } else {
                style = { icon: GitCommit, color: 'text-blue-500' };
            }
        } else if (event.type === 'system') {
            style = { icon: Settings, color: 'text-slate-500' };
        } else if (event.type === 'anonymous') {
            style = { icon: UserPlus, color: 'text-amber-500' };
        }

        // Trello Specific Actions - ROBUST MATCHING
        else if (currentProvider === 'trello') {
            if (matchAction(action, ['move'])) style = { icon: ArrowRightCircle, color: 'text-orange-500' };
            else if (matchAction(action, ['member', 'assign'])) style = { icon: UserPlus, color: 'text-purple-500' };
            else if (matchAction(action, ['attachment', 'file'])) style = { icon: Paperclip, color: 'text-slate-500' };
            else if (matchAction(action, ['checklist', 'check'])) style = { icon: ListChecks, color: 'text-emerald-500' };
            else if (matchAction(action, ['complete'])) style = { icon: Trophy, color: 'text-amber-500' };
            else if (matchAction(action, ['archive'])) style = { icon: ArchiveIcon, color: 'text-slate-400' };
        }

        const Icon = style.icon;
        return <Icon className={`w-3.5 h-3.5 ${style.color}`} />;
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300 max-w-5xl mx-auto px-4 pb-12">
            <header className="flex items-center justify-between pb-4 border-b border-slate-200 mt-6 relative z-50">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors border border-transparent hover:border-slate-200"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold tracking-tight text-slate-900">
                                {resourceInfo ? resourceInfo.name : 'Loading...'}
                            </h1>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                {provider}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium hover:bg-slate-50 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                    >
                        <span className="text-slate-700">{selectedLabel}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFilterOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                {currentOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            setFilterType(option.value);
                                            setIsFilterOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between hover:bg-slate-50 transition-colors ${filterType === option.value ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'
                                            }`}
                                    >
                                        {option.label}
                                        {filterType === option.value && <Check className="w-3 h-3" />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </header>

            <div className="relative min-h-[400px] pt-4">
                <div className="absolute left-[19px] top-0 bottom-0 w-px bg-slate-200" />

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3"></div>
                        <p className="text-xs font-medium">Loading events...</p>
                    </div>
                ) : Object.keys(groupedEvents).length === 0 ? (
                    <EmptyState
                        title="No events recorded yet"
                        description="Activity from linked platforms will appear here once actions are taken or synchronized by the system."
                        icon={Activity}
                    />
                ) : (
                    <div className="space-y-8">
                        {Object.entries(groupedEvents).map(([date, events]) => (
                            <div key={date}>
                                <div className="flex items-center gap-4 mb-4 sticky top-0 bg-[#FAFAFA] z-10 py-2">
                                    <div className="w-[10px]"></div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">{date}</span>
                                </div>
                                <div className="space-y-3">
                                    {events.map(event => (
                                        <div key={event.id} className="relative pl-10 group">
                                            <div className="absolute left-3 top-3.5 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm z-10 group-hover:border-slate-400 transition-colors">
                                                {getEventIcon(event)}
                                            </div>
                                            <Card
                                                className="p-3 hover:shadow-md transition-shadow group-hover:border-slate-300 cursor-pointer"
                                                onClick={() => {
                                                    if (resourceInfo?.teamId) {
                                                        router.push(`/stacks/${resourceInfo.teamId}/activity/${event.id}`);
                                                    }
                                                }}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-slate-900 text-xs">{formatActionName(event.action)}</span>
                                                            <span className="text-[10px] text-slate-400">•</span>
                                                            <span className="text-xs text-slate-600 font-medium">{event.target}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">

                                                            <span className="font-semibold text-slate-700">{event.actor}</span>
                                                            <span className="text-slate-300">|</span>
                                                            <span className="font-medium">{event.role}</span>
                                                            {event.meta && (
                                                                <>
                                                                    <span className="text-slate-300">|</span>
                                                                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-600 border border-slate-200">
                                                                        {event.meta}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </Card>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
