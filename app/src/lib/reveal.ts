/**
 * Not showing somebody forty-six screens on their first morning.
 *
 * The directory is the app's best feature and its worst first impression. A
 * student three weeks in, looking for the thing that tells them which paper to
 * start, is glad it is all there. A student who opened it an hour ago sees a
 * wall of names for problems they do not have yet — an exam runway with no
 * exams, a drop-out calculator in week one, a letter tracker before they have
 * met anybody worth asking.
 *
 * ## Earned, not hidden
 *
 * Every screen here is unlocked by something that has actually happened. Import
 * a course and the study screens appear. Enter a grade and the projection
 * appears. Put an exam in the calendar and the runway appears. The condition is
 * always a fact about the semester rather than a timer or a count of sessions,
 * because "you have used the app five times" is not a reason to be shown
 * anything.
 *
 * ## Three rules that stop this becoming annoying
 *
 * A screen you have already opened never goes away. `visited` is persisted and
 * syncs, so a screen unlocked on the laptop is not locked again on the phone,
 * and one that unlocked because of a course you later dropped stays put. An app
 * that takes things away is worse than one that showed too many.
 *
 * Search always finds everything. Somebody who knows the app has a drop
 * calculator can type "drop" and go there, whether or not it has been unlocked
 * — and going there unlocks it. Hiding something from a directory is a claim
 * about what is *useful yet*, and hiding it from search would be a claim about
 * what somebody is allowed to want.
 *
 * And it can be switched off in Settings, in one tap, permanently.
 *
 * ## This is not the capability gate
 *
 * `lib/school.ts` hides screens a university has no equivalent of — those are
 * absent, not pending, and no amount of using the app will produce a meal plan
 * at a school without one. This hides screens that are real and not relevant
 * yet. The two compose: a screen must pass both.
 */

import { DESTINATIONS } from './nav';

/** What the app knows about how far along somebody is. */
export interface Facts {
  courses: number;
  /** Any deadline that is an exam. */
  hasExam: boolean;
  /** Any grade entered by hand or read off a paper. */
  hasGrades: boolean;
  notes: number;
  /** Practice papers sat. */
  sittings: number;
  /** Anything the student added themselves — a task, an appointment. */
  ownThings: number;
  /** Whether a second term exists, which is what makes archiving mean anything. */
  terms: number;
  signedIn: boolean;
}

export const NOTHING_YET: Facts = {
  courses: 0,
  hasExam: false,
  hasGrades: false,
  notes: 0,
  sittings: 0,
  ownThings: 0,
  terms: 1,
  signedIn: false,
};

/**
 * What a brand-new student sees.
 *
 * Ten, and every one of them does something on a first morning: see the day,
 * get a course in, look at what is coming, write something down, ask a
 * question, and change how it looks. Anything that needs a course to be useful
 * is not here.
 */
export const FIRST: string[] = [
  'home',
  'import',
  'courses',
  'calendar',
  'mine',
  'ask',
  'me',
  'settings',
  'account',
  'privacy',
];

/**
 * What each remaining screen waits for.
 *
 * A screen absent from this table is available as soon as there is a course —
 * that is the honest default, because almost everything here is about
 * coursework and none of it makes sense before there is any.
 */
export const UNLOCKS: Record<string, (f: Facts) => boolean> = {
  // The exam machinery, once there is an exam to point it at.
  //
  // Only screens the directory lists are here. Cram, the drill and a guide are
  // reached from inside Study rather than from the directory, so gating them
  // would hide nothing and would quietly break the path into them.
  runway: (f) => f.hasExam,
  exam: (f) => f.hasExam,

  // The grade machinery, once there is a grade.
  grades: (f) => f.hasGrades,
  worked: (f) => f.hasGrades || f.sittings > 0,
  proof: (f) => f.sittings > 0,

  // Study formats need something to study.
  study: (f) => f.courses > 0,
  deck: (f) => f.courses > 0,
  solve: (f) => f.courses > 0,

  // Things about your own writing.
  essay: (f) => f.notes > 0 || f.courses > 0,
  sources: (f) => f.notes > 0 || f.courses > 0,
  draw: (f) => f.notes > 0 || f.courses > 0,

  // The reflective screens, which need a week to have happened.
  weekly: (f) => f.courses > 0 && (f.ownThings > 0 || f.hasGrades),
  behind: (f) => f.courses > 1,
  tonight: (f) => f.courses > 0,

  // Longer horizons.
  degree: (f) => f.courses > 0,
  registrar: (f) => f.courses > 0,
  // Archiving one term means nothing until there are two.
  ahead: (f) => f.terms > 1 || f.courses > 0,

  // Sync only matters with an account.
  cloud: (f) => f.signedIn,
  connect: (f) => f.courses > 0,
};

/** Whether a screen has been earned yet. */
export function unlocked(screen: string, facts: Facts): boolean {
  if (FIRST.includes(screen)) return true;
  const gate = UNLOCKS[screen];
  // The honest default: almost everything here is about coursework, and none
  // of it means anything before there is any.
  return gate ? gate(facts) : facts.courses > 0;
}

/**
 * Whether to show a screen at all, given everything.
 *
 * `visited` is the rule that matters most. A screen somebody has opened stays
 * open forever — unlocked on the laptop, still there on the phone; unlocked by
 * a course they later dropped, still there. An app that takes things away is
 * worse than one that showed too many.
 */
export function showing(
  screen: string,
  facts: Facts,
  visited: Record<string, boolean>,
  showAll: boolean,
): boolean {
  if (showAll) return true;
  if (visited[screen]) return true;
  return unlocked(screen, facts);
}

/** Everything currently earned, for a count and for the settings line. */
export function countHidden(
  facts: Facts,
  visited: Record<string, boolean>,
  showAll: boolean,
): number {
  if (showAll) return 0;
  return DESTINATIONS.filter((d) => !showing(d.screen as string, facts, visited, showAll)).length;
}

/**
 * What the settings row says.
 *
 * Names the mechanism rather than selling it. Somebody who wants everything
 * should be able to read one sentence and know that is the other switch.
 */
export function revealLine(hidden: number, showAll: boolean): string {
  if (showAll) {
    return 'Every screen is in the directory, whether or not it is any use yet.';
  }
  if (hidden === 0) {
    return 'Everything has been unlocked. Nothing is being held back.';
  }
  return `${hidden} ${hidden === 1 ? 'screen appears' : 'screens appear'} once there is something for ${hidden === 1 ? 'it' : 'them'} to work on — an exam, a grade, a second course. Search finds them all either way, and opening one keeps it.`;
}
