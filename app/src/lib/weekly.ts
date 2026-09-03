/**
 * The week that happened, and the one coming.
 *
 * The daily reports cover a day at each end of it. A week is the unit people
 * actually plan and judge themselves against — "how did this week go" is a
 * question everyone asks on a Sunday and nobody has the data to answer, so it
 * gets answered from whatever happens to be memorable, which is the thing that
 * went wrong.
 *
 * The app has the data. It knows what was ticked and when, what went by, what
 * cards were drilled, what papers were sat, and what next week already holds.
 * Every figure here is counted from that; `lib/ahead.ts` does the forward half
 * and this file does the backward one.
 *
 * ## Counted, then read
 *
 * Same split as everywhere else: the numbers are computed here, and a model is
 * handed the finished counts and asked for two or three sentences of judgement.
 * The report works with no model at all — the counts are the substance.
 *
 * ## The one thing it will not do
 *
 * It does not score your week. There is no productivity percentage, no streak,
 * no grade for the seven days. A week with three classes, a shift at work and
 * two boxes ticked is a normal week, and a report that called it a bad one
 * would be both wrong and the last one you read.
 */

import type { DatedItem, PersonalTask } from './types';
import type { Catalog } from '../data/catalog';
import { decorateItem } from './date';
import type { DoneMap } from './standing';
import type { Sitting } from './sitting';
import type { Reviews } from './review';

/** Sunday-to-Saturday is how a university week is spoken about. */
export function weekStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function weekEnd(start: Date): Date {
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
}

