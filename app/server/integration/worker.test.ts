/**
 * The worker against an in-memory stand-in for the tables. The stand-in
 * implements the query shapes the worker uses and one constraint that matters
 * — the unique (connection, idempotency key) on webhook events — so a
 * duplicate delivery is refused the way Postgres would refuse it. The SQL
 * suites prove the constraints themselves; this proves the worker's scoping,
 * gating and bookkeeping.
 */
import { describe, expect, it } from 'vitest';
import { MOCK_SIS, SIS_FIXTURES } from '../../src/lib/integration/mock-sis.ts';
import { mockBatch } from '../../src/lib/integration/mock-adapter.ts';
import type { ExternalRecord } from '../../src/lib/integration/pipeline.ts';
import { reconcile, reconcilePlan, runSync } from './worker.ts';
import { fakeDb, type Row, type Tables } from './fakedb.ts';


const NOW = new Date('2026-09-27T12:00:00Z');
const now = () => NOW;
const PUB = 'conn_sis0000000000000000a';

function world(over: { status?: string; approved?: boolean; scopes?: Row[]; switches?: Row[]; membership?: string; consent?: boolean;
  flag?: string | null } = {}): Tables {
  return {
    tenant_feature_policy: over.flag === null ? [] : [{ tenant_id: 'vu', capability: 'integration.sis_read', state: over.flag ?? 'production' }],
    integration_connections: [{
      id: 'c1', public_id: PUB, tenant_id: 'vu', provider_domain: 'sis', status: over.status ?? 'configuring',
      approved_at: over.approved === false ? null : '2026-09-20T00:00:00Z', data_classification_ceiling: 'T3',
    }],
    integration_scopes: over.scopes ?? MOCK_SIS.scopes.map((k) => ({ connection_id: 'c1', scope_key: k, approved: true, expires_at: null })),
    feature_kill_switch: over.switches ?? [],
    scim_external_identity: [
      { tenant_id: 'vu', external_id: 'sis-person-77', membership_id: 'm1', active: true },
      { tenant_id: 'other', external_id: 'sis-person-99', membership_id: 'm9', active: true },
    ],
    institution_membership: [
      { tenant_id: 'vu', id: 'm1', auth_user_id: 'u77', status: over.membership ?? 'active' },
      { tenant_id: 'other', id: 'm9', auth_user_id: 'u99', status: 'active' },
    ],
    consent_record: over.consent === false ? [] : [
      { id: 'k1', tenant_id: 'vu', subject_user_id: 'u77', capability: `integration:${PUB}`, status: 'consented', revoked_at: null },
    ],
    canonical_entity_references: [],
  };
}

const batch = (records: ExternalRecord[], key = 'evt-1') => async () => mockBatch(records, key);
const req = (records: ExternalRecord[], extra: Partial<Parameters<typeof runSync>[1]> = {}) =>
  ({ connectionPublicId: PUB, adapter: MOCK_SIS, trigger: 'scheduled' as const, fetchBatch: batch(records), allowMock: true, ...extra });

describe('what the worker refuses to run', () => {
  it('a mock against a real connection, unless told', async () => {
    const r = await runSync(fakeDb(world()), { ...req([SIS_FIXTURES.term]), allowMock: false }, now);
    expect(r).toEqual({ outcome: 'refused', reason: 'a mock adapter cannot run against a real connection' });
  });

  it('an unapproved, paused or disconnected connection', async () => {
    expect((await runSync(fakeDb(world({ approved: false })), req([]), now))).toMatchObject({ reason: 'connection not approved' });
    expect((await runSync(fakeDb(world({ status: 'paused' })), req([]), now))).toMatchObject({ reason: 'connection paused' });
    expect((await runSync(fakeDb(world({ status: 'disconnected' })), req([]), now))).toMatchObject({ reason: 'connection disconnected' });
  });

  it('under a global, school or connection kill switch, but not another school’s', async () => {
    for (const sw of [
      { switch_key: 'kill.integration_sync', tenant_id: null, engaged: true },
      { switch_key: 'kill.integration_sync', tenant_id: 'vu', engaged: true },
      { switch_key: `kill.connection.${PUB}`, tenant_id: 'vu', engaged: true },
    ]) {
      expect(await runSync(fakeDb(world({ switches: [sw] })), req([]), now), sw.switch_key).toMatchObject({ reason: 'kill switch engaged' });
    }
    const other = await runSync(fakeDb(world({ switches: [{ switch_key: 'kill.integration_sync', tenant_id: 'elsewhere', engaged: true }] })),
      req([SIS_FIXTURES.term]), now);
    expect(other.outcome).toBe('ran');
  });

  it('an adapter for a different domain, or one that does not validate', async () => {
    expect(await runSync(fakeDb(world()), req([], { adapter: { ...MOCK_SIS, domain: 'lms' } }), now))
      .toMatchObject({ outcome: 'refused' });
    expect(await runSync(fakeDb(world()), req([], { adapter: { ...MOCK_SIS, credentialsReference: 'plain-secret' } }), now))
      .toMatchObject({ reason: expect.stringContaining('adapter declaration') });
  });
});

