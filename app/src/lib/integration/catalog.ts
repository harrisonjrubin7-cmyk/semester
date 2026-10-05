/**
 * The vocabulary the gateway, the dashboard and the database share: provider
 * domains, canonical entities, freshness, sync classes, and the list of things
 * no connector ingests by default. The SQL check constraints spell four of
 * these lists — provider domains, canonical entities, conflict kinds and
 * connection statuses — and catalog.test.ts holds each to the constraint
 * that wins across the migrations, value for value. Freshness and the sync
 * classes have no constraint; they are this file's alone.
 *
 * This file is the authoritative integration catalog. Its owner, version and
 * review dates are held in SEMESTER-OPERATING-SYSTEM.md at the repository root.
 */
import type { DataClass } from './classification.ts';

export type ProviderDomain =
  | 'identity' | 'sis' | 'degree_audit' | 'catalog' | 'lms' | 'advising' | 'admissions_crm'
  | 'career' | 'erp' | 'bursar' | 'financial_aid' | 'library' | 'tutoring' | 'events'
  | 'organizations' | 'calendar' | 'research' | 'study_abroad' | 'alumni' | 'alerts' | 'transit';

export const PROVIDER_DOMAINS: readonly ProviderDomain[] = [
  'identity', 'sis', 'degree_audit', 'catalog', 'lms', 'advising', 'admissions_crm', 'career',
  'erp', 'bursar', 'financial_aid', 'library', 'tutoring', 'events', 'organizations', 'calendar',
  'research', 'study_abroad', 'alumni', 'alerts', 'transit',
];

export const CANONICAL_ENTITIES = [
  'institution', 'campus', 'college', 'school', 'program', 'term', 'course', 'course_section',
  'academic_requirement', 'student_program', 'enrollment', 'registration_window',
  'registration_hold', 'course_catalog_entry', 'course_policy', 'assignment', 'appointment',
  'referral', 'opportunity', 'job', 'internship', 'research_opportunity', 'organization', 'event',
  'service', 'resource', 'study_space', 'library_source', 'calendar_event', 'notification',
  'person_reference', 'lms_context',
  // A study space's free and busy slots — tenant-wide, T0, never who booked.
  'space_availability',
] as const;
export type CanonicalEntity = (typeof CANONICAL_ENTITIES)[number];

export type Freshness = 'live' | 'recent' | 'stale' | 'unavailable' | 'manual' | 'estimated' | 'needs_confirmation';
export const FRESHNESS: readonly Freshness[] = [
  'live', 'recent', 'stale', 'unavailable', 'manual', 'estimated', 'needs_confirmation',
];

export type ConnectionStatus = 'disconnected' | 'configuring' | 'healthy' | 'degraded' | 'paused' | 'error';
export const CONNECTION_STATUSES: readonly ConnectionStatus[] = [
  'disconnected', 'configuring', 'healthy', 'degraded', 'paused', 'error',
];

export type SyncMode = 'webhook' | 'incremental_api' | 'batch' | 'manual' | 'lti_launch';
export type SyncDirection = 'read' | 'approved_write' | 'bidirectional';

export type ConflictKind =
  | 'type_mismatch' | 'enum_mismatch' | 'missing_required' | 'duplicate_external_id'
  | 'timestamp_regression' | 'transform_error' | 'scope_failure' | 'classification_block'
  | 'consent_block' | 'rate_limit' | 'deletion_mismatch';
export const CONFLICT_KINDS: readonly ConflictKind[] = [
  'type_mismatch', 'enum_mismatch', 'missing_required', 'duplicate_external_id',
  'timestamp_regression', 'transform_error', 'scope_failure', 'classification_block',
  'consent_block', 'rate_limit', 'deletion_mismatch',
];

export type ErrorCategory = ConflictKind | 'authentication' | 'provider_unavailable' | 'schema_validation' | 'unknown';

/**
 * Never ingested by default, by any connector. The database refuses a scope
 * key that names one of these; the pipeline refuses a record field that does.
 */
export const NEVER_INGEST = [
  'grades', 'grade', 'gpa', 'gradebook', 'roster', 'submission', 'submissions',
  'accommodation', 'accommodations', 'health', 'counseling', 'conduct',
  'instructor_notes', 'financial_aid', 'aid_award',
] as const;

