/**
 * Which of the shipped programmes to put in front of somebody, and when.
 *
 * The list itself is `data/fellowships.ts`, which says what it will and will
 * not assert — the short version being that it holds no deadlines, because a
 * confident wrong date is the one error here that costs somebody a
 * fellowship.
 *
 * So this cannot sort by "closing soonest". What it sorts by is whether the
 * months a programme is usually open are near now, which is the honest
 * version of the same question: *is this the time of year to be looking at
 * this?* Everything else is filtering — your year, and the fields you said
 * you cared about.
 *
 * ## Suggested, never added
 *
 * Nothing here writes an application. `intoApplication` builds one for the
 * screen to dispatch when somebody taps Track this, and it deliberately
 * arrives with **no date** and one instruction: go and get the real deadline.
 * An application that appeared in somebody's pipeline because an app thought
 * it looked relevant is an application they will not trust.
 */

import { FIELDS, PROGRAMMES, YEARS, type Programme, type Year } from '../data/fellowships';
import { newApplication, type Application } from './apply';

/** How far ahead a programme's window counts as "about now". */
export const SOON_MONTHS = 3;

export interface Wanted {
  /** Which year they are in, or empty for "has not said". */
  year: Year | '';
  /** Fields they said they cared about. Empty means no filter at all. */
  fields: string[];
  /** Ids they have waved away. */
  dismissed: string[];
}

export const NOTHING_WANTED: Wanted = { year: '', fields: [], dismissed: [] };

/** Months from now until the next time this month comes round. 0 is this month. */
export function monthsUntil(month: number, now: Date): number {
  return (month - now.getMonth() + 12) % 12;
}

/** How near the nearest of a programme's months is. */
export function nearness(p: Programme, now: Date): number {
  return Math.min(...p.months.map((m) => monthsUntil(m, now)));
}

/**
 * The programmes worth showing, nearest window first.
 *
 * A programme whose window is more than a season away is dropped rather than
 * listed at the bottom: a list somebody has to scroll past eleven irrelevant
 * things to reach is a list they stop opening.
 */
export function suggest(
  want: Wanted,
  now: Date,
  all: Programme[] = PROGRAMMES,
): Programme[] {
  return all
    .filter((p) => !want.dismissed.includes(p.id))
    .filter((p) => want.year === '' || p.years.includes(want.year))
    .filter((p) => want.fields.length === 0 || p.fields.some((f) => want.fields.includes(f)))
    .filter((p) => nearness(p, now) <= SOON_MONTHS)
    .sort((a, b) => nearness(a, now) - nearness(b, now) || a.role.localeCompare(b.role));
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * When it is usually open, said as the guess it is.
 *
 * Every one of these sentences carries the caveat. Not once at the top of the
 * screen where it scrolls away — on the row, next to the months, because the
 * months are the thing somebody would otherwise take for a fact.
 */
export function whenLine(p: Programme, now: Date): string {
  const sorted = [...p.months].sort((a, b) => monthsUntil(a, now) - monthsUntil(b, now));
  const names = sorted.slice(0, 3).map((m) => MONTHS[m]);
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Usually open around ${list} — a rough guide the app has not checked.`;
}

/** The caveat the screen leads with, once, before any of them. */
export const NO_DATES =
  'These carry no deadlines. Dates move every year and a campus endorsement deadline is often weeks before the national one, so the app will not guess at one — open the official page, and put the real date in when you track it.';

/**
 * A tracked programme, as an application with the date left blank.
 *
 * `due` is empty on purpose, and `next` is the one thing that has to happen
 * before anything else can. `lib/apply.ts` already treats an empty date as a
 * real state rather than a missing field, which is what makes this honest
 * rather than broken.
 */
export function trackPatch(p: Programme): Partial<Application> {
  return {
    org: p.org,
    role: p.role,
    kind: p.kind,
    url: p.url,
    due: '',
    next: 'Find this year’s deadline on the official page, and the campus one if there is one.',
    note: p.what,
  };
}

export function intoApplication(p: Programme, at: number): Application {
  return newApplication(trackPatch(p), at);
}

/** What the screen says when the filters have emptied it. */
export function emptyLine(want: Wanted): string {
  if (want.fields.length > 0) {
    return 'Nothing in those fields opens in the next few months. Widen the fields, or check back — most of these open in the autumn.';
  }
  if (want.year !== '') {
    return 'Nothing for your year opens in the next few months. Most of these open in the autumn.';
  }
  return 'Nothing opens in the next few months. Most of these open in the autumn.';
}

/** Stored filters, made safe to render from. */
export function readWanted(raw: unknown): Wanted {
  if (!raw || typeof raw !== 'object') return { ...NOTHING_WANTED };
  const r = raw as Record<string, unknown>;
  const years = new Set(YEARS.map((y) => y.id));
  const fields = new Set(FIELDS);
  return {
    year: typeof r.year === 'string' && years.has(r.year as Year) ? (r.year as Year) : '',
    fields: Array.isArray(r.fields)
      ? r.fields.filter((f): f is string => typeof f === 'string' && fields.has(f))
      : [],
    dismissed: Array.isArray(r.dismissed)
      ? r.dismissed.filter((d): d is string => typeof d === 'string').slice(0, 200)
      : [],
  };
}
