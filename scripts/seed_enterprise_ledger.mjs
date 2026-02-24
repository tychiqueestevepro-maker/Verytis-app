import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.log('No .env.local found, hoping process.env has SUPABASE credentials.');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const fullEnterpriseLedger = [
    // --- ACTIVITÉ RÉCENTE (Les 15 dernières minutes) ---
    {
        id: "evt_9950",
        timestamp: "2026-02-21T10:45:12.334Z",
        trace_id: "TRC-8827",
        actor: { name: "SecOps-Scanner", type: "AI_AGENT", model: "llama-3-70b" },
        action_event: "AWS_S3_SCAN",
        resource: "arn:aws:s3:::prod-customer-data",
        validator: { status: "AUTO", label: "System Auto-Run" },
        secure_hash: "0x1a2b...9c8d",
        execution_trace: [
            { step: "THINKING", time: "10:45:10", message: "Initiating compliance scan on PII bucket.", tokens: "↑ 100 | ↓ 50", cost: "$0.00" },
            { step: "SUCCESS", time: "10:45:12", message: "Zero public access anomalies detected.", tokens: "↑ 400 | ↓ 20", cost: "$0.01" }
        ]
    },
    {
        id: "evt_9949",
        timestamp: "2026-02-21T10:42:05.112Z",
        trace_id: "TRC-8826",
        actor: { name: "Sarah Connor (CTO)", type: "HUMAN", role: "Admin" },
        action_event: "SLACK_FILE_SHARE",
        resource: "Channel: #external-partners",
        validator: { status: "BLOCKED", label: "Blocked by DLP (PII Detected)" },
        secure_hash: "0x4f5a...11b2",
        execution_trace: null // Humain bloqué par le système
    },
    {
        id: "evt_9948",
        timestamp: "2026-02-21T10:38:44.890Z",
        trace_id: "TRC-8825",
        actor: { name: "Auto-Deployer-Agent", type: "AI_AGENT", model: "gpt-4o" },
        action_event: "GITHUB_DIRECT_PUSH",
        resource: "repo: core-api / branch: main",
        validator: { status: "BLOCKED", label: "Blocked by Policy (No direct push)" },
        secure_hash: "0x9a8b...4f21",
        execution_trace: [
            { step: "THINKING", time: "10:38:42", message: "Analyzing urgent hotfix requirement.", tokens: "↑ 400 | ↓ 150", cost: "$0.01" },
            { step: "TOOL_CALL", time: "10:38:43", message: "Attempting git push origin main --force", tokens: "↑ 100 | ↓ 50", cost: "$0.00" },
            { step: "ERROR", time: "10:38:44", message: "Verytis Policy Violation: Direct push to protected branch denied.", isError: true }
        ]
    },

    // --- LE CŒUR DE LA MATINÉE (Maker-Checker & Ops) ---
    {
        id: "evt_9947",
        timestamp: "2026-02-21T09:42:10.000Z",
        trace_id: "TRC-8824",
        actor: { name: "Code-Reviewer-Bot", type: "AI_AGENT", model: "claude-3-haiku" },
        action_event: "GITHUB_PR_MERGE",
        resource: "PR #142 (auth_hotfix)",
        validator: { status: "APPROVED", label: "Validated by Mike Ross" },
        secure_hash: "0x8f4d...3a1c",
        execution_trace: [
            { step: "THINKING", time: "09:40:00", message: "Code looks secure. Vulnerability patched.", tokens: "↑ 2.1k | ↓ 400", cost: "$0.02" },
            { step: "PENDING", time: "09:40:05", message: "Requesting human approval as per SOC2 rules...", tokens: "-", cost: "-" },
            { step: "HUMAN_ACTION", time: "09:42:10", message: "Mike Ross clicked 'Approve & Merge'", tokens: "-", cost: "-" }
        ]
    },
    {
        id: "evt_9946",
        timestamp: "2026-02-21T09:15:22.001Z",
        trace_id: "TRC-8823",
        actor: { name: "Jira-Triage-Bot", type: "AI_AGENT", model: "gpt-4o-mini" },
        action_event: "JIRA_TICKET_UPDATE",
        resource: "Issue: SEC-42 (Auth bypass)",
        validator: { status: "AUTO", label: "Auto-Approved" },
        secure_hash: "0x2b3c...77ef",
        execution_trace: [
            { step: "THINKING", time: "09:15:20", message: "New bug reported. Classifying priority.", tokens: "↑ 800 | ↓ 50", cost: "$0.00" },
            { step: "TOOL_CALL", time: "09:15:21", message: "Updating Jira status to 'CRITICAL' and assigning to SecOps.", tokens: "↑ 200 | ↓ 20", cost: "$0.00" },
            { step: "SUCCESS", time: "09:15:22", message: "Ticket routed successfully.", tokens: "-", cost: "-" }
        ]
    },
    {
        id: "evt_9945",
        timestamp: "2026-02-21T08:50:09.334Z",
        trace_id: "TRC-8822",
        actor: { name: "Tychique Esteve", type: "HUMAN", role: "Admin" },
        action_event: "IAM_ROLE_UPGRADE",
        resource: "User: Alex Chen -> DevOps Lead",
        validator: { status: "APPROVED", label: "MFA Verified (Hardware Key)" },
        secure_hash: "0x4d5e...11f0",
        execution_trace: null
    },

    // --- LE CAS DE FRICTION POUR LE COO (Gaspillage Financier) ---
    {
        id: "evt_9944",
        timestamp: "2026-02-21T08:14:05.000Z",
        trace_id: "TRC-8821",
        actor: { name: "Customer-Support-Bot", type: "AI_AGENT", model: "gpt-4o" },
        action_event: "STRIPE_REFUND",
        resource: "Invoice #INV-2026-882",
        validator: { status: "AUTO", label: "Auto-Approved (< $50 limit)" },
        secure_hash: "0xc1b2...99ea",
        execution_trace: [
            { step: "THINKING", time: "08:13:50", message: "Customer requested refund. Checking eligibility.", tokens: "↑ 1.2k | ↓ 200", cost: "$0.03" },
            { step: "TOOL_CALL", time: "08:13:52", message: "Calling Stripe API refund endpoint", tokens: "↑ 300 | ↓ 100", cost: "$0.01" },
            { step: "ERROR", time: "08:13:55", message: "Stripe API Error 401: Unauthorized key", isError: true },
            { step: "THINKING", time: "08:14:00", message: "Retrying with fallback API key...", tokens: "↑ 800 | ↓ 150", cost: "$0.02" },
            { step: "SUCCESS", time: "08:14:05", message: "Refund processed successfully.", tokens: "↑ 200 | ↓ 50", cost: "$0.01" }
        ]
    },

    // --- LA NUIT / TÂCHES DE FOND ---
    {
        id: "evt_9943",
        timestamp: "2026-02-21T03:00:00.000Z",
        trace_id: "TRC-8820",
        actor: { name: "DB-Maintenance-Bot", type: "AI_AGENT", model: "claude-3-haiku" },
        action_event: "AWS_RDS_SNAPSHOT",
        resource: "Cluster: prod-db-eu-west",
        validator: { status: "AUTO", label: "Scheduled Cron" },
        secure_hash: "0x77aa...22cc",
        execution_trace: [
            { step: "TOOL_CALL", time: "03:00:00", message: "Triggering automated RDS snapshot.", tokens: "↑ 150 | ↓ 10", cost: "$0.00" }
        ]
    },
    {
        id: "evt_9942",
        timestamp: "2026-02-20T23:15:44.000Z",
        trace_id: "TRC-8819",
        actor: { name: "Mike Ross", type: "HUMAN", role: "Backend Lead" },
        action_event: "GITHUB_CLONE",
        resource: "repo: payment-gateway",
        validator: { status: "APPROVED", label: "VPN Verified" },
        secure_hash: "0x33bb...99dd",
        execution_trace: null
    },
    {
        id: "evt_9941",
        timestamp: "2026-02-20T22:45:10.000Z",
        trace_id: "TRC-8818",
        actor: { name: "Mike Ross", type: "HUMAN", role: "Backend Lead" },
        action_event: "SLACK_MESSAGE",
        resource: "Channel: #dev-alerts",
        validator: { status: "AUTO", label: "Standard Auth" },
        secure_hash: "0x88ee...44ff",
        execution_trace: null
    }
];

