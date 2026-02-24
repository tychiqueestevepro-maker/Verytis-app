import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware'

// SIMPLE IN-MEMORY RATE LIMITER (FOR DEMO/ENTERPRISE SKELETON)
// Note: In Production, use Redis (Upstash) for shared state.
const rateLimitMap = new Map();

export async function middleware(request) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. IP WHITELISTING (Skeleton for Enterprise)
    // const WHITELIST = process.env.ALLOWED_IPS?.split(',') || [];
    // if (WHITELIST.length > 0 && !WHITELIST.includes(ip)) {
    //    return new NextResponse('Access Denied', { status: 403 });
    // }

    // 2. BASIC RATE LIMITING
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const maxRequests = 100;

    const rateData = rateLimitMap.get(ip) || { count: 0, startTime: now };

    if (now - rateData.startTime > windowMs) {
        rateData.count = 1;
        rateData.startTime = now;
    } else {
        rateData.count++;
    }

    rateLimitMap.set(ip, rateData);

    if (rateData.count > maxRequests) {
        console.warn(`🚨 Rate limit exceeded for IP: ${ip}`);
        return new NextResponse('Too Many Requests', { status: 429 });
    }

    // 3. CORE SESSION & AUTH
    const response = await updateSession(request);

    // 4. SECURITY HEADERS REINFORCEMENT
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
