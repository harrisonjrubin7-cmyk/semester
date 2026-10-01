import { formatDate } from './locale';
import { blocksFor, codeOf, type Catalog } from '../data/catalog';
import type { Action } from './actions';
import { activityKind, type ActivityKind, type Commitment } from './activities';
import type { AthleticEvent } from './athletics';
import { dateToIso } from './date';
import { finite, obj } from './device-library';
import { percentOf } from './grades';
import { estimate, type Spent } from './pace';
import type { Floor, Rest } from './rest';
import { toHash } from './route';
import { isExam } from './runway';
import { appointmentsOn, lengthOf } from './select';
import type { SourceLabel } from './source';
import type { Appointment, DatedItem } from './types';
import { WAKING_HOURS, type Window } from './windows';

/**
 * Academic life balance (Phase E, `academic_life_balance`) and the Crunch
 * Week Forecast (`crunch_week_forecast`).
 *
 * `lib/clash.ts` finds the single days in the next fortnight that will hurt.
 * This is the week around them: where the hours go — class, work, commute,
 * study, personal, athletics, and what is left open — which days run long
 * without a gap, where the open blocks are, and which stretch two to four
 * weeks out has more major deadlines in it than a few days can hold.
 *
 * Everything is counted from what the student entered or imported: the
 * timetable, their commitments and appointments, their rest blocks and work
 * windows, their athletics season, a commute they state, and the syllabus
 * deadlines. Hours and counts only. It does not score a week, rate a student,
 * or say anything about how they are doing — a heavy week is a fact about a
 * calendar, not about a person.
 *
 * Nothing is placed on the calendar from here. A suggested study block is a
 * suggestion, and it reaches the calendar only when the student confirms it.
 */

export const CATEGORIES = ['class', 'work', 'commute', 'study', 'personal', 'athletics', 'open'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  class: 'Class',
  work: 'Work',
  commute: 'Commute',
  study: 'Study',
  personal: 'Personal',
  athletics: 'Athletics and travel',
  open: 'Open time',
};

/** One stretch of a day with a clock time on it. Minutes past midnight, clipped to the day. */
export interface Span {
  id: string;
  from: number;
  to: number;
  category: Exclude<Category, 'open' | 'commute'>;
  title: string;
  source: SourceLabel;
  /** A rest block the student protected — theirs, not a commitment, so never part of a long run or a conflict. */
  rest?: boolean;
}

export interface Commute {
  /** Weekdays it happens on, 0 = Sunday. */
  days: number[];
  /** One way. The day counts it twice. */
  minutesEachWay: number;
}

export interface Settings {
  commute: Commute | null;
}

export const EMPTY_SETTINGS: Settings = { commute: null };
export const LIFE_BALANCE_KEY = 'semester.life-balance.v1';

/** A reader for the device store; throws on anything it did not write, so the bytes are kept. */
export function readSettings(value: unknown): Settings {
  if (!obj(value)) throw new Error('Saved balance settings are not valid.');
  if (value.commute === null || value.commute === undefined) return { commute: null };
  const c = value.commute;
  if (
    !obj(c) ||
    !Array.isArray(c.days) ||
    c.days.length > 7 ||
    !c.days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) ||
    new Set(c.days).size !== c.days.length ||
    !finite(c.minutesEachWay, 0, 240)
  ) {
    throw new Error('A saved commute is not valid.');
  }
  return { commute: { days: [...(c.days as number[])].sort(), minutesEachWay: c.minutesEachWay } };
}

export interface Input {
  catalog: Catalog;
  commitments: Commitment[];
  appointments: Appointment[];
  rest: Rest[];
  windows: Window[];
  floor: Floor;
  athletics: AthleticEvent[];
  settings: Settings;
  /** Deadlines still open — the caller leaves out what is ticked. */
  items: DatedItem[];
  spent: Spent[];
}

const SPORT: ReadonlySet<ActivityKind> = new Set(['varsity', 'clubsport', 'intramural']);
const WORK: ReadonlySet<ActivityKind> = new Set(['job', 'research']);

function commitmentCategory(kind: ActivityKind): Span['category'] {
  if (WORK.has(kind)) return 'work';
  if (SPORT.has(kind)) return 'athletics';
  return 'personal';
}

function appointmentCategory(kind: string | undefined): Span['category'] {
  if (kind === 'work') return 'work';
  if (kind === 'study') return 'study';
  return 'personal';
}

const clip = (n: number) => Math.max(0, Math.min(24 * 60, n));

