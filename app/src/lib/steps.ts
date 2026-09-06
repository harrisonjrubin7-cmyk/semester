/**
 * Turning one deadline into the evenings it actually takes.
 *
 * "Ten-page paper, due Friday" is a single row in a list and a fortnight of
 * work, and the gap between those two facts is where most of a term goes
 * wrong. Nobody misses a paper because they forgot it existed. They miss it
 * because it stayed one undifferentiated block until the night before.
 *
 * So the app can break it up: a handful of named steps, each on a date, put
 * into the same personal task list as everything else somebody adds by hand.
 *
 * ## They are tasks, not a new kind of thing
 *
 * Deliberately. A separate "plan" object would need its own screen, its own
 * ticking, its own sync strategy and its own place in the week's hours — four
 * things that already exist for tasks. What comes out of here is ordinary
 * rows, editable and deletable like any other, and the plan stops being a
 * thing the app owns the moment it is made.
 *
 * ## What it will not do
 *
 * It does not estimate how long each step takes. The app knows how long *kinds
 * of work* take this student — see `lib/pace.ts` — but not how long "gather
 * sources" takes, and inventing an hour figure per step would be four made-up
 * numbers dressed as a schedule.
 *
 * It also does not plan past what there is time for. Asked on the day before,
 * it gives one step, not five compressed into an evening.
 */

import { normalKind } from './pace';

/** One named piece of the work, and the day it belongs on. */
export interface Step {
  title: string;
  /** ISO date, matching `PersonalTask.date`. */
  date: string;
}

/**
 * The shape of the work, per kind.
 *
 * Ordered first to last. These are the steps somebody would name themselves
 * if asked — they are not a methodology, and the app is not claiming one.
 * A kind it does not recognise gets the generic run, which is still better
 * than one block.
 */
const SHAPES: Record<string, string[]> = {
  essay: ['Pick the argument', 'Gather sources', 'Outline it', 'Write the draft', 'Revise', 'Proofread and submit'],
  'problem set': ['Read all the questions', 'First pass', 'Go back to the stuck ones', 'Check and submit'],
  project: ['Scope it', 'Gather what you need', 'Build the first version', 'Review', 'Finish and submit'],
  presentation: ['Decide the through-line', 'Make the slides', 'Rehearse once', 'Rehearse again and submit'],
  reading: ['First half', 'Second half', 'Notes on it'],
  response: ['Read it', 'Draft the response', 'Tighten and submit'],
  lab: ['Read the brief', 'Do the work', 'Write it up', 'Check and submit'],
  quiz: ['Review the units', 'Drill the weak ones', 'Last look'],
  // Studying, not producing. Without this an exam fell to the generic run and
  // was told to "finish and submit" a closed-note midterm sat in a room.
  exam: [
    'Work out what it covers',
    'First pass through the units',
    'Drill what is weak',
    'Sit a practice paper',
    'Last look',
  ],
};

const GENERIC = ['Start it', 'Main pass', 'Finish and submit'];

/** How many days out this is worth doing at all. Below one, there is no plan. */
export const LEAST_DAYS = 1;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The step names for a kind of work, without dates on them yet. */
export function shapeOf(kind: string): string[] {
  return SHAPES[normalKind(kind)] ?? GENERIC;
}

/**
 * The steps, dated backwards from the deadline.
 *
 * The last step lands on the due date and the rest are spread evenly over the
 * days before it. Evenly rather than front-loaded: the app does not know what
 * else is in those days — the week's own hours do — and pretending to know
 * would put "Write the draft" on the evening of somebody's shift.
 *
 * Returns an empty list when there is no room for a plan. A deadline today or
 * tomorrow does not need breaking up; it needs doing.
 */
export function planFor(kind: string, due: Date, now: Date, most = 6): Step[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < LEAST_DAYS) return [];

  const shape = shapeOf(kind);
  // Never more steps than days, so two never land on one evening, and never
  // more than the shape has to give.
  const n = Math.min(shape.length, most, days + 1);
  // The steps that survive a squeeze are the first and the last — starting and
  // submitting — so a short run drops from the middle rather than the end.
  const picked = n >= shape.length ? shape : [shape[0], ...shape.slice(-(n - 1))];

  return picked.map((title, i) => {
    // The last lands on the due date; the rest spread back evenly from it.
    const back = Math.round(((picked.length - 1 - i) * days) / Math.max(1, picked.length - 1));
    const on = new Date(end);
    on.setDate(on.getDate() - back);
    return { title, date: iso(on) };
  });
}

/** What the button says it will do, before it does it. */
export function planLine(steps: Step[], title: string): string {
  if (steps.length === 0) return `${title} is too close to break up. It needs doing rather than planning.`;
  return `${steps.length} steps, from ${steps[0].date.slice(5)} to the day it is due.`;
}
