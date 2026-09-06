import type { Turn } from './claude';

/**
 * Keeping the conversation across leaving the screen.
 *
 * Asking something, tapping into a course to check a date and coming back
 * lost the whole thread. That is a real cost: the second question in a
 * conversation is usually the good one, and having to retype the first to get
 * back to it means people ask one question and stop.
 *
 * ## Its own key, deliberately
 *
 * Not in `semester.v1`. That key holds about 240 KB of courses and is
 * re-serialised whole on every state change — every tick of a box, every
 * keystroke in a note. Hanging a growing chat log off it would put the whole
 * transcript through `JSON.stringify` on every one of those, and the app has
 * already filled a store once. This is separate, small, and written only when
 * the conversation changes.
 *
 * ## Bounded on purpose
 *
 * A transcript is the one thing in this app with no natural size. Two limits,
 * and the character one matters more than the turn one: twenty short turns is
 * nothing and twenty answers about a syllabus is a hundred kilobytes.
 *
 * ## It is not sent anywhere
 *
 * This is a local convenience. The transcript goes to the model as the
 * conversation, exactly as it did before, and nothing here changes what
 * `lib/context.ts` decides may travel.
 */

const KEY = 'semester.ask.v1';

/** How many turns are kept. A conversation, not a history. */
export const TURNS = 20;

/**
 * How many characters are kept, across all turns.
 *
 * About forty thousand — a dozen full answers. The limit that actually binds:
 * twenty turns of "what is due" is a few hundred characters, and twenty turns
 * about a syllabus is a hundred kilobytes.
 */
export const ROOM = 40_000;

export interface Kept {
  turns: Turn[];
  /** When the last question was asked, so a stale thread can be recognised. */
  at: number;
  /** The course the conversation was scoped to, so coming back restores it. */
  courseId: string | null;
}

/**
 * Keep only what fits, newest first, and never a dangling assistant turn.
 *
 * A transcript starting with an answer is one the API refuses — the first
 * message has to be from the user — so trimming from the front has to land on
 * a user turn. Dropping one extra turn is cheaper than a conversation that
 * cannot be resumed.
 */
export function trim(turns: Turn[]): Turn[] {
  let kept = turns.slice(-TURNS);
  let size = kept.reduce((n, t) => n + t.content.length, 0);
  while (kept.length > 0 && size > ROOM) {
    size -= kept[0].content.length;
    kept = kept.slice(1);
  }
  while (kept.length > 0 && kept[0].role !== 'user') kept = kept.slice(1);
  return kept;
}

export function save(kept: Kept): void {
  try {
    const turns = trim(kept.turns);
    if (turns.length === 0) {
      localStorage.removeItem(KEY);
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ ...kept, turns }));
  } catch {
    // A full store must not lose the answer that is on screen right now.
  }
}

/**
 * The conversation as it was left, or nothing.
 *
 * Anything that is not a well-formed transcript is dropped rather than
 * repaired. A half-read one would be sent to the model as the conversation so
 * far, and a conversation the student cannot see the start of is worse than a
 * fresh box.
 */
export function load(): Kept | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const kept = JSON.parse(raw) as Kept;
    if (!Array.isArray(kept?.turns)) return null;
    const turns = kept.turns.filter(
      (t): t is Turn =>
        Boolean(t) &&
        (t.role === 'user' || t.role === 'assistant') &&
        typeof t.content === 'string',
    );
    const ready = trim(turns);
    if (ready.length === 0) return null;
    return {
      turns: ready,
      at: typeof kept.at === 'number' ? kept.at : 0,
      courseId: typeof kept.courseId === 'string' ? kept.courseId : null,
    };
  } catch {
    return null;
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * Whether a kept conversation is old enough to be worth saying so.
 *
 * Coming back an hour later to a thread you have forgotten starting is
 * disorienting in a way coming back after two minutes is not. The screen says
 * when it was, rather than silently deciding for you — a conversation is
 * yours to keep or clear.
 */
export function stale(kept: Kept, now: number): boolean {
  return now - kept.at > 6 * 60 * 60 * 1000;
}
