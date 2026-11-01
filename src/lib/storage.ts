import { EventState } from '@/types/event';
import { DEMO_EVENTS } from '@/data/demo-events';

export const STORAGE_KEY = 'utsavpilot_events_v1';
export const ACTIVE_EVENT_KEY = 'utsavpilot_active_event_id';

export function loadEventsFromStorage(): EventState[] {
  if (typeof window === 'undefined') {
    return DEMO_EVENTS;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveEventsToStorage(DEMO_EVENTS);
      return DEMO_EVENTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse stored events, resetting to demo data:', err);
  }
  saveEventsToStorage(DEMO_EVENTS);
  return DEMO_EVENTS;
}

export function saveEventsToStorage(events: EventState[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    return true;
  } catch (err) {
    console.error('Failed to save events to storage:', err);
    return false;
  }
}

export function loadActiveEventId(): string {
  if (typeof window === 'undefined') return DEMO_EVENTS[0].id;
  try {
    const active = localStorage.getItem(ACTIVE_EVENT_KEY);
    if (active && typeof active === 'string' && active.trim().length > 0) {
      return active.trim();
    }
  } catch (err) {
    console.warn('Error reading active event id:', err);
  }
  return DEMO_EVENTS[0].id;
}

export function saveActiveEventId(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(ACTIVE_EVENT_KEY, id);
    return true;
  } catch (err) {
    console.error('Failed to save active event id:', err);
    return false;
  }
}

export function resetStorageToDemo(): EventState[] {
  if (typeof window === 'undefined') return DEMO_EVENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let userEvents: EventState[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        userEvents = parsed.filter((ev: EventState) => !DEMO_EVENTS.some((d) => d.id === ev.id));
      }
    }
    const merged = [...DEMO_EVENTS, ...userEvents];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    localStorage.setItem(ACTIVE_EVENT_KEY, DEMO_EVENTS[0].id);
    return merged;
  } catch (err) {
    console.error('Failed to reset storage:', err);
    return DEMO_EVENTS;
  }
}
