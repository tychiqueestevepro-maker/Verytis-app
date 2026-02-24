
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
    const { teamId } = await params;

    if (!teamId) return NextResponse.json({ error: 'Team ID required' }, { status: 400 });

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        // Fetch Team Details
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .select('*')
            .eq('id', teamId)
            .single();

        if (teamError) throw teamError;
        if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

        // Fetch Members - Robust Query with logging
        const { data: members, error: membersError } = await supabase
            .from('team_members')
            .select(`
                *,
                profiles:user_id (
                    id,
                    full_name,
                    email,
                    avatar_url,
                    role,
                    social_profiles
                )
            `)
            .eq('team_id', teamId);

        if (membersError) {
            console.error("DEBUG: Error fetching team members:", membersError);
            throw membersError;
        } else {
            // console.log(`DEBUG: Found ${members?.length} members for team ${teamId}`);
        }

        // Sort members: Leads (Managers) first, then by name
        members.sort((a, b) => {
            const roleA = a.role === 'lead' ? 0 : 1;
            const roleB = b.role === 'lead' ? 0 : 1;
            if (roleA !== roleB) return roleA - roleB;

            const nameA = a.profiles?.full_name || '';
            const nameB = b.profiles?.full_name || '';
            return nameA.localeCompare(nameB);
        });

        // Fetch Channels (Monitored Resources linked to this team)
        const { data: channelsRaw, error: channelsError } = await supabase
            .from('monitored_resources')
            .select(`
                *,
                integrations (provider)
            `)
            .eq('team_id', teamId);

        if (channelsError) throw channelsError;

        // Fetch Decision Counts & Map Channels
        const channels = await Promise.all((channelsRaw || []).map(async (c) => {
            let count = 0;
            if (c.external_id) {
                const { count: decisionCount } = await supabase
                    .from('activity_logs')
                    .select('*', { count: 'exact', head: true })
                    .eq('metadata->>slack_channel', c.external_id)
                    .in('action_type', ['APPROVE', 'REJECT', 'TRANSFER', 'EDIT', 'ARCHIVE']); // Filter for "Decisions"
                count = decisionCount || 0;
            }
            return {
                ...c,
                decisionsCount: count
            };
        }));

        // Fetch Recent Activity (Limit 50 for better mix)
        const channelIds = channels.map(c => c.id);
        const repoNames = channels.filter(c => c.integrations?.provider === 'github' || c.type === 'repo').map(c => c.name).filter(Boolean);
        const slackChannelIds = channels.filter(c => c.integrations?.provider === 'slack' || c.type === 'channel').map(c => c.external_id).filter(Boolean);
        const trelloBoardIds = channels.filter(c => c.integrations?.provider === 'trello' || c.type === 'board').map(c => c.external_id).filter(Boolean);

        let recentActivity = [];
        let orConditions = [];

        // 1. Primary Filter: Resource IDs (if properly linked)
        if (channelIds.length > 0) {
            // Quote UUIDs for robust OR query
            const quotedIds = channelIds.map(id => `"${id}"`).join(',');
            orConditions.push(`resource_id.in.(${quotedIds})`);
        }

        // 2. Metadata Fallbacks (for logs without resource_id)
        if (slackChannelIds.length > 0) {
            slackChannelIds.slice(0, 10).forEach(id => {
                orConditions.push(`metadata->>slack_channel.eq.${id}`);
            });
        }

        if (repoNames.length > 0) {
            repoNames.slice(0, 10).forEach(name => {
                orConditions.push(`metadata->>repo.eq.${name}`);
            });
        }

        if (trelloBoardIds.length > 0) {
            trelloBoardIds.slice(0, 10).forEach(id => {
                orConditions.push(`metadata->>board_id.eq.${id}`);
                // Also check board_name as some old logs might use it
                const board = channels.find(c => c.external_id === id);
                if (board) orConditions.push(`metadata->>board_name.eq.${board.name}`);
            });
        }

        if (orConditions.length > 0) {
            const finalOr = orConditions.join(',');
            const { data: logs, error: logsError } = await supabase
                .from('activity_logs')
                .select(`
                    *,
                    profiles:actor_id (full_name, email, avatar_url)
                `)
                .or(finalOr)
                .order('created_at', { ascending: false })
                .limit(50);

            if (logsError) {
                console.error("DEBUG: Error fetching activity logs:", logsError);
            }
            recentActivity = logs || [];
        }

        // Fetch Audit Scopes (from settings or defaults)
        const scopes = team.settings?.scopes || ['Channel Audit', 'Documentation Audit', 'Reports & Exports'];

        // Map Channels with standard platform identification (strictly from DB)
        const mappedChannels = channels.map(c => ({
            id: c.id,
            name: c.name,
            platform: c.integrations?.provider, // No fallback in code
            decisionsCount: c.decisionsCount,
            external_id: c.external_id
        }));

        // Compute unique integrations for the stack sections
        const integrations = [...new Set(mappedChannels.map(c => c.platform).filter(Boolean))];

        // Construct Response
        const fullTeam = {
            ...team,
            members: members.map(m => ({
                id: m.profiles?.id || m.user_id,
                name: m.profiles?.full_name || m.profiles?.email || 'Unknown',
                email: m.profiles?.email || '',
                role: m.role,
                avatar: m.profiles?.avatar_url || '',
                joined_at: m.joined_at,
                social_profiles: m.profiles?.social_profiles || {}
            })),
            channels: mappedChannels,
            integrations: integrations,
            recentActivity: recentActivity.map(a => {
                // Find matching channel strictly by resource_id or metadata link
                const channel = mappedChannels.find(c => c.id === a.resource_id) || mappedChannels.find(c =>
                    (c.platform === 'slack' && c.external_id === a.metadata?.slack_channel) ||
                    (c.platform === 'github' && c.name === a.metadata?.repo) ||
                    (c.platform === 'trello' && c.external_id === a.metadata?.board_id)
                );

                return {
                    id: a.id,
                    description: a.summary || a.action_type,
                    user: {
                        name: a.profiles?.full_name || 'System',
                        avatar: a.profiles?.avatar_url
                    },
                    time: a.created_at,
                    channel: channel?.name || 'Unknown',
                    platform: channel?.platform,
                    actionType: a.action_type,
                    metadata: a.metadata
                };
            }),
            scopes,
            stats: {
                members: members.length,
                channels: mappedChannels.length,
                managers: members.filter(m => m.role === 'lead').length
            }
        };

        return NextResponse.json({ team: fullTeam });

    } catch (error) {
        console.error('Error fetching team details:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    const { teamId } = await params;
    const body = await req.json();

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { data, error } = await supabase
            .from('teams')
            .update(body)
            .eq('id', teamId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ team: data });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const { teamId } = await params;
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { error } = await supabase
            .from('teams')
            .delete()
            .eq('id', teamId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
