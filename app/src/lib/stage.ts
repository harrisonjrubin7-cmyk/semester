/**
 * How far a piece of coursework has got, in the seven words §91 uses.
 *
 * `lib/standing.ts` answers where a deadline sits relative to today — ahead,
 * overdue, done — and `lib/underway.ts` added the middle state a tick box
 * cannot hold. §91 asks for seven:
 *
 * ```
 * NOT_STARTED  PLANNED  IN_PROGRESS  READY_TO_SUBMIT  SUBMITTED  GRADED  MISSED
 * ```
 *
 * **Five of them were already in the store, two of those under other names.**
 * That is the whole reason this file is ninety lines of derivation and two new
 * fields rather than seven:
 *
 * | § | where it already lives |
 * | --- | --- |
 * | `NOT_STARTED` | nothing recorded |
 * | `PLANNED` | `task.from`, written by `components/BreakItUp.tsx` when a deadline is broken into steps |
 * | `IN_PROGRESS` | `state.started` — `lib/underway.ts` |
 * | `MISSED` | `item.isPast` against `state.done` — `lib/standing.ts` |
 * | `GRADED` | `state.returned` — `lib/returned.ts`, which has recorded the moment a mark came back, and the mark, since the regrade countdown was built |
 *
 * Storing either of those two again would have been a second record of one
 * fact, which is the failure this repository keeps finding in its own store:
 * two places to write it, one place read, and the disagreement surfacing months
 * later as a status that contradicts the panel underneath it. So `PLANNED` and
 * `GRADED` are derived here and stored nowhere.
 *
 * Two facts were genuinely missing, and they are the two that happen after the
 * work is finished and before the mark arrives:
 *
 * - `ready` — the writing is finished and it has not gone anywhere.
 * - `submitted` — it was handed in, and when.
 *
 * ## The case this file exists for
 *
 * > **Finished, never handed in, and the date has gone.**
 *
 * A tick box cannot express it, so the app could not warn about it, and it is
 * the most expensive thing that happens to coursework that was actually done.
 * `finishedNotHandedIn` is the whole point; the vocabulary is what makes it
 * sayable.
 *
 * ## Independent facts, not an enum
 *
 * `state.started` exists because starting and finishing are independent facts
 * and an enum collapsing them loses one — un-ticking a finished paper must not
 * forget it was ever begun. The same argument applies to both new maps, so they
 * are two maps of id to a moment and the status is derived. A quiz is marked
 * without ever being submitted, and a paper is uploaded a fortnight before it
 * comes back, so no fact here is read off another.
 *
 * One implication, in one direction, and it is written into the reducer rather
 * than here: marking something handed in also ticks it off, because every list
 * in the app reads `state.done` to decide whether a deadline was missed, and a
 * paper reading *Handed in* on its own page and *missed* in the list it was
 * opened from is one fact told two ways. Un-marking it does not un-tick —
 * retracting the claim that the work went somewhere is not a claim that it was
 * never finished. See the `markStage` case in `state/slices/settings.ts`.
 *
 * Two maps rather than one record per item, which would have been one persisted
 * field instead of two. `lib/merge.ts` merges a map of ids by keeping every key
 * from both devices (`ticks`); where both hold the *same* key, one side's value
 * wins whole. One record per item therefore loses a mark when the laptop
 * records the upload and the phone records something else about the same paper.
 * Two flat maps do not.
 */

import type { DatedItem } from './types';
import type { DoneMap } from './standing';
import type { StartedMap } from './underway';
import type { Returned } from './returned';

/** §91's status vocabulary, exactly. */
export type ItemStatus =
  | 'NOT_STARTED'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTED'
  | 'GRADED'
  | 'MISSED';

/** In the order work passes through them. `MISSED` is not a point on that line. */
export const STATUSES: ItemStatus[] = [
  'NOT_STARTED',
  'PLANNED',
  'IN_PROGRESS',
  'READY_TO_SUBMIT',
  'SUBMITTED',
  'GRADED',
  'MISSED',
];

/**
 * The two facts that are stored.
 *
 * `ItemStage` rather than `Stage`, which `lib/apply.ts` already owns for a job
 * application's six. Two unrelated `Stage` types imported into one file is the
 * sort of collision that gets resolved by aliasing at the import and then read
 * wrong six months later.
 */
export type ItemStage = 'ready' | 'submitted';

export const ITEM_STAGES: ItemStage[] = ['ready', 'submitted'];

/** Deadline id to the moment that stage was reached, epoch ms. */
export type StageMap = Record<string, number>;

/** Everything `statusOf` reads: two stored maps, two borrowed, two derived. */
export interface Progress {
  ready: StageMap;
  submitted: StageMap;
  started: StartedMap;
  done: DoneMap;
  /** Ids with a task made for them. §91's `PLANNED`, derived. */
  planned: ReadonlySet<string>;
  /** Ids a mark has come back for. §91's `GRADED`, derived. */
  graded: ReadonlySet<string>;
}

/** The deadlines somebody has broken into steps. */
export function plannedIds(tasks: readonly { from?: string }[]): Set<string> {
  const out = new Set<string>();
  for (const t of tasks) if (t.from) out.add(t.from);
  return out;
}

