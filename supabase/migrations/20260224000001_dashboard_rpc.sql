-- DASHBOARD AGGREGATION RPC
-- Optimizes dashboard performance by performing all counts and groups in a single SQL call

CREATE OR REPLACE FUNCTION get_dashboard_metrics(org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    total_logs_count BIGINT;
    agent_logs_count BIGINT;
    active_agents_count BIGINT;
    monitored_users_count BIGINT;
    distribution_data JSONB;
    velocity_data JSONB;
BEGIN
    -- 1. Get counts
    SELECT count(*) INTO total_logs_count 
    FROM public.activity_logs 
    WHERE organization_id = org_id;

    SELECT count(*) INTO agent_logs_count 
    FROM public.activity_logs 
    WHERE organization_id = org_id AND agent_id IS NOT NULL;

    SELECT count(*) INTO active_agents_count 
    FROM public.ai_agents 
    WHERE organization_id = org_id AND status = 'active';

    SELECT count(*) INTO monitored_users_count 
    FROM public.profiles 
    WHERE organization_id = org_id;

    -- 2. Get Distribution (top 4 action types)
    SELECT jsonb_agg(d) INTO distribution_data FROM (
        SELECT action_type as name, count(*) as value
        FROM public.activity_logs
        WHERE organization_id = org_id
        GROUP BY action_type
        ORDER BY value DESC
        LIMIT 4
    ) d;

    -- 3. Get Velocity (last 7 days)
    SELECT jsonb_agg(v.count) INTO velocity_data FROM (
        SELECT 
            gs.day,
            count(al.id) as count
        FROM generate_series(
            current_date - interval '6 days', 
            current_date, 
            interval '1 day'
        ) gs(day)
        LEFT JOIN public.activity_logs al ON 
            date_trunc('day', al.created_at) = gs.day 
            AND al.organization_id = org_id
        GROUP BY gs.day
        ORDER BY gs.day
    ) v;

    -- Assemble result
    result := jsonb_build_object(
        'activeAgents', active_agents_count,
        'totalAuditedEvents', total_logs_count,
        'monitoredUsers', monitored_users_count,
        'autonomyIndex', CASE WHEN total_logs_count > 0 THEN round((agent_logs_count::float / total_logs_count::float) * 100) ELSE 0 END,
        'distribution', COALESCE(distribution_data, '[]'::jsonb),
        'velocity', COALESCE(velocity_data, '[0,0,0,0,0,0,0]'::jsonb)
    );

    RETURN result;
END;
$$;
