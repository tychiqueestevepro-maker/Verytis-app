
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
    const { teamId } = await params;
    // The original example had `const supabase = await createClient();` but it's incomplete.
    // Assuming the intent was to show `await params` and not to add a functional GET endpoint.
    // If a functional GET endpoint is needed, more context would be required.
    // For now, I'll add a placeholder response to make it syntactically correct and functional.
    if (!teamId) {
        return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }
    return NextResponse.json({ message: `GET request for teamId: ${teamId}` });
}

export async function POST(req, { params }) {
    const { teamId } = await params;
    const { channelId } = await req.json();

    if (!teamId || !channelId) {
        return NextResponse.json({ error: 'Team ID and Channel ID are required' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { data, error } = await supabase
            .from('monitored_resources')
            .update({ team_id: teamId })
            .eq('id', channelId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ channel: data });
    } catch (error) {
        console.error('Error linking channel:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const { teamId } = await params;
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!teamId || !channelId) {
        return NextResponse.json({ error: 'Team ID and Channel ID are required' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { error } = await supabase
            .from('monitored_resources')
            .update({ team_id: null }) // Unlink by setting team_id to null
            .eq('id', channelId)
            .eq('team_id', teamId); // Ensure we only unlink if it belongs to this team

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error unlinking channel:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
