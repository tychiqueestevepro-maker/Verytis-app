import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import crypto from 'crypto';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/github/callback`;
    const scope = 'read:user user:email';

    // SECURITY: Generate a random nonce and store it in a cookie to prevent CSRF
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = JSON.stringify({ userId, type: 'user_link', nonce });

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${encodeURIComponent(state)}&prompt=consent`;

    console.log('Redirecting to:', githubAuthUrl);

    const response = NextResponse.redirect(githubAuthUrl);

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
