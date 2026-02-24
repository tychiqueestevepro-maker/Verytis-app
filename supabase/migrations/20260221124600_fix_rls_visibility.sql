-- Migration: Fix RLS Policies for Org Data Visibility
-- Date: 2026-02-21

-- PROFILES: Allow users to see others in the same organization
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Org members can view each other" ON public.profiles
  FOR SELECT USING (organization_id = get_auth_org_id());

-- MONITORED RESOURCES: Add org-based isolation
-- Need to join with integrations to check org_id
-- To avoid complex recursive RLS, we can add organization_id to monitored_resources as well
-- or use a join if performance allows. Let's try the join first.

ALTER TABLE public.monitored_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org isolation for Resources" ON public.monitored_resources;
CREATE POLICY "Org isolation for Resources" ON public.monitored_resources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.integrations i
      WHERE i.id = public.monitored_resources.integration_id
      AND i.organization_id = get_auth_org_id()
    )
  );

-- INTEGRATIONS: Add org-based isolation
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org isolation for Integrations" ON public.integrations;
CREATE POLICY "Org isolation for Integrations" ON public.integrations
  USING (organization_id = get_auth_org_id());

-- ORGANIZATIONS: Allow members to see their own org
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization" ON public.organizations
  FOR SELECT USING (id = get_auth_org_id());

-- ACTIVITY LOGS: Ensure SELECT is working
-- The policy already exists in init_schema but let's re-verify
DROP POLICY IF EXISTS "Org isolation for Logs" ON public.activity_logs;
CREATE POLICY "Org isolation for Logs" ON public.activity_logs
  FOR SELECT USING (organization_id = get_auth_org_id());

-- TEAMS: Ensure isolation
DROP POLICY IF EXISTS "Org isolation for Teams" ON public.teams;
CREATE POLICY "Org isolation for Teams" ON public.teams
  USING (organization_id = get_auth_org_id());
