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

    const targetOrgId = profile.organization_id;
    const API_KEY = process.env.TRELLO_API_KEY;

    try {
        // 1. Get Trello Integration
        const { data: integration, error: intError } = await supabase
            .from('integrations')
            .select('id, settings')
            .eq('organization_id', targetOrgId)
            .eq('provider', 'trello')
            .single();

        if (intError || !integration) {
            console.warn('No Trello integration found for org:', targetOrgId);
            return NextResponse.json({ boards: [] });
        }

        const token = integration.settings?.api_token;

        // 2. Try Fetch Boards from Trello (if token and key are present)
        if (token && API_KEY && !token.includes('demo')) {
            try {
                const response = await fetch(`https://api.trello.com/1/members/me/boards?key=${API_KEY}&token=${token}&fields=id,name,url&filter=open`);
                if (response.ok) {
                    const boards = await response.json();
                    return NextResponse.json({
                        boards: boards.map(b => ({ id: b.id, name: b.name, url: b.url, provider: 'trello' }))
                    });
                } else {
                    console.warn('Trello API returned non-ok status:', response.status);
                }
            } catch (e) {
                console.error('Trello API Fetch failed:', e.message);
            }
        }

        // 3. Fallback: Return already monitored boards from DB
        // This ensures demo data shows up 100% of the time
        const { data: existing, error: dbError } = await supabase.from('monitored_resources')
            .select('*')
            .eq('integration_id', integration.id);

        if (dbError) {
            console.error('Error fetching monitored boards from DB:', dbError.message);
            return NextResponse.json({ error: dbError.message }, { status: 500 });
        }

        return NextResponse.json({
            boards: (existing || []).map(b => ({
                id: b.external_id,
                name: b.name,
                url: '#',
                provider: 'trello'
            }))
        });

    } catch (error) {
        console.error('Critical failure in Trello boards route:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
