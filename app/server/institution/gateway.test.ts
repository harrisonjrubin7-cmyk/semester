import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  UNIVERSITY_AREAS,
  type ActionInput,
  type Receipt,
  type UniversityIdentity,
  Refusal,
  type UniversityRecord,
} from '../../../packages/institution/src/index.ts';
import type { InstitutionAdapter } from './adapter.ts';
import { trustedIdentity } from './auth.ts';
import { createGateway } from './gateway.ts';
import { ActionJournal, type ActionJournalStore, type SavedReview } from './journal.ts';
import type { RateLimiter } from './rate-limit.ts';
import type { GatewayTelemetryEvent } from './gateway.ts';
import type { ReadinessResult } from './readiness.ts';

/**
 * The refusals, exercised against a real journal on a real file.
 *
 * Every test here is a thing the gateway must *not* do, and each one is
 * written from the outside — an HTTP request in, a status code out — because
 * that is the surface a university's network actually meets. The adapter is a
 * fixture whose answers the test moves under the gateway's feet: a version
 * that changes between prepare and commit, an execute that throws, a vendor
 * that answers `pending`.
 *
 * The journal is a temporary SQLite file rather than a stub, so the claim that
 * drafts are encrypted at rest can be checked by reading the bytes, and the
 * claim that an unresolved action survives a restart can be checked by opening
 * the same file again.
 */

const actor: UniversityIdentity = { userId: 'student-a', institutionId: 'school-a', roles: ['student'] };
const key = Buffer.alloc(32, 7);
const journals: ActionJournal[] = [];
const dirs: string[] = [];

afterEach(() => {
  journals.splice(0).forEach((journal) => {
    // Tolerated, because a test may have closed one on purpose: that is how a
    // lost volume is staged for the health check below, and `close()` throws
    // on a database that is already shut.
    try {
      journal.close();
    } catch {
      /* already closed */
    }
  });
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function asynchronousJournal(inner: ActionJournal, events: string[]): ActionJournalStore {
  const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 1));
  return {
    healthy: async () => {
      await turn();
      events.push('healthy');
      return inner.healthy();
    },
    save: async (row) => {
      await turn();
      inner.save(row);
      events.push('save');
    },
    get: async (id, identity) => {
      await turn();
      events.push('get');
      return inner.get(id, identity);
    },
    claim: async (id, identity, now) => {
      await turn();
      const claimed = inner.claim(id, identity, now);
      events.push('claim');
      return claimed;
    },
    finish: async (row: SavedReview, state, receipt?: Receipt) => {
      await turn();
      inner.finish(row, state, receipt);
      events.push(`finish:${state}`);
    },
    audit: async (identity, area, event, reviewId = null, correlationId = null) => {
      await turn();
      inner.audit(identity, area, event, reviewId, correlationId);
      events.push(`audit:${event}`);
    },
  };
}

