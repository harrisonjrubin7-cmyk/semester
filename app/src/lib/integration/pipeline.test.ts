/**
 * The adapter contract test, run against the mock LMS provider. A real
 * adapter joins this file with its own fixtures before it may be registered.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDeclaration, type AdapterDeclaration } from './adapter';
import { CANONICAL_ENTITIES, CONFLICT_KINDS, PROVIDER_DOMAINS } from './catalog';
import { MOCK_ASSIGNMENT, MOCK_LMS, memoryStore, mockBatch } from './mock-adapter';
import { ingest, type ConnectionState, type ExternalRecord } from './pipeline';
import { redactReference, sanitizeMessage } from './redact';
import { RateLimiter, afterFailure, backoffMs } from './retry';
import { freshnessFromAge, freshnessSentence, isOfficialCurrent } from './freshness';

// A token-shaped string built at runtime, so no key-shaped literal is committed
// for secret scanners to (rightly) refuse.
const FAKE_KEY = ['sk', 'live', 'x'.repeat(24)].join('_');

const NOW = new Date('2026-09-27T12:00:00Z');
const CONN: ConnectionState = {
  tenantId: 'vu',
  publicId: 'conn_0123456789abcdef0123',
  status: 'healthy',
  approved: true,
  approvedScopes: ['scope.lms.course_context_read', 'scope.lms.assignment_dates_read', 'scope.lms.course_policy_read'],
  classificationCeiling: 'T1',
};

function run(records: ExternalRecord[], over: Partial<Parameters<typeof ingest>[0]> = {}) {
  return ingest({ adapter: MOCK_LMS, connection: CONN, batch: mockBatch(records), store: memoryStore(),
    killSwitchEngaged: false, now: NOW, ...over });
}

// Every migration, not only the control plane's: an applied migration is never
// edited, so a vocabulary word added later (20260928041700 adds
// 'space_availability') lives in the migration that added it.
const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations');
const SQL = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(resolve(MIGRATIONS, f), 'utf8')).join('\n');

describe('the vocabulary matches the database', () => {
  it('names every provider domain, canonical entity and conflict kind the SQL does', () => {
    for (const d of PROVIDER_DOMAINS) expect(SQL, d).toContain(`'${d}'`);
    for (const e of CANONICAL_ENTITIES) expect(SQL, e).toContain(`'${e}'`);
    for (const k of CONFLICT_KINDS) expect(SQL, k).toContain(`'${k}'`);
  });
});

describe('adapter declarations', () => {
  it('accepts the mock', () => {
    expect(validateDeclaration(MOCK_LMS)).toEqual([]);
  });

  it('refuses a raw secret where a reference belongs', () => {
    const bad: AdapterDeclaration = { ...MOCK_LMS, credentialsReference: FAKE_KEY };
    expect(validateDeclaration(bad).join()).toMatch(/secret-manager pointer/);
  });

  it('refuses a scope or a field on the never-ingest list', () => {
    const scoped = { ...MOCK_LMS, scopes: [...MOCK_LMS.scopes, 'scope.lms.grades_read'] };
    expect(validateDeclaration(scoped).join()).toMatch(/never ingested/);
    const fielded: AdapterDeclaration = { ...MOCK_LMS, entities: [{ ...MOCK_LMS.entities[1],
      fields: [...MOCK_LMS.entities[1].fields, { external: 'submission', canonical: 'x', type: 'string', required: false }] }] };
    expect(validateDeclaration(fielded).join()).toMatch(/never ingested/);
  });

  it('refuses a write direction outside a writeback flag, and a ceiling above the domain', () => {
    expect(validateDeclaration({ ...MOCK_LMS, direction: 'approved_write' }).join()).toMatch(/writeback/);
    expect(validateDeclaration({ ...MOCK_LMS, domain: 'events', classificationCeiling: 'T1' }).join()).toMatch(/above what events/);
  });
});

describe('ingest', () => {
  it('refuses an excessive effective freshness override before claiming the event', async () => {
    const store = memoryStore();
    const oversized = await run([MOCK_ASSIGNMENT], { store, connection: { ...CONN, freshnessTargetMinutes: 525601 } });
    expect(oversized).toMatchObject({ status: 'refused', errors: [{ category: 'schema_validation' }] });
    expect(await run([MOCK_ASSIGNMENT], { store })).toMatchObject({ status: 'succeeded', created: 1 });
  });

  it('maps an assignment, transforms it, and records its provenance', async () => {
    const r = await run([MOCK_ASSIGNMENT]);
    expect(r).toMatchObject({ status: 'succeeded', received: 1, created: 1, rejected: 0 });
    const ref = r.references[0];
    expect(ref).toMatchObject({
      canonicalEntity: 'assignment', sourceRecordId: '9001', sourceOfTruth: 'LMS',
      classification: 'T1', mappingVersion: 1, subjectUserId: null, freshness: 'live',
    });
    expect(ref.values).toEqual({
      title: 'Problem set 3', due_at: '2026-10-04T04:59:00.000Z', state: 'published',
      source_url: 'https://lms.example.edu/courses/1/assignments/9001',
    });
    expect(r.cursorAfter).toEqual({ watermark: '2026-09-27T12:00:00Z' });
  });

  it('counts a webhook delivered twice once', async () => {
    const store = memoryStore();
    const first = await run([MOCK_ASSIGNMENT], { store });
    const second = await run([MOCK_ASSIGNMENT], { store });
    expect(first.created).toBe(1);
    expect(second).toMatchObject({ status: 'duplicate', created: 0, unchanged: 1 });
  });

  it('refuses everything under a kill switch, while paused, or unapproved', async () => {
    expect((await run([MOCK_ASSIGNMENT], { killSwitchEngaged: true })).status).toBe('refused');
    expect((await run([MOCK_ASSIGNMENT], { connection: { ...CONN, status: 'paused' } })).status).toBe('refused');
    expect((await run([MOCK_ASSIGNMENT], { connection: { ...CONN, approved: false } })).status).toBe('refused');
  });

  it('names each schema conflict the dashboard shows', async () => {
    const r = await run([
      { ...MOCK_ASSIGNMENT, id: '1', fields: { ...MOCK_ASSIGNMENT.fields, due_at: 42 } },
      { ...MOCK_ASSIGNMENT, id: '2', fields: { ...MOCK_ASSIGNMENT.fields, workflow_state: 'archived' } },
      { ...MOCK_ASSIGNMENT, id: '3', fields: { name: 'x', workflow_state: 'published' } },
      { ...MOCK_ASSIGNMENT, id: '4' },
      { ...MOCK_ASSIGNMENT, id: '4' },
      { ...MOCK_ASSIGNMENT, id: '5', fields: { ...MOCK_ASSIGNMENT.fields, grade: 'A' } },
      { entityType: 'gradebook_entry', id: '6', fields: {} },
    ]);
    expect(r.errors.map((e) => e.category)).toEqual([
      'type_mismatch', 'enum_mismatch', 'missing_required', 'duplicate_external_id',
      'classification_block', 'schema_validation',
    ]);
    expect(r).toMatchObject({ status: 'partial', created: 1, rejected: 6 });
  });

  it('refuses an entity whose scope is not approved', async () => {
    const r = await run([MOCK_ASSIGNMENT], { connection: { ...CONN, approvedScopes: ['scope.lms.course_context_read'] } });
    expect(r.errors[0].category).toBe('scope_failure');
    expect(r.status).toBe('failed');
    expect(r.cursorAfter).toBeNull();
  });

  it('refuses an older version than the one stored, and refreshes metadata for the same one', async () => {
    const older = await run([MOCK_ASSIGNMENT], { store: memoryStore({ timestamps: { 'assignment:9001': '2026-09-27T11:30:00Z' } }) });
    expect(older.errors[0].category).toBe('timestamp_regression');
    const same = await run([MOCK_ASSIGNMENT], { store: memoryStore({ timestamps: { 'assignment:9001': '2026-09-27T11:00:00Z' } }) });
    expect(same).toMatchObject({ unchanged: 1, created: 0, updated: 0 });
    expect(same.references).toHaveLength(1);
    expect(same.references[0]).toMatchObject({ metadataOnly: true, values: {} });
    expect(same.references[0].governance.retrievedAt).toBe(NOW.toISOString());
  });

  it('carries a provider deletion as a deletion, not as data', async () => {
    const r = await run([{ ...MOCK_ASSIGNMENT, deleted: true, updatedAt: '2026-09-27T11:45:00Z' }],
      { store: memoryStore({ timestamps: { 'assignment:9001': '2026-09-27T11:00:00Z' } }) });
    expect(r.references[0]).toMatchObject({ externalDeletedAt: NOW.toISOString(), values: {} });
    expect(r.updated).toBe(1);
  });

  it('needs a resolvable subject and live consent for a personal record', async () => {
    const personal: AdapterDeclaration = { ...MOCK_LMS, entities: [{ ...MOCK_LMS.entities[1], personal: true }] };
    const rec = { ...MOCK_ASSIGNMENT, subject: 'lms-user-77' };
    const noConsent = await run([rec], { adapter: personal, store: memoryStore({ subjects: { 'lms-user-77': 'u1' } }) });
    expect(noConsent.errors[0].category).toBe('consent_block');
    const unknown = await run([rec], { adapter: personal, store: memoryStore() });
    expect(unknown.errors[0].category).toBe('scope_failure');
    const ok = await run([rec], { adapter: personal, store: memoryStore({
      subjects: { 'lms-user-77': 'u1' }, consents: [`u1:integration:${CONN.publicId}`] }) });
    expect(ok.references[0].subjectUserId).toBe('u1');
  });

  it('never puts the external id, a token or an email in an error', async () => {
    const r = await run([{ ...MOCK_ASSIGNMENT, id: '000123456', fields: { ...MOCK_ASSIGNMENT.fields, due_at: false } }]);
    const text = JSON.stringify(r.errors);
    expect(text).not.toContain('000123456');
    expect(r.errors[0].reference).toMatch(/^sha256:[0-9a-f]{32}$/);
  });
});

describe('sanitizing', () => {
  it('strips tokens, keys, emails and long ids, and caps the length', () => {
    const s = sanitizeMessage(`401 for Bearer abc.def.ghi student 000123456 jo@vu.edu access_token=xyz ${FAKE_KEY}`);
    expect(s).toBe('401 for Bearer [redacted] student [id] [email] access_token=[redacted] [key]');
    expect(sanitizeMessage('x'.repeat(900)).length).toBe(500);
    expect(sanitizeMessage(null)).toBe('Unknown error');
  });

  it('salts a reference by school', async () => {
    expect(await redactReference('a', '1')).not.toBe(await redactReference('b', '1'));
    expect(await redactReference('a', null)).toBe('redacted');
  });
});

describe('retry, back-off, dead letters, rate limits', () => {
  it('backs off exponentially within a cap', () => {
    const top = () => 0.999999;
    expect(backoffMs(1, undefined, top)).toBe(1999);
    expect(backoffMs(3, undefined, top)).toBe(7999);
    expect(backoffMs(30, undefined, top)).toBe(899_999);
  });

  it('dead-letters permanent errors at once and transient ones after the last attempt', () => {
    expect(afterFailure('type_mismatch', 1, NOW)).toMatchObject({ kind: 'dead_letter' });
    expect(afterFailure('provider_unavailable', 2, NOW, undefined, () => 0)).toMatchObject({ kind: 'retry', attempt: 3 });
    expect(afterFailure('provider_unavailable', 5, NOW)).toMatchObject({ kind: 'dead_letter' });
  });

  it('respects a provider Retry-After longer than the schedule', () => {
    const step = afterFailure('rate_limit', 1, NOW, undefined, () => 0, 60_000);
    expect(step.kind === 'retry' && step.retryAt.getTime() - NOW.getTime()).toBe(60_000);
  });

  it('limits per school and connection independently', () => {
    const rl = new RateLimiter(2);
    expect([rl.take('a', 'c', 0), rl.take('a', 'c', 0), rl.take('a', 'c', 0)]).toEqual([true, true, false]);
    expect(rl.take('b', 'c', 0)).toBe(true);
    expect(rl.take('a', 'c', 30_000)).toBe(true);
  });
});

describe('freshness', () => {
  it('goes live → recent → stale with age, and unavailable when the connection is not live', () => {
    const at = (m: number) => new Date(NOW.getTime() - m * 60_000);
    expect(freshnessFromAge(at(1), 60, NOW, true)).toBe('live');
    expect(freshnessFromAge(at(30), 60, NOW, true)).toBe('recent');
    expect(freshnessFromAge(at(90), 60, NOW, true)).toBe('stale');
    expect(freshnessFromAge(at(1), 60, NOW, false)).toBe('unavailable');
    expect(freshnessFromAge(null, 60, NOW, true)).toBe('unavailable');
  });

  it('calls nothing official that is stale, estimated or typed by hand', () => {
    expect(isOfficialCurrent('recent', 'connected_institutional')).toBe(true);
    for (const f of ['stale', 'estimated', 'manual', 'needs_confirmation', 'unavailable'] as const) {
      expect(isOfficialCurrent(f, 'connected_institutional'), f).toBe(false);
    }
    expect(isOfficialCurrent('live', 'user_entered')).toBe(false);
    expect(freshnessSentence('stale', 'Registrar', null)).toContain('Not the official current record.');
  });
});
