import type { Turn } from './claude';
import { load as loadOne, clear as clearOne, fit as fitOne, trim, ROOM } from './chatlog';

/**
 * More than one conversation, and the ability to go back to one.
 *
 * ## What was wrong with one
 *
 * The app kept a single transcript, and "start a new conversation" deleted
 * it. That is fine for a question you ask once and act on, and wrong for the
 * thing this is actually used for: a student works out a revision plan with
 * it on Sunday, asks something unrelated on Tuesday, and the Sunday plan is
 * gone. Nothing warned them, because from the app's side nothing was lost —
 * there was only ever one slot.
 *
 * ## What a thread is
 *
 * A list of turns, when it was last touched, and a title taken from the first
 * question. Not a title the student writes: naming a conversation before
 * having it is a chore nobody does, and a thread called "Untitled" in a list
 * of six is worse than no list. The first question is what they would have
 * called it anyway.
 *
 * ## Bounded, twice
 *
 * A transcript is the one thing in this app with no natural size, and now
 * there can be twelve of them. Two limits, and the character one binds first:
 * each thread is trimmed by `chatlog`'s own rule, and the whole set is capped
 * so that a year of use cannot fill the store and start losing writes
 * silently — which this app has done once before.
 *
 * Threads are dropped oldest-first, and never the open one. Losing the
 * conversation you are in the middle of to make room for its own next turn
 * would be the worst possible moment to enforce a limit.
 *
 * ## Its own key, still
 *
 * Not in `semester.v1`, for the reason `chatlog.ts` gives at length: that key
 * is ~240 KB of courses re-serialised on every state change, and hanging a
 * growing transcript off it would put the whole thing through
 * `JSON.stringify` on every keystroke in a note.
 */

const KEY = 'semester.threads.v1';

/** How many conversations are kept. A drawer, not an archive. */
export const MAX_THREADS = 12;

/**
 * How many characters across all of them.
 *
 * Twelve times a single thread's budget would be half a megabyte, which is
 * more than the rest of the app puts in the store put together. This is the
 * number that actually binds, and it binds on the sum rather than per thread
 * so that one long conversation is allowed to be long.
 */
export const ROOM_ALL = 150_000;

export interface Thread {
  id: string;
  /** From the first question, not written by hand. */
  title: string;
  turns: Turn[];
  /** When it was last added to, for ordering and for "3 days ago". */
  at: number;
}

export interface Kept {
  threads: Thread[];
  /** Which one is on screen. May name a thread that no longer exists. */
  openId: string;
  /**
   * Turns the load had to drop from the open thread to fit the window.
   *
   * Carried out of here because this is where it is known. The screen has to
   * say a conversation lost its middle whether that happened on the last turn
   * or three days ago when it was last written — a notice that only appears
   * after the next question is a notice that appears too late to explain the
   * answer that prompted it.
   */
  dropped?: number;
}

/**
 * A title, from the first thing asked.
 *
 * Cut at a word boundary rather than mid-word, because a list of threads is
 * read at a glance and "What should I do about the ECON pro…" is a worse
 * label than one word shorter. Newlines collapse: a pasted question with a
 * blank line in it would otherwise make a two-line row in a list of
 * one-line rows.
 */
export function titleFor(turns: Turn[]): string {
  const first = turns.find((t) => t.role === 'user')?.content.replace(/\s+/g, ' ').trim() ?? '';
  if (first === '') return 'New conversation';
  if (first.length <= 48) return first;
  const cut = first.slice(0, 48);
  const space = cut.lastIndexOf(' ');
  return `${space > 24 ? cut.slice(0, space) : cut}…`;
}

export function blank(): Thread {
  return { id: newId(), title: 'New conversation', turns: [], at: Date.now() };
}