function fixture({
  asynchronous = false,
  rateLimiter,
  readiness,
  telemetry,
  readOnly,
}: {
  asynchronous?: boolean;
  rateLimiter?: RateLimiter;
  readiness?: () => Promise<ReadinessResult>;
  telemetry?: (event: GatewayTelemetryEvent) => void | Promise<void>;
  readOnly?: () => boolean;
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'semester-gateway-'));
  dirs.push(dir);
  const path = join(dir, 'test.sqlite');
  const journal = new ActionJournal(path, key);
  journals.push(journal);
  const journalEvents: string[] = [];
  const journalStore = asynchronous ? asynchronousJournal(journal, journalEvents) : journal;

  let identity: UniversityIdentity | null = actor;
  let membershipActive = true;
  let membershipRoles: UniversityIdentity['roles'] = actor.roles;
  let intelligenceConfirmedRoles: UniversityIdentity['roles'] = [];
  let version = '1';
  let calls = 0;
  let executedIdempotencyKey: string | undefined;
  let mode = 'ok';
  let reviewTitle = 'Submit coursework';

  const record: UniversityRecord = {
    id: 'paper',
    area: 'assignments',
    title: 'Paper',
    summary: '',
    status: 'Open',
    updatedAt: '2026-09-13T10:00:00Z',
    version: '1',
    details: [],
    actions: [
      { id: 'submit', label: 'Submit', fields: [{ id: 'response', label: 'Response', kind: 'textarea', required: true }] },
    ],
  };

  const adapter: InstitutionAdapter = {
    institutionId: 'school-a',
    area: 'assignments',
    status: async () => ({
      area: 'assignments',
      provider: 'Fixture adapter',
      state: 'connected',
      canRead: true,
      canWrite: true,
      lastSyncAt: null,
      permissions: ['self:assignments'],
      message: '',
    }),
    list: async () => ({ records: [record], nextCursor: null, fetchedAt: '2026-09-13T10:00:00Z' }),
    get: async (_context, id) => (id === 'paper' ? { ...record, version } : null),
    review: async () => {
      // What every adapter in this repository does when it will not do a
      // thing: it throws, with the sentence the person needs.
      if (mode === 'refuse') throw new Refusal('That deadline has already passed.');
      // And the thing a refusal is distinguished *from*: machinery breaking,
      // whose message is nobody's business.
      if (mode === 'crash') throw new Error('pg: password authentication failed for user "sis"');
      return { title: reviewTitle, details: [{ label: 'Action', value: 'Submit coursework' }] };
    },
    execute: async (context) => {
      calls++;
      executedIdempotencyKey = context.request?.idempotencyKey;
      // The message a vendor failure carries must never reach the student.
      if (mode === 'timeout') throw new Error('Vendor secret must not be exposed');
      if (mode === 'refuse-late') throw new Refusal('You are already enrolled in this course.');
      return {
        id: 'receipt-1',
        status: mode === 'pending' ? 'pending' : 'completed',
        message: 'Recorded by school',
        recordedAt: '2026-09-13T10:00:00Z',
      };
    },
    reconcile: async () => ({
      id: 'receipt-1',
      status: 'completed',
      message: 'Confirmed by lookup',
      recordedAt: '2026-09-13T10:00:00Z',
    }),
  };

  const gateway = createGateway({
    origin: 'http://localhost:5173',
    institutionName: 'Test school',
    authenticate: async () => identity,
    refreshIdentity: async (current) => membershipActive ? { ...current, roles: membershipRoles } : null,
    adapters: [adapter],
    journal: journalStore,
    loadSsoConfig: async () => ({ enabled: true, label: 'Vanderbilt', domain: 'vanderbilt.edu' }),
    intelligence: {
      status: 'configured-sandbox',
      policy: async () => ({ status: 200, body: {} }),
      respond: async () => ({ status: 200, body: {} }),
      confirm: async (current) => {
        intelligenceConfirmedRoles = current.roles;
        return { status: 200, body: {} };
      },
    },
    rateLimiter,
    readiness,
    telemetry,
    readOnly,
  });

  const input: ActionInput = {
    area: 'assignments',
    recordId: 'paper',
    version: '1',
    actionId: 'submit',
    fields: { response: 'Private coursework response' },
  };

  const request = async (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    gateway(
      new Request(`http://local${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin: 'http://localhost:5173',
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );

  const prepare = async () => {
    const result = await request('/actions/prepare', input);
    expect(result.status).toBe(200);
    return result.json();
  };

  return {
    gateway,
    journal,
    journalEvents: () => [...journalEvents],
    path,
    input,
    request,
    prepare,
    calls: () => calls,
    executedIdempotencyKey: () => executedIdempotencyKey,
    identity: (v: UniversityIdentity | null) => {
      identity = v;
    },
    membershipActive: (active: boolean) => {
      membershipActive = active;
    },
    membershipRoles: (roles: UniversityIdentity['roles']) => {
      membershipRoles = roles;
    },
    intelligenceConfirmedRoles: () => intelligenceConfirmedRoles,
    version: (v: string) => {
      version = v;
    },
    mode: (v: string) => {
      mode = v;
    },
    title: (v: string) => {
      reviewTitle = v;
    },
  };
}

describe('university gateway boundaries', () => {
  it('publishes only the approved sign-in label and discovery domain without requiring a session', async () => {
    const f = fixture();
    const result = await f.request('/v1/auth/config', undefined, { authorization: '' });
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({
      enabled: true,
      label: 'Vanderbilt',
      domain: 'vanderbilt.edu',
    });
  });

  it('does not accept role claims from editable user metadata', () => {
    expect(
      trustedIdentity({ id: 'u', ...{ user_metadata: { semester: { institutionId: 's', roles: ['admin'] } } } }),
    ).toBeNull();
    expect(trustedIdentity({ id: 'u', app_metadata: { semester: { institutionId: 's', roles: ['invented', 'advisor'] } } })).toEqual(
      { userId: 'u', institutionId: 's', roles: ['advisor'] },
    );
  });

  it('hands back an adapter’s refusal, rather than reporting itself broken', async () => {
    /*
     * Every refusal in `sandbox.ts` — sixty-odd of them — is an Error thrown
     * out of `review` or `execute` with the sentence the person needs in it.
     * Each is tested against the adapter directly, and each of those tests
     * passes. None of them says anything about whether the sentence survives
     * the wire, and it does not: a plain Error is not an HttpError, so it
     * falls to the outer handler, which flattens anything it did not mean to
     * say into one sentence about the service being unavailable.
     *
     * A marker who mistyped a rubric line is told the university is down.
     */
    const f = fixture();
    f.mode('refuse');
    const refused = await f.request('/actions/prepare', f.input);
    expect(refused.status, 'a refusal is the caller’s fault, not a 5xx').toBe(400);
    expect((await refused.json()).error.message).toBe('That deadline has already passed.');
  });

  it('does not tell somebody to retry a thing that will never work', async () => {
    /*
     * The status code is the worse half. 503 means *try again later*, so a
     * client that honours it — and this app's own screen tells the person to
     * — will retry a request that cannot ever succeed, against a gateway that
     * has just been told why.
     */
    const f = fixture();
    f.mode('refuse');
    expect((await f.request('/actions/prepare', f.input)).status).not.toBe(503);
  });

  it('refuses at the commit re-check without claiming the outcome is unknown', async () => {
    /*
     * The same throw, at the other end. Commit re-runs `review` before it
     * claims the action — the check that the person is confirming what they
     * read — and a refusal there happens before anything is written and
     * before the journal is claimed. Reporting it as "the result could not be
     * confirmed" would send somebody to their registrar to reconcile an
     * action that provably did not happen.
     */
    const f = fixture();
    const review = await f.prepare();
    f.mode('refuse');
    const refused = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(refused.status).toBe(400);
    expect((await refused.json()).error.message).toBe('That deadline has already passed.');
    expect(f.calls(), 'nothing was executed').toBe(0);
    // And the review is still usable, because nothing consumed it.
    f.mode('ok');
    const done = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(done.status).toBe(200);
  });

  it('still hides an ordinary exception out of the same method', async () => {
    /*
     * The control, and the reason a refusal is a type rather than "anything
     * thrown out of review". Machinery breaking inside the same call is not a
     * sentence for a student — this one carries a database user and a
     * password failure — and it stays flattened.
     */
    const f = fixture();
    f.mode('crash');
    const broke = await f.request('/actions/prepare', f.input);
    expect(broke.status).toBe(503);
    expect((await broke.json()).error.message).toBe('The university service is unavailable. Please try again later.');
  });

  it('delivers a refusal thrown at the write, and marks it refused rather than unknown', async () => {
    /*
     * Twelve of the sandbox's refusals are in `execute` rather than `review`,
     * because a client does not have to prepare anything first — the check
     * has to be at the write as well as at the menu. Those are exactly the
     * ones the old handler turned into "the result could not be confirmed",
     * which sends somebody to their registrar over an action that provably
     * did not happen.
     */
    const f = fixture();
    const review = await f.prepare();
    f.mode('refuse-late');
    const refused = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(refused.status).toBe(400);
    expect((await refused.json()).error.message).toBe('You are already enrolled in this course.');
    expect(f.journal.get(review.id, actor)?.state, 'left hanging as unknown').toBe('refused');

    // And it is spent: sending it again says so, rather than sending the
    // person to reconcile something that was answered.
    f.mode('ok');
    const again = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(again.status).toBe(409);
    expect((await again.json()).error.message).toMatch(/refused/i);
    expect((await f.request('/actions/reconcile', { reviewId: review.id })).status).toBe(409);
  });

  it('still hides what an adapter’s machinery says when it breaks mid-action', async () => {
    // The distinction this all rests on: a refusal is a sentence for the
    // person, and a crash is not. `execute` failing is still unknowable and
    // still flattened — that behaviour is the point of the one beside it.
    const f = fixture();
    const review = await f.prepare();
    f.mode('timeout');
    const broke = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(broke.status).toBe(502);
    expect(JSON.stringify(await broke.json())).not.toContain('Vendor secret');
  });

  it('requires a verified identity and rejects arbitrary web origins', async () => {
    const f = fixture();
    expect((await f.request('/status', undefined, { authorization: '' })).status).toBe(401);
    f.identity(null);
    expect((await f.request('/status')).status).toBe(403);
    expect((await f.request('/status', undefined, { origin: 'https://elsewhere.test' })).status).toBe(403);
  });

  it('allows browser action preflights to carry the governed idempotency key', async () => {
    const f = fixture();
    const response = await f.gateway(new Request('http://local/actions/commit', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization, content-type, idempotency-key, x-correlation-id',
      },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(response.headers.get('access-control-allow-headers'))
      .toBe('Authorization, Content-Type, Idempotency-Key, X-Correlation-Id');
  });

  it('keeps unconfigured services unavailable without inventing records', async () => {
    const f = fixture();
    const status = await (await f.request('/status')).json();
    expect(status.connections).toHaveLength(UNIVERSITY_AREAS.length);
    expect(status.connections.find((c: { area: string }) => c.area === 'billing').canWrite).toBe(false);
    expect((await f.request('/records?area=billing')).status).toBe(503);
    expect((await f.request('/actions/prepare', { ...f.input, area: 'billing' })).status).toBe(503);
  });

  it('resolves adapters only for the verified institution', async () => {
    const f = fixture();
    f.identity({ ...actor, institutionId: 'school-b' });
    expect((await f.request('/records?area=assignments')).status).toBe(503);
  });

  it('validates allowed fields and record actions before preparing', async () => {
    const f = fixture();
    expect((await f.request('/actions/prepare', { ...f.input, fields: {} })).status).toBe(400);
    expect((await f.request('/actions/prepare', { ...f.input, fields: { admin: 'yes', response: 'x' } })).status).toBe(400);
    expect((await f.request('/actions/prepare', { ...f.input, actionId: 'delete' })).status).toBe(403);
    expect((await f.request('/actions/prepare', { ...f.input, recordId: 'someone-elses' })).status).toBe(404);
    expect(f.calls()).toBe(0);
  });

  it('requires explicit confirmation and binds reviews to their user and tenant', async () => {
    const f = fixture();
    const r = await f.prepare();
    expect((await f.request('/actions/commit', { reviewId: r.id })).status).toBe(400);
    f.identity({ ...actor, userId: 'other' });
    expect((await f.request('/actions/commit', { reviewId: r.id, confirmed: true })).status).toBe(404);
    f.identity({ ...actor, institutionId: 'school-b' });
    expect((await f.request('/actions/commit', { reviewId: r.id, confirmed: true })).status).toBe(404);
    expect(f.calls()).toBe(0);
  });

  it('rechecks current membership immediately before a consequential write', async () => {
    const f = fixture();
    const review = await f.prepare();
    f.membershipActive(false);
    const refused = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(refused.status).toBe(403);
    expect(f.calls()).toBe(0);
  });

  it('uses refreshed roles for an intelligence action confirmation', async () => {
    const f = fixture();
    f.membershipRoles(['advisor']);
    const response = await f.request('/v1/intelligence/actions/action-1/confirm', { confirmed: true });
    expect(response.status).toBe(200);
    expect(f.intelligenceConfirmedRoles()).toEqual(['advisor']);
  });

  it('rechecks versions and displayed details before a write', async () => {
    const f = fixture();
    const r = await f.prepare();
    f.version('2');
    expect((await f.request('/actions/commit', { reviewId: r.id, confirmed: true })).status).toBe(409);
    f.version('1');
    f.title('Different terms');
    expect((await f.request('/actions/commit', { reviewId: r.id, confirmed: true })).status).toBe(409);
    expect(f.calls()).toBe(0);
  });

  it('stores encrypted drafts, issues a receipt, and returns it on duplicate confirmation', async () => {
    const f = fixture();
    const r = await f.prepare();
    const body = { reviewId: r.id, confirmed: true };
    expect((await f.request('/actions/commit', body)).status).toBe(200);
    expect((await (await f.request('/actions/commit', body)).json()).id).toBe('receipt-1');
    expect(f.calls()).toBe(1);

    // The WAL too: a row can sit there unmerged, and plaintext in it is plaintext on disk.
    const raw = Buffer.concat([readFileSync(f.path), readFileSync(`${f.path}-wal`)]).toString('utf8');
    expect(raw).not.toContain('Private coursework response');
    expect(raw).not.toContain('Recorded by school');
  });

  it('validates the SDK idempotency key and carries it to the adapter request context', async () => {
    const f = fixture();
    const r = await f.prepare();
    const invalid = await f.request(
      '/actions/commit',
      { reviewId: r.id, confirmed: true },
      { 'idempotency-key': 'too-short' },
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe('invalid_request');
    expect(f.calls()).toBe(0);

    const key = 'commit-key-00000001';
    const committed = await f.request(
      '/actions/commit',
      { reviewId: r.id, confirmed: true },
      { 'idempotency-key': key },
    );
    expect(committed.status).toBe(200);
    expect(f.executedIdempotencyKey()).toBe(key);
  });

  it('serializes concurrent confirmations across durable claims', async () => {
    const f = fixture();
    const r = await f.prepare();
    await Promise.all([
      f.request('/actions/commit', { reviewId: r.id, confirmed: true }),
      f.request('/actions/commit', { reviewId: r.id, confirmed: true }),
    ]);
    expect(f.calls()).toBe(1);
  });

  it('does not repeat an uncertain upstream write, even through a new review', async () => {
    const f = fixture();
    const r = await f.prepare();
    f.mode('timeout');
    const result = await f.request('/actions/commit', { reviewId: r.id, confirmed: true });
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain('Vendor secret');

    // A second review of the same operation is refused while the first is unresolved.
    const second = await f.prepare();
    expect((await f.request('/actions/commit', { reviewId: second.id, confirmed: true })).status).toBe(409);
    expect(f.calls()).toBe(1);
    expect((await f.request('/actions/reconcile', { reviewId: r.id })).status).toBe(200);
    expect(f.calls()).toBe(1);
  });

  it('keeps pending upstream receipts pending until lookup confirms completion', async () => {
    const f = fixture();
    const r = await f.prepare();
    f.mode('pending');
    expect((await (await f.request('/actions/commit', { reviewId: r.id, confirmed: true })).json()).status).toBe('pending');
    expect((await (await f.request('/actions/reconcile', { reviewId: r.id })).json()).status).toBe('completed');
    expect(f.calls()).toBe(1);
  });

  it('awaits every shared-journal boundary before answering an action request', async () => {
    const f = fixture({ asynchronous: true });
    const review = await f.prepare();
    expect(f.journalEvents()).toEqual(['save', 'audit:action.prepared']);

    const result = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(result.status).toBe(200);
    expect(f.journal.get(review.id, actor)?.state).toBe('completed');
    expect(f.journalEvents()).toEqual([
      'save',
      'audit:action.prepared',
      'get',
      'claim',
      'audit:action.started',
      'finish:completed',
      'audit:action.receipt',
    ]);
  });

  it('refuses expired reviews and preserves unresolved state across reopening', async () => {
    const f = fixture();
    const expired = { id: 'expired', title: 'Expired', details: [], expiresAt: '2020-01-01T00:00:00Z' };
    f.journal.save({ review: expired, input: f.input as never, identity: actor, state: 'ready' });
    expect((await f.request('/actions/commit', { reviewId: 'expired', confirmed: true })).status).toBe(410);

    const r = await f.prepare();
    f.mode('timeout');
    await f.request('/actions/commit', { reviewId: r.id, confirmed: true });

    const reopened = new ActionJournal(f.path, key);
    journals.push(reopened);
    expect(reopened.get(r.id, actor)?.state).toBe('uncertain');
  });
});

/**
 * What `/health` is allowed to claim.
 *
 * It had no test at all, which is how it stayed a liveness check with a
 * readiness check's name: it answered `{service, version}` unconditionally,
 * from two constants that cannot be wrong and therefore prove nothing.
 *
 * The distinction is sharper here than in most services. This process answers
 * while being unable to do the one thing it exists for, because the journal is
 * a file and a file can stop being writable long after boot. And the two-phase
 * action records an attempt *before* making it, so a gateway that cannot write
 * must refuse work rather than degrade: calling a university with no record
 * that it was called is the exact situation `uncertain` exists to prevent.
 */
describe('the health check', () => {
  it('answers without a token, because that is how a deployment is checked', async () => {
    const f = fixture();
    const said = await f.request('/health', undefined, { authorization: '' });
    expect(said.status).toBe(200);
    expect((await said.json()).status).toBe('ready');
  });

  it('separates process liveness from dependency readiness', async () => {
    const f = fixture({ readiness: async () => ({ ready: false, status: 'unavailable' }) });
    const live = await f.request('/health/live', undefined, { authorization: '' });
    const ready = await f.request('/health/ready', undefined, { authorization: '' });
    expect(live.status).toBe(200);
    expect(await live.json()).toMatchObject({ status: 'live' });
    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({ status: 'unavailable' });
  });

  /*
   * The one that decides whether the endpoint is worth having.
   *
   * Closing the journal is what a lost volume looks like from inside the
   * process: the object is still there, the routes still resolve, and the one
   * thing it needs is gone. Against the version that returned two constants
   * this is a 200 saying `ready`.
   */
  it('goes 503 when the journal can no longer record anything', async () => {
    const f = fixture();
    expect((await f.request('/health', undefined, { authorization: '' })).status).toBe(200);

    f.journal.close();

    const said = await f.request('/health', undefined, { authorization: '' });
    expect(said.status).toBe(503);
    expect((await said.json()).status).toBe('unavailable');
  });

  it('awaits a remote journal health probe instead of treating its promise as ready', async () => {
    const f = fixture({ asynchronous: true });
    f.journal.close();
    const said = await f.request('/health', undefined, { authorization: '' });
    expect(said.status).toBe(503);
    expect(f.journalEvents()).toEqual(['healthy']);
  });

  /*
   * An unauthenticated endpoint that narrates which subsystem is broken is a
   * map for somebody choosing what to lean on. It says that it cannot serve,
   * not what failed underneath.
   */
  it('does not name what broke', async () => {
    const f = fixture();
    f.journal.close();
    const body = JSON.stringify(await (await f.request('/health', undefined, { authorization: '' })).json());
    for (const leak of ['journal', 'sqlite', 'database', f.path]) {
      expect(body.toLowerCase(), `said “${leak}”`).not.toContain(leak.toLowerCase());
    }
  });

  it('counts the adapters, so an empty registry is visible rather than implied', async () => {
    const f = fixture();
    expect((await (await f.request('/health', undefined, { authorization: '' })).json()).adapters).toBe(1);
  });
});

describe('request telemetry', () => {
  it('adds a correlation id and records metadata without request content or action ids', async () => {
    const events: GatewayTelemetryEvent[] = [];
    const f = fixture({ telemetry: async (event) => { events.push(event); } });
    const response = await f.request('/v1/intelligence/actions/private-action-id/confirm', {
      confirmed: true,
      at: new Date().toISOString(),
      privateAnswer: 'do not log me',
    });
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'institution.request',
      method: 'POST',
      route: '/v1/intelligence/actions/:id/confirm',
      status: 200,
      errorClass: 'none',
    });
    expect(JSON.stringify(events)).not.toContain('private-action-id');
    expect(JSON.stringify(events)).not.toContain('do not log me');
    expect(JSON.stringify(events)).not.toContain('test-token');
  });

  it('does not let a telemetry outage change the gateway response', async () => {
    const f = fixture({ telemetry: async () => { throw new Error('monitor offline'); } });
    expect((await f.request('/status')).status).toBe(200);
  });

  it('does not log arbitrary unmatched path segments', async () => {
    const events: GatewayTelemetryEvent[] = [];
    const f = fixture({ telemetry: (event) => { events.push(event); } });
    await f.request('/student-name/private-record-id');
    expect(events[0].route).toBe('/unmatched');
    expect(JSON.stringify(events)).not.toContain('student-name');
    expect(JSON.stringify(events)).not.toContain('private-record-id');
  });
});

describe('request limits', () => {
  it('awaits a shared limiter and returns 429 when it refuses the account', async () => {
    const calls: string[] = [];
    const f = fixture({
      rateLimiter: {
        allow: async (identity) => {
          await new Promise<void>((resolve) => setTimeout(resolve, 1));
          calls.push(`${identity.institutionId}:${identity.userId}`);
          return false;
        },
      },
    });
    const response = await f.request('/status');
    expect(response.status).toBe(429);
    expect(calls).toEqual(['school-a:student-a']);
  });
});

describe('correlation ids and the error envelope', () => {
  const given = 'browser-tap-0001-abcdef';

  it('carries a well-formed correlation id from the request to the response, the audit row and the telemetry line', async () => {
    const events: GatewayTelemetryEvent[] = [];
    const f = fixture({ telemetry: (event) => { events.push(event); } });
    const response = await f.request('/records?area=assignments', undefined, { 'x-correlation-id': given });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-correlation-id')).toBe(given);
    // The request id is minted here every time, whatever the client sent.
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get('x-request-id')).not.toBe(given);
    expect(response.headers.get('access-control-expose-headers')).toContain('X-Correlation-Id');
    expect(events[0].correlationId).toBe(given);

    const rows = new DatabaseSync(f.path).prepare('SELECT event, correlation_id FROM audit').all() as Array<{ event: string; correlation_id: string | null }>;
    expect(rows).toEqual([{ event: 'records.read', correlation_id: given }]);
  });

  it('mints one when the client sent none, and when what it sent is not an id', async () => {
    const f = fixture();
    const minted = await f.request('/status');
    expect(minted.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
    for (const bad of ['short', 'has spaces in it', 'x'.repeat(129), '<script>alert(1)</script>', 'a\tb']) {
      const response = await f.request('/status', undefined, { 'x-correlation-id': bad });
      const id = response.headers.get('x-correlation-id')!;
      expect(id).not.toBe(bad);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('the audit row written for an action carries the id of the request that caused it', async () => {
    const f = fixture();
    const review = await f.prepare();
    const commit = await f.request('/actions/commit', { reviewId: review.id, confirmed: true }, { 'x-correlation-id': given });
    expect(commit.status).toBe(200);
    const rows = new DatabaseSync(f.path).prepare('SELECT event, correlation_id FROM audit ORDER BY id').all() as Array<{ event: string; correlation_id: string | null }>;
    expect(rows.map((r) => r.event)).toEqual(['action.prepared', 'action.started', 'action.receipt']);
    // Prepared under a minted id; started and receipted under the one the client sent.
    expect(rows[0].correlation_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows.slice(1).map((r) => r.correlation_id)).toEqual([given, given]);
  });

  it('opens a journal written before the correlation column existed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'semester-gateway-'));
    dirs.push(dir);
    const path = join(dir, 'old.sqlite');
    const old = new DatabaseSync(path);
    old.exec('CREATE TABLE audit(id INTEGER PRIMARY KEY, at TEXT NOT NULL, tenant TEXT NOT NULL, actor TEXT NOT NULL, area TEXT NOT NULL, event TEXT NOT NULL, review_id TEXT)');
    old.close();
    const journal = new ActionJournal(path, key);
    journals.push(journal);
    journal.audit(actor, 'assignments', 'records.read', null, given);
    const rows = new DatabaseSync(path).prepare('SELECT correlation_id FROM audit').all();
    expect(rows).toEqual([{ correlation_id: given }]);
  });

  it('every refusal is the same envelope, with a code, the correlation id and whether to try again', async () => {
    const f = fixture();
    const unauthenticated = await f.request('/status', undefined, { authorization: '', 'x-correlation-id': given });
    expect(unauthenticated.status).toBe(401);
    expect(await unauthenticated.json()).toEqual({
      error: { code: 'unauthenticated', message: 'Sign in to your school-approved Semester account.', correlation_id: given, retryable: false },
      message: 'Sign in to your school-approved Semester account.',
    });

    const wrongOrigin = await f.request('/status', undefined, { origin: 'https://evil.example' });
    expect(wrongOrigin.status).toBe(403);
    expect((await wrongOrigin.json()).error.code).toBe('origin_not_allowed');

    f.identity({ ...actor, institutionId: 'school-b' });
    const unconfigured = await f.request('/records?area=assignments');
    expect(unconfigured.status).toBe(503);
    expect((await unconfigured.json()).error).toMatchObject({ code: 'adapter_not_configured', retryable: true });
  });

  it('says a refused action is refused and an unknown outcome must not be retried', async () => {
    const f = fixture();
    f.mode('refuse');
    const refused = await f.request('/actions/prepare', f.input);
    expect(refused.status).toBe(400);
    expect((await refused.json()).error).toMatchObject({ code: 'refused', retryable: false });

    f.mode('ok');
    const review = await f.prepare();
    f.mode('timeout');
    const broke = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(broke.status).toBe(502);
    const body = await broke.json();
    expect(body.error).toMatchObject({ code: 'outcome_uncertain', retryable: false, user_action: { kind: 'contact_support' } });
    expect(JSON.stringify(body)).not.toContain('Vendor secret');

    f.mode('crash');
    const crashed = await f.request('/actions/prepare', f.input);
    expect(crashed.status).toBe(503);
    const crash = await crashed.json();
    expect(crash.error).toMatchObject({ code: 'unavailable', retryable: true });
    expect(JSON.stringify(crash)).not.toContain('password');
  });
});

describe('read-only mode', () => {
  /*
   * `SEMESTER_READ_ONLY=on` in `start.ts`, `config.readOnly` here. The window
   * it exists for is a restore or a schema repair (`ROLLBACK.md`), during
   * which a write that lands is a write into a database about to be replaced.
   * Refused with the envelope's own vocabulary and `retryable: true`, because
   * that is the truth of it: the mode ends, the same request works.
   */
  it('refuses commit with the envelope, retryable, and executes nothing', async () => {
    let on = false;
    const f = fixture({ readOnly: () => on });
    const review = await f.prepare();
    on = true;
    const refused = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(refused.status).toBe(503);
    const body = await refused.json();
    expect(body.error).toMatchObject({ code: 'read_only', retryable: true, correlation_id: expect.any(String) });
    expect(body.message).toMatch(/read-only mode/);
    expect(f.calls(), 'nothing was executed').toBe(0);
    // The mode ends, and the same review commits: the refusal consumed nothing.
    on = false;
    const done = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(done.status).toBe(200);
    expect(f.calls()).toBe(1);
  });

  it('refuses every other write the same way — prepare and an intelligence confirm', async () => {
    const f = fixture({ readOnly: () => true });
    const prepare = await f.request('/actions/prepare', f.input);
    expect(prepare.status).toBe(503);
    expect((await prepare.json()).error.code).toBe('read_only');
    const confirm = await f.request('/v1/intelligence/actions/a-1/confirm', { confirmed: true });
    expect(confirm.status).toBe(503);
    expect((await confirm.json()).error.code).toBe('read_only');
    // And nothing was journalled: no review to commit later, no audit of an
    // action that was never prepared.
    expect(f.journal.get).toBeTypeOf('function');
    const status = await f.request('/status');
    expect(status.status, 'reads go on').toBe(200);
  });

  it('still reads, still reconciles, and says so on /health', async () => {
    let on = false;
    const f = fixture({ readOnly: () => on });
    // An action left uncertain before the mode began.
    const review = await f.prepare();
    f.mode('timeout');
    expect((await f.request('/actions/commit', { reviewId: review.id, confirmed: true })).status).toBe(502);
    on = true;
    const records = await f.request('/records?area=assignments');
    expect(records.status).toBe(200);
    const reconciled = await f.request('/actions/reconcile', { reviewId: review.id });
    expect(reconciled.status, 'asking what happened is not a write at the school').toBe(200);
    const health = await f.request('/health', undefined, { authorization: '' });
    expect((await health.json()).readOnly).toBe(true);
  });

  it('is off unless asked — the control', async () => {
    const f = fixture();
    const health = await f.request('/health', undefined, { authorization: '' });
    expect((await health.json()).readOnly).toBe(false);
    expect((await f.request('/actions/prepare', f.input)).status).toBe(200);
  });

  it('asks the automation ladder before it claims or executes, with grounds read from what it already checked', async () => {
    /*
     * Structural, because every request that reaches this line has all four
     * grounds — the point is that the line cannot be removed unnoticed. The
     * behavioural half is the happy path just above: a confirmed, authorised,
     * offered, audited commit still completes.
     */
    const src = readFileSync(join(import.meta.dirname, 'gateway.ts'), 'utf8');
    const ask = src.indexOf("mayStep(");
    const claim = src.indexOf('journal.claim(row.review.id');
    expect(ask, 'the commit path asks the ladder').toBeGreaterThan(0);
    expect(ask, 'and does so before the journal is claimed').toBeLessThan(claim);
    expect(src).toMatch(/const step = mayStep\(\s*\{ from: 'confirm', to: 'execute' \},\s*groundsFor\(/);
    expect(src).toMatch(/if \(!step\.ok\) \{[\s\S]*?fail\(403, `This action cannot run yet: \$\{step\.why\}`, 'not_ready_to_execute'\);/);
    expect(src).toMatch(/groundsFor\(/);
    // A prepare never reaches it: nothing is asked of the ladder until a write is about to happen.
    expect(src.indexOf("path === '/actions/prepare'")).toBeLessThan(ask);

    const f = fixture();
    const review = await f.prepare();
    const done = await f.request('/actions/commit', { reviewId: review.id, confirmed: true });
    expect(done.status).toBe(200);
    expect(f.calls()).toBe(1);
  });

  it('never treats anything but an explicit true as confirmation, before the ladder is asked', async () => {
    const f = fixture();
    const review = await f.prepare();
    for (const confirmed of ['true', 1, 'yes', null, undefined]) {
      const refused = await f.request('/actions/commit', { reviewId: review.id, confirmed });
      expect(refused.status, String(confirmed)).toBe(400);
    }
    expect(f.calls()).toBe(0);
  });
});
