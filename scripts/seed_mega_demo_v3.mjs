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

async function seedMegaDemo() {
    console.log('🚀 DEPLOYING ROBUST MEGA DEMO v3...');

    // 1. Identify Target Organization
    const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', 'verytis-test')
        .single();

    let orgId = org?.id;
    if (!orgId) {
        const { data: admin } = await supabase.from('profiles').select('organization_id').eq('role', 'admin').limit(1).single();
        orgId = admin?.organization_id;
    }

    if (!orgId) {
        console.error('❌ No target organization found.');
        return;
    }

    console.log(`🎯 Target Organization ID: ${orgId}`);

    // 2. WIPE PREVIOUS DATA (Strict cleanup)
    console.log('🧹 Wiping organization data...');
    const tablesToClear = [
        'monthly_reports',
        'decisions',
        'activity_logs',
        'monitored_resources',
        'integrations',
        'team_members',
        'teams',
        'ai_agents',
        'connections' // Clean passports too
    ];

    for (const table of tablesToClear) {
        if (table === 'connections') {
            // Only clean connections for users in this org
            const { data: orgUsers } = await supabase.from('profiles').select('id').eq('organization_id', orgId);
            const userIds = orgUsers?.map(u => u.id) || [];
            if (userIds.length > 0) {
                await supabase.from('connections').delete().in('user_id', userIds);
            }
        } else {
            await supabase.from(table).delete().eq('organization_id', orgId);
        }
    }

    // 3. SEED STAFF
    console.log('👥 Seeding elite workforce...');
    const staff = [
        { email: 'jane.cooper@verytis.com', name: 'Jane Cooper', role: 'manager', title: 'Head of Data Compliance', prov: 'slack' },
        { email: 'bob.foss@verytis.com', name: 'Robert Foss', role: 'member', title: 'Senior Security Architect', prov: 'github' },
        { email: 'alice.thorne@verytis.com', name: 'Alice Thorne', role: 'member', title: 'CISO', prov: 'slack' },
        { email: 'sarah.jenkins@verytis.com', name: 'Sarah Jenkins', role: 'member', title: 'Lead Product Manager', prov: 'trello' },
        { email: 'david.miller@verytis.com', name: 'David Miller', role: 'member', title: 'SRE Lead', prov: 'microsoft_teams' },
        { email: 'brooklyn.simmons@verytis.com', name: 'Brooklyn Simmons', role: 'member', title: 'Legal Auditor', prov: 'slack' }
    ];

    const staffIds = {};
    const { data: myProfile } = await supabase.from('profiles').select('id, full_name').eq('organization_id', orgId).eq('role', 'admin').limit(1).single();
    staffIds['admin'] = myProfile?.id;

    for (const s of staff) {
        const { data: { user }, error: uErr } = await supabase.auth.admin.createUser({
            email: s.email,
            password: 'DemoPassword123!',
            email_confirm: true,
            user_metadata: { full_name: s.name }
        });

        const uid = uErr ? (await supabase.from('profiles').select('id').eq('email', s.email).single()).data?.id : user.id;

        if (!uid) {
            console.warn(`⚠️ Could not resolve UID for ${s.email}, skipping.`);
            continue;
        }

        await supabase.from('profiles').upsert({
            id: uid,
            organization_id: orgId,
            email: s.email,
            full_name: s.name,
            job_title: s.title,
            role: s.role,
            status: 'active'
        });

        // CREATE PASSPORT (CONNECTION) -> This is critical for "Passport Identities" count
        await supabase.from('connections').upsert({
            user_id: uid,
            provider: s.prov,
            provider_user_id: `EXT_${uid.toString().substring(0, 8)}`,
            status: 'connected'
        });

        staffIds[s.name.split(' ')[0].toLowerCase()] = uid;
    }

    // Ensure Admin also has connections
    if (staffIds.admin) {
        await supabase.from('connections').upsert([
            { user_id: staffIds.admin, provider: 'slack', provider_user_id: 'SL_ADMIN', status: 'connected' },
            { user_id: staffIds.admin, provider: 'github', provider_user_id: 'GH_ADMIN', status: 'connected' }
        ]);
    }

    // 4. SEED TEAMS
    console.log('🏗️ Building specialized teams...');
    const teamData = [
        { name: 'Architecture & Ops', type: 'operational', desc: 'Core platform and cloud scalability' },
        { name: 'Security Response', type: 'operational', desc: 'Incident management and RLS enforcement' },
        { name: 'Governance & Risk', type: 'governance', desc: 'Policy automation and regulatory audit' },
        { name: 'Product Enablement', type: 'operational', desc: 'Strategic feature roadmap and UI/UX' }
    ];

    const { data: insertedTeams } = await supabase.from('teams').insert(teamData.map(t => ({
        organization_id: orgId,
        name: t.name,
        description: t.desc,
        type: t.type
    }))).select();

    const teamLookup = {};
    insertedTeams.forEach(t => teamLookup[t.name] = t.id);

    // 5. SEED MEMBERSHIPS (Fixed)
    console.log('🔗 Mapping workforce to missions...');
    const members = [];
    const addMember = (teamName, userId, role) => {
        if (teamLookup[teamName] && userId) {
            members.push({ team_id: teamLookup[teamName], user_id: userId, role });
        }
    };

    addMember('Architecture & Ops', staffIds.bob, 'lead');
    addMember('Architecture & Ops', staffIds.david, 'member');
    addMember('Architecture & Ops', staffIds.admin, 'member');
    addMember('Security Response', staffIds.alice, 'lead');
    addMember('Security Response', staffIds.bob, 'member');
    addMember('Governance & Risk', staffIds.jane, 'lead');
    addMember('Governance & Risk', staffIds.brooklyn, 'member');
    addMember('Product Enablement', staffIds.sarah, 'lead');
    addMember('Product Enablement', staffIds.jane, 'member');

    await supabase.from('team_members').insert(members);

    // 6. INTEGRATIONS & RESOURCES
    console.log('🔌 Powering stacks (Slack, GitHub, Trello, M365)...');
    const integrations = [
        { provider: 'slack', name: 'Verytis-HQ Slack', ext: 'T001' },
        { provider: 'github', name: 'Verytis-Enterprise GH', ext: 'ORG_V' },
        { provider: 'trello', name: 'Strategic Roadmap', ext: 'B_ROAD' },
        { provider: 'microsoft_teams', name: 'Corporate Teams', ext: 'MS_HQ' }
    ];

    const { data: intDocs } = await supabase.from('integrations').insert(integrations.map(i => ({
        organization_id: orgId,
        provider: i.provider,
        name: i.name,
        external_id: i.ext
    }))).select();

    const intLookup = {};
    intDocs.forEach(i => intLookup[i.provider] = i.id);

    const resourceConfigs = [
        { int: 'slack', name: 'infrastructure', type: 'channel', team: 'Architecture & Ops', ext: 'C_INFRA' },
        { int: 'slack', name: 'sec-ops', type: 'channel', team: 'Security Response', ext: 'C_SEC' },
        { int: 'slack', name: 'audit-log', type: 'channel', team: 'Governance & Risk', ext: 'C_AUDIT' },
        { int: 'github', name: 'verytis-monorepo', type: 'repo', team: 'Architecture & Ops', ext: 'R_MONO' },
        { int: 'github', name: 'auth-guard', type: 'repo', team: 'Security Response', ext: 'R_AUTH' },
        { int: 'trello', name: 'Feature Roadmap', type: 'folder', team: 'Product Enablement', ext: 'F_ROAD' },
        { int: 'microsoft_teams', name: 'Cloud Sync', type: 'channel', team: 'Architecture & Ops', ext: 'MS_CLOUD' }
    ];

    const { data: resDocs } = await supabase.from('monitored_resources').insert(resourceConfigs.map(rc => ({
        integration_id: intLookup[rc.int],
        name: rc.name,
        type: rc.type,
        external_id: rc.ext,
        audit_level: 'full',
        team_id: teamLookup[rc.team]
    }))).select();

    const resLookup = {};
    resDocs.forEach(r => resLookup[r.name] = r.id);

    // 7. AI AGENTS
    console.log('🤖 Deploying AI Fleet...');
    const agents = [
        { name: 'Sentinel-V3', desc: 'Cloud posture & policy guard', status: 'active' },
        { name: 'TraceBot', desc: 'WORM implementation auditor', status: 'active' },
        { name: 'RiskLens', desc: 'NLP analyzer for Slack discussions', status: 'active' },
        { name: 'CommitScan', desc: 'Secrets & pattern detector for PRs', status: 'active' }
    ];
    await supabase.from('ai_agents').insert(agents.map(a => ({
        organization_id: orgId,
        name: a.name,
        description: a.desc,
        status: a.status,
        api_key_hash: `hash_v3_${a.name.toLowerCase()}`
    })));

    // 8. ACTIVITY LOGS (Fidelity check)
    console.log('📉 Flooding activity ledger (150+ high-fidelity events)...');
    const logPool = [
        { u: 'bob', r: 'verytis-monorepo', t: 'COMMIT', s: 'Implemented zero-trust auth layer' },
        { u: 'alice', r: 'sec-ops', t: 'SECURITY_FLAG', s: 'Detected anomaly in IAM role 452' },
        { u: 'jane', r: 'audit-log', t: 'POLICY_UPDATE', s: 'Formalized Q1 RLS enforcement rules' },
        { u: 'david', r: 'infrastructure', t: 'DEPLOYMENT', s: 'Merged Infrastructure-as-Code v4.5' },
        { u: 'sarah', r: 'Feature Roadmap', t: 'CARD_MOVED', s: 'Advanced "Enterprise SSO" to Production Ready' },
        { u: 'admin', r: 'verytis-monorepo', t: 'PR_MERGED', s: 'Merged PR #1204: Stability fixes for Ledger API' },
        { u: 'brooklyn', r: 'audit-log', t: 'APPROVE', s: 'Validated Q1 Security Audit Proofs' }
    ];

    const bulkLogs = [];
    for (let i = 0; i < 150; i++) {
        const item = logPool[i % logPool.length];
        const d = new Date();
        d.setMinutes(d.getMinutes() - i * 12);
        bulkLogs.push({
            organization_id: orgId,
            actor_id: staffIds[item.u] || staffIds.admin,
            action_type: item.t,
            resource_id: resLookup[item.r],
            summary: `${item.s} [AUDIT-${i}]`,
            metadata: { env: 'prod', demo: true, severity: i % 15 === 0 ? 'high' : 'info' },
            created_at: d.toISOString()
        });
    }
    const { error: logErr } = await supabase.from('activity_logs').insert(bulkLogs);
    if (logErr) console.error('Logs seeding error:', logErr.message);

    // 9. DECISIONS
    console.log('⚖️ Seal historical decisions...');
    const decData = [
        { title: 'RLS Global Enforcement Policy', u: 'alice', r: 'audit-log' },
        { title: 'Migration to Kubernetes 1.30', u: 'david', r: 'infrastructure' },
        { title: 'Zero-Trust Auth Implementation', u: 'bob', r: 'verytis-monorepo' },
        { title: 'Q1 Compliance Certification', u: 'admin', r: 'audit-log' }
    ];
    await supabase.from('decisions').insert(decData.map(d => ({
        organization_id: orgId,
        title: d.title,
        actor_id: staffIds[d.u],
        resource_id: resLookup[d.r],
        status: 'validated'
    })));

    console.log('✨ MEGA DEMO v3 FULL-STACK DEPLOYED!');
}

seedMegaDemo().catch(console.error);
