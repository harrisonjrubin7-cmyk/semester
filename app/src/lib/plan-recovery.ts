import { dateToIso, isoToDate, shiftIso } from './date';
import { formatDate } from './locale';
import { SOURCE_TEXT, sourceLine, type SourceLabel } from './source';
import type { NeedId } from './help-routes';

/**
 * Recovery Mode: what to do when something in a plan changes underneath it.
 *
 * A section is cancelled, a lab moves, a shift lands on an exam, an advisor
 * cancels, a deadline moves or passes, a source goes stale or shows up twice,
 * a course fills. None of it is the student's doing, and the worst response to
 * any of it is a screen that rearranges their term for them or tells them how
 * bad it is.
 *
 * ## Two scenarios and one decision
 *
 * `openRecovery` takes a deep copy of the plan as it stands and calls it
 * Scenario A. The copy is frozen, nothing else in the module holds the
 * caller's plan, and no function here writes to either. Scenario B is the same
 * plan with one proposed edit applied to a second copy. The student reads both
 * (`differences` says what is not the same) and decides.
 *
 * `confirm` is the single function that hands back a plan, and it hands back
 * Scenario B only for a recovery whose student has chosen an option that edits
 * the plan. Opening, choosing and looking never change anything; `keepCurrent`
 * closes the recovery and returns nothing, so the plan the caller already holds
 * is the plan. There is no timer, no default option and no "apply the best one".
 *
 * ## At most five options, always including two
 *
 * Every recovery carries "keep my plan as it is" and a route to a person or an
 * official office, and the rest come from a fixed set so the choices are the
 * same ones every time. Nothing is ordered by how good it is: the list reads in
 * the order of the table below.
 *
 * ## What it says, and does not
 *
 * Every line starts from the fact (what changed, what is affected, what still
 * stands) and ends in something the student can do. The uncertainty line
 * carries the source label and how old it is, because a cancelled section
 * reported by a feed read three weeks ago is a different thing to act on from
 * one the registrar posted this morning.
 */

export type ItemKind = 'class' | 'lab' | 'shift' | 'exam' | 'advisor' | 'deadline' | 'registration' | 'calendar' | 'task';

export interface PlanItem {
  id: string;
  kind: ItemKind;
  title: string;
  /** YYYY-MM-DD, or null for something without a day yet. */
  day: string | null;
  /** Minutes after midnight, or null. */
  startMin: number | null;
  endMin: number | null;
  source: SourceLabel;
  /** When the source was last read, epoch ms. */
  sourceAt: number | null;
}

export interface Plan {
  items: PlanItem[];
}

