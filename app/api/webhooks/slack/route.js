import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- CONSTANTES DE PRÉSENTATION ---
const WELCOME_BLOCKS = [
    {
        type: "header",
        text: {
            type: "plain_text",
            text: "👋 Verytis Audit is active.",
            emoji: true
        }
    },
    {
        type: "section",
        text: {
            type: "mrkdwn",
            text: "I am here to secure your exchanges. I transform your informal decisions into a *certified audit trail*.\n\n*How does it work?* Simple: start your sentence with an emoji to give your message legal standing."
        }
    },
    {
        type: "divider"
    },
    {
        type: "section",
        text: {
            type: "mrkdwn",
            text: "*DECISION COMMANDS:*"
        }
    },
    {
        type: "section",
        fields: [
            {
                type: "mrkdwn",
                text: "*✅ APPROVE*\n`✅ / Action validation`\n_To validate a request._"
            },
            {
                type: "mrkdwn",
                text: "*❌ REJECT*\n`❌ / Proposal rejection`\n_To block a step._"
            }
        ]
    },
    {
        type: "section",
        fields: [
            {
                type: "mrkdwn",
                text: "*🔁 TRANSFER*\n`🔁 / Case delegation`\n_To delegate responsibility._"
            },
            {
                type: "mrkdwn",
                text: "*✏️ EDIT*\n`✏️ / Contract update`\n_To modify a plan._"
            }
        ]
    },
    {
        type: "section",
        fields: [
            {
                type: "mrkdwn",
                text: "*💬 COMMENT*\n`💬 / Context note`\n_To add context._"
            },
            {
                type: "mrkdwn",
                text: "*🗃️ ARCHIVE*\n`🗃️ / Project closure`\n_To close a topic._"
            }
        ]
    },
    {
        type: "divider"
    },
    {
        type: "context",
        elements: [
            {
                type: "mrkdwn",
                text: "📎 **Proofs:** Drag & drop a file (PDF/Image) with your message to certify it.\n🔒 **Security:** Only identified Verytis members can execute decisions. Messages from others are anonymized."
            }
        ]
    }
];

// --- 0. SÉCURITÉ & INTELLIGENCE ---
async function verifySlackRequest(req, rawBody) {
    const signature = req.headers.get('x-slack-signature');
    const timestamp = req.headers.get('x-slack-request-timestamp');

    if (!signature || !timestamp) return false;

    if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

    const basestring = `v0:${timestamp}:${rawBody}`;
    const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET).update(basestring).digest('hex');
    const calculatedSignature = `v0=${hmac}`;

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature));
}

async function sendSlackMessage(channel, content, threadTs = null) {
    if (!channel || !content) return;

    const body = {
        channel: channel,
        thread_ts: threadTs
    };

    if (typeof content === 'string') {
        body.text = content;
    } else if (Array.isArray(content)) {
        body.blocks = content;
        body.text = "Verytis Audit Instructions";
    }

    try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        // Log seulement si erreur, sinon ça pollue trop
        if (!data.ok) console.error("❌ Slack API Error:", data.error);
    } catch (e) {
        console.error("Erreur envoi Slack:", e);
    }
}

async function reactToMessage(channel, timestamp, emoji) {
    try {
        await fetch('https://slack.com/api/reactions.add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
            },
            body: JSON.stringify({
                channel: channel,
                timestamp: timestamp,
                name: emoji
            })
        });
    } catch (e) {
        console.error("Erreur réaction Slack:", e);
    }
}

function classifyMessage(text) {
    if (!text) return { type: 'DISCUSSION', content: "" };

    // 1. Clean formatting (mentions, bold *, code `)
    // We keep emojis but remove <@U123>
    let clean = text.replace(/<@[a-zA-Z0-9]+>/g, "").trim();



    // 2. Define Action Patterns (Regex for robustness)
    // Support Unicode AND Slack shortcodes (e.g. :white_check_mark:)
    // Also ignore optional "/" or "-" separators after emoji
    const patterns = [
        { type: 'APPROVE', regex: /(:white_check_mark:|✅|:check:|✔️|✓)\s*[\/\-]?\s*(.*)/i },
        { type: 'REJECT', regex: /(:x:|❌|:cross_mark:|✖️)\s*[\/\-]?\s*(.*)/i },
        { type: 'TRANSFER', regex: /(:repeat:|🔁|:arrows_counterclockwise:)\s*[\/\-]?\s*(.*)/i },
        { type: 'EDIT', regex: /(:pencil2:|✏️|:pencil:|📝)\s*[\/\-]?\s*(.*)/i },
        { type: 'COMMENT', regex: /(:speech_balloon:|💬|:thought_balloon:)\s*[\/\-]?\s*(.*)/i },
        { type: 'ARCHIVE', regex: /(:card_file_box:|🗃️|:archive:)\s*[\/\-]?\s*(.*)/i }
    ];

    for (const p of patterns) {
        const match = clean.match(p.regex);
        if (match) {
            return { type: p.type, content: match[2].trim() }; // match[2] captures the text after emoji
        }
    }

    return { type: 'DISCUSSION', content: clean };
}

