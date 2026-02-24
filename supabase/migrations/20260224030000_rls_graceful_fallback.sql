-- ==========================================
-- RECOVERY : RLS GRACEFUL FALLBACK
-- ==========================================
-- Re-defining the claim helper to support "Stale Sessions" (JWT without the claim).

CREATE OR REPLACE FUNCTION public.get_auth_org_id_claim()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  _org_id uuid;
BEGIN
  -- 1. Try to get from JWT Claim (Optimized Path)
  _org_id := NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id', '')::uuid;
  
  IF _org_id IS NOT NULL THEN
    RETURN _org_id;
  END IF;
  
  -- 2. Fallback to Subquery (Stale Session Path)
  -- This ensures data remains visible until the user re-logs.
  RETURN (SELECT organization_id FROM profiles WHERE id = auth.uid());
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_auth_org_id_claim() TO authenticated, service_role;
