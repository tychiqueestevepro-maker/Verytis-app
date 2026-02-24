import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Resolve profile for organization_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        // ── 1. Resolve Resource Details ─────────────────────────────────
        let resource = null;
        let isAgent = false;

        if (channelId) {
            // Priority: Check monitored resources with organization verification via integration join
            const { data: resData } = await supabase
                .from('monitored_resources')
                .select('type, name, external_id, integration_id, integrations!inner(organization_id)')
                .eq('id', channelId)
                .eq('integrations.organization_id', profile.organization_id)
                .single();

            if (resData) {
                resource = resData;
            } else {
                // Check if it's an agent belonging to the current org
                const { data: agentData } = await supabase
                    .from('ai_agents')
                    .select('id, name')
                    .eq('id', channelId)
                    .eq('organization_id', profile.organization_id)
                    .single();

                if (agentData) {
                    resource = agentData;
                    isAgent = true;
                }
            }

            if (!resource) {
                return NextResponse.json({ events: [] });
            }
        }

        // ── 2. Build Query ──────────────────────────────────────────────
        let query = supabase
            .from('activity_logs')
            .select(`
                id,
                created_at,
                action_type,
                summary,
                metadata,
                actor_id,
                resource_id,
                agent_id,
                profiles:actor_id (
                    full_name,
                    email,
                    role
                )
            `)
            .eq('organization_id', profile.organization_id)
            .not('action_type', 'in', '("DISCUSSION","DISCUSSION_ANONYMOUS")');

        // ── 3. Apply Resource Filter ────────────────────────────────────
        if (channelId) {
            if (isAgent) {
                query = query.eq('agent_id', channelId);
            } else {
                const conditions = [`resource_id.eq.${channelId}`];
                if (resource.type === 'repo' && resource.name) {
                    conditions.push(`metadata->>repo.eq.${resource.name}`);
                }
                if (resource.external_id) {
                    conditions.push(`metadata->>slack_channel.eq.${resource.external_id}`);
                    conditions.push(`metadata->>board_id.eq.${resource.external_id}`);
                }
                query = query.or(conditions.join(','));
            }
        }

        // ── 4. Execute ──────────────────────────────────────────────────
        const { data: logs, error } = await query
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // ── 5. Map to UI Format ─────────────────────────────────────────
        const events = (logs || []).map(log => {
            let actorName;
            let role;
            let email = null;

            if (log.actor_id && log.profiles?.full_name) {
                actorName = log.profiles.full_name;
                role = log.profiles.role || 'Member';
                email = log.profiles.email;
            } else {
                actorName = log.metadata?.slack_user_name || log.metadata?.github_user || 'User X';
                role = 'Not connected';
            }

            return {
                id: log.id,
                timestamp: log.created_at,
                type: mapActionType(log.action_type),
                action: formatAction(log.action_type),
                target: log.summary || 'No description',
                actor: actorName,
                email,
                role,
                meta: log.metadata?.attachments?.length > 0 ? `${log.metadata.attachments.length} file(s)` : null,
                isAnonymous: log.metadata?.is_anonymous || false,
                channelId: log.metadata?.slack_channel || 'Unknown',
                rawMetadata: log.metadata
            };
        });

        return NextResponse.json({ events }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (err) {
        console.error('Error fetching activity logs:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// ── Helpers ─────────────────────────────────────────────────────────────

function mapActionType(actionType) {
    switch (actionType) {
        case 'APPROVE':
        case 'REJECT':
        case 'TRANSFER':
        case 'EDIT':
        case 'ARCHIVE':
        case 'PR_MERGED':
        case 'CARD_MOVED':
        case 'CARD_ARCHIVED':
            return 'decision';
        case 'COMMENT':
        case 'PR_OPENED':
            return 'comment';
        case 'FILE_SHARED':
        case 'CODE_PUSH':
        case 'ATTACHMENT_ADDED':
            return 'file';
        case 'MEMBER_JOINED':
        case 'CHANNEL_CREATED':
        case 'MEMBER_ASSIGNED':
        case 'CHECKLIST_DONE':
            return 'system';
        case 'DISCUSSION_ANONYMOUS':
        case 'ATTEMPTED_ACTION_ANONYMOUS':
            return 'anonymous';
        case 'AI_TELEMETRY':
            return 'ai';
        default:
            return 'system';
    }
}

function formatAction(actionType) {
    switch (actionType) {
        case 'AI_TELEMETRY': return 'AI Logical Step';
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
        case 'CODE_PUSH': return 'Pushed Commit';
        case 'PR_OPENED': return 'Opened PR';
        case 'PR_MERGED': return 'PR Merged';
        case 'CARD_MOVED': return 'Card Moved';
        case 'MEMBER_ASSIGNED': return 'Member Assigned';
        case 'ATTACHMENT_ADDED': return 'Attachment';
        case 'CHECKLIST_DONE': return 'Checklist Done';
        case 'CARD_ARCHIVED': return 'Card Archived';
        default: return actionType;
    }
}
