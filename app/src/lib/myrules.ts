/**
 * Reminders the student writes, rather than the seven the app shipped with.
 *
 * The seven built-in rules are good defaults and they are somebody else's
 * defaults. "Two-day warning on big assignments" is right for a problem set
 * and useless for a twenty-page paper that needed starting a fortnight ago;
 * "class starting in 15 minutes" is right if you live on campus and too late
 * if you do not. The student knows their own lead times and had no way to say
 * them.
 *
 * A rule here is one sentence with three blanks: *how long before*, *what
 * kind of thing*, and *which course*. That is narrow on purpose — a general
 * rule builder would be a small programming language in a settings screen,
 * and the three blanks cover what people actually say out loud about their
 * own deadlines.
 *
 * ## They add, they never subtract
 *
 * A custom rule cannot silence a built-in one. Somebody debugging why a
 * reminder did not arrive should never have to reason about two systems
 * cancelling out, and a rule that quietly suppresses another is the hardest
 * kind of bug to see from the outside — you get nothing, and nothing looks
 * exactly like nothing being due.
 */

import type { DatedItem } from './types';

/** What a rule watches. */
export type Watches = 'deadline' | 'exam';

export interface MyRule {
  id: string;
  watches: Watches;
  /** Days before it is due. Zero means the morning of. */
  days: number;
  /** Hour of the day to say it, 0–23. */
  hour: number;
  /** A course id, or empty for every course. */
  courseId: string;
  on: boolean;
}

/** More than this and nobody remembers what they asked for. */
export const MOST_RULES = 8;

/** A fortnight is the longest lead anybody plans to; zero is the day itself. */
export const MOST_DAYS = 21;

export function newRule(at = Date.now()): MyRule {
  return {
    id: `r${at.toString(36)}`,
    watches: 'deadline',
    days: 3,
    hour: 9,
    courseId: '',
    on: true,
  };
}

/** A stored list, made safe. Anything unreadable is dropped, not repaired. */
export function readRules(saved: unknown): MyRule[] {
  if (!Array.isArray(saved)) return [];
  const out: MyRule[] = [];
  for (const value of saved) {
    const r = value as Partial<MyRule> | null;
    if (!r || typeof r.id !== 'string' || !r.id) continue;
    const days = Number(r.days);
    const hour = Number(r.hour);
    if (!Number.isInteger(days) || days < 0 || days > MOST_DAYS) continue;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    out.push({
      id: r.id,
      watches: r.watches === 'exam' ? 'exam' : 'deadline',
      days,
      hour,
      courseId: typeof r.courseId === 'string' ? r.courseId : '',
      on: r.on !== false,
    });
    if (out.length === MOST_RULES) break;
  }
  return out;
}

/** "3 days before every deadline, at 9am." */
export function ruleLine(r: MyRule, courseCode?: (id: string) => string): string {
  const when =
    r.days === 0
      ? 'On the day of'
      : `${r.days} ${r.days === 1 ? 'day' : 'days'} before`;
  const what = r.watches === 'exam' ? 'exam' : 'deadline';
  const whose = r.courseId ? `${courseCode?.(r.courseId) ?? r.courseId} ` : 'every ';
  const h = r.hour % 12 === 0 ? 12 : r.hour % 12;
  const half = r.hour < 12 ? 'am' : 'pm';
  return `${when} ${whose}${what}, at ${h}${half}.`;
}

/**
 * Whether an item is the kind a rule watches.
 *
 * "Exam" is read off the item's own kind rather than a flag, because that is
 * where the syllabus put it — see `lib/runway.ts`, which does the same and is
 * the reason a midterm and a final are both found without either being
 * labelled specially.
 */
function watched(item: DatedItem, r: MyRule): boolean {
  if (r.courseId && item.c !== r.courseId) return false;
  if (r.watches === 'deadline') return true;
  return /exam|midterm|final|test|quiz/i.test(item.kind);
}

export interface Fired {
  id: string;
  ruleId: string;
  title: string;
  body: string;
}

/**
 * The custom reminders that are due right now.
 *
 * Fires on the hour the rule names, and only on the day the lead time lands
 * on — not "any time after", which for a rule set to three days would fire
 * again at three days minus one hour, and again at two days, and turn a lead
 * time into a countdown nobody asked for.
 */
export function myReminders(now: Date, rules: MyRule[], items: DatedItem[]): Fired[] {
  const today = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const hour = now.getHours();
  const out: Fired[] = [];

  for (const r of rules) {
    if (!r.on || hour < r.hour) continue;
    for (const item of items) {
      if (item.daysAway !== r.days) continue;
      if (!watched(item, r)) continue;
      out.push({
        // The day is in the id so it fires once, the same rule the built-in
        // reminders follow — `lib/notify.ts` keeps a seen list keyed on this.
        id: `mine:${r.id}:${today}:${item.id}`,
        ruleId: r.id,
        title:
          r.days === 0
            ? `${item.title} is due today`
            : `${item.title} in ${r.days} ${r.days === 1 ? 'day' : 'days'}`,
        body: [item.dueShort, item.dueTime].filter(Boolean).join(' · '),
      });
    }
  }

  return out;
}

/** Add one, or refuse when the list is full. */
export function addRule(rules: MyRule[], at = Date.now()): MyRule[] {
  if (rules.length >= MOST_RULES) return rules;
  return [...rules, newRule(at)];
}

export function editRule(rules: MyRule[], id: string, patch: Partial<MyRule>): MyRule[] {
  return rules.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r));
}

export function dropRule(rules: MyRule[], id: string): MyRule[] {
  return rules.filter((r) => r.id !== id);
}
