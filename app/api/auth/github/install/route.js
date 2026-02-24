import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
        return NextResponse.json({ error: 'Missing organizationId parameter' }, { status: 400 });
    }

    const state = JSON.stringify({
        type: 'app_install',
        organizationId: organizationId
    });

    const appSlug = 'VerytisApp';
    const installUrl = `https://github.com/apps/${appSlug}/installations/new?state=${encodeURIComponent(state)}`;

    // Note: ensure your GitHub App settings have "Request user authorization (OAuth) during installation"
    // enabled so that the callback receives a 'code' parameter.
    return NextResponse.redirect(installUrl);
}
