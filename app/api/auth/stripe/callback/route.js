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

        // Exchange code for account details
        const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_secret: process.env.STRIPE_SECRET_KEY,
                code,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('[STRIPE CALLBACK] Token exchange failed:', tokenData);
            return NextResponse.json({ error: tokenData.error_description || 'Token exchange failed' }, { status: 400 });
        }

        // Save to user_connections
        const supabase = createAdminClient();
        
        // Stripe Connect returns stripe_user_id (the connected account ID)
        const accountName = tokenData.stripe_user_id || 'Stripe Account';

        const { data: existing } = await supabase
            .from('user_connections')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('provider', 'stripe')
            .maybeSingle();

        const connectionData = {
            organization_id: organizationId,
            user_id: userId,
            provider: 'stripe',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            account_name: accountName,
            connection_type: 'team',
            scope: 'read_write',
            metadata: {
                 stripe_user_id: tokenData.stripe_user_id,
                 stripe_publishable_key: tokenData.stripe_publishable_key,
                 livemode: tokenData.livemode,
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

        if (upsertError) throw upsertError;

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Stripe Connecté</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
        .card { padding: 3rem; background: white; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; }
        .success { color: #6366f1; font-weight: 800; font-size: 1.5rem; margin-bottom: 1rem; }
        p { color: #64748b; font-size: 1rem; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="card">
        <div class="success">Stripe Connecté !</div>
        <p>Votre compte Stripe a été lié avec succès à Verytis. Vous pouvez fermer cette fenêtre.</p>
    </div>
    <script>
        if (window.opener) {
            window.opener.postMessage({ type: 'STRIPE_CONNECTED' }, '*');
            setTimeout(() => window.close(), 1500);
        }
    </script>
</body>
</html>
        `;

        return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });

    } catch (err) {
        console.error('[STRIPE CALLBACK] Unexpected Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
