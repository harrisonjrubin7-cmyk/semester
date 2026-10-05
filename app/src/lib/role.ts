/**
 * Who is holding the app.
 *
 * Semester began as one student's local workspace. It now also has an
 * authenticated institutional gateway, scoped grants and role workspaces. The
 * client role still does not grant access: it changes the language and tools
 * addressed to the person holding the app, while the server independently
 * authorizes every institutional read and action.
 *
 * It is now meant to be both that and an institutional platform. This file is
 * the first half of that: the concept, and an honest account of which roles
 * the app can actually serve today.
 *
 * ## What a role can and cannot be without a server
 *
 * Every role below can use a live, local workspace today. A role may prepare
 * work, keep its own records and use the tools addressed to it without waiting
 * for an institution. Cross-person or official institutional data is a
 * different boundary. Those functions appear only after the gateway returns a
 * current, scoped grant; selecting a role here never manufactures one.
 *
 * ## Not a security boundary
 *
 * Nothing here is a permission. It is a statement about what this person is
 * here to do — the same kind of thing as the school's capabilities in
 * `lib/school.ts`, which decide whether a meal-plan screen exists rather than
 * whether somebody is allowed to see one. `institutional-access.ts` and the
 * gateway remain the authority for connected data.
 */

import type { Screen } from './types';

export type Role =
  | 'student'
  | 'faculty'
  | 'teaching_assistant'
  | 'advisor'
  | 'admin'
  | 'staff'
  | 'applicant'
  | 'payer'
  | 'family'
  | 'alumni';

export interface RoleInfo {
  id: Role;
  label: string;
  /** What this person opens Semester to do. */
  blurb: string;
  /** Whether this role has a usable workspace and can be chosen today. */
  ready: boolean;
  /** What works without an institutional connection. */
  live: string;
  /** What connected or official data still requires. */
  needs: string;
}

export const ROLES: RoleInfo[] = [
  {
    id: 'student',
    label: 'Student',
    blurb: 'Your courses, your deadlines, your studying, your bill.',
    ready: true,
    live: 'Plan, study, create work and manage your own Semester records now.',
    needs: '',
  },
  {
    id: 'faculty',
    label: 'Teaching',
    blurb:
      'Build a course from your own syllabus, keep the term’s dates, write the handout, the ' +
      'slides and the practice paper.',
    ready: true,
    live: 'Build course materials, assignments, lessons and feedback drafts now.',
    needs: 'Publishing, rosters and official grading require an institution-assigned course role and an approved learning-system connection.',
  },
  {
    id: 'teaching_assistant',
    label: 'Teaching assistant',
    blurb: 'Your assigned course sections, learning activities and student support work.',
    ready: true,
    live: 'Prepare learning activities, office-hours support and course materials now.',
    needs: 'Assigned sections, rosters and grading require an institution-assigned course role and an approved learning-system connection.',
  },
  {
    id: 'advisor',
    label: 'Advising',
    blurb: 'Your advisees’ plans, their progress, and the appointments between.',
    ready: true,
    live: 'Prepare appointment plans, advising notes and follow-up drafts now.',
    needs:
      'Reading an advisee’s record requires verified identities, a current scoped grant and the student’s consent.',
  },
  {
    id: 'admin',
    label: 'Administration',
    blurb: 'Enrolment, the catalogue, billing, reporting.',
    ready: true,
    live: 'Prepare policies, catalogue work, implementation plans and reports now.',
    needs: 'Official records and administrative actions require a verified institutional role and approved source-system connections.',
  },
  {
    id: 'payer',
    label: 'Parent or payer',
    blurb: 'The part of a student’s bill they have chosen to share with you.',
    ready: true,
    live: 'Keep payment questions, deadlines and handoff preparation together now.',
    needs:
      'Billing details and payment actions require a current authorized-payer relationship granted by the institution.',
  },
  {
    id: 'staff',
    label: 'Campus services',
    blurb: 'Dining, housing, the library, transport, the desk you work at.',
    ready: true,
    live: 'Prepare service information, support responses and campus-resource work now.',
    needs: 'Student cases and official service records require a scoped staff grant and approved campus-system connections.',
  },
  {
    id: 'applicant',
    label: 'Applicant',
    blurb: 'Your application steps, decisions, visits and transition into the university.',
    ready: true,
    live: 'Track application preparation, visits, questions and transition actions now.',
    needs: 'Official application status and decisions require a verified admissions identity and an approved applicant-system connection.',
  },
  {
    id: 'family',
    label: 'Authorized family',
    blurb: 'The information and actions a student or university has explicitly shared with you.',
    ready: true,
    live: 'Keep student-approved questions, shared plans and family follow-up together now.',
    needs: 'Student or university records require a current, auditable authorization scoped to the specific record and action.',
  },
  {
    id: 'alumni',
    label: 'Alumni',
    blurb: 'Mentoring, lifelong learning, university services and opportunities after graduation.',
    ready: true,
    live: 'Find opt-in mentors, plan lifelong learning and explore opportunities now.',
    needs: 'Alumni-only records and services require an institution-verified alumni identity and approved service connections.',
  },
];

export const DEFAULT_ROLE: Role = 'student';

export function roleOf(id: string): RoleInfo {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

/** Every role with a usable workspace. Kept as a predicate so a future role cannot ship half-built. */
export function pickable(): RoleInfo[] {
  return ROLES.filter((r) => r.ready);
}

/**
 * A denser layout worth *offering* to roles whose screens are mostly rows and
 * columns, or null when the default is right.
 *
 * An offer and never a default: the role is self-chosen and "has not chosen a
 * density" is not representable (`density` is always one of three), so nothing
 * here may change a layout on its own. The settings page shows the offer beside
 * the role and the person accepts it or does not. See the design-system spec,
 * section 3.5.
 */
export function denserLayoutFor(role: Role): 'snug' | null {
  return role === 'faculty' || role === 'teaching_assistant' || role === 'advisor' || role === 'admin' || role === 'staff'
    ? 'snug'
    : null;
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
  'groupwork',
  'meals',
  'housing',
  'yes',
  'classmates',
  'activities',
  'costs',
  'applying',
  // Deposits, orientation and placement tests are addressed to somebody arriving.
  'launchpad',
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
export function forRole(screen: string, role: Role | null | undefined): boolean {
  // Only a role that *is* the student's opens the student-only screens. A
  // role that is missing, null or not one this file names — a lookup that
  // failed, a state not yet read — gets the narrower set, never the wider:
  // a gate that grants on "don't know" is not a gate. See `find.test.ts`,
  // "search is a gate too".
  if (role === 'student') return true;
  // The applicant workspace is the prospect-to-first-term checklist. It is
  // local and self-authored, so it stays available before an admissions
  // connection exists; only official status and decisions remain gated.
  if (role === 'applicant' && screen === 'launchpad') return true;
  return !STUDENT_ONLY_SET.has(screen);
}

/** A stale bookmark or role switch cannot keep a role-inapplicable screen open. */
export function screenForRole(screen: Screen, role: Role): Screen {
  return forRole(screen, role) ? screen : 'home';
}

/** Every screen this role does not see. For the diagnostics dump and the tests. */
export function hiddenFrom(role: Role): string[] {
  if (role === 'student') return [];
  if (role === 'applicant') return STUDENT_ONLY.filter((screen) => screen !== 'launchpad');
  return [...STUDENT_ONLY];
}
