import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  UNIVERSITY_AREAS,
  SCIM_GROUP_SCHEMA,
  SCIM_PATCH_SCHEMA,
  SCIM_USER_SCHEMA,
  type ProvisioningResult,
  type ScimFilter,
  type ScimUser,
  type UniversityIdentity,
} from '../../../../packages/institution/src/index.ts';
import { EVENT_TYPES, MemoryOutbox, MemoryReceiptLedger, makeEvent } from '../../../../packages/institution/src/events.ts';
import { createGateway } from '../../../server/institution/gateway.ts';
import { ActionJournal } from '../../../server/institution/journal.ts';
import { MemoryRateLimiter, type RateLimiter } from '../../../server/institution/rate-limit.ts';
import { GatewayError, createClient, type Transport } from '../../../../examples/gateway-client/client.ts';
import {
  GROUP_SCHEMA,
  PATCH_SCHEMA,
  ScimClientError,
  USER_SCHEMA,
  createScimClient,
} from '../../../../examples/scim-provisioner/provisioner.ts';
import { createConsumer, gradeNotifier, publishToConsumers } from '../../../../examples/event-consumer/consumer.ts';
import { FakeSis } from '../../../../examples/sis-adapter/fake-sis.ts';
import { TOPICS, advisingAdapter } from '../../../../examples/sis-adapter/adapter.ts';
import { SEATS } from '../launchreadiness';

/**
 * The reference applications in `examples/`, run, and the guides that quote them, held.
 *
 * Each example is executed in this file against the real code it talks to:
 * the real `createGateway` with a real (in-memory) journal, the real
 * `createScimService`, the real `drainOutbox` and `processOnce`. No network,
 * no port: a client's transport is a function from `Request` to `Response`.
 *
 * The guides under `docs/guides/integrations/` quote the examples. A quoted
 * block carries a marker naming its source, and must appear in that file byte
 * for byte; a block marked `output` must equal what the scenario below
 * prints. A guide that drifts from the code fails here, naming the block.
 *
 * Imports are scanned too. An example may import `node:` builtins and
 * `packages/institution/src`, and nothing else, so it can be copied out of the
 * repository without dragging the application along.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const SELF = 'app/src/lib/docs/examples.test.ts';

// ── The world every gateway scenario runs in ─────────────────────────────

const NOW = new Date('2026-10-04T12:00:00Z');
const identity = (userId: string): UniversityIdentity => ({ userId, institutionId: 'school-a', roles: ['student'] });
const TOKENS: Record<string, UniversityIdentity> = {
  'token-a': identity('student-a'),
  'token-b': identity('student-b'),
  'token-unlinked': identity('student-x'), // authenticated, but the SIS has never heard of them
};
const journals: ActionJournal[] = [];
afterEach(() => {
  journals.splice(0).forEach((j) => j.close());
});

interface WorldOptions {
  rateLimiter?: RateLimiter;
  readOnly?: () => boolean;
  /** Replace parts of the adapter, to stage a failure the SIS fake cannot produce. */
  wrap?: (adapter: ReturnType<typeof advisingAdapter>) => ReturnType<typeof advisingAdapter>;
}

function world(options: WorldOptions = {}) {
  const sis = new FakeSis();
  sis.students.set('student-a', { hold: false });
  sis.students.set('student-b', { hold: false });
  sis.slots.push(
    { id: 'slot-1', advisor: 'Dr. Rivera', startsAt: '2026-10-12T14:00:00Z', revision: 1, bookedBy: null },
    { id: 'slot-2', advisor: 'Dr. Rivera', startsAt: '2026-10-12T15:00:00Z', revision: 1, bookedBy: null },
    { id: 'slot-3', advisor: 'Dr. Okafor', startsAt: '2026-10-13T09:00:00Z', revision: 1, bookedBy: null },
  );
  const base = advisingAdapter(sis, 'school-a', () => NOW);
  const adapter = options.wrap ? options.wrap(base) : base;
  const journal = new ActionJournal(':memory:', Buffer.alloc(32, 7));
  journals.push(journal);
  const gateway = createGateway({
    origin: 'http://localhost:5173',
    institutionName: 'Example University',
    authenticate: async (token) => TOKENS[token] ?? null,
    adapters: [adapter],
    journal,
    ...(options.rateLimiter ? { rateLimiter: options.rateLimiter } : {}),
    ...(options.readOnly ? { readOnly: options.readOnly } : {}),
  });
  const wire: { request: Request; response: Response }[] = [];
  const transport: Transport = async (request) => {
    const response = await gateway(request.clone());
    wire.push({ request, response: response.clone() });
    return response;
  };
  const sleeps: number[] = [];
  const client = (token = 'token-a', extra: { transport?: Transport; maxAttempts?: number } = {}) =>
    createClient({
      baseUrl: 'http://gateway.example',
      token: () => token,
      transport: extra.transport ?? transport,
      sleep: async (ms) => void sleeps.push(ms),
      ...(extra.maxAttempts ? { maxAttempts: extra.maxAttempts } : {}),
    });
  const book = (slotId = 'slot-1', version = '1') => ({
    area: 'advising' as const,
    recordId: slotId,
    version,
    actionId: 'book',
    fields: { topic: TOPICS[0] },
  });
  return { sis, gateway, journal, transport, wire, sleeps, client, book };
}

const caught = async (promise: Promise<unknown>): Promise<GatewayError> => {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(GatewayError);
    return e as GatewayError;
  }
  throw new Error('expected a GatewayError, but the call succeeded');
};

// ── Example 1: the gateway client ────────────────────────────────────────