describe('a run', () => {
  it('writes references with their display values, and moves the connection to healthy', async () => {
    const t = world();
    const r = await runSync(fakeDb(t), req([SIS_FIXTURES.term, SIS_FIXTURES.enrollment, SIS_FIXTURES.hold]), now);
    expect(r).toMatchObject({ outcome: 'ran', result: { status: 'succeeded', created: 3 } });
    const refs = t.canonical_entity_references;
    expect(refs.map((x) => [x.canonical_entity_type, x.subject_user_id, x.tenant_id])).toEqual([
      ['term', null, 'vu'], ['enrollment', 'u77', 'vu'], ['registration_hold', 'u77', 'vu'],
    ]);
    expect(refs[2].display).toMatchObject({ office: 'Student Accounts', blocks_registration: true, action_url: 'https://accounts.example.edu/holds' });
    const display = refs[2].display as Record<string, unknown>;
    expect(Object.values(display).every((v) => v === null || typeof v !== 'object')).toBe(true);
    expect(JSON.parse(display._governance as string)).toMatchObject({ aiEligibility: 'denied_by_default',
      writeAuthority: 'source-system-only', sourceOwner: MOCK_SIS.sourceOfTruth,
      permittedPurposes: ['scope.sis.registration_hold_summary_read'], retrievedAt: NOW.toISOString(), consentPurpose: `integration:${PUB}` });
    expect(t.integration_sync_runs[0]).toMatchObject({ status: 'succeeded', records_received: 3, records_created: 3 });
    expect(t.integration_connections[0]).toMatchObject({ status: 'healthy', last_successful_sync_at: NOW.toISOString(),
      cursor_state: { watermark: '2026-09-27T12:00:00Z' } });
    expect(t.integration_webhook_events[0]).toMatchObject({ processing_status: 'processed', idempotency_key: 'evt-1' });
  });

  it('ingests a redelivered batch once', async () => {
    const t = world();
    const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    const again = await runSync(db, req([SIS_FIXTURES.term]), now);
    expect(again).toMatchObject({ outcome: 'ran', result: { status: 'duplicate', created: 0 } });
    expect(t.canonical_entity_references).toHaveLength(1);
    expect(t.integration_webhook_events).toHaveLength(1);
  });

  it('stops importing a student the school has deprovisioned, and records why without naming them', async () => {
    const t = world({ membership: 'deprovisioned' });
    const r = await runSync(fakeDb(t), req([SIS_FIXTURES.term, SIS_FIXTURES.enrollment]), now);
    expect(r).toMatchObject({ result: { status: 'partial', created: 1, rejected: 1 } });
    expect(t.integration_sync_errors[0]).toMatchObject({ error_category: 'scope_failure', tenant_id: 'vu' });
    expect(String(t.integration_sync_errors[0].external_record_reference_redacted)).toMatch(/^sha256:/);
    expect(JSON.stringify(t.integration_sync_errors)).not.toContain('enr-77');
    expect(t.integration_connections[0].status).toBe('degraded');
  });

  it('never resolves a person through another school’s identity or consent', async () => {
    const t = world();
    t.consent_record.push({ id: 'k9', tenant_id: 'other', subject_user_id: 'u99', capability: `integration:${PUB}`,
      status: 'consented', revoked_at: null });
    const r = await runSync(fakeDb(t), req([{ ...SIS_FIXTURES.enrollment, id: 'x', subject: 'sis-person-99' }]), now);
    expect(r).toMatchObject({ result: { status: 'failed', created: 0 } });
    expect(t.canonical_entity_references).toHaveLength(0);
  });

  it('honours a revoked consent and an expired scope', async () => {
    const t = world({ consent: false });
    const r = await runSync(fakeDb(t), req([SIS_FIXTURES.enrollment]), now);
    expect(r).toMatchObject({ result: { errors: [{ category: 'consent_block' }] } });
    const expired = world({ scopes: MOCK_SIS.scopes.map((k) => ({ connection_id: 'c1', scope_key: k, approved: true,
      expires_at: k.endsWith('term_read') ? '2026-09-01T00:00:00Z' : null })) });
    const e = await runSync(fakeDb(expired), req([SIS_FIXTURES.term]), now);
    expect(e).toMatchObject({ result: { errors: [{ category: 'scope_failure' }] } });
  });

  it('records a provider failure, retries, and dead-letters after the last attempt', async () => {
    const t = world({ status: 'healthy' });
    const down = async () => { throw new Error('503 from https://sis.example.edu?access_token=abc for student 000123456'); };
    const first = await runSync(fakeDb(t), req([], { fetchBatch: down, attempt: 1 }), now);
    expect(first).toMatchObject({ outcome: 'provider_failed', next: { kind: 'retry', attempt: 2 } });
    expect(t.integration_sync_errors[0].sanitized_message).toBe('503 from https://sis.example.edu?access_token=[redacted] for student [id]');
    expect(t.integration_connections[0].status).toBe('error');
    const last = await runSync(fakeDb(t), req([], { fetchBatch: down, attempt: 5 }), now);
    expect(last).toMatchObject({ next: { kind: 'dead_letter' } });
    expect(t.integration_dead_letter_events).toHaveLength(1);
  });
});

