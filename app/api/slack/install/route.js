import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

export async function GET(req) {
    if (!process.env.SLACK_CLIENT_ID) {
        return NextResponse.json({ error: 'SLACK_CLIENT_ID is not defined in environment variables' }, { status: 500 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const organizationId = profile.organization_id;

    const scopes = [
        'channels:history', 'channels:read', 'chat:write', 'files:read',
        'groups:history', 'groups:read', 'reactions:read',
        'users:read', 'users:read.email'
    ].join(',');

    if (!organizationId) return NextResponse.json({ error: 'Missing organization context' }, { status: 400 });

    const state = JSON.stringify({
        organizationId: organizationId
    });

    const installUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/callback&state=${encodeURIComponent(state)}`;

    return NextResponse.redirect(installUrl);
}
