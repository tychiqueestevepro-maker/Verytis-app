import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 10; // Cache for 10 seconds

export async function GET(req) {

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select(`
                id, full_name, email, avatar_url, role, status, job_title, slack_user_id, social_profiles,
                created_at, updated_at,
                team_members (
                    role,
                    teams (id, name)
                ),
                connections (
                    provider,
                    status
                )
            `)
            .eq('organization_id', profile.organization_id);

        if (error) throw error;

        const formattedUsers = users.map(user => {
            const allTeams = user.team_members?.map(tm => ({
                id: tm.teams.id,
                name: tm.teams.name,
                role: tm.role
            })) || [];

            const managedTeams = allTeams.filter(t => t.role === 'lead');

            return {
                id: user.id,
                name: user.full_name || user.email.split('@')[0], // Fallback name
                email: user.email,
                avatar: user.avatar_url,
                role: user.role || 'Member',
                status: user.status || 'active',
                job_title: user.job_title || '',
                initials: (user.full_name || user.email).slice(0, 2).toUpperCase(),
                teams: allTeams, // All teams they belong to
                managedTeams, // List of teams they manage
                slackId: user.slack_user_id, // Verification Status
                createdAt: user.created_at,
                updatedAt: user.updated_at,
                socialProfiles: user.social_profiles || {},
                connections: user.connections || []
            };
        });

        return NextResponse.json({ users: formattedUsers }, {
            headers: {
                'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
