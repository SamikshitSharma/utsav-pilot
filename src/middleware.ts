import { NextRequest, NextResponse } from 'next/server';
import {
  getTrustedClientIp,
  checkRateLimit,
  buildRateLimitResponse,
  DEFAULT_RATE_LIMIT_CONFIG,
} from '@/lib/rate-limiter';

/**
 * Next.js Edge Middleware for AI Route Rate Limiting.
 *
 * Scope:
 * - Applied exclusively to `/api/ai/*` routes (Plan Generation, AI Copilot, Ripple Enrichment).
 * - Leaves static assets, dashboard navigation, and non-AI APIs unrestricted.
 *
 * Enforcement Strategy:
 * 1. Primary: Shared Atomic Store (Upstash Redis / Vercel KV) when `KV_REST_API_URL` or
 *    `UPSTASH_REDIS_REST_URL` is configured in the environment.
 * 2. Fallback: Edge Worker Isolate Sliding Window (20 requests / 60 seconds per client IP).
 * 3. Security: Extracts untampered IP from trusted platform headers (x-real-ip / x-vercel-ip / cf-connecting-ip
 *    or rightmost x-forwarded-for entry), preventing client-supplied spoofed IPs from bypassing limits.
 * 4. Graceful Degradation: Fails open on store connectivity outages or unresolvable client identity
 *    to guarantee legitimate users are never locked out of demonstrations.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect only AI endpoints that trigger LLM calls or expensive computation
  if (!pathname.startsWith('/api/ai/')) {
    return NextResponse.next();
  }

  const clientIp = getTrustedClientIp(req.headers);

  // If client IP cannot be extracted, fail open to avoid false positives in demo environments
  if (!clientIp) {
    console.warn(`[rate-limit] Unable to resolve client IP for ${pathname} — allowing request.`);
    return NextResponse.next();
  }

  try {
    const result = await checkRateLimit(clientIp, DEFAULT_RATE_LIMIT_CONFIG);

    if (!result.allowed) {
      return buildRateLimitResponse(result);
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(result.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));
    response.headers.set('X-RateLimit-Layer', result.enforcementLayer);
    return response;
  } catch (err) {
    // Fail open on unexpected middleware errors
    console.error(`[rate-limit] Middleware execution failed for ${pathname}:`, err);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/api/ai/:path*'],
};
