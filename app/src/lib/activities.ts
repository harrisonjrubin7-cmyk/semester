/**
 * Everything you do that is not a class.
 *
 * A semester is not four courses. It is four courses, a job, a research
 * position, two clubs, a chapter, and intramural soccer on Tuesdays — and the
 * app knew about none of it. That is not a cosmetic gap. The reason a week
 * falls apart is almost never the coursework in isolation; it is the coursework
 * plus eighteen hours of everything else, and the collision is invisible until
 * it happens.
 *
 * So a commitment here is a first-class thing with a time on it. Anything that
 * meets at a fixed hour lands on the same day and week grids as your classes,
 * in the same palette, so a Tuesday that already has practice on it looks full
 * before you agree to something else.
 *
 * ## What this does not do
 *
 * It does not read AnchorLink. AnchorLink is behind single sign-on, and no
 * browser will let this app read a page it does not own — correctly. There is
 * no list of Vanderbilt organisations compiled into this file either, and there
 * will not be: there are several hundred, they change every year, and a list of
 * invented or stale ones would be worse than no list, because somebody would
 * email a president who graduated in 2021.
 *
 * What it does is the same bridge that works for YES — the clipboard — plus a
 * place to keep what you are actually in, with the hours it actually costs.
 */

import type { Appointment, Block } from './types';
import type { EventKindId } from './kinds';

export type ActivityKind =
  | 'club'
  | 'research'
  | 'job'
  | 'greek'
  | 'intramural'
  | 'clubsport'
  | 'varsity'
  | 'service'
  | 'arts'
  | 'other';

export interface KindDef {
  id: ActivityKind;
  label: string;
  blurb: string;
  /**
   * Which of the seven event colours it borrows.
   *
   * Not a new palette. The grid already reads in one glance because it has
   * seven low-saturation tints of one metal, and adding ten more would undo
   * exactly the thing that makes it readable.
   */
  tint: EventKindId;
}

export const ACTIVITY_KINDS: KindDef[] = [
  { id: 'club', label: 'Club or organisation', blurb: 'A student org you are a member of.', tint: 'social' },
  { id: 'research', label: 'Research', blurb: 'A lab, an RA position, a thesis group.', tint: 'study' },
  { id: 'job', label: 'Job', blurb: 'On campus or off. Shifts count as hours.', tint: 'work' },
  { id: 'greek', label: 'Fraternity or sorority', blurb: 'Chapter, committees, events.', tint: 'social' },
  { id: 'intramural', label: 'Intramural sport', blurb: 'A league team, a weekly game.', tint: 'health' },
  { id: 'clubsport', label: 'Club sport', blurb: 'Competitive, with real practices.', tint: 'health' },
  { id: 'varsity', label: 'Varsity athletics', blurb: 'The one with a full second schedule attached.', tint: 'health' },
  { id: 'service', label: 'Service or volunteering', blurb: 'Anything you show up for regularly.', tint: 'family' },
  { id: 'arts', label: 'Music, theatre or arts', blurb: 'Rehearsals, ensembles, productions.', tint: 'social' },
  { id: 'other', label: 'Something else', blurb: 'Whatever this list has missed.', tint: 'other' },
];

const BY_ID = new Map(ACTIVITY_KINDS.map((k) => [k.id, k]));

export function activityKind(id: string | undefined): KindDef {
  return BY_ID.get((id ?? 'other') as ActivityKind) ?? ACTIVITY_KINDS[ACTIVITY_KINDS.length - 1];
}

export interface Commitment {
  id: string;
  name: string;
  kind: ActivityKind;
  /** "Member", "Treasurer", "RA to Prof. Ruiz" — blank is fine. */
  role: string;
  where: string;
  /** Its page — AnchorLink, a lab site, whatever you have. */
  url: string;
  note: string;
  /** Days of the week it meets, 0 = Sunday. Empty when it has no fixed time. */
  days: number[];
  /** Minutes past midnight. Null when it has no fixed time. */
  at: number | null;
  /** How long a meeting runs. */
  minutes: number;
  /**
   * Hours a week, for anything with no fixed meeting — a job with variable
   * shifts, reading for a lab. Ignored when `days` and `at` are set, because
   * then the hours are arithmetic rather than an estimate.
   */
  hours: number;
  active: boolean;
  created: number;
}

/**
 * Hours a week this costs.
 *
 * Measured where it can be measured. A commitment with days and a length is
 * arithmetic; one without is whatever you said. Estimating the second from the
 * first would be inventing a number about your own life, and it is the number
 * the whole screen turns on.
 */
export function hoursOf(c: Commitment): number {
  if (c.days.length > 0 && c.at !== null) {
    return (c.days.length * c.minutes) / 60;
  }
  return Math.max(0, c.hours);
}

