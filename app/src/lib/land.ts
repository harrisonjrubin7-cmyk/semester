/**
 * Where a notification puts you.
 *
 * A reminder that says "Two days: Problem Set 4" and then drops you on the
 * home screen has done half a job. The student now has to find the thing they
 * were just told about, which is the work the notification existed to save —
 * and on a phone, at the moment they are being reminded of something, is
 * exactly when they have the least patience for it.
 *
 * The service worker already knew how to focus an open tab and post it a
 * destination. Nothing in the app was listening, and no reminder carried a
 * destination to post, so every notification landed on home. This is the half
 * that decides where.
 *
 * ## Read out of the id, not stored twice
 *
 * Every reminder id already says what it is about — `two:2026-09-06:econ-ps4`
 * is a deadline and its item id is in there. Adding a second field to carry
 * the same fact is a second field to get out of step. The ids are built in
 * `notify.ts` and parsed here, and the test in `land.test.ts` builds them with
 * that module's own function so the two cannot drift.
 *
 * ## It refuses rather than guesses
 *
 * A shape it does not recognise lands on home, which is where it landed
 * before. An unknown id is a reminder from an older build sitting in a queue,
 * and sending somebody to a screen picked by a bad parse is worse than the
 * behaviour being replaced.
 */

import type { Screen } from './types';

export interface Landing {
  screen: Screen;
  /** The deadline to open, where the reminder was about one. */
  item?: string;
}

export const HOME: Landing = { screen: 'home' as Screen };

/**
 * Which screen each kind of reminder belongs on.
 *
 * `two` and `exam` are missing on purpose: those name a specific deadline and
 * are handled below, because opening the item beats opening the list it is in.
 */
const BY_RULE: Record<string, Screen> = {
  // A class in fifteen minutes: the day, where the rail shows the room and
  // the walk to it.
  class: 'calendar' as Screen,
  today: 'home' as Screen,
  free: 'home' as Screen,
  // A registrar date — drop, withdraw, add. The registrar screen is the one
  // that says what it costs.
  term: 'registrar' as Screen,
  sun: 'weekly' as Screen,
};

/**
 * Where to go, from a reminder id.
 *
 * Ids are `rule:day:rest`, where `rest` is present only for the reminders that
 * are about one thing. `rest` may itself contain colons — an item id is not
 * guaranteed not to — so it is taken as everything after the second one rather
 * than by splitting into three.
 */
export function landingFor(id: string): Landing {
  if (typeof id !== 'string') return HOME;
  const first = id.indexOf(':');
  if (first < 0) return HOME;
  const rule = id.slice(0, first);
  const second = id.indexOf(':', first + 1);
  const rest = second < 0 ? '' : id.slice(second + 1);

  // The two that name a deadline. Opening it beats opening the list it is in.
  if ((rule === 'two' || rule === 'exam') && rest) {
    return { screen: 'item' as Screen, item: rest };
  }
  const screen = BY_RULE[rule];
  return screen ? { screen } : HOME;
}

/**
 * The same, from what a notification carried.
 *
 * The payload is written by one version of the app and read by whichever is
 * installed when it arrives, so neither field can be trusted to be there.
 */
export function landingFrom(data: unknown): Landing {
  if (!data || typeof data !== 'object') return HOME;
  const d = data as { screen?: unknown; item?: unknown };
  if (typeof d.item === 'string' && d.item) {
    return { screen: 'item' as Screen, item: d.item };
  }
  if (typeof d.screen === 'string' && d.screen) {
    // Trusted only as far as the table above: a screen name arriving from
    // outside is not allowed to name a screen the app does not have.
    const known = Object.values(BY_RULE).includes(d.screen as Screen);
    if (known) return { screen: d.screen as Screen };
  }
  return HOME;
}

/** Whether a landing is worth acting on, or is just "open the app". */
export function worthGoing(l: Landing): boolean {
  return l.screen !== HOME.screen || Boolean(l.item);
}
