/**
 * Every connector augments something Semester already does, and says what
 * keeps working when the connector is off.
 *
 * This is the rule the integration layer is held to: **a connector is never
 * the only way a capability works.** Turn any of them off — a school pauses
 * it, a kill switch trips, a token is revoked, a vendor goes down — and the
 * student is left on a native screen that still does the job, with whatever
 * the connector had already brought in labelled by when it was current.
 *
 * `NATIVE_FALLBACK` is exhaustive over `ProviderDomain`, so adding a provider
 * domain to the catalog without saying what it augments and where the student
 * lands without it is a type error, not a review comment. `fallback.test.ts`
 * checks each route against the real screen table.
 */
import { PROVIDER_DOMAINS, type ProviderDomain } from './catalog.ts';

export interface NativeFallback {
  /** The native Semester capability the connector augments. */
  augments: string;
  /** A key of `SCREENS` in `screens.tsx`: where the job still gets done. */
  nativeRoute: string;
  /** What the connection adds on top of the native capability. */
  adds: string;
}

export const NATIVE_FALLBACK: Record<ProviderDomain, NativeFallback> = {
  identity: { augments: 'Account sign-in and school membership', nativeRoute: 'account', adds: 'Single sign-on and school-managed account lifecycle' },
  sis: { augments: 'Course planning and the academic record', nativeRoute: 'registrar', adds: 'Official terms, sections and enrollment' },
  degree_audit: { augments: 'Degree planning', nativeRoute: 'degree', adds: 'The school’s own requirement status' },
  catalog: { augments: 'Course search and registration planning', nativeRoute: 'registration', adds: 'The school’s current catalog and meeting times' },
  lms: { augments: 'Courses, assignments and deadlines', nativeRoute: 'courses', adds: 'Assignments and policies straight from the LMS' },
  advising: { augments: 'Advisor meetings and next steps', nativeRoute: 'university', adds: 'Appointments and referrals from the advising system' },
  admissions_crm: { augments: 'Getting started at the school', nativeRoute: 'university', adds: 'Admitted-student status from the admissions system' },
  career: { augments: 'Career planning and applications', nativeRoute: 'career', adds: 'Postings, events and appointments from the career office' },
  erp: { augments: 'Costs and deadlines the student tracks', nativeRoute: 'costs', adds: 'Action items from the school’s finance system, as links' },
  bursar: { augments: 'Costs and deadlines the student tracks', nativeRoute: 'costs', adds: 'Bursar action items, as links' },
  financial_aid: { augments: 'Costs and deadlines the student tracks', nativeRoute: 'costs', adds: 'Aid action items, as links' },
  library: { augments: 'Study spaces and sources', nativeRoute: 'study', adds: 'Live study-space availability and library sources' },
  tutoring: { augments: 'Study help', nativeRoute: 'study', adds: 'Services offered and booking links from the learning center' },
  events: { augments: 'Campus activities', nativeRoute: 'activities', adds: 'Official campus events' },
  organizations: { augments: 'Clubs and communities', nativeRoute: 'community', adds: 'The student organizations office’s listings' },
  calendar: { augments: 'The student’s own calendar', nativeRoute: 'calendar', adds: 'Academic and institutional calendar events' },
  research: { augments: 'Opportunities', nativeRoute: 'opportunities', adds: 'The research office’s listings' },
  study_abroad: { augments: 'Opportunities', nativeRoute: 'opportunities', adds: 'Study abroad listings' },
  alumni: { augments: 'The student’s pathway after graduation', nativeRoute: 'pathway', adds: 'Alumni network opportunities' },
  alerts: { augments: 'Notifications', nativeRoute: 'notifs', adds: 'Official campus alerts' },
  transit: { augments: 'Getting around campus', nativeRoute: 'maps', adds: 'Live transit from the provider' },
};

/**
 * The connector families the integration brief names, and how each reaches
 * Semester. A family is a grouping for people; the pipeline's unit is still
 * the provider domain.
 *
 * `student_credential` families run on a credential the student holds and can
 * revoke, outside the school's tenant pipeline — the student's own mailbox, a
 * pasted calendar feed, a personal LMS token. `not_yet_modelled` is a
 * statement of fact with its blocker, not a placeholder to be filled quietly:
 * the catalog has no domain for it, and adding one is a migration.
 */
