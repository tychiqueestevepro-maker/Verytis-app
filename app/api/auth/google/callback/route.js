import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const encodedState = searchParams.get('state');

    if (!code || !encodedState) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    try {
        const stateStr = Buffer.from(encodedState, 'base64').toString();
        const state = JSON.parse(stateStr);
        const { userId, organizationId } = state;

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('[GOOGLE CALLBACK] Token exchange failed:', tokenData);
            return NextResponse.json({ error: tokenData.error_description || 'Token exchange failed' }, { status: 400 });
        }

        // Fetch user info to get the account name (email)
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const userData = await userResponse.json();
        const accountName = userData.email || 'Google Account';

        const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

        // Save to user_connections
        const supabase = createAdminClient();
        // Manual upsert logic to avoid "no unique constraint" error
        const { data: existing } = await supabase
            .from('user_connections')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('provider', 'google_workspace')
            .maybeSingle();

        const connectionData = {
            organization_id: organizationId,
            user_id: userId,
            provider: 'google_workspace',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token, // Only present on first consent or if prompt=consent
            account_name: accountName,
            connection_type: 'team',
            scope: 'team',
            metadata: {
                expires_in: tokenData.expires_in,
                expires_at: expiresAt,
                email: accountName,
                picture: userData.picture,
                updated_at: Math.floor(Date.now() / 1000)
            }
        };

        let upsertError = null;
        if (existing) {
            const { error } = await supabase
                .from('user_connections')
                .update(connectionData)
                .eq('id', existing.id);
            upsertError = error;
        } else {
            const { error } = await supabase
                .from('user_connections')
                .insert(connectionData);
            upsertError = error;
        }

        if (upsertError) {
            console.error('[GOOGLE CALLBACK] DB Error:', upsertError);
            throw upsertError;
        }

        // Return a page that posts a message to the opener and closes
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Google Workspace Connected</title>
    <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
        .card { padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); text-align: center; }
        .success { color: #059669; font-weight: bold; font-size: 1.25rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="success">Google Workspace Connected!</div>
        <p>You can close this window now.</p>
    </div>
    <script>
        if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_WORKSPACE_CONNECTED' }, '*');
            setTimeout(() => window.close(), 1000);
        }
    </script>
</body>
</html>
        `;

        return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });

    } catch (err) {
        console.error('[GOOGLE CALLBACK] Unexpected Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