/**
 * Also refused as a *canonical* field name, so no mapping can store them even
 * under a harmless external name: why a hold or a referral exists, money owed,
 * and an advisor's notes. The
 * database refuses these keys in `canonical_entity_references.display` too.
 */
export const NEVER_DISPLAY = ['reason', 'amount', 'balance', 'notes'] as const;

/** How fresh each kind of fact is expected to be, by the command's sync classes. */
export interface SyncClass {
  id: string;
  label: string;
  preferred: readonly SyncMode[];
  target: string;
  /** Default freshness target in minutes; a tenant may set its own. */
  targetMinutes: number;
  domains: readonly ProviderDomain[];
}

export const SYNC_CLASSES: readonly SyncClass[] = [
  { id: 'identity', label: 'Identity lifecycle', preferred: ['webhook'], target: 'Near real time',
    targetMinutes: 15, domains: ['identity'] },
  { id: 'urgent_status', label: 'Registration holds, appointments, urgent status', preferred: ['webhook', 'incremental_api'],
    target: 'Near real time where supported', targetMinutes: 60, domains: ['advising'] },
  { id: 'academic', label: 'Course schedule, enrollment, catalog, terms', preferred: ['incremental_api'],
    target: 'Hourly to daily, set by the school', targetMinutes: 24 * 60, domains: ['sis', 'catalog'] },
  { id: 'degree_audit', label: 'Degree audit', preferred: ['incremental_api', 'manual'],
    target: 'Daily or on demand', targetMinutes: 24 * 60, domains: ['degree_audit'] },
  { id: 'lms', label: 'LMS assignments, course policy, source metadata', preferred: ['lti_launch', 'webhook', 'incremental_api'],
    target: 'Event-driven or daily', targetMinutes: 24 * 60, domains: ['lms'] },
  { id: 'campus', label: 'Career, events, services, opportunities', preferred: ['incremental_api', 'batch'],
    target: 'Daily', targetMinutes: 24 * 60,
    domains: ['career', 'events', 'organizations', 'library', 'tutoring', 'calendar', 'research',
              'study_abroad', 'alumni', 'transit', 'alerts', 'admissions_crm'] },
  { id: 'financial', label: 'Bursar and aid action items', preferred: ['batch', 'manual'],
    target: 'School-approved cadence; deep link only', targetMinutes: 24 * 60,
    domains: ['erp', 'bursar', 'financial_aid'] },
];

export function syncClassFor(domain: ProviderDomain): SyncClass {
  return SYNC_CLASSES.find((c) => c.domains.includes(domain)) ?? SYNC_CLASSES[SYNC_CLASSES.length - 1];
}

/** The ceiling each domain may be approved up to — below T4 for all. */
export const DOMAIN_CEILING: Record<ProviderDomain, DataClass> = {
  identity: 'T3', sis: 'T3', degree_audit: 'T3', catalog: 'T0', lms: 'T3', advising: 'T3',
  admissions_crm: 'T3', career: 'T1', erp: 'T3', bursar: 'T3', financial_aid: 'T3', library: 'T0',
  tutoring: 'T1', events: 'T0', organizations: 'T0', calendar: 'T1', research: 'T1',
  study_abroad: 'T1', alumni: 'T1', alerts: 'T0', transit: 'T0',
};

/** Who stays the source of truth. Semester is never one of these. */
export const SOURCE_OF_TRUTH: Record<ProviderDomain, string> = {
  identity: 'Identity provider', sis: 'Registrar / SIS', degree_audit: 'Degree audit system',
  catalog: 'Registrar catalog', lms: 'LMS', advising: 'Advising system', admissions_crm: 'Admissions CRM',
  career: 'Career office platform', erp: 'ERP', bursar: 'Bursar', financial_aid: 'Financial aid office',
  library: 'Library', tutoring: 'Tutoring center', events: 'Events calendar', organizations: 'Student organizations office',
  calendar: 'Calendar provider', research: 'Research office', study_abroad: 'Study abroad office',
  alumni: 'Alumni office', alerts: 'Emergency alerts system', transit: 'Transit provider',
};
