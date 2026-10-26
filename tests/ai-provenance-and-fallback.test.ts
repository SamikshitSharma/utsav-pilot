import { describe, it, expect, vi } from 'vitest';
import {
  GeneratedPlanSchema,
  RippleAiEnrichmentSchema,
  enrichRippleWithGemini,
  getAiAssistantAdvice,
} from '../src/lib/gemini';
import { EventState, RippleImpactReport } from '../src/types/event';

describe('AI Provenance, Schema Hardening & Simulation Fallback', () => {
  const baseEvent: EventState = {
    id: 'test-evt-ai-1',
    title: 'Diwali Gala Celebration',
    type: 'community',
    date: '2026-11-12',
    location: 'Town Hall, New Delhi',
    guestCount: 150,
    venueCapacity: 200,
    totalBudgetMinor: 50000000, // ₹5,00,000
    contingencyPercent: 10,
    currency: 'INR',
    theme: 'Festival of Lights',
    dietaryNeeds: ['Vegetarian', 'Vegan'],
    accessibilityNeeds: ['Wheelchair Ramp'],
    brief: 'Community annual gathering',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    budgetItems: [
      {
        id: 'bi-1',
        category: 'Catering',
        name: 'Mithai & Snacks',
        estimatedMinor: 15000000,
        confirmedMinor: 0,
        paidMinor: 0,
        source: 'ai_estimate',
        isScalableWithGuests: true,
        costPerGuestMinor: 100000,
        fixedCostMinor: 0,
        priority: 'must_have',
      },
    ],
    tasks: [],
    vendors: [],
    ideas: [],
  };

  describe('GeneratedPlanSchema Priority Preprocessing', () => {
    it('successfully maps LLM priorities "high", "medium", "low" to schema enums', () => {
      const planWithLlmPriorities = {
        budgetItems: [
          {
            category: 'Catering',
            name: 'Special Sweets',
            estimatedMinor: 5000000,
            isScalableWithGuests: false,
            costPerGuestMinor: 0,
            fixedCostMinor: 5000000,
            priority: 'high', // LLM returned 'high' instead of 'must_have'
          },
          {
            category: 'Decor',
            name: 'Fairy Lights',
            estimatedMinor: 2000000,
            isScalableWithGuests: false,
            costPerGuestMinor: 0,
            fixedCostMinor: 2000000,
            priority: 'medium', // LLM returned 'medium' instead of 'nice_to_have'
          },
          {
            category: 'Entertainment',
            name: 'Photo Booth',
            estimatedMinor: 1000000,
            isScalableWithGuests: false,
            costPerGuestMinor: 0,
            fixedCostMinor: 1000000,
            priority: 'low', // LLM returned 'low' instead of 'optional'
          },
        ],
        tasks: [
          {
            title: 'Arrange Sweets',
            category: 'Catering',
            dueOffsetDays: -5,
            priority: 'high',
            owner: 'Lead Organizer',
          },
        ],
        vendors: [
          {
            category: 'Catering',
            name: 'Haldiram Sweets [Sample Data]',
            quoteMinor: 5000000,
            inclusions: ['Packaging', 'Delivery'],
          },
        ],
        ideas: [
          {
            category: 'cost_saving',
            title: 'Group Bulk Booking',
            description: 'Buy sweets in bulk',
            reasoning: 'Reduces cost by 15%',
            tradeOffs: 'Fixed varieties',
            estimatedSavingsOrCostMinor: -750000,
          },
        ],
        reasoningSummary: 'Balanced plan with mapped priorities',
      };

      const result = GeneratedPlanSchema.safeParse(planWithLlmPriorities);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.budgetItems[0].priority).toBe('must_have');
        expect(result.data.budgetItems[1].priority).toBe('nice_to_have');
        expect(result.data.budgetItems[2].priority).toBe('optional');
      }
    });

    it('rejects completely invalid priority strings that do not map to valid enums', () => {
      const invalidPlan = {
        budgetItems: [
          {
            category: 'Catering',
            name: 'Special Sweets',
            estimatedMinor: 5000000,
            isScalableWithGuests: false,
            costPerGuestMinor: 0,
            fixedCostMinor: 5000000,
            priority: 'super_urgent_now',
          },
        ],
        tasks: [],
        vendors: [],
        ideas: [],
        reasoningSummary: 'Test',
      };

      const result = GeneratedPlanSchema.safeParse(invalidPlan);
      expect(result.success).toBe(false);
    });
  });

  describe('RippleAiEnrichmentSchema', () => {
    it('validates conforming trade-offs and applies defaults', () => {
      const validEnrichment = {
        additionalTradeOffs: [
          {
            title: 'Digital Invitations Only',
            description: 'Switch all paper invites to WhatsApp / email cards',
            estimatedSavingsMinor: 1500000,
            tradeOff: 'Elderly relatives may prefer physical cards',
          },
        ],
        expertAdvice: 'Keep 10 paper cards for senior guests.',
      };

      const parsed = RippleAiEnrichmentSchema.safeParse(validEnrichment);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.additionalTradeOffs).toHaveLength(1);
        expect(parsed.data.additionalTradeOffs[0].estimatedSavingsMinor).toBe(1500000);
        expect(parsed.data.expertAdvice).toContain('senior guests');
      }
    });

    it('defaults estimatedSavingsMinor to 0 when omitted', () => {
      const enrichmentWithoutSavings = {
        additionalTradeOffs: [
          {
            title: 'Buffet Timing Shift',
            description: 'Open food stations 30 minutes earlier',
            tradeOff: 'Slightly earlier kitchen prep required',
          },
        ],
      };

      const parsed = RippleAiEnrichmentSchema.safeParse(enrichmentWithoutSavings);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.additionalTradeOffs[0].estimatedSavingsMinor).toBe(0);
      }
    });

    it('rejects trade-offs missing mandatory fields', () => {
      const missingTitle = {
        additionalTradeOffs: [
          {
            description: 'No title given',
            tradeOff: 'Missing title',
          },
        ],
      };

      const parsed = RippleAiEnrichmentSchema.safeParse(missingTitle);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Simulation Fallback and AI Metadata Integrity', () => {
    it('returns deterministic simulation when no event changes or conflicts exist', async () => {
      const baseReport: RippleImpactReport = {
        triggerField: 'guestCount',
        oldValue: 150,
        newValue: 150,
        conflicts: [],
        facts: ['No changes made to event.'],
        budgetImpact: {
          originalBudgetMinor: 50000000,
          newEstimatedSpendMinor: 15000000,
          deltaMinor: 0,
          affectedItems: [],
        },
        taskImpact: {
          affectedTasks: [],
        },
        aiTradeOffs: [],
        pendingPatches: {},
      };

      const { report, aiMetadata } = await enrichRippleWithGemini(
        baseEvent,
        { guestCount: 150 },
        baseReport
      );

      expect(report).toBe(baseReport);
      expect(aiMetadata.provider).toBe('simulation');
      expect(aiMetadata.modelUsed).toBe('deterministic-rules-only');
      expect(aiMetadata.isLive).toBe(false);
    });

    it('returns simulation fallback when AI assistant is called with no API key or in offline mode', async () => {
      // Mock process.env to simulate missing key
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      try {
        const advice = await getAiAssistantAdvice('How can we cut venue decor costs?', baseEvent);
        expect(advice.aiMetadata.provider).toBe('simulation');
        expect(advice.aiMetadata.isLive).toBe(false);
        expect(advice.reply).toBeDefined();
      } finally {
        if (originalKey) {
          process.env.GEMINI_API_KEY = originalKey;
        }
      }
    });
  });
});
