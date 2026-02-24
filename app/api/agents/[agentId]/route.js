import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
    try {
        const { agentId } = params;
        const supabase = createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

        // Fetch specific agent
        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('*')
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id)
            .single();

        if (agentError) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

        // Fetch telemetry logs attached to this agent
        const { data: telemetryLogs, error: logsError } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('agent_id', agentId)
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (logsError) throw logsError;

        return NextResponse.json({ agent, logs: telemetryLogs });

    } catch (error) {
        console.error('Error fetching agent details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    try {
        const { agentId } = params;
        const supabase = createClient();
        const body = await req.json();
        const { status } = body;

        if (!['active', 'suspended'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

        // Update agent status if it belongs to the org
        const { data: agent, error: updateError } = await supabase
            .from('ai_agents')
            .update({ status })
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id)
            .select()
            .single();

        if (updateError) return NextResponse.json({ error: 'Failed to update agent status' }, { status: 500 });

        // Log the security action
        await supabase.from('activity_logs').insert({
            organization_id: profile.organization_id,
            actor_id: user.id,
            action_type: status === 'suspended' ? 'AGENT_KILLED' : 'AGENT_REACTIVATED',
            summary: `${agent.name} status changed to ${status}`,
            metadata: { agent_id: agentId, previous_status: agent.status === status ? 'unknown' : (status === 'active' ? 'suspended' : 'active') }
        });

        return NextResponse.json({ success: true, agent });

    } catch (error) {
        console.error('Error updating agent status:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
