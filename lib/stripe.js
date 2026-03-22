import Stripe from 'stripe';

/**
 * Stripe Client Singleton
 * Initialized with the secret key from environment variables.
 * Note: Individual tool execution may override the key if a per-organization key is provided.
 */
let stripe;

export const getStripeClient = (apiKey) => {
    const key = apiKey || process.env.STRIPE_SECRET_KEY;
    
    if (!key) {
        console.error('[STRIPE] Missing Stripe Secret Key');
        return null;
    }

    // If a specific API key is provided, we return a new instance (multi-tenant support)
    if (apiKey) {
        return new Stripe(apiKey, {
            apiVersion: '2023-10-16', // Or latest supported
            appInfo: {
                name: 'Verytis-AI-Ops',
                version: '1.0.0',
            },
        });
    }

    // Otherwise, use the singleton instance
    if (!stripe) {
        stripe = new Stripe(key, {
            apiVersion: '2023-10-16',
            appInfo: {
                name: 'Verytis-AI-Ops',
                version: '1.0.0',
            },
        });
    }

    return stripe;
};

export default getStripeClient;