describe('examples/gateway-client', () => {
  it('reads /status with a bearer token and a correlation id, and the gateway echoes the id', async () => {
    const w = world();
    const status = await w.client().status('demo-correlation-1');
    expect(status.institutionName).toBe('Example University');
    expect(status.connections.find((c) => c.area === 'advising')).toMatchObject({ state: 'connected', canWrite: true });
    // The other thirty-six areas have no adapter installed.
    expect(status.connections.filter((c) => c.state === 'not-configured')).toHaveLength(status.connections.length - 1);
    const { request, response } = w.wire[0];
    expect(request.headers.get('authorization')).toBe('Bearer token-a');
    expect(request.headers.get('x-correlation-id')).toBe('demo-correlation-1');
    expect(response.headers.get('x-correlation-id')).toBe('demo-correlation-1');
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/); // minted by the gateway, never by the client
  });

  it('turns a missing or unknown token into the envelope, with no retry', async () => {
    const w = world();
    const unknown = await caught(w.client('nobody').status());
    expect([unknown.status, unknown.code, unknown.retryable]).toEqual([403, 'forbidden', false]);
    const missing = await caught(w.client('').status());
    expect([missing.status, missing.code, missing.retryable]).toEqual([401, 'unauthenticated', false]);
    expect(w.wire).toHaveLength(2); // one request each: a non-retryable refusal is never repeated
  });

  it('follows nextCursor across record pages', async () => {
    const w = world();
    const first = await w.client().records('advising');
    expect(first.records.map((r) => r.id)).toEqual(['slot-1', 'slot-2']);
    expect(first.nextCursor).toBe('2');
    const all: string[] = [];
    for await (const record of w.client().allRecords('advising')) all.push(record.id);
    expect(all).toEqual(['slot-1', 'slot-2', 'slot-3']);
    const found: string[] = [];
    for await (const record of w.client().allRecords('advising', 'okafor')) found.push(record.id);
    expect(found).toEqual(['slot-3']);
  });

  it('runs prepare, review, commit and returns the receipt; declining writes nothing', async () => {
    const w = world();
    const seen: string[][] = [];
    const done = await w.client().runAction(w.book(), async (review) => {
      seen.push(review.details.map((d) => `${d.label}: ${d.value}`));
      return true;
    });
    expect(seen).toEqual([['Advisor: Dr. Rivera', 'Starts: 2026-10-12T14:00:00Z', 'Topic: Course planning']]);
    expect(done).toMatchObject({ state: 'done', reconciled: false, receipt: { id: 'bk-1', status: 'completed' } });
    expect(w.sis.bookings).toHaveLength(1);

    const declined = await w.client().runAction(w.book('slot-2'), async () => false);
    expect(declined.state).toBe('declined');
    expect(w.sis.bookings, 'a review that is not confirmed changes nothing').toHaveLength(1);
    expect(w.sis.slots[1].bookedBy).toBeNull();
  });

  it('shares one correlation id across prepare and commit, and commit is safe to repeat', async () => {
    const w = world();
    const client = w.client();
    const review = await client.prepare(w.book(), 'demo-correlation-2');
    const first = await client.commit(review.id, 'demo-correlation-2');
    const again = await client.commit(review.id, 'demo-correlation-2'); // e.g. the answer was lost on the way back
    expect(again).toEqual(first);
    expect(w.sis.bookings, 'the second commit returned the stored receipt and executed nothing').toHaveLength(1);
    const ids = w.wire.map((x) => x.request.headers.get('x-correlation-id'));
    expect(new Set(ids)).toEqual(new Set(['demo-correlation-2']));
  });

  it('reconciles after a 502 instead of submitting again', async () => {
    const w = world();
    w.sis.loseNextResponse = true; // the SIS books the slot, then the answer never arrives
    const client = w.client();
    const review = await client.prepare(w.book(), 'demo-correlation-3');
    const uncertain = await caught(client.commit(review.id, 'demo-correlation-3'));
    expect(uncertain).toMatchObject({
      status: 502,
      code: 'outcome_uncertain',
      retryable: false,
      correlationId: 'demo-correlation-3',
      userAction: { kind: 'contact_support' },
    });
    expect(w.sis.bookings).toHaveLength(1);
    expect(w.wire.filter((x) => new URL(x.request.url).pathname === '/actions/commit')).toHaveLength(1); // not retried

    // runAction does that whole dance: the second slot goes through the same failure.
    w.sis.loseNextResponse = true;
    const result = await client.runAction(w.book('slot-2'), async () => true);
    expect(result).toMatchObject({ state: 'done', reconciled: true, receipt: { id: 'bk-2' } });
    expect(w.sis.bookings, 'reconcile looked the booking up; it did not make another').toHaveLength(2);
  });

  it('reports unknown when the institution cannot say yet, and tells nobody to resubmit', async () => {
    const w = world({
      wrap: (adapter) => ({
        ...adapter,
        execute: async () => {
          throw new Error('upstream reset');
        },
        reconcile: async () => null,
      }),
    });
    const result = await w.client().runAction(w.book(), async () => true);
    expect(result.state).toBe('unknown');
    expect(w.sis.bookings).toHaveLength(0);
    const reconcile = w.wire.at(-1)!;
    expect(new URL(reconcile.request.url).pathname).toBe('/actions/reconcile');
    expect(reconcile.response.status).toBe(409);
    expect((await reconcile.response.json()).error).toMatchObject({ code: 'outcome_uncertain', retryable: false });
  });

  it('surfaces an adapter refusal as a 400 whose sentence is meant to be read, without retrying', async () => {
    const w = world();
    w.sis.students.set('student-a', { hold: true });
    const refused = await caught(w.client().prepare(w.book(), 'demo-correlation-4'));
    expect(refused).toMatchObject({ status: 400, code: 'refused', retryable: false, correlationId: 'demo-correlation-4' });
    expect(refused.message).toBe('A hold on your account blocks booking. Clear it with the registrar first.');
    expect(w.wire).toHaveLength(1);
    expect(w.sleeps).toEqual([]);
  });

  it('answers 409 record_changed when the record moved after it was read', async () => {
    const w = world();
    const [slot] = (await w.client().records('advising')).records;
    await w.client('token-b').runAction(w.book('slot-1', slot.version), async () => true);
    const stale = await caught(w.client().prepare(w.book('slot-1', slot.version)));
    expect([stale.status, stale.code]).toEqual([409, 'record_changed']);
  });

  it('keeps an unlinked account out: the adapter says disconnected and the gateway answers 403', async () => {
    const w = world();
    const forbidden = await caught(w.client('token-unlinked').records('advising'));
    expect([forbidden.status, forbidden.code]).toEqual([403, 'connection_forbids']);
  });

  it('backs off on 429 with exponential delays, and reuses the correlation id', async () => {
    let calls = 0;
    const w = world({ rateLimiter: { allow: () => ++calls > 3 } });
    const status = await w.client().status('demo-correlation-5');
    expect(status.version).toBe(1);
    expect(w.sleeps).toEqual([250, 500, 1000]);
    const attempts = w.wire.map((x) => [x.response.status, x.request.headers.get('x-correlation-id')]);
    expect(attempts).toEqual([[429, 'demo-correlation-5'], [429, 'demo-correlation-5'], [429, 'demo-correlation-5'], [200, 'demo-correlation-5']]);
  });

  it('gives up after maxAttempts and throws the last envelope', async () => {
    const w = world({ rateLimiter: { allow: () => false } });
    const error = await caught(w.client('token-a', { maxAttempts: 3 }).status());
    expect([error.status, error.code, error.retryable]).toEqual([429, 'rate_limited', true]);
    expect(w.wire).toHaveLength(3);
    expect(w.sleeps).toEqual([250, 500]); // no sleep after the last attempt
  });

  it('does not receive Retry-After from this gateway, and honours it when something in front sends one', async () => {
    const w = world({ rateLimiter: new MemoryRateLimiter({ windowMs: 60_000, max: 1 }) });
    await w.client().status(); // the one allowed request
    const limited = w.wire.length;
    await caught(w.client('token-a', { maxAttempts: 1 }).status());
    expect(w.wire[limited].response.status).toBe(429);
    expect(w.wire[limited].response.headers.get('retry-after'), 'the gateway sets no Retry-After').toBeNull();

    // A proxy that does send one: the client waits exactly that long instead of its own schedule.
    const sleeps: number[] = [];
    let first = true;
    const proxied: Transport = async () => {
      if (first) {
        first = false;
        return Response.json(
          { error: { code: 'rate_limited', message: 'Please wait.', correlation_id: 'c-1234567', retryable: true } },
          { status: 429, headers: { 'retry-after': '7' } },
        );
      }
      return Response.json({ version: 1, institutionId: 'x', institutionName: 'x', roles: [], connections: [] });
    };
    const client = createClient({ baseUrl: 'http://x', token: () => 't', transport: proxied, sleep: async (ms) => void sleeps.push(ms) });
    await client.status();
    expect(sleeps).toEqual([7000]);
  });

  it('retries a 503 read_only refusal, then throws it; reads are unaffected', async () => {
    const w = world({ readOnly: () => true });
    const refused = await caught(w.client('token-a', { maxAttempts: 2 }).prepare(w.book()));
    expect([refused.status, refused.code, refused.retryable]).toEqual([503, 'read_only', true]);
    expect(w.sleeps).toEqual([250]);
    expect((await w.client().records('advising')).records).toHaveLength(2);
  });

  it('lists all 37 service areas in /status, and answers 503 adapter_not_configured for an area with no adapter', async () => {
    const w = world();
    expect(UNIVERSITY_AREAS).toHaveLength(37);
    expect((await w.client().status()).connections).toHaveLength(37);
    const missing = await caught(w.client('token-a', { maxAttempts: 1 }).records('courses'));
    expect([missing.status, missing.code, missing.retryable]).toEqual([503, 'adapter_not_configured', true]);
  });

  it('checks an Origin header if one is sent, and a server-to-server call sends none', async () => {
    const w = world();
    const send = (origin?: string) =>
      w.gateway(new Request('http://gateway.example/status', { headers: { authorization: 'Bearer token-a', ...(origin ? { origin } : {}) } }));
    expect((await send()).status).toBe(200);
    expect((await send('http://localhost:5173')).status).toBe(200);
    const refused = await send('https://elsewhere.example');
    expect(refused.status).toBe(403);
    expect((await refused.json()).error.code).toBe('origin_not_allowed');
  });

  it('gives a review ten minutes', async () => {
    const w = world();
    const before = Date.now();
    const review = await w.client().prepare(w.book());
    const minutes = (Date.parse(review.expiresAt) - before) / 60_000;
    expect(minutes).toBeGreaterThan(9.9);
    expect(minutes).toBeLessThan(10.1);
  });

  it('flattens an adapter error that is not a Refusal into a generic 503, without its message', async () => {
    const w = world({
      wrap: (adapter) => ({
        ...adapter,
        review: async () => {
          throw new Error('pg: password authentication failed for user "sis"');
        },
      }),
    });
    const error = await caught(w.client('token-a', { maxAttempts: 1 }).prepare(w.book()));
    expect([error.status, error.code]).toEqual([503, 'unavailable']);
    expect(error.message).toBe('The university service is unavailable. Please try again later.');
    expect(JSON.stringify(await w.wire[0].response.json())).not.toContain('password');
  });

  it('does not block /actions/reconcile in read-only mode', async () => {
    const w = world({ readOnly: () => true });
    const error = await caught(w.client().reconcile('no-such-review'));
    expect([error.status, error.code]).toEqual([404, 'not_found']); // reached the lookup; a write would have been 503 read_only
  });

  it('holds the guide\'s error table to the gateway source', () => {
    const source = read('app/server/institution/gateway.ts');
    const rows = [...read('docs/guides/integrations/gateway-client.md').matchAll(/^\| `(\w+)` \| (\d{3}) \|/gm)];
    expect(rows.map((r) => r[1])).toHaveLength(13);
    const spelled = (status: string, code: string) =>
      new RegExp(`(?:fail|refuse)\\(\\s*${status},[\\s\\S]{0,160}?'${code}'\\)|${status}: '${code}'`).test(source);
    for (const [, code, status] of rows) expect(spelled(status, code), `${status} ${code}`).toBe(true);
    // Controls: a wrong pair is not found, so the probe can say no.
    expect(spelled('418', 'refused')).toBe(false);
    expect(spelled('400', 'record_changed')).toBe(false);
  });
});

