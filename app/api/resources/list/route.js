import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    try {
        // Fetch monitored resources and their integration details - filter by org at DB level
        const { data: orgResources, error } = await supabase
            .from('monitored_resources')
            .select(`
                id,
                name,
                type,
                last_active_at,
                created_at,
                audit_level,
                metadata,
                integration_id,
                team_id,
                integrations!inner (
                    provider,
                    organization_id
                )
            `)
            .eq('integrations.organization_id', profile.organization_id);

        if (error) throw error;

        // Fetch activity stats for these resources
        const resourceIds = orgResources.map(r => r.id);
        const { data: activities, error: activityError } = await supabase
            .from('activity_logs')
            .select('resource_id, created_at, actor_id')
            .in('resource_id', resourceIds);

        const stats = {};
        if (activities) {
            activities.forEach(log => {
                if (!stats[log.resource_id]) {
                    stats[log.resource_id] = {
                        lastActive: null,
                        actors: new Set()
                    };
                }

                const currentLast = stats[log.resource_id].lastActive;
                if (!currentLast || new Date(log.created_at) > new Date(currentLast)) {
                    stats[log.resource_id].lastActive = log.created_at;
                }

                if (log.actor_id) {
                    stats[log.resource_id].actors.add(log.actor_id);
                }
            });
        }

        console.log(`Total resources: ${orgResources.length}`);

        // Map to UI format
        const formattedResources = orgResources.map(r => {
            // Parse metadata if it's a string
            let meta = r.metadata || {};
            if (typeof meta === 'string') {
                try { meta = JSON.parse(meta); } catch { meta = {}; }
            }

            const resStats = stats[r.id] || { lastActive: null, actors: new Set() };

            // Prefer calculated lastActive, fallback to DB last_active_at, then created_at
            const effectiveLastActive = resStats.lastActive || r.last_active_at || r.created_at;
            const contributorCount = resStats.actors.size;

            return {
                id: r.id,
                teamId: r.team_id,
                name: r.name,
                platform: r.integrations?.provider || 'unknown',
                type: r.type,
                status: 'active', // 'active' | 'paused'
                lastActive: effectiveLastActive,
                decisions: 0, // Mock for now
                numMembers: contributorCount, // Real contributor count
                isPrivate: meta.is_private || false
            };
        });

        return NextResponse.json({
            resources: formattedResources
        });
    } catch (err) {
        console.error('Error fetching resources:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
