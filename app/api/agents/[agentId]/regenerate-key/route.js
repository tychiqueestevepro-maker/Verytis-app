import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
    try {
        const { agentId } = await params;
        const supabase = await createClient();

        // 1. Auth check
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Org check
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        // 3. Verify agent belongs to user's org
        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('id, name')
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id)
            .single();

        if (agentError || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // 4. Generate new API key
        const rawKey = `agt_live_${crypto.randomUUID()}`;
        const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

        // 5. Update the agent's api_key_hash
        const { error: updateError } = await supabase
            .from('ai_agents')
            .update({ api_key_hash: hashedKey })
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id);

        if (updateError) {
            console.error('Failed to regenerate key:', updateError);
            return NextResponse.json({ error: 'Failed to regenerate API key' }, { status: 500 });
        }

        // 6. Audit log
        await supabase.from('activity_logs').insert({
            organization_id: profile.organization_id,
            actor_id: user.id,
            action_type: 'API_KEY_REGENERATED',
            summary: `API key regenerated for agent "${agent.name}"`,
            metadata: {
                agent_id: agentId,
                agent_name: agent.name,
                trace_id: crypto.randomUUID()
            }
        });

        // 7. Return the raw key (shown ONCE)
        return NextResponse.json({
            success: true,
            api_key: rawKey,
            message: 'New API key generated. Store it securely — it will not be shown again.'
        });

    } catch (error) {
        console.error('Error regenerating API key:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
