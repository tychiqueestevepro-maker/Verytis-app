import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

    // 2. Check if we have a token in 'integrations'
    const { data, error } = await supabase.from('integrations')
        .select('id, settings, name')
        .eq('organization_id', targetOrgId)
        .eq('provider', 'slack')
        .single();

    // 3. Determine status
    const isConnected = !!(data && data.settings?.bot_token);

    return NextResponse.json({
        connected: isConnected,
        teamName: data?.name || null,
        lastSync: isConnected ? new Date().toISOString() : null
    });
}
