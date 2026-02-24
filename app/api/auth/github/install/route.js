import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
        return NextResponse.json({ error: 'Missing organizationId parameter' }, { status: 400 });
    }

    // SECURITY: Generate a random nonce and store it in a cookie to prevent CSRF/State Injection
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = JSON.stringify({
        type: 'app_install',
        organizationId: organizationId,
        nonce: nonce
    });

    const appSlug = 'VerytisApp';
    const installUrl = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;

    const response = NextResponse.redirect(installUrl);

    // Set a short-lived cookie with the nonce for validation in the callback
    response.cookies.set('github_oauth_nonce', nonce, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_SERVER_ENVIRONMENT === 'production',
        sameSite: 'lax',
        maxAge: 3600 // 1 hour
    });

    return response;
}
