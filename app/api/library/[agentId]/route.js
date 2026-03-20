import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
    try {
        const { agentId } = await params;
        const supabase = await createClient();

        // Check if agentId is a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(agentId)) {
            return NextResponse.json({ error: 'Not found in DB (Static Agent)' }, { status: 404 });
        }

        const { data: agent, error } = await supabase
            .from('published_agents')
            .select('*')
            .eq('id', agentId)
            .single();

        if (error || !agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // Add dynamically calculated likes count here if we wanted strictly DB-driven likes
        // Or fetch from agent.likes_count (which is maintained by trigger)

        // Parse code_source
        let parsedSnippets = {};
        if (agent.code_source) {
            try {
                parsedSnippets = JSON.parse(agent.code_source);
            } catch (e) {
                // Backward compatibility for agents saved with just text
                const lang = agent.code_language || 'Python';
                parsedSnippets[lang] = agent.code_source;
            }
        }

        if (Object.keys(parsedSnippets).length === 0) {
            parsedSnippets = { 'Python': '# Code example not provided' };
        }

        const formattedAgent = {
            id: agent.id,
            name: agent.name,
            author: agent.author_pseudo,
            is_verified: agent.is_verified,
            category: agent.category,
            description: agent.description,
            icon_name: agent.icon_name || 'Bot',
            bgColor: agent.bg_color || 'bg-slate-100',
            color: agent.text_color || 'text-slate-600',
            capabilities: agent.capabilities || [],
            likes: agent.likes_count || 0,
            codeSnippets: parsedSnippets
        };

        return NextResponse.json({ agent: formattedAgent });

    } catch (error) {
        console.error('Error in GET /api/library/[agentId]:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
