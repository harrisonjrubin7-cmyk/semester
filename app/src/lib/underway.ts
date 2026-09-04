/**
 * The middle state every deadline list pretends does not exist.
 *
 * A tick box has two positions and coursework has three. A paper you have
 * written two pages of is not "not done" in any sense a person recognises, and
 * it is certainly not done — so it sits in the same undifferentiated Ahead list
 * as eleven things you have not opened, and the one fact that would tell you
 * where to spend tonight is the one fact the list does not carry.
 *
 * `lib/progress.ts` solves this for readings, where a page number is a real
 * measure somebody already has in front of them. Nothing measures a paper that
 * way. What can be recorded honestly is the binary that *is* known: you have
 * started, and you have not finished.
 *
 * ## A filter, not a fourth bucket
 *
 * `lib/standing.ts` splits deadlines three ways and every one lands in exactly
 * one. This does not join that split, because the question "what is open right
 * now" cuts across it: a paper started and now overdue is both started and
 * overdue, and moving it out of Overdue to make the partition tidy would hide a
 * miss. So Working is a filter over the same items, and an item can appear
 * there and in Overdue at once. That is not a bug in the model; it is two true
 * things about one paper.
 *
 * ## What it is for, past the tab
 *
 * The useful signal is not the list. It is the item that has been open for
 * eleven days — started, so it is not procrastination in the ordinary sense,
 * and still not finished, which is the shape of a paper that is quietly going
 * wrong. `stalled` finds those. The app can say so while there is still time.
 */

import type { DatedItem } from './types';
import type { DoneMap } from './standing';

/** Deadline id to when work on it began, epoch ms. */
export type StartedMap = Record<string, number>;

/**
 * After this long unfinished, an open item is worth mentioning.
 *
 * Ten days rather than three. Something started on Monday and unfinished on
 * Thursday is a normal week; the app saying so would be noise, and an app that
 * is noise about the ordinary gets ignored about the serious.
 */
export const STALLED_AFTER_DAYS = 10;

export function isUnderway(id: string, started: StartedMap, done: DoneMap): boolean {
  return Boolean(started[id]) && !done[id];
}

/** Everything open right now, longest-open first. */
export function underway(items: DatedItem[], started: StartedMap, done: DoneMap): DatedItem[] {
  return items
    .filter((i) => isUnderway(i.id, started, done))
    .sort((a, b) => (started[a.id] ?? 0) - (started[b.id] ?? 0));
}

/** How many days something has been open. */
export function openFor(id: string, started: StartedMap, now: number): number {
  const at = started[id];
  if (!at) return 0;
  // Clamped: the store zeroes seconds on its clock while a mark is stamped
  // with the real instant, which made a thing started this minute read as -1.
  return Math.max(0, Math.floor((now - at) / 86_400_000));
}

/**
 * Open a long time and still not finished.
 *
 * The one worth interrupting somebody about. Deliberately not "started and
 * due soon" — that is just work, and the app already shows it.
 */
export function stalled(
  items: DatedItem[],
  started: StartedMap,
  done: DoneMap,
  now: number,
  after = STALLED_AFTER_DAYS,
): DatedItem[] {
  return underway(items, started, done).filter((i) => openFor(i.id, started, now) >= after);
}

/** Marking one, or unmarking it. Returns a new map rather than mutating. */
export function toggle(id: string, started: StartedMap, at: number): StartedMap {
  if (started[id]) {
    const next = { ...started };
    delete next[id];
    return next;
  }
  return { ...started, [id]: at };
}

/**
 * How long one has been open, in words.
 *
 * "Started today" rather than "0 days", because zero days is not a thing
 * anybody says and reads as an error.
 */
export function openLine(id: string, started: StartedMap, now: number): string {
  if (!started[id]) return '';
  const days = openFor(id, started, now);
  if (days === 0) return 'Started today';
  if (days === 1) return 'Open since yesterday';
  return `Open ${days} days`;
}

/**
 * The sentence over the list.
 *
 * It names the stalled ones rather than only counting them, because "3 open"
 * is a number and "one of them since the 2nd" is a reason to do something.
 */
export function underwayLine(
  items: DatedItem[],
  started: StartedMap,
  done: DoneMap,
  now: number,
): string {
  const open = underway(items, started, done);
  if (open.length === 0) {
    return 'Nothing marked as started. The button on any deadline marks it, and it stays here until you tick it off.';
  }
  const old = stalled(items, started, done, now);
  const count = `${open.length} ${open.length === 1 ? 'thing is' : 'things are'} open.`;
  if (old.length === 0) return `${count} Nothing has been sitting long.`;
  const longest = old[0];
  const days = openFor(longest.id, started, now);
  if (old.length === 1) {
    return `${count} ${longest.title} has been open ${days} days.`;
  }
  return `${count} ${old.length} of them for over ${STALLED_AFTER_DAYS} days — the oldest is ${longest.title}, at ${days}.`;
}

/** Stored values made safe. */
export function readStarted(raw: unknown): StartedMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: StartedMap = {};
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof at === 'number' && at > 0) out[id] = at;
  }
  return out;
}