/** Every timed thing on one day, clipped to the day, in time order. */
export function daySpans(input: Input, date: Date): Span[] {
  const out: Span[] = [];
  const dow = date.getDay();

  for (const b of blocksFor(input.catalog, date)) {
    if (b.canceled || b.optional || !b.c) continue;
    out.push({
      id: `class:${b.c}:${b.at}`,
      from: b.at,
      to: clip(b.at + lengthOf(input.catalog, b)),
      category: 'class',
      title: codeOf(input.catalog, b.c),
      // The timetable came off a syllabus or an account import.
      source: 'imported',
    });
  }

  for (const c of input.commitments) {
    if (!c.active || c.at === null || !c.days.includes(dow) || c.minutes <= 0) continue;
    out.push({
      id: `commitment:${c.id}`,
      from: c.at,
      to: clip(c.at + c.minutes),
      category: commitmentCategory(c.kind),
      title: c.name || activityKind(c.kind).label,
      source: 'student_entered',
    });
  }

  for (const a of appointmentsOn(input.appointments, date)) {
    if (a.at === null) continue;
    out.push({
      id: `appointment:${a.id}`,
      from: a.at,
      to: clip(a.at + (a.minutes ?? 60)),
      category: appointmentCategory(a.kind),
      title: a.title,
      source: 'student_entered',
    });
  }

  for (const r of input.rest) {
    if (!r.days.includes(dow) || r.to <= r.from) continue;
    out.push({ id: `rest:${r.id}`, from: r.from, to: clip(r.to), category: 'personal', title: r.label, source: 'student_entered', rest: true });
  }

  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  for (const e of input.athletics) {
    const a = Date.parse(e.start);
    const b = Date.parse(e.end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b <= midnight || a >= next) continue;
    // Minutes on the local clock, from the clipped instants.
    const from = a <= midnight ? 0 : new Date(a).getHours() * 60 + new Date(a).getMinutes();
    const to = b >= next ? 24 * 60 : new Date(b).getHours() * 60 + new Date(b).getMinutes();
    if (to <= from) continue;
    out.push({ id: `athletics:${e.id}`, from, to, category: 'athletics', title: e.title || e.kind, source: 'student_entered' });
  }

  return out.filter((s) => s.to > s.from).sort((x, y) => x.from - y.from || x.to - y.to);
}

/** When the waking day starts and ends: the student's rest floor if they set one, else sixteen hours from seven. */
export function wakingDay(floor: Floor): { from: number; to: number } {
  if (floor.on && floor.to < floor.from) return { from: floor.to, to: floor.from };
  const from = 7 * 60;
  return { from, to: from + WAKING_HOURS * 60 };
}

export interface Conflict {
  a: Span;
  b: Span;
  minutes: number;
}

/** Two commitments on the clock at once. Rest blocks are the student's own and are left out. */
export function conflicts(spans: Span[]): Conflict[] {
  const firm = spans.filter((s) => !s.rest);
  const out: Conflict[] = [];
  for (let i = 0; i < firm.length; i += 1) {
    for (let j = i + 1; j < firm.length; j += 1) {
      const minutes = Math.min(firm[i].to, firm[j].to) - Math.max(firm[i].from, firm[j].from);
      if (minutes > 0) out.push({ a: firm[i], b: firm[j], minutes });
    }
  }
  return out;
}

/** A gap shorter than this between two commitments is a walk, not a break. */
export const GAP_MINUTES = 15;
/** Commitments back to back for at least this long are worth pointing out. */
export const LONG_RUN_MINUTES = 4 * 60;

export interface Run {
  from: number;
  to: number;
  titles: string[];
}

/** Stretches of commitments with no break longer than a walk between them. */
export function longRuns(spans: Span[]): Run[] {
  const firm = spans.filter((s) => !s.rest && s.category !== 'study').sort((x, y) => x.from - y.from);
  const runs: Run[] = [];
  let current: Run | null = null;
  for (const s of firm) {
    if (current && s.from <= current.to + GAP_MINUTES) {
      current.to = Math.max(current.to, s.to);
      if (!current.titles.includes(s.title)) current.titles.push(s.title);
    } else {
      if (current) runs.push(current);
      current = { from: s.from, to: s.to, titles: [s.title] };
    }
  }
  if (current) runs.push(current);
  return runs.filter((r) => r.to - r.from >= LONG_RUN_MINUTES);
}

/** The shortest open block worth offering for study. */
export const OPEN_BLOCK_MINUTES = 60;

