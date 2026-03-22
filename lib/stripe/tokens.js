import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Garde du Corps: Ensures a valid Stripe API key is available for the organization.
 * Stripe API keys (Restricted or Secret) are stored in user_connections.
 */
export async function getValidStripeToken({ organizationId }) {
    if (!organizationId) {
        throw new Error('organizationId must be provided');
    }

    const supabase = createAdminClient();
    
    // Unified search: find the latest Stripe connection for this organization
    const { data: connection, error } = await supabase
        .from('user_connections')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('provider', 'stripe')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[STRIPE HELPER] Error fetching connection:', error.message);
        throw error;
    }

    if (!connection) {
        console.warn(`[STRIPE HELPER] No Stripe connection found for organization: ${organizationId}`);
        // Fallback to environment variable if no per-org connection exists
        return process.env.STRIPE_SECRET_KEY || null;
    }

    // Return the secret/restricted key stored in access_token or metadata
    return connection.access_token || connection.metadata?.api_key;
}
