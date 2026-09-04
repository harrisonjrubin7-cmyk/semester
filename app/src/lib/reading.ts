/**
 * Readings, as work with a size and a place to happen.
 *
 * A syllabus says *read chapters four to six by Thursday*, and the app filed
 * that as one line in a checklist next to a problem set worth five per cent of
 * the grade. It is not a deadline you tick so much as three hours that have to
 * happen before Thursday, and until now those three hours existed only in
 * somebody's head. The difference between a list and a plan is whether the
 * things on it have somewhere to go.
 *
 * ## Size, from two things the app already has
 *
 * How long a reading takes you, from `lib/pace.ts` — your own median for
 * readings in that course. And how much there is, read out of the title: "ch.
 * 4–6" is three chapters and "pp. 112–140" is twenty-eight pages, where a
 * syllabus says so. A reading whose extent is stated is scaled against the
 * typical extent of the readings you have actually timed; one that states none
 * gets the plain median. A course you have never timed a reading in gets no
 * estimate at all, and is counted rather than guessed at — the same rule the
 * rest of the hour arithmetic follows.
 *
 * ## Placed forwards, and honestly unplaced when it will not fit
 *
 * Each reading goes on the earliest day before its due date with room left in
 * your work windows. Forwards rather than backwards, because a reading is for
 * the class it precedes and the night before is the one evening it is least
 * use. A reading that fits nowhere is reported as not fitting rather than
 * squeezed into a day that is already full — "two of this week's readings do
 * not fit" is the sentence worth having, and it is one an app that always
 * finds room can never say.
 */

import type { DatedItem, Item } from './types';
import { dateToIso, startOfDay } from './date';
import { estimate, normalKind, type Spent } from './pace';
import { freeOn, type Window } from './windows';

/** Whether an item is a reading rather than something to hand in. */
export function isReading(item: { kind: string; title: string }): boolean {
  return normalKind(item.kind) === 'reading' || /^\s*read\b/i.test(item.title);
}

export interface Extent {
  chapters: number;
  pages: number;
}

const NONE: Extent = { chapters: 0, pages: 0 };

/**
 * How much there is, where the syllabus says.
 *
 * Ranges and lists, in the forms syllabi actually use. Anything else returns
 * nothing rather than a guess — "the Konner piece" states no extent, and
 * inventing one for it would put a fabricated number into an hour total.
 */
export function extent(item: { title: string; detail?: string }): Extent {
  const text = `${item.title} ${item.detail ?? ''}`;
  const out = { ...NONE };

  // "pp. 112–140", "pages 112-140".
  const pages = /\bp{1,2}(?:ages?|\.)?\s*(\d{1,4})\s*[-–—]\s*(\d{1,4})\b/i.exec(text);
  if (pages) {
    const from = Number(pages[1]);
    const to = Number(pages[2]);
    if (to > from && to - from < 2000) out.pages = to - from + 1;
  }

  // "ch. 4–6", "chapters 4 to 6".
  const range = /\bch(?:apters?|\.|s\.?)?\s*(\d{1,3})\s*(?:[-–—]|to|through)\s*(\d{1,3})\b/i.exec(text);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (to >= from && to - from < 40) out.chapters = to - from + 1;
  } else {
    // "chapters 2 and 3", "ch. 2, 3, 5".
    const list = /\bch(?:apters?|\.|s\.?)?\s*((?:\d{1,3})(?:\s*(?:,|and)\s*\d{1,3})+)/i.exec(text);
    if (list) {
      out.chapters = list[1].split(/\s*(?:,|and)\s*/).filter(Boolean).length;
    } else {
      const one = /\bch(?:apter|\.)\s*(\d{1,3})\b/i.exec(text);
      if (one) out.chapters = 1;
    }
  }

  return out;
}

/** A single number for how much there is, or 0 when nothing was stated. */
export function weight(e: Extent): number {
  // Pages where they are given, because they are the finer measure. Otherwise
  // chapters at a nominal twenty-five pages, which is only ever used as a
  // ratio against other chapters and never as a page count in its own right.
  if (e.pages > 0) return e.pages;
  return e.chapters * 25;
}

export interface Sized {
  item: DatedItem;
  /** Minutes. Zero when there is nothing to base it on. */
  minutes: number;
  extent: Extent;
  /** Whether the estimate rests on anything at all. */
  known: boolean;
}

/**
 * A reading, with how long it is likely to take.
 *
 * The extent scales the estimate: if you usually read thirty pages in an hour
 * and this week's is sixty, it is two hours. Scaling is capped at four times
 * the median in either direction, because a stated extent can be wrong or can
 * mean something the app has not understood, and a ten-hour reading appearing
 * in a week's total would be noticed only after somebody planned around it.
 */
