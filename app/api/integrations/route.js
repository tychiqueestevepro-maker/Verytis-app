import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (!profile?.organization_id) return NextResponse.json({ error: 'No organization' }, { status: 400 });

    try {
        const { data: integrations, error } = await supabase
            .from('integrations')
            .select('id, provider, name, settings, created_at')
            .eq('organization_id', profile.organization_id);

        if (error) throw error;

        // Filter connected ones only
        const connectedIntegrations = (integrations || []).filter(i => {
            if (i.provider === 'slack') return !!i.settings?.bot_token;
            if (i.provider === 'github') return !!i.settings?.access_token;
            if (i.provider === 'trello') return !!i.settings?.api_token;
            return false;
        }).map(i => ({
            id: i.id,
            provider: i.provider,
            name: i.name || i.provider,
            connected: true
        }));

        return NextResponse.json({ integrations: connectedIntegrations });
    } catch (error) {
        console.error('Error fetching integrations:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
