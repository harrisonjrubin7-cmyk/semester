/**
 * How long things actually take *you*.
 *
 * The week ahead has always counted the hours you promised other people —
 * classes, shifts, meetings — and stopped there, because the other half of the
 * question needs a number the app did not have. Five assignments of unknown
 * size sitting next to "nine hours spare" is not a plan; it is two facts that
 * refuse to be compared. `lib/ahead.ts` said as much in its own header: the
 * app "does not know and cannot find out" how long a paper takes.
 *
 * It can find out. It can ask you, once, at the only moment you know the
 * answer — the moment you tick the box.
 *
 * ## Four buckets, not a stopwatch
 *
 * The question is four taps wide and appears once per ticked item. Anything
 * finer would be answered accurately for a week and then guessed, and a
 * guessed forty-seven minutes is worth less than an honest "about an hour".
 *
 * ## The median, and never a default
 *
 * An estimate is the median of what you reported for that course and that kind
 * of work, because one all-nighter should not move it. Where there is nothing
 * to go on the app says so and contributes zero, rather than reaching for an
 * average of everything or a number off a syllabus. The count of things it
 * could not estimate travels with every forecast, so a figure is never
 * mistaken for the whole picture — the same rule `studyAsked` already follows.
 *
 * Nothing here is a productivity score, and there is no comparison with
 * anybody else. It is your own pace, told back to you.
 */

/** What one tap means, in minutes. */
export interface Bucket {
  id: string;
  label: string;
  minutes: number;
}

/**
 * Deliberately uneven. Real coursework clusters at "a bit" and "an evening"
 * and has a long tail, so even buckets would put four fifths of everything in
 * the first two.
 */
export const BUCKETS: Bucket[] = [
  { id: 'quick', label: 'Under 30 min', minutes: 20 },
  { id: 'hour', label: 'About an hour', minutes: 60 },
  { id: 'few', label: 'Two or three hours', minutes: 150 },
  { id: 'evening', label: 'Most of an evening', minutes: 300 },
  { id: 'days', label: 'More than a day', minutes: 600 },
];

export function bucket(id: string): Bucket | undefined {
  return BUCKETS.find((b) => b.id === id);
}

/** One piece of work, and how long it took. */
export interface Spent {
  /** The deadline it was reported against, so it is only ever asked once. */
  id: string;
  courseId: string;
  /** The kind of work, normalised. See `normalKind`. */
  kind: string;
  minutes: number;
  /**
   * What you thought it would take, in minutes, said before you started.
   *
   * Absent on every report made without one, which is most of them — it is
   * only asked at the moment a work session begins. It is here rather than
   * derived because a guess is a thing to be asked for: the app's own estimate
   * is the median of these very reports, so scoring that against them measures
   * nothing. See `lib/worth.ts`.
   */
  guess?: number;
  /** Epoch ms, so an old semester's pace can be aged out later if it matters. */
  at: number;
}

/**
 * A kind of work, reduced to something two items can share.
 *
 * Syllabi write "Problem Set 4", "PS4", "Problem sets" and "Homework 4" for
 * the same thing. Without this every item would be its own category of one and
 * nothing would ever have enough evidence behind it to estimate.
 */
export function normalKind(kind: string): string {
  const k = kind.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const groups: [RegExp, string][] = [
    // `ps` on its own is here because "PS4" loses its digit to the strip
    // above and arrives as a bare "ps" — which is how half of every economics
    // syllabus writes a problem set.
    [/problem set|pset|\bps\b|homework|\bhw\b/, 'problem set'],
    [/read(ing)?|chapter/, 'reading'],
    [/quiz/, 'quiz'],
    [/midterm|final|exam|test/, 'exam'],
    [/essay|paper|memo|write|writing|draft/, 'essay'],
    [/lab\b/, 'lab'],
    [/present|deck|slides|talk/, 'presentation'],
    [/reflect|response|journal|discussion|post/, 'response'],
    [/project|case/, 'project'],
  ];
  for (const [re, name] of groups) if (re.test(k)) return name;
  return k || 'other';
}

function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export interface Estimate {
  /** Minutes. Zero when there is nothing to go on. */
  minutes: number;
  /** How many reports it rests on. Zero means the app is guessing nothing. */
  from: number;
  /**
   * Where it came from — this course's own history, or the same kind of work
   * across your courses. Blank when there is no estimate at all.
   */
  basis: '' | 'course' | 'kind';
}

const NOTHING: Estimate = { minutes: 0, from: 0, basis: '' };

/**
 * What a piece of work is likely to take, on your evidence alone.
 *
 * This course first, because an ECON problem set and a PSCI one are different
 * animals however similarly they are named. Failing that, the same kind of work
 * anywhere — three essays is three essays. Failing that, nothing: no
 * cross-kind average, no syllabus figure, no default.
 */
export function estimate(spent: Spent[], courseId: string, kind: string): Estimate {
  const k = normalKind(kind);
  const mine = spent.filter((s) => s.courseId === courseId && s.kind === k);
  if (mine.length > 0) {
    return { minutes: median(mine.map((s) => s.minutes)), from: mine.length, basis: 'course' };
  }
  const anywhere = spent.filter((s) => s.kind === k);
  if (anywhere.length > 0) {
    return { minutes: median(anywhere.map((s) => s.minutes)), from: anywhere.length, basis: 'kind' };
  }
  return NOTHING;
}

