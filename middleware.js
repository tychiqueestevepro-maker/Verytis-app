import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware'
import { globalRateLimiter, createCustomLimiter } from '@/lib/security/upstash';

// 1. Specialized Limiters for Enterprise Scale
const webhookLimiter = createCustomLimiter(50, '60 s'); // 50 requests/min for webhooks
const ingestionLimiter = createCustomLimiter(200, '60 s'); // 200 requests/min for AI Telemetry

export async function middleware(request) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';
    const path = request.nextUrl.pathname;

    let limitResult;

    // 1. ROUTE-SPECIFIC GLOBAL RATE LIMITING (Upstash Redis)
    try {
        if (path.startsWith('/api/run/')) {
            // FIX 4: Rate limit by agentId, not IP — prevents false-positive 429s
            // when webhook services (Datadog, Zapier) share the same source IP.
            const agentId = path.split('/api/run/')[1]?.split('/')[0]?.split('?')[0] || 'unknown';
            limitResult = await webhookLimiter.limit(`ratelimit_agent_${agentId}`);
        } else if (path.startsWith('/api/webhooks')) {
            limitResult = await webhookLimiter.limit(`ratelimit_webhook_${ip}`);
        } else if (path.startsWith('/api/ingest')) {
            limitResult = await ingestionLimiter.limit(`ratelimit_ingest_${ip}`);
        } else {
            limitResult = await globalRateLimiter.limit(`ratelimit_general_${ip}`);
        }

        if (!limitResult.success) {
            console.warn(`🚨 [GLOBAL_RATE_LIMIT] Exceeded for IP: ${ip} on path: ${path}`);
            return new NextResponse('Too Many Requests', {
                status: 429,
                headers: {
                    'X-RateLimit-Limit': limitResult.limit.toString(),
                    'X-RateLimit-Remaining': limitResult.remaining.toString(),
                    'X-RateLimit-Reset': limitResult.reset.toString(),
                }
            });
        }
    } catch (e) {
        // FAIL-SAFE: If Upstash is down, log and allow the request in fallback mode
        // to prevent hard failure of the entire app.
        console.error('⚠️ [RATE_LIMIT_ERROR] Upstash connection failed:', e);
    }

    // 2. CORE SESSION & AUTH
    const response = await updateSession(request);

    // 3. SECURITY HEADERS REINFORCEMENT & RATE LIMIT HEADERS
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // TODO [SECURITY/XSS] ⚠️ PRODUCTION HARDENING REQUIRED:
    // Remove 'unsafe-inline' and 'unsafe-eval' from script-src and style-src before deploying to production.
    // These directives allow inline scripts/styles and eval(), which are primary XSS attack vectors.
    // Replace with nonce-based CSP (e.g., script-src 'nonce-{random}') or hash-based policies.
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://unavatar.io https://*.githubusercontent.com https://*.slack-edge.com https://*.slack.com https://*.trello.com https://*.gstatic.com https://*.google.com https://google.com https://gstatic.com https://*.sentry.io; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io; worker-src 'self' blob:; frame-src 'self' https://*.sentry.io;");

    if (limitResult) {
        response.headers.set('X-RateLimit-Limit', limitResult.limit.toString());
        response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString());
        response.headers.set('X-RateLimit-Reset', limitResult.reset.toString());
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - internal-telemetry-01 (Sentry tunnel route)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|internal-telemetry-01|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
