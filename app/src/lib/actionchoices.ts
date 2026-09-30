/**
 * The choices the Action Center offers when a student snoozes or hides an
 * action: times they can picture, and a short fixed list of reasons.
 *
 * These live apart from `actions.ts` on purpose. That module is pulled in by
 * the store, so it is on every screen's first load; these are read only by the
 * Action Center, which is lazily loaded. Keeping them here keeps about a
 * kilobyte out of the first load (the performance budgets caught it).
 */

import type { Action, Choice } from './actions';

const DAY = 86_400_000;

/** A time a student can picture, not a duration they have to compute. */
export interface SnoozePreset {
  id: 'later' | 'tomorrow' | 'next-week' | 'before-due';
  /** The button's words. */
  label: string;
  /** Where it goes in "Snoozed until …". */
  until: number;
  /** "later today", "tomorrow morning" — for the sentence after the choice. */
  says: string;
}

const at8 = (d: Date, plusDays: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + plusDays, 8, 0, 0, 0).getTime();

/**
 * The snoozes offered for one action at one moment. All in local time, all
 * strictly in the future (`transition` refuses a snooze that is not), and none
 * past the moment the action expires, so a snooze can never outlast the thing.
 *
 * - **Later today**: three hours on, offered only before 9 p.m., so it never
 *   lands after midnight (that is "tomorrow morning").
 * - **Tomorrow morning**: 8 a.m. tomorrow. Always offered; the default.
 * - **Next week**: 8 a.m. the coming Monday (a full week from a Monday).
 * - **The day before it is due**: only for an action with a due time more
 *   than a day and an hour away.
 */
export function snoozePresets(now: number, action: Pick<Action, 'dueAt' | 'expiresAt'>): SnoozePreset[] {
  const d = new Date(now);
  const out: SnoozePreset[] = [];
  const limit = action.expiresAt ?? Infinity;
  if (d.getHours() < 21) out.push({ id: 'later', label: 'Snooze until later today', until: now + 3 * 3_600_000, says: 'later today' });
  out.push({ id: 'tomorrow', label: 'Snooze until tomorrow', until: at8(d, 1), says: 'tomorrow morning' });
  const toMonday = ((8 - d.getDay()) % 7) || 7;
  out.push({ id: 'next-week', label: 'Snooze until next week', until: at8(d, toMonday), says: 'Monday morning' });
  if (typeof action.dueAt === 'number' && action.dueAt - DAY > now + 3_600_000) {
    out.push({ id: 'before-due', label: 'Snooze until the day before it is due', until: action.dueAt - DAY, says: 'the day before it is due' });
  }
  return out.filter((p) => p.until > now && p.until < limit);
}

/**
 * Why a student hid something. A fixed list, stored as the note on the
 * dismissal, so the reason is one of five sentences and never free text that
 * could carry anything else. It is kept on the device with the rest of the
 * choice and read nowhere but the "Hidden" list, where it reminds the student
 * why they hid it.
 */
export const DISMISS_REASONS = [
  { id: 'done', label: 'I already did this' },
  { id: 'not-mine', label: 'This does not apply to me' },
  { id: 'wrong', label: 'The information is wrong' },
  { id: 'too-much', label: 'Too much right now' },
] as const;

export type DismissReasonId = (typeof DISMISS_REASONS)[number]['id'];

const REASON_PREFIX = 'Hidden because: ';

/** The note stored for a reason. */
export const dismissNote = (id: DismissReasonId): string =>
  REASON_PREFIX + (DISMISS_REASONS.find((r) => r.id === id)?.label ?? '');

/** The reason a choice was hidden for, or null when none was given. */
export function dismissReasonOf(choice: Choice | undefined): string | null {
  const last = [...(choice?.history ?? [])].reverse().find((e) => e.event === 'dismiss');
  const note = last?.note;
  if (!note?.startsWith(REASON_PREFIX)) return null;
  const said = note.slice(REASON_PREFIX.length);
  return DISMISS_REASONS.some((r) => r.label === said) ? said : null;
}
