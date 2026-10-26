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

    describe('AssistantRequestSchema', () => {
      it('accepts valid assistant query', () => {
        const result = AssistantRequestSchema.safeParse({
          message: 'How can we reduce catering waste?',
          eventState: sampleEvent,
        });
        expect(result.success).toBe(true);
      });

      it('rejects empty query or query exceeding 1000 characters', () => {
        expect(AssistantRequestSchema.safeParse({ message: '   ' }).success).toBe(false);
        expect(AssistantRequestSchema.safeParse({ message: 'A'.repeat(1001) }).success).toBe(false);
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

  describe('3. Payload Size Guard (HTTP 413) & Error Sanitization', () => {
    it('rejects request with content-length header exceeding 64KB with HTTP 413', async () => {
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

    it('rejects body stream exceeding 64KB with HTTP 413', async () => {
      const oversizedPayload = JSON.stringify({
        title: 'Large Payload',
        type: 'wedding',
        totalBudgetMinor: 50000000,
        junk: 'x'.repeat(MAX_PAYLOAD_BYTES + 50),
      });

      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: oversizedPayload,
      });

      const result = await parseAndValidateJson(mockReq, PlanRequestSchema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(413);
      }
    });

    it('rejects malformed JSON payload with HTTP 400', async () => {
      const mockReq = new NextRequest('http://localhost:3000/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{ malformed json: missing quotes }',
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
  });
});
