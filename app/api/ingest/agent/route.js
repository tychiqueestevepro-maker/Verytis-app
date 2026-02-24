import { z } from 'zod';

// Strict Schema for AI Ingestion
const IngestionSchema = z.object({
    trace_id: z.string().uuid().or(z.string().min(10)),
    step: z.string().min(1),
    message: z.string().max(10000).optional(),
    metrics: z.object({
        tokens_used: z.number().int().nonnegative().optional(),
        cost_usd: z.number().nonnegative().optional(),
        duration_ms: z.number().nonnegative().optional(),
    }).passthrough().optional(),
    cognitive_load: z.object({
        retry_count: z.number().int().nonnegative().optional(),
        tools_called: z.array(z.string()).optional(),
    }).passthrough().optional(),
    ai_context: z.object({
        model: z.string().optional(),
        provider: z.string().optional(),
        temperature: z.number().min(0).max(2).optional(),
    }).passthrough().optional(),
});

export async function POST(req) {
    const REQUEST_ID = crypto.randomUUID();
    console.log(`📡 [AI_TELEMETRY] [${REQUEST_ID}] Incoming ingestion request...`);

    try {
        // 0. PHYSICAL DOS PROTECTION: Content-Length check (1MB limit)
        const contentLength = parseInt(req.headers.get('content-length') || '0');
        if (contentLength > 1024 * 1024) { // 1MB
            console.warn(`❌ [AI_TELEMETRY] [${REQUEST_ID}] Payload too large: ${contentLength} bytes`);
            return NextResponse.json({ error: 'Payload Too Large (Max 1MB)' }, { status: 413 });
        }

        // 1. Extract Bearer Token
        const authHeader = req.headers.get('authorization');
        // ... rest of auth logic ...
        // (Keeping existing auth logic below for continuity, but wrapped in try/catch)

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const hashedKey = crypto.createHash('sha256').update(token).digest('hex');

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: agent, error: agentError } = await supabase
            .from('ai_agents')
            .select('id, organization_id, status')
            .eq('api_key_hash', hashedKey)
            .single();

        if (agentError || !agent || agent.status !== 'active') {
            return NextResponse.json({ error: 'Unauthorized or Inactive' }, { status: 401 });
        }

        // 5. STRICT SCHEMA VALIDATION (Zod)
        const rawBody = await req.json();
        const validation = IngestionSchema.safeParse(rawBody);

        if (!validation.success) {
            console.error(`❌ [AI_TELEMETRY] [${REQUEST_ID}] Validation failed:`, validation.error.format());
            return NextResponse.json({
                error: 'Invalid Payload Schema',
                details: validation.error.format()
            }, { status: 400 });
        }

        const body = validation.data;

        // 6. ATOMIC INSERT
        const { error: insertError } = await supabase.from('activity_logs').insert({
            organization_id: agent.organization_id,
            agent_id: agent.id,
            action_type: 'AI_TELEMETRY',
            summary: `Agent Step: ${body.step}`,
            metadata: {
                ...body,
                ingested_at: new Date().toISOString(),
                request_id: REQUEST_ID
            }
        });

        if (insertError) {
            console.error(`❌ [AI_TELEMETRY] [${REQUEST_ID}] DB Error:`, insertError);
            return NextResponse.json({ error: 'Persistence Failure' }, { status: 500 });
        }

        console.log(`✅ [AI_TELEMETRY] [${REQUEST_ID}] Ingested successfully.`);
        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error) {
        console.error(`❌ [AI_TELEMETRY] [${REQUEST_ID}] System Error:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
