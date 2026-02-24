-- ==========================================
-- REMEDIATION : WEBHOOK IDEMPOTENCY
-- ==========================================

-- Add external_id to track provider-specific delivery IDs and prevent replays
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS external_id text;

-- Create a unique index per provider to allow the same ID for different providers (unlikely but safe)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_external_id_provider ON public.webhook_events(provider, external_id);

-- Add a comment for documentation
COMMENT ON COLUMN public.webhook_events.external_id IS 'Unique delivery ID from the provider (e.g. X-GitHub-Delivery or Trello action ID) to prevent replay attacks.';
