import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedOrgData() {
    const orgId = '54cc5e49-bf47-4b9d-bce8-0442d06a464e'; // Verified Verytis HQ Org ID

    console.log(`Seeding data for Org: ${orgId}`);

    // 1. Create a Team
    const { data: team, error: tErr } = await supabase
        .from('teams')
        .insert({
            organization_id: orgId,
            name: 'Engineering',
            description: 'Core product team',
            type: 'operational'
        })
        .select()
        .single();

    if (tErr) console.error('Team error:', tErr);
    else console.log('Team created:', team.id);

    // 2. Create an Integration
    const { data: integration, error: iErr } = await supabase
        .from('integrations')
        .insert({
            organization_id: orgId,
            provider: 'slack',
            name: 'Verytis Slack',
            external_id: 'T12345SLACK'
        })
        .select()
        .single();

    if (iErr) console.error('Integration error:', iErr);
    else console.log('Integration created:', integration.id);

    // 3. Create a Monitored Resource
    const { data: resource, error: rErr } = await supabase
        .from('monitored_resources')
        .insert({
            integration_id: integration.id,
            external_id: 'C12345GEN',
            name: 'general',
            type: 'channel',
            team_id: team.id,
            audit_level: 'full'
        })
        .select()
        .single();

    if (rErr) console.error('Resource error:', rErr);
    else console.log('Resource created:', resource.id);

    // 4. Create an AI Agent
    const { data: agent, error: aErr } = await supabase
        .from('ai_agents')
        .insert({
            organization_id: orgId,
            name: 'CodeReviewer Bot',
            description: 'Automated PR reviewer',
            api_key_hash: 'hash_test_' + Math.random().toString(36).substring(7),
            status: 'active'
        })
        .select()
        .single();

    if (aErr) console.error('Agent error:', aErr);
    else console.log('Agent created:', agent.id);

    // 5. Create some Activity Logs
    const { error: lErr } = await supabase
        .from('activity_logs')
        .insert([
            {
                organization_id: orgId,
                action_type: 'COMMIT',
                resource_id: resource.id,
                summary: 'Pushed 3 commits to general',
                metadata: { branch: 'main' }
            },
            {
                organization_id: orgId,
                action_type: 'AI_TELEMETRY',
                agent_id: agent.id,
                summary: 'Agent analyzed PR #12',
                metadata: { tokens: 1500 }
            }
        ]);

    if (lErr) console.error('Logs error:', lErr);
    else console.log('Activity logs seeded.');
}

seedOrgData();