/** The deadlines a mark has come back for. */
export function gradedIds(returned: readonly Pick<Returned, 'id'>[]): Set<string> {
  return new Set(returned.map((r) => r.id));
}

/**
 * The six pieces of the store this reads, assembled.
 *
 * One function so that a screen cannot assemble five of the six and get a
 * status that is quietly behind where the work is — the failure mode of a
 * derived value with six inputs is a caller that forgets one, and it fails
 * silently because five inputs still produce a plausible answer.
 */
export function progressFrom(state: {
  ready: StageMap;
  submitted: StageMap;
  started: StartedMap;
  done: DoneMap;
  tasks: readonly { from?: string }[];
  returned: readonly Pick<Returned, 'id'>[];
}): Progress {
  return {
    ready: state.ready,
    submitted: state.submitted,
    started: state.started,
    done: state.done,
    planned: plannedIds(state.tasks),
    graded: gradedIds(state.returned),
  };
}

/**
 * Which of the seven this deadline is at.
 *
 * Read down. Every line is a fact that is true on its own, and the first one
 * that holds is the furthest this has got — which is why recording a mark
 * before an upload, or retracting either, cannot produce a status behind where
 * the work actually is.
 *
 * Two orderings in here are decisions rather than arithmetic:
 *
 * - **The tick beats the date.** `lib/standing.ts` settled it — *"Done wins
 *   over overdue — something handed in late is finished, not still bleeding"* —
 *   and a second answer here would put a paper in one status on the deadline
 *   list and another on its own page.
 * - **The date beats `ready`.** This is the case the whole file is for.
 *   `ready` says the work is finished and says nothing went anywhere; if the
 *   day has gone by and nothing was handed in, that is missed, and calling it
 *   `READY_TO_SUBMIT` would be the app looking at the one situation it could
 *   still warn somebody about and reporting it as fine.
 *
 * No clock is passed in. `isPast` is stamped on a `DatedItem` when it is dated
 * — `lib/date.ts`, against the store's own clock — and reading "now" a second
 * time here would let this page call a deadline missed while the list it was
 * opened from does not.
 */
export function statusOf(item: DatedItem, p: Progress): ItemStatus {
  if (p.graded.has(item.id)) return 'GRADED';
  if (p.submitted[item.id]) return 'SUBMITTED';
  if (p.done[item.id]) return 'READY_TO_SUBMIT';
  if (item.isPast) return 'MISSED';
  if (p.ready[item.id]) return 'READY_TO_SUBMIT';
  if (p.started[item.id]) return 'IN_PROGRESS';
  if (p.planned.has(item.id)) return 'PLANNED';
  return 'NOT_STARTED';
}

/**
 * The status in words somebody would use.
 *
 * `READY_TO_SUBMIT` has two of them, because it is reached two ways and they do
 * not mean the same thing to the person reading the row. Pressing *It is ready
 * to hand in* is a statement about a thing that still has to go somewhere;
 * ticking *Mark done* is a statement that there is nothing left to do, and a
 * reading or an in-class quiz is finished when it is finished. One word for the
 * specification's sake, a true sentence for the student's.
 */
export function statusLabel(item: DatedItem, p: Progress): string {
  switch (statusOf(item, p)) {
    case 'GRADED':
      return 'Graded';
    case 'SUBMITTED':
      return 'Handed in';
    case 'READY_TO_SUBMIT':
      return p.ready[item.id] && !p.done[item.id] ? 'Ready to hand in' : 'Finished';
    case 'MISSED':
      return 'Missed';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'PLANNED':
      return 'Planned';
    default:
      return 'Not started';
  }
}

/**
 * Finished, nothing says it was ever handed in, and the day has gone.
 *
 * The sentence this file exists to make sayable. Deliberately narrower than
 * "missed": a paper nobody started is a different problem with a different
 * answer, and mixing the two buries the rows somebody can still do something
 * about in the thirty they cannot.
 */
export function finishedNotHandedIn(items: readonly DatedItem[], p: Progress): DatedItem[] {
  return items.filter(
    (i) =>
      i.isPast &&
      Boolean(p.ready[i.id]) &&
      !p.submitted[i.id] &&
      !p.graded.has(i.id) &&
      !p.done[i.id],
  );
}

/** Marking a stage, or unmarking it. A new map rather than a mutated one. */
export function toggleStage(id: string, map: StageMap, at: number): StageMap {
  if (map[id]) {
    const next = { ...map };
    delete next[id];
    return next;
  }
  return { ...map, [id]: at };
}

/** Stored values made safe. The reading `readStarted` does, for the same reason. */
export function readStage(raw: unknown): StageMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: StageMap = {};
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof at === 'number' && at > 0) out[id] = at;
  }
  return out;
}

/** How many deadlines sit at each of the seven. For a screen that summarises. */
export function countByStatus(items: readonly DatedItem[], p: Progress): Record<ItemStatus, number> {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ItemStatus, number>;
  for (const i of items) out[statusOf(i, p)] += 1;
  return out;
}
