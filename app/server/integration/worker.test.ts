/**
 * The worker against an in-memory stand-in for the tables. The stand-in
 * implements the query shapes the worker uses and one constraint that matters
 * — the unique (connection, idempotency key) on webhook events — so a
 * duplicate delivery is refused the way Postgres would refuse it. The SQL
 * suites prove the constraints themselves; this proves the worker's scoping,
 * gating and bookkeeping.
 */
import { describe, expect, it, vi } from 'vitest';
import { MOCK_SIS, SIS_FIXTURES } from '../../src/lib/integration/mock-sis.ts';
import { mockBatch } from '../../src/lib/integration/mock-adapter.ts';
import type { ExternalRecord } from '../../src/lib/integration/pipeline.ts';
import { ProviderHttpError, GuardRefusal, classifyFailure } from '../../src/lib/integration/provider-client.ts';
import { ReauthorizationRequired } from '../../src/lib/integration/oauth.ts';
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
  ({ connectionPublicId: PUB, adapter: MOCK_SIS, trigger: 'scheduled' as const, fetchBatch: batch(records), allowMock: true, classify: classifyFailure, ...extra });

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
  it('refreshes governance clocks after an unchanged record is confirmed in a new batch', async () => {
    const t = world();
    const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    const first = JSON.parse((t.canonical_entity_references[0].display as Record<string, string>)._governance);
    const later = new Date(NOW.getTime() + 60_000);
    const result = await runSync(db, req([SIS_FIXTURES.term], { fetchBatch: batch([SIS_FIXTURES.term], 'evt-2') }), () => later);
    expect(result).toMatchObject({ outcome: 'ran', result: { unchanged: 1, updated: 0 } });
    const refreshed = JSON.parse((t.canonical_entity_references[0].display as Record<string, string>)._governance);
    expect(refreshed.retrievedAt).toBe(later.toISOString());
    expect(Date.parse(refreshed.expiresAt)).toBe(Date.parse(first.expiresAt) + 60_000);
    expect(t.canonical_entity_references).toHaveLength(1);
  });

  it('keeps stored provenance, purpose, freshness duration and retention when an adapter changes', async () => {
    const t = world();
    const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    const row = t.canonical_entity_references[0];
    const first = JSON.parse((row.display as Record<string, string>)._governance);
    const later = new Date(NOW.getTime() + 60_000);
    const adapter = { ...MOCK_SIS, version: '2',
      sourceOfTruth: 'Replacement authority', freshnessTargetMinutes: MOCK_SIS.freshnessTargetMinutes * 2,
      retentionDays: MOCK_SIS.retentionDays * 2,
      entities: MOCK_SIS.entities.map((entity) => entity.externalEntity === 'term'
        ? { ...entity, version: 2, scope: 'scope.sis.catalog_read' } : entity) };
    expect(await runSync(db, req([SIS_FIXTURES.term], { adapter,
      fetchBatch: batch([SIS_FIXTURES.term], 'evt-2') }), () => later))
      .toMatchObject({ result: { status: 'succeeded', unchanged: 1, updated: 0 } });
    const refreshed = JSON.parse((row.display as Record<string, string>)._governance);
    expect(refreshed).toEqual({ ...first, retrievedAt: later.toISOString(),
      expiresAt: new Date(Date.parse(first.expiresAt) + 60_000).toISOString() });
    expect(row.source_of_truth).toBe(MOCK_SIS.sourceOfTruth);
    expect(row.mapping_version).toBe(MOCK_SIS.entities[0].version);
  });

  it('uses connection freshness overrides for imports and later metadata refreshes', async () => {
    const t = world();
    t.integration_connections[0].freshness_target = '01:00:00';
    const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    const first = JSON.parse((t.canonical_entity_references[0].display as Row)._governance as string);
    expect(Date.parse(first.expiresAt) - Date.parse(first.retrievedAt)).toBe(60 * 60_000);
    t.integration_connections[0].freshness_target = '00:30:00';
    const later = new Date(NOW.getTime() + 60_000);
    expect(await runSync(db, req([SIS_FIXTURES.term], { fetchBatch: batch([SIS_FIXTURES.term], 'evt-2') }), () => later))
      .toMatchObject({ result: { status: 'succeeded', unchanged: 1 } });
    const refreshed = JSON.parse((t.canonical_entity_references[0].display as Row)._governance as string);
    expect(refreshed).toEqual({ ...first, retrievedAt: later.toISOString(),
      expiresAt: new Date(later.getTime() + 30 * 60_000).toISOString() });
  });

  it.each([undefined, 'legacy string', '{}', '{"retrievedAt":"bad","expiresAt":"bad"}'])
    ('fully remaps legacy metadata before assigning current provenance: %s', async (legacy) => {
      const t = world(); const db = fakeDb(t);
      await runSync(db, req([SIS_FIXTURES.term]), now);
      t.canonical_entity_references[0].display = { name: 'Old mapped value', ...(legacy === undefined ? {} : { _governance: legacy }) };
      const corrected = { ...SIS_FIXTURES.term, fields: { ...SIS_FIXTURES.term.fields, description: 'Current mapped value' } };
      const adapter = { ...MOCK_SIS, version: '2', sourceOfTruth: 'Current authority',
        entities: MOCK_SIS.entities.map((e) => ({ ...e, version: 2 })) };
      const result = await runSync(db, req([corrected], { adapter, fetchBatch: batch([corrected], 'evt-remap') }), now);
      expect(result).toMatchObject({ result: { status: 'succeeded', updated: 1, unchanged: 0 } });
      expect(t.canonical_entity_references[0]).toMatchObject({ source_of_truth: 'Current authority', mapping_version: 2,
        display: { name: 'Current mapped value' } });
      expect(JSON.parse((t.canonical_entity_references[0].display as Row)._governance as string))
        .toMatchObject({ sourceStandard: `${adapter.id}@2`, sourceOwner: 'Current authority' });
    });

  it('still rejects an older provider timestamp when a legacy row needs remapping', async () => {
    const t = world(); const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    t.canonical_entity_references[0].display = { name: 'Legacy value' };
    const older = { ...SIS_FIXTURES.term, updatedAt: '2025-01-01T00:00:00Z' };
    expect(await runSync(db, req([older], { fetchBatch: batch([older], 'evt-old') }), now))
      .toMatchObject({ result: { status: 'failed', updated: 0, errors: [{ category: 'timestamp_regression' }] } });
    expect(t.canonical_entity_references[0].display).toEqual({ name: 'Legacy value' });
  });

  it.each(['-01:00:00', '00:00:00', '00:00:30.500', '300000 years'])('validates and floors the connection freshness interval %s', async (target) => {
    const t = world(); const db = fakeDb(t);
    t.integration_connections[0].freshness_target = target;
    await runSync(db, req([SIS_FIXTURES.term]), now);
    const minutes = target === '300000 years' ? 525600 : target === '00:00:30.500' ? 1 : MOCK_SIS.freshnessTargetMinutes;
    expect(await runSync(db, req([SIS_FIXTURES.term], { fetchBatch: batch([SIS_FIXTURES.term], 'evt-2') }), now))
      .toMatchObject({ result: { status: 'succeeded', unchanged: 1 } });
    const e = JSON.parse((t.canonical_entity_references[0].display as Row)._governance as string);
    expect(Date.parse(e.expiresAt) - Date.parse(e.retrievedAt)).toBe(minutes * 60_000);
  });

  it('preserves stored values when a corrected payload has the same source timestamp', async () => {
    const t = world();
    const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    const before = { ...(t.canonical_entity_references[0].display as Row) };
    const corrected = { ...SIS_FIXTURES.term, fields: { ...SIS_FIXTURES.term.fields, description: 'Corrected title' } };
    const result = await runSync(db, req([corrected], { fetchBatch: batch([corrected], 'evt-2') }),
      () => new Date(NOW.getTime() + 60_000));
    expect(result).toMatchObject({ result: { unchanged: 1, updated: 0 } });
    const after = t.canonical_entity_references[0].display as Row;
    expect({ ...after, _governance: before._governance }).toEqual(before);
    expect(after._governance).not.toEqual(before._governance);
  });

  it('imports a source record that reappears after reconciliation even with the same timestamp', async () => {
    const t = world();
    const db = fakeDb(t);
    const first = await runSync(db, req([SIS_FIXTURES.term]), now);
    await reconcile(db, { connectionPublicId: PUB, adapter: MOCK_SIS, canonicalEntity: 'term',
      providerIds: [], runId: first.outcome === 'ran' ? first.runId : '' }, now);
    expect(t.canonical_entity_references[0].external_deleted_at).toBe(NOW.toISOString());
    expect(await runSync(db, req([SIS_FIXTURES.term], { fetchBatch: batch([SIS_FIXTURES.term], 'evt-2') }), now))
      .toMatchObject({ result: { status: 'succeeded', unchanged: 0, created: 1 } });
    expect(t.canonical_entity_references[0].external_deleted_at).toBeNull();
    expect(t.canonical_entity_references[0].display).toMatchObject({ name: 'Spring 2027' });
  });

  it.each(['rpc error', 'source race'])('keeps the old cursor on a metadata refresh failure: %s', async (failure) => {
    const t = world();
    const db = fakeDb(t);
    await runSync(db, req([SIS_FIXTURES.term]), now);
    const originalCursor = t.integration_connections[0].cursor_state;
    const stored = { ...t.canonical_entity_references[0] };
    if (failure === 'rpc error') (t as Record<string, unknown>).__fail = ['integration_refresh_governance'];
    else vi.spyOn(db, 'rpc').mockResolvedValueOnce({ data: 0, error: null } as never);
    const fetchBatch = async () => ({ ...mockBatch([SIS_FIXTURES.term], 'evt-2'),
      cursorAfter: { watermark: '2026-09-28T12:00:00Z' } });
    expect(await runSync(db, req([SIS_FIXTURES.term], { fetchBatch }), now))
      .toMatchObject({ result: { status: 'failed', cursorAfter: null, errors: [{ retryable: true }] } });
    expect(t.integration_connections[0].cursor_state).toEqual(originalCursor);
    expect(t.integration_sync_runs.at(-1)?.cursor_after).toBeNull();
    expect(t.canonical_entity_references[0]).toEqual(stored);
    expect(t.integration_webhook_events.some((e) => e.idempotency_key === 'evt-2')).toBe(false);
    (t as Record<string, unknown>).__fail = [];
    vi.restoreAllMocks();
    expect(await runSync(db, req([SIS_FIXTURES.term], { fetchBatch }), now))
      .toMatchObject({ result: { status: 'succeeded', unchanged: 1 } });
    expect(t.integration_connections[0].cursor_state).toEqual({ watermark: '2026-09-28T12:00:00Z' });
  });

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