// ── Example 2: the SCIM provisioner ──────────────────────────────────────

/*
 * The SCIM service is loaded with a dynamic import on purpose. `scim.ts` declares
 * `class ScimError { constructor(readonly status: number, ...) }`, a parameter
 * property, which `erasableSyntaxOnly` in tsconfig.app.json rejects (TS1294) and
 * which Node's type stripping cannot run either. A static import here would put
 * that file into `tsc -b`. The cast to `string` keeps the specifier out of the
 * type graph; Vite still resolves it. When `scim.ts` declares the field normally,
 * this becomes an ordinary import.
 */
interface CredentialMaterial {
  id: string;
  tenantId: string;
  salt: Uint8Array;
  hash: Uint8Array;
  status: 'active' | 'revoked';
}
const { createScimService } = (await import('../../../server/institution/scim.ts' as string)) as { createScimService: (config: any) => (request: Request) => Promise<Response> };

const credentialId = '11111111-1111-4111-8111-111111111111';
const secret = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH';
const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');

/**
 * A repository for the service to sit on, in memory. Replays by Idempotency-Key
 * return the first result. It does not enforce the two rules the Postgres one
 * adds (an externalId is required, and cannot change); the next test holds
 * those to the source, and the example always sends an externalId.
 */
class MemoryScim {
  users = new Map<string, ProvisioningResult>();
  writes = 0;
  private replays = new Map<string, ProvisioningResult>();
  async credential(id: string): Promise<CredentialMaterial | null> {
    const hash = createHash('sha256').update(Buffer.concat([salt, Buffer.from(secret)])).digest();
    return id === credentialId ? { id, tenantId: 'school-a', salt, hash, status: 'active' } : null;
  }
  async listUsers(tenantId: string, filter: ScimFilter | null) {
    return [...this.users.values()].filter((u) => u.tenantId === tenantId && (!filter || u[filter.attribute] === filter.value));
  }
  async getUser(tenantId: string, id: string) {
    const user = this.users.get(id);
    return user?.tenantId === tenantId ? user : null;
  }
  async putUser(tenantId: string, id: string | null, input: ScimUser, requestId: string) {
    const replay = this.replays.get(requestId);
    if (replay) return replay;
    const before = id ? this.users.get(id) : undefined;
    this.writes++;
    const userId = id ?? `user-${this.users.size + 1}`;
    const saved: ProvisioningResult = {
      tenantId, userId, userName: input.userName, active: input.active, roles: [], groupIds: [],
      externalId: before?.externalId ?? input.externalId,
      ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
      auditId: `audit-${requestId}`, createdAt: before?.createdAt ?? NOW.toISOString(), updatedAt: NOW.toISOString(),
      location: `https://scim.example/scim/v2/Users/${userId}`,
    };
    this.users.set(userId, saved);
    this.replays.set(requestId, saved);
    return saved;
  }
  async listGroups() { return []; }
  async getGroup() { return null; }
  async putGroup(): Promise<never> { throw new Error('groups are not exercised here'); }
  async deleteGroup() {}
  async audit() {}
}

function scimWorld(allow: () => boolean = () => true) {
  const repository = new MemoryScim();
  const service = createScimService({
    baseUrl: 'https://scim.example/scim/v2',
    repository,
    rateLimiter: { allow: async () => allow() },
  });
  const wire: { request: Request; response: Response }[] = [];
  const transport: Transport = async (request) => {
    const response = await service(request.clone());
    wire.push({ request, response: response.clone() });
    return response;
  };
  const sleeps: number[] = [];
  const client = (credential = `${credentialId}.${secret}`) =>
    createScimClient({
      baseUrl: 'https://scim.example/scim/v2', credential, transport,
      sleep: async (ms) => void sleeps.push(ms),
    });
  return { repository, service, wire, sleeps, client };
}

const ada = { externalId: 'emp-1001', userName: 'ada@school-a.example', displayName: 'Ada Lovelace' };

