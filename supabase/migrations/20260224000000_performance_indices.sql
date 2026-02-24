-- Migration: 20260224000000_performance_indices.sql
-- Add optimized indices for enterprise-scale log filtering

-- 1. Composite index for filtering activity logs by organization and action type
-- This speeds up the dashboard's "recentEvents" exclusion filter
create index if not exists idx_activity_logs_org_action_date on public.activity_logs (organization_id, action_type, created_at desc);

-- 2. Composite index for agent-specific telemetry filtering
-- Speeds up the "Autonomy Index" calculation and agent-specific activity streams
create index if not exists idx_activity_logs_org_agent_date on public.activity_logs (organization_id, agent_id, created_at desc);

-- 3. Composite index for profiles to speed up organization lookups in RLS
create index if not exists idx_profiles_id_org on public.profiles (id, organization_id);

-- 4. Partial index for active agents (assuming status 'active' is the common filter)
create index if not exists idx_ai_agents_org_active on public.ai_agents (organization_id) where status = 'active';