export const EVENT_TYPES = [
  'section_cancelled',
  'lab_time_changed',
  'shift_overlaps_exam',
  'advisor_cancelled',
  'deadline_moved',
  'deadline_missed',
  'stale_source',
  'duplicate_calendar',
  'course_full',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface RecoveryEvent {
  type: EventType;
  /** The item the change is about. */
  itemId: string;
  /** The other item involved: the exam a shift overlaps, or the entry a duplicate repeats. */
  otherId?: string;
  newDay?: string;
  newStartMin?: number;
  newEndMin?: number;
}

export const OPTION_IDS = [
  'accept_change',
  'add_placeholder',
  'move_work_earlier',
  'remove_item',
  'remove_duplicate',
  'refresh_source',
  'ask_instructor',
  'ask_advisor',
  'ask_employer',
  'keep_current',
  'official',
] as const;
export type OptionId = (typeof OPTION_IDS)[number];

/** Which fixed options each event offers, in the order a student reads them. Never more than five. */
export const OPTIONS_FOR: Record<EventType, readonly OptionId[]> = {
  section_cancelled: ['add_placeholder', 'remove_item', 'ask_advisor', 'keep_current', 'official'],
  lab_time_changed: ['accept_change', 'ask_instructor', 'keep_current', 'official'],
  shift_overlaps_exam: ['ask_employer', 'ask_instructor', 'keep_current', 'official'],
  advisor_cancelled: ['add_placeholder', 'remove_item', 'keep_current', 'official'],
  deadline_moved: ['accept_change', 'move_work_earlier', 'keep_current', 'official'],
  deadline_missed: ['ask_instructor', 'add_placeholder', 'keep_current', 'official'],
  stale_source: ['refresh_source', 'keep_current', 'official'],
  duplicate_calendar: ['remove_duplicate', 'refresh_source', 'keep_current', 'official'],
  course_full: ['add_placeholder', 'ask_advisor', 'keep_current', 'official'],
};

export const MAX_OPTIONS = 5;

export type PlanEdit =
  | { op: 'update'; id: string; patch: Partial<Pick<PlanItem, 'day' | 'startMin' | 'endMin' | 'title'>> }
  | { op: 'remove'; id: string }
  | { op: 'add'; item: PlanItem };

export interface RecoveryOption {
  id: OptionId;
  label: string;
  detail: string;
  /** The edit this option would make to the plan, or null if it makes none. */
  edit: PlanEdit | null;
}

export interface HumanRoute {
  need: NeedId;
  label: string;
  note: string;
}

/** Who to ask, per event. Always a person or an office, never the app. */
const ROUTES: Record<EventType, HumanRoute> = {
  section_cancelled: { need: 'registration', label: 'Registrar or your advisor', note: 'They can confirm the cancellation and what replaces it.' },
  lab_time_changed: { need: 'course', label: 'Your instructor or TA', note: 'They can confirm the new time and whether another one exists.' },
  shift_overlaps_exam: { need: 'course', label: 'Your instructor, and the person who sets your shifts', note: 'Both can often move something once they know early.' },
  advisor_cancelled: { need: 'registration', label: 'Your advisor’s office', note: 'The office can rebook you, often sooner than a reminder would.' },
  deadline_moved: { need: 'course', label: 'Your instructor or the course page', note: 'The course page is the official date.' },
  deadline_missed: { need: 'course', label: 'Your instructor or TA', note: 'Extensions and new dates are theirs to give, and asking is routine.' },
  stale_source: { need: 'registration', label: 'The official source itself', note: 'Open the institution’s own page for the current version.' },
  duplicate_calendar: { need: 'registration', label: 'Your institution’s IT or calendar help', note: 'If the same feed appears twice, they can say which one to keep.' },
  course_full: { need: 'registration', label: 'Registrar or your advisor', note: 'They know about waitlists, overrides and other sections.' },
};

export type Resolution = 'open' | 'kept' | 'confirmed';

export interface RecoverySteps {
  /** Step 1. Says the change is not the student's doing. */
  acknowledge: string;
  /** Step 2. What the change touches. */
  impact: string[];
  /** Step 3. Everything in the plan the change does not touch. */
  stillWorks: string[];
  /** Step 4. Three to five options from the fixed set. */
  options: RecoveryOption[];
  /** Step 5. Where the information came from and how old it is. */
  uncertainty: string;
  /** Step 6. The person or office to ask. */
  humanRoute: HumanRoute;
}

export interface Recovery {
  event: RecoveryEvent;
  /** The plan exactly as it was when this opened. A frozen deep copy. */
  scenarioA: Readonly<Plan>;
  /** The plan with the chosen option applied; before a choice, with the first editing option. */
  scenarioB: Plan;
  steps: RecoverySteps;
  chosen: OptionId | null;
  resolution: Resolution;
}

export const SCENARIO_A = 'Scenario A: your plan as it is now';
export const SCENARIO_B = 'Scenario B: your plan with this change';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const copyPlan = (plan: Plan): Plan => structuredClone(plan);

/** A plan with one edit applied, as a new plan. The input is not written to. */
export function applyEdit(plan: Plan, edit: PlanEdit): Plan {
  const next = copyPlan(plan);
  if (edit.op === 'add') {
    if (!next.items.some((i) => i.id === edit.item.id)) next.items.push(structuredClone(edit.item));
  } else if (edit.op === 'remove') {
    next.items = next.items.filter((i) => i.id !== edit.id);
  } else {
    next.items = next.items.map((i) => (i.id === edit.id ? { ...i, ...edit.patch } : i));
  }
  return next;
}

const find = (plan: Plan, id: string | undefined): PlanItem | undefined => plan.items.find((i) => i.id === id);

const CHANGED: Record<EventType, (title: string) => string> = {
  section_cancelled: (t) => `${t} has been cancelled.`,
  lab_time_changed: (t) => `${t} has a new time.`,
  shift_overlaps_exam: (t) => `${t} overlaps with an exam.`,
  advisor_cancelled: (t) => `${t} has been cancelled by the advisor’s office.`,
  deadline_moved: (t) => `The date for ${t} has moved.`,
  deadline_missed: (t) => `The date for ${t} has passed.`,
  stale_source: (t) => `The source for ${t} may be out of date.`,
  duplicate_calendar: (t) => `${t} appears twice in your calendar.`,
  course_full: (t) => `${t} is full.`,
};

function when(i: PlanItem): string {
  return i.day ? formatDate(isoToDate(i.day), { weekday: 'short', month: 'short', day: 'numeric' }) : 'no day yet';
}

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const slot = (i: PlanItem) => (i.startMin === null ? when(i) : `${when(i)} ${clock(i.startMin)}${i.endMin === null ? '' : `–${clock(i.endMin)}`}`);

function optionFor(id: OptionId, event: RecoveryEvent, plan: Plan, now: Date): RecoveryOption {
  const item = find(plan, event.itemId);
  const title = item?.title ?? 'this item';
  const placeholder = (label: string, day: string | null): PlanEdit => ({
    op: 'add',
    item: { id: `recovery-${event.type}-${event.itemId}`, kind: 'task', title: label, day, startMin: null, endMin: null, source: 'student_entered', sourceAt: now.getTime() },
  });
  switch (id) {
    case 'accept_change':
      return {
        id,
        label: 'Update my plan to the new details',
        detail: `${title} moves to the new time. Everything else stays where it is.`,
        edit: item
          ? { op: 'update', id: item.id, patch: { day: event.newDay ?? item.day, startMin: event.newStartMin ?? item.startMin, endMin: event.newEndMin ?? item.endMin } }
          : null,
      };
    case 'add_placeholder':
      return {
        id,
        label: 'Add a reminder to sort this out',
        detail: 'An action with no day, so it sits on your list until you choose when.',
        edit: placeholder(`Sort out: ${title}`, null),
      };
    case 'move_work_earlier': {
      const target = event.newDay ?? item?.day ?? null;
      const day = target ? [shiftIso(target, -2), dateToIso(now)].sort().at(-1)! : null;
      return {
        id,
        label: 'Add an earlier work block',
        detail: 'A block two days before the new date, or today if that has gone. Move it as you like.',
        edit: placeholder(`Work block for ${title}`, day),
      };
    }
    case 'remove_item':
      return { id, label: 'Take it off my plan', detail: 'You can add it back later.', edit: item ? { op: 'remove', id: item.id } : null };
    case 'remove_duplicate':
      return {
        id,
        label: 'Hide the repeated entry',
        detail: 'Removes the second copy from your plan, not from your calendar app.',
        edit: event.otherId && find(plan, event.otherId) ? { op: 'remove', id: event.otherId } : null,
      };
    case 'refresh_source':
      return { id, label: 'Check the source again', detail: 'Re-read the feed or page this came from before changing anything.', edit: null };
    case 'ask_instructor':
      return { id, label: 'Ask your instructor or TA', detail: 'A short note is enough. They can say what is possible.', edit: null };
    case 'ask_advisor':
      return { id, label: 'Ask your advisor', detail: 'They know the alternatives and the deadlines for changing course.', edit: null };
    case 'ask_employer':
      return { id, label: 'Ask whether the shift can move', detail: 'Early notice usually gives the most room.', edit: null };
    case 'keep_current':
      return { id, label: 'Keep my plan as it is', detail: 'Nothing changes. You can come back to this.', edit: null };
    case 'official':
      return { id, label: 'Check with the official office', detail: ROUTES[event.type].label + '.', edit: null };
  }
}

function uncertainty(item: PlanItem | undefined, now: Date): string {
  if (!item) return 'This item is not in your plan, so there is no source to date. Check the official page.';
  const base = item.sourceAt ? sourceLine(item.source, item.sourceAt, now.getTime()) : `${SOURCE_TEXT[item.source]} · age unknown`;
  return `${base}. Confirm with the official source before relying on it.`;
}

/**
 * Begin a recovery. Pure: reads the plan, returns a new object, changes
 * nothing. The plan the caller holds is not referenced afterwards.
 */
export function openRecovery(event: RecoveryEvent, plan: Plan, now: Date): Recovery {
  const scenarioA = deepFreeze(copyPlan(plan));
  const item = find(scenarioA, event.itemId);
  const other = find(scenarioA, event.otherId);

  const affected = [item, other].filter((i): i is PlanItem => !!i);
  const touched = new Set(affected.map((i) => i.id));
  const impact = [
    item ? CHANGED[event.type](item.title) : 'Something in your plan has changed, and the item is not on it.',
    ...affected.map((i) => `${i.title}: ${slot(i)}.`),
  ];
  const options = OPTIONS_FOR[event.type].slice(0, MAX_OPTIONS).map((id) => optionFor(id, event, scenarioA, now));
  const first = options.find((o) => o.edit);

  return {
    event: { ...event },
    scenarioA,
    scenarioB: first?.edit ? applyEdit(scenarioA, first.edit) : copyPlan(scenarioA),
    steps: {
      acknowledge: 'Plans change, and this change came from outside yours. There is time to decide what to do.',
      impact,
      stillWorks: scenarioA.items.filter((i) => !touched.has(i.id)).map((i) => i.title),
      options,
      uncertainty: uncertainty(item, now),
      humanRoute: { ...ROUTES[event.type] },
    },
    chosen: null,
    resolution: 'open',
  };
}

/**
 * Look at an option: Scenario B becomes the plan with that option's edit, or
 * the plan unchanged if it makes none. Nothing is applied.
 */
export function choose(r: Recovery, id: OptionId): Recovery {
  const option = r.steps.options.find((o) => o.id === id);
  if (!option || r.resolution !== 'open') return r;
  return { ...r, chosen: id, scenarioB: option.edit ? applyEdit(r.scenarioA, option.edit) : copyPlan(r.scenarioA) };
}

/**
 * The one function that returns a replaced plan: Scenario B, for a recovery
 * still open whose student has chosen an option that edits the plan. For any
 * other recovery it returns null, and the plan the caller holds is the plan.
 */
export function confirm(r: Recovery): Plan | null {
  if (r.resolution !== 'open' || r.chosen === null) return null;
  const option = r.steps.options.find((o) => o.id === r.chosen);
  if (!option?.edit) return null;
  return copyPlan(r.scenarioB);
}

/** Close the recovery with the plan as it is. Returns no plan, so there is nothing to apply. */
export function keepCurrent(r: Recovery): Recovery {
  return { ...r, chosen: 'keep_current', scenarioB: copyPlan(r.scenarioA), resolution: 'kept' };
}

/** After the student applied what `confirm` returned. */
export function markConfirmed(r: Recovery): Recovery {
  return r.chosen && r.resolution === 'open' ? { ...r, resolution: 'confirmed' } : r;
}

/** What is not the same between Scenario A and Scenario B, in sentences. */
export function differences(r: Recovery): string[] {
  const a = new Map(r.scenarioA.items.map((i) => [i.id, i]));
  const b = new Map(r.scenarioB.items.map((i) => [i.id, i]));
  const lines: string[] = [];
  for (const [id, i] of a) {
    const j = b.get(id);
    if (!j) lines.push(`Removed: ${i.title}`);
    else if (JSON.stringify(i) !== JSON.stringify(j)) lines.push(`Changed: ${j.title}, ${slot(i)} to ${slot(j)}`);
  }
  for (const [id, j] of b) if (!a.has(id)) lines.push(`Added: ${j.title}`);
  return lines.length ? lines : ['No difference. Your plan stays as it is.'];
}
