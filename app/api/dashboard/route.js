import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

        // Fetch metrics via RPC and latest events in parallel
        const [
            { data: metricsData, error: metricsError },
            { data: latestEvents, error: latestEventsError }
        ] = await Promise.all([
            // 1. High-performance SQL aggregation for metrics, distribution and velocity
            supabase.rpc('get_dashboard_metrics', { org_id: profile.organization_id }),

            // 2. Fetch Latest Events (Granular feed)
            supabase
                .from('activity_logs')
                .select(`
                    id,
                    created_at,
                    action_type,
                    summary,
                    metadata,
                    actor_id,
                    agent_id,
                    profiles:actor_id (
                        full_name
                    ),
                    ai_agents:agent_id (
                        name
                    )
                `)
                .eq('organization_id', profile.organization_id)
                .not('action_type', 'in', '("DISCUSSION","DISCUSSION_ANONYMOUS")')
                .order('created_at', { ascending: false })
                .limit(5)
        ]);

        if (metricsError) console.error("Error calling get_dashboard_metrics RPC:", metricsError);
        if (latestEventsError) console.error("Error fetching latest events:", latestEventsError);

        // Map events to the UI format
        const formattedEvents = (latestEvents || []).map(log => {
            let actorName = 'Unknown';
            let actorType = 'human';
            let avatar = 'U';

            if (log.ai_agents?.name) {
                actorName = log.ai_agents.name;
                actorType = 'agent';
                avatar = '🤖';
            } else if (log.profiles?.full_name) {
                actorName = log.profiles.full_name;
                actorType = 'human';
                const nameParts = actorName.split(' ');
                avatar = nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[1][0]}` : actorName[0];
            }

            return {
                id: log.id,
                actor: { name: actorName, type: actorType, avatar },
                action: log.action_type || 'SYSTEM_EVENT',
                target: log.summary || 'No Target',
                status: log.metadata?.status || 'VERIFIED',
                time: log.created_at
            };
        });

        const metrics = metricsData || {};

        return NextResponse.json({
            metrics: {
                activeAgents: metrics.activeAgents || 0,
                totalAuditedEvents: metrics.totalAuditedEvents || 0,
                monitoredUsers: metrics.monitoredUsers || 0,
                autonomyIndex: metrics.autonomyIndex || 0,
                traceabilityScore: (metrics.totalAuditedEvents || 0) > 0 ? 100 : 0
            },
            recentEvents: formattedEvents,
            distribution: metrics.distribution || [],
            velocity: metrics.velocity || [0, 0, 0, 0, 0, 0, 0]
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
