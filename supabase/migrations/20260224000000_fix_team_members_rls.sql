-- Migration: Fix RLS for Team Members
-- Date: 2026-02-24

-- TEAM MEMBERS: Add org-based isolation
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org isolation for Team Members" ON public.team_members;
CREATE POLICY "Org isolation for Team Members" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = public.team_members.team_id
      AND t.organization_id = get_auth_org_id()
    )
  );

-- Also allow inserts/updates for admins? 
-- For now, focused on visibility which is the reported issue
