import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req, { params }) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    // Validate agent ownership
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('id', agentId)
      .eq('organization_id', profile.organization_id)
      .maybeSingle();

    if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

    const body = await req.json();
    const { provider, connection_type, connection_id, external_id, name, resource_type, metadata } = body;

    if (!provider || !connection_type || !external_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const payload = {
      agent_id: agentId,
      provider: provider.toLowerCase(),
      connection_type: connection_type.toLowerCase(),
      connection_id: connection_id || null,
      external_id: external_id.toString(),
      name: name || null,
      resource_type: resource_type || null,
      metadata: metadata || {},
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error } = await supabase
      .from('agent_resources')
      .upsert(payload, { onConflict: 'agent_id,provider,connection_type,external_id' })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, resource: upserted });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { agentId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { provider, connection_type, external_id } = body;
    if (!provider || !connection_type || !external_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('agent_resources')
      .delete()
      .match({
        agent_id: agentId,
        provider: provider.toLowerCase(),
        connection_type: connection_type.toLowerCase(),
        external_id: external_id.toString(),
      });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}

