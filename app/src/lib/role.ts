/**
 * Who is holding the app.
 *
 * Semester was written for one person: a student, taking four courses,
 * carrying their own semester on their own device. Every screen assumes it,
 * and the assumption is load-bearing — the app has no server holding anybody's
 * data, which is what lets it promise that a private note never leaves the
 * phone.
 *
 * It is now meant to be both that and an institutional platform. This file is
 * the first half of that: the concept, and an honest account of which roles
 * the app can actually serve today.
 *
 * ## What a role can and cannot be without a server
 *
 * This matters more than the list below, so it is written first.
 *
 * A role that only ever reads and writes **its own** data works today, because
 * that is the shape the whole app already has. A professor preparing a course
 * — turning a syllabus into modules and deadlines, writing a practice paper,
 * making slides and a handout, keeping the term's dates — is doing exactly
 * what a student does with the same screens, for a different reason.
 *
 * A role that reads **somebody else's** data cannot. An advisor reviewing a
 * student's plan, a professor grading a roster, an administrator reporting on
 * enrolment, a parent seeing a bill: every one of those needs a server, an
 * authenticated identity on both sides, and an authorisation model, and the
 * app has none of the three. Shipping them as screens that look right and hold
 * only what you typed into them would be the exact failure `data/campus.ts`
 * refuses — a confident thing that is not true.
 *
 * So `ready` below is not a roadmap ordering. It is the line between what the
 * app can do and what it would have to pretend.
 *
 * ## Not a security boundary
 *
 * Nothing here is a permission. It is one device, one person, and a role is a
 * statement about what they are here to do — the same kind of thing as the
 * school's capabilities in `lib/school.ts`, which decide whether a meal-plan
 * screen exists rather than whether somebody is allowed to see one. When the
 * institutional half arrives it will need real authorisation on a server, and
 * this file will be what the client asks for, never what grants it.
 */

import type { Screen } from './types';

export type Role = 'student' | 'faculty' | 'advisor' | 'admin' | 'payer' | 'staff';

export interface RoleInfo {
  id: Role;
  label: string;
  /** What this person opens Semester to do. */
  blurb: string;
  /**
   * Whether it can be chosen today.
   *
   * False means the app cannot serve it without a server and an institution
   * behind it — see the note above. A role that is not ready is shown, with
   * what it is waiting on, rather than hidden: somebody who came looking for
   * it deserves to know it is understood and missing, not to conclude the app
   * has never heard of advisors.
   */
  ready: boolean;
  /** What it is still waiting on. Empty for the ready ones. */
  needs: string;
}

export const ROLES: RoleInfo[] = [
  {
    id: 'student',
    label: 'Student',
    blurb: 'Your courses, your deadlines, your studying, your bill.',
    ready: true,
    needs: '',
  },
  {
    id: 'faculty',
    label: 'Teaching',
    blurb:
      'Build a course from your own syllabus, keep the term’s dates, write the handout, the ' +
      'slides and the practice paper.',
    ready: true,
    needs: '',
  },
  {
    id: 'advisor',
    label: 'Advising',
    blurb: 'Your advisees’ plans, their progress, and the appointments between.',
    ready: false,
    needs:
      'Reading a student’s record, which needs a server, an identity on both sides and their ' +
      'consent. The app holds nobody’s data but yours.',
  },
  {
    id: 'admin',
    label: 'Administration',
    blurb: 'Enrolment, the catalogue, billing, reporting.',
    ready: false,
    needs: 'An institutional deployment and a student-information system to read.',
  },
  {
    id: 'payer',
    label: 'Parent or payer',
    blurb: 'The part of a student’s bill they have chosen to share with you.',
    ready: false,
    needs:
      'A way for the student to share it — an authorised-payer relationship the university ' +
      'grants, not something either side can assert here.',
  },
  {
    id: 'staff',
    label: 'Campus services',
    blurb: 'Dining, housing, the library, transport, the desk you work at.',
    ready: false,
    needs: 'The service systems themselves, none of which publish anything a client can use.',
  },
];

export const DEFAULT_ROLE: Role = 'student';

export function roleOf(id: string): RoleInfo {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

/** The roles somebody can actually pick. */
export function pickable(): RoleInfo[] {
  return ROLES.filter((r) => r.ready);
}

/**
 * Screens that only make sense to somebody taking the courses.
 *
 * Deliberately short, and conservative about what goes on it. The test is not
 * "would a professor use this less" — it is "is this nonsense addressed to
 * them": a degree audit, a dorm, an exam to sit, a tuition bill. Anything
 * arguable stays available, because a screen wrongly hidden is a feature
 * silently removed and a screen wrongly shown is one somebody ignores.
 *
 * `me` is not here, and it is the one worth naming: it reads as "Progress",
 * and it is also the app's directory — the way to every other screen under
 * three of the four navigations. Hiding it would take out a navigation
 * surface to tidy a heading.
 */
const STUDENT_ONLY: Screen[] = [
  'degree',
  'runway',
  'behind',
  'tonight',
  'groupwork',
  'meals',
  'housing',
  'yes',
  'classmates',
  'activities',
  'costs',
  'applying',
] as Screen[];

const STUDENT_ONLY_SET = new Set<string>(STUDENT_ONLY);

/**
 * Whether a screen belongs to this role.
 *
 * The third gate, beside `allowed` in `lib/school.ts` and `showing` in
 * `lib/nav.ts`, and a different question from both: the school decides whether
 * a thing exists here, progress decides whether it is useful yet, and this
 * decides whether it is addressed to the person holding the phone. None of the
 * three can un-hide what another hid.
 *
 * Everything not named is available to everybody, which is the safe direction:
 * a screen added later and forgotten here stays visible rather than vanishing
 * for every role but one.
 */
export function forRole(screen: string, role: Role): boolean {
  return role === 'student' ? true : !STUDENT_ONLY_SET.has(screen);
}

/** Every screen this role does not see. For the diagnostics dump and the tests. */
export function hiddenFrom(role: Role): string[] {
  return role === 'student' ? [] : [...STUDENT_ONLY];
}
