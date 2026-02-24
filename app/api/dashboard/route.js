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

        // 1. Fetch AI Agents count
        const { count: agentsCount, error: agentsError } = await supabase
            .from('ai_agents')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id);

        if (agentsError) console.error("Error fetching agents count", agentsError);

        // 2. Fetch Total Audited Events (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { count: eventsCount, error: eventsCountError } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id)
            .gte('created_at', thirtyDaysAgo.toISOString());

        if (eventsCountError) console.error("Error fetching audited events count", eventsCountError);

        // 3. Fetch Monitored Users count
        const { count: usersCount, error: usersCountError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', profile.organization_id);

        if (usersCountError) console.error("Error fetching users count", usersCountError);

        // 4. Calculate AI Autonomy Index (Ratio of Agent actions vs Total actions)
        const { data: logStats, error: statsError } = await supabase
            .from('activity_logs')
            .select('agent_id')
            .eq('organization_id', profile.organization_id);

        let autonomyIndex = 0;
        if (!statsError && logStats && logStats.length > 0) {
            const agentActions = logStats.filter(l => l.agent_id).length;
            autonomyIndex = Math.round((agentActions / logStats.length) * 100);
        }

        // 5. Fetch Latest Events
        const { data: latestEvents, error: latestEventsError } = await supabase
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
            .limit(5);

        if (latestEventsError) console.error("Error fetching latest events", latestEventsError);

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
            } else if (log.metadata?.github_user) {
                actorName = log.metadata.github_user;
                actorType = 'human';
                avatar = actorName.substring(0, 2).toUpperCase();
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

        return NextResponse.json({
            metrics: {
                activeAgents: agentsCount || 0,
                totalAuditedEvents: eventsCount || 0,
                monitoredUsers: usersCount || 0,
                autonomyIndex: autonomyIndex,
                traceabilityScore: eventsCount > 0 ? 100 : 0
            },
            recentEvents: formattedEvents
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
