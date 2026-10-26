import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateEventPlanWithGemini,
  getAiAssistantAdvice,
  enrichRippleWithGemini,
  normalizePlanCandidate,
} from '../src/lib/gemini';
import { EventState, RippleImpactReport } from '../src/types/event';

describe('Gemini Fault Tolerance, Retry Bounds & 503 Investigation Suite', () => {
  const originalKey = process.env.GEMINI_API_KEY;
  const originalProvider = process.env.AI_PROVIDER;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GEMINI_API_KEY = 'test-mock-key';
    process.env.AI_PROVIDER = 'production';
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    process.env.AI_PROVIDER = originalProvider;
  });

  const sampleEvent: EventState = {
    id: 'test-event-1',
    title: 'Ananya & Rohan Sangeet',
    type: 'wedding',
    date: '2026-11-20',
    location: 'Grand Heritage Palace, Jaipur',
    guestCount: 250,
    venueCapacity: 300,
    totalBudgetMinor: 250000000,
    currency: 'INR',
    contingencyPercent: 10,
    theme: 'Royal Rajasthani Regal',
    dietaryNeeds: ['Vegetarian', 'Jain'],
    accessibilityNeeds: ['Wheelchair Ramp'],
    brief: 'Vibrant celebration with sangeet choreographers',
    budgetItems: [
      {
        id: 'item-1',
        category: 'Venue & Staging',
        name: 'Palace Courtyard & Stage',
        estimatedMinor: 80000000,
        confirmedMinor: 80000000,
        paidMinor: 0,
        source: 'user_defined',
        isScalableWithGuests: false,
        costPerGuestMinor: 0,
        fixedCostMinor: 80000000,
        priority: 'must_have',
        notes: 'Signed contract',
      },
    ],
    tasks: [],
    vendors: [],
    ideas: [],
    createdAt: '2026-10-27T00:00:00Z',
    updatedAt: '2026-10-27T00:00:00Z',
  };

  describe('Simulation of Provider Errors and Bounded Retries', () => {
    it('aborts retries immediately on HTTP 401/403 and falls back safely with isLive: false', async () => {
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            ok: false,
            status: 401,
            json: async () => ({ error: { message: 'API key not valid' } }),
          };
        })
      );

      const result = await generateEventPlanWithGemini({
        title: 'Anniversary Gala',
        type: 'anniversary',
        date: '2026-12-15',
        location: 'Mumbai',
        guestCount: 100,
        totalBudgetMinor: 10000000,
        contingencyPercent: 10,
        theme: 'Silver Jubilee',
        dietaryNeeds: [],
        accessibilityNeeds: [],
        brief: 'Elegant gathering',
      });

      // Must abort after 1 call; do NOT attempt all fallback models with an invalid key
      expect(callCount).toBe(1);
      expect(result.aiMetadata.isLive).toBe(false);
      expect(result.aiMetadata.provider).toBe('simulation');
      expect(result.plan.budgetItems.length).toBeGreaterThan(0);
    });

    it('aborts retries immediately on HTTP 429 quota exhaustion and falls back safely', async () => {
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            ok: false,
            status: 429,
            json: async () => ({ error: { message: 'Resource has been exhausted' } }),
          };
        })
      );

      const result = await getAiAssistantAdvice('Suggest a cost-saving catering idea', sampleEvent);

      expect(callCount).toBe(1);
      expect(result.aiMetadata.isLive).toBe(false);
      expect(result.aiMetadata.provider).toBe('simulation');
      expect(result.reply.length).toBeGreaterThan(0);
    });

    it('handles HTTP 503 (provider capacity overload) with bounded model fallback up to 2 attempts max', async () => {
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            ok: false,
            status: 503,
            json: async () => ({ error: { message: 'The model is overloaded. Please try again later.' } }),
          };
        })
      );

      const result = await generateEventPlanWithGemini({
        title: 'Diwali Milan Community Fair',
        type: 'community',
        date: '2026-11-01',
        location: 'Community Hall',
        guestCount: 300,
        totalBudgetMinor: 15000000,
        contingencyPercent: 10,
        theme: 'Festival of Lights',
        dietaryNeeds: [],
        accessibilityNeeds: [],
        brief: 'Community celebration',
      });

      // Exactly 2 attempts (FALLBACK_MODELS.slice(0, 2)), never unbounded looping
      expect(callCount).toBe(2);
      expect(result.aiMetadata.isLive).toBe(false);
      expect(result.aiMetadata.provider).toBe('simulation');
      expect(result.aiMetadata.modelUsed).toBe('deterministic-synthesis-v1');
    });

    it('recovers to live status if first model returns 503 but fallback model succeeds', async () => {
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            return {
              ok: false,
              status: 503,
              json: async () => ({ error: { message: 'Model temporarily overloaded' } }),
            };
          }
          // Second model succeeds
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          plan: {
                            budgetItems: [
                              {
                                category: 'Catering',
                                name: 'Buffet Dinner',
                                estimatedMinor: 5000000,
                                isScalableWithGuests: true,
                                costPerGuestMinor: 25000,
                                fixedCostMinor: 0,
                                priority: 'must_have',
                              },
                            ],
                            tasks: [],
                            vendors: [],
                            ideas: [],
                            reasoningSummary: 'Allocated budget based on guest count.',
                          },
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          };
        })
      );

      const result = await generateEventPlanWithGemini({
        title: 'Birthday Party',
        type: 'birthday',
        date: '2026-11-10',
        location: 'Rooftop Cafe',
        guestCount: 50,
        totalBudgetMinor: 10000000,
        contingencyPercent: 10,
        theme: 'Retro 80s',
        dietaryNeeds: [],
        accessibilityNeeds: [],
        brief: 'Fun birthday',
      });

      expect(callCount).toBe(2);
      expect(result.aiMetadata.isLive).toBe(true);
      expect(result.aiMetadata.provider).toBe('gemini');
    });

    it('handles AbortError timeout cleanly and falls back without server crash', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          throw err;
        })
      );

      const baseReport: RippleImpactReport = {
        triggerField: 'guestCount',
        oldValue: 250,
        newValue: 350,
        conflicts: [
          {
            type: 'CRITICAL',
            code: 'VENUE_CAPACITY_EXCEEDED',
            message: 'Venue is 50 over capacity',
          },
        ],
        facts: ['Guest count increased by 100.'],
        budgetImpact: {
          previousEstimatedMinor: 250000000,
          newEstimatedMinor: 275000000,
          deltaMinor: 25000000,
          overrunMinor: 25000000,
          affectedItems: [],
        },
        taskImpact: {
          affectedTasks: [],
        },
        vendorImpact: {
          recommendations: [],
        },
        aiTradeOffs: [],
        pendingPatches: {},
      };

      const result = await enrichRippleWithGemini(
        sampleEvent,
        { guestCount: 350 },
        baseReport
      );

      expect(result.aiMetadata.isLive).toBe(false);
      expect(result.aiMetadata.provider).toBe('simulation');
      expect(result.report).toBeDefined();
    });

    it('normalizes malformed or wrapped plan candidates from models gracefully', () => {
      const wrappedPayload = {
        event_plan: {
          items: [
            {
              category: 'Decor',
              title: 'Marigold Canopy',
              estimatedAmountMinor: 1200000,
              scalable: false,
              priority: 'high',
            },
          ],
          tasks: [],
          vendors: [],
          ideas: [],
          reasoningSummary: 'Optimized festive decor.',
        },
      };

      const normalized = normalizePlanCandidate(wrappedPayload);
      expect(normalized.budgetItems[0].name).toBe('Marigold Canopy');
      expect(normalized.budgetItems[0].estimatedMinor).toBe(1200000);
      expect(normalized.budgetItems[0].priority).toBe('must_have');
    });
  });
});