export type FamilyReach = 'tenant_pipeline' | 'student_credential' | 'not_yet_modelled';

export interface ConnectorFamily {
  id: string;
  label: string;
  domains: readonly ProviderDomain[];
  reach: FamilyReach;
  /** For families outside the pipeline: the native capability and route they augment. */
  native?: { augments: string; nativeRoute: string };
  /** What has to exist before this family can be a tenant connector. */
  blockedBy?: string;
}

export const CONNECTOR_FAMILIES: readonly ConnectorFamily[] = [
  { id: 'identity', label: 'Identity and provisioning', domains: ['identity'], reach: 'tenant_pipeline' },
  { id: 'sis', label: 'Student information', domains: ['sis', 'degree_audit', 'catalog', 'admissions_crm'], reach: 'tenant_pipeline' },
  { id: 'lms', label: 'Learning management', domains: ['lms'], reach: 'tenant_pipeline' },
  { id: 'calendar', label: 'Calendar', domains: ['calendar'], reach: 'tenant_pipeline' },
  {
    id: 'payment', label: 'Payment and billing action items', domains: ['erp', 'bursar', 'financial_aid'], reach: 'tenant_pipeline',
    blockedBy: 'Links and due dates only. An amount is never mapped; Semester’s own subscription billing is a separate system with its own processor.',
  },
  { id: 'campus_service', label: 'Campus services', domains: ['library', 'tutoring', 'events', 'organizations', 'alerts', 'transit', 'advising'], reach: 'tenant_pipeline' },
  { id: 'career', label: 'Career and lifelong', domains: ['career', 'research', 'study_abroad', 'alumni'], reach: 'tenant_pipeline' },
  {
    id: 'email', label: 'Email', domains: [], reach: 'student_credential',
    native: { augments: 'Mail and what needs a reply', nativeRoute: 'mail' },
    blockedBy: 'A student’s mailbox is read with the student’s own grant, so it is not a school connection. A school mail connector would need a domain and a data class.',
  },
  {
    id: 'reporting', label: 'Reporting and exports', domains: [], reach: 'not_yet_modelled',
    native: { augments: 'The student’s own export', nativeRoute: 'export' },
    blockedBy: 'Outbound institutional reporting needs a catalog domain, an approved_write adapter behind a writeback.* flag, and a data-sharing agreement. None exists.',
  },
];

export function familyOf(domain: ProviderDomain): ConnectorFamily | undefined {
  return CONNECTOR_FAMILIES.find((f) => f.domains.includes(domain));
}

/** Everything wrong with the fallback map and the family partition; empty is sound. */
export function fallbackProblems(
  fallback: Partial<Record<ProviderDomain, NativeFallback>> = NATIVE_FALLBACK,
  families: readonly ConnectorFamily[] = CONNECTOR_FAMILIES,
  routeExists: (route: string) => boolean = () => true,
): string[] {
  const problems: string[] = [];
  for (const d of PROVIDER_DOMAINS) {
    const fb = fallback[d];
    if (!fb) { problems.push(`${d}: no native fallback`); continue; }
    if (!fb.augments.trim() || !fb.adds.trim() || !fb.nativeRoute.trim()) problems.push(`${d}: fallback is incomplete`);
    else if (!routeExists(fb.nativeRoute)) problems.push(`${d}: ${fb.nativeRoute} is not a screen`);
    const owners = families.filter((f) => f.domains.includes(d));
    if (owners.length !== 1) problems.push(`${d}: belongs to ${owners.length} families, not one`);
  }
  for (const f of families) {
    if (f.native && !routeExists(f.native.nativeRoute)) problems.push(`${f.id}: ${f.native.nativeRoute} is not a screen`);
    if (f.domains.length === 0 && !f.native) problems.push(`${f.id}: a family with no domain must name the native capability it augments`);
    if (f.reach !== 'tenant_pipeline' && !f.blockedBy) problems.push(`${f.id}: outside the pipeline, so it must say why`);
  }
  return problems;
}
