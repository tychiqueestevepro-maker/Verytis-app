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
    console.log('🚀 INITIALIZING MEGA DEMO SEED v2...');

    // 1. Identify Target Organization (Verytis test)
    const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', 'verytis-test')
        .single();

    let orgId;
    if (org) {
        orgId = org.id;
    } else {
        const { data: admin } = await supabase.from('profiles').select('organization_id').eq('role', 'admin').limit(1).single();
        orgId = admin?.organization_id;
    }

    if (!orgId) {
        console.error('❌ No target organization found.');
        return;
    }

    console.log(`🎯 Target Organization ID: ${orgId}`);

    // 2. WIPE PREVIOUS DATA FOR THIS ORG (PREVENT DOUBLES)
    console.log('🧹 Wiping existing data for this organization to prevent duplicates...');
    const tablesToClear = [
        'monthly_reports',
        'decisions',
        'activity_logs',
        'monitored_resources',
        'integrations',
        'team_members',
        'teams',
        'ai_agents'
    ];

    for (const table of tablesToClear) {
        await supabase.from(table).delete().eq('organization_id', orgId);
    }
    await supabase.from('monitored_resources').delete().is('integration_id', null);

    // 3. SEED STAFF (AUTH + PROFILES)
    console.log('👥 Seeding extended team members (Security, Legal, DevOps, Product)...');
    const staff = [
        { email: 'jane.cooper@verytis.com', name: 'Jane Cooper', role: 'manager', title: 'Head of Governance' },
        { email: 'bob.foss@verytis.com', name: 'Robert Foss', role: 'member', title: 'Senior Software Engineer' },
        { email: 'alice.security@verytis.com', name: 'Alice Thorne', role: 'member', title: 'CISO' },
        { email: 'charlie.legal@verytis.com', name: 'Charlie Mentis', role: 'member', title: 'Chief Legal Officer' },
        { email: 'david.ops@verytis.com', name: 'David Miller', role: 'member', title: 'Infrastructure Lead' },
        { email: 'sarah.product@verytis.com', name: 'Sarah Jenkins', role: 'member', title: 'VP of Product' },
        { email: 'cameron.sec@verytis.com', name: 'Cameron Williamson', role: 'member', title: 'Security Engineer' },
        { email: 'brooklyn.gov@verytis.com', name: 'Brooklyn Simmons', role: 'member', title: 'Compliance Officer' }
    ];

    const staffIds = {};

    for (const s of staff) {
        const { data: { user }, error: uErr } = await supabase.auth.admin.createUser({
            email: s.email,
            password: 'DemoPassword123!',
            email_confirm: true,
            user_metadata: { full_name: s.name }
        });

        const uid = uErr ? (await supabase.from('profiles').select('id').eq('email', s.email).single()).data?.id : user.id;

        await supabase.from('profiles').upsert({
            id: uid,
            organization_id: orgId,
            email: s.email,
            full_name: s.name,
            job_title: s.title,
            role: s.role,
            status: 'active'
        });

        staffIds[s.name.split(' ')[0].toLowerCase()] = uid;
    }

    const { data: myProfile } = await supabase.from('profiles').select('id').eq('organization_id', orgId).eq('role', 'admin').single();
    staffIds['admin'] = myProfile?.id;

    // 4. SEED TEAMS
    console.log('🏗️ Creating specialized functional teams...');
    const teams = [
        { name: 'Core Engineering', desc: 'Product development and feature lifecycle', type: 'operational' },
        { name: 'Security & Risk', desc: 'Threat monitoring and security policies', type: 'operational' },
        { name: 'Legal Compliance', desc: 'Regulatory reporting and corporate audit', type: 'governance' },
        { name: 'Cloud Infrastructure', desc: 'GCP/AWS resource management', type: 'operational' },
        { name: 'Product Leadership', desc: 'Strategic planning and roadmap governance', type: 'operational' },
        { name: 'Internal Audit', desc: 'Internal control and quality assurance', type: 'governance' }
    ];

    const { data: teamDocs } = await supabase.from('teams').insert(teams.map(t => ({
        organization_id: orgId,
        name: t.name,
        description: t.desc,
        type: t.type
    }))).select();

    const teamLookup = {};
    teamDocs.forEach(t => teamLookup[t.name] = t.id);

    // 5. LINK TEAM MEMBERS
    console.log('🔗 Mapping roles and memberships...');
    const memberships = [
        { team: 'Core Engineering', user: staffIds.bob, role: 'lead' },
        { team: 'Core Engineering', user: staffIds.admin, role: m => 'member' },
        { team: 'Security & Risk', user: staffIds.alice, role: 'lead' },
        { team: 'Security & Risk', user: staffIds.cameron, role: 'member' },
        { team: 'Security & Risk', user: staffIds.david, role: 'member' },
        { team: 'Legal Compliance', user: staffIds.charlie, role: 'lead' },
        { team: 'Legal Compliance', user: staffIds.brooklyn, role: 'member' },
        { team: 'Legal Compliance', user: staffIds.jane, role: 'member' },
        { team: 'Cloud Infrastructure', user: staffIds.david, role: 'lead' },
        { team: 'Cloud Infrastructure', user: staffIds.bob, role: 'member' },
        { team: 'Product Leadership', user: staffIds.sarah, role: 'lead' },
        { team: 'Product Leadership', user: staffIds.jane, role: 'member' },
        { team: 'Internal Audit', user: staffIds.brooklyn, role: 'lead' },
        { team: 'Internal Audit', user: staffIds.charlie, role: 'member' }
    ];
    await supabase.from('team_members').insert(memberships.map(m => ({
        team_id: teamLookup[m.team],
        user_id: m.user,
        role: m.role === 'lead' ? 'lead' : 'member'
    })));

    // 6. INTEGRATIONS & RESOURCES
    console.log('🔌 Connecting Enterprise Stacks (Slack, GitHub, Trello, MS Teams)...');
    const integrations = [
        { provider: 'slack', name: 'Verytis Enterprise Slack', ext: 'T0001' },
        { provider: 'github', name: 'GitHub Org (Verytis)', ext: 'GH001' },
        { provider: 'trello', name: 'Global Product Board', ext: 'TR001' },
        { provider: 'microsoft_teams', name: 'MS Teams (Corporate)', ext: 'MS001' }
    ];

    const { data: intDocs, error: iErr } = await supabase.from('integrations').insert(integrations.map(i => ({
        organization_id: orgId,
        provider: i.provider,
        name: i.name,
        external_id: i.ext
    }))).select();

    if (iErr) {
        console.error('❌ Integrations seed error:', iErr.message);
        return;
    }

    const intLookup = {};
    intDocs.forEach(i => intLookup[i.provider] = i.id);

    const resources = [
        { int: 'slack', name: 'prod-governance', type: 'channel', team: 'Core Engineering' },
        { int: 'slack', name: 'security-alerts', type: 'channel', team: 'Security & Risk' },
        { int: 'slack', name: 'legal-audits', type: 'channel', team: 'Legal Compliance' },
        { int: 'slack', name: 'infrastructure-ops', type: 'channel', team: 'Cloud Infrastructure' },
        { int: 'github', name: 'core-mono-repo', type: 'repo', team: 'Core Engineering' },
        { int: 'github', name: 'auth-service', type: 'repo', team: 'Security & Risk' },
        { int: 'github', name: 'governance-v3', type: 'repo', team: 'Core Engineering' },
        { int: 'trello', name: 'Product Roadmap', type: 'folder', team: 'Product Leadership' },
        { int: 'trello', name: 'Tech Debt Ledger', type: 'folder', team: 'Core Engineering' },
        { int: 'microsoft_teams', name: 'Executive Oversight', type: 'channel', team: 'Product Leadership' },
        { int: 'microsoft_teams', name: 'Ops Sync', type: 'channel', team: 'Cloud Infrastructure' }
    ];

    const { data: resDocs } = await supabase.from('monitored_resources').insert(resources.map(r => ({
        integration_id: intLookup[r.int],
        name: r.name,
        type: r.type,
        external_id: `EXT_${r.name}`,
        audit_level: (r.name.includes('security') || r.name.includes('auth')) ? 'full' : 'metadata_only',
        team_id: teamLookup[r.team]
    }))).select();

    const resLookup = {};
    resDocs.forEach(r => resLookup[r.name] = r.id);

    // 7. AI AGENTS
    console.log('🤖 Deploying varied AI Governance Agents...');
    const agents = [
        { name: 'Sentinel-Prime', desc: 'Real-time policy violation monitor', status: 'active' },
        { name: 'CodeGuard-V2', desc: 'Automated PR security auditor', status: 'active' },
        { name: 'Archivist-Bot', desc: 'Monthly compliance report generator', status: 'active' },
        { name: 'LegalMind', desc: 'Assistant for document and contract reviews', status: 'active' },
        { name: 'OpsWatcher', desc: 'Infrastructure drift and cost monitor', status: 'active' },
        { name: 'AuditCompanion', desc: 'Internal audit helper and log analyzer', status: 'active' },
        { name: 'DecisionSupport', desc: 'Extracts formalized decisions from discussions', status: 'active' }
    ];
    await supabase.from('ai_agents').insert(agents.map(a => ({
        organization_id: orgId,
        name: a.name,
        description: a.desc,
        status: a.status,
        api_key_hash: `hash_v2_${a.name}`
    })));

    // 8. ACTIVITY LOGS (VOLUME BOOST: 100+ EVENTS)
    console.log('📉 Generating high-volume activity stream (100+ events)...');
    const actions = [
        { type: 'COMMIT', user: 'bob', res: 'core-mono-repo', msg: 'Refactored auth middleware guards' },
        { type: 'PR_OPENED', user: 'bob', res: 'core-mono-repo', msg: 'Feature: Multi-tenant database isolation' },
        { type: 'POLICY_UPDATE', user: 'jane', res: 'prod-governance', msg: 'Updated quarterly access control policy' },
        { type: 'SECURITY_FLAG', user: 'alice', res: 'security-alerts', msg: 'Critical: Untrusted dependency detected in auth-service' },
        { type: 'APPROVE', user: 'jane', res: 'legal-audits', msg: 'Approved Tier-1 vendor onboarding documents' },
        { type: 'DEPLOYMENT', user: 'david', res: 'infrastructure-ops', msg: 'Scaled GCP cluster "prod-v3" to 12 nodes' },
        { type: 'MEMBER_JOINED', user: 'admin', res: 'prod-governance', msg: 'Welcomed Sarah to the product governance cycle' },
        { type: 'CHECKLIST_DONE', user: 'sarah', res: 'Product Roadmap', msg: 'Finalized Q2 Roadmap strategy' },
        { type: 'CARD_MOVED', user: 'bob', res: 'Tech Debt Ledger', msg: 'Archived "Legacy XML Parser" task' },
        { type: 'FILE_SHARED', user: 'charlie', res: 'legal-audits', msg: 'Shared "SOC2 Compliance Report - Draft"' },
        { type: 'PR_MERGED', user: 'admin', res: 'auth-service', msg: 'Merged PR #892: Security Patch for OAuth provider' },
        { type: 'MEMBER_ASSIGNED', user: 'brooklyn', res: 'Internal Audit', msg: 'Assigned Audit of Q4 Expenses' }
    ];

    const logs = [];
    for (let i = 0; i < 120; i++) {
        const act = actions[i % actions.length];
        const date = new Date();
        date.setMinutes(date.getMinutes() - i * 15); // Spread over last 30 hours
        logs.push({
            organization_id: orgId,
            actor_id: staffIds[act.user] || staffIds['admin'],
            action_type: act.type,
            resource_id: resLookup[act.res],
            summary: `${act.msg} [DEMO-EVENT-${i}]`,
            created_at: date.toISOString(),
            metadata: { demo: true, cluster: i % 3 === 0 ? 'prod' : 'dev', impact: i % 10 === 0 ? 'high' : 'standard' }
        });
    }
    await supabase.from('activity_logs').insert(logs);

    // 9. DECISIONS
    console.log('⚖️ Documenting historical governance decisions...');
    const decisions = [
        { title: 'Adopt Strict RLS per Schema v2', actor: 'admin', res: 'prod-governance' },
        { title: 'Security Clearance: AWS West-2 Region', actor: 'alice', res: 'security-alerts' },
        { title: 'Global Product Launch Strategy Q2', actor: 'sarah', res: 'Product Roadmap' },
        { title: 'Audit Seal: FY24 Financials', actor: 'charlie', res: 'legal-audits' },
        { title: 'Auth-Service v2.4 Deployment Approval', actor: 'bob', res: 'auth-service' },
        { title: 'Hiring Authorization: 5 Headcount Eng', actor: 'jane', res: 'Executive Oversight' }
    ];
    await supabase.from('decisions').insert(decisions.map(d => ({
        organization_id: orgId,
        title: d.title,
        actor_id: staffIds[d.actor],
        resource_id: resLookup[d.res],
        status: 'validated'
    })));

    // 10. REPORTS
    console.log('📊 Filing last 3 months of audit reports...');
    const reportMonths = ['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'];
    await supabase.from('monthly_reports').insert(reportMonths.map(m => ({
        organization_id: orgId,
        team_id: teamLookup['Core Engineering'],
        month: m,
        title: `Audit - ${m.substring(0, 7)}`,
        summary_text: `Verified 100% compliance for period ${m}. No unauthorized access detected.`,
        metrics: { decisions: 12 + Math.floor(Math.random() * 10), activity_count: 500 + Math.floor(Math.random() * 200), risk_score: 1 }
    })));

    console.log('✨ MEGA DEMO v2 SUCCESSFULLY DEPLOYED TO DATABASE!');
}

seedMegaDemo().catch(err => {
    console.error('💥 FATAL SEED ERROR:', err);
    process.exit(1);
});