export interface OpenBlock {
  from: number;
  to: number;
  /** Inside a work window the student set, or only inside the default waking day. */
  source: Extract<SourceLabel, 'student_entered' | 'estimated'>;
}

/** The parts of a window outside the protected floor, when it is on. */
function offTheFloor(w: { from: number; to: number }, floor: Floor): { from: number; to: number }[] {
  if (!floor.on || floor.from === floor.to) return [{ from: w.from, to: w.to }];
  const night = floor.from < floor.to ? [[floor.from, floor.to]] : [[floor.from, 24 * 60], [0, floor.to]];
  let parts = [{ from: w.from, to: w.to }];
  for (const [a, b] of night) {
    parts = parts.flatMap((p) => {
      if (b <= p.from || a >= p.to) return [p];
      return [
        ...(a > p.from ? [{ from: p.from, to: a }] : []),
        ...(b < p.to ? [{ from: b, to: p.to }] : []),
      ];
    });
  }
  return parts;
}

/**
 * Open blocks of an hour or more: inside the student's work windows where they
 * set any for this weekday, else inside the waking day — and outside every
 * span, rest blocks included.
 */
export function openBlocks(spans: Span[], windows: Window[], floor: Floor, dow: number): OpenBlock[] {
  const theirs = windows.filter((w) => w.days.includes(dow) && w.to > w.from);
  const waking = wakingDay(floor);
  // A work window the student set is still kept off the protected floor:
  // 19:00–24:00 with a 23:00–07:00 floor is open until 23:00, not midnight.
  const frames: { from: number; to: number }[] = theirs.length ? theirs.flatMap((w) => offTheFloor(w, floor)) : [waking];
  const source: OpenBlock['source'] = theirs.length ? 'student_entered' : 'estimated';
  const busy = [...spans].sort((x, y) => x.from - y.from);
  const out: OpenBlock[] = [];
  for (const frame of frames.sort((x, y) => x.from - y.from)) {
    let at = frame.from;
    for (const s of busy) {
      if (s.to <= at || s.from >= frame.to) continue;
      if (s.from > at) out.push({ from: at, to: Math.min(s.from, frame.to), source });
      at = Math.max(at, s.to);
    }
    if (at < frame.to) out.push({ from: at, to: frame.to, source });
  }
  return out.filter((b) => b.to - b.from >= OPEN_BLOCK_MINUTES);
}

export interface DeadlineRef {
  id: string;
  title: string;
  code: string;
  iso: string;
  major: boolean;
  source: SourceLabel;
}

/** An exam, a project or paper, or anything the syllabus weights at ten per cent or more. */
export function isMajor(item: { kind: string; title: string; weight?: string }): boolean {
  if (isExam(item)) return true;
  if (/project|paper|essay|presentation|report|portfolio/i.test(`${item.kind} ${item.title}`)) return true;
  return percentOf(item.weight ?? '') >= 10;
}

/** Imported when the student confirmed it against the syllabus; otherwise it needs review. */
export const deadlineSource = (item: DatedItem): SourceLabel => (item.checked?.confirmed ? 'imported' : 'needs_review');

function deadlineRef(item: DatedItem, catalog: Catalog): DeadlineRef {
  return {
    id: item.id,
    title: item.title,
    code: codeOf(catalog, item.c),
    iso: dateToIso(item.date),
    major: isMajor(item),
    source: deadlineSource(item),
  };
}

export interface Day {
  iso: string;
  date: Date;
  spans: Span[];
  /** Hours by category. Timed spans are counted once each minute, in category order; stated hours are spread over the week. */
  hours: Record<Category, number>;
  /** Everything but open time. */
  committed: number;
  runs: Run[];
  open: OpenBlock[];
  conflicts: Conflict[];
  deadlines: DeadlineRef[];
}

export interface Week {
  start: Date;
  days: Day[];
  hours: Record<Category, number>;
  /** Commitments with no fixed time, and the commute: counted as hours, never placed on the clock. */
  stated: number;
}

/** When two spans cover the same minute, the minute goes to the first of these. */
const PRECEDENCE: Span['category'][] = ['class', 'athletics', 'work', 'study', 'personal'];

const round1 = (n: number) => Math.round(n * 10) / 10;
const zero = (): Record<Category, number> => ({ class: 0, work: 0, commute: 0, study: 0, personal: 0, athletics: 0, open: 0 });

