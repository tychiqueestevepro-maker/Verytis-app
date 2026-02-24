import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const stateParam = searchParams.get('state');
    const installationId = searchParams.get('installation_id');

    if (error) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=${error}`);
    }

    if (!code) {
        return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    try {
        // Exchange code for user access token
        const response = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: code,
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('GitHub OAuth Error:', data.error_description);
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=${data.error}`);
        }

        const accessToken = data.access_token;

        // Fetch User Info to identify who installed it
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const userData = await userRes.json();

        // Fetch email if private (returns null in userData.email)
        let primaryEmail = userData.email;
        if (!primaryEmail) {
            try {
                const emailsRes = await fetch('https://api.github.com/user/emails', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                const emails = await emailsRes.json();
                if (Array.isArray(emails)) {
                    const primary = emails.find(e => e.primary && e.verified);
                    if (primary) primaryEmail = primary.email;
                }
            } catch (e) {
                console.error("Failed to fetch emails:", e);
            }
        }

        console.log("GitHub User Data:", { id: userData.id, login: userData.login, email: primaryEmail });

        // --- LOGIC SPLIT: APP INSTALLATION vs MEMBER LINKING ---

        let state = {};
        try {
            if (stateParam) state = JSON.parse(stateParam);
        } catch (e) {
            // ignore if not json
        }

        // SECURITY: Verify state nonce against cookie to prevent CSRF
        const cookieNonce = req.cookies.get('github_oauth_nonce')?.value;
        if (!state.nonce || state.nonce !== cookieNonce) {
            console.error('❌ GitHub OAuth State/Nonce mismatch or missing');
            return NextResponse.json({ error: 'Security validation failed: state mismatch' }, { status: 403 });
        }

        // Clear the nonce cookie after verification
        const responseHeaders = new Headers();
        // Note: In Next.js App Router, we usually handle this via the returned NextResponse object

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // CASE 1: Member Linking (Passport ID)
        if (state.type === 'user_link' && state.userId) {

            // Get current profile
            const { data: profile } = await supabase.from('profiles').select('social_profiles').eq('id', state.userId).single();

            const currentSocials = profile?.social_profiles || {};

            // Update social_profiles
            const updatedSocials = {
                ...currentSocials,
                github: {
                    id: userData.id,
                    username: userData.login,
                    email: primaryEmail, // fetched above
                    avatar_url: userData.avatar_url,
                    html_url: userData.html_url,
                    connected_at: new Date().toISOString(),
                    access_token: accessToken // Store token for user-specific actions
                }
            };

            await supabase.from('profiles')
                .update({ social_profiles: updatedSocials })
                .eq('id', state.userId);

            // Return HTML to notify success
            const html = `
                <html>
                    <body>
                        <script>
                            if (window.opener) {
                                window.opener.postMessage({ type: 'GITHUB_LINKED', user: ${JSON.stringify(userData.login)} }, '*');
                                window.close();
                            } else {
                                window.location.href = '/?linked=github';
                            }
                        </script>
                        <p>GitHub Account Linked! You can close this window.</p>
                    </body>
                </html>
            `;
            const finalResponse = new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
            finalResponse.cookies.delete('github_oauth_nonce');
            return finalResponse;
        }

        // CASE 2: Org App Installation (Existing Logic)
        // Retrieve Org ID from state if available
        const targetOrgId = state.organizationId;

        if (!targetOrgId) {
            console.error('❌ Missing targetOrgId in GitHub callback state');
            return NextResponse.json({ error: 'Missing organization context in OAuth state' }, { status: 400 });
        }

        console.log(`Linking GitHub App for User ${userData.login} to Org ${targetOrgId}`);

        // Check for existing integration
        const { data: existingInt } = await supabase.from('integrations')
            .select('id')
            .eq('organization_id', targetOrgId)
            .eq('provider', 'github')
            .single();

        const integrationData = {
            organization_id: targetOrgId,
            provider: 'github',
            name: userData.login,
            external_id: String(userData.id),
            settings: {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in: data.expires_in,
                refresh_token_expires_in: data.refresh_token_expires_in,
                token_type: data.token_type,
                scope: data.scope,
                created_at: Math.floor(Date.now() / 1000), // Store as seconds timestamp
                installation_id: installationId,
                username: userData.login,
                avatar_url: userData.avatar_url,
                html_url: userData.html_url
            }
        };

        if (existingInt) {
            await supabase.from('integrations').update(integrationData).eq('id', existingInt.id);
        } else {
            await supabase.from('integrations').insert(integrationData);
        }

        // Return HTML to close popup and notify parent
        const html = `
            <html>
                <body>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({ type: 'GITHUB_CONNECTED' }, '${process.env.NEXT_PUBLIC_BASE_URL}');
                            window.close();
                        } else {
                            // Fallback if not in a popup (e.g. direct visit)
                            window.location.href = '/?connected=true&app=github';
                        }
                    </script>
                    <p>Connection successful. You can close this window.</p>
                </body>
            </html>
        `;

        const finalResponse = new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' },
        });
        finalResponse.cookies.delete('github_oauth_nonce');

        return finalResponse;

    } catch (err) {
        console.error('OAuth Exception:', err);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=server_error`);
    }
}
