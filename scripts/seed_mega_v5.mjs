import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedMegaV5() {
    console.log('🚀 DEPLOYING ULTIMATE MEGA DEMO v5...');

    // 1. Identify Target Organization (Verytis test)
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', 'verytis-test').single();
    const orgId = org?.id;

    if (!orgId) {
        console.error('❌ FATAL: "verytis-test" organization not found. Please create it first.');
        return;
    }

    console.log(`🎯 Target Organization ID: ${orgId}`);

    // 2. HARD RESET FOR THIS ORG
    console.log('🧹 Purging old data to ensure a fresh, clean demo...');
    const tables = [
        'monthly_reports',
        'decisions',
        'activity_logs',
        'monitored_resources',
        'integrations',
        'team_members',
        'teams',
        'ai_agents'
    ];

    for (const table of tables) {
        await supabase.from(table).delete().eq('organization_id', orgId);
    }

    // Connections purge (only for users of this org)
    const { data: orgUsers } = await supabase.from('profiles').select('id').eq('organization_id', orgId);
    if (orgUsers?.length > 0) {
        await supabase.from('connections').delete().in('user_id', orgUsers.map(u => u.id));
    }

    // 3. SEED USERS (16 Members)
    console.log('👥 Seeding Enterprise Workforce (16 Members)...');
    const staff = [
        { email: 'jane.governance@verytis.com', name: 'Jane Cooper', role: 'manager', title: 'Head of Data Compliance', prov: 'slack' },
        { email: 'robert.security@verytis.com', name: 'Robert Foss', role: 'member', title: 'Senior Security Architect', prov: 'github' },
        { email: 'alice.ciso@verytis.com', name: 'Alice Thorne', role: 'member', title: 'CISO', prov: 'slack' },
        { email: 'sarah.product@verytis.com', name: 'Sarah Jenkins', role: 'member', title: 'VP of Product', prov: 'trello' },
        { email: 'david.sre@verytis.com', name: 'David Miller', role: 'member', title: 'Infrastructure Lead', prov: 'microsoft_teams' },
        { email: 'brooklyn.legal@verytis.com', name: 'Brooklyn Simmons', role: 'member', title: 'Legal Auditor', prov: 'slack' },
        { email: 'cameron.eng@verytis.com', name: 'Cameron Williamson', role: 'member', title: 'Software Engineer', prov: 'github' },
        { email: 'jenny.hr@verytis.com', name: 'Jenny Wilson', role: 'member', title: 'HR Compliance', prov: 'slack' },
        { email: 'guy.fin@verytis.com', name: 'Guy Hawkins', role: 'member', title: 'Financial Controller', prov: 'slack' },
        { email: 'leslie.design@verytis.com', name: 'Leslie Alexander', role: 'member', title: 'Design Ops', prov: 'slack' },
        { email: 'wade.sec@verytis.com', name: 'Wade Warren', role: 'member', title: 'Security Analyst', prov: 'github' },
        { email: 'esther.pm@verytis.com', name: 'Esther Howard', role: 'member', title: 'Project Manager', prov: 'trello' },
        { email: 'kristin.qa@verytis.com', name: 'Kristin Watson', role: 'member', title: 'QA Lead', prov: 'github' },
        { email: 'albert.it@verytis.com', name: 'Albert Flores', role: 'member', title: 'IT Manager', prov: 'microsoft_teams' },
        { email: 'kathryn.legal@verytis.com', name: 'Kathryn Murphy', role: 'member', title: 'Legal Counsel', prov: 'slack' },
        { email: 'admin.demo@verytis.com', name: 'Demo Admin', role: 'admin', title: 'System Administrator', prov: 'github' }
    ];

    const staffIds = {};
    for (const s of staff) {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: s.email,
            password: 'DemoPassword123!',
            email_confirm: true,
            user_metadata: { full_name: s.name }
        });

        const uid = authErr ? (await supabase.from('profiles').select('id').eq('email', s.email).single()).data?.id : authData.user.id;

        if (!uid) {
            console.warn(`⚠️ UID missing for ${s.email}`);
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

        // PASSPORTS (Connections)
        const { error: cErr } = await supabase.from('connections').upsert({
            user_id: uid,
            provider: s.prov,
            provider_user_id: `EXT_${uid.toString().substring(0, 8)}`,
            status: 'connected',
            metadata: { demo: true }
        });
        if (cErr) console.log(`ℹ️ Note: Passport for ${s.name} ${cErr.message.includes('encryption_key') ? 'skipped (DB key needed)' : 'failed'}`);

        staffIds[s.name.split(' ')[0].toLowerCase()] = uid;
    }

    // 4. TEAMS
    console.log('🏗️ Creating 6 Specialized Teams...');
    const teams = [
        { name: 'Core Engineering', type: 'operational', desc: 'Main product development' },
        { name: 'Security & Risk', type: 'operational', desc: 'Threat detection and IAM' },
        { name: 'Governance & Compliance', type: 'governance', desc: 'Regulatory and standard audit' },
        { name: 'Infrastructure Ops', type: 'operational', desc: 'Cloud and connectivity' },
        { name: 'Product Leadership', type: 'operational', desc: 'Roadmap and strategy' },
        { name: 'Legal & Audit', type: 'governance', desc: 'Corporate legal verification' }
    ];
    const { data: teamDocs } = await supabase.from('teams').insert(teams.map(t => ({ ...t, organization_id: orgId }))).select();
    const teamLookup = {};
    teamDocs.forEach(t => teamLookup[t.name] = t.id);

    // 5. TEAM MEMBERSHIPS
    console.log('🔗 Manning the stations...');
    const memberships = [];
    const addToTeam = (t, u, r) => { if (teamLookup[t] && staffIds[u]) memberships.push({ team_id: teamLookup[t], user_id: staffIds[u], role: r }); };

    addToTeam('Core Engineering', 'cameron', 'lead');
    addToTeam('Core Engineering', 'robert', 'member');
    addToTeam('Core Engineering', 'kristin', 'member');
    addToTeam('Security & Risk', 'alice', 'lead');
    addToTeam('Security & Risk', 'wade', 'member');
    addToTeam('Governance & Compliance', 'jane', 'lead');
    addToTeam('Governance & Compliance', 'brooklyn', 'member');
    addToTeam('Infrastructure Ops', 'david', 'lead');
    addToTeam('Infrastructure Ops', 'albert', 'member');
    addToTeam('Product Leadership', 'sarah', 'lead');
    addToTeam('Product Leadership', 'esther', 'member');
    addToTeam('Product Leadership', 'leslie', 'member');
    addToTeam('Legal & Audit', 'kathryn', 'lead');
    addToTeam('Legal & Audit', 'brooklyn', 'member');

    await supabase.from('team_members').insert(memberships);

    // 6. INTEGRATIONS
    console.log('🔌 Connecting Enterprise Stacks...');
    const ints = [
        { provider: 'slack', name: 'Verytis-Slack', eid: 'T01' },
        { provider: 'github', name: 'Verytis-GitHub', eid: 'GH01' },
        { provider: 'trello', name: 'Verytis-Trello', eid: 'TR01' },
        { provider: 'microsoft_teams', name: 'Verytis-MSTeams', eid: 'MS01' }
    ];
    const { data: intDocs } = await supabase.from('integrations').insert(ints.map(i => ({
        organization_id: orgId, provider: i.provider, name: i.name, external_id: i.eid
    }))).select();
    const il = {}; intDocs.forEach(i => il[i.provider] = i.id);

    // 7. RESOURCES (FULL COVERAGE: 15 Slack Channels, 10 Repos, 5 Trello Boards)
    console.log('📂 Populating 30+ Controlled Resources...');
    const resConfigs = [
        // Slack Channels
        { p: 'slack', n: 'prod-governance', t: 'channel', team: 'Governance & Compliance' },
        { p: 'slack', n: 'security-alerts', t: 'channel', team: 'Security & Risk' },
        { p: 'slack', n: 'engineering', t: 'channel', team: 'Core Engineering' },
        { p: 'slack', n: 'infrastructure', t: 'channel', team: 'Infrastructure Ops' },
        { p: 'slack', n: 'legal-verification', t: 'channel', team: 'Legal & Audit' },
        { p: 'slack', n: 'product-sync', t: 'channel', team: 'Product Leadership' },
        { p: 'slack', n: 'compliance-log', t: 'channel', team: 'Governance & Compliance' },
        { p: 'slack', n: 'incident-response', t: 'channel', team: 'Security & Risk' },
        { p: 'slack', n: 'design-ops', t: 'channel', team: 'Product Leadership' },
        { p: 'slack', n: 'hr-compliance', t: 'channel', team: 'Governance & Compliance' },
        { p: 'slack', n: 'general', t: 'channel', team: 'Core Engineering' },
        { p: 'slack', n: 'announcements', t: 'channel', team: 'Product Leadership' },
        { p: 'slack', n: 'backend-dev', t: 'channel', team: 'Core Engineering' },
        { p: 'slack', n: 'mobile-dev', t: 'channel', team: 'Core Engineering' },
        { p: 'slack', n: 'devops-audit', t: 'channel', team: 'Infrastructure Ops' },

        // GitHub Repos
        { p: 'github', n: 'verytis-monorepo', t: 'repo', team: 'Core Engineering' },
        { p: 'github', n: 'auth-service', t: 'repo', team: 'Security & Risk' },
        { p: 'github', n: 'ledger-api', t: 'repo', team: 'Core Engineering' },
        { p: 'github', n: 'infrastructure-iac', t: 'repo', team: 'Infrastructure Ops' },
        { p: 'github', n: 'governance-v3', t: 'repo', team: 'Governance & Compliance' },
        { p: 'github', n: 'design-system', t: 'repo', team: 'Product Leadership' },
        { p: 'github', n: 'wasm-engine', t: 'repo', team: 'Core Engineering' },
        { p: 'github', n: 'security-scanners', t: 'repo', team: 'Security & Risk' },
        { p: 'github', n: 'reporting-service', t: 'repo', team: 'Governance & Compliance' },
        { p: 'github', n: 'compliance-docs', t: 'repo', team: 'Legal & Audit' },

        // Trello
        { p: 'trello', n: 'Product Roadmap 2026', t: 'folder', team: 'Product Leadership' },
        { p: 'trello', n: 'Security Backlog', t: 'folder', team: 'Security & Risk' },
        { p: 'trello', n: 'Tech Debt Ledger', t: 'folder', team: 'Core Engineering' },
        { p: 'trello', n: 'Compliance Audit Q2', t: 'folder', team: 'Governance & Compliance' },
        { p: 'trello', n: 'Legal Review Board', t: 'folder', team: 'Legal & Audit' }
    ];

    const { data: resDocs } = await supabase.from('monitored_resources').insert(resConfigs.map(rc => ({
        integration_id: il[rc.p],
        name: rc.n,
        type: rc.t,
        team_id: teamLookup[rc.team],
        external_id: `EXT_${rc.n}`,
        audit_level: 'full'
    }))).select();
    const resLookup = {}; resDocs.forEach(r => resLookup[r.name] = r.id);

    // 8. AI AGENTS (10 Agents)
    console.log('🤖 Deploying AI Fleet (10 Agents)...');
    const agents = [
        { name: 'Sentinel-Prime', desc: 'Infrastructure posture guard', status: 'active' },
        { name: 'CodeGuard-V4', desc: 'PR security and linting auditor', status: 'active' },
        { name: 'AuditCompanion', desc: 'Real-time compliance log assistant', status: 'active' },
        { name: 'RiskLens-AI', desc: 'Predictive risk score analyzer', status: 'active' },
        { name: 'LegalMind', desc: 'Document verification agent', status: 'active' },
        { name: 'TraceBot', desc: 'WORM implementation verifier', status: 'active' },
        { name: 'FlowCheck', desc: 'Workflow bottleneck detector', status: 'active' },
        { name: 'DiffMaster', desc: 'Deep-diff code reviewer', status: 'active' },
        { name: 'PolicyPulse', desc: 'Internal policy drift monitor', status: 'active' },
        { name: 'CostGuard', desc: 'Cloud spend governance agent', status: 'active' }
    ];
    const { data: agentDocs } = await supabase.from('ai_agents').insert(agents.map(a => ({
        ...a, organization_id: orgId, api_key_hash: `h_v5_${a.name.toLowerCase()}`
    }))).select();
    const agentLookup = {}; agentDocs.forEach(a => agentLookup[a.name] = a.id);

    // 9. ACTIVITY LOGS (200 Events)
    console.log('📉 Flooding Activity Stream (200 High-Fidelity Events)...');
    const scenarioPool = [
        { u: 'robert', r: 'auth-service', t: 'COMMIT', s: 'Fixed vulnerability in cookie handling' },
        { u: 'jane', r: 'prod-governance', t: 'POLICY_UPDATE', s: 'Published updated RLS definitions v4.2' },
        { u: 'alice', r: 'security-alerts', t: 'SECURITY_FLAG', s: 'Unauthorized access attempt from range 10.2.x.x' },
        { u: 'david', r: 'infrastructure-iac', t: 'DEPLOYMENT', s: 'Updated Terraform state for prod-cluster-west' },
        { u: 'sarah', r: 'Product Roadmap 2026', t: 'CARD_MOVED', s: 'Moved "WORM Integration" to Done' },
        { u: 'cameron', r: 'verytis-monorepo', t: 'PR_OPENED', s: 'Feature: Enhanced audit trail for AI actions' },
        { u: 'brooklyn', r: 'compliance-log', t: 'AUDIT_SEAL', s: 'Signed and sealed Monthly Compliance Proof' },
        { g: 'Sentinel-Prime', r: 'prod-cluster-west', t: 'AUTO_REMEDIATION', s: 'Closed unencrypted port 8080' },
        { g: 'CodeGuard-V4', r: 'ledger-api', t: 'SECURITY_SCAN', s: '0 critical vulnerabilities found in PR #456' }
    ];

    const bulkLogs = [];
    const now = new Date();
    for (let i = 0; i < 200; i++) {
        const item = scenarioPool[i % scenarioPool.length];
        const date = new Date(now.getTime() - i * 14 * 60 * 1000); // 14 mins intervals
        bulkLogs.push({
            organization_id: orgId,
            actor_id: staffIds[item.u] || null,
            agent_id: agentLookup[item.g] || null,
            action_type: item.t,
            resource_id: resLookup[item.r] || null,
            summary: `${item.s} [AUDIT-V5-${i}]`,
            metadata: { env: 'prod', impact: i % 10 === 0 ? 'high' : 'low', v: 'v5' },
            created_at: date.toISOString()
        });
    }
    await supabase.from('activity_logs').insert(bulkLogs);

    // 10. DECISIONS
    console.log('⚖️ Documenting Governance milestones...');
    const decs = [
        { u: 'alice', t: 'Enforce AES-256 for all PII data', r: 'security-alerts' },
        { u: 'jane', t: 'Authorize Migration to Supabase Vault', r: 'prod-governance' },
        { u: 'sarah', t: 'Approve FY26 Q1 Product Roadmap', r: 'Product Roadmap 2026' }
    ];
    await supabase.from('decisions').insert(decs.map(d => ({
        organization_id: orgId, title: d.t, actor_id: staffIds[d.u], resource_id: resLookup[d.r], status: 'validated'
    })));

    console.log('✨ ULTIMATE MEGA DEMO v5 DEPLOYYYYYED! Check your dashboard.');
}

seedMegaV5().catch(console.error);
