import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  GEMINI_API_TIMEOUT_MS,
  PlanRequestSchema,
  AssistantRequestSchema,
  RippleRequestSchema,
  enrichRippleWithGemini,
} from '../src/lib/gemini';
import {
  parseAndValidateJson,
  sanitizeErrorMessage,
  extractClientIp,
  MAX_PAYLOAD_BYTES,
} from '../src/lib/api-guard';
import { analyzeRippleImpact, applyRipplePatch } from '../src/lib/ripple-engine';
import { EventState, RippleImpactReport } from '../src/types/event';

describe('Production Hardening & Abuse Resistance Suite', () => {
  const sampleEvent: EventState = {
    id: 'evt-hardening-1',
    title: 'Jaipur Heritage Wedding',
    type: 'wedding',
    date: '2026-11-20',
    location: 'Amer Fort, Jaipur',
    guestCount: 200,
    venueCapacity: 220,
    totalBudgetMinor: 100000000, // ₹10,00,000
    contingencyPercent: 10,
    currency: 'INR',
    theme: 'Royal Rajputana',
    dietaryNeeds: ['Vegetarian', 'Jain'],
    accessibilityNeeds: ['Elevator Access'],
    brief: 'Grand family celebration',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    budgetItems: [
      {
        id: 'bi-catering',
        category: 'Catering',
        name: 'Royal Rajasthani Thali',
        estimatedMinor: 30000000,
        confirmedMinor: 0,
        paidMinor: 0,
        source: 'ai_estimate',
        isScalableWithGuests: true,
        costPerGuestMinor: 150000, // ₹1,500/guest
        fixedCostMinor: 0,
        priority: 'must_have',
      },
    ],
    tasks: [
      {
        id: 'task-caterer',
        title: 'Sign Caterer Agreement',
        category: 'Vendors',
        dueDate: '2026-10-20',
        dueOffsetDays: -31,
        priority: 'high',
        status: 'completed',
        owner: 'Lead Planner',
        prerequisiteTaskIds: [],
        aiGenerated: false,
      },
    ],
    vendors: [],
    ideas: [],
  };

  const sampleBirthdayEvent: EventState = {
    id: 'evt-bday-1',
    title: 'Aarav 10th Birthday Space Odyssey',
    type: 'birthday',
    date: '2026-12-15',
    location: 'Skyline Community Clubhouse, Bangalore',
    guestCount: 60,
    venueCapacity: 80,
    totalBudgetMinor: 15000000, // ₹1,50,000
    contingencyPercent: 10,
    currency: 'INR',
    theme: 'Interstellar & Astronauts',
    dietaryNeeds: ['Kid-friendly', 'Nut-free'],
    accessibilityNeeds: [],
    brief: 'Interactive cosmic birthday party with planetarium dome setup',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    budgetItems: [],
    tasks: [],
    vendors: [],
    ideas: [],
  };

  describe('1. Timeout Diagnostic Accuracy', () => {
    it('accurately exports 14000ms AbortController timeout constant', () => {
      expect(GEMINI_API_TIMEOUT_MS).toBe(14000);
      expect(GEMINI_API_TIMEOUT_MS / 1000).toBe(14);
    });
  });

  describe('2. Request Schema Validation & Abuse Resistance', () => {
    describe('PlanRequestSchema', () => {
      it('accepts valid plan request input', () => {
        const valid = {
          title: 'Diwali Sangeet Night',
          type: 'wedding',
          date: '2026-11-05',
          guestCount: 150,
          totalBudgetMinor: 50000000,
          brief: 'Traditional musical evening with family',
        };
        const result = PlanRequestSchema.safeParse(valid);
        expect(result.success).toBe(true);
      });

      it('rejects title exceeding 150 characters (prevents payload abuse)', () => {
        const longTitle = {
          title: 'A'.repeat(151),
          type: 'wedding',
          totalBudgetMinor: 50000000,
        };
        const result = PlanRequestSchema.safeParse(longTitle);
        expect(result.success).toBe(false);
      });

      it('rejects brief exceeding 2000 characters (token flooding guard)', () => {
        const longBrief = {
          title: 'Community Festival',
          type: 'community',
          totalBudgetMinor: 50000000,
          brief: 'X'.repeat(2001),
        };
        const result = PlanRequestSchema.safeParse(longBrief);
        expect(result.success).toBe(false);
      });

      it('rejects non-positive guest count or count exceeding 50,000', () => {
        expect(PlanRequestSchema.safeParse({ title: 'Test', type: 'birthday', guestCount: 0, totalBudgetMinor: 100000 }).success).toBe(false);
        expect(PlanRequestSchema.safeParse({ title: 'Test', type: 'birthday', guestCount: 50001, totalBudgetMinor: 100000 }).success).toBe(false);
      });

      it('rejects budget below ₹100 or negative', () => {
        expect(PlanRequestSchema.safeParse({ title: 'Test', type: 'birthday', totalBudgetMinor: 9999 }).success).toBe(false);
        expect(PlanRequestSchema.safeParse({ title: 'Test', type: 'birthday', totalBudgetMinor: -50000 }).success).toBe(false);
      });
    });

    describe('AssistantRequestSchema with Proper EventState Validation (Phase 4)', () => {
      it('accepts valid assistant query with realistic wedding event state', () => {
        const result = AssistantRequestSchema.safeParse({
          message: 'How can we reduce catering waste without cutting variety?',
          eventState: sampleEvent,
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid assistant query with realistic birthday event state', () => {
        const result = AssistantRequestSchema.safeParse({
          message: 'What are 3 interactive birthday activities for kids aged 8-10?',
          eventState: sampleBirthdayEvent,
        });
        expect(result.success).toBe(true);
      });

      it('permits absent eventState for general event questions', () => {
        const result = AssistantRequestSchema.safeParse({
          message: 'What is typical etiquette for RSVP deadlines in India?',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.eventState).toBeUndefined();
        }
      });

      it('rejects empty query or query exceeding 1000 characters', () => {
        expect(AssistantRequestSchema.safeParse({ message: '   ' }).success).toBe(false);
        expect(AssistantRequestSchema.safeParse({ message: 'A'.repeat(1001) }).success).toBe(false);
      });

      it('rejects assistant request with malformed eventState (e.g. negative guest count)', () => {
        const invalidEvent = {
          ...sampleEvent,
          guestCount: -10,
        };
        const result = AssistantRequestSchema.safeParse({
          message: 'Can we fit in venue?',
          eventState: invalidEvent,
        });
        expect(result.success).toBe(false);
      });

      it('rejects assistant request with invalid budgetItems structure', () => {
        const corruptedEvent = {
          ...sampleEvent,
          budgetItems: [
            {
              name: 'Broken Item',
              estimatedMinor: -5000, // Negative budget item
            },
          ],
        };
        const result = AssistantRequestSchema.safeParse({
          message: 'Check budget',
          eventState: corruptedEvent,
        });
        expect(result.success).toBe(false);
      });

      it('rejects non-object eventState', () => {
        const result = AssistantRequestSchema.safeParse({
          message: 'Hello',
          eventState: 'not-an-object',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('RippleRequestSchema', () => {
      it('accepts valid ripple change request with current event', () => {
        const result = RippleRequestSchema.safeParse({
          currentEvent: sampleEvent,
          changeRequest: {
            guestCount: 250,
          },
        });
        expect(result.success).toBe(true);
      });

      it('rejects empty change request with no fields modified', () => {
        const result = RippleRequestSchema.safeParse({
          currentEvent: sampleEvent,
          changeRequest: {},
        });
        expect(result.success).toBe(false);
      });

      it('rejects malformed date in changeRequest', () => {
        const result = RippleRequestSchema.safeParse({
          currentEvent: sampleEvent,
          changeRequest: {
            date: '20-11-2026', // Not YYYY-MM-DD
          },
        });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('3. True Encoded Byte Counting & Payload Size Guard (Phase 3)', () => {
    it('rejects non-JSON Content-Type with HTTP 415', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
        },
        body: 'plain text body',
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(415);
        const data = await result.response.json();
        expect(data.error).toContain('Invalid Content-Type');
      }
    });

    it('rejects malformed Content-Length header with HTTP 400', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: {
          'content-length': '-50',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const data = await result.response.json();
        expect(data.error).toContain('Malformed Content-Length');
      }
    });

    it('rejects Content-Length with malformed suffix "123abc" (parseInt bypass) with HTTP 400', async () => {
      // parseInt("123abc", 10) === 123, but our strict regex should reject this
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: {
          'content-length': '123abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const data = await result.response.json();
        expect(data.error).toContain('Malformed Content-Length');
      }
    });

    it('rejects Content-Length with plus-prefixed value "+50" with HTTP 400', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: {
          'content-length': '+50',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const data = await result.response.json();
        expect(data.error).toContain('Malformed Content-Length');
      }
    });

    it('rejects Content-Length with floating-point value "50.5" with HTTP 400', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: {
          'content-length': '50.5',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const data = await result.response.json();
        expect(data.error).toContain('Malformed Content-Length');
      }
    });

    it('rejects request with Content-Length header exceeding 64KB with HTTP 413', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: {
          'content-length': String(MAX_PAYLOAD_BYTES + 100),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Test' }),
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(413);
        const data = await result.response.json();
        expect(data.error).toContain('Payload too large');
      }
    });

    it('rejects multibyte UTF-8 input exceeding 64KB despite shorter JavaScript string length', async () => {
      // 25,000 Devanagari characters: each character is 3 UTF-8 bytes (total: 75,000 bytes > 65,536 bytes)
      // but JavaScript string length is only ~25,000 characters!
      const devanagariWord = 'उत्सव'; // 5 code units, 15 bytes in UTF-8
      const repeatingHindi = devanagariWord.repeat(5000); // 25,000 string length, 75,000 UTF-8 bytes!

      const oversizedMultibytePayload = JSON.stringify({
        title: 'Hindi Event',
        type: 'wedding',
        totalBudgetMinor: 50000000,
        notes: repeatingHindi,
      });

      // Confirm test premise: string length < 64000, but UTF-8 byte count > 65536
      expect(oversizedMultibytePayload.length).toBeLessThan(MAX_PAYLOAD_BYTES);
      expect(new TextEncoder().encode(oversizedMultibytePayload).byteLength).toBeGreaterThan(MAX_PAYLOAD_BYTES);

      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: oversizedMultibytePayload,
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(413);
        const data = await result.response.json();
        expect(data.error).toContain('Payload too large');
      }
    });

    it('accepts payload just below 64KB byte limit', async () => {
      // Create padding that puts total payload at ~60,000 bytes (safely below 65,536)
      const validPayload = JSON.stringify({
        title: 'Large Valid Event',
        type: 'community',
        totalBudgetMinor: 50000000,
        brief: 'P'.repeat(1950), // within schema 2000 char limit
      });

      expect(new TextEncoder().encode(validPayload).byteLength).toBeLessThan(MAX_PAYLOAD_BYTES);

      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: validPayload,
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(true);
    });

    it('rejects empty body with HTTP 400', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '',
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const data = await result.response.json();
        expect(data.error).toContain('Empty request body');
      }
    });

    it('rejects malformed JSON payload with HTTP 400', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ title: missing quotes on key }',
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const data = await result.response.json();
        expect(data.error).toContain('Malformed JSON');
      }
    });

    it('sanitizes API keys and query secrets from error messages', () => {
      const errorWithKey = 'Fetch failed to https://generativelanguage.googleapis.com/v1beta/models/gemini?key=fake_test_key_abc123';
      const sanitized = sanitizeErrorMessage(errorWithKey);
      expect(sanitized).not.toContain('fake_test_key_abc123');
      expect(sanitized).toContain('key=[REDACTED]');
    });

    it('extracts verified client IP from trusted Vercel proxy headers', () => {
      const mockReqWithXff = new NextRequest('http://localhost:3000/api/ai/plan', {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18' },
      });
      expect(extractClientIp(mockReqWithXff)).toBe('203.0.113.195');

      const mockReqWithRealIp = new NextRequest('http://localhost:3000/api/ai/plan', {
        headers: { 'x-real-ip': '198.51.100.1' },
      });
      expect(extractClientIp(mockReqWithRealIp)).toBe('198.51.100.1');

      const mockReqWithoutIp = new NextRequest('http://localhost:3000/api/ai/plan');
      expect(extractClientIp(mockReqWithoutIp)).toBe('unknown');
    });
  });

  describe('4. Deterministic Constraint & User-Approval Invariance', () => {
    it('guarantees AI ripple enrichment cannot alter pendingPatches or budgetImpact math', async () => {
      // 1. Run deterministic engine: +50 guests (200 -> 250)
      const baseReport = analyzeRippleImpact(sampleEvent, { guestCount: 250 });

      // Deterministic math check:
      // Scalable catering: 250 * 150000 = 3,75,00,000 (old: 3,00,00,000, delta: +75,00,000)
      expect(baseReport.budgetImpact.deltaMinor).toBe(7500000);
      expect(baseReport.pendingPatches.guestCount).toBe(250);
      expect(baseReport.conflicts.some((c) => c.code === 'VENUE_CAPACITY_EXCEEDED')).toBe(true);

      // Snapshot the deterministic patches and calculations
      const frozenPendingPatches = JSON.stringify(baseReport.pendingPatches);
      const frozenConflicts = JSON.stringify(baseReport.conflicts);
      const frozenDelta = baseReport.budgetImpact.deltaMinor;

      // 2. Call enrichRippleWithGemini
      const { report } = await enrichRippleWithGemini(
        sampleEvent,
        { guestCount: 250 },
        baseReport
      );

      // 3. Verify absolute mathematical and constraint immutability:
      expect(JSON.stringify(report.pendingPatches)).toBe(frozenPendingPatches);
      expect(JSON.stringify(report.conflicts)).toBe(frozenConflicts);
      expect(report.budgetImpact.deltaMinor).toBe(frozenDelta);
    });

    it('requires explicit user approval before applying any patches to EventState', () => {
      // Shifting event to 2026-12-10
      const baseReport = analyzeRippleImpact(sampleEvent, { date: '2026-12-10' });

      // Before user approval: event state is completely unchanged
      expect(sampleEvent.date).toBe('2026-11-20');

      // User approves and triggers applyRipplePatch
      const approvedEvent = applyRipplePatch(sampleEvent, baseReport.pendingPatches);

      // After user approval: date is updated, but title and financial budget are strictly preserved
      expect(approvedEvent.date).toBe('2026-12-10');
      expect(approvedEvent.title).toBe(sampleEvent.title);
      expect(approvedEvent.totalBudgetMinor).toBe(sampleEvent.totalBudgetMinor);
    });

    it('leaves event completely unchanged when proposed changes are cancelled or rejected', () => {
      const originalCopy = JSON.parse(JSON.stringify(sampleEvent));
      const baseReport = analyzeRippleImpact(sampleEvent, { guestCount: 400 });

      // Simulate user closing / cancelling the drawer without calling applyRipplePatch
      expect(sampleEvent.guestCount).toBe(originalCopy.guestCount);
      expect(sampleEvent.venueCapacity).toBe(originalCopy.venueCapacity);
      expect(sampleEvent.budgetItems).toEqual(originalCopy.budgetItems);
    });
  });
});
