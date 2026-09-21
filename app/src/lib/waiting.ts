/**
 * What other people left for you, totalled across the rooms.
 *
 * `roomchat.ts` already counts the unread in a room and already knows which of
 * those messages name you — `unread` does both, and `listed` puts the two
 * numbers on every row. Nothing read them outside the Classmates screen, so
 * the counts existed and could not be seen: somebody answered your question in
 * ECON 1020 and the only way to find out was to guess that they might have and
 * go and look.
 *
 * That is the one direction the app was missing. It is very good at *your*
 * semester — what is due, what it weighs, what you have not ticked — and had
 * no way at all to say *somebody is waiting on you*. A student closes an app
 * that only ever describes their own workload back to them; they reopen one
 * that tells them a person did something.
 *
 * ## It counts other people, never you
 *
 * Everything here is a count of what somebody else did. That is the reason it
 * is allowed to be a number at all, under the second of `lib/you.ts`'s three
 * rules — *nothing is a score*. "Four messages waiting" is a fact about four
 * other people. "Four days running" would be a verdict on the reader, and this
 * file must never grow one: no streak, no reply rate, no comparison with the
 * rest of the room, and no measure of how long you took to answer.
 *
 * The third rule applies as written: `waitingLine` is empty when nothing is
 * waiting, and the caller draws nothing rather than a nought.
 *
 * ## Three things are deliberately not counted
 *
 * **A room you muted.** Muting is the student saying *do not tell me about
 * this one*, and a total that quietly includes it is the app overruling them
 * somewhere they cannot see. `roomprefs.ts` keeps the flag per device, which
 * is the right place for it, and this honours it.
 *
 * **A room you have not joined.** `listed` includes those so the list can also
 * be how you join one — a room you are not in yet is an offer, and traffic in
 * it is not waiting for you. Counting it would tell somebody they were behind
 * on a class they are not in.
 *
 * **Your own messages.** `unread` already drops them, for the reason it gives:
 * a count that goes up when you say something is a count nobody trusts again.
 *
 * ## Being named outranks volume
 *
 * Forty messages nobody addressed to you is a room that was busy. One that
 * says your handle is a person waiting on an answer, and it is the only one of
 * the two worth interrupting somebody for. So mentions sort first and the
 * sentence leads with them, and a room is never ordered above another for
 * being *louder*.
 *
 * Pinning is not part of that order, although `listed` sorts by it. Pinned is
 * a decision about where a row sits in a list you are already reading; this
 * answers "what should bring you back", and those are different questions. A
 * pinned room with nothing new in it has nothing to say here.
 */

import type { Listed } from './roomchat';

/** The rooms with something in them, and the two totals across those rooms. */
export interface Waiting {
  /** Countable rooms, the ones most worth returning for first. */
  rooms: Listed[];
  /** Unread messages across them, from other people. */
  count: number;
  /** How many of those name you. */
  mentions: number;
}

/** Whether a row is somebody waiting on this student, rather than noise. */
function counts(row: Listed): boolean {
  return row.joined && !row.muted && row.unread > 0;
}

/**
 * The rooms with something waiting, most worth returning for first.
 *
 * Named before volume, then by what happened most recently, then by code so
 * the order is stable when two rooms are otherwise equal. A stable tail
 * matters more than it looks: without it two rooms with the same timestamp
 * swap places between renders and the line under them rewrites itself while
 * somebody is reading it.
 */
export function waiting(rows: Listed[]): Waiting {
  const rooms = rows.filter(counts).sort((a, b) => {
    const named = (r: Listed) => (r.mentions > 0 ? 1 : 0);
    if (named(a) !== named(b)) return named(b) - named(a);
    if (a.mentions !== b.mentions) return b.mentions - a.mentions;
    if (a.at !== b.at) return b.at - a.at;
    return a.code.localeCompare(b.code);
  });

  return {
    rooms,
    count: rooms.reduce((n, r) => n + r.unread, 0),
    mentions: rooms.reduce((n, r) => n + r.mentions, 0),
  };
}

/**
 * The one line, or nothing at all.
 *
 * Nothing waiting is an empty string rather than "You are all caught up",
 * which is a sentence that takes up a permanent row to say that a row was not
 * needed. The caller drops it.
 *
 * Where you are named, the line says so and names the room rather than the
 * person: `Listed` carries the code and a preview, not a mention's author, and
 * a sentence claiming who it was would be a claim this cannot check.
 */
export function waitingLine(w: Waiting): string {
  if (w.count === 0) return '';

  if (w.mentions > 0) {
    const named = w.rooms.filter((r) => r.mentions > 0);
    const who = w.mentions === 1 ? 'A message names you' : `${w.mentions} messages name you`;
    return named.length === 1 ? `${who} in ${named[0].code}.` : `${who}, across ${named.length} rooms.`;
  }

  if (w.rooms.length === 1) return `${w.count} new in ${w.rooms[0].code}.`;
  return `${w.count} new, across ${w.rooms.length} rooms.`;
}

/**
 * Where the line goes when it is tapped: the room most worth opening.
 *
 * Null when nothing is waiting, so a caller cannot build a link to nowhere.
 */
export function waitingRoom(w: Waiting): string | null {
  return w.rooms[0]?.code ?? null;
}
