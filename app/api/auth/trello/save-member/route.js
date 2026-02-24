import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    try {
        const { userId, token, member } = await req.json();

        if (!userId || !token || !member) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const targetUserId = userId;
        console.log('Trello save-member: mapping userId', userId, 'to', targetUserId);

        // Get current profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('social_profiles')
            .eq('id', targetUserId)
            .single();

        const currentSocials = profile?.social_profiles || {};

        // Update social_profiles with Trello data
        const updatedSocials = {
            ...currentSocials,
            trello: {
                id: member.id,
                username: member.username,
                fullName: member.fullName,
                email: member.email || null,
                connected_at: new Date().toISOString(),
                api_token: token // Store token for user-specific actions
            }
        };

        const { error } = await supabase
            .from('profiles')
            .update({ social_profiles: updatedSocials })
            .eq('id', targetUserId);

        if (error) {
            console.error('Trello member save error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log('✅ Trello member account linked for user:', targetUserId);
        return NextResponse.json({ success: true, username: member.username });

    } catch (err) {
        console.error('Trello save-member error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
