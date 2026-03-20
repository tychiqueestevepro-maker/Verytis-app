import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Refreshes a Google OAuth access token.
 */
async function refreshGoogleToken(recordId, refreshToken, metadata) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    const data = await response.json();
    if (!data.access_token) {
        console.error('[GOOGLE REFRESH] Failed data:', data);
        throw new Error('Failed to refresh Google OAuth token');
    }

    const supabase = createAdminClient();
    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;

    const { error } = await supabase
        .from('user_connections')
        .update({
            access_token: data.access_token,
            // Google only returns a new refresh_token if we use prompt=consent again,
            // otherwise we keep the old one.
            refresh_token: data.refresh_token || refreshToken,
            metadata: {
                ...metadata,
                expires_in: data.expires_in,
                expires_at: expiresAt,
                updated_at: Math.floor(Date.now() / 1000)
            }
        })
        .eq('id', recordId);

    if (error) throw error;

    return data.access_token;
}

/**
 * Ensures a valid Google token is available for an organization.
 */
export async function getValidGoogleToken({ organizationId }) {
    if (!organizationId) throw new Error('organizationId is required');

    const supabase = createAdminClient();
    const { data: connection, error } = await supabase
        .from('user_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('provider', 'google_workspace')
        .order('created_at', { ascending: false })
        .maybeSingle();

    if (error) throw error;
    if (!connection) return null;

    const { access_token, refresh_token, metadata } = connection;
    const expiresAt = metadata?.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const buffer = 300; // 5 minutes buffer

    if (access_token && expiresAt && now < expiresAt - buffer) {
        return access_token;
    }

    if (refresh_token) {
        console.log('[GOOGLE HELPER] Token expired, refreshing...');
        return await refreshGoogleToken(connection.id, refresh_token, metadata);
    }

    return access_token; // Return as-is if no refresh token (might fail later)
}
