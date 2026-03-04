/**
 * VERYTIS DYNAMIC PRICING ENGINE
 * 
 * Per-model cost calculation for Enterprise billing.
 * Prices in USD per 1 Million tokens.
 * Source: Official provider pricing pages (as of 2025-Q4).
 */

const MODEL_PRICING = {
    // OpenAI
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'o1': { input: 15.00, output: 60.00 },
    'o1-mini': { input: 3.00, output: 12.00 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-4': { input: 30.00, output: 60.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },

    // Anthropic
    'claude-3-5-sonnet-latest': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-latest': { input: 0.80, output: 4.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-opus-latest': { input: 15.00, output: 75.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },

    // Google
    'gemini-2.0-flash-exp': { input: 0.10, output: 0.40 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-1.0-pro': { input: 0.50, output: 1.50 },
};

const DEFAULT_PRICING = { input: 2.50, output: 10.00 }; // Fallback to GPT-4o

/**
 * Calculate the cost of an LLM call based on token usage.
 * @param {string} modelId - The model identifier (e.g., 'gpt-4o', 'claude-3-5-sonnet-latest')
 * @param {number} promptTokens - Number of input tokens
 * @param {number} completionTokens - Number of output tokens
 * @returns {{ cost: number, pricing: { input: number, output: number }, model: string }}
 */
export function calculateCost(modelId, promptTokens, completionTokens) {
    const pricing = MODEL_PRICING[modelId] || DEFAULT_PRICING;
    const cost = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

    return {
        cost,
        pricing,
        model: modelId || 'gpt-4o (fallback)'
    };
}

/**
 * Get pricing info for a model without calculating cost.
 * @param {string} modelId 
 * @returns {{ input: number, output: number }}
 */
export function getModelPricing(modelId) {
    return MODEL_PRICING[modelId] || DEFAULT_PRICING;
}
