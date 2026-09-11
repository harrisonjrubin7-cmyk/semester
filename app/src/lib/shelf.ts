/**
 * What a shelf of your own files is sorted and grouped by.
 *
 * Every application that keeps files opens on the same screen: a row of things
 * to start from across the top, and everything you already have below it,
 * newest first, cut into "Today", "Previous 7 days", "Previous 30 days" and
 * "Earlier". Docs does it, Sheets does it, Slides does it, Finder does it,
 * every mail client does it. It is not a fashion — it is the answer to the
 * question somebody actually arrives with, which is *where is the one I had
 * open yesterday*.
 *
 * This app's three shelves each answered a different question. Write listed
 * documents newest first with no headings. Sheet listed sheets the same way
 * but behind a fold, under two import controls and a grade calculator. The
 * deck editor had no shelf at all. None of the three could be sorted, none
 * could be narrowed to one course, and none said how old anything was beyond a
 * bare `Mar 31`.
 *
 * ## Why the grouping is by day rather than by hours
 *
 * "2 hours ago" is a better sentence and a worse heading: it changes while you
 * are reading it, two files written an hour apart land in different groups,
 * and scrolling back through a term you get four hundred headings. The day
 * boundary is the one people already navigate by — *I did that on Tuesday* —
 * and `lib/date.ts` already owns what a local day is, so this borrows it
 * rather than dividing by 86,400,000 and being wrong twice a year.
 *
 * ## Grouping follows the sort, and only one sort gets it
 *
 * Headings that say "Today" above a list sorted A–Z are furniture that means
 * nothing: the group a file is in no longer tells you where to look for it.
 * So sorting by name returns one unnamed group, which is what Docs does, and
 * the headings come back when the sort does.
 */

import { dayOf } from './date';
import type { CourseId } from './types';

/** The least a thing has to be to sit on a shelf. */
export interface Filed {
  id: string;
  title: string;
  courseId: CourseId | null;
  created: number;
  updated: number;
}

/** The three orders, and what each is called where somebody chooses one. */
export const SORTS = [
  { id: 'opened', label: 'Last opened' },
  { id: 'name', label: 'Name' },
  { id: 'made', label: 'Date made' },
] as const;

export type Sorting = (typeof SORTS)[number]['id'];

/** Grid of thumbnails, or rows with their dates. Both of Google's, both here. */
export type Shape = 'grid' | 'list';

/**
 * Narrowing to one course, or to the things that belong to no course.
 *
 * The app's answer to "Owned by anyone". Ownership is not the axis here —
 * everything on these shelves is yours — but *which class is this for* is the
 * question a term actually poses, and it is the one the shelf can answer.
 */
export type Whose = 'all' | 'personal' | CourseId;

export function only<T extends Filed>(items: T[], whose: Whose): T[] {
  if (whose === 'all') return items;
  if (whose === 'personal') return items.filter((i) => i.courseId === null);
  return items.filter((i) => i.courseId === whose);
}

/**
 * A title as it is drawn, never blank.
 *
 * An untitled file is the commonest file there is — it is what every one of
 * them is for its first minute — and a row with nothing in its first line is a
 * row you cannot press with any confidence. Google says "Untitled document";
 * so does this, in the caller's own words, because a sheet is not a document.
 */
export function named(item: Filed, fallback: string): string {
  return item.title.trim() === '' ? fallback : item.title.trim();
}

/**
 * Sorted, without touching the caller's array.
 *
 * Name sorts with `localeCompare` and `numeric`, so `Problem set 2` comes
 * before `Problem set 10` — which is the order somebody naming files that way
 * meant, and the order a plain string compare gets backwards.
 */
export function sorted<T extends Filed>(items: T[], by: Sorting): T[] {
  const out = [...items];
  if (by === 'name') {
    out.sort((a, b) =>
      named(a, '').localeCompare(named(b, ''), undefined, { numeric: true, sensitivity: 'base' }),
    );
  } else if (by === 'made') {
    out.sort((a, b) => b.created - a.created);
  } else {
    out.sort((a, b) => b.updated - a.updated);
  }
  return out;
}

/** The four ages, newest first, with the heading each is drawn under. */
export const AGES = [
  { id: 'today', label: 'Today', within: 0 },
  { id: 'week', label: 'Previous 7 days', within: 7 },
  { id: 'month', label: 'Previous 30 days', within: 30 },
  { id: 'earlier', label: 'Earlier', within: Infinity },
] as const;

export type Age = (typeof AGES)[number]['id'];

/**
 * Which of the four a timestamp falls in.
 *
 * Whole local days apart, so something written last night at 11pm is "Today"
 * this morning only if it really was today — a file from four minutes before
 * midnight is yesterday's, and saying otherwise is the kind of small lie that
 * makes somebody stop trusting the headings.
 *
 * Anything dated after `now` — a clock put back, a file synced from a device
 * an hour ahead — counts as today rather than falling through to "Earlier",
 * which is where a negative number would have put it.
 */
export function ageOf(at: number, now: number): Age {
  const days = Math.round((dayOf(now) - dayOf(at)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days <= 7) return 'week';
  if (days <= 30) return 'month';
  return 'earlier';
}

export interface Group<T> {
  /** The heading, or empty for the one group a name sort produces. */
  label: string;
  items: T[];
}

/**
 * The shelf as it is drawn: sorted, then cut into its headings.
 *
 * A group with nothing in it is not returned — an empty "Previous 7 days" over
 * a rule is a heading that says a false thing, which is that there is a week
 * there and it is empty.
 */
export function grouped<T extends Filed>(items: T[], by: Sorting, now: number): Group<T>[] {
  const order = sorted(items, by);
  if (by === 'name') return order.length ? [{ label: '', items: order }] : [];

  const when = by === 'made' ? (i: Filed) => i.created : (i: Filed) => i.updated;
  return AGES.map((age) => ({
    label: age.label,
    items: order.filter((i) => ageOf(when(i), now) === age.id),
  })).filter((g) => g.items.length > 0);
}

/**
 * The date under a row, in Google's own shape: a time today, a date otherwise.
 *
 * `Mar 31, 2026` for anything from another year, `Mar 31` within this one.
 * Drawn beside every row in list view, which is the view somebody switches to
 * precisely because they want to read dates.
 */
export function stamp(at: number, now: number): string {
  const d = new Date(at);
  if (ageOf(at, now) === 'today') {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
