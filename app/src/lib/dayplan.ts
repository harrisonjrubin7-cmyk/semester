import { clock } from './activities';

/**
 * My Commitments: one realistic day out of everything a student has agreed to,
 * not only their classes.
 *
 * `activities.ts` holds the recurring things and `clash.ts` warns about heavy
 * weeks; neither can answer "given everything, does *this Thursday* work, and
 * if not what gives". This is that layer: a single item shape for a class, a
 * shift, practice, an advising appointment, a caregiving block or a personal
 * event; conflict state derived from times and commutes; free windows; and
 * recovery options that are moves the data supports, never advice.
 *
 * ## Derived, not asserted
 *
 * Every conflict here is arithmetic on stated times and stated commute
 * minutes. A missing commute is zero, not a guess. An item with no time is
 * `floating` and is only ever *fitted* into a window that exists; if none does
 * it is reported unplaced rather than squeezed in.
 *
 * ## Recovery is a choice, and sometimes there isn't one
 *
 * Two required, fixed things that overlap cannot be rescheduled away, and the
 * plan says exactly that — the way out is a conversation with somebody. It only
 * suggests skipping something the student marked optional, or moving something
 * they marked flexible.
 *
 * ## Privacy travels with the item
 *
 * `private` items never appear in a shared view. `busy-only` ones appear as
 * "Busy" with no title and no place.
 */

export type Category = 'class' | 'assignment' | 'work' | 'athletics' | 'advising' | 'club' | 'research' | 'career' | 'family' | 'personal' | 'admin';
export type Energy = 'low' | 'medium' | 'high';
export type Privacy = 'private' | 'busy-only';

export interface PlanItem {
  id: string;
  title: string;
  category: Category;
  /** Minutes past midnight; null when it has no fixed time. */
  start: number | null;
  minutes: number;
  required: boolean;
  /** May be moved by the student without asking anyone. */
  flexible: boolean;
  energy: Energy | null;
  /** Travel to here, in minutes. Zero when not stated. */
  commute: number;
  place: string;
  /** Where the item came from: "Syllabus", "You", "Registrar". */
  source: string;
  privacy: Privacy;
}

export type ConflictState = 'clear' | 'overlaps' | 'tight' | 'floating';

export interface Slot {
  item: PlanItem;
  state: ConflictState;
  /** Ids of the fixed items this one overlaps or leaves too little room for. */
  with: string[];
}

export interface Window {
  from: number;
  to: number;
}

export interface Recovery {
  itemId: string;
  kind: 'skip' | 'move' | 'ask';
  text: string;
}

export interface DayPlan {
  slots: Slot[];
  free: Window[];
  /** Floating items given the first free window that holds them. */
  placed: { item: PlanItem; at: number }[];
  /** Floating items no window holds. */
  unplaced: PlanItem[];
  recovery: Recovery[];
}

export const DAY = { from: 8 * 60, to: 22 * 60 } as const;
const MIN_WINDOW = 15;

const end = (i: PlanItem) => (i.start as number) + i.minutes;
const overlap = (a: PlanItem, b: PlanItem) => (a.start as number) < end(b) && (b.start as number) < end(a);

