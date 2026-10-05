import { FAMILY_CATEGORIES, type FamilyCategory } from '@semester/institution';
import type { FamilyItem, FamilyMember } from './family';

/**
 * The consent rules every share follows, as functions.
 *
 * The design is `docs/CONSENT-SHARING-DESIGN.md` (D-037, approved). This file
 * is its §1 made checkable, for the two relationships it covers — a supporter
 * (the Family plan, stored as `family_grants`) and athletic academic support
 * (`support_shares`, 20260928308000; its screen is slice 5). Nothing here sends, stores on a server or
 * grants anything: it answers "may this be shared as it stands?" and "what
 * does the other person see?", so the screens that ask it and the server that
 * enforces it later cannot disagree about the answer.
 */

/** D4: at most one term, and never more than this many days from today. */
export const SHARE_MAX_DAYS = 200;

/** Days from `from` to `to`, both `YYYY-MM-DD`, counted as calendar days. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Why an end date cannot be used for a share, or '' when it can.
 *
 * D4: a share always ends, within a term. "Until I revoke it" is not an end:
 * the plan the student forgets about is the one still being read in two years.
 */
export function endProblem(ends: string, today: string): string {
  if (!ends) return 'Needs an end date. Every share ends, at most one term from today.';
  if (!Number.isFinite(Date.parse(`${ends}T00:00:00Z`))) return 'The end date is not a real date.';
  if (ends < today) return 'The end date has passed.';
  if (daysBetween(today, ends) > SHARE_MAX_DAYS) return `Ends more than ${SHARE_MAX_DAYS} days from today. Choose a date within this term.`;
  return '';
}

/**
 * What one person's supporter plan would share under the pilot's rules, and
 * what stops it being shareable. D5: named items only ("selected"; a stored
 * "view" already meant the same named items), and payment off.
 */
export interface PlanCheck {
  /** The items the supporter would see: named, in a category they may read. */
  items: FamilyItem[];
  problems: string[];
  /** Categories set to payment, which shows nothing and is off in the pilot. */
  payment: FamilyCategory[];
}

export function checkSupporterPlan(member: FamilyMember, items: FamilyItem[], today: string): PlanCheck {
  const reads = (c: FamilyCategory) => member.permissions[c] === 'selected' || member.permissions[c] === 'view';
  const shown = items.filter((i) => i.memberId === member.id && reads(i.category));
  const payment = FAMILY_CATEGORIES.filter((c) => member.permissions[c] === 'payment');
  const problems: string[] = [];
  if (member.revoked) problems.push('You stopped this plan.');
  const end = endProblem(member.expires, today);
  if (end) problems.push(end);
  if (!member.name.trim()) problems.push('Name the person this is for.');
  if (shown.length === 0) problems.push('Nothing is chosen yet. Add the items you want them to see.');
  if (payment.length) problems.push('Payment access is off: Semester takes no payments. Those categories share nothing.');
  return { items: shown, problems, payment };
}

// ── Athletic academic support (D1, D2) ──────────────────────────────────

/** D1: the one role a student's athletic-support share can name. */
export const SUPPORT_RECIPIENT_ROLE = 'athletic_academic_support';

/**
 * D2: roles that can never receive an athletic-support share, whatever the
 * student picks. Compliance decides eligibility; a support tool it could read
 * would become an evidence file. Coaches have no role here, and a coach who
 * held the support role would still be named by the student, knowingly.
 */
export const NEVER_SUPPORT_RECIPIENTS = ['athletics_compliance_officer'] as const;

/** What an athlete can choose to share with academic support, and nothing else. */
export const ATHLETE_SHAREABLE = [
  ['travel', 'Travel and competition dates, with the classes each one misses'],
  ['missed', 'Missed classes, per course, from your syllabus'],
  ['absence', 'Your absence notices, marked draft or sent as you recorded them'],
  ['pack', 'Which travel study packs you made, and what is marked done'],
  ['courses', 'Your courses this term'],
  ['deadlines', 'Deadlines that fall during travel, with where each date came from'],
] as const;
export type AthleteShareable = (typeof ATHLETE_SHAREABLE)[number][0];

/** What is never offered in an athlete share, said so the screen can say it too. */
export const ATHLETE_NEVER_SHARED = [
  'Grades, GPA or any readiness or standing estimate',
  'NIL deals or income',
  'Your countable-hours log',
  'Health, counselling or accommodation records',
  'Money, location or messages',
] as const;

// ── What the recipient sees, and when it stops ──────────────────────────

export interface ShareState {
  acceptedAt: string | null;
  revokedAt: string | null;
  /** `YYYY-MM-DD`, last day readable. */
  ends: string;
}

/**
 * The line the recipient sees.
 *
 * D3: revoked and expired read the same, word for word, so that stopping a
 * share cannot be told apart from time running out. A student under pressure
 * to keep sharing should not have to explain a revocation.
 */
export function recipientLine(s: ShareState, today: string): string {
  if (s.revokedAt || s.ends < today) return 'This share has ended.';
  if (!s.acceptedAt) return 'Waiting to be accepted.';
  return `Shared with you until ${s.ends}.`;
}

/** Whether the recipient may read right now. Mirrors `allowsFamilyRequest`'s live test. */
export function readable(s: ShareState, today: string, roleHeld = true): boolean {
  return !!s.acceptedAt && !s.revokedAt && s.ends >= today && roleHeld;
}

/**
 * Whether a change needs a new preview and confirmation (§6): anything that
 * lets the recipient see more — an item added, or a later end date. Removing
 * items or ending sooner narrows the share and takes effect at once.
 */
export function widens(before: { items: string[]; ends: string }, after: { items: string[]; ends: string }): boolean {
  const had = new Set(before.items);
  return after.items.some((i) => !had.has(i)) || after.ends > before.ends;
}
