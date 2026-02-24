'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { ChevronRight, Clock, Download, CheckCircle, GitCommit, UserPlus, FileText, XCircle, RefreshCw, Edit2, Archive as ArchiveIcon } from 'lucide-react';
import { Card, Button, StatusBadge, PlatformIcon } from '../ui';

const ChannelDetail = ({ userRole }) => {
    const { channelId } = useParams();
    const router = useRouter();

    // State for real data
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    useEffect(() => {
        const fetchChannel = async () => {
            // Initialize Supabase
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            // Simple fetch via REST if we don't have client imported. 
            // Or better: Use the endpoint we created? No, we created /list.
            // Let's use the same trick: /api/resources/list but filter? 
            // No, let's just use a direct query via a new helper or just fetch all and find. 
            // Fetching all is inefficient ID lookup. 



            // Fetch from API (we will create a dedicated endpoint or just list and find for now)
            // For urgency, I will use /api/resources/list and find. 
            // It's not optimal but it works without new backend code immediately.
            try {
                const res = await fetch('/api/resources/list');
                if (res.ok) {
                    const data = await res.json();
                    const found = data.resources.find(r => r.id === channelId);
                    if (found) {
                        // Use real data from API
                        setChannel({
                            ...found,
                            team: 'General', // Default
                            scope: 'Global',
                            members: found.numMembers || 0, // Real member count from Slack
                            type: found.isPrivate ? 'Private' : 'Public',
                            description: 'Imported channel',
                            platform: found.platform || 'slack',
                            status: 'active'
                        });
                    }
                }
            } catch (e) {
                console.error("Error fetching channel detail", e);
            } finally {
                setLoading(false);
            }
        };
        fetchChannel();
    }, [channelId]);

    // Fetch members when channel is loaded (and it's a real channel, not mock)
    useEffect(() => {
        const fetchMembers = async () => {
            if (!channel || !channelId || channelId.length < 30) return; // Skip if mock ID (short)

            setLoadingMembers(true);
            try {
                const res = await fetch(`/api/slack/channel-members/${channelId}`);
                if (res.ok) {
                    const data = await res.json();
                    setMembers(data.members || []);
                }
            } catch (e) {
                console.error('Error fetching members:', e);
            } finally {
                setLoadingMembers(false);
            }
        };
        fetchMembers();
    }, [channel, channelId]);

    // State for activities
    const [activities, setActivities] = useState([]);
    const [loadingActivities, setLoadingActivities] = useState(false);

    // Debug State
    const [connectionStatus, setConnectionStatus] = useState('CONNECTING');
    const [lastEvent, setLastEvent] = useState(null);
    const [debugExpanded, setDebugExpanded] = useState(false);

    // Defined via useCallback so it can be called by Realtime subscription
    const fetchActivities = useCallback(async () => {
        if (!channelId || channelId.length < 30) return; // Skip mock IDs

        // Only set loading on initial fetch to avoid flickering on updates
        if (activities.length === 0) setLoadingActivities(true);

        try {
            const res = await fetch(`/api/activity?channelId=${channelId}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const sorted = (data.events || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setActivities(sorted);
            }
        } catch (e) {
            console.error('Error fetching activities:', e);
        } finally {
            setLoadingActivities(false);
        }
    }, [channelId]); // Removed 'activities.length' from dependency to avoid stale closures if needed, but here it's fine.

    // Initial fetch
    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    // SSE Realtime Subscription (Server-Sent Events)
    useEffect(() => {
        if (!channelId || channelId.length < 30) {
            setConnectionStatus('DISCONNECTED');
            return;
        }

        console.log("🔌 Connecting to Activity Stream...");
        setConnectionStatus('CONNECTING');
        const eventSource = new EventSource(`/api/activity/stream?channelId=${channelId}`);

        eventSource.onopen = () => {
            console.log("✅ SSE Connected");
            setConnectionStatus('OPEN');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'new_activity' && data.log) {
                    console.log("🔔 New Activity Received via Stream:", data.log);
                    setLastEvent(data.log); // Debug info

                    // Map raw DB log to UI format
                    const log = data.log;
                    let actorName = 'User X';
                    let role = 'Not connected';

                    if (log.actor_id && log.profiles?.full_name) {
                        actorName = log.profiles.full_name;
                        role = log.profiles.role || 'Member';
                    }

                    const newEvent = {
                        id: log.id,
                        timestamp: log.created_at,
                        type: mapActionTypeUI(log.action_type),
                        action: formatActionUI(log.action_type),
                        target: log.summary || 'No description',
                        actor: actorName,
                        role: role,
                        meta: log.metadata?.attachments?.length > 0 ? `${log.metadata.attachments.length} file(s)` : null,
                        isAnonymous: log.metadata?.is_anonymous || false,
                        channelId: log.metadata?.slack_channel || null
                    };

                    setActivities(prev => {
                        // Avoid duplicates from overlap/reconnect
                        if (prev.some(a => a.id === newEvent.id)) return prev;

                        const updated = [newEvent, ...prev];
                        // Force sort by timestamp descending (newest first)
                        return updated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    });
                }
            } catch (e) {
                console.error("Error parsing SSE event:", e);
            }
        };

        eventSource.onerror = (e) => {
            console.error("SSE Error (retrying...):", e);
            eventSource.close();
            // Retry handled by browser if using native EventSource, but on error it might stop. 
            // We could add logical reconnect here if needed.
        };

        return () => {
            eventSource.close();
        };
    }, [channelId]);

    const refreshActivities = useCallback(async () => {
        setLoadingActivities(true);
        try {
            const res = await fetch(`/api/activity?channelId=${channelId}`, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const sorted = (data.events || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                setActivities(sorted);
            }
        } catch (e) {
            console.error('Error refreshing activities:', e);
        } finally {
            setLoadingActivities(false);
        }
    }, [channelId]);

    // Helper functions for mapping (duplicated from API for now to ensure consistency)
    const mapActionTypeUI = (actionType) => {
        switch (actionType) {
            case 'APPROVE': case 'REJECT': case 'TRANSFER': case 'EDIT': case 'ARCHIVE': return 'decision';
            case 'COMMENT': return 'comment';
            case 'FILE_SHARED': return 'file';
            case 'MEMBER_JOINED': case 'CHANNEL_CREATED': return 'system';
            default: return 'system';
        }
    };

    const formatActionUI = (actionType) => {
        switch (actionType) {
            case 'APPROVE': return 'Approval';
            case 'REJECT': return 'Rejection';
            case 'TRANSFER': return 'Transfer';
            case 'EDIT': return 'Edit';
            case 'ARCHIVE': return 'Archive';
            case 'COMMENT': return 'Comment';
            case 'FILE_SHARED': return 'File';
            case 'MEMBER_JOINED': return 'Member joined';
            case 'CHANNEL_CREATED': return 'Channel created';
            case 'ATTEMPTED_ACTION_ANONYMOUS': return 'Unverified action';
            default: return actionType;
        }
    };

    // Find parent team to check scopes (Mock logic mostly)
    // Simplified permission checks (removed dependency on deleted MOCK_TEAMS)
    const showScope = userRole !== 'Member';
    // Manager needs 'export' scope enabled on the team to see Export button
    // For now, allow all Admins and Managers to export until real team scopes are connected
    const canExport = userRole === 'Admin' || userRole === 'Manager';

    const getActivityIcon = (iconType) => {
        switch (iconType) {
            case 'CheckCircle': return CheckCircle;
            case 'GitCommit': return GitCommit;
            case 'UserPlus': return UserPlus;
            case 'FileText': return FileText;
            default: return CheckCircle;
        }
    };

    if (loading) {
        return <div className="p-12 text-center text-slate-500">Loading channel details...</div>;
    }

    if (!channel) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Channel not found</p>
                <Link href="/channels" className="text-blue-600 hover:underline mt-2 inline-block">Back to Channels</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <Link href="/channels" className="cursor-pointer hover:text-slate-900 transition-colors">Channels</Link>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-slate-900">{channel.name}</span>
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{channel.name}</h1>
                            <img
                                src={`https://www.google.com/s2/favicons?domain=${channel.platform}.com&sz=32`}
                                alt={channel.platform}
                                className="w-6 h-6 rounded"
                            />
                        </div>

                        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 w-fit shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Team</span>
                                <span className="text-xs font-semibold text-slate-700">{channel.team}</span>
                            </div>
                            {showScope && (
                                <>
                                    <div className="w-px h-3 bg-slate-300"></div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Scope</span>
                                        <span className="text-xs font-semibold text-slate-700">{channel.scope}</span>
                                    </div>
                                </>
                            )}
                            <div className="w-px h-3 bg-slate-300"></div>
                            <StatusBadge status={channel.status} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" icon={Clock} onClick={() => router.push(`/timeline/${channel.platform}/${channel.id}`)}>View Timeline</Button>
                        {canExport && <Button variant="secondary" icon={Download}>Export</Button>}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <Card className="p-4 bg-slate-50/50 border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Ships</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">
                        {activities.filter(a => a.type === 'decision').length}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Logged activity</span>
                </Card>
                <Card className="p-4 bg-slate-50/50 border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Members</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{channel.members}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Active participants</span>
                </Card>
                <Card className="p-4 bg-slate-50/50 border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Visibility</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{channel.type}</div>
                    <span className="text-[10px] text-slate-400 font-medium">Access level</span>
                </Card>
                <Card className="p-4 bg-slate-50/50 border-slate-200">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Created</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">240d</div>
                    <span className="text-[10px] text-slate-400 font-medium">Ago</span>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                            Recent Ships ({activities.filter(a => a.type === 'decision').length})
                        </h3>
                        <Card className="overflow-hidden border-slate-200">
                            {loadingActivities ? (
                                <div className="p-6 text-center">
                                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                                </div>
                            ) : activities.filter(a => a.type === 'decision').length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {activities.filter(a => a.type === 'decision').slice(0, 5).map(activity => {
                                        const styles = {
                                            'Approval': { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                            'Rejection': { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                                            'Transfer': { icon: RefreshCw, color: 'text-purple-600', bg: 'bg-purple-50' },
                                            'Edit': { icon: Edit2, color: 'text-blue-600', bg: 'bg-blue-50' },
                                            'Archive': { icon: ArchiveIcon, color: 'text-slate-600', bg: 'bg-slate-50' }
                                        };
                                        const style = styles[activity.action] || styles['Approval'];
                                        const Icon = style.icon;

                                        return (
                                            <div key={activity.id} className="p-3 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.bg}`}>
                                                        <Icon className={`w-4 h-4 ${style.color}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-bold text-slate-900">{activity.action}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{activity.target}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-[10px] font-medium text-slate-600">{activity.actor}</div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    No shipping activity logged yet.
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                                Activity Stream
                            </h3>
                            <button
                                onClick={refreshActivities}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            >
                                <RefreshCw className="w-3 h-3" /> Refresh
                            </button>
                        </div>
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                            {loadingActivities ? (
                                <div className="p-6 text-center">
                                    <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                                </div>
                            ) : activities.length > 0 ? (
                                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                                    {activities.slice(0, 10).map(activity => {
                                        let style = { icon: UserPlus, color: 'text-slate-500', bg: 'bg-slate-100' };

                                        if (activity.type === 'decision') {
                                            const decisionStyles = {
                                                'Approval': { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                                'Rejection': { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                                                'Transfer': { icon: RefreshCw, color: 'text-purple-600', bg: 'bg-purple-50' },
                                                'Edit': { icon: Edit2, color: 'text-blue-600', bg: 'bg-blue-50' },
                                                'Archive': { icon: ArchiveIcon, color: 'text-slate-600', bg: 'bg-slate-50' }
                                            };
                                            style = decisionStyles[activity.action] || decisionStyles['Approval'];
                                        } else if (activity.type === 'file') {
                                            style = { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50' };
                                        } else if (activity.type === 'comment') {
                                            style = { icon: GitCommit, color: 'text-blue-500', bg: 'bg-blue-50' };
                                        }

                                        const Icon = style.icon;

                                        return (
                                            <div key={activity.id} className="p-3 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${style.bg}`}>
                                                        <Icon className={`w-3.5 h-3.5 ${style.color}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[11px] font-bold text-slate-800">{activity.action}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{activity.target}</div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-[10px] font-medium text-slate-600">{activity.actor}</div>
                                                        <div className="text-[9px] text-slate-400">
                                                            {new Date(activity.timestamp).toLocaleString([], {
                                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-slate-400 text-sm py-8">
                                    No activity recorded yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900">
                        Participants ({channel.members})
                    </h3>
                    <Card className="p-0 border-slate-200">
                        {loadingMembers ? (
                            <div className="p-6 text-center">
                                <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                                <p className="text-xs text-slate-400">Loading members...</p>
                            </div>
                        ) : members.length > 0 ? (
                            <>
                                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                                    {members.map(member => (
                                        <div key={member.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-lg transition-colors">
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="w-8 h-8 rounded-full border border-slate-200"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 border border-slate-200">
                                                    {member.initials}
                                                </div>
                                            )}
                                            <div className="overflow-hidden flex-1">
                                                <div className="text-xs font-bold text-slate-900 truncate">{member.name}</div>
                                                <div className="text-[10px] text-slate-400 truncate font-medium">
                                                    {member.title || 'Team Member'}
                                                </div>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${member.isConnected
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                                                }`}>
                                                {member.isConnected ? 'Connected' : 'Not connected'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {channel.members > members.length && (
                                    <div className="border-t border-slate-100 p-3 text-center bg-slate-50/50">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                            +{channel.members - members.length} more members
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="p-6 text-center">
                                <div className="text-slate-400 text-sm">No members found</div>
                                <p className="text-[10px] text-slate-400 mt-1">Unable to load member list from Slack.</p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>


        </div>
    );
};

export default ChannelDetail;
