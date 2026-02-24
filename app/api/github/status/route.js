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

    const { data, error } = await supabase.from('integrations')
        .select('id, settings, name')
        .eq('organization_id', targetOrgId)
        .eq('provider', 'github')
        .single();

    const isConnected = !!(data && (data.settings?.access_token || data.settings?.installation_id));

    // Fetch organization name from GitHub API
    let orgName = data?.settings?.username || data?.name || null;

    if (isConnected && data.settings?.installation_id) {
        try {
            const access_token = await getValidGitHubToken(data.id);
            if (access_token) {
                const res = await fetch(`https://api.github.com/user/installations/${data.settings.installation_id}/repositories?per_page=1`, {
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (res.ok) {
                    const repoData = await res.json();
                    if (repoData.repositories && repoData.repositories.length > 0) {
                        // Extract org name from first repo's full_name (e.g., "VerytisApp/Verytis" -> "VerytisApp")
                        const fullName = repoData.repositories[0].full_name;
                        orgName = fullName.split('/')[0];
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch GitHub org name:', e);
            // Fall back to stored username
        }
    }

    return NextResponse.json({
        connected: isConnected,
        username: orgName,
        lastSync: isConnected ? new Date().toISOString() : null
    });
}
