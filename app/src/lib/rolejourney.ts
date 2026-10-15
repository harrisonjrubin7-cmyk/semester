import { forRole, ROLES, type Role } from './role';
import type { Screen } from './types';

/**
 * How each person who can hold the app gets to a first useful action.
 *
 * One row per role in `lib/role.ts`. The screen is a place that role can
 * already open. A role with no such place has `screen: null` and says so —
 * a title is not a workspace. Nothing here grants access: institutional
 * records stay behind the gateway, the same as `lib/role.ts`.
 */
export interface RoleJourney {
  role: Role;
  /** How this person arrives. */
  enter: string;
  /** The first thing worth doing, in one sentence. */
  firstAction: string;
  /** Where that action is. Null when this app has no screen for it. */
  screen: Screen | null;
  /** What happens to the work later. */
  lifecycle: string;
}

export const ROLE_JOURNEYS: readonly RoleJourney[] = [
  {
    role: 'student',
    enter: 'The site, a link, or the app. No account is required to start.',
    firstAction: 'Build a registration plan: name the term and the courses you are considering.',
    screen: 'yes',
    lifecycle: 'The plan stays on this device. Signing in keeps it on another device. It is not an enrollment, a grade, or a credential.',
  },
  {
    role: 'faculty',
    enter: 'You choose Teaching, or an institution invites you. Choosing it does not assign a course.',
    firstAction: 'Add a course from your own syllabus, or type the code and fill the materials in yourself.',
    screen: 'import',
    lifecycle: 'Publishing to a roster, official grading, and grade release wait on an institution-assigned course role.',
  },
  {
    role: 'teaching_assistant',
    enter: 'You choose Teaching assistant. An assigned section is a grant, not this choice.',
    firstAction: 'Prepare materials for a course you already have, the same way a syllabus is added.',
    screen: 'import',
    lifecycle: 'Rosters, grading, and the end of an assignment are removed with the grant, not by hiding a menu.',
  },
  {
    role: 'advisor',
    enter: 'You choose Advising. A caseload is a scoped grant plus the student’s consent.',
    firstAction: 'Keep an appointment and the notes you prepare for it.',
    screen: 'meet',
    lifecycle: 'Reading an advisee’s record waits on identity, a current grant, and consent. A role change removes the grant.',
  },
  {
    role: 'admin',
    enter: 'You choose Administration. Official actions wait on a verified institutional role.',
    firstAction: 'See which university services this app can reach, and which it cannot.',
    screen: 'university',
    lifecycle: 'Catalogue, registration, and records stay in the school’s systems until a scoped grant says otherwise.',
  },
  {
    role: 'staff',
    enter: 'You choose Campus services. A student case is a scoped grant.',
    firstAction: 'Open campus support: care, access, safety, and the services a student can find.',
    screen: 'support',
    lifecycle: 'Official service records wait on a staff grant and the campus system that keeps them.',
  },
  {
    role: 'applicant',
    enter: 'You choose Applicant. Official admission status is not on this device.',
    firstAction: 'Keep your own application steps, visits, and questions.',
    screen: 'launchpad',
    lifecycle: 'A decision, an enrollment, or a pause is the school’s. This checklist is the one you wrote.',
  },
  {
    role: 'payer',
    enter: 'You choose Parent or payer. A bill is shared by a grant, not by the role.',
    firstAction: 'There is no payer workspace on this device yet. A shared bill needs an authorized-payer grant.',
    screen: null,
    lifecycle: 'When a grant exists it is scoped to that bill and expires with the authorization.',
  },
  {
    role: 'family',
    enter: 'A student invites you, or you choose Authorized family. The invite is the grant.',
    firstAction: 'Keep what a student has agreed you may see, and the questions you are preparing.',
    screen: 'family',
    lifecycle: 'The grant expires or is revoked. Nothing else on the student’s record comes with it.',
  },
  {
    role: 'alumni',
    enter: 'You choose Alumni. An alumni identity is the institution’s to verify.',
    firstAction: 'Look through opportunities you can keep for yourself: work, mentoring, and what comes after the term.',
    screen: 'opportunities',
    lifecycle: 'Alumni-only services wait on a verified alumni identity. What you typed here stays yours.',
  },
];

/** The journey for a role. A role this file forgot is a broken map, not a student. */
export function journeyFor(role: Role): RoleJourney {
  const found = ROLE_JOURNEYS.find((row) => row.role === role);
  if (!found) throw new Error(`No journey for ${role}`);
  return found;
}

/** Rows that name a role twice, or a role that does not exist. Screen checks live in the test. */
export function journeyRoleFaults(): string[] {
  const faults: string[] = [];
  const named = ROLE_JOURNEYS.map((row) => row.role);
  if (new Set(named).size !== named.length) faults.push('a role is listed twice');
  const known = new Set(ROLES.map((role) => role.id));
  for (const role of known) {
    if (!named.includes(role)) faults.push(`${role} has no journey`);
  }
  for (const role of named) {
    if (!known.has(role)) faults.push(`${role} is not a role`);
  }
  return faults;
}

/** A named screen this role is not allowed to open. */
export function closedJourneys(): RoleJourney[] {
  return ROLE_JOURNEYS.filter((row) => row.screen !== null && !forRole(row.screen, row.role));
}
