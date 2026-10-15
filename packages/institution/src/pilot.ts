import type { UniversityRole } from './index.ts';

/**
 * The thirteen roles the Vanderbilt pilot signs in, and how each of them arrives.
 *
 * Stream 02 asked for "a test login per pilot role" and nothing in the repository said which
 * roles those are. D-1318 chose them from the Role Launch Register: the roles a pilot university
 * actually exercises, each at the `usable` rung or above, spanning learners, instructors, the
 * advising and learning-support offices, the registrar, and the university's own administrators
 * and integration owners. The founder can change the list; the tests follow it.
 *
 * ## Two vocabularies, deliberately
 *
 * `app` is the register's role (`public.app_roles`): the thing a screen and a policy ask about. It
 * is granted by exactly one path, the operations console's `role-grant` duty. No SSO claim and no
 * SCIM group assigns it (`rolelaunch.test.ts` holds that).
 *
 * `signsInAs` is the institutional role (`UniversityRole`) a person's membership record carries
 * after SSO. It decides what the gateway lets them ask a university's systems; it is not an app
 * role, and the two are not interchangeable. A registrar signs in as `staff`; whether they also hold
 * the `registrar` app role is the console's decision.
 *
 * ## The groups are placeholders
 *
 * `group` is the IdP group the mapping uses in tests. Vanderbilt's real group names are not known
 * to this repository and are a human input (`docs/handoff/BUILD.md` §7). Until they are supplied,
 * `scim_group_mapping` rows are not written from this list; it exists so the mapping tests have
 * something to hold.
 */
export interface PilotRole {
  /** The register's role, as in `public.app_roles`. */
  app: string;
  /** The institutional role a membership carries after SSO. */
  signsInAs: UniversityRole;
  /** A PLACEHOLDER IdP group name. Replace with the university's own when it is supplied. */
  group: string;
}

const group = (app: string) => `semester-pilot-${app.replaceAll('_', '-')}`;

export const PILOT_ROLES: readonly PilotRole[] = (
  [
    ['student', 'student'],
    ['undergraduate_student', 'student'],
    ['graduate_student', 'student'],
    ['faculty', 'faculty'],
    ['teaching_assistant', 'teaching_assistant'],
    ['academic_advisor', 'advisor'],
    ['tutor', 'staff'],
    ['learning_center_staff', 'staff'],
    ['career_coach', 'staff'],
    ['registrar', 'staff'],
    ['university_staff', 'staff'],
    ['university_admin', 'admin'],
    ['integration_admin', 'admin'],
  ] as const satisfies readonly (readonly [string, UniversityRole])[]
).map(([app, signsInAs]) => ({ app, signsInAs, group: group(app) }));

/** The mapping a test seeds `scim_group_mapping` with: one placeholder group per pilot role. */
export function pilotGroupMapping(): Record<string, readonly UniversityRole[]> {
  return Object.fromEntries(PILOT_ROLES.map((r) => [r.group, [r.signsInAs]]));
}
