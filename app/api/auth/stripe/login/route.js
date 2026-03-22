import { NextResponse } from 'next/server';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const organizationId = searchParams.get('organizationId');

    if (!userId || !organizationId) {
        return NextResponse.json({ error: 'Missing userId or organizationId' }, { status: 400 });
    }

    const clientId = process.env.STRIPE_CLIENT_ID;
    if (!clientId) {
        // Return a clear error if STRIPE_CLIENT_ID is missing
        return NextResponse.json({ 
            error: 'Connectez d\'abord votre Client ID Stripe dans les variables d\'environnement (STRIPE_CLIENT_ID).' 
        }, { status: 500 });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/stripe/callback`;
    const state = JSON.stringify({ userId, organizationId });
    const encodedState = Buffer.from(state).toString('base64');

    const authUrl = new URL('https://connect.stripe.com/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', 'read_write');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', encodedState);

    return NextResponse.redirect(authUrl.toString());
}