function newId(): string {
  // Time plus a little noise. Two threads made in the same millisecond is not
  // a thing a person can do, but a restored backup landing on the same clock
  // tick is, and an id collision here silently merges two conversations.
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Trim the set to what fits, newest first, never dropping the open one.
 *
 * Exported because it is the rule, and a rule that only runs inside `save`
 * cannot be tested against the case that matters: the open thread being the
 * oldest one.
 */
export function fit(threads: Thread[], openId: string): Thread[] {
  const order = [...threads].sort((a, b) => b.at - a.at);
  const kept: Thread[] = [];
  let size = 0;
  for (const t of order) {
    const turns = trim(t.turns);
    const cost = turns.reduce((n, x) => n + x.content.length, 0);
    const open = t.id === openId;
    if (!open && (kept.length >= MAX_THREADS || size + cost > ROOM_ALL)) continue;
    kept.push({ ...t, turns });
    size += cost;
  }
  /*
   * An empty thread is only worth keeping while it is the open one.
   *
   * Otherwise every visit that opened the chat and typed nothing would leave
   * a "New conversation" row behind, and after a week the list is mostly
   * those. The open one stays because it is the box being typed into.
   */
  return kept.filter((t) => t.turns.length > 0 || t.id === openId);
}

export function save(kept: Kept): void {
  try {
    const threads = fit(kept.threads, kept.openId);
    localStorage.setItem(KEY, JSON.stringify({ threads, openId: kept.openId }));
  } catch {
    // A full store must not lose the answer that is on screen right now.
  }
}

/**
 * Every thread, or a fresh one.
 *
 * Anything malformed is dropped rather than repaired, for the reason
 * `chatlog.load` gives: a half-read transcript would be sent to the model as
 * the conversation so far, and a conversation whose start the student cannot
 * see is worse than an empty box.
 */
export function load(): Kept {
  const migrated = migrate();
  if (migrated) return migrated;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const kept = JSON.parse(raw) as Kept;
    if (!Array.isArray(kept?.threads)) return fresh();
    /** How much each thread lost on the way in, keyed by id. */
    const lost: Record<string, number> = {};
    const threads = kept.threads
      .filter((t): t is Thread => Boolean(t) && typeof t.id === 'string' && Array.isArray(t.turns))
      .map((t) => {
        const clean = t.turns.filter(
          (x): x is Turn =>
            Boolean(x) &&
            (x.role === 'user' || x.role === 'assistant') &&
            typeof x.content === 'string',
        );
        const fitted = fitOne(clean);
        lost[t.id] = fitted.dropped;
        return {
          id: t.id,
          turns: fitted.turns,
          at: typeof t.at === 'number' ? t.at : 0,
          title: '',
        };
      })
      .map((t) => ({ ...t, title: titleFor(t.turns) }));

    if (threads.length === 0) return fresh();
    /*
     * An `openId` naming a thread that is gone opens the newest instead.
     *
     * It happens for a real reason rather than through corruption: the thread
     * you had open was empty, you closed the tab, and `fit` dropped it. The
     * alternative — an empty screen with no thread behind it — is the state
     * every other branch here exists to avoid.
     */
    const openId = threads.some((t) => t.id === kept.openId)
      ? kept.openId
      : [...threads].sort((a, b) => b.at - a.at)[0].id;
    return { threads, openId, dropped: lost[openId] ?? 0 };
  } catch {
    return fresh();
  }
}

function fresh(): Kept {
  const one = blank();
  return { threads: [one], openId: one.id };
}

/**
 * The single conversation the app used to keep, brought across once.
 *
 * Somebody upgrading mid-conversation should find it where they left it, not
 * find an empty box and conclude the app lost it. The old key is removed on
 * the way through, so this runs once and then never again — leaving it would
 * resurrect the same conversation as a new thread on every load.
 */
function migrate(): Kept | null {
  try {
    if (localStorage.getItem(KEY) !== null) return null;
    const old = loadOne();
    if (!old || old.turns.length === 0) return null;
    const one: Thread = {
      id: newId(),
      title: titleFor(old.turns),
      turns: old.turns,
      at: old.at || Date.now(),
    };
    const kept = { threads: [one], openId: one.id };
    save(kept);
    clearOne();
    return kept;
  } catch {
    return null;
  }
}

export function clearAll(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Re-exported so a caller checking room has one place to read it from. */
export { ROOM };
