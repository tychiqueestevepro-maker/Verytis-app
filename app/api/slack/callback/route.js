import { NextResponse } from 'next/server';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=${error}`);
    }

    if (!code) {
        return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    try {
        // Exchange code for token
        const response = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.SLACK_CLIENT_ID,
                client_secret: process.env.SLACK_CLIENT_SECRET,
                code: code,
                redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/slack/callback`
            })
        });

        const data = await response.json();

        if (!data.ok) {
            console.error('Slack OAuth Error:', data.error);
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=${data.error}`);
        }

        // Parse state to get Organization ID
        const stateParam = searchParams.get('state');
        let state = {};
        try {
            if (stateParam) state = JSON.parse(stateParam);
        } catch (e) {
            // ignore
        }

        const { createClient } = require('@/lib/supabase/server');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=unauthorized`);
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (!profile?.organization_id) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=no_org`);
        }

        const targetOrgId = profile.organization_id;

        const { data: existingInt } = await supabase.from('integrations')
            .select('id')
            .eq('organization_id', targetOrgId)
            .eq('provider', 'slack')
            .single();

        if (existingInt) {
            await supabase.from('integrations').update({
                settings: { bot_token: data.access_token, team_id: data.team.id },
                name: data.team.name,
                external_id: data.team.id
            }).eq('id', existingInt.id);
        } else {
            await supabase.from('integrations').insert({
                organization_id: targetOrgId,
                provider: 'slack',
                name: data.team.name,
                external_id: data.team.id,
                settings: { bot_token: data.access_token, team_id: data.team.id }
            });
        }

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?connected=true&app=slack`);

    } catch (err) {
        console.error('OAuth Exception:', err);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}?error=server_error`);
    }
}