describe('what a failed pull is recorded as', () => {
  const failWith = (error: unknown, attempt = 1) => {
    const t = world({ status: 'healthy' });
    const fetchBatch = async () => { throw error; };
    return runSync(fakeDb(t), req([], { fetchBatch, attempt }), now).then((report) => ({ t, report }));
  };

  it('dead-letters a dead grant on the first attempt, as authentication, with a code the dashboard can group on', async () => {
    const { t, report } = await failWith(new ReauthorizationRequired('invalid_grant'));
    expect(report).toMatchObject({ outcome: 'provider_failed', next: { kind: 'dead_letter' } });
    expect(t.integration_sync_errors[0]).toMatchObject({ error_category: 'authentication', error_code: 'reauthorization_required', retryable: false });
    expect(t.integration_dead_letter_events).toHaveLength(1);
  });

  it('carries the provider\u2019s Retry-After into the retry time, when it asks for longer than back-off would', async () => {
    const { t, report } = await failWith(new ProviderHttpError(429, 600_000), 1);
    expect(report).toMatchObject({ next: { kind: 'retry', attempt: 2 } });
    const retryAt = (report as { next: { retryAt: Date } }).next.retryAt;
    expect(retryAt.getTime() - now().getTime()).toBeGreaterThanOrEqual(600_000);
    expect(t.integration_sync_errors[0]).toMatchObject({ error_category: 'rate_limit', error_code: 'http_429', retryable: true });
    expect(t.integration_dead_letter_events ?? []).toHaveLength(0);
  });

  it('treats a held call as a retryable wait, and an open breaker as an outage, with the breaker\u2019s wait', async () => {
    const wait = await failWith(new GuardRefusal('rate_limited', now().getTime() + 300_000));
    expect(wait.t.integration_sync_errors[0]).toMatchObject({ error_category: 'rate_limit', error_code: 'rate_limited', retryable: true });
    const open = await failWith(new GuardRefusal('circuit_open', now().getTime() + 300_000));
    expect(open.t.integration_sync_errors[0]).toMatchObject({ error_category: 'provider_unavailable', error_code: 'circuit_open', retryable: true });
    const retryAt = (open.report as { next: { retryAt: Date } }).next.retryAt;
    expect(retryAt.getTime() - now().getTime()).toBeGreaterThanOrEqual(300_000);
  });

  it('still calls an error nothing recognises a provider outage, and scrubs it', async () => {
    const { t } = await failWith(new Error('boom for student 000123456'));
    expect(t.integration_sync_errors[0]).toMatchObject({ error_category: 'provider_unavailable', error_code: 'provider_error', retryable: true });
    expect(t.integration_sync_errors[0].sanitized_message).toBe('boom for student [id]');
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

  it('reconciles hundreds of removals in one database call and retains each envelope', async () => {
    const t = world();
    const db = fakeDb(t);
    const records = Array.from({ length: 300 }, (_, n) => ({ ...SIS_FIXTURES.term, id: `term-${n}` }));
    const run = await runSync(db, req(records), now);
    const rpc = vi.spyOn(db, 'rpc');
    const result = await reconcile(db, { connectionPublicId: PUB, adapter: MOCK_SIS, canonicalEntity: 'term',
      providerIds: [], runId: run.outcome === 'ran' ? run.runId : '' }, now);
    expect(result).toMatchObject({ goneAtSource: records.map((r) => r.id).sort() });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(t.canonical_entity_references.every((r) => Object.keys(r.display as Row).join() === '_governance')).toBe(true);
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
    expect(gone).toMatchObject({ external_deleted_at: NOW.toISOString(), freshness_status: 'unavailable' });
    const retained = gone.display as Record<string, string>;
    expect(Object.keys(retained)).toEqual(['_governance']);
    expect(JSON.parse(retained._governance)).toMatchObject({ aiEligibility: 'denied_by_default', writeAuthority: 'source-system-only' });
    expect(t.integration_sync_runs[0].reconciliation_state).toBe('mismatched');
    expect(t.integration_sync_errors.at(-1)).toMatchObject({ error_category: 'deletion_mismatch', severity: 'warning' });
  });
});
