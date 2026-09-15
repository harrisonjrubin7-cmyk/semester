/**
 * The mistakes you are making again, out of the journal you kept.
 *
 * `components/StudyJournal.tsx` has recorded mistakes since it shipped — the
 * topic, what kind of thing went wrong, what you tried, what you learned, and
 * a date to come back to it. Every entry goes in and nothing ever comes out.
 * The panel lists them newest first, which is a filing cabinet rather than a
 * journal: the reason to write down a mistake is that the *next* one rhymes
 * with it, and noticing that is exactly the job a student at 1am cannot do
 * across fourteen entries they wrote over two months.
 *
 * The blueprint asks for it in one line — "detect repeated misconception
 * patterns in a private mistake journal" — and the detecting was the half that
 * was missing.
 *
 * ## Three findings, and silence below the floor
 *
 * Nothing here is a model or a guess. Each finding is arithmetic over what was
 * typed, and each has a floor it will not speak below, for the reason
 * `lib/worked.ts` gives about its own claims: a pattern read off three entries
 * is a coincidence with a confident voice, and a study app that cries pattern
 * at noise teaches a student to ignore it by October.
 *
 * ## The trap in the middle of this, which is the default value
 *
 * "What needs attention" is a `<select>` of eight kinds and it opens on
 * **Concept**. A student who never touches it logs eleven Concept entries, and
 * an app that reads the distribution tells them they keep making conceptual
 * errors — which is not a finding about their learning at all. It is a finding
 * about a dropdown they left alone.
 *
 * So {@link findings} will not report a kind unless the journal shows the
 * student *choosing* kinds: at least two different ones across the entries it
 * is reading. One kind everywhere is the default, whatever that kind happens
 * to be, and there is no way to tell the two apart from the data — so it says
 * nothing rather than saying something it cannot stand behind.
 */

/** What this module needs of a journal entry. Narrow, so a test need not build one. */
export interface Logged {
  courseId: string;
  /** What the student called the problem. Free text, in their words. */
  topic: string;
  /** One of the eight in the picker. `KIND_DEFAULT` is the one it opens on. */
  kind: string;
  resolved: boolean;
  /** The date they set to revisit it — 'yyyy-mm-dd' — or '' for none. */
  review: string;
}

/**
 * The kind the picker opens on.
 *
 * Named here rather than assumed, because the rule above turns on it: if this
 * ever changes in `StudyJournal.tsx`, the trap moves with it and the honest
 * guard is "did they vary the field", which is what is actually implemented.
 * This is carried for the wording only.
 */
export const KIND_DEFAULT = 'Concept';

/** Entries a course needs before a share of them means anything. */
export const ENOUGH = 5;

/** A kind has to be at least this much of the journal, and this many times. */
export const A_SHARE = 1 / 3;
export const LEAST = 3;

/** Distinct kinds the student has to have used before a kind is worth reporting. */
export const VARIED = 2;

/** The shortest topic worth matching another against. */
const MIN_TOPIC = 6;

export type Finding =
  /** One kind of mistake is most of what this course's entries are. */
  | { sort: 'kind'; kind: string; n: number; of: number }
  /** A topic written down again after an earlier entry on it was marked reviewed. */
  | { sort: 'cameback'; topic: string; times: number }
  /** Entries whose revisit date has gone by with nothing done. */
  | { sort: 'overdue'; n: number };

/**
 * A topic reduced to what a person would call the same problem.
 *
 * Case, punctuation and spacing go; words do not. The trade-off is the one
 * `cardKey` in `lib/review.ts` states about its own hashing: **re-word the
 * topic and it is a different topic here.** That is the right failure. Two
 * entries a student wrote in genuinely different words are two problems as far
 * as anything automatic can tell, and guessing otherwise would put "you keep
 * making this mistake" over two unrelated notes.
 */
export function sameTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Whether the journal shows kinds being chosen rather than left alone. */
export function varied(entries: Logged[]): boolean {
  return new Set(entries.map((e) => e.kind)).size >= VARIED;
}

/**
 * What the journal says about one course, strongest finding first.
 *
 * Empty is the ordinary answer for a journal with a few entries in it, and is
 * not a failure: there is nothing to say yet, and the panel says *that*
 * instead of reaching. `today` is 'yyyy-mm-dd' — the same shape the entries
 * store, so the comparison is a string compare and never a timezone.
 */
export function findings(entries: Logged[], courseId: string, today: string): Finding[] {
  const mine = entries.filter((e) => e.courseId === courseId);
  const out: Finding[] = [];

  /*
   * Came back first, because it is the strongest thing the journal can show:
   * the student fixed it, said so, and wrote it down again. Entries arrive
   * newest first, so an earlier entry on the same topic is later in the list.
   */
  const byTopic = new Map<string, Logged[]>();
  for (const e of mine) {
    const key = sameTopic(e.topic);
    if (key.length < MIN_TOPIC) continue;
    const list = byTopic.get(key);
    if (list) list.push(e);
    else byTopic.set(key, [e]);
  }
  for (const [, list] of byTopic) {
    // Written more than once, and an older one was marked reviewed — which is
    // what makes it a mistake that came *back* rather than one note taken
    // twice.
    if (list.length < 2 || !list.slice(1).some((e) => e.resolved)) continue;
    out.push({ sort: 'cameback', topic: list[0].topic, times: list.length });
  }

  if (mine.length >= ENOUGH && varied(mine)) {
    const counts = new Map<string, number>();
    for (const e of mine) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    for (const [kind, n] of counts) {
      if (n >= LEAST && n >= mine.length * A_SHARE) {
        out.push({ sort: 'kind', kind, n, of: mine.length });
      }
    }
  }

  const overdue = mine.filter((e) => !e.resolved && e.review !== '' && e.review < today).length;
  if (overdue > 0) out.push({ sort: 'overdue', n: overdue });

  return out;
}

/** A finding as one sentence, in the app's voice, with its own numbers in it. */
export function says(f: Finding): string {
  switch (f.sort) {
    case 'cameback':
      return `“${f.topic}” is in here ${f.times === 2 ? 'twice' : `${f.times} times`}, and you had marked it reviewed.`;
    case 'kind':
      return `${f.n} of your ${f.of} entries here are ${f.kind.toLowerCase()}.`;
    case 'overdue':
      return `${f.n === 1 ? 'One entry is' : `${f.n} entries are`} past the date you set to come back to ${f.n === 1 ? 'it' : 'them'}.`;
  }
}

/**
 * What to say when there is nothing to say, which is most of a term.
 *
 * It names the count rather than going quiet, because a panel that is silent
 * at four entries and speaks at five looks broken at four. Saying how many it
 * is reading is also the only way a student can tell the difference between
 * "no pattern" and "not looking".
 */
export function nothingYet(entries: Logged[], courseId: string): string {
  const n = entries.filter((e) => e.courseId === courseId).length;
  if (n === 0) return 'Nothing logged for this course yet.';
  if (n < ENOUGH) {
    return `${n === 1 ? 'One entry' : `${n} entries`} so far — too few to call anything a pattern.`;
  }
  if (!varied(entries.filter((e) => e.courseId === courseId))) {
    return `${n} entries, all filed under one kind. Choose the kind as you go and this can say more.`;
  }
  return `${n} entries, and nothing repeating yet.`;
}
