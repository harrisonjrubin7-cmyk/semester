/**
 * Mock SIS and degree-audit providers, for the Phase 5 contract tests and the
 * sandbox. `mock: true`; not Banner, not PeopleSoft, not uAchieve, and never to
 * be registered or described as any of them.
 *
 * They exist to pin the *shape* a real read-only academic adapter must have:
 *
 *   term · program · catalog entry · section          tenant-wide, T0
 *   registration window                                tenant-wide, T0
 *   enrollment                                          the student's, T3
 *   registration hold — a summary, never the reason     the student's, T3
 *   requirement status (degree audit)                   the student's, T3
 *
 * No grades, GPA, rosters, financial detail or hold reasons. A provider field
 * that is not in a mapping is dropped by the pipeline, so "the SIS sent it" is
 * never a reason it was stored.
 */
import type { AdapterDeclaration } from './adapter.ts';
import type { ExternalRecord } from './pipeline.ts';

const COMMON = {
  version: '1',
  authentication: 'oauth2' as const,
  direction: 'read' as const,
  cursor: 'watermark' as const,
  rateLimitPerMinute: 60,
  retry: { maxAttempts: 5, baseMs: 2_000, maxMs: 900_000 },
  deadLetter: 'table' as const,
  consentRequired: true,
  retentionDays: 400,
  degradedStates: ['provider_unavailable', 'rate_limited', 'stale'],
  disconnect: 'revoke_token' as const,
  auditEvents: ['connection.approved', 'scope.approved', 'sync.paused', 'sync.resumed', 'replay.requested'],
  killSwitch: 'kill.integration_sync',
  contractTests: ['app/src/lib/integration/mock-sis.test.ts'],
  mock: true,
};

export const MOCK_SIS: AdapterDeclaration = {
  ...COMMON,
  id: 'mock_sis',
  domain: 'sis',
  provider: 'Mock SIS',
  product: 'Fixture 1.0',
  credentialsReference: 'vault:sandbox/mock-sis',
  classificationCeiling: 'T3',
  modes: ['incremental_api', 'batch'],
  freshnessTargetMinutes: 24 * 60,
  sourceOfTruth: 'Registrar / SIS',
  featureFlag: 'integration.sis_read',
  scopes: [
    'scope.sis.term_read', 'scope.sis.program_read', 'scope.sis.catalog_read', 'scope.sis.section_read',
    'scope.sis.registration_window_read', 'scope.sis.enrollment_read', 'scope.sis.registration_hold_summary_read',
  ],
  entities: [
    {
      externalEntity: 'term', canonicalEntity: 'term', version: 1, scope: 'scope.sis.term_read',
      classification: 'T0', personal: false,
      fields: [
        { external: 'code', canonical: 'code', type: 'string', required: true, transform: 'trim' },
        { external: 'description', canonical: 'name', type: 'string', required: true, transform: 'trim' },
        { external: 'start_date', canonical: 'starts_on', type: 'datetime', required: true, transform: 'iso_datetime' },
        { external: 'end_date', canonical: 'ends_on', type: 'datetime', required: true, transform: 'iso_datetime' },
      ],
    },
    {
      externalEntity: 'program', canonicalEntity: 'program', version: 1, scope: 'scope.sis.program_read',
      classification: 'T0', personal: false,
      fields: [
        { external: 'code', canonical: 'code', type: 'string', required: true, transform: 'trim' },
        { external: 'title', canonical: 'name', type: 'string', required: true, transform: 'trim' },
        { external: 'level', canonical: 'level', type: 'enum', required: true, enumValues: ['UG', 'GR', 'PR'] },
      ],
    },
    {
      externalEntity: 'catalog_course', canonicalEntity: 'course_catalog_entry', version: 1, scope: 'scope.sis.catalog_read',
      classification: 'T0', personal: false,
      fields: [
        { external: 'subject', canonical: 'subject', type: 'string', required: true, transform: 'trim' },
        { external: 'number', canonical: 'number', type: 'string', required: true, transform: 'trim' },
        { external: 'title', canonical: 'title', type: 'string', required: true, transform: 'trim' },
        { external: 'credits', canonical: 'credits', type: 'number', required: false },
      ],
    },
    {
      externalEntity: 'section', canonicalEntity: 'course_section', version: 1, scope: 'scope.sis.section_read',
      classification: 'T0', personal: false,
      fields: [
        { external: 'term', canonical: 'term', type: 'string', required: true },
        { external: 'course', canonical: 'course', type: 'string', required: true, transform: 'trim' },
        { external: 'section', canonical: 'section', type: 'string', required: true, transform: 'trim' },
        { external: 'meeting', canonical: 'meeting', type: 'string', required: false, transform: 'trim' },
      ],
    },
    {
      externalEntity: 'registration_window', canonicalEntity: 'registration_window', version: 1,
      scope: 'scope.sis.registration_window_read', classification: 'T0', personal: false,
      fields: [
        { external: 'term', canonical: 'term', type: 'string', required: true },
        { external: 'audience', canonical: 'audience', type: 'string', required: true, transform: 'trim' },
        { external: 'opens', canonical: 'opens_at', type: 'datetime', required: true, transform: 'iso_datetime' },
        { external: 'closes', canonical: 'closes_at', type: 'datetime', required: true, transform: 'iso_datetime' },
        { external: 'url', canonical: 'source_url', type: 'url', required: false },
      ],
    },
    {
      externalEntity: 'enrollment', canonicalEntity: 'enrollment', version: 1, scope: 'scope.sis.enrollment_read',
      classification: 'T3', personal: true,
      fields: [
        { external: 'term', canonical: 'term', type: 'string', required: true },
        { external: 'course', canonical: 'course', type: 'string', required: true, transform: 'trim' },
        { external: 'section', canonical: 'section', type: 'string', required: true, transform: 'trim' },
        { external: 'status', canonical: 'status', type: 'enum', required: true, enumValues: ['enrolled', 'waitlisted', 'dropped'] },
      ],
    },
    {
      // Whether there is something to do, where, and whether it blocks
      // registration. The hold's reason never leaves the SIS: it can be a
      // debt, a conduct matter or a health form, and "action required" is
      // enough for a student who can follow the office's link.
      externalEntity: 'hold', canonicalEntity: 'registration_hold', version: 1,
      scope: 'scope.sis.registration_hold_summary_read', classification: 'T3', personal: true,
      fields: [
        { external: 'office', canonical: 'office', type: 'string', required: true, transform: 'trim' },
        { external: 'blocks_registration', canonical: 'blocks_registration', type: 'boolean', required: true },
        { external: 'action_url', canonical: 'action_url', type: 'url', required: true },
      ],
    },
  ],
};

