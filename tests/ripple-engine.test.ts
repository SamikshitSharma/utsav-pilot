import { describe, it, expect } from 'vitest';
import { analyzeRippleImpact, applyRipplePatch, addDaysToIsoDate } from '../src/lib/ripple-engine';
import { EventState } from '../src/types/event';

const mockEvent: EventState = {
  id: 'test-event-1',
  title: 'Test Royal Wedding',
  type: 'wedding',
  date: '2026-12-01',
  location: 'Jaipur Palace',
  guestCount: 200,
  venueCapacity: 250,
  totalBudgetMinor: 100000000, // ₹10,00,000
  contingencyPercent: 10,
  currency: 'INR',
  theme: 'Heritage Rajputana',
  dietaryNeeds: ['Vegetarian'],
  accessibilityNeeds: [],
  brief: 'Family celebration',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  budgetItems: [
    {
      id: 'item-venue',
      category: 'Venue',
      name: 'Hall Rental',
      estimatedMinor: 30000000, // ₹3,00,000
      confirmedMinor: 30000000,
      paidMinor: 10000000,
      source: 'vendor_quote',
      isScalableWithGuests: false,
      costPerGuestMinor: 0,
      fixedCostMinor: 30000000,
      priority: 'must_have',
    },
    {
      id: 'item-catering',
      category: 'Catering',
      name: 'Dinner Buffet',
      estimatedMinor: 24000000, // 200 * ₹1,200 = ₹2,40,000
      confirmedMinor: 0,
      paidMinor: 0,
      source: 'ai_estimate',
      isScalableWithGuests: true,
      costPerGuestMinor: 120000, // ₹1,200/guest
      fixedCostMinor: 0,
      priority: 'must_have',
    },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Send Invitations',
      category: 'Guest List',
      dueDate: '2026-10-15',
      dueOffsetDays: -47,
      priority: 'high',
      status: 'completed',
      owner: 'Planner',
      prerequisiteTaskIds: [],
      aiGenerated: false,
    },
    {
      id: 'task-2',
      title: 'Finalize Seating Chart',
      category: 'Coordination',
      dueDate: '2026-11-24',
      dueOffsetDays: -7,
      priority: 'high',
      status: 'todo',
      owner: 'Planner',
      prerequisiteTaskIds: ['task-1'],
      aiGenerated: true,
    },
  ],
  vendors: [],
  ideas: [],
};