describe('examples/scim-provisioner', () => {
  it('uses the schema URNs the service checks', () => {
    expect([USER_SCHEMA, PATCH_SCHEMA, GROUP_SCHEMA]).toEqual([SCIM_USER_SCHEMA, SCIM_PATCH_SCHEMA, SCIM_GROUP_SCHEMA]);
  });

  it('sends an externalId, because the Postgres repository refuses a user without one and one whose externalId changes', () => {
    const source = read('app/server/institution/postgres-scim.ts');
    expect(source).toContain('A SCIM user needs an externalId');
    expect(source).toContain('A user’s externalId cannot change');
    expect(read('examples/scim-provisioner/provisioner.ts')).toContain('externalId: string;');
  });

  it('reads the discovery document, including what the service does not support', async () => {
    const config = await scimWorld().client().serviceProviderConfig();
    expect(config).toMatchObject({
      patch: { supported: true },
      filter: { supported: true, maxResults: 200 },
      bulk: { supported: false }, sort: { supported: false }, etag: { supported: false }, changePassword: { supported: false },
    });
  });

  it('syncs one person through create, no-op, update, deactivate and reactivate', async () => {
    const w = scimWorld();
    const client = w.client();
    const results: string[] = [];
    results.push(await client.sync(ada));
    results.push(await client.sync(ada));
    results.push(await client.sync({ ...ada, displayName: 'Ada King' }));
    results.push(await client.sync({ ...ada, displayName: 'Ada King', active: false }));
    results.push(await client.sync({ ...ada, displayName: 'Ada King', active: false }));
    results.push(await client.sync({ ...ada, displayName: 'Ada King' }));
    expect(results).toEqual(['created', 'unchanged', 'updated', 'deactivated', 'unchanged', 'updated']);
    expect(w.repository.writes).toBe(4);
    expect(w.repository.users.get('user-1')).toMatchObject({ displayName: 'Ada King', active: true, externalId: 'emp-1001' });
    // Absent person who is not active: nothing is created just to be switched off.
    expect(await client.sync({ externalId: 'emp-9', userName: 'gone@school-a.example', active: false })).toBe('unchanged');
    expect(w.repository.users.size).toBe(1);
  });

  it('deactivates with DELETE and never removes the user', async () => {
    const w = scimWorld();
    const client = w.client();
    const created = await client.createUser(ada);
    expect(created).toMatchObject({ id: 'user-1', active: true });
    expect(await client.deactivateUser(created.id)).toBe(true);
    expect(await client.getUser('user-1')).toMatchObject({ id: 'user-1', active: false });
    expect(await client.deactivateUser('missing')).toBe(false); // 404, reported as "nothing to deactivate"
    expect(await client.getUser('missing')).toBeNull();
  });

  it('replaces with PUT and patches active, displayName and userName', async () => {
    const w = scimWorld();
    const client = w.client();
    const { id } = await client.createUser(ada);
    expect(await client.replaceUser(id, { ...ada, displayName: 'Replaced' })).toMatchObject({ displayName: 'Replaced' });
    expect(
      await client.patchUser(id, [
        { op: 'replace', path: 'displayName', value: 'Patched' },
        { op: 'replace', path: 'active', value: false },
      ]),
    ).toMatchObject({ displayName: 'Patched', active: false });
  });

  it('lists with an eq filter and walks pages of 100', async () => {
    const w = scimWorld();
    const client = w.client();
    for (let i = 0; i < 250; i++) await client.createUser({ externalId: `e-${i}`, userName: `u${i}@school-a.example` });
    expect(await client.listUsers()).toHaveLength(250);
    const pageRequests = w.wire.filter((x) => new URL(x.request.url).pathname.endsWith('/Users') && x.request.method === 'GET');
    expect(pageRequests.map((x) => new URL(x.request.url).searchParams.get('startIndex'))).toEqual(['1', '101', '201']);
    expect(await client.listUsers({ attribute: 'externalId', value: 'e-7' })).toMatchObject([{ userName: 'u7@school-a.example' }]);
    expect(await client.listUsers({ attribute: 'userName', value: 'nobody@school-a.example' })).toEqual([]);
  });

  it('replays a mutation by Idempotency-Key without a second write, and retries 429 with the same key', async () => {
    const w = scimWorld();
    const a = await w.client().createUser(ada, 'key-1');
    const b = await w.client().createUser(ada, 'key-1');
    expect(b.id).toBe(a.id);
    expect(w.repository.writes).toBe(1);

    let denied = 2;
    const limited = scimWorld(() => denied-- <= 0);
    const created = await limited.client().createUser(ada, 'key-2');
    expect(created.id).toBe('user-1');
    expect(limited.sleeps).toEqual([250, 500]);
    const keys = limited.wire.map((x) => x.request.headers.get('idempotency-key'));
    expect(keys).toEqual(['key-2', 'key-2', 'key-2']);
    expect(limited.wire[0].response.status).toBe(429);
    expect(limited.wire[0].response.headers.get('retry-after'), 'the SCIM service sets no Retry-After').toBeNull();
  });

  it('is refused for a wrong credential, and does not retry that', async () => {
    const w = scimWorld();
    const error = await w.client(`${credentialId}.${'z'.repeat(44)}`).createUser(ada).catch((e) => e);
    expect(error).toBeInstanceOf(ScimClientError);
    expect(error.status).toBe(401);
    expect(w.wire).toHaveLength(1);
  });

  it('marks what the service refuses: other filters, other patch paths, a missing key, a wrong schema', async () => {
    const w = scimWorld();
    const send = (path: string, init: RequestInit = {}) =>
      w.service(new Request(`https://scim.example/scim/v2${path}`, {
        ...init,
        headers: { authorization: `Bearer ${credentialId}.${secret}`, 'content-type': 'application/scim+json', ...init.headers },
      }));
    const { id } = await w.client().createUser(ada);
    expect((await send('/Users?filter=' + encodeURIComponent('userName co "ada"'))).status).toBe(400);
    expect((await send('/Users?filter=' + encodeURIComponent('userName eq "ada" and active eq true'))).status).toBe(400);
    const patch = (path: string) => send(`/Users/${id}`, {
      method: 'PATCH', headers: { 'idempotency-key': `k-${path}` },
      body: JSON.stringify({ schemas: [SCIM_PATCH_SCHEMA], Operations: [{ op: 'replace', path, value: 'x' }] }),
    });
    expect((await patch('emails')).status).toBe(400);
    expect((await patch('members')).status).toBe(400);
    expect((await send('/Users', { method: 'POST', body: JSON.stringify({ ...ada, schemas: [SCIM_USER_SCHEMA] }) })).status, 'no Idempotency-Key').toBe(400);
    expect((await send('/Users', { method: 'POST', headers: { 'idempotency-key': 'k-x' }, body: JSON.stringify({ ...ada, schemas: ['wrong'] }) })).status).toBe(400);
    expect((await send('/Bulk', { method: 'POST', headers: { 'idempotency-key': 'k-y' }, body: '{}' })).status).toBe(404);
    const huge = JSON.stringify({ ...ada, schemas: [SCIM_USER_SCHEMA], displayName: 'x'.repeat(130_000) });
    expect((await send('/Users', { method: 'POST', headers: { 'idempotency-key': 'k-h' }, body: huge })).status).toBe(413);
    expect((await send('/Tenants/another-school/Users')).status).toBe(404);
    // A tenantId in the body is ignored: the user lands in the credential's tenant and the resource does not echo one.
    const smuggled = await send('/Users', { method: 'POST', headers: { 'idempotency-key': 'k-t' }, body: JSON.stringify({ ...ada, externalId: 'emp-3', userName: 'c@school-a.example', tenantId: 'attacker', schemas: [SCIM_USER_SCHEMA] }) });
    expect(smuggled.status).toBe(201);
    expect(JSON.stringify(await smuggled.json())).not.toContain('tenantId');
    expect([...w.repository.users.values()].map((u) => u.tenantId)).toEqual(['school-a', 'school-a']);
    // Control: the same create, done properly, is accepted.
    expect((await send('/Users', { method: 'POST', headers: { 'idempotency-key': 'k-z' }, body: JSON.stringify({ ...ada, externalId: 'emp-2', userName: 'b@school-a.example', schemas: [SCIM_USER_SCHEMA] }) })).status).toBe(201);
  });
});

// ── Example 3: the event consumer ────────────────────────────────────────

const gradeEvent = (n: number, over: Record<string, unknown> = {}) => ({
  ...makeEvent({
    eventId: `00000000-0000-4000-8000-00000000000${n}`,
    eventType: 'grade.posted',
    occurredAt: '2026-10-04T12:00:00Z',
    producer: 'example-lms',
    environment: 'production',
    tenantId: 'school-a',
    subject: { type: 'student', id: `student-${n}` },
    correlationId: `corr-0000000${n}`,
    idempotencyKey: `grade-${n}:v1`,
    payload: { assignment: `Essay ${n}` },
  }),
  ...over,
});

function notifierWorld() {
  const ledger = new MemoryReceiptLedger();
  const attempts: string[] = [];
  const sent = new Map<string, string>(); // the outside system dedupes on the key it is given
  let down = false;
  const notifier = {
    send: async (key: string, studentId: string, text: string) => {
      attempts.push(key);
      if (down) throw new Error('mail service unavailable');
      sent.set(key, `${studentId}: ${text}`);
    },
  };
  const consumer = gradeNotifier({ tenant: 'school-a', ledger, notifier });
  return { ledger, consumer, attempts, sent, setDown: (v: boolean) => void (down = v) };
}

