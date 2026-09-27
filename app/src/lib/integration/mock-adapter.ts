/**
 * A mock LMS provider, for contract tests and for the dashboard's sandbox
 * view. `mock: true` is part of the declaration and the registry refuses to
 * treat a mock as live — this file is not a Canvas connector and must never
 * be described as one.
 */
import type { AdapterDeclaration } from './adapter.ts';
import type { ExternalRecord, IngestStore, ProviderBatch } from './pipeline.ts';

export const MOCK_LMS: AdapterDeclaration = {
  id: 'mock_lms',
  domain: 'lms',
  provider: 'Mock LMS',
  product: 'Fixture 1.0',
  version: '1',
  authentication: 'lti_1_3',
  credentialsReference: 'vault:sandbox/mock-lms',
  scopes: ['scope.lms.course_context_read', 'scope.lms.assignment_dates_read', 'scope.lms.course_policy_read'],
  classificationCeiling: 'T1',
  direction: 'read',
  modes: ['lti_launch', 'webhook', 'incremental_api'],
  cursor: 'watermark',
  freshnessTargetMinutes: 24 * 60,
  rateLimitPerMinute: 120,
  retry: { maxAttempts: 5, baseMs: 2_000, maxMs: 900_000 },
  deadLetter: 'table',
  sourceOfTruth: 'LMS',
  consentRequired: true,
  retentionDays: 400,
  degradedStates: ['provider_unavailable', 'rate_limited', 'stale'],
  disconnect: 'revoke_token',
  auditEvents: ['connection.approved', 'scope.approved', 'sync.paused', 'sync.resumed', 'replay.requested'],
  featureFlag: 'integration.lms_lti',
  killSwitch: 'kill.integration_sync',
  contractTests: ['app/src/lib/integration/pipeline.test.ts'],
  mock: true,
  entities: [
    {
      externalEntity: 'course', canonicalEntity: 'lms_context', version: 1,
      scope: 'scope.lms.course_context_read', classification: 'T0', personal: false,
      fields: [
        { external: 'id', canonical: 'external_id', type: 'string', required: true },
        { external: 'name', canonical: 'title', type: 'string', required: true, transform: 'trim' },
        { external: 'course_code', canonical: 'code', type: 'string', required: false, transform: 'trim' },
      ],
    },
    {
      // An assignment is about a course, not a person: its due date is the
      // same for every enrolled student, so it is tenant-wide T1.
      externalEntity: 'assignment', canonicalEntity: 'assignment', version: 1,
      scope: 'scope.lms.assignment_dates_read', classification: 'T1', personal: false,
      fields: [
        { external: 'name', canonical: 'title', type: 'string', required: true, transform: 'trim' },
        { external: 'due_at', canonical: 'due_at', type: 'datetime', required: true, transform: 'iso_datetime' },
        { external: 'workflow_state', canonical: 'state', type: 'enum', required: true,
          enumValues: ['published', 'unpublished', 'deleted'] },
        { external: 'html_url', canonical: 'source_url', type: 'url', required: false },
      ],
    },
    {
      externalEntity: 'course_policy', canonicalEntity: 'course_policy', version: 1,
      scope: 'scope.lms.course_policy_read', classification: 'T1', personal: false,
      fields: [
        { external: 'ai_use', canonical: 'ai_use', type: 'enum', required: true,
          enumValues: ['prohibited', 'with_disclosure', 'permitted'] },
        { external: 'policy_url', canonical: 'source_url', type: 'url', required: false },
      ],
    },
  ],
};

export function mockBatch(records: ExternalRecord[], key = 'evt-mock-0001', cursorAfter = { watermark: '2026-09-27T12:00:00Z' }): ProviderBatch {
  return {
    idempotencyKey: key,
    eventType: 'assignment.updated',
    eventVersion: '1',
    trigger: 'webhook',
    cursorBefore: { watermark: '2026-09-26T12:00:00Z' },
    cursorAfter,
    records,
  };
}

export const MOCK_ASSIGNMENT: ExternalRecord = {
  entityType: 'assignment',
  id: '9001',
  updatedAt: '2026-09-27T11:00:00Z',
  fields: {
    name: '  Problem set 3 ',
    due_at: '2026-10-03T23:59:00-05:00',
    workflow_state: 'published',
    html_url: 'https://lms.example.edu/courses/1/assignments/9001',
  },
};

/** An in-memory store for tests and the sandbox view. */
export function memoryStore(opts: {
  subjects?: Record<string, string>;
  consents?: string[];
  timestamps?: Record<string, string>;
} = {}): IngestStore & { keys: Set<string> } {
  const keys = new Set<string>();
  return {
    keys,
    async claimIdempotencyKey(connection, key) {
      const k = `${connection}:${key}`;
      if (keys.has(k)) return false;
      keys.add(k);
      return true;
    },
    async lastSourceTimestamp(_c, entity, id) {
      return opts.timestamps?.[`${entity}:${id}`] ?? null;
    },
    async resolveSubject(_t, subject) {
      return opts.subjects?.[subject] ?? null;
    },
    async hasConsent(_t, userId, purpose) {
      return (opts.consents ?? []).includes(`${userId}:${purpose}`);
    },
  };
}