export function dayPlan(items: readonly PlanItem[], bounds: Window = DAY): DayPlan {
  const fixed = items.filter((i) => i.start !== null).sort((a, b) => (a.start as number) - (b.start as number) || a.id.localeCompare(b.id));
  const floating = items.filter((i) => i.start === null);
  const slots: Slot[] = [];

  fixed.forEach((item, n) => {
    const clash = fixed.filter((o) => o.id !== item.id && overlap(item, o)).map((o) => o.id);
    let state: ConflictState = clash.length ? 'overlaps' : 'clear';
    const withIds = [...clash];
    if (!clash.length) {
      // Too little room to get here from the item that ends before it.
      const before = fixed.slice(0, n).filter((o) => end(o) <= (item.start as number)).pop();
      if (before && item.commute > 0 && (item.start as number) - end(before) < item.commute) {
        state = 'tight';
        withIds.push(before.id);
      }
    }
    slots.push({ item, state, with: withIds });
  });

  // Free windows: gaps between fixed items, each shortened by the commute into
  // the item that follows it.
  const free: Window[] = [];
  let cursor = bounds.from;
  for (const i of fixed) {
    const busyFrom = Math.max(bounds.from, (i.start as number) - i.commute);
    if (busyFrom - cursor >= MIN_WINDOW) free.push({ from: cursor, to: busyFrom });
    cursor = Math.max(cursor, end(i));
  }
  if (bounds.to - cursor >= MIN_WINDOW) free.push({ from: cursor, to: bounds.to });

  const room = free.map((w) => ({ ...w }));
  const placed: DayPlan['placed'] = [];
  const unplaced: PlanItem[] = [];
  for (const item of [...floating].sort((a, b) => Number(b.required) - Number(a.required) || a.id.localeCompare(b.id))) {
    const w = room.find((r) => r.to - r.from >= item.minutes);
    if (!w) {
      unplaced.push(item);
      continue;
    }
    placed.push({ item, at: w.from });
    w.from += item.minutes;
  }
  for (const item of floating) slots.push({ item, state: 'floating', with: [] });

  const recovery: Recovery[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const s of slots) {
    if (s.state !== 'overlaps' || !s.item.required) continue;
    for (const oid of s.with) {
      const other = byId.get(oid) as PlanItem;
      if (s.item.id > other.id) continue; // one line per pair
      const optional = !other.required ? other : !s.item.required ? s.item : null;
      const movable = other.flexible ? other : s.item.flexible ? s.item : null;
      if (optional) recovery.push({ itemId: optional.id, kind: 'skip', text: `Skip "${optional.title}" — you marked it optional.` });
      else if (movable) {
        const w = free.find((f) => f.to - f.from >= movable.minutes);
        recovery.push({
          itemId: movable.id,
          kind: 'move',
          text: w ? `Move "${movable.title}" to ${clock(w.from)} — the first window that holds it.` : `Move "${movable.title}" — you marked it flexible, but no window today holds it.`,
        });
      } else {
        recovery.push({ itemId: s.item.id, kind: 'ask', text: `"${s.item.title}" and "${other.title}" are both required and fixed; rescheduling cannot fix this. Tell whoever runs one of them early.` });
      }
    }
  }
  return { slots, free, placed, unplaced, recovery };
}

/**
 * What somebody else may see of the day: private items are dropped, busy-only
 * items lose their title and place, and nothing else about them survives.
 */
export function sharedView(items: readonly PlanItem[]): { start: number | null; minutes: number; title: string }[] {
  return items
    .filter((i) => i.privacy === 'busy-only')
    .map((i) => ({ start: i.start, minutes: i.minutes, title: 'Busy' }))
    .sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
}

/** The parts of a rail block the plan reads; `railFor`'s blocks satisfy it. */
export interface RailBlock {
  at: number;
  title: string;
  where?: string;
  c: string | null;
  minutes?: number;
  optional?: boolean;
  canceled?: boolean;
  from?: { kind: string; id: string } | null;
}

/**
 * Plan items out of a day's rail. Deadlines and tasks are left out: they are
 * moments, not somewhere to be, and counting them would report a clash between
 * a class and a due time. A block the rail marks optional (office hours, a
 * group call) is not required; everything else on it is. Commute, energy and
 * privacy are not on a rail block, so they stay unstated — private, no
 * commute.
 */
export function itemsFromRail(blocks: readonly RailBlock[], lengthOf: (b: RailBlock) => number): PlanItem[] {
  return blocks
    .filter((b) => !b.canceled && b.from?.kind !== 'item' && b.from?.kind !== 'task')
    .map((b) => ({
      id: `${b.from?.id ?? b.title}@${b.at}`,
      title: b.title,
      category: b.c ? ('class' as const) : ('personal' as const),
      start: b.at,
      minutes: b.minutes ?? lengthOf(b),
      required: !b.optional,
      flexible: false,
      energy: null,
      commute: 0,
      place: b.where ?? '',
      source: b.c ? 'Syllabus' : 'You',
      privacy: 'private' as const,
    }));
}
