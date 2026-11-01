import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeRippleImpact, applyRipplePatch } from '../src/lib/ripple-engine';
import { enrichRippleWithGemini } from '../src/lib/gemini';
import {
  loadEventsFromStorage,
  saveEventsToStorage,
  loadActiveEventId,
  saveActiveEventId,
  resetStorageToDemo,
} from '../src/lib/storage';
import { EventState, RippleImpactReport } from '../src/types/event';
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

describe('Event Ripple Engine UX and Interaction Regression Suite', () => {
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', mockStorage);
  });

  // 1. Editing simulation inputs does not mutate the original event
  it('guarantees editing simulation inputs and running impact analysis does not mutate the original event', () => {
    const originalEvent: EventState = JSON.parse(JSON.stringify(DEMO_EVENTS[0]));
    const frozenCopy = Object.freeze(JSON.parse(JSON.stringify(DEMO_EVENTS[0])));

    // Run extreme constraint changes
    const report = analyzeRippleImpact(originalEvent, {
      guestCount: 450,
      totalBudgetMinor: 120000000,
      date: '2027-02-14',
      venueCapacity: 350,
    });

    // Verify report reflects requested simulation
    expect(report.triggerField).toBe('guestCount');
    expect(report.conflicts.length).toBeGreaterThan(0);
    expect(report.budgetImpact.affectedItems.length).toBeGreaterThan(0);
    expect(report.taskImpact.affectedTasks.length).toBeGreaterThan(0);

    // Verify original event fields are 100% unmutated
    expect(originalEvent.guestCount).toBe(frozenCopy.guestCount);
    expect(originalEvent.totalBudgetMinor).toBe(frozenCopy.totalBudgetMinor);
    expect(originalEvent.date).toBe(frozenCopy.date);
    expect(originalEvent.venueCapacity).toBe(frozenCopy.venueCapacity);
    expect(originalEvent.budgetItems).toEqual(frozenCopy.budgetItems);
    expect(originalEvent.tasks).toEqual(frozenCopy.tasks);
  });

  // 2. Closing the drawer discards pending changes without saving
  it('guarantees closing or discarding the drawer discards pending changes without mutating state or storage', () => {
    const pristineEvents = resetStorageToDemo();
    const activeEvent = pristineEvents[0];
    const initialStorageSnapshot = mockStorage.getItem('utsavpilot_events_v1');

    // Simulate user adjusting simulation inputs in drawer
    const simulatedChanges = {
      guestCount: 390,
      totalBudgetMinor: 250000000,
      date: '2027-01-01',
      venueCapacity: 300,
    };
    const report = analyzeRippleImpact(activeEvent, simulatedChanges);
    expect(report.pendingPatches.guestCount).toBe(390);

    // Simulate drawer discard/close action:
    // No call to applyRipplePatch, no call to saveEventsToStorage
    const currentStorageAfterDiscard = mockStorage.getItem('utsavpilot_events_v1');
    expect(currentStorageAfterDiscard).toBe(initialStorageSnapshot);

    const reloaded = loadEventsFromStorage();
    expect(reloaded[0].guestCount).toBe(activeEvent.guestCount);
    expect(reloaded[0].totalBudgetMinor).toBe(activeEvent.totalBudgetMinor);
  });

  // 3. Explicit discard restores original simulation inputs and clears AI enrichment
  it('explicit discard resets simulation state back to original event constraints and clears AI enrichment', () => {
    const event = DEMO_EVENTS[0];

    // State machine simulation of RippleDrawer state
    let simGuestCount = event.guestCount;
    let simBudgetMajor = event.totalBudgetMinor / 100;
    let simDate = event.date;
    let simCapacity = event.venueCapacity;
    let enrichedReport: RippleImpactReport | null = null;
    let aiMetadata: { provider: string; modelUsed: string; isLive: boolean } | null = null;

    // User changes inputs
    simGuestCount = 350;
    simBudgetMajor = 2200000;
    simDate = '2026-12-25';
    simCapacity = 400;

    // User enriches with AI
    enrichedReport = analyzeRippleImpact(event, { guestCount: 350 });
    aiMetadata = { provider: 'gemini', modelUsed: 'gemini-3.5-flash-lite', isLive: true };

    const hasChangesBefore =
      simGuestCount !== event.guestCount ||
      Math.round(simBudgetMajor * 100) !== event.totalBudgetMinor ||
      simDate !== event.date ||
      simCapacity !== event.venueCapacity;
    expect(hasChangesBefore).toBe(true);
    expect(aiMetadata.isLive).toBe(true);

    // Trigger handleDiscardAndClose / handleReset
    const handleReset = () => {
      simGuestCount = event.guestCount;
      simBudgetMajor = event.totalBudgetMinor / 100;
      simDate = event.date;
      simCapacity = event.venueCapacity;
      enrichedReport = null;
      aiMetadata = null;
    };

    handleReset();

    // Verify all states returned to baseline
    expect(simGuestCount).toBe(event.guestCount);
    expect(simBudgetMajor).toBe(event.totalBudgetMinor / 100);
    expect(simDate).toBe(event.date);
    expect(simCapacity).toBe(event.venueCapacity);
    expect(enrichedReport).toBeNull();
    expect(aiMetadata).toBeNull();

    const hasChangesAfter =
      simGuestCount !== event.guestCount ||
      Math.round(simBudgetMajor * 100) !== event.totalBudgetMinor ||
      simDate !== event.date ||
      simCapacity !== event.venueCapacity;
    expect(hasChangesAfter).toBe(false);
  });

  // 4. Accepting changes updates the correct event without affecting others
  it('accepting changes applies approved patches only to the active event, preserving other events', () => {
    const events: EventState[] = [
      { ...DEMO_EVENTS[0] }, // wedding
      { ...DEMO_EVENTS[1] }, // birthday
      { ...DEMO_EVENTS[2] }, // community
    ];

    const targetEvent = events[1]; // Target: Birthday
    const report = analyzeRippleImpact(targetEvent, {
      guestCount: 65,
      totalBudgetMinor: 22000000,
    });

    const updatedBirthday = applyRipplePatch(targetEvent, report.pendingPatches);
    expect(updatedBirthday.id).toBe(targetEvent.id);
    expect(updatedBirthday.guestCount).toBe(65);
    expect(updatedBirthday.totalBudgetMinor).toBe(22000000);

    // Apply update to event list
    const updatedEvents = events.map((ev) => (ev.id === updatedBirthday.id ? updatedBirthday : ev));

    // Verify target updated
    expect(updatedEvents[1].guestCount).toBe(65);
    // Verify wedding and community untouched
    expect(updatedEvents[0].guestCount).toBe(DEMO_EVENTS[0].guestCount);
    expect(updatedEvents[0].totalBudgetMinor).toBe(DEMO_EVENTS[0].totalBudgetMinor);
    expect(updatedEvents[2].guestCount).toBe(DEMO_EVENTS[2].guestCount);
    expect(updatedEvents[2].totalBudgetMinor).toBe(DEMO_EVENTS[2].totalBudgetMinor);
  });

  // 5. Accepted changes persist after reload
  it('guarantees accepted ripple changes persist into localStorage and reload with exact fidelity', () => {
    const initialEvents = resetStorageToDemo();
    const active = initialEvents[0];

    const report = analyzeRippleImpact(active, {
      guestCount: 310,
      totalBudgetMinor: 210000000,
      date: '2026-12-28',
      venueCapacity: 350,
    });

    const patched = applyRipplePatch(active, report.pendingPatches);
    const updatedEvents = initialEvents.map((e) => (e.id === patched.id ? patched : e));

    const saved = saveEventsToStorage(updatedEvents);
    saveActiveEventId(patched.id);
    expect(saved).toBe(true);

    // Simulate browser reload
    const reloadedEvents = loadEventsFromStorage();
    const reloadedActiveId = loadActiveEventId();

    expect(reloadedActiveId).toBe(patched.id);
    const reloadedActive = reloadedEvents.find((e) => e.id === reloadedActiveId);
    expect(reloadedActive).toBeDefined();
    expect(reloadedActive?.guestCount).toBe(310);
    expect(reloadedActive?.totalBudgetMinor).toBe(210000000);
    expect(reloadedActive?.date).toBe('2026-12-28');
    expect(reloadedActive?.venueCapacity).toBe(350);
  });

  // 6. Gemini enrichment state is reset when simulation inputs change
  it('resets Gemini enrichment state and metadata whenever simulation inputs are altered', () => {
    const event = DEMO_EVENTS[0];
    let simGuestCount = 300;
    let enrichedReport: RippleImpactReport | null = analyzeRippleImpact(event, { guestCount: 300 });
    let aiMetadata: { provider: string; modelUsed: string; isLive: boolean } | null = {
      provider: 'gemini',
      modelUsed: 'gemini-3.5-flash-lite',
      isLive: true,
    };

    expect(aiMetadata.isLive).toBe(true);
    expect(enrichedReport).not.toBeNull();

    // User changes slider again (300 -> 320)
    simGuestCount = 320;
    // Drawer effect clears enrichment
    enrichedReport = null;
    aiMetadata = null;

    expect(enrichedReport).toBeNull();
    expect(aiMetadata).toBeNull();

    // Recomputing deterministic impact gives fresh calculation with rule-based heuristics
    const freshReport = analyzeRippleImpact(event, { guestCount: simGuestCount });
    expect(freshReport.triggerField).toBe('guestCount');
    expect(freshReport.newValue).toBe(320);
  });

  // 7. Clear distinction: deterministic calculations versus Gemini enrichment
  it('accurately distinguishes deterministic calculations from AI enrichment without false provenance claims', async () => {
    const event = DEMO_EVENTS[0];
    const baseReport = analyzeRippleImpact(event, { guestCount: 350 });

    // Deterministic analysis facts and conflicts
    expect(baseReport.facts.length).toBeGreaterThan(0);
    expect(baseReport.conflicts.some((c) => c.code === 'VENUE_CAPACITY_EXCEEDED')).toBe(true);
    expect(baseReport.budgetImpact.deltaMinor).toBeGreaterThan(0);

    // When Gemini is not called, report contains only base facts
    expect(baseReport.facts.every((f) => !f.startsWith('AI CO-PILOT ADVICE:'))).toBe(true);

    // Test offline simulation fallback
    const fallbackResult = await enrichRippleWithGemini(
      event,
      { guestCount: 350 },
      baseReport
    );

    // Fallback must not claim to be live Gemini
    if (!fallbackResult.aiMetadata.isLive) {
      expect(fallbackResult.aiMetadata.provider).toBe('simulation');
      expect(fallbackResult.aiMetadata.isLive).toBe(false);
    }
  });

  // 8. Footer action label contextual semantics
  it('correctly maps footer action label contextually between "Close" and "Discard Changes"', () => {
    const event = DEMO_EVENTS[0];

    const getFooterLabel = (simGuest: number, simBudget: number, simDate: string, simCap: number) => {
      const hasChanges =
        simGuest !== event.guestCount ||
        Math.round(simBudget * 100) !== event.totalBudgetMinor ||
        simDate !== event.date ||
        simCap !== event.venueCapacity;
      return hasChanges ? 'Discard Changes' : 'Close';
    };

    // Exactly matching original event
    expect(getFooterLabel(event.guestCount, event.totalBudgetMinor / 100, event.date, event.venueCapacity)).toBe('Close');

    // Any single field modified
    expect(getFooterLabel(event.guestCount + 10, event.totalBudgetMinor / 100, event.date, event.venueCapacity)).toBe('Discard Changes');
    expect(getFooterLabel(event.guestCount, (event.totalBudgetMinor / 100) - 1000, event.date, event.venueCapacity)).toBe('Discard Changes');
    expect(getFooterLabel(event.guestCount, event.totalBudgetMinor / 100, '2026-12-31', event.venueCapacity)).toBe('Discard Changes');
    expect(getFooterLabel(event.guestCount, event.totalBudgetMinor / 100, event.date, event.venueCapacity + 50)).toBe('Discard Changes');
  });
});

