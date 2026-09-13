/**
 * What this device remembers about a class room: pinned, muted, and how far
 * you had read.
 *
 * All three are decisions about a list on a screen, not facts about the room,
 * and they are kept here rather than in the account for the reason the app
 * keeps most things on the device: none of them is anybody else's business.
 * Pinning ECON 1020 is not something the other forty people in it should be
 * able to read, and a read mark is a record of when you were looking at your
 * phone.
 *
 * The cost is that they do not follow you to a second device, and that is the
 * right trade for what they are — a phone and a laptop genuinely do have
 * different lists of what is at hand.
 *
 * The store is not the home for this. `state/shape.ts` is the semester: the
 * courses, the deadlines, the work. This is three booleans per room that only
 * one screen reads, and it is written on every open — the same reason
 * `lib/threads.ts` keeps the assistant's conversations in their own key.
 */

import { NO_MARK, type Mark } from './roomchat';

/** `semester.` because `lib/erase.ts` clears by that prefix and nothing else. */
const KEY = 'semester.rooms.v1';

export type Marks = Record<string, Mark>;

/**
 * A stored blob, made safe.
 *
 * Anything unrecognised becomes an empty set of marks rather than throwing:
 * the worst this can cost is a room that looks unvisited, and a chat list that
 * refuses to draw because a key from an older version is the wrong shape is the
 * one outcome not worth defending against corruption.
 */
export function parse(raw: string | null): Marks {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out: Marks = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const mark = value as Partial<Mark>;
      out[key] = {
        pinned: mark.pinned === true,
        muted: mark.muted === true,
        read: typeof mark.read === 'string' ? mark.read : '',
      };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * One room's mark, changed.
 *
 * Pure, and separate from the write, because everything worth getting right
 * here is in this function: a read mark only ever moves forward. Two tabs open
 * on the same room would otherwise take turns marking each other unread — the
 * one showing the older message writes its own timestamp and the count comes
 * back.
 */
export function change(marks: Marks, key: string, patch: Partial<Mark>): Marks {
  const was = marks[key] ?? NO_MARK;
  const read =
    patch.read === undefined
      ? was.read
      : new Date(patch.read).getTime() > new Date(was.read || 0).getTime()
        ? patch.read
        : was.read;
  return { ...marks, [key]: { ...was, ...patch, read } };
}

/** Every mark this device holds. */
export function marks(): Marks {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return {};
  }
}

/** One room's, or the default for a room nobody has opened. */
export function markFor(key: string): Mark {
  return marks()[key] ?? NO_MARK;
}

/** Change one room's mark and hand back the whole set, so a caller can re-render. */
export function remember(key: string, patch: Partial<Mark>): Marks {
  const next = change(marks(), key, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store costs a pin, not the conversation. The screen
    // keeps what it was handed either way.
  }
  return next;
}

/** Read up to here. Called when a room is open and the newest message is on screen. */
export function markRead(key: string, iso: string): Marks {
  return remember(key, { read: iso });
}