/** Hours per category a day for commitments stated by the week rather than the clock. */
function statedShares(commitments: Commitment[]): Record<Category, number> {
  const out = zero();
  for (const c of commitments) {
    if (!c.active || (c.days.length > 0 && c.at !== null)) continue;
    out[commitmentCategory(c.kind)] += Math.max(0, c.hours) / 7;
  }
  return out;
}

export function summarizeDay(input: Input, date: Date): Day {
  const spans = daySpans(input, date);
  const dow = date.getDay();
  const minuteOwner: (Span['category'] | null)[] = new Array(24 * 60).fill(null);
  for (const category of PRECEDENCE) {
    for (const s of spans) {
      if (s.category !== category) continue;
      for (let m = s.from; m < s.to; m += 1) if (minuteOwner[m] === null) minuteOwner[m] = category;
    }
  }
  const hours = zero();
  for (const owner of minuteOwner) if (owner) hours[owner] += 1 / 60;
  const shares = statedShares(input.commitments);
  for (const c of CATEGORIES) hours[c] += shares[c];
  const commute = input.settings.commute;
  if (commute && commute.days.includes(dow)) hours.commute += (commute.minutesEachWay * 2) / 60;

  const waking = wakingDay(input.floor);
  let busyAwake = 0;
  for (let m = waking.from; m < Math.min(waking.to, 24 * 60); m += 1) if (minuteOwner[m]) busyAwake += 1;
  const untimed = shares.work + shares.personal + shares.athletics + shares.study + hours.commute;
  hours.open = Math.max(0, (waking.to - waking.from - busyAwake) / 60 - untimed);

  for (const c of CATEGORIES) hours[c] = round1(hours[c]);
  const iso = dateToIso(date);
  return {
    iso,
    date,
    spans,
    hours,
    committed: round1(CATEGORIES.filter((c) => c !== 'open').reduce((n, c) => n + hours[c], 0)),
    runs: longRuns(spans),
    open: openBlocks(spans, input.windows, input.floor, dow),
    conflicts: conflicts(spans),
    deadlines: input.items.filter((i) => dateToIso(i.date) === iso).map((i) => deadlineRef(i, input.catalog)),
  };
}

/** The week starting on `start` (the caller picks the first day), seven days. */
export function summarizeWeek(input: Input, start: Date): Week {
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const days = Array.from({ length: 7 }, (_, i) => summarizeDay(input, new Date(first.getFullYear(), first.getMonth(), first.getDate() + i)));
  const hours = zero();
  for (const d of days) for (const c of CATEGORIES) hours[c] += d.hours[c];
  for (const c of CATEGORIES) hours[c] = round1(hours[c]);
  const shares = statedShares(input.commitments);
  const commute = input.settings.commute ? (input.settings.commute.days.length * input.settings.commute.minutesEachWay * 2) / 60 : 0;
  const stated = round1(7 * (shares.work + shares.personal + shares.athletics + shares.study) + commute);
  return { start: first, days, hours, stated };
}

/* ── Crunch Week Forecast ─────────────────────────────────────────────── */

/** How far ahead the forecast looks: from a week out, so there is time to act, to four weeks. */
export type WorkloadPressureState = 'clear' | 'manageable' | 'tight' | 'more_than_open' | 'unknown';

/** One day's due-work estimate against the time the student has left open. */
export interface WorkloadPressureDay {
  iso: string;
  estimatedMinutes: number;
  openMinutes: number;
  balanceMinutes: number;
  known: number;
  unknown: number;
  state: WorkloadPressureState;
  /** True only when every deadline in the figure was confirmed against its source. */
  confirmed: boolean;
}

/**
 * Planned work pressure, never a prediction about the student.
 *
 * The estimate comes only from the student's own completed work, through
 * `pace.estimate`. A kind of work they have never timed stays unknown and
 * contributes no invented minutes. Open time comes from the same work
 * windows, commitments, calendar and protected rest used by the week view.
 *
 * Work is compared on its due day. That is deliberately conservative and
 * explainable: this does not pretend to know when the student will do it, and
 * a study block is not silently treated as completed work. The screen can
 * offer an earlier block, but only the student can place one.
 */
