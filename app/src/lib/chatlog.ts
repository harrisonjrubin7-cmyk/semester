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
 * What a trim left behind.
 *
 * `dropped` is how many turns are gone, so the screen can say so. A
 * conversation that quietly forgets its middle is one where the model
 * contradicts something you can still see three screens up, and the only
 * explanation is one nobody is given.
 */
export interface Fitted {
  turns: Turn[];
  dropped: number;
}

const size = (turns: Turn[]) => turns.reduce((n, t) => n + t.content.length, 0);

/**
 * Keep the first exchange and the most recent turns, and drop the middle.
 *
 * This used to trim from the front: oldest first, until it fit. That loses the
 * opening exchange, which in a long conversation is the one that set up
 * everything after it — the course being discussed, the exam being planned
 * for, the constraint that makes the rest make sense. Twenty turns later the
 * model has the recent detail and none of the premise, and starts asking again
 * for what it was told first.
 *
 * So the opening question and its answer are kept whatever else goes, and the
 * gap is taken out of the middle, where the material is most likely to have
 * been superseded by the turns that follow it.
 *
 * Two constraints hold throughout. The first message has to be from the user
 * or the API refuses the request, which is why the head is a user turn and the
 * tail is cut back to one. And the head is dropped too rather than kept alone
 * when even it will not fit — a first exchange with nothing after it is not a
 * conversation, it is the wrong half of one.
 */
export function fit(turns: Turn[]): Fitted {
  const capped = turns.slice(-TURNS);
  const lost = turns.length - capped.length;
  if (size(capped) <= ROOM) return { turns: startsRight(capped), dropped: lost };

  // The opening question and the answer to it, when there is one.
  const opens = capped.findIndex((t) => t.role === 'user');
  const head =
    opens === -1
      ? []
      : capped.slice(opens, opens + (capped[opens + 1]?.role === 'assistant' ? 2 : 1));

  // As much of the recent end as the rest of the room allows.
  let tail: Turn[] = [];
  for (let i = capped.length - 1; i > opens + head.length - 1; i -= 1) {
    const next = [capped[i], ...tail];
    if (size(head) + size(next) > ROOM) break;
    tail = next;
  }
  tail = startsRight(tail);

  // Even the opening will not fit beside anything. Keep the recent end, which
  // is the half a person is actually still talking about.
  if (tail.length === 0) {
    let only: Turn[] = [];
    for (let i = capped.length - 1; i >= 0; i -= 1) {
      const next = [capped[i], ...only];
      if (size(next) > ROOM) break;
      only = next;
    }
    const kept = startsRight(only);
    return { turns: kept, dropped: turns.length - kept.length };
  }

  const kept = [...head, ...tail];
  return { turns: kept, dropped: turns.length - kept.length };
}

/** A transcript the API will accept: it begins with a question. */
function startsRight(turns: Turn[]): Turn[] {
  let kept = turns;
  while (kept.length > 0 && kept[0].role !== 'user') kept = kept.slice(1);
  return kept;
}

/** The turns alone, for the callers that only ever wanted those. */
export function trim(turns: Turn[]): Turn[] {
  return fit(turns).turns;
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
