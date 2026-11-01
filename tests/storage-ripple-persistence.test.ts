import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  ACTIVE_EVENT_KEY,
  loadEventsFromStorage,
  saveEventsToStorage,
  loadActiveEventId,
  saveActiveEventId,
  resetStorageToDemo,
} from '../src/lib/storage';
import { analyzeRippleImpact, applyRipplePatch } from '../src/lib/ripple-engine';
import { EventState } from '../src/types/event';
import { DEMO_EVENTS } from '../src/data/demo-events';

// In-memory localStorage mock for node test environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

describe('Ripple Engine Persistence & Storage Lifecycle Suite', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', mockStorage);
  });

  // 1. Save an updated event, reload storage, and recover the exact updated values
  it('saves an updated event, reloads storage, and recovers the exact updated values', () => {
    const baseEvent: EventState = {
      ...DEMO_EVENTS[0],
      guestCount: 250,
      totalBudgetMinor: 180000000,
      venueCapacity: 300,
      date: '2026-12-15',
    };

    // Simulate ripple change: guests 250 -> 320, budget cut, date shift
    const rippleReport = analyzeRippleImpact(baseEvent, {
      guestCount: 320,
      totalBudgetMinor: 190000000,
      date: '2026-12-25',
      venueCapacity: 350,
    });

    const patchedEvent = applyRipplePatch(baseEvent, rippleReport.pendingPatches);
    expect(patchedEvent.guestCount).toBe(320);
    expect(patchedEvent.totalBudgetMinor).toBe(190000000);
    expect(patchedEvent.date).toBe('2026-12-25');
    expect(patchedEvent.venueCapacity).toBe(350);

    // Save patched event to storage
    const allEvents = [patchedEvent, DEMO_EVENTS[1], DEMO_EVENTS[2]];
    const saveResult = saveEventsToStorage(allEvents);
    expect(saveResult).toBe(true);

    // Reload from storage
    const reloadedEvents = loadEventsFromStorage();
    expect(reloadedEvents.length).toBe(3);

    const reloadedEvent = reloadedEvents.find((e) => e.id === baseEvent.id);
    expect(reloadedEvent).toBeDefined();
    expect(reloadedEvent?.guestCount).toBe(320);
    expect(reloadedEvent?.totalBudgetMinor).toBe(190000000);
    expect(reloadedEvent?.date).toBe('2026-12-25');
    expect(reloadedEvent?.venueCapacity).toBe(350);

    // Check scalable budget item (catering scaled for 320 guests)
    const cateringItem = reloadedEvent?.budgetItems.find((b) => b.isScalableWithGuests);
    expect(cateringItem).toBeDefined();
    // 5000000 base + 320 * 120000 = 43400000
    expect(cateringItem?.estimatedMinor).toBe(43400000);
  });

  // 2. Preserve unrelated event fields when applying Ripple patches
  it('preserves unrelated event fields when applying Ripple patches', () => {
    const richEvent: EventState = {
      ...DEMO_EVENTS[0],
      theme: 'Custom Vintage Royal Aesthetic',
      location: 'Custom Heritage Palace, Udaipur',
      brief: 'Special brief with unique constraints and elder arrangements',
      dietaryNeeds: ['Vegetarian', 'Jain Options', 'Gluten-Free Custom'],
      accessibilityNeeds: ['Wheelchair Ramps', 'Golf Carts'],
      contingencyPercent: 12,
      currency: 'INR',
      vendors: [
        {
          id: 'v-custom-1',
          category: 'Photography',
          name: 'Studio Royal Cinema',
          quoteMinor: 15000000,
          depositPaidMinor: 5000000,
          balanceDueMinor: 10000000,
          status: 'booked',
          inclusions: ['4K Video', 'Drone'],
          isSampleData: true,
        },
      ],
      ideas: [
        {
          id: 'idea-custom-1',
          category: 'decor',
          title: 'Floating Urli Candles',
          description: 'Brass urli bowls with floating candles and marigolds',
          reasoning: 'Reduces floral waste while maintaining royal aesthetic',
          tradeOffs: 'Requires candle relighting marshal',
        },
      ],
      budgetItems: [
        ...DEMO_EVENTS[0].budgetItems,
        {
          id: 'custom-bud-fireworks',
          category: 'Entertainment',
          name: 'Eco-Friendly Cold Pyrotechnics',
          estimatedMinor: 8000000,
          confirmedMinor: 8000000,
          paidMinor: 4000000,
          source: 'user_defined',
          isScalableWithGuests: false,
          costPerGuestMinor: 0,
          fixedCostMinor: 8000000,
          priority: 'optional',
          notes: 'Green fireworks approved by municipal board',
        },
      ],
    };

    const report = analyzeRippleImpact(richEvent, { guestCount: 290 });
    const patched = applyRipplePatch(richEvent, report.pendingPatches);

    // Patched field changed
    expect(patched.guestCount).toBe(290);

    // Unrelated fields strictly preserved
    expect(patched.theme).toBe('Custom Vintage Royal Aesthetic');
    expect(patched.location).toBe('Custom Heritage Palace, Udaipur');
    expect(patched.brief).toBe('Special brief with unique constraints and elder arrangements');
    expect(patched.dietaryNeeds).toEqual(['Vegetarian', 'Jain Options', 'Gluten-Free Custom']);
    expect(patched.accessibilityNeeds).toEqual(['Wheelchair Ramps', 'Golf Carts']);
    expect(patched.contingencyPercent).toBe(12);
    expect(patched.currency).toBe('INR');
    expect(patched.vendors.length).toBe(1);
    expect(patched.vendors[0].name).toBe('Studio Royal Cinema');
    expect(patched.ideas.length).toBe(1);
    expect(patched.ideas[0].title).toBe('Floating Urli Candles');

    // Custom user-added budget item strictly preserved
    const customItem = patched.budgetItems.find((b) => b.id === 'custom-bud-fireworks');
    expect(customItem).toBeDefined();
    expect(customItem?.confirmedMinor).toBe(8000000);
    expect(customItem?.notes).toBe('Green fireworks approved by municipal board');
  });

  // 3. Preserve multiple events when updating one event
  it('preserves multiple events when updating one event', () => {
    const event1 = { ...DEMO_EVENTS[0], title: 'Event 1 Wedding' };
    const event2 = { ...DEMO_EVENTS[1], title: 'Event 2 Birthday', guestCount: 40 };
    const event3 = { ...DEMO_EVENTS[2], title: 'Event 3 Community' };

    const initialEvents = [event1, event2, event3];
    saveEventsToStorage(initialEvents);

    // Update only Event 2 (Birthday) with Ripple changes
    const report = analyzeRippleImpact(event2, { guestCount: 65, totalBudgetMinor: 20000000 });
    const updatedEvent2 = applyRipplePatch(event2, report.pendingPatches);

    // Apply update to event list
    const updatedEvents = initialEvents.map((ev) => (ev.id === updatedEvent2.id ? updatedEvent2 : ev));
    saveEventsToStorage(updatedEvents);

    // Reload
    const reloaded = loadEventsFromStorage();
    expect(reloaded.length).toBe(3);

    // Event 1 and 3 are intact
    expect(reloaded[0].title).toBe('Event 1 Wedding');
    expect(reloaded[0].guestCount).toBe(event1.guestCount);
    expect(reloaded[2].title).toBe('Event 3 Community');
    expect(reloaded[2].guestCount).toBe(event3.guestCount);

    // Event 2 was correctly updated
    expect(reloaded[1].title).toBe('Event 2 Birthday');
    expect(reloaded[1].guestCount).toBe(65);
    expect(reloaded[1].totalBudgetMinor).toBe(20000000);
  });

  // 4. Restore the correct active event after reload
  it('restores the correct active event after reload', () => {
    // Save Event 2 as active
    saveActiveEventId('demo-birthday-01');

    // Reload active event ID
    const activeId = loadActiveEventId();
    expect(activeId).toBe('demo-birthday-01');

    // Save Event 3 as active
    saveActiveEventId('demo-community-01');
    expect(loadActiveEventId()).toBe('demo-community-01');

    // Test fallback when active event key is not set
    mockStorage.removeItem(ACTIVE_EVENT_KEY);
    expect(loadActiveEventId()).toBe(DEMO_EVENTS[0].id);
  });

  // 5. Ensure rejecting or closing a Ripple proposal does not write changes
  it('ensures rejecting or closing a Ripple proposal does not write changes', () => {
    saveEventsToStorage(DEMO_EVENTS);
    saveActiveEventId(DEMO_EVENTS[0].id);

    const originalGuestCount = DEMO_EVENTS[0].guestCount;

    // Simulate opening drawer, computing simulation, but user clicks Cancel/Discard
    const simulatedReport = analyzeRippleImpact(DEMO_EVENTS[0], { guestCount: 500 });
    expect(simulatedReport.pendingPatches.guestCount).toBe(500);

    // Discard/Cancel action: onApplyPatches is NOT called!
    // Verify storage has not been touched
    const reloaded = loadEventsFromStorage();
    expect(reloaded[0].guestCount).toBe(originalGuestCount);
    expect(reloaded[0].guestCount).not.toBe(500);
  });

  // 6. Ensure malformed stored JSON falls back safely
  it('ensures malformed stored JSON falls back safely without crashing', () => {
    // Malformed JSON string
    mockStorage.setItem(STORAGE_KEY, '{"broken": json');

    const recovered = loadEventsFromStorage();
    expect(Array.isArray(recovered)).toBe(true);
    expect(recovered.length).toBe(DEMO_EVENTS.length);
    expect(recovered[0].id).toBe(DEMO_EVENTS[0].id);

    // Non-array JSON (e.g. object or null)
    mockStorage.setItem(STORAGE_KEY, JSON.stringify({ notAnArray: true }));
    const recoveredNonArray = loadEventsFromStorage();
    expect(Array.isArray(recoveredNonArray)).toBe(true);
    expect(recoveredNonArray.length).toBe(DEMO_EVENTS.length);

    // Empty array in storage
    mockStorage.setItem(STORAGE_KEY, '[]');
    const recoveredEmpty = loadEventsFromStorage();
    expect(Array.isArray(recoveredEmpty)).toBe(true);
    expect(recoveredEmpty.length).toBe(DEMO_EVENTS.length);
  });

  // 7. Full simulated end-to-end acceptance flow with storage reload
  it('simulates full end-to-end: accept Ripple proposal -> persist -> reload -> verify UI data', () => {
    // 1. Initial hydration: seeds storage with DEMO_EVENTS
    const initialEvents = loadEventsFromStorage();
    saveActiveEventId(initialEvents[0].id);

    // 2. User simulates guest increase and budget adjustment
    const activeEvent = initialEvents[0];
    const report = analyzeRippleImpact(activeEvent, {
      guestCount: 280,
      totalBudgetMinor: 175000000,
    });

    // 3. User clicks "Accept & Apply Ripple Changes"
    const patchedEvent = applyRipplePatch(activeEvent, report.pendingPatches);

    // handleUpdateActiveEvent updates state and storage
    const updatedEvents = initialEvents.map((e) => (e.id === patchedEvent.id ? patchedEvent : e));
    const saved = saveEventsToStorage(updatedEvents);
    saveActiveEventId(patchedEvent.id);
    expect(saved).toBe(true);

    // 4. Page Reload: simulates browser restart / reload
    const reloadedEvents = loadEventsFromStorage();
    const reloadedActiveId = loadActiveEventId();

    const hydratedActiveEvent = reloadedEvents.find((e) => e.id === reloadedActiveId);
    expect(hydratedActiveEvent).toBeDefined();
    expect(hydratedActiveEvent?.id).toBe(activeEvent.id);
    expect(hydratedActiveEvent?.guestCount).toBe(280);
    expect(hydratedActiveEvent?.totalBudgetMinor).toBe(175000000);
  });

  // 8. Storage error handling returns false when quota or storage is restricted
  it('returns false and handles storage exceptions safely when storage is restricted', () => {
    // Force localStorage.setItem to throw an error (e.g. QuotaExceededError)
    vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: Failed to execute setItem');
    });

    const result = saveEventsToStorage(DEMO_EVENTS);
    expect(result).toBe(false);

    const activeResult = saveActiveEventId('test-id');
    expect(activeResult).toBe(false);
  });
});
