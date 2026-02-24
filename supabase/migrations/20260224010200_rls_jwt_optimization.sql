-- ==========================================
-- REMEDIATION : RLS OPTIMIZATION (JWT CLAIMS)
-- ==========================================

-- 1. Create a function to synchronize public.profiles.organization_id to auth.users.raw_app_meta_data
-- This ensures that the JWT 'app_metadata' field contains the 'org_id'.

CREATE OR REPLACE FUNCTION public.sync_org_id_to_auth_metadata()
RETURNS trigger AS $$
BEGIN
  -- We update the auth.users table directly. 
  -- Supabase Auth automatically picks up raw_app_meta_data and includes it in the JWT.
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('org_id', NEW.organization_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Apply the trigger to public.profiles
DROP TRIGGER IF EXISTS trigger_sync_org_id ON public.profiles;
CREATE TRIGGER trigger_sync_org_id
AFTER INSERT OR UPDATE OF organization_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_org_id_to_auth_metadata();

-- 3. HELPER: Initial synchronization for existing users
-- Note: This is an optional step that can be run once.
-- UPDATE public.profiles SET organization_id = organization_id;

-- 4. NEW PERFORMANCE-OPTIMIZED HELPER FUNCTION
-- Instead of querying public.profiles, we read from the JWT claim.
-- This helper will be used if we don't want to inline the JSONB access everywhere.

CREATE OR REPLACE FUNCTION public.get_auth_org_id_claim()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'org_id', '')::uuid;
$$;
