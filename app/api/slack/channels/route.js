import { NextResponse } from 'next/server';
import { WebClient } from '@slack/web-api';
import { createClient } from '@/lib/supabase/server';

export async function GET(req) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    const targetOrgId = profile.organization_id;

    const { data: integration } = await supabase.from('integrations')
        .select('id, settings')
        .eq('organization_id', targetOrgId)
        .eq('provider', 'slack')
        .single();

    const token = integration?.settings?.bot_token;

    if (!token) {
        const { data: existing } = await supabase.from('monitored_resources')
            .select('*')
            .eq('integration_id', integration?.id)
            .eq('type', 'channel');

        return NextResponse.json({
            channels: (existing || []).map(c => ({ id: c.external_id, name: c.name, num_members: 0 }))
        });
    }

    const client = new WebClient(token);

    try {
        const result = await client.conversations.list({
            types: 'public_channel,private_channel',
            limit: 100,
            exclude_archived: true
        });

        const channels = result.channels.map(c => ({
            id: c.id,
            name: c.name,
            is_private: c.is_private,
            num_members: c.num_members
        }));

        return NextResponse.json({ channels });
    } catch (error) {
        console.warn('Slack API Error, falling back to DB:', error.message);
        const { data: existing } = await supabase.from('monitored_resources')
            .select('*')
            .eq('integration_id', integration?.id)
            .eq('type', 'channel');

        return NextResponse.json({
            channels: (existing || []).map(c => ({ id: c.external_id, name: c.name, num_members: 0 }))
        });
    }
}
