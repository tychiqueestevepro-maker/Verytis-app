import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req, { params }) {
    try {
        const { agentId } = await params;
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if agentId is a valid UUID (meaning it's in the DB)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(agentId)) {
            // It's a static agent from the mock data, we just mock the success
            return NextResponse.json({ success: true, message: 'Simulated like for static agent' });
        }

        // Is it already liked?
        const { data: existingLike } = await supabase
            .from('agent_likes')
            .select('*')
            .eq('agent_id', agentId)
            .eq('user_id', user.id)
            .single();

        if (existingLike) {
            // Unlike
            await supabase.from('agent_likes').delete().eq('agent_id', agentId).eq('user_id', user.id);
            return NextResponse.json({ success: true, action: 'unliked' });
        } else {
            // Like
            const { error } = await supabase.from('agent_likes').insert([{ agent_id: agentId, user_id: user.id }]);
            if (error) throw error;
            return NextResponse.json({ success: true, action: 'liked' });
        }

    } catch (err) {
        console.error('Error toggling like:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
