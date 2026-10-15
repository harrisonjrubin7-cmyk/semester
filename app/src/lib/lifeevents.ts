import type { FeatureState } from '../intelligence/contracts';
import { isoDay, obj } from './device-library';
import { NEEDS, type NeedId } from './help-routes';
import type { Screen } from './types';

/**
 * A life event: "my availability changed", "I need help adjusting my plan",
 * "I need to find support" — said without a diagnosis, a name, a reason or a
 * case number.
 *
 * Many academic disruptions start outside the catalogue. The student's choice
 * is which of twelve plain sentences is closest; what comes back is optional
 * plan adjustments to look at, the help routes that own the problem, and a
 * temporary action plan that lapses on its own.
 *
 * ## What it never does
 *
 * - It never asks for detail. There is no text field: `DISCLOSED` is nothing,
 *   and the test refuses a shape that could carry a sentence.
 * - It never decides. Whether an extension, a leave or an accommodation is
 *   granted belongs to the office that owns it (`nowrongdoor.NEVER`), and the
 *   routes here only point.
 * - It never tells anyone. Nothing leaves the device from this module; a
 *   route opens the help form, and what that form sends is `help-routes`'s
 *   `payload` — the student ticks each thing before it goes.
 * - It never remembers the event past its plan. `PLAN_DAYS` is the longest a
 *   temporary plan lives; after that there is nothing to follow up on.
 *
 * Pure: the date is passed in.
 *
 * ## Kept on this device, shown to nobody
 *
 * What is stored is the event's id and the day it was chosen, under a key of its
 * own, outside the synced state — `state/shape.ts` never sees it, and no
 * staff role, supporter or analytics event can read it. The plan is derived
 * from those two facts each time, so nothing else is stored, and a plan past
 * `PLAN_DAYS` is not drawn and is dropped the next time the list is written.
 * `VITE_ME_LIFE_EVENTS` gates the panel; absent is off.
 */

export const LIFE_EVENT_IDS = [
  'work-schedule',
  'caregiving',
  'illness',
  'housing',
  'money',
  'technology',
  'travel',
  'leave',
  'family-emergency',
  'documents',
  'returning',
  'availability',
] as const;
export type LifeEventId = (typeof LIFE_EVENT_IDS)[number];

/** What the student is asked for. Nothing. */
export const DISCLOSED = 'nothing' as const;

/** The longest a temporary plan lives, and when the one follow-up falls. */
export const PLAN_DAYS = 28;
export const FOLLOW_UP_DAYS = 14;

export interface Adjustment {
  id: string;
  /** In the student's words; always optional. */
  label: string;
  screen: Screen;
}

export interface LifeEvent {
  id: LifeEventId;
  /** The sentence the student picks. */
  says: string;
  adjustments: Adjustment[];
  /** Help routes that own this, from `help-routes`. Empty means the directory alone. */
  routes: NeedId[];
}

const adj = (id: string, label: string, screen: Screen): Adjustment => ({ id, label, screen });
const LOOK_AT_WEEK = adj('week', 'See what this week looks like now', 'calendar');
const CATCH_UP = adj('behind', 'Sort what is behind, kindest first', 'behind');

export const LIFE_EVENTS: readonly LifeEvent[] = [
  { id: 'work-schedule', says: 'My work schedule changed', adjustments: [LOOK_AT_WEEK, adj('runway', 'Check the term against fewer free hours', 'runway')], routes: ['course'] },
  { id: 'caregiving', says: 'I am taking on caregiving', adjustments: [LOOK_AT_WEEK, CATCH_UP], routes: ['course', 'wellbeing'] },
  { id: 'illness', says: 'I am ill or recovering', adjustments: [CATCH_UP, LOOK_AT_WEEK], routes: ['accessibility', 'course', 'wellbeing'] },
  { id: 'housing', says: 'My housing is disrupted', adjustments: [LOOK_AT_WEEK, adj('housing', 'Housing resources', 'housing')], routes: ['money', 'wellbeing'] },
  { id: 'money', says: 'Money has become tight', adjustments: [adj('costs', 'Look at what this term costs', 'costs')], routes: ['money'] },
  { id: 'technology', says: 'I cannot get to a working device or connection', adjustments: [CATCH_UP], routes: ['course', 'money'] },
  { id: 'travel', says: 'I am travelling or competing', adjustments: [LOOK_AT_WEEK, adj('athletics', 'Travel and absence letters', 'athletics')], routes: ['course'] },
  { id: 'leave', says: 'I may need to take time away', adjustments: [adj('pathway', 'See where this leaves the path', 'pathway'), adj('degree', 'See where this leaves the degree', 'degree')], routes: ['registration', 'money', 'wellbeing'] },
  { id: 'family-emergency', says: 'There is a family emergency', adjustments: [CATCH_UP], routes: ['course', 'wellbeing'] },
  { id: 'documents', says: 'A document or visa deadline is close', adjustments: [LOOK_AT_WEEK], routes: ['registration'] },
  { id: 'returning', says: 'I am coming back after time away', adjustments: [adj('pathway', 'See where the path picks up', 'pathway'), CATCH_UP], routes: ['registration', 'course'] },
  { id: 'availability', says: 'My availability changed', adjustments: [LOOK_AT_WEEK, CATCH_UP], routes: ['course'] },
] as const;

