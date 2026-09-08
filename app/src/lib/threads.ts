import type { Turn } from './claude';
import { load as loadOne, clear as clearOne, fit as fitOne, trim, ROOM } from './chatlog';
import { newId as makeId } from './idb';

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
 * ## Bounded, twice, and then kept anyway
 *
 * A transcript is the one thing in this app with no natural size, and now
 * there can be a hundred of them. Two limits, and the character one binds
 * first: each thread is trimmed by `chatlog`'s own rule, and the whole set is
 * capped so that a year of use cannot fill the store and start losing writes
 * silently — which this app has done once before.
 *
 * What changed is what happens at the limit. Threads used to be *dropped*
 * oldest-first, which meant the cap was a delete button nobody pressed: the
 * revision plan from week three went in week eight, in the middle of a term,
 * with no notice, because a twelfth conversation had been started. Now the
 * oldest come out of the list and go into an archive under their own key —
 * out of the way, off the hot path, and still there.
 *
 * The open thread is never one of them. Losing the conversation you are in the
 * middle of to make room for its own next turn would be the worst possible
 * moment to enforce a limit.
 *
 * ## Its own key, still
 *
 * Not in `semester.v1`, for the reason `chatlog.ts` gives at length: that key
 * is ~240 KB of courses re-serialised on every state change, and hanging a
 * growing transcript off it would put the whole thing through
 * `JSON.stringify` on every keystroke in a note.
 */

const KEY = 'semester.threads.v1';

/**
 * Where a conversation goes instead of being deleted.
 *
 * Its own key, and read only when somebody asks for it. That is the whole
 * reason the archive can be generous: the active list is re-serialised on
 * every question, and this is written when something falls out of it and read
 * when the older list is opened. Cost where it is paid, not everywhere.
 */
const ARCHIVE_KEY = 'semester.threads.archive.v1';

/**
 * How many conversations stay in the list.
 *
 * Twelve, once — a drawer. Twelve is about six weeks of use, which meant the
 * cap was doing its work in the middle of a term rather than at the end of
 * one, and what it did was delete. A hundred is past the point where the count
 * decides anything; `ROOM_ALL` below is what actually binds now, and nothing
 * that falls out of either is lost.
 */
export const MAX_THREADS = 100;

/**
 * How many characters across all of them.
 *
 * The number that actually binds, and it binds on the sum rather than per
 * thread so that one long conversation is allowed to be long. Unchanged when
 * the count went to a hundred, deliberately: raising both would have made a
 * key the app re-serialises on every keystroke several times larger, which is
 * the thing this file has always been most careful about.
 */
export const ROOM_ALL = 150_000;

/**
 * The same two limits again, for the archive.
 *
 * Larger, because nothing reads this on the hot path — but still limits. An
 * archive with no bound is a store that fills in a year and starts losing
 * writes silently, which is the failure this whole file exists to avoid, moved
 * one drawer down rather than fixed.
 */
export const MAX_ARCHIVE = 100;
export const ROOM_ARCHIVE = 200_000;

