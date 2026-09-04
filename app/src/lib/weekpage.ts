/**
 * A week that survives the printer.
 *
 * Notes print, guides print, the report prints. The week does not — and a
 * week on paper next to a laptop is still how a great many people plan, which
 * is why the calendar view is the one people screenshot.
 *
 * Two things stood between the week view and a usable sheet of paper, and
 * both are fixed here rather than by drawing a second week for print. A
 * second rendering path is a second thing to keep correct and it always
 * drifts; see `components/PrintButton.tsx`, which says so.
 *
 * ## The grid was disappearing
 *
 * The print stylesheet hides every `button`, on the reasonable ground that
 * anything you press is noise on paper. The week grid draws its days and its
 * blocks as buttons, so printing the week produced a page of hour labels with
 * nothing in them. Buttons inside the grid are now exempted and print as
 * plain blocks.
 *
 * ## The deadlines were never there at all
 *
 * The grid holds spans — a class occupies an hour. A deadline is a moment,
 * and the view said so and left them out, pointing at the month view instead.
 * That is defensible on a screen you can tap through and indefensible on
 * paper, where the week you pinned up is the whole of what you can see. So
 * the week now carries its deadlines under the grid, on screen and on paper
 * alike, grouped by the day they fall on.
 */

import { DOW, MONTHS, sameDay } from './date';
import type { DatedItem } from './types';

export interface DayDue {
  date: Date;
  label: string;
  items: DatedItem[];
}

/** The seven dates of a week, from whatever the view is showing as its first. */
export function weekDates(start: Date): Date[] {
  return Array.from(
    { length: 7 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

/**
 * The week's deadlines, by day.
 *
 * Every day is returned, empty ones included, because a sheet of paper wants
 * a row to write on for Thursday whether or not anything is already due then.
 */
export function dueByDay(items: DatedItem[], start: Date): DayDue[] {
  return weekDates(start).map((date) => ({
    date,
    label: `${DOW[date.getDay()]} ${date.getDate()}`,
    items: items.filter((i) => sameDay(i.date, date)),
  }));
}

/** "Sep 7 – 13" — or "Sep 28 – Oct 4" where the week crosses a month. */
export function weekLabel(start: Date): string {
  const end = weekDates(start)[6];
  const tail =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}`
      : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${tail}`;
}

/**
 * What the week asks of you, in one line.
 *
 * Counted, never characterised. "A heavy week" is a judgement the app is not
 * in a position to make about somebody whose other four commitments it has
 * never been told about.
 */
export function weekLine(days: DayDue[], classes: number): string {
  const due = days.reduce((n, d) => n + d.items.length, 0);
  if (due === 0 && classes === 0) return 'Nothing on this week.';
  const parts: string[] = [];
  if (classes > 0) parts.push(`${classes} ${classes === 1 ? 'class' : 'classes'}`);
  if (due > 0) parts.push(`${due} ${due === 1 ? 'deadline' : 'deadlines'}`);
  return `${parts.join(' and ')} this week.`;
}

/** The days with something due, for a sheet that would rather not print blanks. */
export function busyDays(days: DayDue[]): DayDue[] {
  return days.filter((d) => d.items.length > 0);
}

export interface Lane {
  /** Which side-by-side slot this block sits in, from zero. */
  lane: number;
  /** How many slots the column is divided into where this block is. */
  of: number;
}

/**
 * Where two things at once go.
 *
 * The week grid drew every block at the full width of its day, so office
 * hours at eleven and a class at eleven were printed one on top of the other
 * and neither could be read. On a screen you can tap through to the day; on a
 * page pinned to a wall there is nowhere else to look, which is what made
 * this worth fixing rather than noting.
 *
 * The division is per collision, not per day. Splitting every Thursday block
 * in half because two of them clash at eleven would make a legible day
 * illegible to fix an hour of it, so blocks are grouped into runs that
 * actually overlap and only those runs are divided.
 */
export function lanesOf<T extends { id: string; at: number; minutes: number }>(
  blocks: T[],
): Record<string, Lane> {
  const out: Record<string, Lane> = {};
  const sorted = [...blocks].sort((a, b) => a.at - b.at);

  let cluster: { id: string; lane: number }[] = [];
  let ends: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const c of cluster) out[c.id] = { lane: c.lane, of: ends.length };
    cluster = [];
    ends = [];
    clusterEnd = -Infinity;
  };

  for (const b of sorted) {
    if (cluster.length > 0 && b.at >= clusterEnd) flush();
    let lane = ends.findIndex((end) => end <= b.at);
    if (lane === -1) {
      lane = ends.length;
      ends.push(0);
    }
    ends[lane] = b.at + b.minutes;
    clusterEnd = Math.max(clusterEnd, b.at + b.minutes);
    cluster.push({ id: b.id, lane });
  }
  flush();

  return out;
}