export function workloadPressure(input: Input, start: Date): WorkloadPressureDay[] {
  const week = summarizeWeek(input, start);
  const byId = new Map(input.items.map((item) => [item.id, item]));

  return week.days.map((day) => {
    const estimates = day.deadlines.map((deadline) => {
      const item = byId.get(deadline.id);
      return item ? estimate(input.spent, item.c, item.kind) : { minutes: 0, from: 0, basis: '' as const };
    });
    const known = estimates.filter((row) => row.from > 0).length;
    const unknown = estimates.length - known;
    const estimatedMinutes = estimates.reduce((sum, row) => sum + (row.from > 0 ? row.minutes : 0), 0);
    const openMinutes = Math.max(0, Math.round(day.hours.open * 60));
    const balanceMinutes = openMinutes - estimatedMinutes;
    let state: WorkloadPressureState = 'clear';
    if (day.deadlines.length > 0 && known === 0) state = 'unknown';
    else if (estimatedMinutes > openMinutes / 0.7) state = 'more_than_open';
    else if (estimatedMinutes > openMinutes) state = 'tight';
    else if (known > 0) state = 'manageable';

    return {
      iso: day.iso,
      estimatedMinutes,
      openMinutes,
      balanceMinutes,
      known,
      unknown,
      state,
      confirmed: day.deadlines.length > 0 && day.deadlines.every((deadline) => deadline.source !== 'needs_review'),
    };
  });
}

/** How far ahead the crunch forecast looks: from a week out, so there is time to act, to four weeks. */
export const FORECAST_FROM_DAYS = 7;
export const FORECAST_TO_DAYS = 28;
/** A crunch is at least this many major deadlines inside this many days. */
export const CRUNCH_COUNT = 3;
export const CRUNCH_SPAN_DAYS = 6;
/** In the default waking day, a suggested start is never before this. */
export const EARLIEST_DEFAULT = 9 * 60;

export interface Suggestion {
  itemId: string;
  title: string;
  code: string;
  due: string;
  /** Where to start it, or null when no open block of the length was found. */
  slot: { iso: string; from: number; minutes: number; source: OpenBlock['source'] } | null;
  /** Why this one: its estimate, or its weight. */
  because: string;
}

export interface Crunch {
  /** Stable while the same deadlines make it up: the first and last of them. */
  id: string;
  start: string;
  end: string;
  days: number;
  deadlines: DeadlineRef[];
  /** "The week of Nov 2 has four major deadlines in six days." */
  line: string;
  /** "Want to start two earlier?" */
  ask: string;
  suggestions: Suggestion[];
  source: SourceLabel;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const word = (n: number) => WORDS[n] ?? String(n);
const DAY_MS = 86_400_000;
const dayNumber = (d: Date) => Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / DAY_MS);
const monthDay = (d: Date) => formatDate(d, { month: 'short', day: 'numeric' });

/** The Sunday a date's week starts on. */
export function weekStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

/** Minutes of work to start with: the student's own estimate halved, else ninety — between one hour and two. */
function startMinutes(minutes: number): number {
  if (minutes <= 0) return 90;
  return Math.min(120, Math.max(60, Math.round(minutes / 2 / 15) * 15));
}

/**
 * The stretches two to four weeks out with more major deadlines in them than
 * a few days hold, and for each, an earlier start for one or two of them in
 * an open block of the week before — suggested, never placed.
 */
