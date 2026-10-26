import { describe, it, expect } from 'vitest';
import { GeneratedPlanSchema } from '../src/lib/gemini';

describe('AI Output Schema Validation', () => {
  it('validates conforming AI generated plan structures', () => {
    const validPlan = {
      budgetItems: [
        {
          category: 'Catering',
          name: 'Rajasthani Thali',
          estimatedMinor: 25000000,
          isScalableWithGuests: true,
          costPerGuestMinor: 100000,
          fixedCostMinor: 0,
          priority: 'must_have',
          notes: 'Standard sample note',
        },
      ],
      tasks: [
        {
          title: 'Book Venue',
          category: 'Logistics',
          dueOffsetDays: -60,
          priority: 'high',
          owner: 'Lead Planner',
        },
      ],
      vendors: [
        {
          category: 'Venue',
          name: 'Palace Hall [Sample Data]',
          quoteMinor: 30000000,
          inclusions: ['Hall', 'Chairs'],
        },
      ],
      ideas: [
        {
          category: 'cost_saving',
          title: 'Eco Decor',
          description: 'Use brass diyas and local marigold flowers',
          reasoning: 'Reduces spend by 30%',
          tradeOffs: 'Requires earlier lighting setup',
          estimatedSavingsOrCostMinor: -5000000,
        },
      ],
      reasoningSummary: 'Cohesive plan tailored for a royal wedding',
    };

    const result = GeneratedPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it('rejects invalid or negative minor currency amounts from malformed AI responses', () => {
    const invalidPlan = {
      budgetItems: [
        {
          category: 'Catering',
          name: 'Rajasthani Thali',
          estimatedMinor: -500, // Invalid negative minor units
          isScalableWithGuests: true,
          costPerGuestMinor: 100000,
          fixedCostMinor: 0,
          priority: 'must_have',
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
