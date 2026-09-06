/**
 * Patterns the app can see in its own data, and what to do about each.
 *
 * The reports already count things, and they already hand those counts to a
 * model for a paragraph of judgement. Both halves are good and neither is this.
 * The counting says *what happened*; the model says it in prose, and only for
 * somebody who has a key, is online, and has waited for a round trip. Between
 * them there was nothing that says **this is worth your attention, and here is
 * the thing to do about it** — computed on the device, in a millisecond, for
 * everybody.
 *
 * That is what this is. Every finding below is arithmetic over data the person
 * themselves put in the app, and each one carries the action it implies.
 *
 * ## Four rules, and they are the whole design
 *
 * **Nothing is invented.** Every figure in a finding is counted from a record.
 * There is no model here and no heuristic dressed as a measurement. If the app
 * did not observe it, the finding does not exist.
 *
 * **Thin evidence is no evidence.** Each detector has a floor, and below it the
 * detector is silent rather than quietly confident. Two data points are not a
 * pattern; a median of one is a data point wearing a median's clothes. Every
 * finding says what it rests on — `from` — so nothing has to be taken on faith.
 *
 * **No score.** Nothing here rates the week, the day or the person. There is no
 * percentage, no streak, no grade. A student with three classes, a shift at
 * work and two ticked boxes is having a normal week, and an app that called it
 * a bad one would be both wrong and the last thing they ever read here.
 *
 * **An observation without an action is a complaint.** Every finding names one
 * concrete next thing, and where the app can open the screen for it, it does.
 *
 * ## Why it is ranked rather than listed
 *
 * Six true things is not six times as useful as one; it is a wall of text that
 * gets skipped. `insights()` sorts by how much the finding is likely to change
 * what somebody does today and hands back the top few. The rest are still true
 * and still computed — they are simply not the thing to say first.
 */

import type { DatedItem } from './types';
import type { Screen } from './types';
import type { Catalog } from '../data/catalog';
import type { Sitting } from './sitting';
import type { Spent } from './pace';
import { normalKind } from './pace';
import { decorateItem } from './date';

/** One thing worth saying, and the one thing to do about it. */
export interface Insight {
  /** Stable across renders, so React keys and dedupe both have something. */
  id: string;
  /** The finding. One sentence, no hedging, no score. */
  title: string;
  /** What to do about it. One sentence, an instruction rather than advice. */
  body: string;
  /**
   * What the finding rests on, in the person's own units.
   *
   * Printed under every row. The pace list already does this — "from 5" — and
   * it is the difference between a number you can weigh and one you have to
   * believe. A detector that cannot say this has no business speaking.
   */
  from: string;
  /** Where to go to act on it. Omitted when the app has nowhere useful. */
  action?: { label: string; screen: Screen; courseId?: string };
  /**
   * How much this is likely to change what you do today. Higher goes first.
   *
   * Deliberately coarse. The ordering that matters is "overdue work beats a
   * study habit beats a calibration note", and a finer scale would only invite
   * tuning that no evidence supports.
   */
  rank: number;
}

export interface InsightInput {
  catalog: Catalog;
  now: Date;
  done: Record<string, boolean>;
  spent: Spent[];
  sittings: Sitting[];
  reviews: Record<string, { seen: number }>;
  /** Turns a course id into the code a person recognises. */
  code: (id: string) => string;
}

const DAY = 86_400_000;

/** How many findings a report shows. Six true things read as none. */
export const MOST = 3;

// The floors. Each is the point below which the detector says nothing, and
// each is set where a person would start to agree it is a pattern rather than
// a coincidence — not where the arithmetic first becomes possible.
/** Overdue in one course before it is that course rather than a bad week. */
const OVERDUE_FLOOR = 2;
/** Deadlines inside `CROWD_HOURS` before the week is crowded rather than busy. */
const CROWD_FLOOR = 3;
const CROWD_HOURS = 72;
/** Reports carrying a guess before their spread means anything. */
const GUESS_FLOOR = 3;
/** How far out a guess has to be before saying so is worth the words. */
const GUESS_MARGIN = 1.3;
/** Days of no contact at all before a course counts as untouched. */
const COLD_DAYS = 14;
/** Papers sat in a course before an average is an average. */
const PAPER_FLOOR = 2;
/** Per cent below which a paper average is worth naming. */
const WEAK_PCT = 70;

/**
 * Courses with more than a couple of things overdue.
 *
 * One overdue deadline is a week going badly and everybody has those. Several
 * in the same course is the course itself slipping, which is the thing that
 * compounds, and it is worth naming before the next one lands on top.
 */
