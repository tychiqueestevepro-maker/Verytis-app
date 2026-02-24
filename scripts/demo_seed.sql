DO $$
DECLARE
    org_id UUID;
    engineering_team_id UUID;
    legal_team_id UUID;
    security_team_id UUID;
    slack_int_id UUID;
    github_int_id UUID;
    trello_int_id UUID;
    admin_id UUID;
    jane_id UUID;
    bob_id UUID;
    res_slack_id UUID;
    res_github_id UUID;
    res_trello_id UUID;
BEGIN
    -- 1. Identify the Organization (Use the one the current user is in)
    SELECT organization_id, id INTO org_id, admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found. Please sign up first.';
    END IF;

    RAISE NOTICE 'Seeding demo data for Organization mapping: %', org_id;

    -- 2. Create Mock Users (Profiles)
    -- Jane Doe (Manager)
    jane_id := uuid_generate_v4();
    INSERT INTO public.profiles (id, organization_id, email, full_name, role, status)
    VALUES (jane_id, org_id, 'jane@demo.com', 'Jane Cooper', 'manager', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Bob Smith (Member)
    bob_id := uuid_generate_v4();
    INSERT INTO public.profiles (id, organization_id, email, full_name, role, status)
    VALUES (bob_id, org_id, 'bob@demo.com', 'Robert Fox', 'member', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Create Teams
    -- Engineering
    INSERT INTO public.teams (organization_id, name, description, type)
    VALUES (org_id, 'Engineering & Ops', 'Core platform engineering and cloud infrastructure', 'operational')
    RETURNING id INTO engineering_team_id;

    -- Legal & Compliance
    INSERT INTO public.teams (organization_id, name, description, type)
    VALUES (org_id, 'Governance & Legal', 'Policy enforcement and corporate audit trail', 'governance')
    RETURNING id INTO legal_team_id;

    -- Security
    INSERT INTO public.teams (organization_id, name, description, type)
    VALUES (org_id, 'Security Response', 'Threat detection and incident governance', 'operational')
    RETURNING id INTO security_team_id;

    -- 4. Add Team Members
    INSERT INTO public.team_members (team_id, user_id, role) VALUES
    (engineering_team_id, admin_id, 'lead'),
    (engineering_team_id, bob_id, 'member'),
    (legal_team_id, jane_id, 'lead'),
    (security_team_id, admin_id, 'member'),
    (security_team_id, jane_id, 'lead');

    -- 5. Create Integrations
    -- Slack
    INSERT INTO public.integrations (organization_id, provider, name, external_id)
    VALUES (org_id, 'slack', 'Demo Slack Workspace', 'T_DEMO_WORKSPACE')
    RETURNING id INTO slack_int_id;

    -- GitHub
    INSERT INTO public.integrations (organization_id, provider, name, external_id)
    VALUES (org_id, 'github', 'Verytis Main MonoRepo', 'verytis-mono')
    RETURNING id INTO github_int_id;

    -- Trello
    INSERT INTO public.integrations (organization_id, provider, name, external_id)
    VALUES (org_id, 'trello', 'Product Roadmap', 'board-123')
    RETURNING id INTO trello_int_id;

    -- 6. Create Monitored Resources (Channels, Repos, Boards)
    -- Slack Channels
    INSERT INTO public.monitored_resources (integration_id, external_id, name, type, audit_level, team_id) VALUES
    (slack_int_id, 'C_GOV_PROD', 'prod-governance', 'channel', 'full', engineering_team_id),
    (slack_int_id, 'C_AUDIT_LOG', 'audit-trail', 'channel', 'full', legal_team_id),
    (slack_int_id, 'C_SEC_ALERTS', 'security-incidents', 'channel', 'full', security_team_id)
    RETURNING id INTO res_slack_id;

    -- GitHub Repos
    INSERT INTO public.monitored_resources (integration_id, external_id, name, type, audit_level, team_id) VALUES
    (github_int_id, 'REPO_CORE', 'core-engine', 'repo', 'full', engineering_team_id),
    (github_int_id, 'REPO_AUTH', 'auth-service', 'repo', 'full', security_team_id)
    RETURNING id INTO res_github_id;

    -- Trello Board
    INSERT INTO public.monitored_resources (integration_id, external_id, name, type, audit_level, team_id) VALUES
    (trello_int_id, 'BOARD_TECH', 'Tech Debt & Governance', 'folder', 'metadata_only', engineering_team_id)
    RETURNING id INTO res_trello_id;

    -- 7. Create Connections (Profiles to Providers)
    INSERT INTO public.connections (user_id, provider, provider_user_id, status) VALUES
    (admin_id, 'slack', 'U_ADMIN_SLACK', 'connected'),
    (admin_id, 'github', 'GH_ADMIN', 'connected'),
    (jane_id, 'slack', 'U_JANE_SLACK', 'connected'),
    (bob_id, 'github', 'GH_BOB', 'connected');

    -- 8. Create Activity Logs (Demo Events)
    INSERT INTO public.activity_logs (organization_id, actor_id, action_type, resource_id, summary, metadata) VALUES
    (org_id, admin_id, 'COMMIT', res_github_id, 'Merged PR #45: Enable strict RLS policies', '{"repo": "core-engine", "pr": 45}'),
    (org_id, jane_id, 'POLICY_UPDATE', res_slack_id, 'Approved production access policy update in #prod-governance', '{"policy": "IAM_V2"}'),
    (org_id, bob_id, 'DEPLOYMENT', res_github_id, 'Deployed v2.4.0 to Production (Validated by 2/2 leads)', '{"env": "prod", "version": "2.4.0"}'),
    (org_id, admin_id, 'SECURITY_FLAG', (SELECT id FROM public.monitored_resources WHERE name = 'security-incidents' LIMIT 1), 'Unusual login pattern detected from new IP', '{"severity": "high"}');

    -- 9. Create Decisions (Formalized from logs)
    INSERT INTO public.decisions (organization_id, title, status, actor_id, resource_id, decided_at) VALUES
    (org_id, 'Production Access Policy Update', 'validated', jane_id, res_slack_id, NOW() - INTERVAL '2 hours'),
    (org_id, 'Core RLS Policy Enforcement', 'validated', admin_id, res_github_id, NOW() - INTERVAL '1 day'),
    (org_id, 'Auth Service Deployment V2', 'validated', admin_id, (SELECT id FROM public.monitored_resources WHERE name = 'auth-service' LIMIT 1), NOW() - INTERVAL '5 hours');

    -- 10. Create Monthly Reports
    INSERT INTO public.monthly_reports (organization_id, team_id, month, title, summary_text, metrics) VALUES
    (org_id, engineering_team_id, '2026-02-01', 'February Engineering Audit', 'Engineering velocity remains high with 100% compliance on PR reviews.', '{"decisions": 12, "active_users": 14, "risk_score": 5}'),
    (org_id, legal_team_id, '2026-02-01', 'February Governance Overview', 'All legal sign-offs for Q1 projects are complete.', '{"decisions": 5, "active_users": 6, "risk_score": 0}');

    RAISE NOTICE 'Demo seeding complete for organization %', org_id;
END $$;
