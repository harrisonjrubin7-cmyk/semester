/**
 * The data contract registry: who owns each institutional data domain, and
 * what happens when it is wrong.
 *
 * "Source of truth" is a slogan until somebody can answer, for one field, who
 * decides what it means, who fixes it, how fresh it has to be and what breaks
 * downstream when it is not. Each connector flag in `flags.ts` moves one
 * domain, and each domain has a contract here; the test fails for a connector
 * without one.
 *
 * Roles are stated as institutional roles, because Semester does not choose
 * the registrar. The named person for each role is filled per tenant during
 * onboarding (`StewardAssignment`), and `readiness` reports a contract as
 * unstaffed until the owner and the steward both have one. A connection for a
 * tenant whose contract is unstaffed is not ready to go live — that is a
 * human gap, and the registry says so rather than papering over it.
 *
 * See docs/operating-model/DATA-STEWARDSHIP.md.
 */
import { routeAllowed, type DataClass } from '../integration/classification';

/** The eight stewardship roles. */
export type StewardRole =
  | 'data_owner'
  | 'data_steward'
  | 'system_owner'
  | 'integration_owner'
  | 'privacy_owner'
  | 'security_owner'
  | 'metric_owner'
  | 'content_owner';

export const STEWARD_ROLES: Record<StewardRole, string> = {
  data_owner: 'Accountable for a domain’s meaning and approved use',
  data_steward: 'Maintains quality, definitions, freshness and corrections',
  system_owner: 'Operates the source system',
  integration_owner: 'Owns mapping and sync health',
  privacy_owner: 'Sets use, retention and privacy boundary',
  security_owner: 'Controls technical access and incident response',
  metric_owner: 'Defines calculation and reporting use',
  content_owner: 'Maintains student-facing text and resources',
};

export interface DataContract {
  domain: string;
  /** The connector flag that moves this domain. */
  connector: string;
  definition: string;
  /** Institutional role accountable for meaning (the data owner). */
  ownerRole: string;
  /** Institutional role that maintains quality (the data steward). */
  stewardRole: string;
  sourceSystem: string;
  fields: readonly string[];
  classification: DataClass;
  allowedUses: readonly string[];
  /** Verified capabilities that may read it, besides the student reading their own. */
  authorizedCapabilities: readonly string[];
  freshnessSlaHours: number;
  qualityChecks: readonly string[];
  mappingVersion: string;
  knownLimitations: readonly string[];
  correctionProcess: string;
  downstream: readonly string[];
  retention: string;
}

const COMMON_RETENTION = 'Kept while the connection is live; purged within 30 days of disconnect or account deletion.';