export interface Thread {
  id: string;
  /** From the first question, not written by hand. See `nameOf`. */
  title: string;
  /**
   * A name the reader typed, which beats the derived one.
   *
   * Separate from `title` rather than overwriting it, because `title` is
   * recomputed from the turns on every change — a name written into it would
   * survive exactly until the next question and then vanish, which is the
   * worst way for a rename to fail. Absent on a thread nobody has named, which
   * is almost all of them.
   */
  name?: string;
  turns: Turn[];
  /** When it was last added to, for ordering and for "3 days ago". */
  at: number;
  /**
   * Kept at the top, and kept at all.
   *
   * Pinning does two things and the second is the one that matters: a pinned
   * thread is not dropped to make room. The revision plan worked out in week
   * three is exactly the conversation the cap would quietly move out of the
   * list in week eight, and it is exactly the one worth keeping.
   */
  pinned?: boolean;
  /**
   * The screen it was started from, as a `lib/nav.ts` screen id.
   *
   * A conversation begun on Grades and one begun on Today read alike in a
   * list — both are called by their first question, and "what should I do
   * about this" is a question you ask on several screens about several things.
   * Where it was asked is the cheapest thing that tells them apart, and it is
   * known for free at the moment of asking.
   *
   * Set once, from where the first question was sent, and never updated. A
   * thread is *from* somewhere; it is not wherever you last happened to be.
   */
  from?: string;
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

/** What a thread is called: the name if it has one, otherwise the question. */
export function nameOf(t: Thread): string {
  return t.name?.trim() || t.title;
}

/**
 * Where it was started, in words, or nothing.
 *
 * Takes the lookup rather than importing `lib/nav.ts`, which would pull the
 * whole 59-screen directory into a module the chat log has no other reason to
 * depend on. The caller has it already.
 *
 * Nothing, rather than the raw id, when the screen is unknown: a row reading
 * "from grade-projection" is worse than a row that says where it came from
 * only when it can say it properly. Threads from before this existed have no
 * `from` at all, and that is the same case.
 */
export function startedOn(t: Thread, labelFor: (screen: string) => string | undefined): string {
  return (t.from && labelFor(t.from)) || '';
}

export function blank(): Thread {
  return { id: newId(), title: 'New conversation', turns: [], at: Date.now() };
}

function newId(): string {
  // The prefix is the whole difference from every other id in the app, and
  // `lib/idb.ts` takes it as an argument. The reason it wants one is still
  // worth keeping: two threads made in the same millisecond is not something
  // a person can do, but a restored backup landing on the same clock tick is,
  // and an id collision here silently merges two conversations.
  return makeId('t');
}

/**
 * Trim the set to what fits, newest first, never dropping the open one.
 *
 * Exported because it is the rule, and a rule that only runs inside `save`
 * cannot be tested against the case that matters: the open thread being the
 * oldest one.
 */
export interface Fitted {
  /** What stays in the list. */
  kept: Thread[];
  /**
   * What came out of it, whole, for the archive.
   *
   * The point of the change: this used to be the return value of a `continue`
   * and nothing else. A conversation over the limit was gone, and the only
   * notice was that it was not there any more.
   */
  shed: Thread[];
}

/** The kept half alone, for the callers that only ever wanted those. */
export function fit(threads: Thread[], openId: string): Thread[] {
  return sift(threads, openId).kept;
}

export function sift(threads: Thread[], openId: string): Fitted {
  /*
   * Pinned first, then newest.
   *
   * The order here is the order things are kept in, not the order they are
   * shown in, and that is the whole mechanism: what is considered first is
   * what survives the cap. A pinned thread is a thread somebody said to keep,
   * so it is considered before every unpinned one however old it is.
   *
   * It is still not unconditional. Pinning enough enormous conversations to
   * exceed `ROOM_ALL` drops the oldest of them rather than the store failing
   * to write — a promise the code cannot keep is worse than a limit it states.
   */
  const order = [...threads].sort(
    (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.at - a.at,
  );
  const kept: Thread[] = [];
  const shed: Thread[] = [];
  let size = 0;
  for (const t of order) {
    const turns = trim(t.turns);
    const cost = turns.reduce((n, x) => n + x.content.length, 0);
    const open = t.id === openId;
    if (!open && (kept.length >= MAX_THREADS || size + cost > ROOM_ALL)) {
      shed.push({ ...t, turns });
      continue;
    }
    kept.push({ ...t, turns });
    size += cost;
  }
  /*
   * An empty thread is only worth keeping while it is the open one.
   *
   * Otherwise every visit that opened the chat and typed nothing would leave
   * a "New conversation" row behind, and after a week the list is mostly
   * those. The open one stays because it is the box being typed into.
   *
   * Those are dropped rather than archived, for the same reason: an archive of
   * conversations nobody had is not a record of anything.
   */
  return {
    kept: kept.filter((t) => t.turns.length > 0 || t.id === openId),
    shed: shed.filter((t) => t.turns.length > 0),
  };
}

/**
 * The older conversations, newest first.
 *
 * Malformed entries are dropped rather than repaired, as everywhere else in
 * this file — but note the difference in stakes: a half-read archive row is a
 * row in a list, not a transcript about to be sent to the model.
 */
export function loadArchive(): Thread[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Thread[];
    if (!Array.isArray(all)) return [];
    return all
      .filter((t): t is Thread => Boolean(t) && typeof t.id === 'string' && Array.isArray(t.turns))
      .map((t) => ({ ...t, title: titleFor(t.turns) }));
  } catch {
    return [];
  }
}

/**
 * Put conversations in the archive, newest first, inside its own limits.
 *
 * Re-archiving one already there replaces it rather than doubling it, which
 * happens for a real reason: restore a thread, ask one more question, and it
 * falls out again.
 */
export function archive(older: Thread[]): Thread[] {
  const byId = new Map<string, Thread>();
  for (const t of [...older, ...loadArchive()]) if (!byId.has(t.id)) byId.set(t.id, t);
  const order = [...byId.values()].sort((a, b) => b.at - a.at);

  const kept: Thread[] = [];
  let size = 0;
  for (const t of order) {
    const cost = t.turns.reduce((n, x) => n + x.content.length, 0);
    if (kept.length >= MAX_ARCHIVE || size + cost > ROOM_ARCHIVE) break;
    kept.push(t);
    size += cost;
  }
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(kept));
  } catch {
    // The archive is the thing that may be lost when the store is full. It is
    // already the older half, and losing it must not cost the open answer.
  }
  return kept;
}

