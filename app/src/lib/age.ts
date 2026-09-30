/**
 * The age rules, as the sign-up form and the Account screen explain them.
 *
 * The owner set the minimum age at 13 (D-139). Nobody younger may hold an
 * account; a student aged 13 to 17 keeps everything that is theirs but not
 * the features where one person finds, matches with, messages or is seen by
 * another, until they turn 18.
 *
 * **Nothing here is the enforcement.** `private.record_stated_age` refuses an
 * under-13 sign-up in the database, and `private.verified_student` keeps a
 * minor out of every social policy (`20260929150000_minimum_age.sql`); a
 * trigger's refusal reaches the browser as an unreadable "Database error
 * saving new user", so the form checks first and says why in words. A form
 * that is skipped is still refused.
 *
 * The birth date is sent once and never kept: the database stores only the
 * day a minor turns 18, and for an adult nothing but that they said so.
 */

export const MINIMUM_AGE = 13;
export const ADULT_AGE = 18;

export type Standing = 'invalid' | 'under_minimum' | 'minor' | 'adult';

/** A date written as YYYY-MM-DD, which is what a date input gives. */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parse(iso: string): { y: number; m: number; d: number } | null {
  if (!ISO.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  // Refuses 2011-02-30, which Date would quietly roll into March.
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Whole years between a birth date and a day, both YYYY-MM-DD. */
export function ageOn(born: string, today: string): number | null {
  const b = parse(born);
  const t = parse(today);
  if (!b || !t) return null;
  let years = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) years -= 1;
  return years;
}

/** Where a birth date stands on a day. A date in the future, or more than 120 years back, is not a birth date. */
export function standing(born: string, today: string): Standing {
  const age = ageOn(born, today);
  if (age === null || age < 0 || age > 120 || born > today) return 'invalid';
  if (age < MINIMUM_AGE) return 'under_minimum';
  if (age < ADULT_AGE) return 'minor';
  return 'adult';
}

/** Today in the person's own calendar, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** What the form says, before anything is sent. */
export const SAID: Record<Exclude<Standing, 'adult'>, string> = {
  invalid: 'That date of birth does not look right. Check the day, month and year.',
  under_minimum:
    `You need to be at least ${MINIMUM_AGE} to make a Semester account. ` +
    'Nothing was sent and nothing was created. Everything on this device keeps working without an account.',
  minor:
    `Because you are under ${ADULT_AGE}, the features where other people can find, match with or message you stay off ` +
    `until your ${ADULT_AGE}th birthday. Your plans, courses and study work are all yours as usual, ` +
    'and you can still report anything and share with a parent or guardian.',
};