export function crunchForecast(input: Input, now: Date): Crunch[] {
  const today = dayNumber(now);
  const major = input.items
    .filter((i) => isMajor(i))
    .filter((i) => {
      const away = dayNumber(i.date) - today;
      return away >= FORECAST_FROM_DAYS && away < FORECAST_TO_DAYS;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const found: DatedItem[][] = [];
  let i = 0;
  while (i < major.length) {
    let j = i;
    while (j + 1 < major.length && dayNumber(major[j + 1].date) - dayNumber(major[i].date) < CRUNCH_SPAN_DAYS) j += 1;
    if (j - i + 1 >= CRUNCH_COUNT) {
      found.push(major.slice(i, j + 1));
      i = j + 1;
    } else {
      i += 1;
    }
  }

  const used = new Set<string>();
  return found.map((group) => {
    const first = group[0].date;
    const last = group[group.length - 1].date;
    const days = dayNumber(last) - dayNumber(first) + 1;
    const n = Math.min(2, Math.max(1, group.length - 2));
    const deadlines = group.map((g) => deadlineRef(g, input.catalog));

    const picked = [...group]
      .map((g) => ({ g, est: estimate(input.spent, g.c, g.kind), weight: percentOf(g.weight ?? '') }))
      .sort((a, b) => b.est.minutes - a.est.minutes || b.weight - a.weight || a.g.date.getTime() - b.g.date.getTime())
      .slice(0, n);

    const suggestions: Suggestion[] = picked.map(({ g, est, weight }) => {
      const minutes = startMinutes(est.minutes);
      let slot: Suggestion['slot'] = null;
      // The week before the first deadline, from tomorrow at the earliest,
      // and one start a day: two on the same day would move the crunch, not
      // spread it. Inside the default day nothing is offered before nine.
      const back = Math.min(7, dayNumber(first) - today - 1);
      for (let k = back; k >= 1 && !slot; k -= 1) {
        const local = new Date(first.getFullYear(), first.getMonth(), first.getDate() - k);
        const iso = dateToIso(local);
        if (used.has(iso)) continue;
        for (const block of summarizeDay(input, local).open) {
          const at = block.source === 'estimated' ? Math.max(block.from, EARLIEST_DEFAULT) : block.from;
          if (at + minutes <= block.to) {
            slot = { iso, from: at, minutes, source: block.source };
            used.add(iso);
            break;
          }
        }
      }
      const because =
        est.minutes > 0
          ? `Your past ${g.kind.toLowerCase() || 'work'} like this took about ${Math.round(est.minutes / 60 * 10) / 10} hours.`
          : weight > 0
            ? `Worth ${weight}% by the syllabus.`
            : 'A major deadline in the stretch.';
      return { itemId: g.id, title: g.title, code: codeOf(input.catalog, g.c), due: dateToIso(g.date), slot, because };
    });

    return {
      id: `crunch:${group[0].id}:${group[group.length - 1].id}`,
      start: dateToIso(first),
      end: dateToIso(last),
      days,
      deadlines,
      line: `The week of ${monthDay(weekStart(first))} has ${word(group.length)} major deadlines in ${word(days)} ${days === 1 ? 'day' : 'days'}.`,
      ask: `Want to start ${word(n)} earlier?`,
      suggestions,
      source: deadlines.some((d) => d.source === 'needs_review') ? 'needs_review' : 'imported',
    };
  });
}

/**
 * The crunch as an action, so Today's card gets the explanation sheet and the
 * snooze, dismiss and correct moves every other recommendation has.
 */
export function crunchAction(crunch: Crunch, now: Date): Action {
  const firstDue = new Date(`${crunch.start}T00:00:00`);
  const away = dayNumber(firstDue) - dayNumber(now);
  return {
    id: crunch.id,
    type: 'crunch',
    title: crunch.line,
    whyItMatters: `${crunch.ask} Starting early spreads the work over more days; it does not change any due date.`,
    priority: 'normal',
    dueAt: firstDue.getTime(),
    expiresAt: firstDue.getTime(),
    group: 'Week ahead',
    source: { label: crunch.source, system: 'Your syllabus deadlines' },
    explanation: {
      trigger: `The first of them is ${away} days away — early enough to move work, and the dates are already known.`,
      factors: crunch.deadlines.map(
        (d) => `${d.code} ${d.title} — ${monthDay(new Date(`${d.iso}T00:00:00`))}${d.source === 'needs_review' ? ' (date needs review)' : ''}`,
      ),
      expectedImpact: 'Starting one or two in the week before puts fewer of them in the same few days. Nothing is added to your calendar unless you confirm it.',
      limitations: [
        'Major means an exam, a project, paper or presentation, or anything worth 10% or more by the syllabus — a lighter item can still take longer.',
        'Semester sees only the deadlines, commitments and blocks you have added, not the rest of your week.',
        'A date marked Needs review has not been checked against its syllabus.',
      ],
      alternatives: [
        'Leave the plan as it is — the week may suit you.',
        'Block time yourself on the calendar.',
        'Ask the instructor early if two deadlines truly collide.',
      ],
    },
    primary: { label: 'Plan earlier starts', kind: 'navigate', target: toHash({ screen: 'calendar', id: '' }), requiresConfirmation: false },
  };
}

/** "7:30p" style, for a block's start. */
export function clockLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${h24 >= 12 ? 'p' : 'a'}`;
}

/** The appointment a confirmed suggestion becomes: a study block, the student's own. */
export function suggestionAppointment(s: Suggestion): Omit<Appointment, 'id' | 'created'> | null {
  if (!s.slot) return null;
  return {
    title: `Start ${s.code} ${s.title}`.slice(0, 120),
    kind: 'study',
    date: s.slot.iso,
    at: s.slot.from,
    time: clockLabel(s.slot.from),
    minutes: s.slot.minutes,
    where: '',
    note: `Suggested by the crunch week forecast. Due ${s.due}.`,
  };
}
