import type { Screen } from './types';

/**
 * The two ends of a term, as checklists that open the right screen.
 *
 * Semester was busiest around registration and quiet the rest of the year,
 * which is the shape of a tool rather than of a term. A term has a beginning
 * — courses to confirm, syllabi to read in, reminders to set — and an end —
 * things to keep, things to export, shares to clean up, the next term to plan.
 * `components/CloseTerm.tsx` archives; this is what to do before and after,
 * each step opening the screen where it is done.
 *
 * Better than a "wrapped" because it helps a student move forward while
 * keeping control of their information: the end-of-term list is mostly about
 * what to keep, what to export and who should stop seeing what.
 * `termtransition.test.ts` holds every step to a screen that exists.
 */
export interface Step {
  id: string;
  label: string;
  /** Why, in one line. */
  why: string;
  screen: Screen;
}

export const TERM_START: readonly Step[] = [
  { id: 'confirm-courses', label: 'Confirm your courses', why: 'What is in the list is what Today plans around.', screen: 'courses' },
  { id: 'import-syllabi', label: 'Read in each syllabus', why: 'Deadlines and a study guide come out of it, each marked with its source.', screen: 'import' },
  { id: 'set-schedule', label: 'Set your week', why: 'Class times, work blocks and the hours you study, so conflicts are caught.', screen: 'calendar' },
  { id: 'review-policies', label: 'Read each course’s rules', why: 'Late work, AI use and attendance, before the first deadline rather than after.', screen: 'courses' },
  { id: 'choose-reminders', label: 'Choose your reminders', why: 'How far ahead, and when the app stays quiet.', screen: 'setAlerts' },
  { id: 'set-goals', label: 'Set the term’s goal', why: 'What would help most this term shapes what Today puts first.', screen: 'degree' },
  { id: 'connect-support', label: 'Connect your calendar and sources', why: 'A subscribed calendar keeps dates moving with the course.', screen: 'connect' },
];

export const TERM_END: readonly Step[] = [
  { id: 'review', label: 'Review what worked', why: 'Which study tools you used, what you finished, what you would change.', screen: 'me' },
  { id: 'archive', label: 'Archive the term', why: 'Completed courses out of the way; nothing is deleted.', screen: 'registrar' },
  { id: 'keep-notes', label: 'Keep the notes and study material worth keeping', why: 'The cards and guides you will want again next year.', screen: 'study' },
  { id: 'export', label: 'Export selected work', why: 'Files you can open elsewhere, before anything moves.', screen: 'export' },
  { id: 'update-goals', label: 'Update your goals and your path', why: 'What this term changed about where you are headed.', screen: 'degree' },
  { id: 'plan-next', label: 'Plan next term', why: 'A plan with backups, checked for conflicts, before registration opens.', screen: 'registrar' },
  { id: 'career-evidence', label: 'Refresh your career evidence', why: 'What you made and did this term, while it is fresh.', screen: 'career' },
  { id: 'review-shares', label: 'Review shares, connections and support access', why: 'Who should stop seeing what, now the term is over.', screen: 'privacy' },
  { id: 'remove-deadlines', label: 'Clear old deadlines', why: 'So the next term starts with an empty list rather than last term’s.', screen: 'calendar' },
];

/** Which list is the season's: the end list in the last three weeks of a term, else the start list. */
export function stepsFor(now: Date, termEnd: Date | null): readonly Step[] {
  if (!termEnd) return TERM_START;
  const days = (termEnd.getTime() - now.getTime()) / 86_400_000;
  return days <= 21 ? TERM_END : TERM_START;
}