describe('examples/event-consumer', () => {
  it('processes a valid event once and reports a redelivery as a duplicate', async () => {
    const n = notifierWorld();
    const event = gradeEvent(1);
    expect(await n.consumer.deliver(event)).toEqual({ outcome: 'processed' });
    expect(await n.consumer.deliver(event)).toEqual({ outcome: 'duplicate', earlier: 'processed' });
    expect(n.attempts).toEqual(['grade-1:v1']);
    expect(n.sent.get('grade-1:v1')).toBe('student-1: A grade was posted for Essay 1.');
  });

  it('refuses an unknown type, a wrong version, a malformed envelope and another tenant, and runs no handler', async () => {
    const n = notifierWorld();
    const verdicts = await Promise.all([
      n.consumer.deliver(gradeEvent(1, { eventType: 'advising.appointment_booked' })),
      n.consumer.deliver(gradeEvent(2, { eventVersion: 2 })),
      n.consumer.deliver(gradeEvent(3, { eventId: 'not-a-uuid' })),
      n.consumer.deliver(gradeEvent(4, { tenantId: 'school-b' })),
      n.consumer.deliver(gradeEvent(5, { dataClassification: 'public' })),
      n.consumer.deliver('not an object'),
    ]);
    expect(verdicts).toEqual([
      { outcome: 'refused', reason: 'unknown event type "advising.appointment_booked"' },
      { outcome: 'refused', reason: 'grade.posted is version 1, not 2' },
      { outcome: 'refused', reason: 'eventId is not a UUID' },
      { outcome: 'refused', reason: 'event is for another tenant' },
      { outcome: 'refused', reason: 'grade.posted is at least education_record' },
      { outcome: 'refused', reason: 'not an object' },
    ]);
    expect(n.attempts).toEqual([]);
    expect(n.ledger.receipts.size).toBe(0);
    // Control: the same envelope, unaltered, is accepted.
    expect(await n.consumer.deliver(gradeEvent(1))).toEqual({ outcome: 'processed' });
  });

  it('ignores a valid type it does not handle, and leaves no receipt', async () => {
    const n = notifierWorld();
    const other = makeEvent({
      eventId: '00000000-0000-4000-8000-0000000000aa', eventType: 'course.published', producer: 'example-lms',
      environment: 'production', tenantId: 'school-a', correlationId: 'corr-000000aa', payload: {},
    });
    expect(await n.consumer.deliver(other)).toEqual({ outcome: 'ignored', eventType: 'course.published' });
    expect(n.ledger.receipts.size).toBe(0);
  });

  it('records a failure, offers the event again, and the retry reuses the idempotency key', async () => {
    const n = notifierWorld();
    const outbox = new MemoryOutbox();
    outbox.append(gradeEvent(1));
    outbox.append(gradeEvent(2));
    n.setDown(true);
    expect(await publishToConsumers(outbox, [n.consumer])).toEqual({ published: 0, failed: 2, deadLettered: 0 });
    expect(outbox.rows.map((r) => [r.publishAttempts, r.lastError])).toEqual([
      [1, 'grade-notifier failed: mail service unavailable'],
      [1, 'grade-notifier failed: mail service unavailable'],
    ]);
    n.setDown(false);
    expect(await publishToConsumers(outbox, [n.consumer])).toEqual({ published: 2, failed: 0, deadLettered: 0 });
    expect(n.attempts).toEqual(['grade-1:v1', 'grade-2:v1', 'grade-1:v1', 'grade-2:v1']);
    expect([...n.sent.keys()]).toEqual(['grade-1:v1', 'grade-2:v1']); // one message each, though four attempts
    expect(await publishToConsumers(outbox, [n.consumer])).toEqual({ published: 0, failed: 0, deadLettered: 0 });
  });

  it('parks a poison event after maxAttempts and does not offer it again', async () => {
    const n = notifierWorld();
    const outbox = new MemoryOutbox();
    outbox.append(gradeEvent(1, { eventVersion: 9 })); // a producer bug: no consumer will ever accept it
    outbox.append(gradeEvent(2));
    const options = { maxAttempts: 3, now: () => NOW };
    const reports = [
      await publishToConsumers(outbox, [n.consumer], options),
      await publishToConsumers(outbox, [n.consumer], options),
      await publishToConsumers(outbox, [n.consumer], options),
      await publishToConsumers(outbox, [n.consumer], options),
    ];
    expect(reports).toEqual([
      { published: 1, failed: 1, deadLettered: 0 },
      { published: 0, failed: 1, deadLettered: 0 },
      { published: 0, failed: 0, deadLettered: 1 },
      { published: 0, failed: 0, deadLettered: 0 },
    ]);
    const [poison, good] = outbox.rows;
    expect(poison.deadLetteredAt).toBe(NOW.toISOString());
    expect(poison.lastError).toBe('grade-notifier refused: grade.posted is version 1, not 9');
    expect(good.publishedAt).toBe(NOW.toISOString());
    expect(n.attempts, 'the good event was delivered once, though the batch ran four times').toEqual(['grade-2:v1']);
  });

  it('a handler that throws on missing data is recorded as failed, with the message and no payload', async () => {
    const n = notifierWorld();
    const noSubject = gradeEvent(3);
    delete (noSubject as { subject?: unknown }).subject;
    expect(await n.consumer.deliver(noSubject)).toEqual({ outcome: 'failed', error: 'grade.posted has no subject' });
    expect(n.ledger.seen('grade-notifier', noSubject.eventId)).toBe('failed');
  });

  it('shows the add-a-type rule: a type outside EVENT_TYPES is refused until the catalog and a consumer land together', async () => {
    const consumer = createConsumer({ name: 'probe', tenant: 'school-a', ledger: new MemoryReceiptLedger(), handlers: {} });
    expect('advising.appointment_booked' in EVENT_TYPES).toBe(false);
    expect(await consumer.deliver(gradeEvent(1, { eventType: 'advising.appointment_booked' }))).toMatchObject({ outcome: 'refused' });
    expect(Object.keys(EVENT_TYPES).every((t) => /^[a-z_]+\.[a-z_]+$/.test(t))).toBe(true);
  });

  it('has one producer, the productivity command service, which one route mounts behind a flag that is off, and nothing publishes', () => {
    // The guide says the outbox runs in memory only in these examples, and that the one producer in the repository
    // is reachable from exactly one route, switched off unless a deployment sets SEMESTER_PRODUCTIVITY=on, and
    // that nothing publishes what it writes. This fails when any of that stops being true, so that someone
    // revisits the guide in the same change.
    const code: { file: string; text: string }[] = [];
    for (const dir of ['app/src', 'app/server', 'app/api', 'supabase/functions', 'packages']) {
      for (const file of walk(dir)) {
        if (!/\.(ts|tsx)$/.test(file) || /\.test\.tsx?$/.test(file) || file.endsWith('packages/institution/src/events.ts')) continue;
        code.push({ file, text: read(file) });
      }
    }
    const holders = code.filter((c) => /domain_outbox_events|\b(makeEvent|drainOutbox|MemoryOutbox)\b/.test(c.text)).map((c) => c.file);
    // Two registers name the table or the drainer in prose (lmsmatrix.ts says "the outbox drainer has no caller"); they write nothing.
    expect(holders).toEqual([
      'app/src/lib/definerregister.ts',
      'app/src/lib/integration/lmsmatrix.ts',
      'app/server/productivity/memory.ts',
      'app/server/productivity/service.ts',
      'packages/platform/src/events/emit.ts',
      'packages/platform/src/seam/institution.ts',
      'packages/platform/src/testing/memory.ts',
    ]);
    // Nothing outside the producers' own folders imports them, so no entry point runs them. (packages/platform is the
    // tenancy kernel: it builds events and checks the tenant on a store; only build configuration names it.)
    // The institution gateway takes the error envelope, correlation ids and request context from the platform package
    // (MIGRATION phase 1). Those three files may import it; none of them may import the productivity service.
    const gatewayFiles = ['app/server/institution/adapter.ts', 'app/server/institution/context.ts', 'app/server/institution/gateway.ts'];
    const mounts = code
      .filter((c) => !c.file.startsWith('app/server/productivity/') && !c.file.startsWith('packages/platform/'))
      .filter((c) => /from\s+['"][^'"]*\/(?:productivity|platform)\/[^'"]*['"]/.test(c.text))
      .filter((c) => !(gatewayFiles.includes(c.file) && !/from\s+['"][^'"]*\/productivity\/[^'"]*['"]/.test(c.text)))
      .map((c) => c.file);
    expect(mounts, 'something else now imports the productivity service or the platform package').toEqual(['app/api/productivity/[...path].ts']);
    // The route is off unless the deployment says on: the one entry point that mounts the producer must check the switch first.
    expect(read('app/api/productivity/[...path].ts')).toContain('if (!productivityEnabled(process.env)) throw');
    // Nothing publishes: drainOutbox has no caller outside the library.
    expect(code.filter((c) => /\bdrainOutbox\s*\(/.test(c.text)).map((c) => c.file), 'something now calls drainOutbox').toEqual([]);
    const inserts = walk('supabase').filter((f) => f.endsWith('.sql') && /insert\s+into\s+private\.domain_outbox_events/i.test(read(f))).sort();
    // Still one producer: `private.productivity_commit`. It is defined in the commands migration and redefined, same
    // signature, in the reads migration (which adds the sequence prediction), so both files carry the insert. The
    // productivity check script inserts a row of its own to prove the outbox counts.
    expect(inserts, 'the producer\'s migration function and the check scripts insert into the outbox').toEqual([
      'supabase/migrations/20261004123000_productivity_commands.sql',
      'supabase/migrations/20261004180000_productivity_reads.sql',
      // Defines the same commit function again, with the app's task fields; the later definition is the one that applies.
      'supabase/migrations/20261004191000_productivity_task_carries_the_apps_task.sql',
      // The helper a SQL producer will call (P1-02), not a producer: nothing calls it yet. Its check calls the helper, so it is not listed.
      'supabase/migrations/20261006170000_emit_domain_event.sql',
      'supabase/outbox.check.sql',
      'supabase/productivity-commands.check.sql',
      // Writes one row of its own to prove the old columns still default after the claim columns were added; it is a check, not a producer.
      'supabase/projection-foundation.check.sql',
    ]);
    expect(read('docs/architecture/0008-event-envelope-and-outbox.md')).toContain('**no\nproducer writes to the outbox yet**');
  });
});

// ── Example 4: the SIS adapter ───────────────────────────────────────────

describe('examples/sis-adapter', () => {
  it('serves a status, a page of records and a record through the real gateway', async () => {
    const w = world();
    const client = w.client();
    const [first] = (await client.records('advising')).records;
    expect(first).toMatchObject({ id: 'slot-1', area: 'advising', version: '1', status: 'Open', dates: [{ at: '2026-10-12T14:00:00Z' }] });
    expect(first.actions.map((a) => a.id)).toEqual(['book']);
    expect((await client.status()).connections.find((c) => c.area === 'advising')?.provider).toBe('Example SIS');
  });

  it('books through prepare and commit, passes the review id to the SIS as its key, and offers no action afterwards', async () => {
    const w = world();
    const client = w.client();
    const review = await client.prepare(w.book());
    expect(w.sis.bookings, 'prepare reserved nothing').toHaveLength(0);
    expect(w.sis.slots[0].bookedBy).toBeNull();
    await client.commit(review.id);
    expect(w.sis.bookings[0]).toMatchObject({ key: review.id, studentId: 'student-a', slotId: 'slot-1' });
    const [booked] = (await client.records('advising')).records;
    expect(booked).toMatchObject({ status: 'Booked', version: '2', actions: [] });
    const again = await caught(client.prepare(w.book('slot-1', '2')));
    expect([again.status, again.message]).toEqual([403, 'This action is not available for this record.']);
  });

  it('refuses with a sentence at review, and writes nothing', async () => {
    const w = world();
    w.sis.students.set('student-a', { hold: true });
    const refused = await caught(w.client().prepare(w.book()));
    expect(refused).toMatchObject({ status: 400, code: 'refused' });
    expect(refused.message).toMatch(/^A hold on your account/);
    expect(w.sis.bookings).toHaveLength(0);
    // Control: without the hold the same request is accepted.
    w.sis.students.set('student-a', { hold: false });
    expect((await w.client().prepare(w.book())).title).toBe('Book an advising appointment');
  });

  it('refuses at commit when a hold appears between prepare and commit, as a 400 and not as an unknown outcome', async () => {
    const w = world();
    const client = w.client();
    const review = await client.prepare(w.book());
    w.sis.students.set('student-a', { hold: true });
    const refused = await caught(client.commit(review.id));
    expect([refused.status, refused.code]).toEqual([400, 'refused']);
    expect(w.sis.bookings).toHaveLength(0);
  });

  it('refuses a commit for a slot another student took (409 from the version), and the loser can still be told why', async () => {
    const w = world();
    const review = await w.client().prepare(w.book());
    await w.client('token-b').runAction(w.book(), async () => true);
    const lost = await caught(w.client().commit(review.id));
    expect([lost.status, lost.code]).toEqual([409, 'record_changed']);
    expect(w.sis.bookings).toHaveLength(1);
  });

  it('never shows the SIS error text: a down SIS is a status of error, not a stack trace', async () => {
    const w = world();
    const client = w.client();
    w.sis.down = true;
    const status = await client.status();
    expect(status.connections.find((c) => c.area === 'advising')).toMatchObject({ state: 'error', canRead: false, message: 'The SIS did not answer.' });
    const refused = await caught(client.records('advising'));
    expect([refused.status, refused.code]).toEqual([403, 'connection_forbids']);
    const bodies = await Promise.all(w.wire.map((x) => x.response.text()));
    expect(bodies.join('')).not.toMatch(/ECONNREFUSED|10\.0\.0\.12/);
  });

  it('answers 404 for a record the adapter does not return, and 503 when the adapter cannot reconcile', async () => {
    const w = world();
    const missing = await caught(w.client().prepare(w.book('slot-99')));
    expect([missing.status, missing.code]).toEqual([404, 'not_found']);

    const noReconcile = world({
      wrap: (adapter) => ({
        ...adapter,
        execute: async () => {
          throw new Error('upstream reset');
        },
        reconcile: undefined,
      }),
    });
    const client = noReconcile.client();
    const review = await client.prepare(noReconcile.book());
    await caught(client.commit(review.id)); // 502
    const cannot = await caught(client.reconcile(review.id));
    expect([cannot.status, cannot.retryable]).toEqual([503, true]);
    expect(cannot.message).toBe('This adapter needs institutional support to reconcile the action.');
  });

  it('declares every method the real adapter interface declares', () => {
    const methods = (source: string, name: string) => {
      const block = source.split(`export interface ${name} {`)[1].split('\n}\n')[0];
      return [...block.matchAll(/^ {2}(\w+)\??[(:]/gm)].map((m) => m[1]).sort();
    };
    const real = methods(read('app/server/institution/adapter.ts'), 'InstitutionAdapter');
    const mine = methods(read('examples/sis-adapter/adapter.ts'), 'AdvisingAdapter');
    expect(mine).toEqual(real);
    expect(real).toEqual(['area', 'execute', 'get', 'institutionId', 'list', 'reconcile', 'review', 'status']);
  });
});

// ── The files: cards, imports, quoted fragments ──────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(at(dir)).sort()) {
    if (name === '.git') continue;
    const path = `${dir}/${name}`;
    if (name === 'node_modules') {
      out.push(`${path}/`); // listed, never entered: its presence is what the examples check forbids
      continue;
    }
    if (statSync(at(path)).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const TYPES = ['tutorial', 'how-to', 'reference', 'explanation', 'runbook', 'help', 'release'];
const AUDIENCES = ['students', 'families', 'faculty', 'institution-admins', 'implementers', 'partner-developers', 'contributors', 'operators', 'support', 'buyers', 'security-reviewers'];
const TRUTHS = ['generated', 'held', 'reviewed'];
const CARD = /^> \*\*Type:\*\* (\S+) · \*\*Audience:\*\* ([\w, -]+) · \*\*Owner:\*\* `(\w+)` · \*\*Truth:\*\* (\w+) · \*\*Reviewed:\*\* (\d{4}-\d{2}-\d{2}) · \*\*Held by:\*\* (?:`([^`]+)`|—)$/;

/** Why a page's card is wrong, or null. The page must open `# Title`, a blank line, then the card. */
function cardProblem(text: string): string | null {
  const [title, blank, card] = text.split('\n');
  if (!/^# \S/.test(title)) return 'first line is not a # title';
  if (blank !== '') return 'no blank line after the title';
  const m = CARD.exec(card ?? '');
  if (!m) return 'second block is not a card line';
  const [, type, audience, owner, truth, reviewed, heldBy] = m;
  if (!TYPES.includes(type)) return `unknown type ${type}`;
  if (audience.split(',').map((a) => a.trim()).some((a) => !AUDIENCES.includes(a))) return `unknown audience ${audience}`;
  if (!(SEATS as readonly string[]).includes(owner)) return `owner ${owner} is not a council seat`;
  if (!TRUTHS.includes(truth)) return `unknown truth ${truth}`;
  if (reviewed !== '2026-10-04') return `reviewed ${reviewed}`;
  if (type === 'reference' && truth === 'reviewed') return 'a reference page must be generated or held';
  if (type === 'how-to' && truth !== 'held') return 'a how-to that quotes code must be held';
  if (truth === 'held' && heldBy !== SELF) return `held by ${heldBy}, not ${SELF}`;
  return null;
}

/** Every module specifier a TypeScript source imports or re-exports, dynamic and type-only included. */
function importsOf(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/(?:^|[\s;])(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
  for (const m of source.matchAll(/(?:^|[\s;])import\s*['"]([^'"]+)['"]/g)) found.add(m[1]);
  for (const m of source.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.add(m[1]);
  return [...found].sort();
}

/** Whether a specifier written in `file` is allowed in an example. */
function importAllowed(file: string, specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  if (!specifier.startsWith('.')) return false;
  const target = relative(root, join(at(file), '..', specifier)).split('\\').join('/');
  if (target.startsWith('packages/institution/src/')) return true;
  return target.startsWith('examples/');
}

const MARKER = /^<!-- (from|output): (\S+) -->$/;

/** Quoted blocks in a guide: the marker line, then a fenced block straight after it. */
function quotedBlocks(guide: string): { kind: 'from' | 'output'; ref: string; body: string; line: number }[] {
  const lines = guide.split('\n');
  const blocks: ReturnType<typeof quotedBlocks> = [];
  lines.forEach((text, i) => {
    const m = MARKER.exec(text);
    if (!m) return;
    if (!/^```\w+$/.test(lines[i + 1] ?? '')) throw new Error(`line ${i + 1}: the marker is not followed by a fenced block`);
    const end = lines.indexOf('```', i + 2);
    if (end < 0) throw new Error(`line ${i + 1}: the fenced block is not closed`);
    blocks.push({ kind: m[1] as 'from' | 'output', ref: m[2], body: lines.slice(i + 2, end).join('\n'), line: i + 1 });
  });
  return blocks;
}

/** Reference pages another author is writing alongside this change. Links to them are not resolved here. */
const PENDING_REFERENCE = ['docs/reference/API-GATEWAY.md', 'docs/reference/SCIM-API.md', 'docs/reference/ERRORS.md', 'docs/reference/EVENTS.md'];
const EXAMPLES = ['gateway-client', 'scim-provisioner', 'event-consumer', 'sis-adapter'];
const GUIDES = EXAMPLES.map((e) => `docs/guides/integrations/${e}.md`);
const PAGES = [
  'examples/README.md',
  ...EXAMPLES.map((e) => `examples/${e}/README.md`),
  'docs/guides/integrations/README.md',
  'docs/guides/integrations/which-integration-path.md',
  ...GUIDES,
];

describe('the files', () => {
  it('has a README with a valid card in examples/ and in every example', () => {
    expect(readdirSync(at('examples')).filter((n) => statSync(at(`examples/${n}`)).isDirectory()).sort()).toEqual([...EXAMPLES].sort());
    for (const page of PAGES) expect({ page, problem: cardProblem(read(page)) }).toEqual({ page, problem: null });
  });

  it('keeps the card checker honest: it rejects what it should', () => {
    const good = read('examples/README.md');
    expect(cardProblem(good)).toBeNull();
    expect(cardProblem(good.replace('**Owner:** `engineering`', '**Owner:** `somebody`'))).toMatch(/not a council seat/);
    expect(cardProblem(good.replace('**Truth:** held', '**Truth:** reviewed'))).toMatch(/reference page must be/);
    expect(cardProblem(good.replace(SELF, 'app/src/other.test.ts'))).toMatch(/held by/);
    expect(cardProblem(good.replace('# ', '## '))).toMatch(/title/);
  });

  it('has no package.json and no node_modules anywhere under examples/, so npm sees no workspace', () => {
    const files = walk('examples');
    expect(files.filter((f) => /package(-lock)?\.json$|\/node_modules\/|tsconfig/.test(f))).toEqual([]);
    expect(files.length).toBeGreaterThan(8);
  });

  it('imports only node: builtins, packages/institution/src and sibling files', () => {
    const sources = walk('examples').filter((f) => f.endsWith('.ts'));
    expect(sources.map((f) => f.split('/')[2]).sort()).toEqual(
      ['adapter.ts', 'client.ts', 'consumer.ts', 'fake-sis.ts', 'provisioner.ts'].sort(),
    );
    const offending = sources.flatMap((f) => importsOf(read(f)).filter((s) => !importAllowed(f, s)).map((s) => `${f} imports ${s}`));
    expect(offending).toEqual([]);
    // Each example really does import something, so an empty scan cannot read as clean.
    expect(importsOf(read('examples/gateway-client/client.ts'))).toEqual(['../../packages/institution/src/index.ts']);
    expect(importsOf(read('examples/event-consumer/consumer.ts'))).toEqual(['../../packages/institution/src/events.ts']);
    expect(importsOf(read('examples/sis-adapter/adapter.ts'))).toEqual(['../../packages/institution/src/index.ts', './fake-sis.ts']);
  });

  it('keeps the import scanner honest: it finds every form and rejects the wrong ones', () => {
    const sample = [
      `import a from 'node:fs';`,
      `import type { B } from '../../packages/institution/src/index.ts';`,
      `export * from './x.ts';`,
      `import 'side-effect';`,
      `const c = await import('lodash');`,
      `import {\n  d,\n} from "../../app/src/lib/x.ts";`,
    ].join('\n');
    expect(importsOf(sample)).toEqual(['../../app/src/lib/x.ts', '../../packages/institution/src/index.ts', './x.ts', 'lodash', 'node:fs', 'side-effect']);
    const allowed = importsOf(sample).filter((s) => importAllowed('examples/a/b.ts', s));
    expect(allowed).toEqual(['../../packages/institution/src/index.ts', './x.ts', 'node:fs']);
    expect(importAllowed('examples/a/b.ts', '../../../app/server/institution/gateway.ts')).toBe(false);
    expect(importAllowed('examples/a/b.ts', '../../supabase/functions/_shared/lti.ts')).toBe(false);
  });

  it('is at most about 250 lines of code per example, and each file reads as teaching code', () => {
    for (const example of EXAMPLES) {
      const lines = walk(`examples/${example}`).filter((f) => f.endsWith('.ts')).reduce((n, f) => n + read(f).split('\n').length, 0);
      expect({ example, small: lines <= 280 }).toEqual({ example, small: true });
    }
  });
});

// What each scenario prints, for the guides' `output` blocks.
async function outputs(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const pretty = (value: unknown) => JSON.stringify(value, null, 2);

  const w = world();
  w.sis.students.set('student-a', { hold: true });
  const refusal = await w.client().prepare(w.book(), 'demo-correlation-4').catch((e: GatewayError) => e);
  const refusedBody = await w.wire[0].response.json();
  out['gateway-client/refusal'] = pretty(refusedBody);
  expect(refusal).toBeInstanceOf(GatewayError);

  const u = world();
  u.sis.loseNextResponse = true;
  const review = await u.client().prepare(u.book(), 'demo-correlation-3');
  await u.client().commit(review.id, 'demo-correlation-3').catch(() => undefined);
  out['gateway-client/uncertain'] = pretty(await u.wire.at(-1)!.response.json());

  const r = world();
  const done = await r.client().runAction(r.book(), async (rev) => {
    out['sis-adapter/review'] = pretty({ title: rev.title, details: rev.details });
    return true;
  });
  out['sis-adapter/receipt'] = pretty(done.state === 'done' ? done.receipt : done);

  const s = scimWorld();
  const results: string[] = [];
  for (const person of [ada, ada, { ...ada, displayName: 'Ada King' }, { ...ada, displayName: 'Ada King', active: false }]) {
    results.push(await s.client().sync(person));
  }
  out['scim-provisioner/sync'] = pretty(results);

  const n = notifierWorld();
  const outbox = new MemoryOutbox();
  outbox.append(gradeEvent(1));
  n.setDown(true);
  const reports = [await publishToConsumers(outbox, [n.consumer])];
  n.setDown(false);
  reports.push(await publishToConsumers(outbox, [n.consumer]));
  reports.push(await publishToConsumers(outbox, [n.consumer]));
  out['event-consumer/drain'] = pretty(reports);
  out['event-consumer/refused'] = pretty(await n.consumer.deliver(gradeEvent(2, { eventVersion: 2 })));
  return out;
}

let cached: Promise<Record<string, string>> | null = null;

describe('the guides', () => {
  it('quote the code byte for byte and print what the scenarios print', async () => {
    cached ??= outputs();
    const printed = await cached;
    let checked = 0;
    for (const guide of GUIDES) {
      const blocks = quotedBlocks(read(guide));
      expect({ guide, blocks: blocks.length > 0 }).toEqual({ guide, blocks: true });
      for (const block of blocks) {
        if (block.kind === 'from') {
          expect(existsSync(at(block.ref)), `${guide}:${block.line} names ${block.ref}`).toBe(true);
          expect(read(block.ref).includes(block.body), `${guide}:${block.line} is not in ${block.ref} byte for byte`).toBe(true);
        } else {
          expect(printed[block.ref], `${guide}:${block.line} names an output that no scenario prints: ${block.ref}`).toBeDefined();
          expect(block.body, `${guide}:${block.line} differs from what ${block.ref} prints`).toBe(printed[block.ref]);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(16);
  });

  it('shows the quote checker rejecting a fragment that has drifted, and accepting the real one', () => {
    const source = read('examples/gateway-client/client.ts');
    const real = "      // Trust the flag, not the status: a 502 is never retryable, whatever it looks like.";
    expect(source.includes(real)).toBe(true);
    expect(source.includes(real.replace('502', '503'))).toBe(false);
    expect(() => quotedBlocks('<!-- from: x -->\nnot a fence')).toThrow(/not followed by a fenced block/);
    expect(quotedBlocks('<!-- from: a/b.ts -->\n```ts\none\ntwo\n```')).toEqual([{ kind: 'from', ref: 'a/b.ts', body: 'one\ntwo', line: 1 }]);
  });

  it('link only to files that exist, and each guide is listed in the index', () => {
    for (const page of PAGES) {
      const text = read(page);
      const dir = join(at(page), '..');
      for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z]+:/.test(m[1])) continue;
        if (PENDING_REFERENCE.includes(relative(root, join(dir, m[1])))) continue;
        expect({ page, link: m[1], exists: existsSync(join(dir, m[1])) }).toEqual({ page, link: m[1], exists: true });
      }
    }
    const index = read('docs/guides/integrations/README.md');
    for (const example of EXAMPLES) {
      expect(index).toContain(`(${example}.md)`);
      expect(index).toContain(`(../../../examples/${example}/README.md)`);
      expect(read('examples/README.md')).toContain(`(${example}/README.md)`);
    }
    expect(index).toContain('(which-integration-path.md)');
  });
});

// ── The decision page: each path's status, held to the truth table ───────

/** The path, the truth-table row that backs it (a distinctive substring), and its status word. */
const PATHS: { path: string; row: string; status: string }[] = [
  { path: 'SAML single sign-on', row: '| SAML SSO |', status: 'IMPLEMENTED_NOT_RELEASED' },
  { path: 'OIDC single sign-on', row: '| OIDC SSO |', status: 'PLANNED' },
  { path: 'OneRoster', row: '| OneRoster staging and reconciliation |', status: 'PLANNED' },
  { path: 'SCIM provisioning', row: '| SCIM 2.0 |', status: 'IMPLEMENTED_NOT_RELEASED' },
  { path: 'LTI 1.3', row: '| LTI 1.3 (launch, deep link, AGS) |', status: 'IMPLEMENTED_NOT_RELEASED' },
  { path: 'SIS adapter', row: '| SIS / catalog connectors |', status: 'PLANNED' },
  { path: 'Institution gateway', row: '| Institution gateway (records/actions/AI) |', status: 'MOCK_DEMO' },
  { path: 'Calendar (ICS) feeds', row: '| Plan: calendar |', status: 'LIVE' },
];

describe('which-integration-path.md', () => {
  const page = () => read('docs/guides/integrations/which-integration-path.md');

  it('states for each path the status the truth table gives it', () => {
    const table = read('docs/FEATURE-TRUTH-TABLE.md');
    for (const { path, row, status } of PATHS) {
      const line = table.split('\n').find((l) => l.startsWith(row)) ?? '';
      expect({ path, tableSays: line.split('|')[2]?.trim().split(' ')[0] }).toEqual({ path, tableSays: status });
      const mine = page().split('\n').find((l) => l.startsWith(`| ${path} `)) ?? '';
      expect({ path, pageSays: mine.includes(`\`${status}\``) }).toEqual({ path, pageSays: true });
    }
  });

  it('links the authoritative runbooks and the reference pages other authors are writing', () => {
    const from = 'docs/guides/integrations';
    for (const target of [
      'docs/INSTITUTIONAL-SSO-ARCHITECTURE.md',
      'docs/SCIM-LIFECYCLE-MANAGEMENT.md',
      'docs/LTI-1.3-LAUNCH-RUNBOOK.md',
      'docs/INTEGRATION-OPERATOR-RUNBOOK.md',
      'docs/INTEROPERABILITY-ROADMAP.md',
      'docs/FEATURE-TRUTH-TABLE.md',
      'extensions/semester-capture/manifest.json',
    ]) {
      expect(existsSync(at(target)), target).toBe(true);
      expect(page(), target).toContain(`](${relative(at(from), at(target))})`);
    }
    // Written by another author in the same change set; the lead checks they exist at merge.
    for (const pending of ['API-GATEWAY.md', 'SCIM-API.md', 'ERRORS.md', 'EVENTS.md']) {
      expect(PENDING_REFERENCE.some((p) => p.endsWith(pending))).toBe(true);
      expect(page() + read(`${from}/gateway-client.md`) + read(`${from}/scim-provisioner.md`) + read(`${from}/event-consumer.md`)).toContain(`](../../reference/${pending})`);
    }
  });

  it('does not use the words the claims register forbids', () => {
    for (const p of PAGES) {
      expect(read(p), p).not.toMatch(/\b(compliant|certified|HECVAT-complete|SOC 2 (?:compliant|certified)|replaces your (?:SIS|LMS))\b/i);
    }
  });
});