async function handleFiles(files) {
    if (!files || files.length === 0) return [];
    const attachments = [];

    for (const file of files) {
        try {
            const response = await fetch(file.url_private_download, {
                headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
            });
            const buffer = await response.arrayBuffer();
            const fileName = `${Date.now()}_${file.name}`;

            const { data, error } = await supabase.storage
                .from('proofs')
                .upload(fileName, buffer, { contentType: file.mimetype });

            if (!error) {
                attachments.push({ name: file.name, url: data.path, type: file.mimetype });
            }
        } catch (err) { console.error("Erreur fichier:", err); }
    }
    return attachments;
}

// --- 3. LE CERVEAU CENTRAL ---
export async function POST(req) {
    try {
        const rawBody = await req.text();

        if (process.env.NODE_ENV === 'production') {
            const isAuthentic = await verifySlackRequest(req, rawBody);
            if (!isAuthentic) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
            }
        }

        const body = JSON.parse(rawBody);

        if (body.type === 'url_verification') return NextResponse.json({ challenge: body.challenge });

        if (body.type === 'event_callback') {
            const event = body.event;
            const eventId = body.event_id;

            // 0. IDEMPOTENCY: Persistent check via Database
            const { data: existingEvent } = await supabase
                .from('webhook_events')
                .select('id')
                .eq('provider', 'slack')
                .eq('external_id', eventId)
                .maybeSingle();

            if (existingEvent) {
                console.log(`⏭️ Skipping duplicate Slack event: ${eventId}`);
                return NextResponse.json({ status: 'already_processed' });
            }

            // Log entry into webhook_events for audit/idempotency
            await supabase.from('webhook_events').insert({
                provider: 'slack',
                external_id: eventId,
                event_type: event.type,
                payload: body,
                status: 'completed' // Slack is processed synchronously here
            });

            console.log(`🔔 Event: ${event.type} | User: ${event.user} | EventID: ${eventId}`);

            // 1. JOIN CHANNEL
            if (event.type === 'member_joined_channel') {
                // Fetch Bot ID to determine if it's the bot joining or a user
                let botId = null;
                try {
                    const authRes = await fetch('https://slack.com/api/auth.test', {
                        headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
                    });
                    const authData = await authRes.json();
                    if (authData.ok) botId = authData.user_id;
                } catch (e) { console.error("Auth test failed:", e); }

                const isBotJoining = event.user === botId;
                console.log(`👋 Join Event: User ${event.user} (Bot: ${botId})`);

                if (isBotJoining) {
                    // Bot joined -> Public Hello
                    console.log("🤖 Bot joined channel -> Sending PUBLIC Welcome");
                    await sendSlackMessage(event.channel, WELCOME_BLOCKS);
                } else {
                    // User joined -> Private DM
                    console.log("👤 User joined -> Sending PRIVATE Welcome (DM)");
                    await sendSlackMessage(event.user, WELCOME_BLOCKS);
                }
                return NextResponse.json({ status: 'welcome_processed' });
            }

            // 2. MESSAGES & MENTIONS
            // Handle regular messages, app mentions, and file shares
            const isFileShare = event.subtype === 'file_share';
            const isRegularMessage = !event.subtype;

            if ((event.type === 'message' || event.type === 'app_mention') && (isRegularMessage || isFileShare)) {

                // Ignorer les bots
                if (event.bot_id) return NextResponse.json({ status: 'ignored_bot' });

                // Log file info for debugging
                if (event.files && event.files.length > 0) {
                    console.log(`📎 Files detected: ${event.files.map(f => f.name).join(', ')}`);
                }

                // DÉTECTION COMMANDE D'AIDE (Hyper permissive)
                const textLower = event.text ? event.text.toLowerCase() : "";
                if (textLower.includes('help') || textLower.includes('aide')) {
                    console.log("🆘 WELCOME TRIGGERED BY HELP COMMAND");
                    // Answer in same channel (public or private)
                    await sendSlackMessage(event.channel, WELCOME_BLOCKS);
                    return NextResponse.json({ status: 'help_sent' });
                }

                // ... Reste de la logique d'auth et de logs ...
                const slackUserId = event.user;
                let userId = null;
                let isVerified = false;

                const { data: user } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('slack_user_id', slackUserId)
                    .single();

                if (user) {
                    userId = user.id;
                    isVerified = true;
                } else {
                    // --- MAGIE : AUTO-MATCHING PAR EMAIL ---
                    // 1. On demande à Slack : "Qui est ce user ?"
                    try {
                        const slackInfoRes = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
                            headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
                        });
                        const slackInfo = await slackInfoRes.json();

                        if (slackInfo.ok && slackInfo.user && slackInfo.user.profile.email) {
                            const email = slackInfo.user.profile.email;
                            console.log(`🔍 Unknown Slack ID. Checking email: ${email}...`);

                            // 2. On cherche cet email dans Supabase
                            const { data: profileByEmail } = await supabase
                                .from('profiles')
                                .select('id')
                                .eq('email', email)
                                .single();

                            if (profileByEmail) {
                                // 3. FUSION : On enregistre le Slack ID pour la prochaine fois
                                await supabase
                                    .from('profiles')
                                    .update({ slack_user_id: slackUserId })
                                    .eq('id', profileByEmail.id);

                                userId = profileByEmail.id;
                                isVerified = true;
                                console.log(`✨ MAGIC LINK SUCCESS: ${email} is now linked to ${slackUserId}`);

                                // Notification de succès en DM (Message Privé)
                                await sendSlackMessage(slackUserId, `👋 Compte lié avec succès ! Je vous ai reconnu via votre email *${email}*. Vos actions sont maintenant certifiées.`);
                            }
                        }
                    } catch (e) {
                        console.error("Erreur Auto-Link:", e);
                    }
                }

                const { type, content } = classifyMessage(event.text);
                const attachments = await handleFiles(event.files);

                let finalActionType = type;

                // If files are attached and no specific action emoji, classify as FILE_SHARED
                if (attachments.length > 0 && type === 'DISCUSSION') {
                    finalActionType = 'FILE_SHARED';
                } else if (!isVerified) {
                    finalActionType = (type === 'DISCUSSION') ? 'DISCUSSION_ANONYMOUS' : 'ATTEMPTED_ACTION_ANONYMOUS';
                }

                // Only log if it's an action, file share, or verified discussion
                const shouldLog = finalActionType !== 'DISCUSSION' && finalActionType !== 'DISCUSSION_ANONYMOUS';

                if (shouldLog && (content || attachments.length > 0)) {
                    // Build summary based on action type
                    let summary = content;
                    if (finalActionType === 'FILE_SHARED') {
                        const fileNames = attachments.map(a => a.name).join(', ');
                        summary = content || `Shared: ${fileNames}`;
                    }

                    // Get Slack user name for anonymous users
                    let slackUserName = null;
                    if (!isVerified) {
                        try {
                            const slackInfoRes = await fetch(`https://slack.com/api/users.info?user=${slackUserId}`, {
                                headers: { 'Authorization': `Bearer ${SLACK_BOT_TOKEN}` }
                            });
                            const slackInfo = await slackInfoRes.json();
                            if (slackInfo.ok && slackInfo.user) {
                                slackUserName = slackInfo.user.real_name || slackInfo.user.name || slackUserId;
                            }
                        } catch (e) {
                            console.error("Error fetching Slack user name:", e);
                        }
                    }

                    await supabase.from('activity_logs').insert({
                        actor_id: userId,
                        action_type: finalActionType,
                        summary: summary,
                        metadata: {
                            slack_channel: event.channel,
                            ts: event.ts,
                            attachments: attachments,
                            is_anonymous: !isVerified,
                            slack_user_id: slackUserId,
                            slack_user_name: slackUserName
                        }
                    });

                    console.log(`💾 Logged: [${finalActionType}] - ${attachments.length} files - User: ${slackUserName || userId || 'Unknown'}`);

                    // React to confirm logging
                    if (isVerified) {
                        if (finalActionType === 'FILE_SHARED') {
                            await reactToMessage(event.channel, event.ts, 'file_folder');
                        } else {
                            await reactToMessage(event.channel, event.ts, 'white_check_mark');
                        }
                    } else {
                        await sendSlackMessage(event.channel, ":detective: Action logged but *not verified*. Please link your Verytis account.", event.ts);
                    }
                }
            }
        }
        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Erreur:', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}
