/**
 * The dates the university sets, which are the expensive ones.
 *
 * Every date the app has held until now came off a syllabus: a problem set, a
 * midterm, a paper. Miss one of those and you lose points. The dates that
 * decide a semester are not on any syllabus — add/drop closes, the withdrawal
 * deadline passes, registration for next term opens at an assigned minute and
 * the sections you needed are gone by lunchtime. Miss one of those and you
 * lose money, or a course, or a term.
 *
 * ## Why this ships empty
 *
 * There is no Vanderbilt academic calendar compiled into this file, and there
 * will not be one. The app cannot read a registrar, these dates differ by
 * university and by year, and a wrong withdrawal deadline that looks confident
 * is worse than a blank field that asks — the same reasoning that keeps myVU
 * shipping without an address in `data/campus.ts`.
 *
 * What ships is the list of *questions*: the landmarks worth knowing, named
 * the way registrars name them, each carrying one line about what it costs to
 * miss. Those names and those consequences are the same at every university,
 * which is the part the app can honestly assert. You fill in the dates once,
 * from your own registrar, in about four minutes — or paste the page and let
 * `parse` propose rows you confirm one at a time.
 *
 * Nothing here is guessed on your behalf. A landmark with no date is simply
 * not shown anywhere except the screen that asks for it.
 */

import { dateToIso, daysBetween, isoToDate, startOfDay } from './date';

export type RegistrarKind = 'deadline' | 'window' | 'break' | 'exams';

/** One thing worth knowing the date of, and why. */
export interface Landmark {
  id: string;
  label: string;
  /**
   * What missing it costs, in one line.
   *
   * This is the whole reason the landmark is in the app, so it is written as
   * a consequence rather than a description. "Classes begin" tells you
   * nothing; "after this, adding a course needs a signature" tells you when to
   * care.
   */
  cost: string;
  kind: RegistrarKind;
}

/**
 * The landmarks, in the order a term meets them.
 *
 * Deliberately short. A registrar publishes forty dates and thirty of them are
 * administrative noise for a student; asking for all forty is how a setup
 * screen gets abandoned halfway. These are the ones with a consequence.
 */
export const LANDMARKS: Landmark[] = [
  {
    id: 'classes-begin',
    label: 'Classes begin',
    cost: 'The first day attendance and participation start counting.',
    kind: 'deadline',
  },
  {
    id: 'add-deadline',
    label: 'Last day to add a course',
    cost: 'After this, adding anything needs a signature and a good reason.',
    kind: 'deadline',
  },
  {
    id: 'drop-clean',
    label: 'Last day to drop without a W',
    cost: 'The big one. After this the course stays on your transcript with a W against it.',
    kind: 'deadline',
  },
  {
    id: 'passfail',
    label: 'Last day to change to pass/fail',
    cost: 'The decision you can only make before you know how it is going.',
    kind: 'deadline',
  },
  {
    id: 'withdraw',
    label: 'Last day to withdraw from a course',
    cost: 'The final exit. After this you are graded on it whatever happens.',
    kind: 'deadline',
  },
  {
    id: 'registration',
    label: 'Registration opens for next term',
    cost: 'Assigned by hour, and the sections you need go in the first morning.',
    kind: 'window',
  },
  {
    id: 'break',
    label: 'Term break',
    cost: 'Days the app should not schedule work into.',
    kind: 'break',
  },
  {
    id: 'last-class',
    label: 'Last day of classes',
    cost: 'Everything a professor can still be asked in person has to happen before this.',
    kind: 'deadline',
  },
  {
    id: 'reading-days',
    label: 'Reading days',
    cost: 'The only unclaimed days in the term. Worth planning rather than losing.',
    kind: 'break',
  },
  {
    id: 'finals',
    label: 'Final exam period',
    cost: 'Your own exam times come from the registrar, not from a syllabus.',
    kind: 'exams',
  },
  {
    id: 'evals',
    label: 'Course evaluations close',
    cost: 'Some schools hold grades back until yours are in.',
    kind: 'deadline',
  },
  {
    id: 'grades',
    label: 'Grades posted',
    cost: 'When you find out, and when a mistake is still easy to fix.',
    kind: 'deadline',
  },
];

/** A landmark with a date on it — what the student actually saved. */
export interface TermDate {
  /** A landmark id, or a generated one for a date you added yourself. */
  id: string;
  label: string;
  /** ISO date. Empty means "not filled in", which is a normal state. */
  iso: string;
  /** Closing date, for anything that spans days. Empty for a single day. */
  until: string;
  cost: string;
  kind: RegistrarKind;
}