async function seed() {
    console.log("Fetching first organization...");
    const { data: org, error: orgError } = await supabase.from('organizations').select('id').limit(1).single();
    if (orgError) {
        console.error("Failed to fetch org:", orgError);
        return;
    }
    const orgId = org.id;

    // 1. Ensure Agents exist
    const agentMap = {};
    for (const evt of fullEnterpriseLedger) {
        if (evt.actor.type === 'AI_AGENT') {
            if (!agentMap[evt.actor.name]) {
                const dummyHash = `hash_${evt.actor.name.toLowerCase().replace(/\s+/g, '_')}`;
                const { data: agent, error } = await supabase.from('ai_agents').upsert({
                    organization_id: orgId,
                    name: evt.actor.name,
                    description: `Automated agent using ${evt.actor.model}`,
                    api_key_hash: dummyHash,
                    status: 'active'
                }, { onConflict: 'api_key_hash' }).select().single();

                if (agent) {
                    agentMap[evt.actor.name] = agent.id;
                } else {
                    console.error(`Failed to upsert agent ${evt.actor.name}:`, error?.message);
                }
            }
        }
    }

    // 2. Insert Events
    console.log("Inserting Enterprise Ledger events...");
    for (const evt of fullEnterpriseLedger) {
        let actorId = null;
        let agentId = null;

        if (evt.actor.type === 'AI_AGENT') {
            agentId = agentMap[evt.actor.name];
        } else {
            const { data: profile } = await supabase.from('profiles').select('id').eq('full_name', evt.actor.name).single();
            if (profile) actorId = profile.id;
        }

        const logData = {
            organization_id: orgId,
            action_type: evt.action_event,
            summary: evt.resource,
            actor_id: actorId, // UUID or null
            agent_id: agentId, // UUID or null
            metadata: {
                trace_id: evt.trace_id,
                validator: evt.validator,
                secure_hash: evt.secure_hash,
                execution_trace: evt.execution_trace,
                status: evt.validator.status === 'BLOCKED' ? 'BLOCKED' : (evt.validator.status === 'APPROVED' ? 'REVIEWED' : 'CLEAN'),
                github_user: evt.actor.type === 'HUMAN' && !actorId ? evt.actor.name : undefined // fallback if profile not found
            },
            created_at: evt.timestamp
        };

        const { error } = await supabase.from('activity_logs').insert(logData);
        if (error) console.error(`Error inserting ${evt.id}:`, error);
        else console.log(`Inserted ${evt.id}`);
    }

    console.log("Done.");
}

seed();
