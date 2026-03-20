import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/encryption';

export const dynamic = 'force-dynamic';

const OAUTH_PROVIDERS = ['github', 'slack', 'trello', 'shopify', 'google_workspace'];

export async function GET(req) {
    try {
        const supabase = await createClient();
        console.log('[API SETTINGS] GET request initiated');

        // 1. Verify user is logged in
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.warn('[API SETTINGS] Unauthorized');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.log('[API SETTINGS] User verified:', user.id);

        // 2. Fetch profile and organization data
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) console.error('[API SETTINGS] Profile fetch error:', profileError);

        let orgName = 'Organisation';
        if (profile?.organization_id) {
            const { data: orgData } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', profile.organization_id)
                .maybeSingle();
            if (orgData) orgName = orgData.name;
        }
        console.log('[API SETTINGS] Org Context:', { orgId: profile?.organization_id, orgName });

        // 3. Fetch Unified Connections (Org-wide)
        let connections = [];
        if (profile?.organization_id) {
            const { data: cData, error: cError } = await supabase
                .from('user_connections')
                .select('*')
                .eq('organization_id', profile.organization_id);
            
            if (cError) console.error('[API SETTINGS] Error fetching connections:', cError.message);
            else connections = cData || [];
        }

        // 3c. Legacy integrations fallback (GitHub/Slack Team)
        if (profile?.organization_id) {
            const { data: iData } = await supabase
                .from('integrations')
                .select('provider, settings')
                .eq('organization_id', profile.organization_id);
            
            if (iData) {
                iData.forEach(item => {
                    if (!connections.some(c => c.provider === item.provider)) {
                        connections.push({
                            provider: item.provider,
                            connection_type: 'team',
                            metadata: item.settings,
                            account_name: item.settings?.team_name || item.settings?.account_name || 'Workflow Integration'
                        });
                    }
                });
            }
        }

        console.log('[API SETTINGS] Connections found:', connections.length);

        // 4. Fetch organization settings (for LLM providers)
        const { data: settingsData, error: settingsError } = await supabase
            .from('organization_settings')
            .select('*')
            .eq('id', 'default')
            .maybeSingle();
        
        const settings = settingsData || {};

        const DEFAULT_PROVIDERS = [
            { id: 'openai', name: 'OpenAI', domain: 'openai.com', status: 'Not Configured', tokenPreview: '' },
            { id: 'anthropic', name: 'Anthropic Claude', domain: 'anthropic.com', status: 'Not Configured', tokenPreview: '' },
            { id: 'google', name: 'Google Gemini', domain: 'gemini.google.com', status: 'Not Configured', tokenPreview: '' },
            { id: 'github', name: 'GitHub', domain: 'github.com', status: 'Not Configured', tokenPreview: '' },
            { id: 'slack', name: 'Slack', domain: 'slack.com', status: 'Not Configured', tokenPreview: '' },
            { id: 'trello', name: 'Trello', domain: 'trello.com', status: 'Not Configured', tokenPreview: '' },
            { id: 'shopify', name: 'Shopify', domain: 'shopify.com', status: 'Not Configured', tokenPreview: '' },
            { id: 'google_workspace', name: 'Google Workspace', domain: 'workspace.google.com', status: 'Not Configured', logo: '/logos/google.svg' },
        ];

        const catalog = [];

        // 5a. LLM Providers (from settings.providers)
        (settings?.providers || []).forEach(p => {
            const { encryptedToken, ...rest } = p;
            const meta = DEFAULT_PROVIDERS.find(d => d.id === p.id) || {};
            const isConfigured = !!encryptedToken;
            catalog.push({ 
                ...meta, 
                ...rest, 
                status: isConfigured ? 'Connected' : 'Not Configured', 
                connection_type: 'llm' 
            });
        });

        // 5b. OAuth Connections (unified)
        connections.forEach(c => {
            const meta = DEFAULT_PROVIDERS.find(d => d.id === c.provider) || {};
            // Avoid duplicate if already added via LLM (unlikely for OAuth)
            if (!catalog.some(cat => cat.id === c.provider && cat.connection_type === 'team')) {
                catalog.push({
                    ...meta,
                    id: c.provider,
                    account_name: c.account_name || c.external_account_name || 'Workspace Connected',
                    connection_type: 'team', // Force 'team' display label logic in UI
                    status: 'Connected',
                    is_oauth: true,
                    metadata: c.metadata
                });
            }
        });

        // 5c. Fill gaps with placeholders
        DEFAULT_PROVIDERS.forEach(dp => {
            if (!catalog.some(c => c.id === dp.id)) {
                catalog.push({ ...dp, status: 'Not Configured' });
            }
        });

        return NextResponse.json({ 
            providers: catalog,
            user_connections: connections,
            settings: settingsData,
            user: {
                id: user.id,
                email: user.email,
                orgName
            }
        });

    } catch (error) {
        console.error('[API SETTINGS] Unexpected error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req) {
    try {
        const supabase = await createClient();
        const body = await req.json();

        // 1. Verify user is logged in
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. We could verify Admin role here on server-side as well,
        // though RLS handle it at the database layer.

        // Remove id and updated_at from the payload if present
        const { id, updated_at, ...updateData } = body;

        // 3. Encrypt sensitive provider LLM tokens via AES-256-GCM
        // IMPORTANT: Only save LLM providers into the global organization_settings.
        // OAuth providers are handled separately in the user_connections table.
        if (updateData.providers && Array.isArray(updateData.providers)) {
            updateData.providers = updateData.providers
                .filter(p => !p.is_oauth && (p.connection_type === 'llm' || p.id === 'openai' || p.id === 'anthropic' || p.id === 'google'))
                .map(p => {
                    if (p.rawToken) {
                        p.encryptedToken = encrypt(p.rawToken);
                        delete p.rawToken;
                    }
                    return p;
                });
        }

        // 4. Update the global settings
        const { data, error: updateError } = await supabase
            .from('organization_settings')
            .update(updateData)
            .eq('id', 'default')
            .select()
            .single();

        if (updateError) {
            console.error('Error updating org settings:', updateError);
            return NextResponse.json({ error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, settings: data });

    } catch (error) {
        console.error('Unexpected error in settings API PUT:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const supabase = await createClient();
        
        // Support both query params and body for maximum compatibility
        const { searchParams } = new URL(req.url);
        let providerId = searchParams.get('id');
        let type = searchParams.get('type') || 'llm';

        try {
            const body = await req.json();
            if (body.id) providerId = body.id;
            if (body.type) type = body.type;
        } catch (e) {
            // No body or invalid body, fall back to query params
        }

        if (!providerId) {
            return NextResponse.json({ error: 'Missing provider ID' }, { status: 400 });
        }

        // 1. Verify user is logged in
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch profile for organization context
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id')
            .eq('id', user.id)
            .single();

        if (type === 'llm') {
            // Handle LLM/Custom Providers (Team managed in organization_settings)
            const { data: settings } = await supabase
                .from('organization_settings')
                .select('providers')
                .eq('id', 'default')
                .single();

            if (settings?.providers) {
                const updatedProviders = settings.providers.filter(p => p.id !== providerId);
                const { error: llmErr } = await supabase
                    .from('organization_settings')
                    .update({ providers: updatedProviders })
                    .eq('id', 'default');
                if (llmErr) throw llmErr;
            }
        } else {
            // Security: Only Admins can delete 'team' connections
            const { data: userProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (type.toLowerCase() === 'team' && userProfile?.role !== 'Admin') {
                return NextResponse.json({ error: 'Permission denied: Only Admins can disconnect Team integrations' }, { status: 403 });
            }

            // Handle OAuth Connections (Team or Personal in user_connections)
            console.log(`[API SETTINGS DELETE] Removing ${type.toUpperCase()} ${providerId} for user ${user.id}`);
            
            const { error: delError } = await supabase
                .from('user_connections')
                .delete()
                .match({ 
                    user_id: user.id,
                    provider: providerId.toLowerCase(),
                    connection_type: type.toLowerCase()
                });
            
            if (delError) {
                console.error(`[API SETTINGS DELETE] Error:`, delError.message);
                throw delError;
            }
        }

        // AGGRESSIVE CLEANUP: Also search and destroy in organization_settings.providers 
        // to prevent ghost records in the main list.
        const { data: ghostSettings } = await supabase
            .from('organization_settings')
            .select('providers')
            .eq('id', 'default')
            .single();

        if (ghostSettings?.providers) {
            const updatedProviders = ghostSettings.providers.filter(p => p.id !== providerId);
            if (updatedProviders.length !== ghostSettings.providers.length) {
                await supabase
                    .from('organization_settings')
                    .update({ providers: updatedProviders })
                    .eq('id', 'default');
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Unexpected error in settings API DELETE:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
