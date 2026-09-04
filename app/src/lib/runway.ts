/**
 * The four weeks before an exam, counted backwards from it.
 *
 * `lib/ahead.ts` answers "what does this week ask of me". Nothing answered
 * "it is three weeks to the ECON midterm and I have four other things", which
 * is the question every semester turns on: three or four weeks decide it, and
 * the app treated week 11 exactly like week 3.
 *
 * ## Backwards, and in weeks
 *
 * A runway is the exam's own countdown, so it is measured from the exam and
 * not from today: three weeks out, two, one, the last few days. Those bands
 * are where the advice differs in kind rather than in degree — at three weeks
 * the useful move is to find out what you do not know, at three days it is to
 * stop finding out and start rehearsing — and a smooth percentage would blur
 * exactly the distinction worth drawing.
 *
 * ## What is counted and what is not
 *
 * Counted: units you have not drilled, cards you have never answered, cards
 * that are due back, papers sat and what they scored, and every other deadline
 * standing between now and the exam. Every one of those is a number the app
 * already holds.
 *
 * Not counted: readiness. There is no score here and there will not be one —
 * the same refusal `ahead.ts` and `stats.ts` make, for the same reason. A
 * percentage claiming to say whether you will pass would be believed, and the
 * app cannot know. What it can do is put the counts next to the days and let
 * a person draw their own conclusion.
 */

import type { CourseId, DatedItem } from './types';
import type { Sitting } from './sitting';

/** How far out you are, in the only bands where the answer differs. */
export type Band = 'far' | 'three' | 'two' | 'one' | 'days' | 'today' | 'past';

export interface Stage {
  band: Band;
  /** "Three weeks out". */
  label: string;
  /** What the work is at this distance, in one line. Never a prescription. */
  shape: string;
}

export const STAGES: Stage[] = [
  {
    band: 'far',
    label: 'More than a month out',
    shape: 'Nothing to do differently yet. The runway starts at four weeks.',
  },
  {
    band: 'three',
    label: 'Three to four weeks out',
    shape: 'The weeks for finding out what you do not know, while there is time to fix it.',
  },
  {
    band: 'two',
    label: 'Two weeks out',
    shape: 'Wide before deep: every unit touched once beats one unit learned perfectly.',
  },
  {
    band: 'one',
    label: 'The last week',
    shape: 'Papers under a clock. What you miss now is what to spend the last days on.',
  },
  {
    band: 'days',
    label: 'The last few days',
    shape: 'Rehearsal rather than discovery. New material this late rarely survives to the room.',
  },
  { band: 'today', label: 'Today', shape: 'Nothing left to learn. Sleep is the last useful input.' },
  { band: 'past', label: 'Sat', shape: '' },
];

export function bandFor(daysAway: number): Band {
  if (daysAway < 0) return 'past';
  if (daysAway === 0) return 'today';
  if (daysAway <= 3) return 'days';
  if (daysAway <= 7) return 'one';
  if (daysAway <= 14) return 'two';
  if (daysAway <= 28) return 'three';
  return 'far';
}

export function stageFor(daysAway: number): Stage {
  const band = bandFor(daysAway);
  return STAGES.find((s) => s.band === band) ?? STAGES[0];
}

/** Which deadlines count as an exam worth a runway. */
export function isExam(item: { kind: string; title: string; weight: string }): boolean {
  if (/exam|midterm|final|test\b/i.test(`${item.kind} ${item.title}`)) return true;
  // A "project" or a "paper" worth thirty per cent is an exam in everything
  // but name, and deserves the same four weeks.
  const weight = Number.parseFloat(item.weight.replace(/[^\d.]/g, ''));
  return Number.isFinite(weight) && weight >= 25;
}

export interface UnitState {
  name: string;
  /** Cards in the unit. */
  cards: number;
  /** Cards answered at least once. */
  seen: number;
  /** Cards due for review by the exam. */
  due: number;
}

export interface Runway {
  exam: DatedItem;
  daysAway: number;
  stage: Stage;
  /** Units of the course's guide, with what you have done to each. */
  units: UnitState[];
  /** Units you have never opened a card in. */
  untouched: number;
  /** Cards you have never answered. */
  unseen: number;
  /** Cards that will be due again before the exam. */
  dueBefore: number;
  /** Practice papers sat for this course, newest first. */
  papers: Sitting[];
  /** Everything else due between now and the exam, in the way. */
  between: DatedItem[];
  /** Days between now and the exam that carry another deadline. */
  clearDays: number;
}

