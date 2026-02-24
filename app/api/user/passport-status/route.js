import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getValidGitHubToken } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const targetUserId = user.id;

        // 2. Fetch User Profile (INCLUDING slack_user_id)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, organization_id, slack_user_id, social_profiles')
            .eq('id', targetUserId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        if (!profile.organization_id) {
            return NextResponse.json({ error: 'No organization assigned' }, { status: 400 });
        }

        // 3. Get All Organization Integrations
        const { data: integrations } = await supabase
            .from('integrations')
            .select('*')
            .eq('organization_id', profile.organization_id);

        const slackIntegration = integrations?.find(i => i.provider === 'slack');
        const githubIntegration = integrations?.find(i => i.provider === 'github');
        const trelloIntegration = integrations?.find(i => i.provider === 'trello');

        let slackStatus = { connected: false };
        let debugInfo = { mode: 'init' };

        // Check recursively for token in known locations
        const slackAccessToken = slackIntegration?.access_token || slackIntegration?.settings?.bot_token || slackIntegration?.settings?.access_token;

        // --- SLACK STATUS ---
        if (profile.slack_user_id) {
            debugInfo.mode = 'database_link';
            slackStatus = {
                connected: true,
                source: 'database_link',
                slackId: profile.slack_user_id,
                email: profile.email,
                lastSync: new Date().toISOString(),
                foundInOrg: true, // For demo purposes, we assume valid if ID exists and token is present
                orgName: slackIntegration?.name || 'Slack Workspace'
            };

            // Enhance with real data from Slack API if token available
            if (slackAccessToken) {
                try {
                    const slackRes = await fetch(`https://slack.com/api/users.info?user=${profile.slack_user_id}`, {
                        headers: { 'Authorization': `Bearer ${slackAccessToken}` }
                    });
                    const slackData = await slackRes.json();

                    if (slackData.ok && slackData.user) {
                        slackStatus.email = slackData.user.profile.email;
                        slackStatus.workspaceName = slackIntegration?.name || 'Slack Workspace';
                        slackStatus.avatar = slackData.user.profile.image_48;
                        slackStatus.foundInOrg = !slackData.user.deleted; // User exists and not deleted
                    }
                } catch (e) {
                    console.error("Slack Enrichment Error:", e);
                }
            }
        }
        // --- STRATEGY B: AUTO-DISCOVERY (Fallback) ---
        else if (slackAccessToken) {
            debugInfo.mode = 'auto_discovery';
            try {
                // Call Slack API to get member list
                const slackResponse = await fetch('https://slack.com/api/users.list', {
                    headers: { 'Authorization': `Bearer ${slackAccessToken}` }
                });

                const slackData = await slackResponse.json();

                if (slackData.ok && slackData.members) {
                    const userEmail = profile.email.toLowerCase().trim();

                    // Find match
                    const match = slackData.members.find(m =>
                        m.profile?.email?.toLowerCase().trim() === userEmail && !m.deleted
                    );

                    if (match) {
                        slackStatus = {
                            connected: true, // It's "connected" in terms of visibility, but not linked in DB yet
                            source: 'auto_match_api',
                            slackId: match.id,
                            email: match.profile.email,
                            workspaceName: slackIntegration?.name || 'Slack Workspace',
                            foundInOrg: true,
                            orgName: slackIntegration?.name || 'Slack Workspace'
                        };
                    } else {
                        slackStatus = {
                            connected: false,
                            reason: 'email_mismatch',
                            message: `User email (${userEmail}) not found in connected Slack workspace.`,
                            userEmail: userEmail
                        };
                    }
                }
            } catch (apiError) {
                console.error('Slack API call failed:', apiError);
                slackStatus = {
                    connected: false,
                    reason: 'network_error',
                    message: `Network Error: ${apiError.message}`
                };
            }
        } else {
            slackStatus = {
                connected: false,
                reason: 'no_integration_token',
                message: "No Slack integration found."
            };
        }

        // Teams (Statique pour l'instant)
        const teamsStatus = { connected: false };

        // --- GITHUB STATUS (From social_profiles) ---
        let githubStatus = { connected: false };
        if (profile.social_profiles?.github) {
            githubStatus = {
                connected: true,
                source: 'passport_id',
                username: profile.social_profiles.github.username,
                email: profile.social_profiles.github.email,
                lastSync: profile.social_profiles.github.connected_at,
                foundInOrg: true,
                orgName: githubIntegration?.name || 'GitHub Org'
            };

            // Check if user exists in GitHub org
            if (githubIntegration && githubIntegration.settings?.installation_id) {
                try {
                    const githubToken = await getValidGitHubToken(githubIntegration.id);
                    if (githubToken) {
                        // Get org name from first repo
                        const reposRes = await fetch(`https://api.github.com/user/installations/${githubIntegration.settings.installation_id}/repositories?per_page=1`, {
                            headers: {
                                'Authorization': `Bearer ${githubToken}`,
                                'Accept': 'application/vnd.github.v3+json'
                            }
                        });

                        if (reposRes.ok) {
                            const reposData = await reposRes.json();
                            if (reposData.repositories && reposData.repositories.length > 0) {
                                const orgName = reposData.repositories[0].full_name.split('/')[0];
                                githubStatus.orgName = orgName;

                                // Check if user is member of org
                                const memberRes = await fetch(`https://api.github.com/orgs/${orgName}/members/${profile.social_profiles.github.username}`, {
                                    headers: {
                                        'Authorization': `Bearer ${githubToken}`,
                                        'Accept': 'application/vnd.github.v3+json'
                                    }
                                });

                                githubStatus.foundInOrg = memberRes.status === 204; // 204 = member exists
                            }
                        }
                    }
                } catch (e) {
                    console.error('GitHub org membership check failed:', e);
                }
            }
        }

        // --- TRELLO STATUS (From social_profiles) ---
        let trelloStatus = { connected: false };
        if (profile.social_profiles?.trello) {
            trelloStatus = {
                connected: true,
                source: 'passport_id',
                username: profile.social_profiles.trello.username,
                email: profile.social_profiles.trello.email || null,
                lastSync: profile.social_profiles.trello.connected_at,
                foundInOrg: true,
                orgName: trelloIntegration?.name || 'Trello Workspace'
            };

            // Check if user exists in Trello workspace
            if (trelloIntegration && trelloIntegration.settings?.api_token) {
                try {
                    const API_KEY = process.env.TRELLO_API_KEY;
                    const token = trelloIntegration.settings.api_token;

                    // Get workspace/org name
                    const orgRes = await fetch(`https://api.trello.com/1/members/me/organizations?key=${API_KEY}&token=${token}&fields=displayName,name`, {
                        headers: { 'Accept': 'application/json' }
                    });

                    if (orgRes.ok) {
                        const orgs = await orgRes.json();
                        if (orgs && orgs.length > 0) {
                            const orgName = orgs[0].displayName || orgs[0].name;
                            trelloStatus.orgName = orgName;

                            // Get org members
                            const membersRes = await fetch(`https://api.trello.com/1/organizations/${orgs[0].id}/members?key=${API_KEY}&token=${token}&fields=username`, {
                                headers: { 'Accept': 'application/json' }
                            });

                            if (membersRes.ok) {
                                const members = await membersRes.json();
                                trelloStatus.foundInOrg = members.some(m => m.username === profile.social_profiles.trello.username);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Trello org membership check failed:', e);
                }
            }
        }

        return NextResponse.json({
            userId: targetUserId,
            userEmail: profile.email,
            debug: debugInfo,
            connections: {
                slack: slackStatus,
                teams: teamsStatus,
                github: githubStatus,
                trello: trelloStatus
            }
        });

    } catch (error) {
        console.error('Error in passport-status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
