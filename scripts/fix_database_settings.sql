-- ==============================================================
-- VERYTIS CORE SYSTEM RECOVERY SCRIPT
-- ==============================================================

-- 1. SET ENCRYPTION KEY (Critical for connections table)
-- Substituer 'demo-encryption-key-123' par une clé forte en production
ALTER DATABASE postgres SET app.settings.encryption_key = 'demo-encryption-key-123';

-- 2. FIX PROFILES RLS (Eliminate recursion and allow org visibility)
-- We use a subquery that doesn't trigger recursive policy evaluation
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view each other" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Org members can view each other" ON public.profiles
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. RE-INIT PASSPORT VIEW
-- Ensure the view can read the setting we just set
CREATE OR REPLACE VIEW public.decrypted_connections AS
SELECT
    id,
    user_id,
    provider,
    provider_user_id,
    email,
    CASE 
        WHEN access_token LIKE '\x%' THEN
            pgp_sym_decrypt(access_token::bytea, 
                current_setting('app.settings.encryption_key', true)
            )
        ELSE access_token
    END AS access_token,
    CASE 
        WHEN refresh_token LIKE '\x%' THEN
            pgp_sym_decrypt(refresh_token::bytea, 
                current_setting('app.settings.encryption_key', true)
            )
        ELSE refresh_token
    END AS refresh_token,
    expires_at,
    scopes,
    metadata,
    status,
    last_synced_at,
    created_at
FROM public.connections;

GRANT SELECT ON public.decrypted_connections TO authenticated, service_role;

-- ==============================================================
-- RECOVERY COMPLETED. READY FOR SEEDING.
-- ==============================================================
