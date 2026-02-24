import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ORG_ID = '1abe99cd-78ae-4f6a-b839-c44e68e408d1';

const AGENTS = [
    { id: 'bc039795-3b9c-446b-ba63-54569c916ed4', name: 'Sentinel-Bot' },
    { id: 'e8f90eff-19ec-4983-98b6-d8361d56f8d1', name: 'Sentinel-Bot' },
    { id: 'b9552bf1-1024-44e5-85b4-c82552435a5f', name: 'Flow-Optimizer' },
    { id: '67f5a817-9c16-477e-8b53-585a70a9fd0b', name: 'Sentinel-Bot' },
    { id: 'fa650284-9af9-48ae-b4be-69cd979874d8', name: 'Sentinel-Bot' }
];

const HUMAN_ID = 'e1082d2f-2405-4165-a451-b274c7e46717'; // Marcus Thorne

async function seedTelemetry() {
    console.log('🚀 Seeding AI Agent Telemetry (Enterprise Edition)...');

    // Clear old telemetry to avoid mess
    await supabase.from('activity_logs')
        .delete()
        .eq('organization_id', ORG_ID)
        .eq('action_type', 'AI_TELEMETRY');

    for (const agent of AGENTS) {
        const traceId = `trace-${Math.random().toString(36).substring(7)}`;

        const steps = [
            {
                step: 'INPUT_RECEIVED',
                message: 'Processing new security alert from #security-alerts',
                summary: 'Input Received',
                status: 'CLEAN',
                platform: 'slack'
            },
            {
                step: 'TOOL_CALL',
                message: 'Querying vector DB for relevant compliance rules',
                summary: 'Context Search',
                cognitive_load: { tools_called: ['vector-search'] },
                status: 'CLEAN',
                platform: 'internal_db'
            },
            {
                step: 'THOUGHT',
                message: 'The alert matches CVE-2026-1123 pattern. Escalation required.',
                summary: 'Cognitive Processing',
                status: 'CLEAN',
                platform: 'agent_brain'
            },
            {
                step: 'ACTION',
                message: 'Posting escalation to #security-audits',
                summary: 'Action Executed',
                cognitive_load: { tools_called: ['slack-api'] },
                status: 'CLEAN',
                platform: 'slack',
                verified: Math.random() > 0.7
            }
        ];

        // Specific logs for Flow-Optimizer
        if (agent.name === 'Flow-Optimizer') {
            steps[0] = { step: 'GITHUB_WEBHOOK', message: 'Detecting deployment of verytis-core', summary: 'Webhook Received', status: 'CLEAN', platform: 'github' };
            steps[1] = { step: 'SCANNING', message: 'Running static analysis on IaC changes', summary: 'Security Scan', cognitive_load: { tools_called: ['tfsec', 'checkov'] }, status: 'CLEAN', platform: 'github_actions' };
            steps[2] = { step: 'VERDICT', message: 'Deployment safe. No critical drifts found.', summary: 'Decision Made', status: 'CLEAN', platform: 'agent_brain' };
            steps[3] = { step: 'MERGE', message: 'Automated merge authorized', summary: 'Merge Executed', status: 'CLEAN', platform: 'github', verified: true };

            // Add a cross-platform jump
            steps.push({
                step: 'NOTIFICATION',
                message: 'Informing DevOps team about successful merge',
                summary: 'Status Update',
                status: 'CLEAN',
                platform: 'slack'
            });
        }

        // Add some noise: periodic "BLOCKED" events
        if (Math.random() > 0.8) {
            steps.push({
                step: 'SECURITY_VIOLATION',
                message: 'Agent attempted to access restricted /etc/shadow file via Trello attachment',
                summary: 'Guardrail Violation',
                status: 'BLOCKED'
            });
        }

        for (let i = 0; i < steps.length; i++) {
            const stepData = steps[i];
            const { error } = await supabase.from('activity_logs').insert({
                organization_id: ORG_ID,
                agent_id: agent.id,
                actor_id: stepData.verified ? HUMAN_ID : null, // If verified, link to human
                action_type: 'AI_TELEMETRY',
                summary: stepData.summary,
                metadata: {
                    trace_id: traceId,
                    step: stepData.step,
                    message: stepData.message,
                    status: stepData.status,
                    platform: stepData.platform,
                    metrics: {
                        tokens_used: Math.floor(Math.random() * 500) + 100,
                        cost_usd: (Math.random() * 0.05).toFixed(4),
                        duration_ms: Math.floor(Math.random() * 2000) + 200
                    },
                    cognitive_load: stepData.cognitive_load || { retry_count: 0, tools_called: [] },
                    ai_context: {
                        model: agent.name === 'Flow-Optimizer' ? 'claude-3-5-sonnet' : (Math.random() > 0.5 ? 'gpt-4o' : 'gemini-1.5-pro'),
                        provider: agent.name === 'Flow-Optimizer' ? 'anthropic' : (Math.random() > 0.5 ? 'openai' : 'google'),
                        temperature: 0
                    }
                },
                created_at: new Date(Date.now() - (steps.length - i) * 60000).toISOString()
            });

            if (error) console.error(`Error inserting telemetry for ${agent.name}:`, error);
        }
    }

    console.log('✅ AI Agent Telemetry (Enterprise Edition) seeded!');
}

seedTelemetry();