export interface Forecast {
  /** Hours the estimable work is likely to take. */
  hours: number;
  /** How many of the things given could be estimated. */
  covered: number;
  /** How many could not, and so contribute nothing to `hours`. */
  unknown: number;
}

/** A list of work, totalled. Anything with no basis is counted, not guessed. */
export function forecast(
  spent: Spent[],
  work: { c: string; kind: string }[],
): Forecast {
  let minutes = 0;
  let covered = 0;
  for (const w of work) {
    const e = estimate(spent, w.c, w.kind);
    if (e.from === 0) continue;
    minutes += e.minutes;
    covered++;
  }
  return {
    hours: Math.round((minutes / 60) * 10) / 10,
    covered,
    unknown: work.length - covered,
  };
}

/**
 * Whether to ask about this one.
 *
 * Not if it has been answered, and not once the app has enough to be useful —
 * five reports of the same kind in the same course is a stable median, and
 * asking a sixth time is the app taking a tap and giving nothing back. This is
 * the whole reason the prompt does not become furniture.
 */
export function askAbout(spent: Spent[], id: string, courseId: string, kind: string): boolean {
  if (spent.some((s) => s.id === id)) return false;
  const k = normalKind(kind);
  return spent.filter((s) => s.courseId === courseId && s.kind === k).length < 5;
}

/**
 * A record, from a tapped bucket or a measured session.
 *
 * A bucket id becomes its bucket's minutes; a number is taken as measured.
 * The two are the same shape on purpose — `estimate` takes a median and does
 * not care where a figure came from, so a term with some timed sessions and
 * some tapped buckets is better served than one with either alone.
 *
 * Returns null for a bucket that is not one, and for a measured figure that
 * is not a positive finite number of minutes. A stopped clock, a device whose
 * time moved backwards, or a hand-edited store all arrive here, and any of
 * them would sit in the median for the rest of the term.
 */
export function record(
  id: string,
  courseId: string,
  kind: string,
  from: string | number,
  at: number,
  guess?: number,
): Spent | null {
  const minutes =
    typeof from === 'number' ? from : bucket(from)?.minutes;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;
  const row: Spent = { id, courseId, kind: normalKind(kind), minutes: Math.round(minutes), at };
  // Only where there was one. A zero guess is not a guess of zero.
  if (typeof guess === 'number' && Number.isFinite(guess) && guess > 0) {
    row.guess = Math.round(guess);
  }
  return row;
}

/**
 * The sentence the week ahead earns from all this.
 *
 * Says what it covered and what it could not, in that order, because the
 * second half is what stops the first from being read as the whole week. Both
 * halves are counts.
 */
export function askedLine(f: Forecast): string {
  if (f.covered === 0 && f.unknown === 0) return '';
  if (f.covered === 0) {
    return `Nothing due this week is work you have timed yet, so there is no estimate to give.`;
  }
  const all = f.covered + f.unknown;
  // "across 1 of the 1 things due" is arithmetic read aloud. One thing gets a
  // sentence of its own rather than a fraction of itself.
  if (all === 1) return `About ${showSpan(f.hours)} for the one thing due.`;
  if (f.unknown === 0) {
    return `About ${showSpan(f.hours)} of coursework, across all ${all} things due.`;
  }
  const head = `About ${showSpan(f.hours)} of coursework, across ${f.covered} of the ${all} things due`;
  return `${head} — the other ${f.unknown} ${
    f.unknown === 1 ? 'is a kind of work' : 'are kinds of work'
  } you have not timed before.`;
}

/** Hours, rounded the way an estimate deserves rather than to a decimal. */
export function showSpan(hours: number): string {
  if (hours <= 0) return 'no time';
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  const half = Math.round(hours * 2) / 2;
  const whole = Number.isInteger(half) ? String(half) : half.toFixed(1);
  return `${whole} ${half === 1 ? 'hour' : 'hours'}`;
}

/**
 * What you have learned about yourself, for the screen that shows it back.
 *
 * One row per course-and-kind that has any evidence, busiest first. Rows with
 * a single report are included and marked as such — hiding them would make the
 * list look more certain than it is.
 */
export interface PaceRow {
  courseId: string;
  kind: string;
  minutes: number;
  from: number;
}

export function learned(spent: Spent[]): PaceRow[] {
  // Keyed on the pair rather than on a joined string. A normalised kind has
  // spaces in it ("problem set"), so splitting a key back apart would file
  // every one of those under "problem".
  const groups = new Map<string, { courseId: string; kind: string; rows: Spent[] }>();
  for (const s of spent) {
    const key = `${s.courseId} ${s.kind}`;
    const held = groups.get(key) ?? { courseId: s.courseId, kind: s.kind, rows: [] };
    held.rows.push(s);
    groups.set(key, held);
  }
  return [...groups.values()]
    .map(({ courseId, kind, rows }) => ({
      courseId,
      kind,
      minutes: median(rows.map((r) => r.minutes)),
      from: rows.length,
    }))
    .sort((a, b) => b.minutes - a.minutes || b.from - a.from);
}
