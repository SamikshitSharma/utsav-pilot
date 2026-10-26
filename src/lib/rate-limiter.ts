import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  max: number;            // Maximum requests per window
  windowMs: number;       // Window size in milliseconds
  redisUrl?: string;      // Optional shared Redis/KV REST API URL
  redisToken?: string;    // Optional shared Redis/KV REST API token
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetMs: number;
  enforcementLayer: 'shared-kv' | 'edge-isolate' | 'fail-open';
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  max: 20,                // 20 requests per minute for AI endpoints
  windowMs: 60_000,       // 60-second window
};

// In-memory sliding window timestamp store for edge worker isolates
const isolateStore = new Map<string, number[]>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Extracts verified client IP address.
 * Prioritizes trusted edge headers set by Vercel/proxies over spoofable client headers.
 * Never trusts client-prepended entries in X-Forwarded-For blindly.
 */
export function getTrustedClientIp(
  headers: Headers | { get: (name: string) => string | null }
): string | null {
  // 1. x-real-ip is set by Vercel Edge Proxy from the remote connection and cannot be spoofed
  const realIp = headers.get('x-real-ip');
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  // 2. x-vercel-ip is platform-injected
  const vercelIp = headers.get('x-vercel-ip');
  if (vercelIp && vercelIp.trim().length > 0) {
    return vercelIp.trim();
  }

  // 3. cf-connecting-ip if behind Cloudflare edge
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp && cfIp.trim().length > 0) {
    return cfIp.trim();
  }

  // 4. x-forwarded-for: When behind reverse proxies, Vercel appends the true remote IP to the end.
  // We take the rightmost IP in the chain to avoid client-spoofed prefix IPs.
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      // Return rightmost proxy-appended address
      return parts[parts.length - 1];
    }
  }

  return null;
}

/**
 * Clears the in-memory isolate store (primarily for automated testing).
 */
export function _resetIsolateStore(): void {
  isolateStore.clear();
  lastCleanup = Date.now();
}

/**
 * Core rate limiter evaluation.
 * Evaluates rate limit against shared Upstash Redis / Vercel KV if configured,
 * otherwise falls back to edge worker isolate sliding window.
 */
export async function checkRateLimit(
  ip: string,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  const max = config.max ?? DEFAULT_RATE_LIMIT_CONFIG.max;
  const windowMs = config.windowMs ?? DEFAULT_RATE_LIMIT_CONFIG.windowMs;

  const redisUrl =
    config.redisUrl ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;

  const redisToken =
    config.redisToken ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  // 1. Shared Atomic Store (Upstash Redis / Vercel KV REST API)
  if (redisUrl && redisToken) {
    try {
      const windowSeconds = Math.ceil(windowMs / 1000);
      const windowKey = `utsav_rl:${ip}:${Math.floor(Date.now() / windowMs)}`;

      // Atomic INCR against REST API
      const res = await fetch(`${redisUrl}/incr/${encodeURIComponent(windowKey)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const currentCount = Number(data.result || data);

        // If first hit in window, set TTL
        if (currentCount === 1) {
          fetch(`${redisUrl}/expire/${encodeURIComponent(windowKey)}/${windowSeconds + 2}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${redisToken}` },
          }).catch(() => {});
        }

        const now = Date.now();
        const nextWindowStart = (Math.floor(now / windowMs) + 1) * windowMs;
        const retryAfterSeconds = Math.max(1, Math.ceil((nextWindowStart - now) / 1000));

        if (currentCount > max) {
          return {
            allowed: false,
            limit: max,
            remaining: 0,
            retryAfterSeconds,
            resetMs: nextWindowStart,
            enforcementLayer: 'shared-kv',
          };
        }

        return {
          allowed: true,
          limit: max,
          remaining: Math.max(0, max - currentCount),
          retryAfterSeconds: 0,
          resetMs: nextWindowStart,
          enforcementLayer: 'shared-kv',
        };
      } else {
        console.warn(`[rate-limit] Shared store returned HTTP ${res.status}. Falling back to isolate store.`);
      }
    } catch (err) {
      console.warn('[rate-limit] Shared store connection failed. Failing open / falling back:', err);
    }
  }

  // 2. Edge Worker Isolate Sliding-Window Store
  try {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Periodic cleanup of stale entries
    if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
      isolateStore.forEach((timestamps: number[], key: string) => {
        const fresh = timestamps.filter((t: number) => t > windowStart);
        if (fresh.length === 0) {
          isolateStore.delete(key);
        } else {
          isolateStore.set(key, fresh);
        }
      });
      lastCleanup = now;
    }

    const timestamps = isolateStore.get(ip) ?? [];
    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= max) {
      const oldestInWindow = Math.min(...recent);
      const retryAfterMs = Math.max(0, oldestInWindow + windowMs - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

      return {
        allowed: false,
        limit: max,
        remaining: 0,
        retryAfterSeconds,
        resetMs: now + retryAfterMs,
        enforcementLayer: 'edge-isolate',
      };
    }

    // Allow and record timestamp
    recent.push(now);
    isolateStore.set(ip, recent);

    return {
      allowed: true,
      limit: max,
      remaining: Math.max(0, max - recent.length),
      retryAfterSeconds: 0,
      resetMs: now + windowMs,
      enforcementLayer: 'edge-isolate',
    };
  } catch (err) {
    // Fail-open: Never block legitimate users if rate limiter encounters unexpected runtime errors
    console.error('[rate-limit] Unexpected error in rate limiter. Failing open:', err);
    return {
      allowed: true,
      limit: max,
      remaining: 1,
      retryAfterSeconds: 0,
      resetMs: Date.now() + windowMs,
      enforcementLayer: 'fail-open',
    };
  }
}

/**
 * Creates standardized HTTP 429 response with RFC-compliant headers.
 */
export function buildRateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests. You have exceeded the AI co-pilot rate limit.',
      detail: `Please wait ${result.retryAfterSeconds} seconds before submitting more AI requests.`,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
        'X-RateLimit-Layer': result.enforcementLayer,
      },
    }
  );
}