/** "31 Aug – 6 Sep", for the report's own heading. */
export function weekLabel(start: Date): string {
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export interface Behind {
  /** Deadlines that fell in the week and were ticked. */
  done: DatedItem[];
  /** Deadlines that fell in the week and were not. */
  slipped: DatedItem[];
  /** Your own tasks completed, and still open, dated in the week. */
  tasksDone: number;
  tasksOpen: number;
  /** Papers sat this week. */
  papers: Sitting[];
  /** Cards whose last review fell in the week. */
  cardsDrilled: number;
  /** Everything overdue across the whole semester, as of now. */
  overdue: number;
  /** The week's own share of the term, for the heading. */
  label: string;
  /** Ticked items counted by due date because no tick time was recorded. */
  staleTicks: number;
}

export interface WeeklyInput {
  catalog: Catalog;
  now: Date;
  done: DoneMap;
  /** When each deadline was ticked, where the app was recording it. */
  tickedAt: Record<string, number>;
  tasks: PersonalTask[];
  sittings: Sitting[];
  reviews: Reviews;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * The week just gone.
 *
 * A deadline counts to the week you ticked it, which is the honest answer to
 * "what did I get done this week" and was not available until the app started
 * recording the moment. Anything ticked before it started — and everything
 * already in an existing account — has no timestamp, and falls back to the
 * week it was due in. `staleTicks` counts those so the screen can say how much
 * of the report rests on the fallback rather than quietly mixing the two.
 */
export function behind(input: WeeklyInput): Behind {
  const { catalog, now, done } = input;
  const start = weekStart(now);
  const end = weekEnd(start);

  const dated = catalog.items
    .map((i) => decorateItem(i, now))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const inWeek = dated.filter((i) => i.date >= start && i.date < end);

  // Ticked this week, by when the box was ticked. Anything with a recorded
  // time is judged on that time wherever the deadline itself sat.
  const ticked = dated.filter((i) => {
    const at = input.tickedAt[i.id];
    return at !== undefined && at >= start.getTime() && at < end.getTime();
  });
  const tickedIds = new Set(ticked.map((i) => i.id));

  // And the ones with no recorded time, which fall back to their due date.
  const fallback = inWeek.filter((i) => done[i.id] && input.tickedAt[i.id] === undefined);
  const startKey = isoOf(start);
  const endKey = isoOf(end);

  const tasksInWeek = input.tasks.filter(
    (t) => t.date !== null && t.date >= startKey && t.date < endKey,
  );

  const cardsDrilled = Object.values(input.reviews).filter(
    (r) => r.seen >= start.getTime() && r.seen < end.getTime(),
  ).length;

  return {
    done: [...ticked, ...fallback].sort((a, b) => a.date.getTime() - b.date.getTime()),
    // Slipped is still judged on the due date, which is what "slipped" means:
    // it was due in this week and the week is going by with it undone.
    slipped: inWeek.filter((i) => !done[i.id] && i.isPast && !tickedIds.has(i.id)),
    tasksDone: tasksInWeek.filter((t) => t.done).length,
    tasksOpen: tasksInWeek.filter((t) => !t.done).length,
    papers: input.sittings
      .filter((s) => s.at >= start.getTime() && s.at < end.getTime())
      .sort((a, b) => b.at - a.at),
    cardsDrilled,
    overdue: dated.filter((i) => i.isPast && !i.isToday && !done[i.id]).length,
    label: weekLabel(start),
    staleTicks: fallback.length,
  };
}

/** The headline over the week that happened. Never a score. */
export function behindLine(b: Behind): string {
  const finished = b.done.length + b.tasksDone;
  if (finished === 0 && b.papers.length === 0 && b.cardsDrilled === 0) {
    return b.slipped.length > 0
      ? `Nothing ticked, and ${b.slipped.length} went by.`
      : 'A quiet week — nothing was due and nothing was ticked.';
  }
  const bits: string[] = [];
  if (finished > 0) bits.push(`${finished} finished`);
  if (b.cardsDrilled > 0) bits.push(`${b.cardsDrilled} cards drilled`);
  if (b.papers.length > 0) {
    bits.push(`${b.papers.length} ${b.papers.length === 1 ? 'paper' : 'papers'} sat`);
  }
  return `${bits.join(', ')}.`;
}

/** What slipped, said without a lecture about it. */
export function slippedLine(b: Behind): string {
  if (b.slipped.length === 0) {
    return b.done.length > 0 ? 'Nothing from this week went by unticked.' : '';
  }
  return `${b.slipped.length} from this week ${
    b.slipped.length === 1 ? 'is' : 'are'
  } still open. ${b.overdue > b.slipped.length ? `${b.overdue} overdue across the semester.` : ''}`.trim();
}

// ── What the model is told ───────────────────────────────────────────────

export const SYSTEM = [
  'You write three or four sentences at the end of a university student’s week, from counts that',
  'have already been computed. You are not summarising; you are advising.',
  '',
  '· Start with what actually got done. It is the part people discount, and a checklist has',
  '  already hidden it by the time the week ends.',
  '· Then the one pattern worth naming — something slipping two weeks running, a course that has',
  '  had no attention, a week where everything was drilled and nothing was written.',
  '· Then the single thing to do first next week, from what is already scheduled. One thing.',
  '· Do not score the week. No productivity rating, no streak, no "you were X% productive". A',
  '  week with three classes, a shift and two ticked boxes is a normal week.',
  '· Never restate a number differently from how it is given and never invent one. If something',
  '  important is missing, say which.',
].join('\n');

export interface Ahead {
  promised: number;
  due: DatedItem[];
  heaviest: string;
  freest: string;
}

export function brief(
  b: Behind,
  a: Ahead,
  code: (id: string) => string,
): string {
  const lines = [
    `The week just gone (${b.label}):`,
    `- Deadlines ticked: ${
      b.done.length === 0 ? 'none' : b.done.map((i) => `${code(i.c)} ${i.title}`).join('; ')
    }`,
    `- Deadlines that went by unticked: ${
      b.slipped.length === 0 ? 'none' : b.slipped.map((i) => `${code(i.c)} ${i.title}`).join('; ')
    }`,
    `- Your own tasks: ${b.tasksDone} done, ${b.tasksOpen} still open`,
    `- Cards drilled: ${b.cardsDrilled}`,
    `- Practice papers sat: ${
      b.papers.length === 0
        ? 'none'
        : b.papers.map((p) => `${code(p.courseId)} ${p.pct}%`).join('; ')
    }`,
    `- Overdue across the whole semester, as of now: ${b.overdue}`,
    '',
    'The week coming:',
    `- Hours already promised: ${a.promised}`,
    `- Due: ${
      a.due.length === 0
        ? 'nothing'
        : a.due.map((i) => `${code(i.c)} ${i.title} (${i.dueShort})`).join('; ')
    }`,
  ];
  if (a.heaviest) lines.push(`- Heaviest day: ${a.heaviest}`);
  if (a.freest) lines.push(`- Most room: ${a.freest}`);
  return lines.join('\n');
}

/** The report as a document, for printing or keeping. */
export function document(
  b: Behind,
  a: Ahead,
  code: (id: string) => string,
  said: string,
): string {
  const lines = [`# Week of ${b.label}`, '', `## What happened`, '', behindLine(b)];

  if (b.done.length > 0) {
    lines.push('', '**Finished**', ...b.done.map((i) => `- ${code(i.c)} — ${i.title}`));
  }
  if (b.slipped.length > 0) {
    lines.push('', '**Still open**', ...b.slipped.map((i) => `- ${code(i.c)} — ${i.title}`));
  }
  if (b.papers.length > 0) {
    lines.push(
      '',
      '**Practice papers**',
      ...b.papers.map((p) => `- ${code(p.courseId)} — ${p.pct}% (${p.got}/${p.outOf})`),
    );
  }

  lines.push('', '## The week coming', '', `${a.promised} hours already promised.`);
  if (a.due.length > 0) {
    lines.push('', '**Due**', ...a.due.map((i) => `- ${i.dueShort} — ${code(i.c)} — ${i.title}`));
  }
  if (said.trim()) lines.push('', '## Read against it', '', said.trim());
  return lines.join('\n');
}