export function size(item: DatedItem, spent: Spent[], typical: number): Sized {
  const e = extent(item);
  const base = estimate(spent, item.c, 'reading');
  if (base.from === 0) return { item, minutes: 0, extent: e, known: false };

  const mine = weight(e);
  const scale = mine > 0 && typical > 0 ? Math.min(4, Math.max(0.25, mine / typical)) : 1;
  return {
    item,
    minutes: Math.round(base.minutes * scale),
    extent: e,
    known: true,
  };
}

/**
 * The typical extent of the readings you have actually timed.
 *
 * Needed so that scaling means something: without it, "sixty pages" is a
 * number with nothing to be twice as long as. Readings whose extent was never
 * stated are left out of this, which is why it takes the items rather than
 * the reports.
 */
export function typicalExtent(readings: { title: string; detail?: string }[]): number {
  const weights = readings.map((r) => weight(extent(r))).filter((w) => w > 0);
  if (weights.length === 0) return 0;
  const sorted = [...weights].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export interface Placed {
  item: DatedItem;
  /** The day it is put on. */
  on: Date;
  minutes: number;
}

export interface Plan {
  placed: Placed[];
  /** Readings that fit nowhere before their due date. */
  unplaced: Sized[];
  /** Readings the app has no basis to size, and so cannot place. */
  unsized: Sized[];
}

export interface PlanInput {
  readings: Sized[];
  /** Seven days from today, each with hours already promised on it. */
  days: { date: Date; promised: number }[];
  windows: Window[];
  now: Date;
}

/**
 * Each reading on the earliest day before it is due with room for it.
 *
 * Forwards, because a reading is for the class it precedes. Sorted by due date
 * first, so the thing due Tuesday gets Monday before the thing due Friday
 * takes it — which is the only ordering that does not leave the soonest
 * reading homeless.
 */
export function plan(input: PlanInput): Plan {
  const { readings, days, windows, now } = input;
  const today = startOfDay(now);

  const sized = readings.filter((r) => r.known && r.minutes > 0);
  const unsized = readings.filter((r) => !r.known || r.minutes === 0);

  // Minutes left on each day, after what is already promised there.
  const left = new Map<string, number>();
  for (const d of days) {
    left.set(dateToIso(d.date), Math.round(freeOn(windows, d.date.getDay(), d.promised) * 60));
  }

  const placed: Placed[] = [];
  const unplaced: Sized[] = [];

  for (const r of [...sized].sort((a, b) => a.item.daysAway - b.item.daysAway)) {
    let put = false;
    for (const d of days) {
      const day = startOfDay(d.date);
      if (day < today) continue;
      // Strictly before it is due, or on the day itself when that is all
      // there is — a reading due Thursday can still be read on Thursday.
      if (day > startOfDay(r.item.date)) break;
      const key = dateToIso(day);
      const room = left.get(key) ?? 0;
      if (room < r.minutes) continue;
      left.set(key, room - r.minutes);
      placed.push({ item: r.item, on: day, minutes: r.minutes });
      put = true;
      break;
    }
    if (!put) unplaced.push(r);
  }

  return { placed, unplaced, unsized };
}

/** The sentence the plan earns. Counts, and the honest gaps. */
export function planLine(p: Plan): string {
  const total = p.placed.reduce((n, x) => n + x.minutes, 0);
  if (p.placed.length === 0 && p.unplaced.length === 0 && p.unsized.length === 0) {
    return 'No readings due in the next seven days.';
  }
  const bits: string[] = [];
  if (p.placed.length > 0) {
    const hours = Math.round((total / 60) * 10) / 10;
    const one = p.placed.length === 1;
    bits.push(
      `${p.placed.length} ${one ? 'reading' : 'readings'} placed, ${hours} ${
        hours === 1 ? 'hour' : 'hours'
      } of ${one ? 'it' : 'them'}`,
    );
  }
  if (p.unplaced.length > 0) {
    bits.push(`${p.unplaced.length} that ${p.unplaced.length === 1 ? 'does' : 'do'} not fit`);
  }
  if (p.unsized.length > 0) {
    bits.push(`${p.unsized.length} the app cannot size yet`);
  }
  return `${bits.join(', ')}.`;
}

/** "About 40 minutes · 3 chapters" — what a row says about one reading. */
export function sizeLine(s: Sized): string {
  const bits: string[] = [];
  if (s.known && s.minutes > 0) {
    bits.push(s.minutes >= 60 ? `about ${Math.round((s.minutes / 60) * 10) / 10}h` : `about ${s.minutes} min`);
  }
  if (s.extent.pages > 0) bits.push(`${s.extent.pages} pages`);
  else if (s.extent.chapters > 0) {
    bits.push(`${s.extent.chapters} ${s.extent.chapters === 1 ? 'chapter' : 'chapters'}`);
  }
  return bits.join(' · ');
}

/** Every reading due in a window of days, sized. */
export function due(items: DatedItem[], done: Record<string, boolean>, within: number): Item[] {
  return items.filter(
    (i) => !done[i.id] && isReading(i) && i.daysAway >= 0 && i.daysAway <= within,
  );
}
