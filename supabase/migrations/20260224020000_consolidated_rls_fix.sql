-- ==========================================
-- BUNDLE : RLS PERFORMANCE & SECURITY FIX
-- ==========================================
-- This script combines all RLS remediations into a single idempotent run.

-- 1. Helper Function: Read Org ID from JWT Claim
-- This solves the "function does not exist" error.
CREATE OR REPLACE FUNCTION public.get_auth_org_id_claim()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id', '')::uuid;
$$;

-- 2. JWT Claim Sync Logic
CREATE OR REPLACE FUNCTION public.sync_org_id_to_auth_metadata()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('org_id', NEW.organization_id)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_sync_org_id ON public.profiles;
CREATE TRIGGER trigger_sync_org_id
AFTER INSERT OR UPDATE OF organization_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_id_to_auth_metadata();

-- 3. Initial Sync for existing profiles
UPDATE public.profiles SET organization_id = organization_id WHERE organization_id IS NOT NULL;

-- 4. Unified RLS Refactoring
-- Using the claim helper to isolate data efficiently.

-- Teams
DROP POLICY IF EXISTS "Org isolation for Teams" ON public.teams;
CREATE POLICY "Org isolation for Teams" ON public.teams USING (organization_id = public.get_auth_org_id_claim());

-- Logs
DROP POLICY IF EXISTS "Org isolation for Logs" ON public.activity_logs;
CREATE POLICY "Org isolation for Logs" ON public.activity_logs FOR SELECT USING (organization_id = public.get_auth_org_id_claim());

-- Decisions
DROP POLICY IF EXISTS "Org isolation for Decisions" ON public.decisions;
CREATE POLICY "Org isolation for Decisions" ON public.decisions FOR SELECT USING (organization_id = public.get_auth_org_id_claim());

-- Integrations
DROP POLICY IF EXISTS "Org isolation for Integrations" ON public.integrations;
CREATE POLICY "Org isolation for Integrations" ON public.integrations USING (organization_id = public.get_auth_org_id_claim());

-- Resources
DROP POLICY IF EXISTS "Org isolation for Resources" ON public.monitored_resources;
CREATE POLICY "Org isolation for Resources" ON public.monitored_resources
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.integrations i
    WHERE i.id = public.monitored_resources.integration_id
    AND i.organization_id = public.get_auth_org_id_claim()
  )
);

-- Profiles
DROP POLICY IF EXISTS "Org members can view each other" ON public.profiles;
CREATE POLICY "Org members can view each other" ON public.profiles FOR SELECT USING (organization_id = public.get_auth_org_id_claim());

-- Monthly Reports
DROP POLICY IF EXISTS "Org isolation for Monthly Reports" ON public.monthly_reports;
CREATE POLICY "Org isolation for Monthly Reports" ON public.monthly_reports USING (organization_id = public.get_auth_org_id_claim());

-- AI Agents
DROP POLICY IF EXISTS "Org isolation for Agents" ON public.ai_agents;
CREATE POLICY "Org isolation for Agents" ON public.ai_agents USING (organization_id = public.get_auth_org_id_claim());