function slipping(input: InsightInput, dated: DatedItem[]): Insight[] {
  const late = dated.filter((i) => i.isPast && !i.isToday && !input.done[i.id]);
  const byCourse = new Map<string, DatedItem[]>();
  for (const i of late) byCourse.set(i.c, [...(byCourse.get(i.c) ?? []), i]);

  return [...byCourse.entries()]
    .filter(([, rows]) => rows.length >= OVERDUE_FLOOR)
    .map(([courseId, rows]) => ({
      id: `slipping-${courseId}`,
      title: `${input.code(courseId)} has ${rows.length} things past their date.`,
      body: `Start with ${rows[0].title} — it is the oldest, so it is the one most likely to be blocking the rest.`,
      from: `${rows.length} deadlines, counted against today`,
      action: { label: 'What is behind', screen: 'behind' as Screen, courseId },
      rank: 100 + rows.length,
    }));
}

/**
 * Several deadlines landing inside three days of one another.
 *
 * The calendar shows this and nobody reads a calendar far enough ahead to see
 * it coming. Three things due inside seventy-two hours is a week that has to be
 * started early or not survived, and the app knows which is the earliest.
 */
function crowded(input: InsightInput, dated: DatedItem[]): Insight[] {
  const ahead = dated
    .filter((i) => !i.isPast && !input.done[i.id] && i.daysAway <= 21)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (let i = 0; i < ahead.length; i++) {
    // At or after the anchor. Without the lower bound every earlier deadline
    // also passes — a negative difference is under seventy-two hours too — so
    // the last item in a well-spread term would gather the whole term behind
    // it and report a cluster that is not there.
    const from = ahead[i].date.getTime();
    const window = ahead.filter((x) => {
      const gap = x.date.getTime() - from;
      return gap >= 0 && gap < CROWD_HOURS * 3_600_000;
    });
    if (window.length < CROWD_FLOOR) continue;
    const first = window[0];
    const codes = [...new Set(window.map((x) => input.code(x.c)))];
    return [
      {
        id: `crowded-${first.id}`,
        title: `${window.length} things are due inside three days, from ${first.dueShort}.`,
        body: `${first.title} is first. Starting it before the cluster arrives is the only part of this you still control.`,
        from: `${window.length} deadlines across ${codes.join(', ')}`,
        action: { label: 'The week ahead', screen: 'ahead' as Screen },
        rank: 90 - first.daysAway,
      },
    ];
  }
  return [];
}

/**
 * Work that reliably takes longer than you think it will.
 *
 * The app asks for a guess before a session and the real figure after it, so
 * both halves of this are the person's own reporting rather than an inference.
 * The finding is not that they are bad at estimating — everyone is — but the
 * size of their own particular gap, which is a number they can plan with.
 */
function underestimating(input: InsightInput): Insight[] {
  const byKind = new Map<string, Spent[]>();
  for (const s of input.spent) {
    if (s.guess === undefined || s.guess <= 0) continue;
    const kind = normalKind(s.kind);
    byKind.set(kind, [...(byKind.get(kind) ?? []), s]);
  }

  const out: Insight[] = [];
  for (const [kind, rows] of byKind) {
    if (rows.length < GUESS_FLOOR) continue;
    const real = median(rows.map((r) => r.minutes));
    const guessed = median(rows.map((r) => r.guess as number));
    if (guessed <= 0 || real < guessed * GUESS_MARGIN) continue;
    out.push({
      id: `under-${kind}`,
      // No article before the figure: `hours` already returns "an hour" where
      // that reads best, and "not the an hour you plan for" is what a template
      // with one in it produces.
      title: `${sentence(kind)} takes you about ${hours(real)}, not ${hours(guessed)}.`,
      body: `Book ${hours(real)} for the next one. The gap is not a discipline problem; it is a booking problem.`,
      from: `the middle of ${rows.length} of your own reports`,
      rank: 60,
    });
  }
  return out;
}

/**
 * A course nothing has touched in a fortnight, while others were worked on.
 *
 * The comparison is what makes this fair. Somebody who has not opened the app
 * for two weeks is not neglecting one course, they are having a fortnight, and
 * telling them off for it would be both wrong and unkind. This only speaks when
 * other courses were getting attention over the same stretch.
 */