export const MOCK_DEGREE_AUDIT: AdapterDeclaration = {
  ...COMMON,
  id: 'mock_degree_audit',
  domain: 'degree_audit',
  provider: 'Mock Degree Audit',
  product: 'Fixture 1.0',
  credentialsReference: 'vault:sandbox/mock-degree-audit',
  classificationCeiling: 'T3',
  modes: ['incremental_api', 'manual'],
  freshnessTargetMinutes: 24 * 60,
  sourceOfTruth: 'Degree audit system',
  featureFlag: 'integration.degree_audit_read',
  scopes: ['scope.degree_audit.requirement_status_read'],
  entities: [
    {
      externalEntity: 'requirement', canonicalEntity: 'academic_requirement', version: 1,
      scope: 'scope.degree_audit.requirement_status_read', classification: 'T3', personal: true,
      fields: [
        { external: 'label', canonical: 'name', type: 'string', required: true, transform: 'trim' },
        { external: 'status', canonical: 'status', type: 'enum', required: true, enumValues: ['met', 'in_progress', 'not_met'] },
        { external: 'audit_run', canonical: 'audit_run_at', type: 'datetime', required: true, transform: 'iso_datetime' },
        { external: 'report_url', canonical: 'source_url', type: 'url', required: false },
      ],
    },
  ],
};

export const SIS_FIXTURES: Record<string, ExternalRecord> = {
  term: { entityType: 'term', id: '202710', updatedAt: '2026-09-27T06:00:00Z',
    fields: { code: '202710', description: 'Spring 2027', start_date: '2027-01-11', end_date: '2027-05-07' } },
  window: { entityType: 'registration_window', id: 'rw-202710-jr', updatedAt: '2026-09-27T06:00:00Z',
    fields: { term: '202710', audience: 'Juniors', opens: '2026-11-02T13:00:00Z', closes: '2026-11-20T23:00:00Z',
              url: 'https://registrar.example.edu/registration' } },
  section: { entityType: 'section', id: 'ECON-1010-01-202710', updatedAt: '2026-09-27T06:00:00Z',
    fields: { term: '202710', course: 'ECON 1010', section: '01', meeting: 'MWF 10:10' } },
  enrollment: { entityType: 'enrollment', id: 'enr-77-ECON1010', subject: 'sis-person-77', updatedAt: '2026-09-27T06:00:00Z',
    fields: { term: '202710', course: 'ECON 1010', section: '01', status: 'enrolled' } },
  hold: { entityType: 'hold', id: 'hold-77-1', subject: 'sis-person-77', updatedAt: '2026-09-27T06:00:00Z',
    // `reason` and `amount` are what a real SIS would send, and are not in
    // the mapping: the contract test proves they are not kept.
    fields: { office: 'Student Accounts', blocks_registration: true,
              action_url: 'https://accounts.example.edu/holds', reason: 'Balance past due', amount: 1250 } },
  requirement: { entityType: 'requirement', id: 'req-77-core-writing', subject: 'sis-person-77', updatedAt: '2026-09-27T06:00:00Z',
    fields: { label: 'Core: writing', status: 'in_progress', audit_run: '2026-09-27T05:30:00Z',
              report_url: 'https://audit.example.edu/report' } },
};