/** A blank sheet: every landmark, no dates. What the setup screen starts from. */
export function blankTerm(): TermDate[] {
  return LANDMARKS.map((l) => ({
    id: l.id,
    label: l.label,
    iso: '',
    until: '',
    cost: l.cost,
    kind: l.kind,
  }));
}

/**
 * The saved list, made safe to render from.
 *
 * A landmark added in a later version appears with no date rather than being
 * missing, and a row saved against a landmark that no longer exists keeps
 * whatever the student typed — they entered it, so it is theirs.
 */
export function sheet(saved: TermDate[] | undefined): TermDate[] {
  const mine = saved ?? [];
  const byId = new Map(mine.map((d) => [d.id, d]));
  const known = blankTerm().map((row) => {
    const held = byId.get(row.id);
    // The label and the consequence come from the code, so improving the
    // wording later improves it for everybody. Only the dates are the
    // student's.
    return held ? { ...row, iso: held.iso, until: held.until } : row;
  });
  const extra = mine.filter((d) => !LANDMARKS.some((l) => l.id === d.id));
  return [...known, ...extra];
}

export function filled(dates: TermDate[]): TermDate[] {
  return dates.filter((d) => d.iso !== '');
}

/** Whole days from today to the date. Negative once it is past. */
export function daysTo(iso: string, now: Date): number {
  return daysBetween(startOfDay(now), isoToDate(iso));
}

export type Standing =
  /** Still ahead, and far enough off not to be shouted about. */
  | 'ahead'
  /** Inside two weeks. */
  | 'soon'
  /** Today. */
  | 'today'
  /** A span that has started and not finished. */
  | 'open'
  /** Gone. */
  | 'past';

export function standing(d: TermDate, now: Date): Standing {
  const from = daysTo(d.iso, now);
  const to = d.until ? daysTo(d.until, now) : from;
  if (from > 0) return from <= 14 ? 'soon' : 'ahead';
  if (to >= 0) return from === 0 && to === 0 ? 'today' : 'open';
  return 'past';
}

/**
 * What the app should say about a date, in one sentence.
 *
 * Counts in days rather than in dates, because "in nine days" is the form the
 * question is actually asked in — nobody looks at October 24th and works out
 * how far away it is.
 */
export function line(d: TermDate, now: Date): string {
  switch (standing(d, now)) {
    case 'today':
      return 'Today.';
    case 'open': {
      if (!d.until) return 'Today.';
      const left = daysTo(d.until, now);
      if (left === 0) return 'Closes today.';
      return `Open now, ${left} ${left === 1 ? 'day' : 'days'} left.`;
    }
    case 'past':
      return 'Passed.';
    default: {
      const away = daysTo(d.iso, now);
      return away === 1 ? 'Tomorrow.' : `In ${away} days.`;
    }
  }
}

/**
 * The dates that have earned a place on Today.
 *
 * Two weeks for a deadline, because a drop decision is not a same-day
 * decision, and anything currently open regardless of how long it has left.
 * Breaks are excluded: a term break is worth knowing about and is not
 * something you can miss.
 */
export function pressing(dates: TermDate[], now: Date): TermDate[] {
  return filled(dates)
    .filter((d) => d.kind !== 'break')
    .filter((d) => {
      const where = standing(d, now);
      return where === 'soon' || where === 'today' || where === 'open';
    })
    .sort((a, b) => daysTo(a.iso, now) - daysTo(b.iso, now));
}

/** Everything still to come, soonest first. For the screen's own list. */
export function ahead(dates: TermDate[], now: Date): TermDate[] {
  return filled(dates)
    .filter((d) => standing(d, now) !== 'past')
    .sort((a, b) => daysTo(a.iso, now) - daysTo(b.iso, now));
}

/** The days a term break covers, so nothing schedules work into them. */
export function breakDays(dates: TermDate[]): Set<string> {
  const out = new Set<string>();
  for (const d of filled(dates)) {
    if (d.kind !== 'break') continue;
    const from = isoToDate(d.iso);
    const to = d.until ? isoToDate(d.until) : from;
    for (let day = from; day <= to; day.setDate(day.getDate() + 1)) {
      out.add(dateToIso(day));
    }
  }
  return out;
}

// ── Reading a registrar's page ────────────────────────────────────────────

const MONTH_WORDS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** "Sept" and "Sept." as well as "September". Ordinals on the day. */
const DATE_RE = new RegExp(
  String.raw`\b(${MONTH_WORDS.map((m) => `${m.slice(0, 3)}[a-z]*`).join('|')})\.?\s+(\d{1,2})(?:st|nd|rd|th)?` +
    String.raw`(?:\s*(?:[-–—]|to|through)\s*(?:(${MONTH_WORDS.map((m) => `${m.slice(0, 3)}[a-z]*`).join('|')})\.?\s+)?(\d{1,2})(?:st|nd|rd|th)?)?`,
  'i',
);

