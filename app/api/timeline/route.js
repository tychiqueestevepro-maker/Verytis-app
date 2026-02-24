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

        // Fetch all events for the organization (limit 100 for recent ledger)
        const { data: events, error: eventsError } = await supabase
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
            .limit(100);

        if (eventsError) throw eventsError;

        return NextResponse.json({ events });

    } catch (error) {
        console.error('Error fetching timeline data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
