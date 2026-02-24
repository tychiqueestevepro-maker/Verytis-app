-- ==========================================
-- REMEDIATION : RLS REFACTORING (CLAIMS)
-- ==========================================

-- This migration replaces the slow subquery-based isolation with fast JWT claim lookups.

-- 1. TEAMS
DROP POLICY IF EXISTS "Org isolation for Teams" ON public.teams;
CREATE POLICY "Org isolation for Teams" ON public.teams
  USING (organization_id = get_auth_org_id_claim());

-- 2. ACTIVITY LOGS
DROP POLICY IF EXISTS "Org isolation for Logs" ON public.activity_logs;
CREATE POLICY "Org isolation for Logs" ON public.activity_logs
  FOR SELECT USING (organization_id = get_auth_org_id_claim());

-- 3. DECISIONS
DROP POLICY IF EXISTS "Org isolation for Decisions" ON public.decisions;
CREATE POLICY "Org isolation for Decisions" ON public.decisions
  FOR SELECT USING (organization_id = get_auth_org_id_claim());

-- 4. EMAIL METADATA
DROP POLICY IF EXISTS "Org isolation for Emails" ON public.email_metadata;
CREATE POLICY "Org isolation for Emails" ON public.email_metadata
  FOR SELECT USING (organization_id = get_auth_org_id_claim());

-- 5. MONTHLY REPORTS
DROP POLICY IF EXISTS "Org isolation for Monthly Reports" ON public.monthly_reports;
CREATE POLICY "Org isolation for Monthly Reports" ON public.monthly_reports
  USING (organization_id = get_auth_org_id_claim());

-- 6. INTEGRATIONS
DROP POLICY IF EXISTS "Org isolation for Integrations" ON public.integrations;
CREATE POLICY "Org isolation for Integrations" ON public.integrations
  USING (organization_id = get_auth_org_id_claim());

-- 7. MONITORED RESOURCES
-- Simplified: No more EXISTS join, we use the claim directly if organization_id is present, 
-- or we keep the join if it's the only way (but we use the claim for the join condition).
DROP POLICY IF EXISTS "Org isolation for Resources" ON public.monitored_resources;
CREATE POLICY "Org isolation for Resources" ON public.monitored_resources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.integrations i
      WHERE i.id = public.monitored_resources.integration_id
      AND i.organization_id = get_auth_org_id_claim()
    )
  );

-- 8. ORGANIZATIONS
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
CREATE POLICY "Users can view their own organization" ON public.organizations
  FOR SELECT USING (id = get_auth_org_id_claim());

-- 9. PROFILES
DROP POLICY IF EXISTS "Org members can view each other" ON public.profiles;
CREATE POLICY "Org members can view each other" ON public.profiles
  FOR SELECT USING (organization_id = get_auth_org_id_claim());

-- 10. AI AGENTS
DROP POLICY IF EXISTS "Org isolation for Agents" ON public.ai_agents;
CREATE POLICY "Org isolation for Agents" ON public.ai_agents
  USING (organization_id = get_auth_org_id_claim());

-- 11. WEBHOOK EVENTS (Audit trail)
DROP POLICY IF EXISTS "Org isolation for Webhook Events" ON public.webhook_events;
-- Note: webhook_events don't have organization_id directly yet. 
-- For now, they are service_role only or we can add isolation if needed.
-- But since they are mostly for debugging/audit, we leave them for service_role.

-- 12. CLEANUP: We can eventually drop get_auth_org_id() 
-- but we keep it for now as a fallback for non-JWT sessions (if any).
