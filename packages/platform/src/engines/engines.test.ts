import { describe, expect, it } from 'vitest';
import { ASSESSMENT_SUBMISSION_STATES } from '../../../institution/src/index.ts';
import { fixedClock, sequenceRng } from '../kernel/clock.ts';
import { PlatformError } from '../gateway/errors.ts';
import { TENANT_A, TENANT_B, harness } from '../testing/memory.ts';
import { GRADE_PASSBACK } from '../../../institution/src/index.ts';
import { MemoryWorkflowStore, WorkflowRuntime } from './workflow.ts';
import {
  NON_OPTIONAL, endOfQuietHours, planNotification, type NotificationPlanInput, type NotificationRequest,
} from './notifications.ts';
import {
  MemoryObjectStore, advanceFile, assertKeyInTenant, downloadPlan, objectKey, parseObjectKey, planUpload, safeFilename, MAX_URL_TTL_S, type FileRecord,
} from './files.ts';
import { MemorySearchIndex, scopeFor } from './search.ts';
import { bucket, evaluateFlag, flagProblems, staleFlags, type FlagDefinition, type FlagSubject } from './flags.ts';
import { ALWAYS_ENTITLED, MemoryMeter, checkEntitlement, requireEntitlement, type Plan, type Subscription } from './entitlements.ts';
import { DEFAULT_MIN_CELL, reportProblems, runReport, type ReportDefinition, type ReportRow } from './reporting.ts';
import {
  DEGRADE_AFTER, DISABLE_AFTER, MemoryInbox, backoffMs, freshnessOf, mayAttempt, nativeAvailable, openConnection, recordFailure, recordSuccess, resolveValue,
  type SourcedValue,
} from './integration.ts';

const h = harness([]);
const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof PlatformError ? e.code : 'other';
  }
  return 'none';
};