describe('found by the Codex review of #779', () => {
  it('refuses a connector whose school flag is absent, off or only in preview', async () => {
    for (const flag of [null, 'off', 'preview']) {
      const r = await runSync(fakeDb(world({ flag })), req([SIS_FIXTURES.term]), now);
      expect(r, String(flag)).toEqual({ outcome: 'refused', reason: 'integration.sis_read is not on for this school' });
    }
    expect((await runSync(fakeDb(world({ flag: 'production' })), req([SIS_FIXTURES.term]), now)).outcome).toBe('ran');
  });

  it('keeps a batch that failed to save retryable, so its redelivery is ingested rather than skipped', async () => {
    const t = world();
    (t as Record<string, unknown>).__fail = ['canonical_entity_references'];
    const first = await runSync(fakeDb(t), req([SIS_FIXTURES.term]), now);
    expect(first).toMatchObject({ outcome: 'ran', result: { status: 'failed' } });
    (t as Record<string, unknown>).__fail = [];
    const again = await runSync(fakeDb(t), req([SIS_FIXTURES.term]), now);
    expect(again).toMatchObject({ outcome: 'ran', result: { status: 'succeeded', created: 1 } });
    expect(t.canonical_entity_references).toHaveLength(1);
  });

  it('remembers a batch refused for good, so its redelivery is a duplicate rather than a fresh failure', async () => {
    // Found by the Codex review of #808: releasing the claim on every failed
    // run meant a batch that can never succeed was re-ingested and re-logged
    // on every redelivery, for ever.
    const t = world({ consent: false });
    const first = await runSync(fakeDb(t), req([SIS_FIXTURES.enrollment]), now);
    expect(first).toMatchObject({ outcome: 'ran', result: { status: 'failed', errors: [{ category: 'consent_block', retryable: false }] } });
    expect(t.integration_webhook_events[0]).toMatchObject({ processing_status: 'rejected', processed_at: NOW.toISOString() });
    const again = await runSync(fakeDb(t), req([SIS_FIXTURES.enrollment]), now);
    expect(again).toMatchObject({ outcome: 'ran', result: { status: 'duplicate' } });
    expect(t.integration_sync_errors).toHaveLength(1);
  });

  it('keeps two connections’ records apart when their ids coincide', async () => {
    const t = world();
    t.integration_connections.push({ ...t.integration_connections[0], id: 'c2', public_id: 'conn_sis0000000000000000b' });
    t.integration_scopes.push(...MOCK_SIS.scopes.map((k) => ({ connection_id: 'c2', scope_key: k, approved: true, expires_at: null })));
    const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    await runSync(db, { ...req([SIS_FIXTURES.term]), connectionPublicId: 'conn_sis0000000000000000b' }, now);
    expect(t.canonical_entity_references.map((r) => r.connection_id).sort()).toEqual(['c1', 'c2']);
  });
});

describe('reconciliation', () => {
  it('plans in both directions', () => {
    expect(reconcilePlan(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({ stillThere: ['b', 'c'], goneAtSource: ['a'], unknownHere: ['d'] });
  });

  it('marks what the source deleted, clears its values, and says so on the run', async () => {
    const t = world();
    const db = fakeDb(t);
    const r = await runSync(db, req([SIS_FIXTURES.enrollment, { ...SIS_FIXTURES.enrollment, id: 'enr-2' }]), now);
    const runId = r.outcome === 'ran' ? r.runId : '';
    const plan = await reconcile(db, { connectionPublicId: PUB, adapter: MOCK_SIS, canonicalEntity: 'enrollment',
      providerIds: ['enr-2', 'enr-3'], runId }, now);
    expect(plan).toEqual({ stillThere: ['enr-2'], goneAtSource: ['enr-77-ECON1010'], unknownHere: ['enr-3'] });
    const gone = t.canonical_entity_references.find((x) => x.source_record_id === 'enr-77-ECON1010')!;
    expect(gone).toMatchObject({ external_deleted_at: NOW.toISOString(), display: {}, freshness_status: 'unavailable' });
    expect(t.integration_sync_runs[0].reconciliation_state).toBe('mismatched');
    expect(t.integration_sync_errors.at(-1)).toMatchObject({ error_category: 'deletion_mismatch', severity: 'warning' });
  });
});
