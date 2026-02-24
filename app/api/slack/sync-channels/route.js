import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { WebClient } from '@slack/web-api';

export async function POST() {
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

    try {
        // 1. Get Slack token
        const { data: integration } = await supabase.from('integrations')
            .select('id, settings')
            .eq('organization_id', targetOrgId)
            .eq('provider', 'slack')
            .single();

        if (!integration?.settings?.bot_token) {
            return NextResponse.json({ error: 'No Slack token found' }, { status: 401 });
        }

        const client = new WebClient(integration.settings.bot_token);

        // 2. Get all monitored resources for this integration
        const { data: resources } = await supabase.from('monitored_resources')
            .select('id, external_id, name')
            .eq('integration_id', integration.id);

        if (!resources || resources.length === 0) {
            return NextResponse.json({ message: 'No channels to sync', updated: 0 });
        }

        // 3. Fetch fresh channel data from Slack
        const slackResult = await client.conversations.list({
            types: 'public_channel,private_channel',
            limit: 200,
            exclude_archived: true
        });

        // Create a map of Slack channels by ID
        const slackChannelsMap = new Map();
        for (const ch of slackResult.channels) {
            slackChannelsMap.set(ch.id, {
                num_members: ch.num_members || 0,
                is_private: ch.is_private || false
            });
        }

        // 4. Update each monitored resource with fresh metadata
        let updatedCount = 0;
        for (const resource of resources) {
            const slackInfo = slackChannelsMap.get(resource.external_id);
            if (slackInfo) {
                const { error } = await supabase.from('monitored_resources')
                    .update({
                        metadata: slackInfo,
                        last_active_at: new Date().toISOString()
                    })
                    .eq('id', resource.id);

                if (!error) updatedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            updated: updatedCount,
            total: resources.length
        });

    } catch (error) {
        console.error('Sync Channels Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