export interface RunwayInput {
  exam: DatedItem;
  units: UnitState[];
  papers: Sitting[];
  /** Every other undone deadline, any course. */
  others: DatedItem[];
}

export function runway(input: RunwayInput): Runway {
  const { exam, units, papers, others } = input;
  // `daysAway` is the decorated field `decorateItem` already computed. Working
  // it out again from `exam.date` would be a second place for it to be wrong.
  const daysAway = exam.daysAway;

  const between = others
    .filter((i) => i.id !== exam.id && i.daysAway >= 0 && i.daysAway <= daysAway)
    .sort((a, b) => a.daysAway - b.daysAway);

  const busy = new Set(between.map((i) => i.daysAway));

  return {
    exam,
    daysAway,
    stage: stageFor(daysAway),
    units,
    untouched: units.filter((u) => u.seen === 0 && u.cards > 0).length,
    unseen: units.reduce((n, u) => n + (u.cards - u.seen), 0),
    dueBefore: units.reduce((n, u) => n + u.due, 0),
    papers: [...papers].sort((a, b) => b.at - a.at),
    between,
    // Days with nothing else standing on them. The exam's own day does not
    // count as free, and neither does today, which is half gone.
    clearDays: Math.max(0, daysAway - 1 - busy.size),
  };
}

/**
 * The headline. Counts and days, never a verdict.
 *
 * Deliberately two clauses: how long you have, and what is standing in the
 * way. The second is the half people forget, and it is the half that decides
 * whether the first is a lot of time or none at all.
 */
export function headline(r: Runway): string {
  if (r.daysAway < 0) return 'Sat.';
  if (r.daysAway === 0) return 'Today.';
  const days = r.daysAway === 1 ? 'Tomorrow' : `${r.daysAway} days`;
  if (r.between.length === 0) {
    return `${days}, and nothing else due before it.`;
  }
  return `${days}, with ${r.between.length} other ${
    r.between.length === 1 ? 'deadline' : 'deadlines'
  } in the way.`;
}

/**
 * What the app can honestly say about where you stand, in one line.
 *
 * Every clause is a count of something recorded. Where there is nothing
 * recorded it says that, rather than treating an empty drill history as
 * evidence of anything.
 */
export function standing(r: Runway): string {
  if (r.units.length === 0) return '';
  const total = r.units.reduce((n, u) => n + u.cards, 0);
  if (total === 0) return 'This course has no cards to drill.';
  if (r.unseen === total) {
    return `${r.units.length} units, and you have not drilled any of them yet.`;
  }
  const bits: string[] = [];
  if (r.untouched > 0) {
    bits.push(`${r.untouched} of ${r.units.length} units untouched`);
  }
  if (r.unseen > 0) bits.push(`${r.unseen} cards never answered`);
  if (r.dueBefore > 0) bits.push(`${r.dueBefore} due back`);
  if (bits.length === 0) return 'Every card in this course has been answered at least once.';
  return `${bits.join(', ')}.`;
}

/** The unit to open first: never touched, then most cards outstanding. */
export function weakest(r: Runway): UnitState | null {
  const outstanding = r.units.filter((u) => u.cards > 0 && (u.cards - u.seen > 0 || u.due > 0));
  if (outstanding.length === 0) return null;
  return outstanding.reduce((worst, u) => {
    const score = (x: UnitState) => (x.seen === 0 ? 1000 : 0) + (x.cards - x.seen) + x.due;
    return score(u) > score(worst) ? u : worst;
  });
}

/** How the practice papers have gone, if any have. */
export function paperLine(r: Runway): string {
  if (r.papers.length === 0) return 'No practice papers sat for this course yet.';
  const [latest] = r.papers;
  if (r.papers.length === 1) return `One paper sat, at ${latest.pct}%.`;
  const first = r.papers[r.papers.length - 1];
  const move = latest.pct - first.pct;
  const direction = move > 0 ? `up ${move}` : move < 0 ? `down ${-move}` : 'level';
  return `${r.papers.length} papers, latest ${latest.pct}% — ${direction} from the first.`;
}

/** Every exam ahead, soonest first, for choosing which runway to look at. */
export function examsAhead(items: DatedItem[], done: Record<string, boolean>): DatedItem[] {
  return items
    .filter((i) => !done[i.id] && i.daysAway >= 0 && isExam(i))
    .sort((a, b) => a.daysAway - b.daysAway);
}

/** Which course an exam belongs to, for the caller to fetch the right guide. */
export function courseOf(exam: DatedItem): CourseId {
  return exam.c;
}
