import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  getTrustedClientIp,
  buildRateLimitResponse,
  _resetIsolateStore,
  RateLimitConfig,
} from '../src/lib/rate-limiter';
import { middleware } from '../src/middleware';

describe('AI Endpoint Rate Limiting Engine', () => {
  beforeEach(() => {
    _resetIsolateStore();
    vi.restoreAllMocks();
  });

  describe('Client IP Extraction & Spoof Resistance', () => {
    it('prioritizes x-real-ip set by trusted platform edge proxy', () => {
      const headers = new Headers({
        'x-real-ip': '203.0.113.195',
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      });
      const ip = getTrustedClientIp(headers);
      expect(ip).toBe('203.0.113.195');
    });

    it('uses x-vercel-ip when x-real-ip is absent', () => {
      const headers = new Headers({
        'x-vercel-ip': '198.51.100.42',
      });
      const ip = getTrustedClientIp(headers);
      expect(ip).toBe('198.51.100.42');
    });

    it('takes the rightmost IP from x-forwarded-for to defeat client-spoofed prefix IPs', () => {
      // Client sends "spoofed-ip", proxy appends "actual-client-ip"
      const headers = new Headers({
        'x-forwarded-for': '10.0.0.1, 198.51.100.88',
      });
      const ip = getTrustedClientIp(headers);
      expect(ip).toBe('198.51.100.88');
    });

    it('returns null if no IP headers are present', () => {
      const headers = new Headers();
      const ip = getTrustedClientIp(headers);
      expect(ip).toBeNull();
    });
  });

  describe('Sliding Window Rate Enforcement', () => {
    const testConfig: Partial<RateLimitConfig> = {
      max: 3,
      windowMs: 1000, // 1 second window for fast tests
    };

    it('allows requests below the limit with decremented remaining count', async () => {
      const ip = '192.0.2.1';

      const r1 = await checkRateLimit(ip, testConfig);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);
      expect(r1.limit).toBe(3);

      const r2 = await checkRateLimit(ip, testConfig);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = await checkRateLimit(ip, testConfig);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it('blocks requests exceeding the limit and returns accurate retry information', async () => {
      const ip = '192.0.2.2';

      for (let i = 0; i < 3; i++) {
        await checkRateLimit(ip, testConfig);
      }

      // 4th request must be blocked
      const r4 = await checkRateLimit(ip, testConfig);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });

    it('resets quota once the sliding window expires', async () => {
      const ip = '192.0.2.3';

      // Exhaust limit
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(ip, testConfig);
      }
      expect((await checkRateLimit(ip, testConfig)).allowed).toBe(false);

      // Fast-forward time past 1 second window
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now + 1100);

      const postWindow = await checkRateLimit(ip, testConfig);
      expect(postWindow.allowed).toBe(true);
      expect(postWindow.remaining).toBe(2);
    });

    it('tracks independent client identities separately', async () => {
      const ipA = '192.0.2.10';
      const ipB = '192.0.2.20';

      // Exhaust IP A
      for (let i = 0; i < 3; i++) {
        await checkRateLimit(ipA, testConfig);
      }
      expect((await checkRateLimit(ipA, testConfig)).allowed).toBe(false);

      // IP B must remain unaffected
      const rB = await checkRateLimit(ipB, testConfig);
      expect(rB.allowed).toBe(true);
      expect(rB.remaining).toBe(2);
    });
  });

  describe('HTTP 429 Response Formatting', () => {
    it('produces an RFC-compliant 429 response with retry headers and explanatory JSON', async () => {
      const result = {
        allowed: false,
        limit: 20,
        remaining: 0,
        retryAfterSeconds: 45,
        resetMs: Date.now() + 45000,
        enforcementLayer: 'edge-isolate' as const,
      };

      const res = buildRateLimitResponse(result);
      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('45');
      expect(res.headers.get('X-RateLimit-Limit')).toBe('20');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('X-RateLimit-Layer')).toBe('edge-isolate');

      const body = await res.json();
      expect(body.error).toContain('Too many requests');
      expect(body.detail).toContain('45 seconds');
      expect(body.retryAfterSeconds).toBe(45);
    });
  });

  describe('Shared Atomic Store Integration & Fallback Behavior', () => {
    it('uses shared Redis/KV REST API when configured and handles atomic counts', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ result: 2 }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await checkRateLimit('192.0.2.50', {
        max: 5,
        windowMs: 60000,
        redisUrl: 'https://fake-kv.upstash.io',
        redisToken: 'fake-token',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://fake-kv.upstash.io/incr/'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer fake-token' },
        })
      );
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
      expect(result.enforcementLayer).toBe('shared-kv');
    });

    it('gracefully falls back to isolate store if shared Redis/KV returns an error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await checkRateLimit('192.0.2.51', {
        max: 5,
        windowMs: 60000,
        redisUrl: 'https://fake-kv.upstash.io',
        redisToken: 'fake-token',
      });

      // Must not crash or block legitimate user; falls back to edge isolate
      expect(result.allowed).toBe(true);
      expect(result.enforcementLayer).toBe('edge-isolate');
    });
  });

  describe('Next.js Middleware Execution', () => {
    it('bypasses non-AI routes without rate-limiting checks', async () => {
      const req = new NextRequest('http://localhost:3000/api/health', {
        headers: { 'x-real-ip': '1.1.1.1' },
      });
      const res = await middleware(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
    });

    it('enforces rate limits on /api/ai/plan', async () => {
      const ip = '198.51.100.1';
      // Use tiny limit
      vi.spyOn(Date, 'now');

      for (let i = 0; i < 20; i++) {
        const req = new NextRequest('http://localhost:3000/api/ai/plan', {
          headers: { 'x-real-ip': ip },
        });
        const res = await middleware(req);
        expect(res.status).toBe(200);
      }

      // 21st request must trigger 429
      const blockedReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        headers: { 'x-real-ip': ip },
      });
      const blockedRes = await middleware(blockedReq);
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.headers.get('Retry-After')).toBeDefined();
    });

    it('enforces rate limits on /api/ai/assistant and /api/ai/ripple', async () => {
      const ip = '198.51.100.2';
      for (let i = 0; i < 20; i++) {
        const req = new NextRequest('http://localhost:3000/api/ai/assistant', {
          headers: { 'x-real-ip': ip },
        });
        await middleware(req);
      }

      const blockedAssistant = await middleware(
        new NextRequest('http://localhost:3000/api/ai/assistant', {
          headers: { 'x-real-ip': ip },
        })
      );
      expect(blockedAssistant.status).toBe(429);

      const blockedRipple = await middleware(
        new NextRequest('http://localhost:3000/api/ai/ripple', {
          headers: { 'x-real-ip': ip },
        })
      );
      expect(blockedRipple.status).toBe(429);
    });

    it('fails open if client IP is completely unresolvable', async () => {
      const req = new NextRequest('http://localhost:3000/api/ai/plan');
      const res = await middleware(req);
      expect(res.status).toBe(200);
    });
  });
});
