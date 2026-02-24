import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedMegaDemo() {
    console.log('🚀 MEGA SEED v4: FINAL STRIKE...');

    const orgSlug = 'verytis-test';
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single();
    const orgId = org?.id;

    if (!orgId) {
        console.error('❌ Org not found');
        return;
    }

    console.log(`🎯 Target Org: ${orgId}`);

    // Cleanup
    console.log('🧹 Cleaning up...');
    await supabase.from('monthly_reports').delete().eq('organization_id', orgId);
    await supabase.from('decisions').delete().eq('organization_id', orgId);
    await supabase.from('activity_logs').delete().eq('organization_id', orgId);
    await supabase.from('monitored_resources').delete().in('integration_id', (await supabase.from('integrations').select('id').eq('organization_id', orgId)).data?.map(i => i.id) || []);
    await supabase.from('integrations').delete().eq('organization_id', orgId);
    await supabase.from('team_members').delete().in('team_id', (await supabase.from('teams').select('id').eq('organization_id', orgId)).data?.map(t => t.id) || []);
    await supabase.from('teams').delete().eq('organization_id', orgId);
    await supabase.from('ai_agents').delete().eq('organization_id', orgId);

    // Connections cleanup
    const { data: users } = await supabase.from('profiles').select('id').eq('organization_id', orgId);
    if (users?.length > 0) {
        await supabase.from('connections').delete().in('user_id', users.map(u => u.id));
    }

    const staff = [
        { email: 'jane.cooper@verytis.com', name: 'Jane Cooper', role: 'manager', title: 'Head of Data Compliance', prov: 'slack' },
        { email: 'bob.foss@verytis.com', name: 'Robert Foss', role: 'member', title: 'Senior Security Architect', prov: 'github' },
        { email: 'alice.thorne@verytis.com', name: 'Alice Thorne', role: 'member', title: 'CISO', prov: 'slack' },
        { email: 'sarah.jenkins@verytis.com', name: 'Sarah Jenkins', role: 'member', title: 'Lead Product Manager', prov: 'trello' },
        { email: 'david.miller@verytis.com', name: 'David Miller', role: 'member', title: 'SRE Lead', prov: 'microsoft_teams' },
        { email: 'brooklyn.simmons@verytis.com', name: 'Brooklyn Simmons', role: 'member', title: 'Legal Auditor', prov: 'slack' }
    ];

    const staffIds = {};
    const { data: admin } = await supabase.from('profiles').select('id').eq('organization_id', orgId).eq('role', 'admin').limit(1).single();
    staffIds['admin'] = admin?.id;

    console.log('👥 Seeding users & passports...');
    for (const s of staff) {
        // Auth user
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: s.email,
            password: 'DemoPassword123!',
            email_confirm: true,
            user_metadata: { full_name: s.name }
        });

        const uid = authErr ? (await supabase.from('profiles').select('id').eq('email', s.email).single()).data?.id : authData.user.id;

        if (!uid) {
            console.error(`❌ Could not resolve ID for ${s.email}`);
            continue;
        }

        staffIds[s.name.split(' ')[0].toLowerCase()] = uid;

        // Profile
        const { error: pErr } = await supabase.from('profiles').upsert({
            id: uid,
            organization_id: orgId,
            email: s.email,
            full_name: s.name,
            job_title: s.title,
            role: s.role,
            status: 'active'
        });
        if (pErr) console.error(`❌ Profile error (${s.email}):`, pErr.message);

        // Connection (Passport)
        const { error: cErr } = await supabase.from('connections').upsert({
            user_id: uid,
            provider: s.prov,
            provider_user_id: `EXT_${uid.toString().substring(0, 8)}`,
            status: 'connected'
        });
        if (cErr) console.error(`❌ Connection error (${s.email}, prov: ${s.prov}):`, cErr.message);
    }

    // Teams
    console.log('🏗️ Seeding teams...');
    const teams = [
        { name: 'Architecture & Ops', type: 'operational' },
        { name: 'Security Response', type: 'operational' },
        { name: 'Governance & Risk', type: 'governance' }
    ];
    const { data: teamDocs, error: tErr } = await supabase.from('teams').insert(teams.map(t => ({
        ...t, organization_id: orgId
    }))).select();
    if (tErr) console.error('❌ Team error:', tErr.message);

    const teamLookup = {};
    teamDocs?.forEach(t => teamLookup[t.name] = t.id);

    // Memberships
    console.log('🔗 Seeding memberships...');
    const mRecords = [
        { t: 'Architecture & Ops', u: staffIds.bob, r: 'lead' },
        { t: 'Architecture & Ops', u: staffIds.admin, r: 'member' },
        { t: 'Security Response', u: staffIds.alice, r: 'lead' },
        { t: 'Governance & Risk', u: staffIds.jane, r: 'lead' }
    ];
    const { error: mErr } = await supabase.from('team_members').insert(mRecords.filter(r => r.u).map(r => ({
        team_id: teamLookup[r.t],
        user_id: r.u,
        role: r.r
    })));
    if (mErr) console.error('❌ Membership error:', mErr.message);

    // Integrations
    console.log('🔌 Seeding integrations...');
    const ints = [
        { provider: 'slack', name: 'Slack' },
        { provider: 'github', name: 'GitHub' },
        { provider: 'trello', name: 'Trello' },
        { provider: 'microsoft_teams', name: 'Teams' }
    ];
    const { data: intDocs, error: iErr } = await supabase.from('integrations').insert(ints.map(i => ({
        ...i, organization_id: orgId, external_id: `EXT_${i.provider}`
    }))).select();
    if (iErr) console.error('❌ Integration error:', iErr.message);

    const intLookup = {};
    intDocs?.forEach(i => intLookup[i.provider] = i.id);

    // Resources
    console.log('📦 Seeding resources...');
    const res = [
        { int: 'slack', name: 'general', type: 'channel', team: 'Architecture & Ops' },
        { int: 'github', name: 'repo-one', type: 'repo', team: 'Architecture & Ops' },
        { int: 'trello', name: 'board-one', type: 'folder', team: 'Governance & Risk' }
    ];
    const { data: resDocs, error: rErr } = await supabase.from('monitored_resources').insert(res.map(r => ({
        integration_id: intLookup[r.int],
        name: r.name,
        type: r.type,
        team_id: teamLookup[r.team],
        external_id: `EXT_${r.name}`,
        audit_level: 'full'
    }))).select();
    if (rErr) console.error('❌ Resource error:', rErr.message);

    const resLookup = {};
    resDocs?.forEach(r => resLookup[r.name] = r.id);

    // Activity
    console.log('📈 Seeding logs...');
    const { error: logErr } = await supabase.from('activity_logs').insert(Array.from({ length: 50 }).map((_, i) => ({
        organization_id: orgId,
        actor_id: i % 2 === 0 ? staffIds.bob : staffIds.admin,
        action_type: i % 5 === 0 ? 'SECURITY_FLAG' : 'COMMIT',
        resource_id: resLookup['repo-one'],
        summary: `Action ${i} performed`,
        created_at: new Date(Date.now() - i * 1000 * 60 * 60).toISOString()
    })));
    if (logErr) console.error('❌ Log error:', logErr.message);

    console.log('✅ ALL DONE.');
}

seedMegaDemo().catch(console.error);