/** Take one back out, so it can go into the list again. */
export function unarchive(id: string): Thread | null {
  const all = loadArchive();
  const one = all.find((t) => t.id === id);
  if (!one) return null;
  try {
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(all.filter((t) => t.id !== id)));
  } catch {
    /* nothing to do — it is about to be in the list instead */
  }
  return one;
}

export function save(kept: Kept): void {
  try {
    const { kept: threads, shed } = sift(kept.threads, kept.openId);
    localStorage.setItem(KEY, JSON.stringify({ threads, openId: kept.openId }));
    // After the write that matters, not before: a full store should cost the
    // archive rather than the conversation on screen.
    if (shed.length > 0) archive(shed);
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
          ...(typeof t.name === 'string' && t.name.trim() ? { name: t.name.trim() } : {}),
          ...(t.pinned ? { pinned: true as const } : {}),
          ...(typeof t.from === 'string' && t.from ? { from: t.from } : {}),
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
    // "Wipe every conversation" has to mean the older ones too. An archive
    // that survives a wipe is the opposite of what the button promises.
    localStorage.removeItem(ARCHIVE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Re-exported so a caller checking room has one place to read it from. */
export { ROOM };

/**
 * The threads a query names, in the order they should be read.
 *
 * Matches what a thread is called *and* what was said in it, because the
 * reason to search a conversation list is usually a half-remembered answer
 * rather than a title nobody wrote. Pinned first and newest after, the same
 * order the list is in when nothing is typed — a search that reorders the
 * whole list makes the reader re-find their bearings on every keystroke.
 *
 * Case and spacing are ignored on both sides. A blank query is every thread,
 * not none: an empty box means "no filter", never "no results".
 */
export function search(threads: Thread[], query: string): Thread[] {
  const order = [...threads].sort(
    (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.at - a.at,
  );
  const q = flatten(query);
  if (!q) return order;
  return order.filter((t) => {
    if (flatten(nameOf(t)).includes(q)) return true;
    return t.turns.some((turn) => flatten(turn.content).includes(q));
  });
}

/** Lower-cased and single-spaced, so a query matches across a line break. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Where a query was found, for the row that matched on its content.
 *
 * A list of five rows all called "New conversation", one of which matched
 * because of something said in the middle of it, is a list you have to open
 * five times. This is the line under the title saying which one it was.
 */
export function foundIn(t: Thread, query: string): string {
  const q = flatten(query);
  if (!q || flatten(nameOf(t)).includes(q)) return '';
  for (const turn of t.turns) {
    const flat = flatten(turn.content);
    const at = flat.indexOf(q);
    if (at === -1) continue;
    const from = Math.max(0, at - 24);
    const cut = flat.slice(from, at + q.length + 40);
    return `${from > 0 ? '…' : ''}${cut}${at + q.length + 40 < flat.length ? '…' : ''}`;
  }
  return '';
}

/**
 * Which heading a conversation belongs under in the list.
 *
 * A list of forty conversations sorted by time is a list you scroll rather
 * than one you scan: every row says "3 days ago" in small grey text and none
 * of them says where the boundary is. Four buckets give the eye somewhere to
 * stop, and they are the ones people already read in every chat app they use.
 *
 * Day boundaries, not elapsed hours. Something asked at eleven last night is
 * "Yesterday" at nine this morning, not "10 hours ago" — the question a
 * reader is answering is *which day was that*, and elapsed time answers a
 * different one badly.
 *
 * Pinned threads are not bucketed. They are lifted out above all of these,
 * because pinning is a statement that a thread should not sink, and sorting
 * it back into last Tuesday would undo exactly that.
 */
export type Bucket = 'Today' | 'Yesterday' | 'Previous 7 days' | 'Older';

export function bucket(at: number, now: number): Bucket {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const startOfToday = midnight.getTime();
  const day = 86_400_000;
  if (at >= startOfToday) return 'Today';
  if (at >= startOfToday - day) return 'Yesterday';
  // Seven days back from the start of today, so "Previous 7 days" is seven
  // whole days rather than a window that shrinks as the day goes on.
  if (at >= startOfToday - 7 * day) return 'Previous 7 days';
  return 'Older';
}

/**
 * The list, in the order it is drawn: pinned, then a heading per bucket.
 *
 * Returned as pairs rather than a map so the order is the return value's own
 * rather than something every caller has to know. A bucket with nothing in it
 * is left out entirely — a heading over no rows is a list that looks broken.
 */
export function grouped(
  threads: Thread[],
  now: number,
): { label: string; threads: Thread[] }[] {
  const pinned = threads.filter((t) => t.pinned);
  const rest = threads.filter((t) => !t.pinned);
  const order: Bucket[] = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
  const out: { label: string; threads: Thread[] }[] = [];
  if (pinned.length > 0) out.push({ label: 'Pinned', threads: pinned });
  for (const label of order) {
    const its = rest.filter((t) => bucket(t.at, now) === label);
    if (its.length > 0) out.push({ label, threads: its });
  }
  return out;
}