describe('workflow runtime', () => {
  const make = () => {
    const store = new MemoryWorkflowStore();
    return { store, rt: new WorkflowRuntime(GRADE_PASSBACK, store, h.clock) };
  };
  const ctxA = () => h.context(TENANT_A, 'prof');
  const ctxB = () => h.context(TENANT_B, 'prof');

  it('starts in the machine\'s initial state with a history entry', async () => {
    const { rt } = make();
    const w = await rt.start(ctxA(), 'wf1', { type: 'grade', id: 'g1' });
    expect(w.state).toBe(GRADE_PASSBACK.initial);
    expect(w.history).toHaveLength(1);
    expect(await code(rt.start(ctxA(), 'wf1', { type: 'grade', id: 'g1' }))).toBe('conflict');
  });

  it('walks legal moves, refuses illegal ones with the machine\'s sentence, and bumps the version', async () => {
    const { rt } = make();
    await rt.start(ctxA(), 'wf1', { type: 'grade', id: 'g1' });
    const [first] = GRADE_PASSBACK.transitions[GRADE_PASSBACK.initial];
    const moved = await rt.advance(ctxA(), 'wf1', first, { expectedVersion: 1, reason: 'because' });
    expect(moved.version).toBe(2);
    expect(moved.history.at(-1)).toMatchObject({ from: GRADE_PASSBACK.initial, to: first, actorId: 'prof' });
    // A final state is not reachable in one move from the start.
    await expect(rt.advance(ctxA(), 'wf1', GRADE_PASSBACK.terminal[0], { expectedVersion: 2 })).rejects.toMatchObject({ code: 'precondition_failed' });
  });

  it('two writers at one version: exactly one wins', async () => {
    const { rt } = make();
    await rt.start(ctxA(), 'wf1', { type: 'grade', id: 'g1' });
    const [a, b] = GRADE_PASSBACK.transitions[GRADE_PASSBACK.initial];
    const results = await Promise.allSettled([
      rt.advance(ctxA(), 'wf1', a, { expectedVersion: 1, reason: 'x' }),
      rt.advance(ctxA(), 'wf1', b ?? a, { expectedVersion: 1, reason: 'x' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ code: 'conflict' });
  });

  it('a stale version is a conflict even when nobody else is writing right now', async () => {
    const { rt } = make();
    await rt.start(ctxA(), 'wf1', { type: 'grade', id: 'g1' });
    const [a] = GRADE_PASSBACK.transitions[GRADE_PASSBACK.initial];
    await rt.advance(ctxA(), 'wf1', a, { expectedVersion: 1, reason: 'x' });
    // The caller still holds version 1; the instance is at 2. A write on the stale read must not land.
    expect(await code(rt.advance(ctxA(), 'wf1', GRADE_PASSBACK.initial, { expectedVersion: 1, reason: 'x' }))).toBe('conflict');
    expect((await rt.load(ctxA(), 'wf1')).version).toBe(2);
  });

  it('an exceptional move needs a reason', async () => {
    const { rt } = make();
    const [from, to] = GRADE_PASSBACK.exceptional[0];
    // Reach `from` along the machine's own path.
    const path = findPath(from) as (typeof GRADE_PASSBACK.initial)[];
    await rt.start(ctxA(), 'wf1', { type: 'grade', id: 'g1' });
    let version = 1;
    for (const s of path) {
      await rt.advance(ctxA(), 'wf1', s, { expectedVersion: version++, reason: 'setup' });
    }
    expect(await code(rt.advance(ctxA(), 'wf1', to, { expectedVersion: version }))).toBe('validation_failed');
    expect((await rt.advance(ctxA(), 'wf1', to, { expectedVersion: version, reason: 'Registrar confirmed by phone' })).history.at(-1)).toMatchObject({ exceptional: true, reason: 'Registrar confirmed by phone' });
  });

  it('another tenant cannot see, load or advance an instance — and gets not_found, not forbidden', async () => {
    const { rt } = make();
    await rt.start(ctxA(), 'wf1', { type: 'grade', id: 'g1' });
    expect(await code(rt.load(ctxB(), 'wf1'))).toBe('not_found');
    expect(await code(rt.advance(ctxB(), 'wf1', GRADE_PASSBACK.transitions[GRADE_PASSBACK.initial][0], { expectedVersion: 1 }))).toBe('not_found');
    // …and tenant B can start its own instance under the same id.
    await expect(rt.start(ctxB(), 'wf1', { type: 'grade', id: 'g1' })).resolves.toBeTruthy();
  });

  it('is a real reference to the institution machine (control: the import is not a stub)', () => {
    expect(ASSESSMENT_SUBMISSION_STATES.length).toBeGreaterThan(2);
    expect(GRADE_PASSBACK.exceptional.length).toBeGreaterThan(0);
  });
});

function findPath(target: string): string[] {
  // Breadth-first search over the machine to reach a state.
  const start = GRADE_PASSBACK.initial as string;
  const q: [string, string[]][] = [[start, []]];
  const seen = new Set([start]);
  while (q.length) {
    const [s, path] = q.shift()!;
    if (s === target) return path;
    for (const n of GRADE_PASSBACK.transitions[s as keyof typeof GRADE_PASSBACK.transitions]) {
      if (!seen.has(n)) {
        seen.add(n);
        q.push([n, [...path, n]]);
      }
    }
  }
  throw new Error(`unreachable ${target}`);
}

describe('notifications', () => {
  const NOW = new Date('2026-10-04T03:00:00Z'); // 22:00 in Chicago (CDT), 23:00 in New York… and 03:00 UTC
  const request = (over: Partial<NotificationRequest> = {}): NotificationRequest => ({
    tenantId: 't', recipientId: 'stu', subjectId: 'stu', kind: 'academic', template: 'deadline.soon', data: { course: 'ECON 101' }, dedupeKey: 'd1', ...over,
  });
  const input = (over: Partial<NotificationPlanInput> = {}, req: Partial<NotificationRequest> = {}): NotificationPlanInput => ({
    request: request(req),
    preferences: { personId: 'stu', tenantId: 't', channels: {}, quietHours: { startHour: 22, endHour: 7, timeZone: 'America/Chicago' } },
    tenant: { tenantId: 't', enabledChannels: ['in_app', 'push', 'email', 'sms'], guardianChannels: ['email'] },
    consented: false,
    marketingConsented: false,
    alreadySent: new Set(),
    now: NOW,
    ...over,
  });

  it('defers push during quiet hours but not the silent in-app item', () => {
    const plan = planNotification(input());
    expect(plan.deliveries.find((d) => d.channel === 'in_app')).toEqual({ channel: 'in_app', deliverAfter: null });
    const push = plan.deliveries.find((d) => d.channel === 'push');
    expect(push?.deferredBy).toBe('quiet_hours');
    expect(push?.deliverAfter).toBe('2026-10-04T12:00:00.000Z'); // 07:00 CDT
  });

  it('delivers immediately outside quiet hours (control: the deferral is not unconditional)', () => {
    const plan = planNotification(input({ now: new Date('2026-10-04T17:00:00Z') }));
    expect(plan.deliveries.every((d) => d.deliverAfter === null)).toBe(true);
  });

  it('safety and account-security ignore quiet hours and cannot be switched off', () => {
    const off = { personId: 'stu', tenantId: 't', channels: { safety: [], account_security: [] }, quietHours: { startHour: 22, endHour: 7, timeZone: 'America/Chicago' } } as const;
    for (const kind of ['safety', 'account_security'] as const) {
      const plan = planNotification(input({ preferences: off }, { kind }));
      expect(plan.deliveries.length).toBeGreaterThan(0);
      expect(plan.deliveries.every((d) => d.deliverAfter === null)).toBe(true);
    }
    expect(NON_OPTIONAL).toContain('transactional');
  });

  it('an urgent transactional message goes now; a non-urgent one waits', () => {
    expect(planNotification(input({}, { kind: 'transactional', urgent: true })).deliveries.every((d) => d.deliverAfter === null)).toBe(true);
    expect(planNotification(input({}, { kind: 'transactional' })).deliveries.find((d) => d.channel === 'email')?.deliverAfter).not.toBeNull();
  });

  it('marketing needs consent, an opted-in channel, and never reaches a guardian about a student', () => {
    expect(planNotification(input({}, { kind: 'marketing' })).suppressed).toEqual([{ channel: 'all', reason: 'marketing_not_consented' }]);
    const prefs = { personId: 'stu', tenantId: 't', channels: { marketing: ['email'] as const } };
    expect(planNotification(input({ marketingConsented: true, preferences: prefs }, { kind: 'marketing' })).deliveries).toEqual([{ channel: 'email', deliverAfter: null }]);
    expect(planNotification(input({ marketingConsented: true, consented: true }, { kind: 'marketing', recipientId: 'guardian' })).suppressed).toEqual([{ channel: 'all', reason: 'marketing_to_guardian' }]);
    // consented but no opted-in channel: nothing, not a default channel
    expect(planNotification(input({ marketingConsented: true }, { kind: 'marketing' })).deliveries).toEqual([]);
  });

  it('a guardian needs consent, and only the tenant\'s guardian channels', () => {
    const asGuardian = { recipientId: 'guardian' };
    expect(planNotification(input({}, asGuardian)).suppressed).toEqual([{ channel: 'all', reason: 'no_consent' }]);
    const plan = planNotification(input({ consented: true, preferences: undefined }, { ...asGuardian, kind: 'academic' }));
    expect(plan.deliveries.map((d) => d.channel)).toEqual([]);
    const email = planNotification(input({ consented: true, preferences: { personId: 'guardian', tenantId: 't', channels: { academic: ['email', 'push'] } } }, asGuardian));
    expect(email.deliveries.map((d) => d.channel)).toEqual(['email']);
    expect(email.suppressed).toContainEqual({ channel: 'push', reason: 'no_channel' });
  });

  it('a safety message reaches a guardian-channel even without academic consent (emergency contact is its own purpose)', () => {
    const plan = planNotification(input({ consented: false }, { kind: 'safety', recipientId: 'guardian' }));
    expect(plan.deliveries.map((d) => d.channel)).toEqual(['email']);
  });

  it('dedupes, and refuses a request and preferences from different tenants', () => {
    expect(planNotification(input({ alreadySent: new Set(['d1']) })).suppressed).toEqual([{ channel: 'all', reason: 'duplicate' }]);
    expect(planNotification(input({ preferences: { personId: 'stu', tenantId: 'other', channels: {} } })).suppressed).toEqual([{ channel: 'all', reason: 'tenant_mismatch' }]);
    expect(planNotification(input({ tenant: { tenantId: 'other', enabledChannels: ['in_app'], guardianChannels: [] } })).suppressed).toEqual([{ channel: 'all', reason: 'tenant_mismatch' }]);
  });

  it('quiet hours that cross midnight, and those that do not', () => {
    const q = { startHour: 22, endHour: 7, timeZone: 'UTC' };
    expect(endOfQuietHours(new Date('2026-10-04T23:30:00Z'), q)?.toISOString()).toBe('2026-10-05T07:00:00.000Z');
    expect(endOfQuietHours(new Date('2026-10-04T12:00:00Z'), q)).toBeNull();
    const day = { startHour: 13, endHour: 15, timeZone: 'UTC' };
    expect(endOfQuietHours(new Date('2026-10-04T13:10:00Z'), day)?.toISOString()).toBe('2026-10-04T15:00:00.000Z');
  });
});

describe('files', () => {
  const ctx = (tenant = TENANT_A) => h.context(tenant, 'stu');
  const at = new Date('2026-10-04T12:00:00Z');
  const record = (over: Partial<FileRecord> = {}): FileRecord => ({
    ...planUpload(ctx(), { filename: 'a.pdf', contentType: 'application/pdf', sizeBytes: 1000, classification: 'student_private' }, 'f1', at).record, state: 'available', ...over,
  });

  it('keys carry the tenant and round-trip', () => {
    const k = objectKey(TENANT_A, 'education_record', 'file-1', at);
    expect(k).toBe('t/tenant-a/education_record/2026-10/file-1');
    expect(parseObjectKey(k)).toEqual({ tenantId: TENANT_A, classification: 'education_record', month: '2026-10', fileId: 'file-1' });
  });

  it('refuses another tenant\'s key, traversal, and malformed keys before touching the store', () => {
    const foreign = objectKey(TENANT_B, 'internal', 'f', at);
    for (const bad of [foreign, 't/tenant-a/internal/2026-10/../../tenant-b/internal/2026-10/f', 't/tenant-a//internal/2026-10/f', 'tenant-a/f', '', 't/tenant-a/secret/2026-10/f']) {
      expect(() => assertKeyInTenant({ tenantId: TENANT_A }, bad)).toThrow(PlatformError);
    }
    expect(() => assertKeyInTenant({ tenantId: TENANT_A }, objectKey(TENANT_A, 'internal', 'f', at))).not.toThrow();
  });

  it('plans an upload only for allowed types and sizes', () => {
    const plan = planUpload(ctx(), { filename: 'a.pdf', contentType: 'application/pdf', sizeBytes: 1000, classification: 'education_record' }, 'f1', at);
    expect(plan.record.state).toBe('pending_upload');
    expect(plan.constraints.ttlSeconds).toBeLessThanOrEqual(MAX_URL_TTL_S.education_record);
    const bad = (over: object) => () => planUpload(ctx(), { filename: 'a', contentType: 'application/pdf', sizeBytes: 10, classification: 'internal', ...over }, 'f', at);
    expect(bad({ contentType: 'application/x-msdownload' })).toThrow();
    expect(bad({ contentType: 'text/html' })).toThrow();
    expect(bad({ sizeBytes: 0 })).toThrow();
    expect(bad({ sizeBytes: 26 * 1024 * 1024, classification: 'education_record' })).toThrow();
    expect(bad({ sizeBytes: 1.5 })).toThrow();
  });

  it('serves only an available file, with a TTL capped by classification', () => {
    expect(downloadPlan(ctx(), record(), 99_999).ttlSeconds).toBe(MAX_URL_TTL_S.student_private);
    for (const state of ['pending_upload', 'quarantined', 'rejected', 'deleted'] as const) {
      expect(() => downloadPlan(ctx(), record({ state }), 60)).toThrow(/not ready/);
    }
    expect(() => downloadPlan(ctx(TENANT_B), record(), 60)).toThrow(/could not find/);
  });

  it('walks the lifecycle, and a legal hold blocks deletion in every state', () => {
    let f = record({ state: 'pending_upload' });
    f = advanceFile(f, 'quarantined');
    f = advanceFile(f, 'available');
    expect(() => advanceFile(f, 'quarantined')).toThrow(PlatformError);
    expect(() => advanceFile({ ...f, legalHold: true }, 'deleted')).toThrow(/legal hold/);
    expect(advanceFile(f, 'deleted').state).toBe('deleted');
    expect(() => advanceFile(record({ state: 'pending_upload' }), 'available')).toThrow();
  });

  it('sanitises filenames for display and never uses them in keys', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\a\\x.pdf')).toBe('x.pdf');
    expect(safeFilename('a\u0000b"<c>.pdf')).toBe('abc.pdf');
    expect(safeFilename('...')).toBe('file');
    expect(safeFilename('x'.repeat(500))).toHaveLength(120);
  });

  it('the object store refuses cross-tenant reads, writes, deletes and listings', async () => {
    const store = new MemoryObjectStore();
    const kA = objectKey(TENANT_A, 'internal', 'f1', at);
    await store.put({ tenantId: TENANT_A }, kA, new Uint8Array([1, 2, 3]), 'text/plain');
    expect((await store.get({ tenantId: TENANT_A }, kA))?.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(await code(store.get({ tenantId: TENANT_B }, kA))).toBe('not_found');
    expect(await code(store.put({ tenantId: TENANT_B }, kA, new Uint8Array([9]), 'text/plain'))).toBe('not_found');
    expect(await code(store.delete({ tenantId: TENANT_B }, kA))).toBe('not_found');
    expect(await code(store.list({ tenantId: TENANT_B }, 't/tenant-a/'))).toBe('not_found');
    expect(await store.list({ tenantId: TENANT_B }, 't/tenant-b/')).toEqual([]);
    expect(await store.list({ tenantId: TENANT_A }, 't/tenant-a/')).toEqual([kA]);
  });
});

describe('search', () => {
  const doc = (over: Partial<Parameters<MemorySearchIndex['index']>[0]> = {}) => ({
    id: 'd1', tenantId: TENANT_A, kind: 'note', classification: 'student_private' as const, title: 'Macroeconomics grade appeal', excerpt: 'notes on the midterm', acl: ['person:stu'], ...over,
  });
  const scope = (tenant: string, person: string, acl: string[] = [], includeRecords = false) => scopeFor(h.context(tenant, person), acl, { includeRecords });

  it('returns only the tenant\'s own documents', async () => {
    const idx = new MemorySearchIndex();
    await idx.index(doc());
    await idx.index(doc({ id: 'd2', tenantId: TENANT_B, acl: ['person:stu'] }));
    const hits = await idx.query(scope(TENANT_A, 'stu'), 'grade', 10);
    expect(hits.map((x) => x.id)).toEqual(['d1']);
    // Same person id, same words, other tenant: sees only theirs.
    expect((await idx.query(scope(TENANT_B, 'stu'), 'grade', 10)).map((x) => x.id)).toEqual(['d2']);
  });

  it('returns only what the caller\'s tokens match', async () => {
    const idx = new MemorySearchIndex();
    await idx.index(doc());
    expect(await idx.query(scope(TENANT_A, 'someone-else'), 'grade', 10)).toEqual([]);
    expect((await idx.query(scope(TENANT_A, 'someone-else', ['person:stu']), 'grade', 10)).length).toBe(1);
    await idx.index(doc({ id: 'pub', acl: ['public'], title: 'Grade policy' }));
    expect((await idx.query(scope(TENANT_A, 'anyone'), 'grade', 10)).map((x) => x.id)).toEqual(['pub']);
  });

  it('hides education records unless the scope asks for them', async () => {
    const idx = new MemorySearchIndex();
    await idx.index(doc({ classification: 'education_record' }));
    expect(await idx.query(scope(TENANT_A, 'stu'), 'grade', 10)).toEqual([]);
    expect((await idx.query(scope(TENANT_A, 'stu', [], true), 'grade', 10)).length).toBe(1);
  });

  it('refuses a hand-built scope and an empty query', async () => {
    const idx = new MemorySearchIndex();
    await idx.index(doc());
    await expect(idx.query({} as never, 'grade', 10)).rejects.toMatchObject({ code: 'internal' });
    await expect(idx.query({ tenantId: TENANT_A } as never, 'grade', 10)).rejects.toMatchObject({ code: 'internal' });
    expect(await idx.query(scope(TENANT_A, 'stu'), '  ', 10)).toEqual([]);
  });

  it('removal is tenant-keyed: another tenant cannot remove my document', async () => {
    const idx = new MemorySearchIndex();
    await idx.index(doc());
    await idx.remove(TENANT_B, 'd1');
    expect((await idx.query(scope(TENANT_A, 'stu'), 'grade', 10)).length).toBe(1);
    await idx.remove(TENANT_A, 'd1');
    expect(await idx.query(scope(TENANT_A, 'stu'), 'grade', 10)).toEqual([]);
  });

  it('ranks a title match above an excerpt match', async () => {
    const idx = new MemorySearchIndex();
    await idx.index(doc({ id: 'a', title: 'Midterm', excerpt: 'x' }));
    await idx.index(doc({ id: 'b', title: 'Notes', excerpt: 'midterm midterm' }));
    expect((await idx.query(scope(TENANT_A, 'stu'), 'midterm', 10)).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('feature flags', () => {
  const NOW = Date.parse('2026-10-04T12:00:00Z');
  const subject = (over: Partial<FlagSubject> = {}): FlagSubject => ({ tenantId: 't1', personId: 'p1', environment: 'production', roles: ['student'], cohorts: ['2030'], ...over });
  const flag = (over: Partial<FlagDefinition> = {}): FlagDefinition => ({
    key: 'study.studio', kind: 'release', owner: 'learning', description: 'x', defaultValue: false, expiresAt: '2027-01-01T00:00:00Z', rules: [], ...over,
  });

  it('is off by default and says why', () => {
    expect(evaluateFlag(flag(), subject(), NOW)).toEqual({ value: false, reason: 'default' });
  });

  it('matches tenants, roles, cohorts and environments — all must hold', () => {
    const f = flag({ rules: [{ id: 'r1', tenantIds: ['t1'], roles: ['student'], cohorts: ['2030'], environments: ['production'], value: true }] });
    expect(evaluateFlag(f, subject(), NOW)).toEqual({ value: true, reason: 'rule:r1' });
    for (const over of [{ tenantId: 't2' }, { roles: ['faculty'] }, { cohorts: ['2028'] }, { environments: 'staging' as never, environment: 'staging' }]) {
      expect(evaluateFlag(f, subject(over), NOW).value).toBe(false);
    }
  });

  it('a kill switch beats a rule that would turn it on', () => {
    expect(evaluateFlag(flag({ kill: true, defaultValue: true, rules: [{ id: 'r', value: true }] }), subject(), NOW)).toEqual({ value: false, reason: 'kill_switch' });
  });

  it('percentage rollout is deterministic, roughly even, and monotone', () => {
    const f25 = flag({ rules: [{ id: 'p', percentage: 25, value: true }] });
    const f50 = flag({ rules: [{ id: 'p', percentage: 50, value: true }] });
    const people = Array.from({ length: 2000 }, (_, i) => `person-${i}`);
    const on25 = people.filter((p) => evaluateFlag(f25, subject({ personId: p }), NOW).value);
    const on50 = people.filter((p) => evaluateFlag(f50, subject({ personId: p }), NOW).value);
    expect(on25.length).toBeGreaterThan(400);
    expect(on25.length).toBeLessThan(600);
    expect(on25.every((p) => on50.includes(p))).toBe(true);
    expect(evaluateFlag(f25, subject({ personId: 'person-7' }), NOW)).toEqual(evaluateFlag(f25, subject({ personId: 'person-7' }), NOW));
    expect(bucket('a', 'p')).not.toBe(bucket('b', 'p') === bucket('a', 'p') ? -1 : bucket('a', 'p') + 0.5);
  });

  it('an expired flag falls back to its default, and is reported stale', () => {
    const f = flag({ expiresAt: '2026-10-01T00:00:00Z', defaultValue: false, rules: [{ id: 'r', value: true }] });
    expect(evaluateFlag(f, subject(), NOW)).toEqual({ value: false, reason: 'expired_default' });
    expect(staleFlags([f, flag({ key: 'other.one' })], NOW)).toEqual(['study.studio']);
  });

  it('validates definitions — a tenant-gated flag defaults off and names its tenants', () => {
    expect(flagProblems(flag())).toEqual([]);
    expect(flagProblems(flag({ kind: 'tenant_gated', defaultValue: true }))).toContainEqual(expect.stringContaining('default to off'));
    expect(flagProblems(flag({ kind: 'tenant_gated', rules: [{ id: 'all', value: true }] }))).toContainEqual(expect.stringContaining('without naming tenants'));
    expect(flagProblems(flag({ kind: 'tenant_gated', rules: [{ id: 'one', tenantIds: ['t1'], value: true }] }))).toEqual([]);
    expect(flagProblems(flag({ owner: ' ', key: 'Bad Key', expiresAt: 'soon', rules: [{ id: 'a', percentage: 150, value: true }, { id: 'a', value: true }] })).length).toBeGreaterThanOrEqual(5);
  });
});

describe('entitlements', () => {
  const NOW = Date.parse('2026-10-04T12:00:00Z');
  const plan: Plan = { id: 'plus', entitlements: { 'ai.tutor': { enabled: true, limit: 100 }, 'study.studio': { enabled: true }, 'campus.api': { enabled: false } } };
  const sub = (over: Partial<Subscription> = {}): Subscription => ({ holder: { kind: 'person', id: 'p' }, tenantId: 't', planId: 'plus', status: 'active', ...over });

  it('entitles by plan, with remaining units', () => {
    expect(checkEntitlement('t', sub(), plan, 'study.studio', 0, NOW)).toEqual({ allowed: true, reason: 'plan' });
    expect(checkEntitlement('t', sub(), plan, 'ai.tutor', 40, NOW)).toEqual({ allowed: true, reason: 'plan', remaining: 60 });
    expect(checkEntitlement('t', sub(), plan, 'ai.tutor', 100, NOW)).toEqual({ allowed: false, reason: 'limit_reached', remaining: 0 });
    expect(checkEntitlement('t', sub(), plan, 'campus.api', 0, NOW).reason).toBe('not_in_plan');
    expect(checkEntitlement('t', sub(), plan, 'unknown.thing', 0, NOW).reason).toBe('not_in_plan');
  });

  it('records, export, deletion, accessibility and safety survive any subscription state — including none', () => {
    const states: (Subscription | undefined)[] = [undefined, sub({ status: 'canceled' }), sub({ status: 'past_due' }), sub({ status: 'canceled', endsAt: '2020-01-01' })];
    for (const key of ALWAYS_ENTITLED) for (const s of states) {
      expect(checkEntitlement('t', s, s ? plan : undefined, key, 1e9, NOW)).toEqual({ allowed: true, reason: 'always_entitled' });
    }
    // Control: an ordinary key is refused in the same states.
    expect(checkEntitlement('t', sub({ status: 'past_due' }), plan, 'study.studio', 0, NOW).allowed).toBe(false);
  });

  it('past_due entitles only through its grace window; canceled only until it ends', () => {
    expect(checkEntitlement('t', sub({ status: 'past_due', graceUntil: '2026-10-10' }), plan, 'study.studio', 0, NOW)).toEqual({ allowed: true, reason: 'grace' });
    expect(checkEntitlement('t', sub({ status: 'past_due', graceUntil: '2026-10-01' }), plan, 'study.studio', 0, NOW).reason).toBe('subscription_inactive');
    expect(checkEntitlement('t', sub({ status: 'canceled', endsAt: '2026-11-01' }), plan, 'study.studio', 0, NOW).allowed).toBe(true);
    expect(checkEntitlement('t', sub({ status: 'canceled', endsAt: '2026-10-01' }), plan, 'study.studio', 0, NOW).allowed).toBe(false);
    expect(checkEntitlement('t', sub({ status: 'canceled' }), plan, 'study.studio', 0, NOW).allowed).toBe(false);
  });

  it('a contract override beats the plan and carries a reason; a subscription from another tenant is refused', () => {
    const o = sub({ overrides: { 'campus.api': { enabled: true, limit: 500, reason: 'Order form 2026-114' } } });
    expect(checkEntitlement('t', o, plan, 'campus.api', 10, NOW)).toEqual({ allowed: true, reason: 'override', remaining: 490 });
    expect(checkEntitlement('other', o, plan, 'campus.api', 10, NOW).reason).toBe('tenant_mismatch');
    expect(checkEntitlement('t', sub({ planId: 'free' }), plan, 'study.studio', 0, NOW).reason).toBe('no_subscription');
  });

  it('requireEntitlement throws a 402 with a sentence and a way forward, and passes an allowance through', () => {
    const ok = checkEntitlement('t', sub(), plan, 'study.studio', 0, NOW);
    expect(requireEntitlement(ok, 'Study Studio')).toBe(ok);
    const limit = checkEntitlement('t', sub(), plan, 'ai.tutor', 100, NOW);
    expect(() => requireEntitlement(limit, 'AI tutor')).toThrow(/used all of your AI tutor/);
    try {
      requireEntitlement(checkEntitlement('t', sub({ status: 'canceled' }), plan, 'study.studio', 0, NOW), 'Study Studio');
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: 'entitlement_required', status: 402, userAction: { kind: 'open_screen' } });
    }
  });

  it('metering is idempotent per event, per tenant, per key', () => {
    const m = new MemoryMeter();
    expect(m.record('t', 'ai.tutor', 'e1', 3)).toBe(true);
    expect(m.record('t', 'ai.tutor', 'e1', 3)).toBe(false);
    expect(m.record('u', 'ai.tutor', 'e1', 3)).toBe(true);
    expect(m.total('t', 'ai.tutor')).toBe(3);
    expect(() => m.record('t', 'ai.tutor', 'e2', 0)).toThrow();
  });
});

describe('reporting', () => {
  const def: ReportDefinition = { id: 'attendance.by_program', owner: 'registrar', description: 'x', personKey: 'person', dimensions: ['program'] };
  const rows = (program: string, n: number, tenantId = 't'): ReportRow[] => Array.from({ length: n }, (_, i) => ({ tenantId, person: `${program}-${i}`, program }));

  it('counts distinct people, not rows', () => {
    const dup = [...rows('econ', 12), ...rows('econ', 12)];
    expect(runReport(def, dup, { tenantId: 't' }).cells).toEqual([{ key: { program: 'econ' }, count: 12, suppressed: false }]);
  });

  it('suppresses small cells and reveals no number for them', () => {
    const r = runReport(def, [...rows('econ', 25), ...rows('physics', 3), ...rows('history', 30)], { tenantId: 't' });
    const physics = r.cells.find((c) => c.key.program === 'physics')!;
    expect(physics).toEqual({ key: { program: 'physics' }, count: null, suppressed: true });
    expect(JSON.stringify(r)).not.toMatch(/"count":3[,}]/);
  });

  it('suppresses a second cell so one hidden cell cannot be derived by subtraction', () => {
    const r = runReport(def, [...rows('econ', 25), ...rows('physics', 3), ...rows('history', 30)], { tenantId: 't' });
    const hidden = r.cells.filter((c) => c.suppressed).map((c) => c.key.program).sort();
    expect(hidden).toEqual(['econ', 'physics']); // the smallest *shown* cell goes with it
    // Control: with no small cell, nothing is hidden.
    expect(runReport(def, [...rows('econ', 25), ...rows('history', 30)], { tenantId: 't' }).cells.every((c) => !c.suppressed)).toBe(true);
  });

  it('drops and counts rows from another tenant before grouping', () => {
    const r = runReport(def, [...rows('econ', 20), ...rows('econ', 50, 'other')], { tenantId: 't' });
    expect(r.foreignRowsDropped).toBe(50);
    expect(r.cells[0].count).toBe(20);
  });

  it('refuses a definition that is a re-identification risk', () => {
    expect(reportProblems({ ...def, dimensions: ['a', 'b', 'c'] })).toHaveLength(1);
    expect(reportProblems({ ...def, minCell: DEFAULT_MIN_CELL - 1 })).toHaveLength(1);
    expect(() => runReport({ ...def, minCell: 2 }, [], { tenantId: 't' })).toThrow(/minCell/);
  });

  it('suppression is evaluated within the first dimension in a cross-tab', () => {
    const cross: ReportDefinition = { ...def, dimensions: ['program', 'year'] };
    const mk = (program: string, year: string, n: number): ReportRow[] => Array.from({ length: n }, (_, i) => ({ tenantId: 't', person: `${program}${year}${i}`, program, year }));
    const r = runReport(cross, [...mk('econ', '1', 40), ...mk('econ', '2', 2), ...mk('econ', '3', 30), ...mk('hist', '1', 40), ...mk('hist', '2', 50)], { tenantId: 't' });
    const hiddenEcon = r.cells.filter((c) => c.key.program === 'econ' && c.suppressed).length;
    const hiddenHist = r.cells.filter((c) => c.key.program === 'hist' && c.suppressed).length;
    expect(hiddenEcon).toBe(2);
    expect(hiddenHist).toBe(0);
  });
});

describe('integration primitives', () => {
  const conn = () => openConnection({ id: 'c1', tenantId: 't', provider: 'canvas', credentialRef: 'secret://tenants/t/canvas', mappingVersion: 'v3' });

  it('refuses a secret where a reference belongs', () => {
    for (const secret of ['sk_live_abcdef', 'xoxb-1234-abcd', '-----BEGIN PRIVATE KEY-----', 'A'.repeat(48)]) {
      expect(() => openConnection({ id: 'c', tenantId: 't', provider: 'p', credentialRef: secret, mappingVersion: 'v1' })).toThrow(/reference/);
    }
  });

  it('degrades then disables on consecutive failures, and one success heals', () => {
    let c = conn();
    for (let i = 0; i < DEGRADE_AFTER; i++) c = recordFailure(c, '2026-10-04T12:00:00Z');
    expect(c.state).toBe('degraded');
    expect(mayAttempt(c)).toBe(true);
    for (let i = DEGRADE_AFTER; i < DISABLE_AFTER; i++) c = recordFailure(c, '2026-10-04T12:00:00Z');
    expect(c.state).toBe('disabled');
    expect(mayAttempt(c)).toBe(false);
    expect(recordSuccess({ ...c, state: 'degraded' }, '2026-10-05T00:00:00Z', 'cur-2')).toMatchObject({ state: 'healthy', consecutiveFailures: 0, cursor: 'cur-2' });
  });

  it('the native capability is available in every connection state — it is not a function of one', () => {
    expect(nativeAvailable.length).toBe(0);
    for (const _state of ['healthy', 'degraded', 'disabled'] as const) expect(nativeAvailable()).toBe(true);
  });

  it('backs off exponentially with jitter and a ceiling', () => {
    const top = sequenceRng([0.999999]);
    const delays = [1, 2, 3, 4, 20].map((n) => backoffMs(n, top, { baseMs: 1000, capMs: 10_000 }));
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
    expect(delays[4]).toBeLessThanOrEqual(10_000);
    expect(backoffMs(3, sequenceRng([0]))).toBe(1);
  });

  it('the inbox: new, duplicate, conflict — scoped by tenant and connection', async () => {
    const inbox = new MemoryInbox();
    const m = { tenantId: 't', connectionId: 'c1', externalId: 'ext-1', payload: { grade: 'A', n: 1 } };
    expect(await inbox.receive(m)).toEqual({ kind: 'new' });
    expect(await inbox.receive({ ...m, payload: { n: 1, grade: 'A' } })).toEqual({ kind: 'duplicate' });
    expect(await inbox.receive({ ...m, payload: { grade: 'B', n: 1 } })).toMatchObject({ kind: 'conflict' });
    expect(await inbox.receive({ ...m, tenantId: 'u' })).toEqual({ kind: 'new' });
    expect(await inbox.receive({ ...m, connectionId: 'c2' })).toEqual({ kind: 'new' });
  });

  it('freshness', () => {
    const now = Date.parse('2026-10-04T12:00:00Z');
    expect(freshnessOf('2026-10-04T11:00:00Z', now, 2 * 3_600_000)).toBe('current');
    expect(freshnessOf('2026-10-04T08:00:00Z', now, 2 * 3_600_000)).toBe('stale');
    expect(freshnessOf(undefined, now, 1)).toBe('unknown');
    expect(freshnessOf('not a date', now, 1)).toBe('unknown');
    expect(freshnessOf('2027-01-01T00:00:00Z', now, 1)).toBe('unknown');
  });

  describe('source precedence', () => {
    const v = (value: string, origin: SourcedValue<string>['source']['origin'], observedAt = '2026-10-01T00:00:00Z'): SourcedValue<string> => ({ value, source: { origin, observedAt, freshnessState: 'current' } });
    it('institution beats connected beats imported beats native', () => {
      expect(resolveValue(v('a', 'native'), v('b', 'institution_entered'), { studentOwned: false }).chosen.value).toBe('b');
      expect(resolveValue(v('a', 'imported'), v('b', 'connected'), { studentOwned: false }).chosen.value).toBe('b');
      expect(resolveValue(v('a', 'ai_generated'), v('b', 'native'), { studentOwned: false }).chosen.value).toBe('b');
    });
    it('a student-owned field takes the student\'s newer native value; an older one loses', () => {
      expect(resolveValue(v('mine', 'native', '2026-10-03T00:00:00Z'), v('theirs', 'connected', '2026-10-01T00:00:00Z'), { studentOwned: true }).chosen.value).toBe('mine');
      expect(resolveValue(v('mine', 'native', '2026-09-01T00:00:00Z'), v('theirs', 'connected', '2026-10-01T00:00:00Z'), { studentOwned: true }).chosen.value).toBe('theirs');
    });
    it('two equally strong, disagreeing sources are conflicted — never a coin toss', () => {
      const r = resolveValue(v('a', 'connected'), v('b', 'connected'), { studentOwned: false });
      expect(r.conflicted).toBe(true);
      expect(r.chosen.source.freshnessState).toBe('conflicted');
      expect(resolveValue(v('a', 'connected'), v('a', 'connected'), { studentOwned: false }).conflicted).toBe(false);
    });
  });

  it('fixedClock drives time (control for the helpers above)', () => {
    const c = fixedClock('2026-01-01T00:00:00Z');
    c.advance(1000);
    expect(c.now().toISOString()).toBe('2026-01-01T00:00:01.000Z');
  });
});
