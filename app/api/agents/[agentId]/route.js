import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scrubText, scrubObject } from '@/lib/security/scrubber';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

async function registerShopifyWebhook({ shopDomain, accessToken, topic }) {
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    const address = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/shopify`;

    const res = await fetch(`https://${shopDomain}/admin/api/${apiVersion}/webhooks.json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
            webhook: {
                topic,
                address,
                format: 'json'
            }
        })
    });

    if (res.ok) return { ok: true };

    // Shopify returns 422 if webhook exists / invalid params etc.
    const json = await res.json().catch(() => ({}));
    if (res.status === 422) {
        return { ok: true, skipped: true, details: json };
    }
    return { ok: false, status: res.status, details: json };
}

async function ensureShopifyWebhooksForAgent({ agentId }) {
    const supabase = createAdminClient();

    const { data: agent } = await supabase
        .from('ai_agents')
        .select('id, status, visual_config')
        .eq('id', agentId)
        .maybeSingle();

    if (!agent?.visual_config?.nodes) return;

    const triggerNodes = agent.visual_config.nodes.filter(n =>
        n?.type === 'triggerNode' &&
        n?.data?.trigger_type === 'app' &&
        (n?.data?.provider || '').toLowerCase() === 'shopify' &&
        n?.data?.connection_id
    );

    if (triggerNodes.length === 0) return;

    for (const node of triggerNodes) {
        const connectionId = node.data.connection_id;
        const event = (node.data.event_name || '').toLowerCase();
        const topic = event || 'orders/create';

        const { data: conn } = await supabase
            .from('user_connections')
            .select('access_token, metadata')
            .eq('id', connectionId)
            .maybeSingle();

        const shopDomain = conn?.metadata?.store_url || conn?.metadata?.shop;
        const accessToken = conn?.access_token;
        if (!shopDomain || !accessToken) continue;

        await registerShopifyWebhook({ shopDomain, accessToken, topic });
    }
}

export async function GET(req, { params }) {
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
        const { agentId } = await params;
        const supabase = await createClient();
        const body = await req.json();
        const { status, policies, knowledge_configuration } = body;

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

        // Fetch current status to detect transitions
        const { data: beforeAgent } = await supabase
            .from('ai_agents')
            .select('status, name')
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id)
            .maybeSingle();

        // Build the update payload dynamically
        const updatePayload = {};

        // Handle status change (Active / Inactive)
        if (status) {
            if (!['active', 'inactive'].includes(status)) {
                return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }
            updatePayload.status = status;
        }

        // Handle policies update (Guardrails)
        if (policies) {
            // Merge with existing policies to allow partial updates
            const { data: existing } = await supabase
                .from('ai_agents')
                .select('policies')
                .eq('id', agentId)
                .eq('organization_id', profile.organization_id)
                .single();

            updatePayload.policies = { ...(existing?.policies || {}), ...policies };
        }
        
        if (knowledge_configuration) {
            updatePayload.knowledge_configuration = knowledge_configuration;
        }

        if (Object.keys(updatePayload).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        // Apply the update
        const { data: agent, error: updateError } = await supabase
            .from('ai_agents')
            .update(updatePayload)
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id)
            .select()
            .single();

        if (updateError) return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });

        // On activation, ensure Shopify webhooks exist (best-effort, non-blocking)
        if (status === 'active' && beforeAgent?.status !== 'active') {
            ensureShopifyWebhooksForAgent({ agentId }).catch(e => {
                console.error('[SHOPIFY] Webhook registration failed:', e.message);
            });
        }

        // Log security-sensitive actions to the audit trail
        if (status) {
            const redactedSummary = scrubText(`${agent.name} status changed to ${status}`);
            const redactedMetadata = scrubObject({
                agent_id: agentId,
                previous_status: beforeAgent?.status || 'unknown'
            });

            await supabase.from('activity_logs').insert({
                organization_id: profile.organization_id,
                actor_id: user.id,
                action_type: status === 'inactive' ? 'AGENT_PAUSED' : 'AGENT_REACTIVATED',
                summary: redactedSummary,
                metadata: redactedMetadata
            });
        }

        if (policies) {
            await supabase.from('activity_logs').insert({
                organization_id: profile.organization_id,
                actor_id: user.id,
                action_type: 'AGENT_POLICIES_UPDATED',
                summary: scrubText(`${agent.name} policies updated`),
                metadata: scrubObject({ agent_id: agentId, updated_fields: Object.keys(policies) })
            });
        }

        return NextResponse.json({ success: true, agent });

    } catch (error) {
        console.error('Error updating agent:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
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

        // Fetch agent name before deletion for the audit log
        const { data: agent } = await supabase
            .from('ai_agents')
            .select('name')
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id)
            .single();

        if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

        // Delete agent — the BEFORE DELETE trigger (fn_archive_on_delete) will
        // automatically snapshot the full agent record into archive_items
        const { error: deleteError } = await supabase
            .from('ai_agents')
            .delete()
            .eq('id', agentId)
            .eq('organization_id', profile.organization_id);

        if (deleteError) throw deleteError;

        // Log the deletion to the audit trail
        await supabase.from('activity_logs').insert({
            organization_id: profile.organization_id,
            actor_id: user.id,
            action_type: 'AGENT_DELETED',
            summary: scrubText(`Agent "${agent.name}" was permanently deleted and archived`),
            metadata: scrubObject({ agent_id: agentId, agent_name: agent.name })
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting agent:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