export const CONTRACTS: readonly DataContract[] = [
  {
    domain: 'Enrollment and schedule', connector: 'integration.sis_read',
    definition: 'The sections a student is registered in for a term, with meeting times and instructor of record.',
    ownerRole: 'University Registrar', stewardRole: 'Registrar data steward', sourceSystem: 'Student information system',
    fields: ['term', 'program', 'section', 'enrollment_status', 'meeting_pattern', 'registration_window'],
    classification: 'T3', allowedUses: ['Scope course workspaces', 'Place classes on the calendar'],
    authorizedCapabilities: ['integration:view'], freshnessSlaHours: 24,
    qualityChecks: ['Section exists in the catalog for the term', 'No duplicate enrollment per section', 'Meeting times parse'],
    mappingVersion: 'sis-v1', knownLimitations: ['Waitlist position is not imported', 'Cross-listed sections appear once'],
    correctionProcess: 'Student flags the row → registrar steward corrects in the SIS → next sync overwrites; Semester never edits the fact.',
    downstream: ['Today', 'Calendar', 'Course workspaces', 'Registration day'], retention: COMMON_RETENTION,
  },
  {
    domain: 'Assignment dates', connector: 'integration.lms_lti',
    definition: 'Assignment titles and due dates published in the LMS for courses the student is enrolled in.',
    ownerRole: 'Instructor of record (per course)', stewardRole: 'LMS administrator', sourceSystem: 'Learning management system (LTI 1.3)',
    fields: ['course_id', 'assignment_title', 'due_at', 'points_possible'],
    classification: 'T1', allowedUses: ['Place due dates on Today and Plan'],
    authorizedCapabilities: ['integration:view'], freshnessSlaHours: 6,
    qualityChecks: ['Due date in the term', 'Title present', 'Course matches an enrollment'],
    mappingVersion: 'lti-v1', knownLimitations: ['Per-student extensions are not visible'],
    correctionProcess: 'Instructor edits the LMS; the stale label shows until the next sync.',
    downstream: ['Today', 'Plan', 'Deadlines'], retention: COMMON_RETENTION,
  },
  {
    domain: 'Degree audit status', connector: 'integration.degree_audit_read',
    definition: 'Requirement-by-requirement status from the official degree audit.',
    ownerRole: 'University Registrar', stewardRole: 'Degree audit administrator', sourceSystem: 'Degree audit system',
    fields: ['requirement_id', 'requirement_label', 'status', 'applied_courses'],
    classification: 'T3', allowedUses: ['Show progress with the audit named as source', 'Graduation scenarios'],
    authorizedCapabilities: ['integration:view'], freshnessSlaHours: 72,
    qualityChecks: ['Every requirement has a status', 'Applied courses exist in enrollment history'],
    mappingVersion: 'audit-v1', knownLimitations: ['Pending petitions are not reflected'],
    correctionProcess: 'Advisor or registrar corrects the audit; Semester shows the audit’s date, never its own verdict.',
    downstream: ['Degree', 'Pathway', 'Graduation scenarios'], retention: COMMON_RETENTION,
  },
  {
    domain: 'Advising appointments', connector: 'integration.advising_crm',
    definition: 'The student’s own appointment times and referral actions.',
    ownerRole: 'Director of Advising', stewardRole: 'Advising CRM administrator', sourceSystem: 'Advising CRM',
    fields: ['appointment_at', 'advisor_display_name', 'location_or_link', 'referral_action'],
    classification: 'T3', allowedUses: ['Show upcoming appointments', 'Prepare an agenda'],
    authorizedCapabilities: ['integration:view'], freshnessSlaHours: 12,
    qualityChecks: ['Appointment in the future or within 7 days past', 'Location or link present'],
    mappingVersion: 'crm-v1', knownLimitations: ['Advisor notes are never imported'],
    correctionProcess: 'Advising office corrects in the CRM.',
    downstream: ['Today', 'Advising agenda'], retention: COMMON_RETENTION,
  },
  {
    domain: 'Career opportunities', connector: 'integration.career',
    definition: 'Jobs, internships and events published by the career center.',
    ownerRole: 'Director of Career Services', stewardRole: 'Career platform administrator', sourceSystem: 'Career platform',
    fields: ['posting_id', 'title', 'employer', 'deadline', 'url'],
    classification: 'T0', allowedUses: ['List opportunities', 'Deadline reminders'],
    authorizedCapabilities: [], freshnessSlaHours: 24,
    qualityChecks: ['URL resolves', 'Deadline not in the past'],
    mappingVersion: 'career-v1', knownLimitations: ['Application status is not imported'],
    correctionProcess: 'Career center edits the posting.',
    downstream: ['Career'], retention: 'Removed when the posting closes.',
  },
  {
    domain: 'Campus services', connector: 'integration.campus_services',
    definition: 'Library, tutoring, events, organizations, transit and official alerts.',
    ownerRole: 'Dean of Students (per service office)', stewardRole: 'Service office content owner', sourceSystem: 'Campus service systems',
    fields: ['service_id', 'name', 'hours', 'availability', 'booking_url', 'alert_text'],
    classification: 'T0', allowedUses: ['Show services and alerts', 'Hand off bookings'],
    authorizedCapabilities: [], freshnessSlaHours: 24,
    qualityChecks: ['Hours parse', 'Booking URL resolves', 'Alerts carry an issuer'],
    mappingVersion: 'services-v1', knownLimitations: ['Real-time capacity only where the provider offers it'],
    correctionProcess: 'Service office edits the source; content owner reviews each term.',
    downstream: ['Directory', 'Today', 'Service handoffs'], retention: 'Replaced on each sync.',
  },
  {
    domain: 'Bursar and aid actions', connector: 'integration.erp_bursar_actions',
    definition: 'That an action is required, and the office’s link. No amounts, no decisions, no payments.',
    ownerRole: 'Bursar and Director of Financial Aid', stewardRole: 'Student financial services steward', sourceSystem: 'ERP / student accounts',
    fields: ['action_required', 'office', 'deep_link', 'due_at'],
    classification: 'T3', allowedUses: ['Show an action item with a deep link'],
    authorizedCapabilities: ['integration:view'], freshnessSlaHours: 24,
    qualityChecks: ['Deep link resolves to the institution domain', 'No amount field present'],
    mappingVersion: 'bursar-v1', knownLimitations: ['The reason for a hold is never shown'],
    correctionProcess: 'Office resolves in the ERP; the item clears on the next sync.',
    downstream: ['Today', 'Bill'], retention: COMMON_RETENTION,
  },
];

export interface StewardAssignment {
  tenantId: string;
  connector: string;
  role: StewardRole;
  /** A named person. A department inbox is not an owner. */
  person: string;
}

export type ContractReadiness =
  | { ready: true }
  | { ready: false; missing: StewardRole[]; problems: string[] };

/** The roles a contract cannot go live without a named person in. */
export const REQUIRED_TO_GO_LIVE: readonly StewardRole[] = ['data_owner', 'data_steward', 'integration_owner', 'privacy_owner'];

/** Whether a tenant's contract for this connector is staffed and sound. */
export function readiness(contract: DataContract, tenantId: string, assignments: readonly StewardAssignment[]): ContractReadiness {
  const mine = assignments.filter((a) => a.tenantId === tenantId && a.connector === contract.connector && a.person.trim() !== '');
  const missing = REQUIRED_TO_GO_LIVE.filter((r) => !mine.some((a) => a.role === r));
  const problems = contractProblems(contract);
  return missing.length === 0 && problems.length === 0 ? { ready: true } : { ready: false, missing, problems };
}

/** Structural faults in a contract itself, independent of any tenant. */
export function contractProblems(c: DataContract): string[] {
  const out: string[] = [];
  if (!routeAllowed(c.classification, 'semester')) out.push(`${c.domain}: ${c.classification} may not be stored in Semester at all.`);
  if (c.fields.length === 0) out.push(`${c.domain}: no fields named; a mapping may only carry named fields.`);
  if (!(c.freshnessSlaHours > 0)) out.push(`${c.domain}: freshness SLA must be a positive number of hours.`);
  if (c.qualityChecks.length === 0) out.push(`${c.domain}: no quality checks.`);
  if (c.correctionProcess.trim() === '') out.push(`${c.domain}: no correction process.`);
  return out;
}

export function contractFor(connector: string): DataContract | undefined {
  return CONTRACTS.find((c) => c.connector === connector);
}
