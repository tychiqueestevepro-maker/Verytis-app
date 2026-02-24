import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const supabase = createClient();
    const adminClient = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;

    try {
        // Resolve profile for organization_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', userId)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
        }

        const orgId = profile.organization_id;
        let teamIdsToFilter = null;
        let roleMap = {};
        let userGlobalRole = profile.role || 'member';

        // AUTH & FILTER LOGIC
        // If not admin, restrict to own teams and get roles
        if (userGlobalRole !== 'admin') {
            const { data: myTeams } = await supabase
                .from('team_members')
                .select('team_id, role')
                .eq('user_id', userId);

            if (myTeams) {
                myTeams.forEach(t => roleMap[t.team_id] = t.role);
                teamIdsToFilter = myTeams.map(t => t.team_id);
            } else {
                teamIdsToFilter = [];
            }

            // Optimization: If no teams, return early
            if (teamIdsToFilter.length === 0) {
                return NextResponse.json({ teams: [] });
            }
        }

        // QUERY - Use admin client to bypass RLS for member counts, but ALWAYS filter by orgId
        let query = adminClient
            .from('teams')
            .select(`
                *,
                team_members (count),
                monitored_resources (
                    id,
                    type,
                    integrations (
                        provider
                    )
                )
            `)
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false });

        if (teamIdsToFilter !== null) {
            query = query.in('id', teamIdsToFilter);
        }

        const { data: teams, error } = await query;

        if (error) throw error;

        // Transform data
        const formattedTeams = teams.map(team => {
            // Extract unique providers
            const resources = team.monitored_resources || [];
            const integrations = [...new Set(resources.map(r => {
                // Return 'github' or 'slack' based on provider or type fallback
                return r.integrations?.provider || (r.type === 'repo' ? 'github' : (r.type === 'channel' ? 'slack' : null));
            }).filter(item => item && item !== 'slack'))];

            return {
                id: team.id,
                name: team.name,
                description: team.description,
                type: team.type || 'Operational',
                status: 'Active',
                members: team.team_members?.[0]?.count || 0,
                channels: resources.length,
                integrations: integrations,
                created_at: team.created_at,
                scopes: team.settings?.scopes || [],
                currentUserRole: userGlobalRole === 'admin' ? 'Admin' : (roleMap[team.id] === 'lead' ? 'Manager' : (roleMap[team.id] ? 'Member' : 'None'))
            };
        });

        // Sort teams: Manager first, then others
        formattedTeams.sort((a, b) => {
            const isManagerA = a.currentUserRole === 'Manager';
            const isManagerB = b.currentUserRole === 'Manager';
            if (isManagerA && !isManagerB) return -1;
            if (!isManagerA && isManagerB) return 1;
            return 0; // Keep original order (created_at)
        });

        return NextResponse.json({ teams: formattedTeams });
    } catch (error) {
        console.error('Error fetching teams:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const body = await req.json();
        const { name, description, type, organization_id, members, channels, scopes } = body;

        console.log('Creating team with:', { name, type, members: members?.length, channels: channels?.length, scopes });

        // Basic validation
        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) return NextResponse.json({ error: 'Org not found' }, { status: 400 });

        const orgId = profile.organization_id;

        // Prepare settings with scopes
        const settings = {
            scopes: scopes || []
        };

        // 1. Create Team
        const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert([{
                name,
                description,
                type: type || 'operational',
                organization_id: orgId,
                settings
            }])
            .select()
            .single();

        if (teamError) throw teamError;

        const teamId = team.id;

        // 2. Add Members (if any)
        if (members && members.length > 0) {
            console.log('Adding members:', members);
            const membersToInsert = members.map(member => {
                // Map role: 'Manager' -> 'lead', anything else -> 'member'
                let role = (member.role || 'member').toLowerCase();
                if (role === 'manager') role = 'lead';

                return {
                    team_id: teamId,
                    user_id: member.id,
                    role
                };
            });

            console.log('Members to insert:', membersToInsert);

            const { error: membersError } = await supabase
                .from('team_members')
                .insert(membersToInsert);

            if (membersError) {
                console.error("Error adding members:", membersError);
            } else {
                console.log(`✅ Successfully added ${membersToInsert.length} members`);
            }
        } else {
            console.log('No members to add');
        }

        // 3. Link Channels (if any)
        if (channels && channels.length > 0) {
            const { error: channelsError } = await supabase
                .from('monitored_resources')
                .update({ team_id: teamId })
                .in('id', channels); // channels should be array of IDs

            if (channelsError) console.error("Error linking channels:", channelsError);
        }

        return NextResponse.json({ team });
    } catch (error) {
        console.error('Error creating team:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
