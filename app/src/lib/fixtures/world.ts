/**
 * The synthetic world every test, probe and load run draws its people from.
 *
 * `docs/quality-system/08-REPOSITORY-AND-FIXTURES.md` says why each rule is
 * here. In one line each:
 *
 *   - **Deterministic.** An id is a function of its name, so the same world is
 *     the same world in TypeScript, in SQL and in a probe, with no registry to
 *     keep in step. SQL spells it `md5('<namespace>:<parts>')::uuid`.
 *   - **Visibly synthetic.** Every address ends `.invalid` and every tenant slug
 *     starts `zz-test-`, so a probe that finds anything else in a non-production
 *     dataset has found a real person's data where none belongs.
 *   - **Derived, not listed.** There is a persona for every role the role
 *     register holds. A role added to `rolelaunch.ts` has a persona the moment it
 *     exists; this file has no second list of roles to forget.
 *   - **Time is data.** Three held instants, so a test that depends on a window,
 *     a term or a zone change says which one instead of reading the clock.
 *
 * Nothing here touches the network, the clock or a database.
 */

import { createHash } from 'node:crypto';
import { INTERNAL_CATEGORIES, ROLES } from '../rolelaunch';

export const FIXTURE_NAMESPACE = 'semester-fixture:v1';

/** Reserved top-level domain for every fixture address (RFC 2606: never resolves). */
export const FIXTURE_DOMAIN = 'invalid';

