import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req, { params }) {
    const { teamId } = await params;
    const supabase = await createClient();

    if (!teamId) {
        return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data: members, error } = await supabase
            .from('team_members')
            .select('*, profiles(id, full_name, email, avatar_url)') // Fetch member details
            .eq('team_id', teamId);

        if (error) throw error;

        return NextResponse.json({ members });
    } catch (error) {
        console.error('Error fetching team members:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req, { params }) {
    const { teamId } = await params;
    const { userId, role } = await req.json();

    if (!teamId || !userId) {
        return NextResponse.json({ error: 'Team ID and User ID are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        const { data, error } = await supabase
            .from('team_members')
            .insert([{
                team_id: teamId,
                user_id: userId,
                role: role || 'Member'
            }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ member: data });
    } catch (error) {
        console.error('Error adding member:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    const { teamId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!teamId || !userId) {
        return NextResponse.json({ error: 'Team ID and User ID are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', userId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error removing member:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    const { teamId } = await params;
    const { userId, role } = await req.json();

    if (!teamId || !userId || !role) {
        return NextResponse.json({ error: 'Team ID, User ID, and Role are required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Update team member role
        const { data: memberData, error: memberError } = await supabase
            .from('team_members')
            .update({ role: role })
            .eq('team_id', teamId)
            .eq('user_id', userId)
            .select()
            .single();

        if (memberError) throw memberError;

        // 2. Sync Global Profile Role
        // Logic: "A manager is a manager because they manage a team"
        // If promoted to 'lead' (Team Manager), upgrade global profile to 'manager' (if they are currently just a 'member')
        if (role === 'lead') {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ role: 'manager' })
                .eq('id', userId)
                .eq('role', 'member'); // Only upgrade if currently 'member' (don't downgrade admins)

            if (profileError) console.error("Error syncing global profile role:", profileError);
        }

        return NextResponse.json({ member: memberData });
    } catch (error) {
        console.error('Error updating member role:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
