import type { Item } from './types';

/**
 * What changed in a course's deadlines between two readings of it — and what
 * it means for the student.
 *
 * `lib/changeset.ts` decides what an *import* adds; `lib/reconcile.ts` compares
 * against the LMS. This is the third question: the same course, read twice,
 * and the student was not watching. A date moved, a weight changed, a deadline
 * appeared or vanished. Each is reported with the six things a student needs
 * to trust it: the previous value, the new value, where the new one comes
 * from, when it takes effect, what it does to them, and what they can do.
 *
 * ## What it will not do
 *
 * It only reports what the two lists disagree on. It never guesses a cause and
 * never rewrites either list, so a change is something to read, not something
 * that has already been applied. A removed deadline is reported as *no longer
 * listed*, not as cancelled — a missing row is weaker evidence than a row.
 */

export type ChangeKind = 'added' | 'removed' | 'moved' | 'retimed' | 'reweighted';

/**
 * What was last acknowledged about one deadline — the fields a change is
 * reported from and nothing else. An {@link Item} is assignable to it.
 */
export interface Seen {
  id: string;
  c: string;
  title: string;
  month: number;
  day: number;
  year?: number;
  dueTime: string;
  weight: string;
  source: string;
  quote: string;
  checked?: { confirmed: boolean; page?: number; doc?: string };
}

/** The last reading acknowledged, per course. A course absent here is one never read. */
export type SeenMap = Record<string, Seen[]>;

export interface WhatChanged {
  id: string;
  kind: ChangeKind;
  courseId: string;
  title: string;
  /** Previous value in the student's words; null for an addition. */
  previous: string | null;
  /** New value; null for a removal. */
  next: string | null;
  /** The sentence and page the new value came from — never invented. */
  source: string;
  /** The date the change bites: the new due date, or the old one if removed. */
  effective: Date;
  /** Whole days from `now` to `effective`; negative once it has passed. */
  daysAway: number;
  impact: string;
  action: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const at = (i: Pick<Seen, 'month' | 'day' | 'year'>, fallbackYear: number): Date =>
  new Date(i.year ?? fallbackYear, i.month, i.day);

const say = (i: Pick<Seen, 'month' | 'day'>): string => `${MONTHS[i.month]} ${i.day}`;

const daysBetween = (a: Date, b: Date): number => {
  const d0 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const d1 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((d1 - d0) / 86_400_000);
};

const sourceOf = (i: Seen): string => {
  const page = i.checked?.confirmed && i.checked.page ? `, p. ${i.checked.page}` : '';
  const from = i.source ? i.source : 'the course';
  return i.quote ? `${from}${page}: "${i.quote}"` : `${from}${page}`;
};

const soon = (days: number): string =>
  days < 0
    ? 'This date has already passed.'
    : days === 0
      ? 'This is due today.'
      : days === 1
        ? 'This is due tomorrow.'
        : `This is ${days} days away.`;

/**
 * Compare two readings of the same courses and say what differs.
 *
 * Items are matched by `id`. Results come back soonest-effective first, so the
 * change that most needs a reaction is the first thing read; equal dates fall
 * back to title so the order is stable.
 */
export function whatChanged(before: readonly Seen[], after: readonly Item[], now: Date): WhatChanged[] {
  const y = now.getFullYear();
  const was = new Map(before.map((i) => [i.id, i]));
  const is = new Map(after.map((i) => [i.id, i]));
  const out: WhatChanged[] = [];

  const push = (
    i: Seen,
    kind: ChangeKind,
    previous: string | null,
    next: string | null,
    effective: Date,
    impact: string,
    action: string,
  ) =>
    out.push({
      id: `${i.id}:${kind}`,
      kind,
      courseId: i.c,
      title: i.title,
      previous,
      next,
      source: sourceOf(i),
      effective,
      daysAway: daysBetween(now, effective),
      impact,
      action,
    });

  for (const n of after) {
    const o = was.get(n.id);
    const due = at(n, y);
    const days = daysBetween(now, due);
    if (!o) {
      push(n, 'added', null, `${say(n)}, ${n.dueTime}`, due, `A new deadline. ${soon(days)}`, 'Add it to your plan.');
      continue;
    }
    const oldDue = at(o, y);
    if (oldDue.getTime() !== due.getTime()) {
      const shift = daysBetween(oldDue, due);
      const dir = shift > 0 ? `${shift} day${shift === 1 ? '' : 's'} later` : `${-shift} day${shift === -1 ? '' : 's'} earlier`;
      push(
        n,
        'moved',
        say(o),
        say(n),
        due,
        `Now ${dir}. ${soon(days)}`,
        shift < 0 ? 'Check what you planned for the new week.' : 'Your plan for the old date can move.',
      );
    } else if (o.dueTime !== n.dueTime) {
      push(n, 'retimed', o.dueTime, n.dueTime, due, `Same day, new time. ${soon(days)}`, 'Update your reminder.');
    }
    if (o.weight !== n.weight) {
      push(n, 'reweighted', o.weight || 'not stated', n.weight || 'not stated', due, 'The share of your grade changed.', 'Re-check how you split your effort.');
    }
  }

  for (const o of before) {
    if (is.has(o.id)) continue;
    const due = at(o, y);
    push(o, 'removed', `${say(o)}, ${o.dueTime}`, null, due, 'No longer listed. That is not the same as cancelled.', 'Ask your instructor before dropping it.');
  }

  return out.sort((a, b) => a.effective.getTime() - b.effective.getTime() || a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind));
}

