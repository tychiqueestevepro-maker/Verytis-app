import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeClient } from '@/lib/stripe';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const supabase = createAdminClient();

export async function POST(req) {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        console.error('[STRIPE WEBHOOK] Missing signature or webhook secret');
        return NextResponse.json({ error: 'Config Error' }, { status: 400 });
    }

    let event;
    try {
        const stripe = getStripeClient();
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
        console.error(`[STRIPE WEBHOOK] Signature verification failed: ${err.message}`);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const eventType = event.type;
    const stripeAccountId = event.account; // Present if it's a Connect event
    const payload = event.data.object;
    const metadata = payload.metadata || {};

    console.log(`[STRIPE WEBHOOK] Received event: ${eventType} ${stripeAccountId ? `(Account: ${stripeAccountId})` : ''}`);

    // 1. Idempotency Check
    const { data: existingEvent, error: upsertError } = await supabase.from('webhook_events').upsert({
        provider: 'stripe',
        external_id: event.id,
        event_type: eventType,
        payload: event,
        status: 'completed'
    }, {
        onConflict: 'provider,external_id',
        ignoreDuplicates: true
    }).select('id').maybeSingle();

    if (upsertError) {
        console.error('[STRIPE WEBHOOK] Persistence Failure:', upsertError.message);
        return NextResponse.json({ error: 'Persistence Failure' }, { status: 500 });
    }
    if (!existingEvent) {
        return NextResponse.json({ status: 'already_processed' });
    }

    // 2. Identify Target Organization(s)
    // We look for Stripe connections. If it's a Connect event, we match by stripe_account_id in metadata.
    // Otherwise, we might need to rely on metadata inside the event or a global connection.
    const { data: connections } = await supabase
        .from('user_connections')
        .select('id, organization_id, metadata')
        .eq('provider', 'stripe');

    const matchingConnectionIds = (connections || [])
        .filter(c => {
            if (stripeAccountId) {
                return (c.metadata?.stripe_account_id === stripeAccountId);
            }
            // If No account ID, we might match by some metadata field linked to the org
            return true; // Fallback to all Stripe connections if not distinguished (usually one per org)
        })
        .map(c => c.id);

    if (matchingConnectionIds.length === 0) {
        console.warn('[STRIPE WEBHOOK] No matching Stripe connection found for this event');
        return NextResponse.json({ status: 'no_matching_connection' });
    }

    // 3. Find Active Agents with Stripe Triggers
    const { data: agents } = await supabase
        .from('ai_agents')
        .select('id, visual_config, status')
        .eq('status', 'active');

    const activeAgents = (agents || []).filter(a => {
        const nodes = a.visual_config?.nodes || [];
        return nodes.some(n =>
            n?.type === 'triggerNode' &&
            n?.data?.trigger_type === 'app' &&
            (n?.data?.provider || '').toLowerCase() === 'stripe' &&
            (n?.data?.event_name || '').toLowerCase() === eventType &&
            matchingConnectionIds.includes(n?.data?.connection_id)
        );
    });

    console.log(`[STRIPE WEBHOOK] Routing to ${activeAgents.length} agents`);

    // 4. Trigger Executions
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    await Promise.all(activeAgents.map(a => 
        fetch(`${baseUrl}/api/run/agt_live_${a.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-cron-token': process.env.CRON_SECRET
            },
            body: JSON.stringify({
                message: `[STRIPE EVENT: ${eventType}]\n\nDetails: ${JSON.stringify(payload, null, 2)}`
            })
        }).catch(err => console.error(`[STRIPE WEBHOOK] Failed to trigger agent ${a.id}:`, err.message))
    ));

    return NextResponse.json({ 
        status: 'ok', 
        event_id: event.id,
        triggered_agents: activeAgents.length 
    });
}