export function weeklyHours(list: Commitment[]): number {
  return round(list.filter((c) => c.active).reduce((n, c) => n + hoursOf(c), 0));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Hours a week, written for reading. */
export function showHours(n: number): string {
  if (n === 0) return 'none';
  if (n < 1) return `${Math.round(n * 60)} min`;
  const rounded = round(n);
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
}

/**
 * What the week actually asks of you.
 *
 * Two numbers are measured — time in class from the timetable, and time in
 * commitments — and one is a rule of thumb, labelled as one. The 2:1 figure for
 * study outside class is the standard advice universities give; it is guidance,
 * not a measurement of you, and calling it a measurement would be the kind of
 * confident wrongness that makes somebody drop a class they could have kept.
 */
export interface Load {
  classHours: number;
  activityHours: number;
  /** Class hours plus the conventional 2:1 outside-class estimate. */
  studyEstimate: number;
  total: number;
}

export function load(classHours: number, activityHours: number): Load {
  const studyEstimate = round(classHours * 2);
  return {
    classHours: round(classHours),
    activityHours: round(activityHours),
    studyEstimate,
    total: round(classHours + studyEstimate + activityHours),
  };
}

/**
 * A sentence about the week, and the honest limits on it.
 *
 * No thresholds dressed as verdicts. The app does not know your job, your
 * health or how fast you read, so it says what the arithmetic says and stops.
 */
export function loadLine(l: Load): string {
  if (l.classHours === 0 && l.activityHours === 0) {
    return 'Nothing on the timetable yet — add a course or a commitment and this fills in.';
  }
  return (
    `${showHours(l.classHours)} in class, ${showHours(l.activityHours)} committed elsewhere. ` +
    `Add the usual two hours of work per hour of class and the week comes to about ` +
    `${showHours(l.total)} — that last part is the standard rule of thumb, not a measurement of you.`
  );
}

/** Commitments that meet on this weekday, as blocks the rail and grid can draw. */
export function blocksOn(
  list: Commitment[],
  date: Date,
): (Block & { mine?: boolean; kind?: string; minutes?: number })[] {
  const day = date.getDay();
  return list
    .filter((c) => c.active && c.at !== null && c.days.includes(day))
    .map((c) => ({
      time: clock(c.at as number),
      at: c.at as number,
      title: c.name,
      meta: [activityKind(c.kind).label, c.where].filter(Boolean).join(' · '),
      c: null,
      mine: true,
      kind: activityKind(c.kind).tint,
      minutes: c.minutes,
    }))
    .sort((a, b) => a.at - b.at);
}

/** Minutes past midnight → "6:30p". */
export function clock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${h24 >= 12 ? 'p' : 'a'}`;
}

/**
 * Where a commitment runs into a class.
 *
 * Found rather than prevented: a clash is often real and known — you leave
 * lecture early on match days — so this reports it and lets you decide, rather
 * than refusing to save.
 */
export interface Clash {
  commitment: Commitment;
  classTitle: string;
  day: number;
}

export function clashes(
  list: Commitment[],
  classesOn: (day: number) => { title: string; at: number; minutes: number }[],
): Clash[] {
  const out: Clash[] = [];
  for (const c of list) {
    if (!c.active || c.at === null) continue;
    for (const day of c.days) {
      for (const cls of classesOn(day)) {
        const overlaps = c.at < cls.at + cls.minutes && cls.at < c.at + c.minutes;
        if (overlaps) out.push({ commitment: c, classTitle: cls.title, day });
      }
    }
  }
  return out;
}

/** "Tue" — for saying which day a clash falls on. */
export function dayName(day: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day] ?? '';
}

/**
 * Names lifted from a pasted involvement list.
 *
 * Much looser than the YES schedule parser, because an involvement page has no
 * shape worth relying on — no times, no codes, just names in a column. So this
 * only drops what is obviously not an organisation and hands the rest over for
 * you to check, and the screen says to check them. Guessing harder here would
 * mean filing a navigation label as a club.
 */
const NOISE =
  /^(home|events|organizations?|organisations?|involvement|my |sign|log|search|browse|filter|show|view|more|menu|skip|back|next|page \d|all |\d+ )/i;

export function readInvolvement(text: string): { name: string; role: string }[] {
  const out: { name: string; role: string }[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    // A copied table gives tabs; the first cell is the name, the next the role.
    const cells = raw.split('\t').map((c) => c.trim());
    const line = cells.filter(Boolean).join(' · ').trim();
    if (line.length < 3 || line.length > 120) continue;
    if (NOISE.test(line)) continue;
    if (/^https?:\/\//i.test(line)) continue;
    // A line with no letters is a count, a date or a divider.
    if (!/[A-Za-z]{3}/.test(line)) continue;

    const [namePart, ...rest] = line.split(/\s+[·|–—]\s+|\s{2,}|,\s+/);
    const name = namePart.trim();
    if (name.length < 3) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, role: rest.join(', ').trim() });
  }

  return out;
}

/** A guess at what kind something is, from its name. Offered, never applied silently. */
export function guessKind(name: string): ActivityKind {
  const n = name.toLowerCase();
  if (/\b(fraternity|sorority|chapter|phi|sigma|alpha|beta|gamma|delta|kappa|omega|theta)\b/.test(n)) {
    return 'greek';
  }
  if (/\b(lab|research|thesis|institute)\b/.test(n)) return 'research';
  if (/\bclub (sport|team)\b|\bclub (soccer|rugby|lacrosse|ultimate|volleyball|tennis|rowing|crew)\b/.test(n)) {
    return 'clubsport';
  }
  if (/\bintramural|\bim\b/.test(n)) return 'intramural';
  if (/\b(orchestra|choir|band|ensemble|theatre|theater|a cappella|dance|improv)\b/.test(n)) return 'arts';
  if (/\b(volunteer|service|habitat|tutoring|mentor)\b/.test(n)) return 'service';
  return 'club';
}

/** Commitments as appointments, so anything that already reads appointments sees them. */
export function asAppointments(list: Commitment[], date: Date): Appointment[] {
  return blocksOn(list, date).map((b, i) => ({
    id: `commitment-${date.toDateString()}-${i}`,
    title: b.title,
    kind: b.kind,
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`,
    at: b.at,
    time: b.time,
    where: b.meta,
    note: '',
    created: 0,
  }));
}
