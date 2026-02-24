import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORG_ID = '1abe99cd-78ae-4f6a-b839-c44e68e408d1';

const actions = [
    // --- Engineering & Cloud Ops ---
    {
        actor: 'Marcus Thorne',
        actor_id: 'e1082d2f-2405-4165-a451-b274c7e46717',
        resource_id: 'beb3fcc6-983e-4785-8ced-3b3327018671', // verytis-core
        action_type: 'CODE_PUSH',
        summary: 'Pushed 3 commits to main: [CORE-124] Refactor auth middleware',
        meta: { repo: 'verytis-core', branch: 'main' }
    },
    {
        actor: 'Sophie Chen',
        actor_id: '2415f3e3-e37c-419e-9c61-da6b2bccdace',
        resource_id: '77838776-c216-44d9-8fe1-3a174da03542', // verytis-monorepo
        action_type: 'OPEN_PR',
        summary: 'Opened PR #442: Feature/multi-tenant-billing-v2',
        meta: { repo: 'verytis-monorepo', pr_number: 442 }
    },
    {
        actor: 'Oliver Wright',
        actor_id: '3997c48f-4806-4782-a3c1-2bba676076cf',
        resource_id: '1c579ab1-032a-4b90-abc8-d889272a6e15', // Sprint-Backlog (tr_board_2)
        action_type: 'CARD_MOVED',
        summary: 'Moved card "Optimization: DB Indexing" to Doing',
        meta: { board_id: 'tr_board_2', platform: 'Trello', card: 'Optimization: DB Indexing', list: 'Doing' }
    },
    {
        actor: 'Mia Thompson',
        actor_id: 'c1fdc776-f4cf-4382-9ffa-ebf552ffc4f0',
        resource_id: '03c4a889-941d-40b7-a508-f96330323235', // 2026-Product-Roadmap (tr_board_1)
        action_type: 'COMMENT',
        summary: 'Added comment on "Q3 Infrastructure Scaling": Approved by CTO',
        meta: { board_id: 'tr_board_1', platform: 'Trello', card: 'Q3 Infrastructure Scaling' }
    },

    // --- Security & Compliance ---
    {
        actor: 'Mia Thompson',
        actor_id: 'c1fdc776-f4cf-4382-9ffa-ebf552ffc4f0',
        resource_id: '20873b8d-a690-4f8f-a9df-c33f479996e2', // infra-as-code
        action_type: 'CODE_PUSH',
        summary: 'Updated Terraform: Increased WAF rules strictness',
        meta: { repo: 'infra-as-code', branch: 'security-patch' }
    },
    {
        actor: 'Alice Thorne',
        actor_id: '2f42cbe8-b162-4132-8a20-67f7ff8ed957',
        resource_id: 'eec66b7b-ebd0-49ce-b60e-7c9a2543e16a', // audit-ledger-sdk
        action_type: 'CODE_PUSH',
        summary: 'Closed Issue #89: Fix CVE-2026-9932 vulnerability',
        meta: { repo: 'audit-ledger-sdk', issue: 89 }
    },

    // --- Slack Actions ---
    {
        actor: 'Marcus Thorne',
        actor_id: 'e1082d2f-2405-4165-a451-b274c7e46717',
        resource_id: '414f2671-9a77-46c0-b4a7-7a702884dfa0', // security-alerts
        action_type: 'APPROVE',
        summary: 'Approved Firewall Rule Change: Allow traffic on port 443',
        meta: { slack_channel: 'sl_1', slack_user_name: 'Marcus Thorne' }
    },
    {
        actor: 'Sophie Chen',
        actor_id: '2415f3e3-e37c-419e-9c61-da6b2bccdace',
        resource_id: 'd0064ea9-c24f-44f8-8ca8-e6083b82097a', // security-audits
        action_type: 'COMMENT',
        summary: 'Reviewing audit logs for Q1: No anomalies detected so far.',
        meta: { slack_channel: 'sl_chan_1', slack_user_name: 'Sophie Chen' }
    },
    {
        actor: 'Mia Thompson',
        actor_id: 'c1fdc776-f4cf-4382-9ffa-ebf552ffc4f0',
        resource_id: '414f2671-9a77-46c0-b4a7-7a702884dfa0', // security-alerts
        action_type: 'REJECT',
        summary: 'Rejected SSH Access Request: Missing justification',
        meta: { slack_channel: 'sl_1', slack_user_name: 'Mia Thompson' }
    },
    {
        actor: 'Oliver Wright',
        actor_id: '3997c48f-4806-4782-a3c1-2bba676076cf',
        resource_id: '4a5ddbf1-07ba-40b6-b9c6-3e46418f3868', // engineering-general
        action_type: 'TRANSFER',
        summary: 'Transferred Ownership: Database migration task moved to Cloud Ops',
        meta: { slack_channel: 'sl_chan_3', slack_user_name: 'Oliver Wright' }
    }
];

async function seedActions() {
    console.log('🚀 Seeding demo actions (V2)...');

    // First clear old logs for this org to avoid duplicates or mess
    await supabase.from('activity_logs').delete().eq('organization_id', ORG_ID);

    for (const item of actions) {
        const { error } = await supabase.from('activity_logs').insert({
            organization_id: ORG_ID,
            actor_id: item.actor_id,
            action_type: item.action_type,
            resource_id: item.resource_id,
            summary: item.summary,
            metadata: item.meta,
            created_at: new Date(Date.now() - Math.random() * 1000 * 60 * 10).toISOString() // Random time within last 10 mins for "Just now" effect
        });

        if (error) console.error('Error inserting action:', error);
    }

    console.log('✅ Demo actions created!');
}

seedActions();
