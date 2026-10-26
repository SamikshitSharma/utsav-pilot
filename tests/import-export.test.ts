import { describe, it, expect } from 'vitest';
import { EventStateSchema, BudgetItemSchema, TaskSchema } from '../src/types/event';

describe('Import/Export & Domain Schema Integrity', () => {
  const sampleValidEvent = {
    id: 'evt-valid-101',
    title: 'Ananya & Rohan Royal Wedding',
    type: 'wedding',
    date: '2026-12-15',
    location: 'Udaipur, Rajasthan',
    guestCount: 250,
    venueCapacity: 300,
    totalBudgetMinor: 250000000, // ₹25,00,000
    contingencyPercent: 10,
    currency: 'INR',
    theme: 'Heritage Rajputana',
    dietaryNeeds: ['Vegetarian', 'Jain'],
    accessibilityNeeds: ['Wheelchair Ramp'],
    brief: 'Grand traditional destination wedding',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    budgetItems: [
      {
        id: 'bud-1',
        category: 'Food & Beverage',
        name: 'Royal Buffet Lunch & Dinner',
        estimatedMinor: 75000000,
        confirmedMinor: 75000000,
        paidMinor: 25000000,
        source: 'vendor_quote',
        isScalableWithGuests: true,
        costPerGuestMinor: 250000,
        fixedCostMinor: 12500000,
        priority: 'must_have',
        notes: 'Includes live chaat stations',
      },
    ],
    tasks: [
      {
        id: 'tsk-1',
        title: 'Book Palace Venue & Pay Advance',
        category: 'Venue & Staging',
        dueDate: '2026-08-15',
        dueOffsetDays: -122,
        priority: 'high',
        status: 'completed',
        owner: 'Lead Planner',
        prerequisiteTaskIds: [],
        aiGenerated: false,
      },
    ],
    vendors: [
      {
        id: 'ven-1',
        category: 'Catering',
        name: 'Maharaja Royal Caterers [Sample Data]',
        contactName: 'Chef Vikram',
        contactPhone: '+91 98765 43210',
        quoteMinor: 75000000,
        depositPaidMinor: 25000000,
        balanceDueMinor: 50000000,
        status: 'booked',
        notes: 'Confirmed 250 guests',
        isSampleData: true,
      },
    ],
    ideas: [
      {
        id: 'idea-1',
        category: 'entertainment',
        title: 'Rajasthani Folk Welcome Troupe',
        description: 'Traditional Ghoomar dancers and dholak at entrance',
        reasoning: 'Authentic heritage ambiance for arriving guests',
        tradeOffs: 'Requires separate green room space',
        estimatedSavingsOrCostMinor: 3500000,
        status: 'shortlisted',
        aiGenerated: true,
      },
    ],
  };

  it('successfully validates complete, pristine event state', () => {
    const parseResult = EventStateSchema.safeParse(sampleValidEvent);
    expect(parseResult.success).toBe(true);
  });

  it('rejects imported payloads with non-array or invalid budgetItems', () => {
    const invalidArrays = {
      ...sampleValidEvent,
      budgetItems: 'not-an-array-string',
    };
    const parseResult = EventStateSchema.safeParse(invalidArrays);
    expect(parseResult.success).toBe(false);
  });

  it('rejects imported payloads with unparseable or negative minor currency', () => {
    const negativeBudget = {
      ...sampleValidEvent,
      totalBudgetMinor: -1000000,
    };
    const parseResult = EventStateSchema.safeParse(negativeBudget);
    expect(parseResult.success).toBe(false);
  });

  it('rejects imported payloads with invalid event type', () => {
    const invalidType = {
      ...sampleValidEvent,
      type: 'rave_party',
    };
    const parseResult = EventStateSchema.safeParse(invalidType);
    expect(parseResult.success).toBe(false);
  });

  it('rejects budget items with negative confirmed or paid amounts', () => {
    const invalidBudgetItem = {
      id: 'bud-bad',
      category: 'Decor',
      name: 'Stage Lighting',
      estimatedMinor: 100000,
      confirmedMinor: -5000, // Negative not permitted
      paidMinor: 0,
      source: 'manual',
      isScalableWithGuests: false,
      costPerGuestMinor: 0,
      fixedCostMinor: 100000,
      priority: 'medium',
    };
    const parseResult = BudgetItemSchema.safeParse(invalidBudgetItem);
    expect(parseResult.success).toBe(false);
  });

  it('rejects tasks with invalid status values', () => {
    const invalidTask = {
      id: 'tsk-bad',
      title: 'Invalid Task',
      category: 'Logistics',
      dueDate: '2026-12-01',
      dueOffsetDays: 0,
      priority: 'high',
      status: 'abandoned', // Not in ('todo' | 'in_progress' | 'completed' | 'blocked')
      owner: 'Planner',
      prerequisiteTaskIds: [],
      aiGenerated: false,
    };
    const parseResult = TaskSchema.safeParse(invalidTask);
    expect(parseResult.success).toBe(false);
  });
});
