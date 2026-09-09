/**
 * What the header's + adds, decided in one place.
 *
 * ## The bug this exists to make impossible
 *
 * The + in the header opened the one-line capture box on every screen, and
 * the capture box writes a *task against an existing course* — it cannot
 * make a course. So on the one screen whose whole subject is courses, the
 * only + in sight did the one thing it could not be asked to do.
 *
 * The courses list answered that by growing a second affordance: a full-width
 * "+ Add a course from a syllabus" button under the last card. Two plusses on
 * one screen, one of them a screen away from what it says, and the one at the
 * top — the one a thumb reaches first — going somewhere else entirely.
 *
 * So the + adds what the screen is a list of. On the courses list that is a
 * course, which is the importer; everywhere else it is a deadline, which is
 * the capture box. One + per screen, going to the one place.
 */

import type { Screen } from './types';

export interface Adding {
  /**
   * `course` opens the importer. `quick` opens the one-line capture box.
   */
  kind: 'course' | 'quick';
  /** The button's accessible name. It has no visible label. */
  label: string;
}

/**
 * The screens whose + means "add a course".
 *
 * A list, not a single equality test, because the grades table is the same
 * screen under a different tab and the answer there is the same: what is
 * missing from a screen full of courses is a course.
 */
const COURSE_SCREENS: Screen[] = ['courses'];

export function addingOn(screen: Screen): Adding {
  return COURSE_SCREENS.includes(screen)
    ? { kind: 'course', label: 'Add a course from a syllabus' }
    : { kind: 'quick', label: 'Add something in one line' };
}
