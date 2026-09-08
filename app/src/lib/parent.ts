/**
 * The one screen above this one, when there is a real one.
 *
 * ## Why not a breadcrumb trail
 *
 * The obvious answer to "how do I get back up" is a trail — Courses › ECON
 * 1020 › Midterm 2 — and it is the wrong one here. This app is thumb-first,
 * a header is about forty characters wide on a phone, and a trail of three
 * levels either wraps onto a second line or ellipses into uselessness. It also
 * says something untrue: the app is a graph, not a tree. You reach a study
 * guide from Today, from Study, from a course, from search and from a
 * notification, and a trail that always claims you came via Courses is a
 * confident lie about your own history.
 *
 * ## What was actually missing
 *
 * The header already prints the parent. Standing on Midterm 2, the kicker says
 * ECON 1020 — it just was not a link, so the only way up was Back, which
 * retraces however you arrived rather than going *up*. Somebody who reached a
 * deadline from Today and then wanted the course had to go back to Today and
 * start again.
 *
 * So: one level, the level already on screen, made pressable. Back still does
 * what Back does. This does the other thing.
 */

import type { Screen } from './types';

/** Which state field holds the course a screen is about, if any. */
const OF_COURSE: Partial<Record<Screen, 'courseId' | 'guideId'>> = {
  // These name a course directly.
  edit: 'courseId',
  /*
   * `grades` is deliberately not here, and used to be.
   *
   * It reads like a course screen and is not one: `screens/Grades.tsx` renders
   * `catalog.courses` — every course, each with its own weights and its own
   * projection — and never reads `state.courseId`. Listing it here gave the
   * header an up-link to whichever course was last opened, so a page showing
   * all four courses carried a link labelled "CORE 2500" that went somewhere
   * the page had not mentioned.
   *
   * That is the same failure the note below describes for `item`, arrived at
   * from the other direction: there the course is known and was being guessed
   * at, here there is no single course to know.
   */
  // The study screens name a guide, which is a course by another name.
  guide: 'guideId',
  drill: 'guideId',
  quiz: 'guideId',
  lesson: 'guideId',
  slides: 'guideId',
};

/**
 * The course a screen sits under, or null.
 *
 * `item` is deliberately not in the table above: a deadline knows its own
 * course through the item, which the header already has in hand, and reading
 * `state.courseId` for it would point at whichever course was last opened.
 */
export function courseFieldFor(screen: Screen): 'courseId' | 'guideId' | null {
  return OF_COURSE[screen] ?? null;
}

/** Whether standing on `screen` means standing inside a course at all. */
export function insideCourse(screen: Screen): boolean {
  return screen === 'item' || courseFieldFor(screen) !== null;
}
