-- Migration: Add Persistent Chat Support for AI Agents
-- Description: Creates a table to store shared chat history between the user and the agent.

CREATE TABLE IF NOT EXISTS public.ai_agent_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    action_payload JSONB DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_agent_chats ENABLE ROW LEVEL SECURITY;

-- Policies for Organizations (Shared access within org)
CREATE POLICY "Users can view chats of their organization" 
ON public.ai_agent_chats FOR SELECT 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert chats for their organization" 
ON public.ai_agent_chats FOR INSERT 
WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Index for faster retrieval
CREATE INDEX IF NOT EXISTS idx_agent_chats_agent_id ON public.ai_agent_chats(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_chats_created_at ON public.ai_agent_chats(created_at);
