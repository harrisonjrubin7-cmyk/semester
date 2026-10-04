/**
 * The tenant-isolation conformance suite.
 *
 * Cases are plain async functions that **throw when a boundary leaks**, so
 * they can run under any test runner and against any adapter. The memory
 * adapters pass them in `isolation.test.ts`; a Postgres, Redis, S3, OpenSearch
 * or warehouse adapter is accepted when it passes the same cases against the
 * real service (`docs/platform/ISOLATION.md` says how to run them).
 *
 * Every case has the same shape: *write as tenant A, then try as tenant B* —
 * with the **same person id in both tenants**, because the realistic bug is
 * not a stranger, it is an id that happens to exist twice — and expect
 * nothing. Each is paired with a positive control (A *can* see its own),
 * because a suite that only checks for emptiness is satisfied by an adapter
 * that stores nothing.
 */

import type { Clock } from '../kernel/clock.ts';
import type { AuditLog } from '../identity/audit.ts';
import type { ConsentRecord } from '../identity/consent.ts';
import { PlatformError } from '../gateway/errors.ts';
import { objectKey } from '../engines/files.ts';
import type { ObjectStore } from '../engines/files.ts';
import { scopeFor, type SearchIndex } from '../engines/search.ts';
import { retrieveForAi, supportRead } from '../isolation/layers.ts';
import type { IsolationLayer, TenantAnalytics, TenantCache, TenantQueue, TenantRepository, TenantRow } from '../isolation/layers.ts';
import type { RequestContext } from '../tenancy/context.ts';
import { scopeOf } from '../tenancy/context.ts';
import type { SemesterEvent } from '../seam/institution.ts';

export interface IsolationSubject {
  clock: Clock;
  /** Two contexts for the **same person id** in two different tenants. */
  a: RequestContext;
  b: RequestContext;
  repo: TenantRepository<TenantRow & { value: string }>;
  cache: TenantCache;
  objects: ObjectStore;
  queue: TenantQueue;
  /** Build an event stamped for a context's tenant. */
  eventFor(ctx: RequestContext): SemesterEvent;
  search: SearchIndex;
  analytics: TenantAnalytics;
  audit: AuditLog;
}

export interface IsolationCase {
  layer: IsolationLayer;
  name: string;
  run(): Promise<void>;
}

class Leak extends Error {
  constructor(layer: IsolationLayer, what: string) {
    super(`ISOLATION LEAK [${layer}]: ${what}`);
    this.name = 'IsolationLeak';
  }
}

const must = (layer: IsolationLayer, cond: boolean, what: string): void => {
  if (!cond) throw new Leak(layer, what);
};

/** Expect a call to throw a `PlatformError` (any code); anything else, or success, is a leak. */
async function refused(layer: IsolationLayer, what: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof PlatformError || (e as { platformError?: boolean }).platformError === true) return;
    throw e;
  }
  throw new Leak(layer, `${what} was allowed`);
}

