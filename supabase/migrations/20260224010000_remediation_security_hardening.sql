-- ==========================================
-- REMEDIATION : SECURITY HARDENING PHASE 1
-- ==========================================

-- 1. Create the Secret in Supabase Vault (if not already present via UI/API)
-- Note: In a real production environment, you'd do this via the Dashboard or API.
-- Here we provide the SQL pattern to bridge the current configuration.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'db_encryption_key') THEN
        PERFORM vault.create_secret(
            current_setting('app.settings.encryption_key', true), 
            'db_encryption_key', 
            'AES-256 Key for connections table encryption'
        );
    END IF;
END $$;

-- 2. Update the Encryption Trigger to use the Vault
CREATE OR REPLACE FUNCTION public.encrypt_connection_tokens()
RETURNS trigger AS $$
DECLARE
    encryption_key text;
BEGIN
    -- Get key from Vault instead of current_setting
    SELECT decrypted_secret INTO encryption_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'db_encryption_key'
    LIMIT 1;

    IF encryption_key IS NULL THEN
        RAISE EXCEPTION 'Security Critical: DB Encryption Key not found in Vault.';
    END IF;

    -- Encryption Logic
    IF NEW.access_token IS NOT NULL AND NEW.access_token NOT LIKE '\x%' THEN
        NEW.access_token := pgp_sym_encrypt(NEW.access_token, encryption_key, 'cipher-algo=aes256');
    END IF;

    IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token NOT LIKE '\x%' THEN
        NEW.refresh_token := pgp_sym_encrypt(NEW.refresh_token, encryption_key, 'cipher-algo=aes256');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the Decrypted View and Restrict Access
-- We RE-CREATE the view to ensure it uses the Vault and then REVOKE public/authenticated access.

CREATE OR REPLACE VIEW public.decrypted_connections AS
WITH secret AS (
    SELECT decrypted_secret as key FROM vault.decrypted_secrets WHERE name = 'db_encryption_key' LIMIT 1
)
SELECT
    c.id,
    c.user_id,
    c.provider,
    c.provider_user_id,
    c.email,
    CASE 
        WHEN c.access_token LIKE '\x%' THEN
            pgp_sym_decrypt(c.access_token::bytea, (SELECT key FROM secret))
        ELSE c.access_token
    END AS access_token,
    CASE 
        WHEN c.refresh_token LIKE '\x%' THEN
            pgp_sym_decrypt(c.refresh_token::bytea, (SELECT key FROM secret))
        ELSE c.refresh_token
    END AS refresh_token,
    c.expires_at,
    c.scopes,
    c.metadata,
    c.status,
    c.last_synced_at,
    c.created_at
FROM public.connections c;

-- CRITICAL: Revoke access from authenticated users. 
-- Only service_role (Backend) and database owner should access this.
REVOKE ALL ON public.decrypted_connections FROM authenticated;
REVOKE ALL ON public.decrypted_connections FROM anon;
GRANT SELECT ON public.decrypted_connections TO service_role;

-- Allow users to see their OWN decrypted data if required by the app logic, 
-- but it's better to force them through a secure API route.
-- For now, we follow the "Backend only" strategy.
