/**
 * Feedback a student received, turned into things they may choose to do.
 *
 * Returned work arrives after the moment it could have helped most, and a
 * comment like "unsupported claims" is read once and forgotten before the next
 * essay. This is the reading that keeps it: the student files the comment, says
 * what kind of feedback it was, and gets optional next steps and — across
 * several pieces of work — the themes that keep coming back.
 *
 * ## What it will not do
 *
 * Feedback trends are private. Nothing here ranks a student, predicts a grade,
 * or produces a risk label, and nothing here is written for a dashboard someone
 * else reads. A theme is a count of the student's own filings, spoken only above
 * a floor, in the same spirit as `lib/again.ts`: a pattern read off two entries
 * is a coincidence with a confident voice.
 *
 * The original comment is kept verbatim and is never rewritten. The suggested
 * actions are templates keyed on the category the *student* chose; nothing is
 * inferred from the text of the comment.
 *
 * This is not `lib/postmortem.ts`, which asks which unit a lost mark belongs
 * to, nor `lib/returned.ts`, which counts the days left to question a grade.
 */

import { isoDay, obj, textValue } from './device-library';

export const CATEGORIES = [
  'Conceptual understanding',
  'Evidence and citation',
  'Structure and organization',
  'Calculation or technical method',
  'Communication',
  'Process and time management',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface FeedbackItem {
  id: string;
  courseId: string;
  /** The piece of work it was about, in the student's words. */
  work: string;
  /** Where it came from: marked paper, pasted comment, office hours. */
  origin: string;
  /** The comment exactly as it was received. */
  comment: string;
  category: Category;
  /** "What will I try differently next time?" — the student's own words. */
  next: string;
  /** YYYY-MM-DD the student filed it. */
  filed: string;
}

export interface Action {
  title: string;
  why: string;
}

/**
 * Optional next steps for a category. Every one says why it is suggested and
 * is a suggestion only: adding it to the plan is the student's click.
 */
export function actionsFor(category: Category): Action[] {
  switch (category) {
    case 'Conceptual understanding':
      return [
        { title: 'Explain the idea from memory, then compare with the course source', why: 'You filed this as a gap in understanding; retrieval before reading shows what is missing.' },
        { title: 'Ask one targeted question in office hours', why: 'A specific question gets more from a short visit than a general one.' },
      ];
    case 'Evidence and citation':
      return [
        { title: 'List each claim with the source that supports it', why: 'You filed this as an evidence or citation comment; a claim–source list shows which claims stand alone.' },
        { title: 'Check every citation against the source you have', why: 'Only sources you can open should be cited.' },
      ];
    case 'Structure and organization':
      return [
        { title: 'Outline the next piece before drafting: one line per paragraph', why: 'You filed this as a structure comment; an outline is where structure is cheapest to change.' },
      ];
    case 'Calculation or technical method':
      return [
        { title: 'Redo two worked examples of this method', why: 'You filed this as a method comment; worked practice on the same method targets it directly.' },
        { title: 'Write the units and sign at every step', why: 'It turns a silent slip into a visible one.' },
      ];
    case 'Communication':
      return [
        { title: 'Read the draft aloud once before submitting', why: 'You filed this as a communication comment; reading aloud surfaces unclear sentences.' },
      ];
    case 'Process and time management':
      return [
        { title: 'Put the next assignment’s milestones on your plan this week', why: 'You filed this as a process comment; earlier dates leave room to revise.' },
      ];
  }
}

/** A theme is not spoken below this many filings in one category. */
export const THEME_FLOOR = 3;

export interface Theme {
  category: Category;
  count: number;
  /** Distinct pieces of work, so one assignment filed three times is not a trend. */
  works: number;
}

/**
 * Categories that recur across distinct pieces of work, most frequent first.
 * Silent (empty) below the floor. `courseId` null reads across every course.
 */
export function themes(items: FeedbackItem[], courseId: string | null = null): Theme[] {
  const pool = courseId ? items.filter((i) => i.courseId === courseId) : items;
  const by = new Map<Category, { count: number; works: Set<string> }>();
  for (const i of pool) {
    const cur = by.get(i.category) ?? { count: 0, works: new Set<string>() };
    cur.count += 1;
    cur.works.add(i.work.trim().toLowerCase());
    by.set(i.category, cur);
  }
  return [...by.entries()]
    .filter(([, v]) => v.count >= THEME_FLOOR && v.works.size >= 2)
    .map(([category, v]) => ({ category, count: v.count, works: v.works.size }))
    .sort((a, b) => b.count - a.count || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category));
}

/** How a theme is said: a noticing, never a judgement. */
export function says(t: Theme): string {
  return `${t.category} has come up in ${t.works} pieces of work you filed. You may want to plan for it.`;
}

/** What the panel says when there is nothing to say yet. */
export function nothingYet(items: FeedbackItem[]): string {
  const n = items.length;
  if (n === 0) return 'Nothing filed yet. Paste a comment from returned work to turn it into next steps.';
  return `${n} filed. Themes appear after ${THEME_FLOOR} comments in one category across at least two pieces of work.`;
}

/** The task a student may add to their own plan from an action. Never automatic. */
export function taskFrom(item: FeedbackItem, action: Action) {
  return {
    title: action.title,
    date: null,
    time: '',
    note: `${action.why}\n\nFrom feedback on “${item.work}”: ${item.comment}`,
    courseId: item.courseId,
    from: `feedback:${item.id}:${action.title}`,
  };
}

/** The private, per-device inbox, and its reader — also what a workspace backup restores through. */
export const FEEDBACK_PREFIX = 'semester.feedback-inbox.v1';

export interface Inbox {
  version: 1;
  items: FeedbackItem[];
}

export const EMPTY_INBOX: Inbox = { version: 1, items: [] };

export function readInbox(v: unknown): Inbox {
  if (
    !obj(v) ||
    v.version !== 1 ||
    !Array.isArray(v.items) ||
    v.items.length > 200 ||
    v.items.some(
      (e) =>
        !obj(e) ||
        !['id', 'courseId', 'work', 'origin'].every((k) => textValue(e[k], 500)) ||
        !textValue(e.comment, 8000) ||
        !textValue(e.next, 8000) ||
        !(CATEGORIES as readonly unknown[]).includes(e.category) ||
        !isoDay(e.filed),
    )
  )
    throw new Error('Invalid feedback inbox.');
  return v as unknown as Inbox;
}
