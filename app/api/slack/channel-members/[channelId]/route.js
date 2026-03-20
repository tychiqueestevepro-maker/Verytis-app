import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WebClient } from '@slack/web-api';

export async function GET(req, { params }) {
    const { channelId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. Get the monitored resource to find external_id (Slack channel ID)
        const { data: resource } = await supabase.from('monitored_resources')
            .select('external_id, integration_id, metadata')
            .eq('id', channelId)
            .single();

        if (!resource) {
            return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
        }

        // 2. Get Slack token from integration
        const { data: integration } = await supabase.from('integrations')
            .select('settings')
            .eq('id', resource.integration_id)
            .single();

        const isDemo = integration.settings.bot_token === 'demo_token' || !integration.settings.bot_token;
        let members = [];
        let total = 0;

        if (!isDemo) {
            try {
                const client = new WebClient(integration.settings.bot_token);

                // 3. Get channel info for real member count
                const channelInfo = await client.conversations.info({
                    channel: resource.external_id
                });

                if (channelInfo.ok && channelInfo.channel.num_members) {
                    total = channelInfo.channel.num_members;
                    // Cache the count in metadata for faster subsequent loads and demo fallback
                    const updatedMetadata = {
                        ...(resource.metadata || {}),
                        slack_member_count: total,
                        last_sync_at: new Date().toISOString()
                    };
                    await supabase.from('monitored_resources')
                        .update({ metadata: updatedMetadata })
                        .eq('id', channelId);
                }

                // 4. Get leading participants from Slack
                const membersResult = await client.conversations.members({
                    channel: resource.external_id,
                    limit: 100
                });

                if (membersResult.members && membersResult.members.length > 0) {
                    const tempMembers = [];
                    const emailsToCheck = [];

                    // 5. Get user info for each member
                    for (const userId of membersResult.members.slice(0, 20)) {
                        try {
                            const userInfo = await client.users.info({ user: userId });
                            if (userInfo.user && !userInfo.user.is_bot) {
                                const email = userInfo.user.profile?.email || null;
                                if (email) emailsToCheck.push(email);

                                tempMembers.push({
                                    id: userInfo.user.id,
                                    name: userInfo.user.real_name || userInfo.user.name,
                                    email: email,
                                    title: userInfo.user.profile?.title || 'Team Member',
                                    avatar: userInfo.user.profile?.image_48 || null,
                                    initials: (userInfo.user.real_name || userInfo.user.name || 'U')
                                        .split(' ')
                                        .map(n => n[0])
                                        .join('')
                                        .toUpperCase()
                                        .slice(0, 2)
                                });
                            }
                        } catch (e) {
                            console.error('Error fetching user', userId, e.message);
                        }
                    }

                    // 6. Check "isConnected" status against Profiles table
                    let connectedEmails = new Set();
                    if (emailsToCheck.length > 0) {
                        const { data: profiles } = await supabase
                            .from('profiles')
                            .select('email')
                            .in('email', emailsToCheck);

                        if (profiles) {
                            profiles.forEach(p => connectedEmails.add(p.email));
                        }
                    }

                    members = tempMembers.map(m => ({
                        ...m,
                        isConnected: m.email && connectedEmails.has(m.email)
                    }));
                }
            } catch (e) {
                console.warn('Slack API failed, falling back to DB contributors/cache:', e.message);
            }
        }

        // 7. Fallback: If no members from Slack (or demo), use DB contributors from activity_logs
        if (members.length === 0) {
            const { data: contributors } = await supabase
                .from('activity_logs')
                .select(`
                    actor_id,
                    profiles:actor_id (
                        id,
                        full_name,
                        email,
                        avatar_url,
                        role
                    )
                `)
                .eq('resource_id', channelId);

            if (contributors) {
                // Unique contributors
                const uniqueActors = new Map();
                contributors.forEach(c => {
                    if (c.profiles && !uniqueActors.has(c.profiles.id)) {
                        uniqueActors.set(c.profiles.id, c.profiles);
                    }
                });

                members = Array.from(uniqueActors.values()).map(p => ({
                    id: p.id,
                    name: p.full_name,
                    email: p.email,
                    title: p.role || 'Contributor',
                    avatar: p.avatar_url,
                    isConnected: true,
                    initials: p.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                }));
            }
        }

        // Calculate final total: 
        // 1. If we have Slack count (real or cached), use it.
        // 2. Otherwise, use members length as baseline.
        const cachedCount = resource.metadata?.slack_member_count || resource.metadata?.num_members;
        const finalTotal = cachedCount || members.length;

        return NextResponse.json({ members, total: finalTotal });

    } catch (error) {
        console.error('Channel Members Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
