import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = createClient();

        // 1. Authenticate user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // 2. Resolve organization
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        const orgId = profile.organization_id;

        // 3. Fetch Resources (Channels) with Team Info - Filtered by Org
        // We fetch resources where their integration belongs to the current org
        const { data: resources, error: resError } = await supabase
            .from('monitored_resources')
            .select('*, teams(id, name, organization_id), integrations!inner(provider, organization_id)')
            .eq('integrations.organization_id', orgId);

        if (resError) throw resError;

        // 4. Fetch Teams - Filtered by Org
        const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .eq('organization_id', orgId);

        if (teamsError) throw teamsError;

        // 5. Fetch AI Agents - Filtered by Org
        const { data: agents, error: agentsError } = await supabase
            .from('ai_agents')
            .select('id, name, status')
            .eq('organization_id', orgId);

        if (agentsError) throw agentsError;

        return NextResponse.json({
            resources: resources || [],
            teams: teams || [],
            agents: agents || []
        });

    } catch (error) {
        console.error('Error fetching audit metadata:', error);
        return NextResponse.json({ error: 'Failed to fetch audit metadata' }, { status: 500 });
    }
}