/** `md5(text)::uuid`, the same thing PostgreSQL computes, so SQL fixtures agree with these. */
export function fixtureId(...parts: string[]): string {
  const hex = createHash('md5').update([FIXTURE_NAMESPACE, ...parts].join(':')).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type TenantKind = 'pooled' | 'silo' | 'k12' | 'individual' | 'internal';

export interface FixtureTenant {
  slug: string;
  kind: TenantKind;
  /** The rollout ring it models (docs/target-architecture/05, §3). */
  ring: number | 'individual';
  /** What a test uses it for. */
  purpose: string;
}

export const TENANTS: readonly FixtureTenant[] = [
  { slug: 'zz-test-a', kind: 'pooled', ring: 1, purpose: 'the school whose data a test tries to protect' },
  { slug: 'zz-test-b', kind: 'pooled', ring: 1, purpose: 'the other school, the one that must never see school A' },
  { slug: 'zz-test-silo', kind: 'silo', ring: 4, purpose: 'a dedicated-database, dedicated-key customer' },
  { slug: 'zz-test-k12', kind: 'k12', ring: 1, purpose: 'minors, guardians and counsellors; age-dependent policy' },
  { slug: 'zz-test-individual', kind: 'individual', ring: 'individual', purpose: 'a student with no institution' },
  { slug: 'zz-test-semester', kind: 'internal', ring: 0, purpose: 'the company’s own people: support, trust, commercial' },
];

export const TENANT_SLUGS: readonly string[] = TENANTS.map((t) => t.slug);

export interface Persona {
  id: string;
  role: string;
  tenant: string;
  email: string;
  name: string;
}

const INTERNAL = new Set<string>(INTERNAL_CATEGORIES);
const LEARNER_ROLES = new Set(ROLES.filter((r) => r.category === 'learner').map((r) => r.role));

/** Which roles exist in which kind of tenant: internal staff only in the company's, learners alone when there is no institution. */
export function rolesIn(tenant: FixtureTenant): string[] {
  const internal = ROLES.filter((r) => INTERNAL.has(r.category)).map((r) => r.role);
  if (tenant.kind === 'internal') return internal;
  if (tenant.kind === 'individual') return [...LEARNER_ROLES].filter((r) => r !== 'prospective_student' && r !== 'admitted_student');
  return ROLES.map((r) => r.role).filter((role) => !internal.includes(role));
}

export function personaFor(role: string, tenant: string): Persona {
  const label = role.replace(/_/g, ' ');
  return {
    id: fixtureId('persona', tenant, role),
    role,
    tenant,
    email: `${role}.${tenant}@fixture.${FIXTURE_DOMAIN}`,
    name: `ZZ ${label} (${tenant})`,
  };
}

/** Every persona in the world, one per (tenant, role) that can exist there. */
export function buildWorld(): readonly Persona[] {
  return TENANTS.flatMap((t) => rolesIn(t).map((role) => personaFor(role, t.slug)));
}

/** True for an address that is reserved for fixtures; false for anything a real person could hold. */
export function isFixtureIdentity(email: string): boolean {
  return new RegExp(`^[a-z0-9_]+\\.zz-test-[a-z0-9-]+@fixture\\.${FIXTURE_DOMAIN}$`).test(email);
}

/** The three instants the suites hold the clock at. Each is data, not a reading of `Date.now()`. */
export const CLOCK_POINTS = {
  /** A Wednesday morning in the middle of a spring term, America/Chicago. */
  midTerm: '2027-02-17T16:00:00Z',
  /** The minute a registration window opens, a Monday at 07:00 America/Chicago. */
  registrationOpens: '2027-04-05T12:00:00Z',
  /** An hour before 02:00 on the day clocks go forward in America/Chicago. */
  springForward: '2027-03-14T07:00:00Z',
} as const;

export interface EdgePerson {
  key: string;
  /** The tenant (or tenants) they belong to. */
  tenants: readonly string[];
  /** Why they are in the world. */
  exercises: string;
  /** Journeys in the catalog they are the hard case for. */
  journeys: readonly string[];
}

/** People most defects in this domain are found on. First-class, named, and in the world by default. */
export const EDGE_PEOPLE: readonly EdgePerson[] = [
  { key: 'transfer-pending', tenants: ['zz-test-a'], exercises: 'a transfer student whose credit is unevaluated: never self-verified', journeys: ['J-ACA-03'] },
  { key: 'minor-with-guardian', tenants: ['zz-test-k12'], exercises: 'a minor and a guardian; age-dependent sharing and revocation', journeys: ['J-FAM-01'] },
  { key: 'accommodation-holder', tenants: ['zz-test-a'], exercises: 'a passport issued and revoked; no diagnosis anywhere', journeys: ['J-LRN-04'] },
  { key: 'legal-hold-subject', tenants: ['zz-test-a'], exercises: 'a hold that stops deletion and survives a restore', journeys: ['J-SUP-02', 'J-OPS-02'] },
  { key: 'deprovisioned', tenants: ['zz-test-a'], exercises: 'removed by the school while a token is still unexpired', journeys: ['J-ID-02'] },
  { key: 'two-tenant-person', tenants: ['zz-test-a', 'zz-test-b'], exercises: 'one human in two schools: the hardest isolation case', journeys: ['J-ID-03', 'J-COM-02'] },
  { key: 'alumnus-after-offboarding', tenants: ['zz-test-a'], exercises: 'a former student after their school left', journeys: ['J-ADM-03', 'J-CAR-02'] },
  { key: 'revoked-mid-session', tenants: ['zz-test-a'], exercises: 'a share revoked while the other person has it open', journeys: ['J-ACA-04'] },
  { key: 'faculty-also-student', tenants: ['zz-test-a'], exercises: 'a teaching assistant who is also enrolled in the course', journeys: ['J-LRN-01'] },
  { key: 'break-glass-operator', tenants: ['zz-test-semester'], exercises: 'a time-boxed, dual-controlled, audited elevation', journeys: ['J-ID-03', 'J-ADM-01'] },
  { key: 'heavy-account', tenants: ['zz-test-individual'], exercises: 'ten thousand actions and long text: scale, sync and export', journeys: ['J-PRD-01', 'J-PRD-02'] },
  { key: 'offline-for-a-week', tenants: ['zz-test-individual'], exercises: 'a device returning after a week with old-shape data', journeys: ['J-PRD-01'] },
];
