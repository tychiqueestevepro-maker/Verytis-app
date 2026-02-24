import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidGitHubToken } from '@/lib/github';

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

    try {
        const { data: integration } = await supabase.from('integrations')
            .select('id, settings')
            .eq('organization_id', targetOrgId)
            .eq('provider', 'github')
            .single();

        if (!integration) {
            return NextResponse.json({ repositories: [] });
        }

        const access_token = await getValidGitHubToken(integration.id);
        const { installation_id } = integration.settings;

        console.log('[DEBUG repos] integration.id:', integration.id);
        console.log('[DEBUG repos] installation_id:', installation_id);
        console.log('[DEBUG repos] token prefix:', access_token?.substring(0, 10));

        if (!access_token || !installation_id) {
            const { data: existing } = await supabase.from('monitored_resources')
                .select('*')
                .eq('integration_id', integration.id)
                .eq('type', 'repo');

            return NextResponse.json({
                repositories: (existing || []).map(r => ({
                    id: r.external_id,
                    name: r.name,
                    private: true,
                    url: '#',
                    description: 'Resource from database',
                    updated_at: r.last_active_at
                }))
            });
        }

        try {
            const res = await fetch(`https://api.github.com/user/installations/${installation_id}/repositories`, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                const repositories = (data.repositories || []).map(repo => ({
                    id: repo.id,
                    name: repo.full_name,
                    private: repo.private,
                    url: repo.html_url,
                    description: repo.description,
                    updated_at: repo.updated_at
                }));
                return NextResponse.json({ repositories });
            }
        } catch (e) {
            console.error('GitHub API Failed:', e);
        }

        const { data: existing } = await supabase.from('monitored_resources')
            .select('*')
            .eq('integration_id', integration.id)
            .eq('type', 'repo');

        return NextResponse.json({
            repositories: (existing || []).map(r => ({
                id: r.external_id,
                name: r.name,
                private: true,
                url: '#',
                description: 'Cached resource',
                updated_at: r.last_active_at
            }))
        });

    } catch (error) {
        console.error('Error fetching GitHub repos:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