export function isolationCases(s: IsolationSubject): IsolationCase[] {
  const scopeA = scopeOf(s.a);
  const scopeB = scopeOf(s.b);
  const cases: IsolationCase[] = [];
  const add = (layer: IsolationLayer, name: string, run: () => Promise<void>) => cases.push({ layer, name, run });

  // ── api ──
  add('api', 'two contexts for one person differ only by tenant, and are frozen', async () => {
    must('api', s.a.actor.personId === s.b.actor.personId, 'the fixtures must share a person id');
    must('api', s.a.tenantId !== s.b.tenantId, 'the fixtures must differ by tenant');
    must('api', Object.isFrozen(s.a) && Object.isFrozen(s.b), 'a request context must be frozen');
  });

  // ── database ──
  add('database', 'a row written by A is invisible to B by get and by list; A still sees it', async () => {
    await s.repo.insert(scopeA, { id: 'row-1', tenantId: scopeA.tenantId, value: 'a-secret' });
    must('database', (await s.repo.get(scopeA, 'row-1'))?.value === 'a-secret', 'control: A cannot read its own row');
    must('database', (await s.repo.get(scopeB, 'row-1')) === undefined, 'B read A\'s row by id');
    must('database', (await s.repo.list(scopeB)).every((r) => r.tenantId === scopeB.tenantId), 'B listed A\'s rows');
  });
  add('database', 'B cannot insert a row labelled A, nor update or delete A\'s row', async () => {
    await refused('database', 'a foreign-tenant insert', () => s.repo.insert(scopeB, { id: 'row-2', tenantId: scopeA.tenantId, value: 'x' }));
    await s.repo.insert(scopeA, { id: 'row-3', tenantId: scopeA.tenantId, value: 'keep' });
    await refused('database', 'B updating A\'s row', () => s.repo.update(scopeB, 'row-3', { value: 'hijacked' }));
    must('database', (await s.repo.delete(scopeB, 'row-3')) === false, 'B deleted A\'s row');
    must('database', (await s.repo.get(scopeA, 'row-3'))?.value === 'keep', 'A\'s row changed');
  });
  add('database', 'the same id can live in both tenants without collision', async () => {
    await s.repo.insert(scopeA, { id: 'shared-id', tenantId: scopeA.tenantId, value: 'A' });
    await s.repo.insert(scopeB, { id: 'shared-id', tenantId: scopeB.tenantId, value: 'B' });
    must('database', (await s.repo.get(scopeA, 'shared-id'))?.value === 'A' && (await s.repo.get(scopeB, 'shared-id'))?.value === 'B', 'ids collided across tenants');
  });
  add('database', 'a patch cannot move a row to another tenant', async () => {
    await s.repo.insert(scopeA, { id: 'row-4', tenantId: scopeA.tenantId, value: 'v' });
    await s.repo.update(scopeA, 'row-4', { tenantId: scopeB.tenantId } as never).catch(() => undefined);
    must('database', (await s.repo.get(scopeB, 'row-4')) === undefined, 'a row was moved into B by a patch');
  });

  // ── object storage ──
  add('object_storage', 'B cannot read, overwrite, delete or list A\'s object', async () => {
    const key = objectKey(scopeA.tenantId, 'student_private', 'file-1', s.clock.now());
    await s.objects.put(scopeA, key, new Uint8Array([1, 2, 3]), 'text/plain');
    must('object_storage', (await s.objects.get(scopeA, key))?.bytes.length === 3, 'control: A cannot read its own object');
    await refused('object_storage', 'B reading A\'s key', () => s.objects.get(scopeB, key));
    await refused('object_storage', 'B overwriting A\'s key', () => s.objects.put(scopeB, key, new Uint8Array([9]), 'text/plain'));
    await refused('object_storage', 'B deleting A\'s key', () => s.objects.delete(scopeB, key));
    await refused('object_storage', 'B listing A\'s prefix', () => s.objects.list(scopeB, `t/${scopeA.tenantId}/`));
    must('object_storage', (await s.objects.get(scopeA, key))?.bytes[0] === 1, 'A\'s object changed');
  });
  add('object_storage', 'a traversal key cannot reach another tenant', async () => {
    const evil = `t/${scopeB.tenantId}/internal/2026-10/../../../${scopeA.tenantId}/internal/2026-10/x`;
    await refused('object_storage', 'a traversal key', () => s.objects.get(scopeB, evil));
  });

  // ── queue ──
  add('queue', 'B receives none of A\'s messages; A receives its own', async () => {
    const e = s.eventFor(s.a);
    await s.queue.enqueue(scopeA, e);
    must('queue', (await s.queue.receive(scopeB, 10)).length === 0, 'B received A\'s message');
    must('queue', (await s.queue.receive(scopeA, 10)).length === 1, 'control: A did not receive its own message');
  });
  add('queue', 'producing an event for tenant A into B\'s partition is refused', async () => {
    await refused('queue', 'a cross-tenant enqueue', () => s.queue.enqueue(scopeB, s.eventFor(s.a)));
  });

  // ── cache ──
  add('cache', 'B misses a key A set, even with identical namespace and key', async () => {
    await s.cache.set(scopeA, 'profile', 'p1', 'a-value', 60);
    must('cache', (await s.cache.get(scopeA, 'profile', 'p1')) === 'a-value', 'control: A cannot read its own entry');
    must('cache', (await s.cache.get(scopeB, 'profile', 'p1')) === undefined, 'B hit A\'s cache entry');
  });
  add('cache', 'a flush for one tenant leaves the other\'s entries', async () => {
    await s.cache.set(scopeA, 'n', 'k', 'a', 60);
    await s.cache.set(scopeB, 'n', 'k', 'b', 60);
    await s.cache.flushTenant(scopeA);
    must('cache', (await s.cache.get(scopeA, 'n', 'k')) === undefined, 'A\'s entry survived its own flush');
    must('cache', (await s.cache.get(scopeB, 'n', 'k')) === 'b', 'B\'s entry was flushed with A\'s');
  });
  add('cache', 'namespace/key concatenation cannot collide across the separator', async () => {
    await refused('cache', 'a key containing the separator', () => s.cache.set(scopeA, 'a:b', 'c', 'x', 60));
    await refused('cache', 'a namespace containing the separator', () => s.cache.set(scopeA, 'a', 'b:c', 'x', 60));
  });

  // ── search ──
  add('search', 'B\'s query for A\'s words returns nothing, even with A\'s person token', async () => {
    await s.search.index({ id: 'doc-1', tenantId: scopeA.tenantId, kind: 'note', classification: 'student_private', title: 'Zebra migration', excerpt: 'notes', acl: [`person:${s.a.actor.personId}`] });
    const own = await s.search.query(scopeFor(s.a, []), 'zebra', 10);
    must('search', own.length === 1, 'control: A cannot find its own document');
    must('search', (await s.search.query(scopeFor(s.b, []), 'zebra', 10)).length === 0, 'B found A\'s document');
    must('search', (await s.search.query(scopeFor(s.b, [`person:${s.a.actor.personId}`]), 'zebra', 10)).length === 0, 'B found A\'s document using A\'s ACL token');
  });
  add('search', 'removing a document in B does not remove A\'s document with the same id', async () => {
    await s.search.index({ id: 'doc-2', tenantId: scopeA.tenantId, kind: 'note', classification: 'internal', title: 'Quokka', excerpt: '', acl: ['public'] });
    await s.search.remove(scopeB.tenantId, 'doc-2');
    must('search', (await s.search.query(scopeFor(s.a, []), 'quokka', 10)).length === 1, 'A\'s document was removed by B');
  });

  // ── analytics ──
  add('analytics', 'B reads none of A\'s events; the same person is a different subject in each tenant', async () => {
    await s.analytics.track(s.a, 'feature_used', { feature: 'study' });
    await s.analytics.track(s.b, 'feature_used', { feature: 'study' });
    const ra = await s.analytics.read(scopeA, 'feature_used');
    const rb = await s.analytics.read(scopeB, 'feature_used');
    must('analytics', ra.length >= 1 && rb.length >= 1, 'control: a tenant cannot read its own events');
    must('analytics', ra.every((e) => e.tenantId === scopeA.tenantId) && rb.every((e) => e.tenantId === scopeB.tenantId), 'events crossed tenants');
    must('analytics', ra[0].subject !== rb[0].subject, 'one person is the same pseudonym in two tenants — a cross-tenant join key');
    must('analytics', !JSON.stringify(ra).includes(s.a.actor.personId), 'a raw person id reached the warehouse');
  });
  add('analytics', 'free text and personal fields are redacted before they are stored', async () => {
    await s.analytics.track(s.a, 'search_run', { query_note: 'ok', note: 'a very private sentence', email: 'a@b.edu' });
    const stored = JSON.stringify(await s.analytics.read(scopeA, 'search_run'));
    must('analytics', !stored.includes('a very private sentence') && !stored.includes('a@b.edu'), 'free text or an email was stored');
  });

  // ── support tools ──
  const supportConsent = (ctx: RequestContext, over: Partial<ConsentRecord> = {}): ConsentRecord => ({
    id: 'consent-1', tenantId: ctx.tenantId, subjectPersonId: 'student-1', grantedByPersonId: 'student-1', granteePersonId: ctx.actor.personId,
    purpose: 'support_access', scopes: ['profile.read'], resourceIds: ['student-1'], evidence: 'in_app_confirmation', policyVersion: 'v1', ticketId: 'T-1',
    grantedAt: new Date(s.clock.now().getTime() - 60_000).toISOString(), expiresAt: new Date(s.clock.now().getTime() + 3_600_000).toISOString(), ...over,
  });
  const read = { ticketId: 'T-1', scope: 'profile.read', resource: { type: 'profile', id: 'student-1' } };
  add('support_tools', 'a support read needs a live, ticket-bound, same-tenant consent — and is audited either way', async () => {
    const deps = { audit: s.audit, clock: s.clock };
    const before = (await s.audit.read(s.a.tenantId)).length;
    must('support_tools', (await supportRead(deps, s.a, [supportConsent(s.a)], read, async () => 'ok')) === 'ok', 'control: a valid consent was refused');
    await refused('support_tools', 'a read with no consent', () => supportRead(deps, s.a, [], read, async () => 'x'));
    await refused('support_tools', 'a read on a consent from the other tenant', () => supportRead(deps, s.a, [supportConsent(s.b)], read, async () => 'x'));
    await refused('support_tools', 'a read for a different ticket', () => supportRead(deps, s.a, [supportConsent(s.a)], { ...read, ticketId: 'T-2' }, async () => 'x'));
    await refused('support_tools', 'a read outside the consented scope', () => supportRead(deps, s.a, [supportConsent(s.a)], { ...read, scope: 'grades.read' }, async () => 'x'));
    await refused('support_tools', 'a read on a withdrawn consent', () => supportRead(deps, s.a, [supportConsent(s.a, { withdrawnAt: s.clock.now().toISOString() })], read, async () => 'x'));
    await refused('support_tools', 'a read on an expired consent', () => supportRead(deps, s.a, [supportConsent(s.a, { expiresAt: new Date(s.clock.now().getTime() - 1).toISOString() })], read, async () => 'x'));
    const after = await s.audit.read(s.a.tenantId);
    must('support_tools', after.length - before === 7, `expected 7 audit rows (1 allowed + 6 denied), found ${after.length - before}`);
    must('support_tools', after.slice(before).filter((r) => r.decision === 'allowed').length === 1, 'the wrong number of reads were audited as allowed');
  });
  add('support_tools', 'the fetcher is given the actor\'s tenant scope and no other', async () => {
    let seen = '';
    await supportRead({ audit: s.audit, clock: s.clock }, s.a, [supportConsent(s.a)], read, async (scope) => (seen = scope.tenantId));
    must('support_tools', seen === s.a.tenantId, 'the support fetcher was handed another tenant\'s scope');
  });

  // ── ai retrieval ──
  const aiConsent = (ctx: RequestContext, ids: string[], over: Partial<ConsentRecord> = {}): ConsentRecord => ({
    id: `ai-${ids.join('-')}`, tenantId: ctx.tenantId, subjectPersonId: ctx.actor.personId, grantedByPersonId: ctx.actor.personId, granteePersonId: ctx.actor.personId,
    purpose: 'ai_context', scopes: ['ai.retrieve'], resourceIds: ids, evidence: 'in_app_confirmation', policyVersion: 'v1',
    grantedAt: new Date(s.clock.now().getTime() - 60_000).toISOString(), expiresAt: new Date(s.clock.now().getTime() + 3_600_000).toISOString(), ...over,
  });
  // The AI is the actor "on behalf of" the student; for retrieval the student consents to their own sources.
  const selfAi = (ctx: RequestContext, ids: string[], over: Partial<ConsentRecord> = {}) => ({ ...aiConsent(ctx, ids, over), subjectPersonId: 'student-self' });
  add('ai_retrieval', 'retrieval returns only consented, same-tenant sources, with provenance', async () => {
    await s.search.index({ id: 'ai-a-1', tenantId: scopeA.tenantId, kind: 'course_note', classification: 'student_private', title: 'Photosynthesis notes', excerpt: 'light reactions', acl: [`person:${s.a.actor.personId}`] });
    await s.search.index({ id: 'ai-b-1', tenantId: scopeB.tenantId, kind: 'course_note', classification: 'student_private', title: 'Photosynthesis notes', excerpt: 'light reactions', acl: [`person:${s.b.actor.personId}`] });
    const got = await retrieveForAi(s.search, s.a, [], [selfAi(s.a, ['ai-a-1'])], s.clock, 'photosynthesis');
    must('ai_retrieval', got.length === 1 && got[0].id === 'ai-a-1' && got[0].provenance.sourceId === 'ai-a-1', 'control: the consented own source was not retrieved with provenance');
    must('ai_retrieval', (await retrieveForAi(s.search, s.a, [], [selfAi(s.a, ['ai-b-1'])], s.clock, 'photosynthesis')).length === 0, 'retrieval returned the other tenant\'s source');
    must('ai_retrieval', (await retrieveForAi(s.search, s.a, [], [selfAi(s.b, ['ai-a-1'])], s.clock, 'photosynthesis')).length === 0, 'a consent from the other tenant opened a source');
  });
  add('ai_retrieval', 'an unconsented, withdrawn or expired source is not retrieved; education records need consent too', async () => {
    await s.search.index({ id: 'ai-rec-1', tenantId: scopeA.tenantId, kind: 'grade', classification: 'education_record', title: 'Chemistry grade', excerpt: 'B+', acl: [`person:${s.a.actor.personId}`] });
    await s.search.index({ id: 'ai-a-2', tenantId: scopeA.tenantId, kind: 'course_note', classification: 'student_private', title: 'Chemistry notes', excerpt: 'moles', acl: [`person:${s.a.actor.personId}`] });
    const q = (consents: ConsentRecord[]) => retrieveForAi(s.search, s.a, [], consents, s.clock, 'chemistry');
    must('ai_retrieval', (await q([])).length === 0, 'retrieval without any consent returned passages');
    must('ai_retrieval', (await q([selfAi(s.a, ['ai-a-2'], { withdrawnAt: s.clock.now().toISOString() })])).length === 0, 'a withdrawn consent still opened a source');
    must('ai_retrieval', (await q([selfAi(s.a, ['ai-a-2'], { expiresAt: new Date(s.clock.now().getTime() - 1).toISOString() })])).length === 0, 'an expired consent still opened a source');
    must('ai_retrieval', (await q([selfAi(s.a, ['ai-a-2'])])).map((p) => p.id).join() === 'ai-a-2', 'control: the consented note was not retrieved');
    must('ai_retrieval', (await q([selfAi(s.a, ['ai-a-2', 'ai-rec-1'])])).some((p) => p.id === 'ai-rec-1'), 'a record the student consented to was not retrieved');
  });

  return cases;
}