function untouched(input: InsightInput, dated: DatedItem[]): Insight[] {
  const courses = input.catalog.courses;
  if (courses.length < 2) return [];

  const since = input.now.getTime() - COLD_DAYS * DAY;
  const warm = new Set<string>();

  for (const s of input.spent) if (s.at >= since) warm.add(s.courseId);
  for (const s of input.sittings) if (s.at >= since) warm.add(s.courseId);
  // A card key is `courseId:question`, so the course is the part before the
  // first colon. See `lib/review.ts` — the id is derived, never stored.
  for (const [key, r] of Object.entries(input.reviews)) {
    if (r.seen >= since) warm.add(key.slice(0, key.indexOf(':')));
  }

  // Nobody was working. That is a fortnight, not a neglected course.
  if (warm.size === 0) return [];

  return courses
    .filter((c) => !warm.has(c.id))
    // Only worth saying about a course that still has something coming. A
    // finished course being quiet is a course being finished.
    .filter((c) => dated.some((i) => i.c === c.id && !i.isPast && !input.done[i.id]))
    .map((c) => ({
      id: `cold-${c.id}`,
      title: `${input.code(c.id)} has had nothing for a fortnight.`,
      body: 'Open its guide and drill one unit. Fifteen minutes is enough to stop it becoming the thing you cram.',
      from: `no cards, papers or reported time since ${COLD_DAYS} days ago, while ${warm.size} other ${warm.size === 1 ? 'course was' : 'courses were'} worked on`,
      action: { label: 'Open the guide', screen: 'guide' as Screen, courseId: c.id },
      rank: 70,
    }));
}

/**
 * The course the practice papers keep coming back low in.
 *
 * Two papers is the floor, because one bad paper is a bad morning. This is the
 * only finding drawn from marks, and it is drawn from marks the person set
 * themselves against their own questions — there is no comparison with anybody.
 */
function weakest(input: InsightInput): Insight[] {
  const byCourse = new Map<string, Sitting[]>();
  for (const s of input.sittings) byCourse.set(s.courseId, [...(byCourse.get(s.courseId) ?? []), s]);

  return [...byCourse.entries()]
    .filter(([, rows]) => rows.length >= PAPER_FLOOR)
    .map(([courseId, rows]) => ({ courseId, rows, avg: Math.round(median(rows.map((r) => r.pct))) }))
    .filter((x) => x.avg < WEAK_PCT)
    .map((x) => ({
      id: `weak-${x.courseId}`,
      title: `${input.code(x.courseId)} papers sit around ${x.avg}%.`,
      body: 'Drill the questions you missed rather than re-reading the unit — the misses are already a deck.',
      from: `${x.rows.length} papers you sat`,
      action: { label: 'Drill the misses', screen: 'drill' as Screen, courseId: x.courseId },
      rank: 80 - Math.round(x.avg / 10),
    }));
}

/**
 * Everything worth saying, most useful first.
 *
 * Returns an empty list rather than an encouraging noise when there is nothing
 * to say. A report that always has advice is a report whose advice means
 * nothing, and silence here is the honest answer far more often than not.
 */
export function insights(input: InsightInput): Insight[] {
  const dated = input.catalog.items
    .map((i) => decorateItem(i, input.now))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return [
    ...slipping(input, dated),
    ...crowded(input, dated),
    ...untouched(input, dated),
    ...weakest(input),
    ...underestimating(input),
  ].sort((a, b) => b.rank - a.rank);
}

/** The top few, which is what a screen shows. */
export function topInsights(input: InsightInput, most = MOST): Insight[] {
  return insights(input).slice(0, most);
}

/** The findings as Markdown, for the report document. */
export function insightLines(found: Insight[]): string[] {
  if (found.length === 0) return [];
  const lines = ['## What stands out', ''];
  for (const f of found) {
    lines.push(`**${f.title}**`, '', f.body, '', `*Based on ${f.from}.*`, '');
  }
  return lines;
}

// ── Small shared arithmetic ──────────────────────────────────────────────

function median(ns: number[]): number {
  if (ns.length === 0) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Minutes as something a person says out loud.
 *
 * "90 minutes" and "an hour and a half" are the same fact and only one of them
 * is how anybody plans a Tuesday.
 */
export function hours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} minutes`;
  const h = minutes / 60;
  const rounded = Math.round(h * 2) / 2;
  if (rounded === 1) return 'an hour';
  if (rounded % 1 === 0) return `${rounded} hours`;
  return `${rounded} hours`;
}

/** "problem set" → "Problem set", for the start of a sentence. */
function sentence(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