export const seenOf = (i: Item): Seen => ({
  id: i.id,
  c: i.c,
  title: i.title,
  month: i.month,
  day: i.day,
  ...(i.year === undefined ? {} : { year: i.year }),
  dueTime: i.dueTime,
  weight: i.weight,
  source: i.source,
  quote: i.quote,
  ...(i.checked ? { checked: { ...i.checked } } : {}),
});

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === 'string';

/** Read a saved map, dropping anything malformed rather than trusting it. */
export function readSeen(raw: unknown): SeenMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SeenMap = {};
  for (const [course, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    out[course] = list.flatMap((r): Seen[] => {
      if (!r || typeof r !== 'object') return [];
      const o = r as Record<string, unknown>;
      if (!str(o.id) || !str(o.c) || !str(o.title) || !num(o.month) || !num(o.day)) return [];
      const ck = o.checked as Record<string, unknown> | undefined;
      return [
        {
          id: o.id,
          c: o.c,
          title: o.title,
          month: o.month,
          day: o.day,
          ...(num(o.year) ? { year: o.year } : {}),
          dueTime: str(o.dueTime) ? o.dueTime : '',
          weight: str(o.weight) ? o.weight : '',
          source: str(o.source) ? o.source : '',
          quote: str(o.quote) ? o.quote : '',
          ...(ck && typeof ck.confirmed === 'boolean'
            ? { checked: { confirmed: ck.confirmed, ...(num(ck.page) ? { page: ck.page } : {}), ...(str(ck.doc) ? { doc: ck.doc } : {}) } }
            : {}),
        },
      ];
    });
  }
  return out;
}

/** Courses holding at least one deadline now and no acknowledged reading yet. */
export function unseenCourses(seen: SeenMap, items: readonly Item[]): SeenMap {
  const fresh: SeenMap = {};
  for (const i of items) if (!seen[i.c]) (fresh[i.c] ??= []).push(seenOf(i));
  return fresh;
}

/**
 * Changes since each course's acknowledged reading.
 *
 * A course is compared only if it was acknowledged before *and* holds a
 * deadline now. Without the second condition a catalogue still loading, or a
 * course briefly emptied, would report every deadline it ever had as removed.
 * A course never read has nothing to differ from, so it reports nothing and is
 * seeded silently by {@link unseenCourses}.
 */
export function pendingChanges(seen: SeenMap, items: readonly Item[], now: Date, courseId?: string): WhatChanged[] {
  const present = new Set(items.map((i) => i.c));
  return Object.entries(seen)
    .filter(([c]) => present.has(c) && (courseId === undefined || c === courseId))
    .flatMap(([c, before]) =>
      whatChanged(
        before,
        items.filter((i) => i.c === c),
        now,
      ),
    )
    .sort((a, b) => a.effective.getTime() - b.effective.getTime() || a.title.localeCompare(b.title) || a.kind.localeCompare(b.kind));
}
