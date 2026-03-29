-- Migration: 20260326000000_agent_memory.sql
-- Force target table and configuration column for Deployment Core Logic

-- 1. Ensure configuration column exists for metadata/memory storage
ALTER TABLE public.ai_agents 
ADD COLUMN IF NOT EXISTS configuration JSONB DEFAULT '{}'::jsonb;

-- 2. Create dedicated memory table for long-term vector/context storage
CREATE TABLE IF NOT EXISTS public.agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{}'::jsonb,
    memory_context TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_id)
);

-- 3. RLS Policies
ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage memory of their org agents" ON public.agent_memory
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.team_members WHERE user_id = auth.uid()
        )
    );