export const eventById = (id: LifeEventId): LifeEvent => LIFE_EVENTS.find((e) => e.id === id)!;

const plusDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface TemporaryPlan {
  event: LifeEvent;
  /** What was asked of the student. */
  disclosed: typeof DISCLOSED;
  adjustments: Adjustment[];
  routes: { need: NeedId; label: string; directoryOnly: boolean }[];
  /** The plan lapses here and leaves nothing behind. */
  expires: string;
  /** One reminder, on this device, that asks "is this still what you need?". */
  followUp: string;
  /** Said with the plan. */
  line: string;
}

export function planFor(id: LifeEventId, today: string): TemporaryPlan {
  const event = eventById(id);
  return {
    event,
    disclosed: DISCLOSED,
    adjustments: event.adjustments,
    routes: event.routes.map((n) => {
      const need = NEEDS.find((x) => x.id === n)!;
      return { need: n, label: need.label, directoryOnly: need.directoryOnly };
    }),
    expires: plusDays(today, PLAN_DAYS),
    followUp: plusDays(today, FOLLOW_UP_DAYS),
    line: 'You did not have to say why. Everything here is optional, stays on this device, and lapses on its own.',
  };
}

// ── The choice, on this device ───────────────────────────────────────────────

export const LIFE_EVENTS_KEY = 'semester.life-events.v1';

/** More than this at once is not a plan, it is a week; the oldest is let go. */
export const MAX_ACTIVE = 3;

export interface StoredEvent {
  id: LifeEventId;
  /** `YYYY-MM-DD`, the day it was chosen or last kept. */
  chosenOn: string;
}
export interface LifeEventState {
  events: readonly StoredEvent[];
}
export const EMPTY_LIFE_EVENTS: LifeEventState = { events: [] };

const IDS: ReadonlySet<string> = new Set(LIFE_EVENT_IDS);

/** Only known ids, each once, real days, at most `MAX_ACTIVE`. Anything else is dropped, not repaired. */
export function readLifeEvents(raw: unknown): LifeEventState {
  if (!obj(raw) || !Array.isArray(raw.events)) return EMPTY_LIFE_EVENTS;
  const seen = new Set<string>();
  const events: StoredEvent[] = [];
  for (const e of raw.events) {
    if (!obj(e) || typeof e.id !== 'string' || !IDS.has(e.id) || seen.has(e.id)) continue;
    if (typeof e.chosenOn !== 'string' || !e.chosenOn || !isoDay(e.chosenOn)) continue;
    seen.add(e.id);
    events.push({ id: e.id as LifeEventId, chosenOn: e.chosenOn });
  }
  return { events: events.slice(-MAX_ACTIVE) };
}

/** The local day for a date or timestamp, so "today" is the student's and not UTC's. */
export function dayOf(at: Date | number): string {
  const d = new Date(at);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Choosing an event again keeps it and restarts its clock; the oldest above the cap goes. */
export function chooseEvent(state: LifeEventState, id: LifeEventId, today: string): LifeEventState {
  const rest = state.events.filter((e) => e.id !== id);
  return readLifeEvents({ events: [...rest, { id, chosenOn: today }] });
}

export const clearEvent = (state: LifeEventState, id: LifeEventId): LifeEventState => ({ events: state.events.filter((e) => e.id !== id) });

/** Not yet lapsed: `today` is before the day the plan clears. */
export const isActive = (e: StoredEvent, today: string): boolean => today < planFor(e.id, e.chosenOn).expires;

/** Drops what has lapsed. Returns the same object when nothing has, so a write can be skipped. */
export function pruneLapsed(state: LifeEventState, today: string): LifeEventState {
  const kept = state.events.filter((e) => isActive(e, today));
  return kept.length === state.events.length ? state : { events: kept };
}

export interface ActivePlan {
  plan: TemporaryPlan;
  chosenOn: string;
  /** The one follow-up is due: it is on or after the follow-up day, and the plan has not lapsed. */
  followUpDue: boolean;
}

export function activePlans(state: LifeEventState, today: string): ActivePlan[] {
  return state.events
    .filter((e) => isActive(e, today))
    .map((e) => {
      const plan = planFor(e.id, e.chosenOn);
      return { plan, chosenOn: e.chosenOn, followUpDue: today >= plan.followUp };
    });
}

// ── The switch ───────────────────────────────────────────────────────────────

const STATES: readonly FeatureState[] = ['off', 'preview', 'sandbox', 'production'];

/** `VITE_ME_LIFE_EVENTS`. Absent is off, and does not follow the institutional preview. */
export function lifeEventsFlag(env: Record<string, unknown>): FeatureState {
  const value = env.VITE_ME_LIFE_EVENTS;
  return STATES.includes(value as FeatureState) ? (value as FeatureState) : 'off';
}

export const LIFE_EVENTS_FLAG: FeatureState = lifeEventsFlag((import.meta as { env?: Record<string, unknown> }).env ?? {});

export const lifeEventsOn = (flag: FeatureState = LIFE_EVENTS_FLAG): boolean => flag !== 'off';
