-- ==========================================
-- PHASE 5 : ENTERPRISE HARDENING
-- ==========================================

-- 1. HARDEN WORM (Blocking TRUNCATE)
-- High-level protection to prevent logs wiping.
CREATE OR REPLACE FUNCTION public.block_truncate_audit_logs()
RETURNS event_trigger AS $$
BEGIN
  RAISE EXCEPTION 'WORM Compliance Violation: TRUNCATE is strictly forbidden on this table.';
END;
$$ LANGUAGE plpgsql;

-- Postgres doesn't allow per-table TRUNCATE triggers easily with standard triggers, 
-- we use a standard TRIGGER for TRUNCATE instead.
CREATE OR REPLACE FUNCTION public.enforce_worm_truncate()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'WORM Compliance Violation: TRUNCATE is strictly forbidden on activity_logs.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_truncate ON public.activity_logs;
CREATE TRIGGER trigger_block_truncate
BEFORE TRUNCATE ON public.activity_logs
FOR EACH STATEMENT
EXECUTE FUNCTION public.enforce_worm_truncate();

-- 1.5 Ensure WORM trigger exists and is active for ALL roles
CREATE OR REPLACE FUNCTION public.enforce_activity_logs_worm()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'WORM Policy Violation: Cannot % an existing activity_log record. The audit trail is Append-Only.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_activity_log_modifications ON public.activity_logs;
CREATE TRIGGER prevent_activity_log_modifications
BEFORE UPDATE OR DELETE ON public.activity_logs
FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_logs_worm();

-- Ensure WORM trigger is ENABLED ALWAYS (to catch service_role bypass)
ALTER TABLE public.activity_logs ENABLE ALWAYS TRIGGER prevent_activity_log_modifications;

-- 2. WEBHOOK RACE CONDITION FIX
-- Adding a strict unique constraint to prevent duplicates at the DB level.
-- This allows us to use "ON CONFLICT DO NOTHING" safely.

-- Ensure column exists (Double safety if Phase 2 was skipped)
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS external_id text;

-- First, cleanup potential duplicates if any exist (safety first)
DELETE FROM public.webhook_events a USING public.webhook_events b
WHERE a.id < b.id 
AND a.provider = b.provider 
AND a.external_id = b.external_id;

-- Add Unique Constraint
ALTER TABLE public.webhook_events 
DROP CONSTRAINT IF EXISTS unique_provider_event;

ALTER TABLE public.webhook_events 
ADD CONSTRAINT unique_provider_event UNIQUE(provider, external_id);

-- 3. SECURITY: Restrict direct table access
-- Ensuring even authenticated users cannot touch metadata without RLS being forced.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only for webhooks" ON public.webhook_events;
CREATE POLICY "Service role only for webhooks" ON public.webhook_events
  FOR ALL TO service_role USING (true);