describe('Event Ripple Engine', () => {
  it('detects venue capacity violations when guests exceed capacity', () => {
    // Increasing guests to 300 when venueCapacity is 250
    const report = analyzeRippleImpact(mockEvent, { guestCount: 300 });

    expect(report.triggerField).toBe('guestCount');
    expect(report.oldValue).toBe(200);
    expect(report.newValue).toBe(300);

    const venueConflict = report.conflicts.find((c) => c.code === 'VENUE_CAPACITY_EXCEEDED');
    expect(venueConflict).toBeDefined();
    expect(venueConflict?.type).toBe('CRITICAL');
    expect(venueConflict?.message).toContain('exceeded by 50');
  });

  it('automatically recalculates scalable budget items based on guest delta', () => {
    // Increasing guests from 200 to 250 (+50 guests)
    const report = analyzeRippleImpact(mockEvent, { guestCount: 250 });

    const cateringDelta = report.budgetImpact.affectedItems.find((i) => i.id === 'item-catering');
    expect(cateringDelta).toBeDefined();
    // 250 guests * 120000 = 30000000 (₹3,00,000). Previous was 24000000 (₹2,40,000).
    expect(cateringDelta?.oldCostMinor).toBe(24000000);
    expect(cateringDelta?.newCostMinor).toBe(30000000);
    expect(report.budgetImpact.deltaMinor).toBe(6000000); // +₹60,000
  });

  it('re-evaluates task due dates and flags compressed deadlines on date change', () => {
    // Shifting event earlier to 2026-11-15
    const report = analyzeRippleImpact(mockEvent, { date: '2026-11-15' });

    expect(report.triggerField).toBe('date');
    const seatingTask = report.taskImpact.affectedTasks.find((t) => t.id === 'task-2');
    expect(seatingTask).toBeDefined();
    // 7 days before 2026-11-15 is 2026-11-08
    expect(seatingTask?.newDueDate).toBe('2026-11-08');
  });

  it('applies ripple patches non-destructively to event state', () => {
    const report = analyzeRippleImpact(mockEvent, { guestCount: 220 });
    const patched = applyRipplePatch(mockEvent, report.pendingPatches);

    expect(patched.guestCount).toBe(220);
    // Unrelated fields like title and location are strictly preserved
    expect(patched.title).toBe(mockEvent.title);
    expect(patched.location).toBe(mockEvent.location);

    // Catering item is updated to 220 * 120000 = 26400000
    const updatedCatering = patched.budgetItems.find((i) => i.id === 'item-catering');
    expect(updatedCatering?.estimatedMinor).toBe(26400000);
  });

  it('preserves user-added custom budget items and tasks when applying a patch', () => {
    const customItem = {
      id: 'custom-bud-user-999',
      category: 'Special',
      name: 'Custom Fireworks Display',
      estimatedMinor: 5000000,
      confirmedMinor: 5000000,
      paidMinor: 5000000,
      source: 'manual' as const,
      isScalableWithGuests: false,
      costPerGuestMinor: 0,
      fixedCostMinor: 5000000,
      priority: 'nice_to_have' as const,
    };

    const customTask = {
      id: 'custom-task-user-999',
      title: 'Grandma Special Transportation',
      category: 'Guest List',
      dueDate: '2026-11-30',
      dueOffsetDays: -1,
      priority: 'high' as const,
      status: 'todo' as const,
      owner: 'Brother',
      prerequisiteTaskIds: [],
      aiGenerated: false,
    };

    const eventWithCustoms: EventState = {
      ...mockEvent,
      budgetItems: [...mockEvent.budgetItems, customItem],
      tasks: [...mockEvent.tasks, customTask],
    };

    // Apply guest count change to 240
    const report = analyzeRippleImpact(eventWithCustoms, { guestCount: 240 });
    const patched = applyRipplePatch(eventWithCustoms, report.pendingPatches);

    // Ensure custom item is untouched
    const foundCustomItem = patched.budgetItems.find((i) => i.id === 'custom-bud-user-999');
    expect(foundCustomItem).toBeDefined();
    expect(foundCustomItem?.name).toBe('Custom Fireworks Display');
    expect(foundCustomItem?.confirmedMinor).toBe(5000000);

    // Ensure custom task is untouched
    const foundCustomTask = patched.tasks.find((t) => t.id === 'custom-task-user-999');
    expect(foundCustomTask).toBeDefined();
    expect(foundCustomTask?.title).toBe('Grandma Special Transportation');
  });

  it('performs pure UTC date arithmetic across leap years and month transitions', () => {
    // 2028 is a leap year; Feb has 29 days
    expect(addDaysToIsoDate('2028-03-01', -1)).toBe('2028-02-29');
    // 2027 is a standard year; Feb has 28 days
    expect(addDaysToIsoDate('2027-03-01', -1)).toBe('2027-02-28');
    // Year boundary transition backwards
    expect(addDaysToIsoDate('2027-01-01', -1)).toBe('2026-12-31');
    // Year boundary transition forwards
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    // 30 days offset across month
    expect(addDaysToIsoDate('2026-05-15', 20)).toBe('2026-06-04');
    // Malformed fallback
    expect(addDaysToIsoDate('invalid-date', 5)).toBe('invalid-date');
  });

  it('handles extreme guest counts (0 guests and 10,000 guests) gracefully without NaN', () => {
    // 0 guests clamped to 1 attendee minimum
    const zeroReport = analyzeRippleImpact(mockEvent, { guestCount: 0 });
    expect(zeroReport.budgetImpact.deltaMinor).toBe(-23880000); // 199 * 120000 saved (clamped to 1 attendee min)
    expect(zeroReport.conflicts.some((c) => c.code === 'VENUE_CAPACITY_EXCEEDED')).toBe(false);

    // 10,000 guests
    const massiveReport = analyzeRippleImpact(mockEvent, { guestCount: 10000 });
    expect(massiveReport.conflicts.some((c) => c.code === 'VENUE_CAPACITY_EXCEEDED')).toBe(true);
    expect(massiveReport.conflicts.some((c) => c.code === 'BUDGET_OVERRUN')).toBe(true);
    expect(isNaN(massiveReport.budgetImpact.deltaMinor)).toBe(false);
  });

  it('gracefully handles empty arrays for budget items and tasks without throwing', () => {
    const emptyEvent: EventState = {
      ...mockEvent,
      budgetItems: [],
      tasks: [],
    };

    expect(() => analyzeRippleImpact(emptyEvent, { guestCount: 250 })).not.toThrow();
    expect(() => analyzeRippleImpact(emptyEvent, { date: '2027-01-01' })).not.toThrow();
  });
});