function monthIndex(word: string): number {
  const lower = word.toLowerCase();
  return MONTH_WORDS.findIndex((m) => m.startsWith(lower.slice(0, 3)));
}

/**
 * Keywords that identify a landmark, longest phrase first so that
 * "last day to drop" is not claimed by the shorter "drop".
 */
const HINTS: { id: string; words: RegExp }[] = [
  { id: 'drop-clean', words: /drop.*without|without.*(a )?w\b|drop deadline|last day to drop/i },
  { id: 'withdraw', words: /withdraw/i },
  { id: 'passfail', words: /pass\s*\/?\s*fail|pass-fail|audit/i },
  { id: 'add-deadline', words: /last day to add|add deadline|open enrollment ends/i },
  { id: 'registration', words: /registration|enroll(ment)? (opens|begins)/i },
  { id: 'reading-days', words: /reading day/i },
  { id: 'finals', words: /final exam|examination period|finals/i },
  { id: 'break', words: /break|recess|holiday|no classes/i },
  { id: 'evals', words: /evaluation/i },
  { id: 'grades', words: /grades? (are )?(posted|due|available)/i },
  { id: 'last-class', words: /last day of class(es)?|classes end/i },
  { id: 'classes-begin', words: /classes begin|first day of class(es)?|instruction begins/i },
];

export interface Found {
  /** The landmark this looks like, or '' when it is one of your own. */
  id: string;
  label: string;
  iso: string;
  until: string;
  kind: RegistrarKind;
}

/**
 * Dates read out of a pasted registrar page.
 *
 * Conservative on purpose, and every row is proposed rather than saved: a line
 * has to carry a month, a day, and at least two words of label before it is
 * offered at all. The year is passed in rather than guessed, because a
 * registrar's page usually spans two of them and a calendar that silently
 * files May under the wrong year is the exact failure this whole module exists
 * to avoid.
 */
export function parse(text: string, year: number): Found[] {
  const out: Found[] = [];
  const seen = new Set<string>();

  for (const raw of text.split('\n')) {
    const row = raw.replace(/\s+/g, ' ').trim();
    if (!row) continue;

    const m = DATE_RE.exec(row);
    if (!m) continue;

    const month = monthIndex(m[1]);
    if (month < 0) continue;
    const day = Number(m[2]);
    if (day < 1 || day > 31) continue;

    // What is left once the date is taken out is the label.
    const label = row
      .replace(m[0], ' ')
      .replace(/\((?:mon|tues?|wed(?:nes)?|thur?s?|fri|sat(?:ur)?|sun)[a-z]*\)/gi, ' ')
      .replace(/[|,;:·–—]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (label.split(' ').filter(Boolean).length < 2) continue;

    const iso = dateToIso(new Date(year, month, day));
    // A span: "October 15–16", or "October 30 – November 2".
    const endMonth = m[3] ? monthIndex(m[3]) : month;
    const until =
      m[4] && endMonth >= 0 ? dateToIso(new Date(year, endMonth, Number(m[4]))) : '';

    const hit = HINTS.find((h) => h.words.test(label));
    const id = hit?.id ?? '';
    const key = `${id || label.toLowerCase()}:${iso}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      id,
      label: LANDMARKS.find((l) => l.id === id)?.label ?? label,
      iso,
      until,
      kind: LANDMARKS.find((l) => l.id === id)?.kind ?? (until ? 'break' : 'deadline'),
    });
  }

  return out;
}

/** Fold confirmed rows into the saved sheet, replacing by landmark. */
export function apply(saved: TermDate[], found: Found[]): TermDate[] {
  let next = sheet(saved);
  for (const f of found) {
    if (f.id && next.some((d) => d.id === f.id)) {
      next = next.map((d) => (d.id === f.id ? { ...d, iso: f.iso, until: f.until } : d));
    } else {
      const id = f.id || `own-${f.iso}-${f.label.slice(0, 12).replace(/\W+/g, '-').toLowerCase()}`;
      if (next.some((d) => d.id === id)) continue;
      next = [...next, { id, label: f.label, iso: f.iso, until: f.until, cost: '', kind: f.kind }];
    }
  }
  return next;
}

/** How much of the sheet is done, for the screen to say so without nagging. */
export function progress(dates: TermDate[]): { done: number; of: number } {
  const known = sheet(dates).filter((d) => LANDMARKS.some((l) => l.id === d.id));
  return { done: known.filter((d) => d.iso !== '').length, of: known.length };
}
