import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * HEAD /api/webhooks/trello
 * Trello sends a HEAD request to verify the webhook URL exists.
 */
export async function HEAD() {
    return new NextResponse(null, { status: 200 });
}

/**
 * POST /api/webhooks/trello
 * 
 * Trello Webhook Handler — 6 Audit Actions (ISO 27001 / SOC2)
 * 
 * 1. CARD_MOVED      — Card moved between lists (validation)
 * 2. MEMBER_ASSIGNED — Member added to card (responsibility)
 * 3. ATTACHMENT_ADDED — File attached to card (specification)
 * 4. CHECKLIST_DONE  — Checklist item completed (protocol)
 * 5. CARD_COMPLETED  — Card marked as complete (due date)
 * 6. CARD_ARCHIVED   — Card archived (traceability)
 */
import fs from 'fs';
import path from 'path';

export async function POST(req) {
    const rawBody = await req.text();
    const logFile = path.join(process.cwd(), 'trello_debug.log');

    // Simple file logging for Trello events (keep for production audit trail if needed, or remove)
    const log = (msg) => {
        const timestamp = new Date().toISOString();
        // fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`); // Commented out to reduce I/O in prod
        console.log(`[Trello Webhook] ${msg}`);
    };

    // log('📨 Trello Webhook Received!');
    // log(`Headers: ${JSON.stringify(Object.fromEntries(req.headers))}`);

    try {
        // ── Security: Verify Trello Webhook Signature ───────────────
        const headerSignature = req.headers.get('x-trello-webhook');
        const secret = process.env.TRELLO_API_SECRET;
        const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/trello`;

        // log(`🔐 Verifying Signature...`);
        // log(`   - Callback URL: ${callbackUrl}`);
        // log(`   - Header Sig: ${headerSignature}`);

        if (secret && headerSignature) {
            const base64Digest = crypto
                .createHmac('sha1', secret)
                .update(rawBody + callbackUrl)
                .digest('base64');

            if (base64Digest !== headerSignature) {
                console.warn(`⚠️ Signature Mismatch! Expected: ${base64Digest}, Got: ${headerSignature}`);
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            } else {
                // log('✅ Signature Verified');
            }
        } else {
            console.warn('⚠️ Skipping signature check (missing details)');
        }

        const body = JSON.parse(rawBody);
        const action = body.action;

        if (!action) {
            // log('Testing connection (no action in body)');
            return NextResponse.json({ status: 'no_action' });
        }

        // 0. ATOMIC INSERT (Race Condition Prevention)
        // We use .upsert with onConflict on 'provider,external_id' which now has a UNIQUE constraint.
        if (action.id) {
            const { data: upsertData, error: upsertError } = await supabase.from('webhook_events').upsert({
                provider: 'trello',
                external_id: action.id,
                event_type: action.type,
                payload: body,
                status: 'completed'
            }, {
                onConflict: 'provider,external_id',
                ignoreDuplicates: true
            }).select('id');

            if (upsertError) {
                console.error(`❌ Failed to queue Trello event: ${action.id}`, upsertError);
                return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
            }

            if (!upsertData || upsertData.length === 0) {
                console.log(`⚠️ Trello Webhook Replay Detected (Event: ${action.id}). Skipping.`);
                return NextResponse.json({ status: 'already_processed' });
            }
        }

        const actionType = action.type;
        const actor = action.memberCreator;
        const actorName = actor?.fullName || actor?.username || 'Unknown';
        const board = action.data?.board;
        const card = action.data?.card;

        log(`📋 Action: ${actionType} by ${actorName} on board "${board?.name}"`);
        // Debug: Log data for updateCard and checklist events to understand structure
        // if (actionType === 'updateCard' || actionType.includes('CheckItem')) {
        //     log(`🔍 Data payload: ${JSON.stringify(action.data)}`);
        // }

        // ── Route Events ────────────────────────────────────────────

        // 1. CARD_MOVED — Card moved between lists (validation/workflow)
        if (actionType === 'updateCard' && action.data?.listAfter && action.data?.listBefore) {
            const listBefore = action.data.listBefore.name;
            const listAfter = action.data.listAfter.name;

            await logTrelloActivity(
                'CARD_MOVED',
                board,
                actor,
                `Moved "${card.name}" from "${listBefore}" to "${listAfter}"`,
                {
                    card_id: card.id,
                    card_name: card.name,
                    list_before: listBefore,
                    list_after: listAfter,
                    card_url: card.shortLink ? `https://trello.com/c/${card.shortLink}` : null
                }
            );
        }

        // 2. MEMBER_ASSIGNED — Member added to card (responsibility)
        else if (actionType === 'addMemberToCard') {
            const assignedMember = action.member || action.data?.member;
            const assignedName = assignedMember?.fullName || assignedMember?.username || 'a member';

            await logTrelloActivity(
                'MEMBER_ASSIGNED',
                board,
                actor,
                `Assigned ${assignedName} to "${card.name}"`,
                {
                    card_id: card.id,
                    card_name: card.name,
                    assigned_member: assignedName,
                    assigned_member_id: assignedMember?.id,
                    card_url: card.shortLink ? `https://trello.com/c/${card.shortLink}` : null
                }
            );
        }

        // 3. ATTACHMENT_ADDED — File attached to card (specification)
        else if (actionType === 'addAttachmentToCard') {
            const attachment = action.data?.attachment;

            await logTrelloActivity(
                'ATTACHMENT_ADDED',
                board,
                actor,
                `Added "${attachment?.name || 'file'}" to "${card.name}"`,
                {
                    card_id: card.id,
                    card_name: card.name,
                    attachment_name: attachment?.name,
                    attachment_url: attachment?.url,
                    card_url: card.shortLink ? `https://trello.com/c/${card.shortLink}` : null
                }
            );
        }

        // 5. CHECKLIST_DONE — Checklist item completed (protocol)
        else if (actionType === 'updateCheckItemStateOnCard' && action.data?.checkItem?.state === 'complete') {
            const checkItem = action.data.checkItem;
            const checklist = action.data.checklist;

            await logTrelloActivity(
                'CHECKLIST_DONE',
                board,
                actor,
                `Completed "${checkItem.name}" on "${card.name}"`,
                {
                    card_id: card.id,
                    card_name: card.name,
                    checklist_name: checklist?.name,
                    check_item: checkItem.name,
                    card_url: card.shortLink ? `https://trello.com/c/${card.shortLink}` : null
                }
            );
        }

        // 6. CARD_COMPLETED (Due Date) — Card marked as complete
        else if (actionType === 'updateCard' && action.data?.card?.dueComplete === true) {
            await logTrelloActivity(
                'CARD_COMPLETED',
                board,
                actor,
                `Marked "${card.name}" as complete`,
                {
                    card_id: card.id,
                    card_name: card.name,
                    card_url: card.shortLink ? `https://trello.com/c/${card.shortLink}` : null
                }
            );
        }

        // 5. CARD_ARCHIVED — Card archived (traceability)
        else if (actionType === 'updateCard' && action.data?.card?.closed === true && action.data?.old?.closed === false) {
            await logTrelloActivity(
                'CARD_ARCHIVED',
                board,
                actor,
                `Archived "${card.name}"`,
                {
                    card_id: card.id,
                    card_name: card.name,
                    card_url: card.shortLink ? `https://trello.com/c/${card.shortLink}` : null
                }
            );
        }

        else {
            console.log(`ℹ️ Ignoring Trello event: ${actionType}`);
            return NextResponse.json({ status: 'ignored' });
        }

        return NextResponse.json({ status: 'logged' });

    } catch (error) {
        console.error('Trello Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ── Helper: Log Trello Activity ─────────────────────────────────────────

async function logTrelloActivity(actionType, board, actor, summary, extraMetadata = {}) {
    let userId = null;
    let isVerified = false;
    let method = 'ANONYMOUS';
    let organizationId = null;
    let resourceId = null;

    // 1. Resolve resource from monitored_resources (by external_id = Trello board ID)
    if (board?.id) {
        const { data: resource } = await supabase
            .from('monitored_resources')
            .select('id, team_id, teams(organization_id)')
            .eq('external_id', board.id)
            .maybeSingle();

        if (resource) {
            resourceId = resource.id;
            organizationId = resource.teams?.organization_id;
            console.log(`📍 Trello Resource Found: ${resourceId} (Org: ${organizationId})`);
        } else {
            console.log(`⚠️ Trello board "${board.name}" (${board.id}) not found in monitored_resources`);
        }
    }

    // 2. Identify User (by Trello username in social_profiles JSONB)
    // Structure: social_profiles -> { trello: { username: "bob", id: "123", ... } }
    if (actor?.username) {
        const lowerUsername = actor.username.toLowerCase();

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .contains('social_profiles', { trello: { username: lowerUsername } })
            .maybeSingle();

        if (profile) {
            userId = profile.id;
            isVerified = true;
            method = 'SOCIAL_LINK';
            console.log(`✅ Identified Trello user: ${actor.username} -> ${userId}`);
        } else {
            console.log(`🕵️ Trello user not linked: ${actor.username}`);
        }
    }

    // 3. Insert Activity Log
    const { error: logError } = await supabase.from('activity_logs').insert({
        actor_id: userId,
        organization_id: organizationId,
        resource_id: resourceId,
        action_type: actionType,
        summary: `${summary} on ${board?.name || 'Trello'}`,
        metadata: {
            platform: 'Trello',
            board_name: board?.name,
            board_id: board?.id,
            trello_user: actor?.username || actor?.fullName,
            identification_method: method,
            is_anonymous: !isVerified,
            ...extraMetadata
        }
    });

    if (logError) {
        console.error(`❌ Error logging Trello activity:`, logError);
    } else {
        console.log(`🚀 Trello activity logged: ${actionType}`);

        // BROADCAST to frontend
        if (resourceId) {
            const { data: res } = await supabase
                .from('monitored_resources')
                .select('team_id')
                .eq('id', resourceId)
                .single();

            if (res?.team_id) {
                await supabase.channel(`team-activity-${res.team_id}`)
                    .send({
                        type: 'broadcast',
                        event: 'new_activity',
                        payload: { resourceId, actionType, summary }
                    });

                await supabase.channel(`resource-activity-${resourceId}`)
                    .send({
                        type: 'broadcast',
                        event: 'new_activity',
                        payload: { resourceId, actionType, summary }
                    });

                console.log(`📡 Broadcast sent for Trello ${actionType}`);
            }
        }
    }
}
