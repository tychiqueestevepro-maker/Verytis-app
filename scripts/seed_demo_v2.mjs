import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedDemoData() {
    console.log('--- STARTING COMPREHENSIVE DEMO SEED ---');

    // 1. Get the current Admin User mapping
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'admin')
        .limit(1)
        .single();

    if (!adminProfile) {
        console.error('No admin profile found. Please signup first.');
        return;
    }

    const orgId = adminProfile.organization_id;
    const adminId = adminProfile.id;
    console.log(`Targeting Organization: ${orgId}`);

    // 2. Create Mock Profiles (via Auth Admin)
    console.log('Seeding mock users via Auth Admin...');
    const usersToCreate = [
        { email: 'jane.manager@demo.com', password: 'Password123!', fullName: 'Jane Cooper', role: 'manager' },
        { email: 'bob.dev@demo.com', password: 'Password123!', fullName: 'Robert Fox', role: 'member' },
        { email: 'cameron.security@demo.com', password: 'Password123!', fullName: 'Cameron Williamson', role: 'member' }
    ];

    const seededUserIds = [];

    for (const u of usersToCreate) {
        const { data: { user }, error: uErr } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true,
            user_metadata: { full_name: u.fullName }
        });

        if (uErr) {
            console.log(`User ${u.email} might already exist:`, uErr.message);
            // Try to fetch the existing user
            // In a demo script we just continue or find them
        } else {
            seededUserIds.push({ id: user.id, role: u.role, fullName: u.fullName });

            // Explicitly insert profile (though trigger might handle it, we ensure role/org)
            await supabase.from('profiles').upsert({
                id: user.id,
                organization_id: orgId,
                email: u.email,
                full_name: u.fullName,
                role: u.role,
                status: 'active'
            });
        }
    }

    // Fallback if they existed
    if (seededUserIds.length < 3) {
        // If we can't create them, we'll try to find them
        const { data: existing } = await supabase.from('profiles').select('id, role').in('email', usersToCreate.map(u => u.email));
        existing?.forEach(e => {
            if (!seededUserIds.find(s => s.id === e.id)) seededUserIds.push(e);
        });
    }

    const janeId = seededUserIds.find(u => u.role === 'manager')?.id;
    const bobId = seededUserIds.find(u => u.email === 'bob.dev@demo.com' || u.role === 'member')?.id;
    const camId = seededUserIds.find(u => u.email === 'cameron.security@demo.com')?.id;

    // 3. Create Teams
    console.log('Seeding teams...');
    const teamsData = [
        { organization_id: orgId, name: 'Cloud Infrastructure', description: 'GCP/AWS governance and performance monitoring', type: 'operational' },
        { organization_id: orgId, name: 'Corporate Compliance', description: 'Legal audit trails and regulatory reporting', type: 'governance' },
        { organization_id: orgId, name: 'Product Engineering', description: 'Core application dev and feature governance', type: 'operational' }
    ];

    const { data: teams, error: tErr } = await supabase.from('teams').insert(teamsData).select();
    if (tErr) throw tErr;

    const infraTeam = teams.find(t => t.name.includes('Cloud'));
    const legalTeam = teams.find(t => t.name.includes('Corporate'));
    const prodTeam = teams.find(t => t.name.includes('Product'));

    // 4. Team Members
    console.log('Linking team members...');
    await supabase.from('team_members').insert([
        { team_id: infraTeam.id, user_id: adminId, role: 'lead' },
        { team_id: infraTeam.id, user_id: bobId, role: 'member' },
        { team_id: legalTeam.id, user_id: janeId, role: 'lead' },
        { team_id: legalTeam.id, user_id: adminId, role: 'member' },
        { team_id: prodTeam.id, user_id: bobId, role: 'member' },
        { team_id: prodTeam.id, user_id: janeId, role: 'member' }
    ]);

    // 5. Integrations
    console.log('Seeding integrations...');
    const integrationsData = [
        { organization_id: orgId, provider: 'slack', name: 'Verytis Enterprise Slack', external_id: 'T_ENT_001' },
        { organization_id: orgId, provider: 'github', name: 'GitHub Organization', external_id: 'verytis-corp' },
        { organization_id: orgId, provider: 'trello', name: 'Global Product Board', external_id: 'board_main' }
    ];

    const { data: ints, error: iErr } = await supabase.from('integrations').insert(integrationsData).select();
    if (iErr) throw iErr;

    const slackInt = ints.find(i => i.provider === 'slack');
    const githubInt = ints.find(i => i.provider === 'github');
    const trelloInt = ints.find(i => i.provider === 'trello');

    // 6. Monitored Resources
    console.log('Seeding resources...');
    const resourcesData = [
        { integration_id: slackInt.id, external_id: 'C_DASH_01', name: 'governance-alerts', type: 'channel', audit_level: 'full', team_id: infraTeam.id },
        { integration_id: slackInt.id, external_id: 'C_LEGAL_01', name: 'legal-audits', type: 'channel', audit_level: 'full', team_id: legalTeam.id },
        { integration_id: githubInt.id, external_id: 'GH_REPO_1', name: 'core-platform', type: 'repo', audit_level: 'full', team_id: infraTeam.id },
        { integration_id: githubInt.id, external_id: 'GH_REPO_2', name: 'auth-layer', type: 'repo', audit_level: 'full', team_id: prodTeam.id },
        { integration_id: trelloInt.id, external_id: 'TR_BOARD_1', name: 'Governance Roadmap', type: 'folder', audit_level: 'metadata_only', team_id: legalTeam.id }
    ];

    const { data: resources, error: rErr } = await supabase.from('monitored_resources').insert(resourcesData).select();
    if (rErr) throw rErr;

    const govAlertsRes = resources.find(r => r.name === 'governance-alerts');
    const coreRepoRes = resources.find(r => r.name === 'core-platform');
    const legalRes = resources.find(r => r.name === 'legal-audits');

    // 7. Connections
    console.log('Seeding connections...');
    await supabase.from('connections').insert([
        { user_id: adminId, provider: 'slack', provider_user_id: 'U_ADMIN', status: 'connected' },
        { user_id: adminId, provider: 'github', provider_user_id: 'U_GH_ADMIN', status: 'connected' },
        { user_id: janeId, provider: 'slack', provider_user_id: 'U_JANE', status: 'connected' },
        { user_id: bobId, provider: 'github', provider_user_id: 'U_BOB', status: 'connected' }
    ]);

    // 8. Activity Logs
    console.log('Seeding activity logs...');
    const logsData = [
        { organization_id: orgId, actor_id: bobId, action_type: 'COMMIT', resource_id: coreRepoRes.id, summary: 'Updated RLS guards for PII data', metadata: { sha: '7ab2c10', branch: 'main' } },
        { organization_id: orgId, actor_id: adminId, action_type: 'DEPLOYMENT', resource_id: coreRepoRes.id, summary: 'Production release v1.8.0 applied correctly', metadata: { environment: 'production' } },
        { organization_id: orgId, actor_id: janeId, action_type: 'APPROVAL', resource_id: legalRes.id, summary: 'Confirmed Q1 liability disclosure notice', metadata: { context: 'board-meeting' } },
        { organization_id: orgId, actor_id: adminId, action_type: 'INTEGRATION_SYNC', resource_id: govAlertsRes.id, summary: 'Recovered Slack webhook heartbeat', metadata: { status: 'healthy' } }
    ];

    await supabase.from('activity_logs').insert(logsData);

    // 9. Decisions
    console.log('Seeding decisions...');
    await supabase.from('decisions').insert([
        { organization_id: orgId, title: 'Compliance: Q1 Liability Disclosure', status: 'validated', actor_id: janeId, resource_id: legalRes.id },
        { organization_id: orgId, title: 'Release v1.8.0 - Guarded Deployment', status: 'validated', actor_id: adminId, resource_id: coreRepoRes.id }
    ]);

    // 10. AI Agents
    console.log('Seeding AI agents...');
    await supabase.from('ai_agents').insert([
        { organization_id: orgId, name: 'Governance Sentinel', description: 'Monitors Slack for policy violations', status: 'active' },
        { organization_id: orgId, name: 'Archivist Bot', description: 'Auto-generates PDF reports every month', status: 'active' }
    ]);

    console.log('--- DEMO SEED COMPLETED SUCCESSFULLY ---');
}

seedDemoData().catch(err => {
    console.error('Fatal seeding error:', err);
    process.exit(1);
});
