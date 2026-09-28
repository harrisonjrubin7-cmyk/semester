import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SCIM_GROUP_SCHEMA, SCIM_PATCH_SCHEMA, SCIM_USER_SCHEMA } from '../../../packages/institution/src/index.ts';
import { PostgresScimRepository, byteaToBytes } from './postgres-scim.ts';
import { createScimService } from './scim.ts';
import { SCIM_INTERNAL_BASE, createProductionScim, withScim } from './scim-route.ts';

/**
 * The production SCIM repository, driven through the real service.
 *
 * The database half — tenant-bound credentials, idempotent request ids, a
 * deactivation clearing roles, an unmapped group granting nothing, refusals
 * recorded once — is proved against Postgres by
 * `supabase/identity-provisioning.check.sql` and `scim-gateway.check.sql`.
 * What can go wrong on *this* side is translation: a bytea read as text, an
 * externalId quietly swapped, a member id from another school resolved, a
 * refusal reported as a 503. So the fake below keeps the schema's shapes and
 * the private functions' visible behaviour, and nothing more clever than that.
 */

const TENANT = 'northstar';
const CRED = '11111111-1111-4111-8111-111111111111';
const REVOKED = '55555555-5555-4555-8555-555555555555';
const OTHER_CRED = '22222222-2222-4222-8222-222222222222';
const SECRET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH';
const SALT = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const HASH = createHash('sha256').update(Buffer.concat([SALT, Buffer.from(SECRET)])).digest();
const hex = (b: Buffer) => `\\x${b.toString('hex')}`;

type Row = Record<string, unknown>;

class FakeDb {
  static readonly MAX_ROWS = 1000;
  static readonly URL_LIMIT = 8000;
  identities: Row[] = [];
  memberships: Row[] = [];
  mappings: Row[] = [
    { id: '33333333-3333-4333-8333-333333333333', tenant_id: TENANT, external_group_id: 'grp-advisors', display_name: 'Advisors', roles: ['advisor'], active: true, updated_at: '2026-09-27T00:00:00Z' },
    { id: '44444444-4444-4444-8444-444444444444', tenant_id: 'cedar', external_group_id: 'grp-advisors', display_name: 'Cedar advisors', roles: ['advisor'], active: true, updated_at: '2026-09-27T00:00:00Z' },
  ];
  events: Row[] = [];
  rpcs: { name: string; args: Row }[] = [];
  private seq = 0;

  private uuid() {
    this.seq += 1;
    return `aaaaaaaa-aaaa-4aaa-8aaa-${String(this.seq).padStart(12, '0')}`;
  }

  rpc(name: string, args: Row): { data: unknown; error: unknown } {
    this.rpcs.push({ name, args });
    if (name === 'scim_gateway_credential') {
      if (args.want_id === CRED) return { data: [{ credential_id: CRED, tenant_id: TENANT, secret_salt: hex(SALT), secret_hash: hex(HASH), active: true }], error: null };
      if (args.want_id === REVOKED) return { data: [{ credential_id: REVOKED, tenant_id: TENANT, secret_salt: hex(SALT), secret_hash: hex(HASH), active: false }], error: null };
      return { data: [], error: null };
    }
    if (name === 'scim_gateway_provision_user') {
      const prior = this.events.find((e) => e.tenant_id === args.want_tenant && e.request_id === args.want_request_id);
      if (prior) return { data: prior.membership_id, error: null };
      let identity = this.identities.find((i) => i.tenant_id === args.want_tenant && i.external_id === args.want_external_id);
      if (!identity) {
        const id = this.uuid();
        this.memberships.push({ id, tenant_id: args.want_tenant, roles: [] });
        identity = { membership_id: id, tenant_id: args.want_tenant, external_id: args.want_external_id, group_external_ids: [], created_at: '2026-09-27T01:00:00Z' };
        this.identities.push(identity);
      }
      Object.assign(identity, {
        user_name: String(args.want_user_name).trim().toLowerCase(),
        display_name: args.want_display_name, active: args.want_active, updated_at: '2026-09-27T02:00:00Z',
      });
      this.events.push({ tenant_id: args.want_tenant, request_id: args.want_request_id, membership_id: identity.membership_id, outcome: 'accepted' });
      return { data: identity.membership_id, error: null };
    }
    if (name === 'scim_gateway_replace_group') {
      const mapped = this.mappings.find((m) => m.tenant_id === args.want_tenant && m.external_group_id === args.want_external_group_id && m.active);
      if (!mapped) {
        this.events.push({ tenant_id: args.want_tenant, request_id: args.want_request_id, outcome: 'unknown_group' });
        return { data: 0, error: null };
      }
      const members = args.want_member_external_ids as string[];
      for (const i of this.identities.filter((x) => x.tenant_id === args.want_tenant && x.active)) {
        const groups = (i.group_external_ids as string[]).filter((g) => g !== args.want_external_group_id);
        i.group_external_ids = members.includes(String(i.external_id)) ? [...groups, String(args.want_external_group_id)] : groups;
      }
      this.events.push({ tenant_id: args.want_tenant, request_id: args.want_request_id, outcome: 'accepted' });
      return { data: members.length, error: null };
    }
    if (name === 'scim_gateway_record_refusal') {
      if (this.events.some((e) => e.tenant_id === args.want_tenant && e.request_id === args.want_request_id)) return { data: false, error: null };
      this.events.push({ tenant_id: args.want_tenant, request_id: args.want_request_id, outcome: 'refused', status: args.want_status });
      return { data: true, error: null };
    }
    return { data: null, error: { message: `no function ${name}` } };
  }

  table(name: string): Row[] {
    if (name === 'scim_external_identity') return this.identities;
    if (name === 'institution_membership') return this.memberships;
    if (name === 'scim_group_mapping') return this.mappings;
    throw new Error(`no table ${name}`);
  }

  client(): SupabaseClient {
    const db = this;
    const from = (table: string) => {
      const tests: ((r: Row) => boolean)[] = [];
      let window: [number, number] | null = null;
      let url = 0;
      const q = {
        select: () => q,
        order: () => q,
        range: (from: number, to: number) => { window = [from, to]; return q; },
        eq: (k: string, v: unknown) => { tests.push((r) => r[k] === v); return q; },
        in: (k: string, vs: unknown[]) => { url += vs.join(',').length; tests.push((r) => vs.includes(r[k])); return q; },
        overlaps: (k: string, vs: unknown[]) => { url += vs.join(',').length; tests.push((r) => ((r[k] ?? []) as unknown[]).some((x) => vs.includes(x))); return q; },
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
          // PostgREST's two limits: a filter too long for a URL is refused,
          // and no response carries more than max-rows (1,000 on Supabase).
          if (url > FakeDb.URL_LIMIT) return Promise.resolve({ data: null, error: { message: '414 URI Too Long' } }).then(ok, bad);
          const all = db.table(table).filter((r) => tests.every((t) => t(r)));
          const [from, to] = window ?? [0, all.length - 1];
          return Promise.resolve({ data: all.slice(from, to + 1).slice(0, FakeDb.MAX_ROWS).map((r) => ({ ...r })), error: null }).then(ok, bad);
        },
      };
      return q;
    };
    return { from, rpc: async (name: string, args: Row) => db.rpc(name, args) } as unknown as SupabaseClient;
  }
}

function setup() {
  const db = new FakeDb();
  const repository = new PostgresScimRepository({ client: db.client(), publicBaseUrl: 'https://semester.example/api/institution/scim/v2' });
  const service = createScimService({ baseUrl: SCIM_INTERNAL_BASE, repository, rateLimiter: { allow: async () => true } });
  const call = (method: string, path: string, body?: unknown, key = `req-${Math.random()}`, bearer = `Bearer ${CRED}.${SECRET}`) =>
    service(new Request(`${SCIM_INTERNAL_BASE}${path}`, {
      method,
      headers: { authorization: bearer, 'content-type': 'application/scim+json', 'idempotency-key': key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
  return { db, repository, call };
}

const user = (externalId: string | undefined, userName: string, active = true) => ({
  schemas: [SCIM_USER_SCHEMA], ...(externalId ? { externalId } : {}), userName, active,
});

describe('the Postgres SCIM repository, through the service', () => {
  it('reads PostgREST bytea, and refuses anything that is not', () => {
    expect(Buffer.from(byteaToBytes('\\x00ff')).toString('hex')).toBe('00ff');
    expect(() => byteaToBytes('00ff')).toThrow();
    expect(() => byteaToBytes(null)).toThrow();
  });

  it('authenticates against the stored salted hash, and refuses a wrong secret', async () => {
    const { call } = setup();
    expect((await call('GET', '/Users')).status).toBe(200);
    expect((await call('GET', '/Users', undefined, 'k', `Bearer ${CRED}.${'x'.repeat(44)}`)).status).toBe(401);
    expect((await call('GET', '/Users', undefined, 'k', `Bearer ${OTHER_CRED}.${SECRET}`)).status).toBe(401);
  });

  it('creates a user whose id is the membership, at the public location', async () => {
    const { call, db } = setup();
    const made = await call('POST', '/Users', user('ext-1', 'Ada@Northstar.example'));
    expect(made.status).toBe(201);
    const body = await made.json() as Row;
    expect(body.id).toBe(db.memberships[0].id);
    expect(body.userName).toBe('ada@northstar.example');
    expect((body.meta as Row).location).toBe(`https://semester.example/api/institution/scim/v2/Users/${db.memberships[0].id}`);
    const byName = await (await call('GET', `/Users?filter=${encodeURIComponent('userName eq "ADA@northstar.example"')}`)).json() as Row;
    expect(byName.totalResults).toBe(1);
  });

  it('refuses a user with no externalId as a 400, not a 503', async () => {
    const { call, db } = setup();
    const res = await call('POST', '/Users', user(undefined, 'nobody@northstar.example'), 'no-ext');
    expect(res.status).toBe(400);
    expect(db.rpcs.some((r) => r.name === 'scim_gateway_provision_user')).toBe(false);
    expect(db.events).toContainEqual(expect.objectContaining({ request_id: 'no-ext', outcome: 'refused', status: 400 }));
  });

  it('refuses to change a user’s externalId, which would make a second person', async () => {
    const { call, db } = setup();
    const id = (await (await call('POST', '/Users', user('ext-1', 'ada@northstar.example'))).json() as Row).id;
    const res = await call('PUT', `/Users/${id}`, user('ext-2', 'ada@northstar.example'));
    expect(res.status).toBe(400);
    expect(db.identities).toHaveLength(1);
  });

  it('deactivates on DELETE through the provisioning function, keeping the record', async () => {
    const { call, db } = setup();
    const id = (await (await call('POST', '/Users', user('ext-1', 'ada@northstar.example'))).json() as Row).id;
    expect((await call('DELETE', `/Users/${id}`)).status).toBe(204);
    expect(db.identities[0].active).toBe(false);
    expect(db.rpcs.filter((r) => r.name === 'scim_gateway_provision_user').at(-1)?.args.want_active).toBe(false);
  });

  it('answers a malformed id as not found rather than sending it to the database', async () => {
    const { call, db } = setup();
    expect((await call('GET', '/Users/not-a-uuid')).status).toBe(404);
    expect((await call('GET', '/Groups/not-a-uuid')).status).toBe(404);
    expect(db.rpcs.every((r) => r.name === 'scim_gateway_credential')).toBe(true);
  });
});

describe('groups are the administrator’s mappings', () => {
  it('lists only this tenant’s mapped groups, with their members', async () => {
    const { call } = setup();
    const id = (await (await call('POST', '/Users', user('ext-1', 'ada@northstar.example'))).json() as Row).id;
    const group = { schemas: [SCIM_GROUP_SCHEMA], externalId: 'grp-advisors', displayName: 'Advisors', members: [{ value: id }] };
    expect((await call('POST', '/Groups', group)).status).toBe(201);
    const list = await (await call('GET', '/Groups')).json() as { Resources: Row[] };
    expect(list.Resources.map((g) => g.displayName)).toEqual(['Advisors']);
    expect(list.Resources[0].members).toEqual([{ value: id, display: 'ada@northstar.example' }]);
  });

  it('refuses an unmapped group with a 400 that says who can fix it, after the attempt is recorded', async () => {
    const { call, db } = setup();
    const res = await call('POST', '/Groups', { schemas: [SCIM_GROUP_SCHEMA], externalId: 'grp-new', displayName: 'New', members: [] }, 'unmapped');
    expect(res.status).toBe(400);
    expect((await res.json() as Row).detail).toMatch(/administrator/);
    expect(db.events.filter((e) => e.request_id === 'unmapped')).toEqual([expect.objectContaining({ outcome: 'unknown_group' })]);
  });

  it('refuses a member who is not this university’s SCIM user', async () => {
    const { call, db } = setup();
    db.identities.push({ membership_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', tenant_id: 'cedar', external_id: 'cedar-1', user_name: 'c', active: true, group_external_ids: [] });
    const res = await call('POST', '/Groups', { schemas: [SCIM_GROUP_SCHEMA], externalId: 'grp-advisors', displayName: 'Advisors', members: [{ value: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }] });
    expect(res.status).toBe(400);
    expect(db.rpcs.some((r) => r.name === 'scim_gateway_replace_group')).toBe(false);
  });

  it('empties a group on DELETE and leaves the mapping in place', async () => {
    const { call, db } = setup();
    const id = (await (await call('POST', '/Users', user('ext-1', 'ada@northstar.example'))).json() as Row).id;
    const group = await (await call('POST', '/Groups', { schemas: [SCIM_GROUP_SCHEMA], externalId: 'grp-advisors', displayName: 'Advisors', members: [{ value: id }] })).json() as Row;
    expect((await call('DELETE', `/Groups/${group.id}`)).status).toBe(204);
    expect(db.identities[0].group_external_ids).toEqual([]);
    expect(db.mappings).toHaveLength(2);
  });

  it('patches membership through the same mapping', async () => {
    const { call } = setup();
    const id = (await (await call('POST', '/Users', user('ext-1', 'ada@northstar.example'))).json() as Row).id;
    const group = await (await call('POST', '/Groups', { schemas: [SCIM_GROUP_SCHEMA], externalId: 'grp-advisors', displayName: 'Advisors', members: [] })).json() as Row;
    const res = await call('PATCH', `/Groups/${group.id}`, { schemas: [SCIM_PATCH_SCHEMA], Operations: [{ op: 'replace', path: 'members', value: [{ value: id }] }] });
    expect(res.status).toBe(200);
    expect((await res.json() as Row).members).toEqual([{ value: id, display: 'ada@northstar.example' }]);
  });
});

describe('a credential that is no longer live', () => {
  it('is refused, and the refusal is recorded against its tenant', async () => {
    const { db, call } = setup();
    const res = await call('POST', '/Users', user('ext-late', 'late@example.edu'), 'req-revoked', `Bearer ${REVOKED}.${SECRET}`);
    expect(res.status).toBe(401);
    expect(db.rpcs.some((r) => r.name === 'scim_gateway_provision_user')).toBe(false);
    const refusal = db.rpcs.find((r) => r.name === 'scim_gateway_record_refusal');
    expect(refusal?.args).toMatchObject({ want_tenant: TENANT, want_credential: REVOKED, want_request_id: 'req-revoked', want_status: 401 });
  });

  it('control: an unknown credential is refused with nothing to record it against', async () => {
    const { db, call } = setup();
    const res = await call('POST', '/Users', user('ext-x', 'x@example.edu'), 'req-unknown', `Bearer dddddddd-dddd-4ddd-8ddd-dddddddddddd.${SECRET}`);
    expect(res.status).toBe(401);
    expect(db.rpcs.some((r) => r.name === 'scim_gateway_record_refusal')).toBe(false);
  });
});

describe('a directory larger than one PostgREST response', () => {
  // 1,205 people: past max-rows, and far past what fits in one URL as ids.
  function seedDirectory(db: FakeDb, n: number) {
    for (let k = 0; k < n; k++) {
      const id = `cccccccc-cccc-4ccc-8ccc-${String(k).padStart(12, '0')}`;
      db.identities.push({ membership_id: id, tenant_id: TENANT, external_id: `ext-${k}`, user_name: `u${k}@example.edu`, active: true, group_external_ids: ['grp-advisors'], created_at: '2026-09-27T00:00:00Z', updated_at: '2026-09-27T00:00:00Z' });
      db.memberships.push({ id, tenant_id: TENANT, roles: ['student'] });
    }
  }

  it('counts and pages every user, not the first thousand', async () => {
    const { db, call } = setup();
    seedDirectory(db, 1205);
    const last = await (await call('GET', '/Users?startIndex=1201&count=10')).json() as { totalResults: number; Resources: { userName: string; roles?: unknown }[] };
    expect(last.totalResults).toBe(1205);
    expect(last.Resources.map((r) => r.userName)).toEqual(['u1200@example.edu', 'u1201@example.edu', 'u1202@example.edu', 'u1203@example.edu', 'u1204@example.edu']);
  });

  it('lists every member of a large group', async () => {
    const { db, call } = setup();
    seedDirectory(db, 1205);
    const groups = await (await call('GET', '/Groups')).json() as { Resources: { displayName: string; members: unknown[] }[] };
    expect(groups.Resources.find((g) => g.displayName === 'Advisors')?.members).toHaveLength(1205);
  });

  it('control: the fake really does cap a response at max-rows', async () => {
    const db = new FakeDb();
    seedDirectory(db, 1205);
    const { data } = await db.client().from('scim_external_identity').select('*');
    expect((data as Row[]).length).toBe(FakeDb.MAX_ROWS);
  });
});

describe('auditing', () => {
  it('does not write a second event for an accepted write, which audited itself', async () => {
    const { call, db } = setup();
    await call('POST', '/Users', user('ext-1', 'ada@northstar.example'), 'once');
    expect(db.events.filter((e) => e.request_id === 'once')).toHaveLength(1);
    expect(db.rpcs.some((r) => r.name === 'scim_gateway_record_refusal')).toBe(false);
  });

  it('keeps answering the client when a refusal cannot be recorded', async () => {
    const db = new FakeDb();
    const client = db.client();
    const failing = { ...client, rpc: async (name: string, args: Row) => name === 'scim_gateway_record_refusal' ? { data: null, error: { message: 'down' } } : db.rpc(name, args) } as unknown as SupabaseClient;
    const repository = new PostgresScimRepository({ client: failing, publicBaseUrl: 'https://semester.example/scim/v2' });
    const service = createScimService({ baseUrl: SCIM_INTERNAL_BASE, repository, rateLimiter: { allow: async () => true } });
    const res = await service(new Request(`${SCIM_INTERNAL_BASE}/Users`, {
      method: 'POST', headers: { authorization: `Bearer ${CRED}.${SECRET}`, 'idempotency-key': 'k' }, body: JSON.stringify(user(undefined, 'x')),
    }));
    expect(res.status).toBe(400);
  });
});

describe('mounting', () => {
  const gateway = async () => new Response('gateway', { status: 404 });

  it('is off unless SEMESTER_SCIM=on, and then /scim/v2 is just another gateway path', async () => {
    expect(createProductionScim({}, { url: 'https://x.supabase.co', serviceKey: 'k' })).toBeNull();
    expect(createProductionScim({ SEMESTER_SCIM: 'true' }, { url: 'https://x.supabase.co', serviceKey: 'k' })).toBeNull();
    const handler = withScim(gateway, null);
    expect(await (await handler(new Request('http://institution.internal/scim/v2/Users'))).text()).toBe('gateway');
  });

  it('refuses to start on without a public URL, rather than guessing one', () => {
    expect(() => createProductionScim({ SEMESTER_SCIM: 'on' }, { url: 'https://x.supabase.co', serviceKey: 'k' })).toThrow(/SEMESTER_SCIM_PUBLIC_URL/);
    expect(() => createProductionScim({ SEMESTER_SCIM: 'on', SEMESTER_SCIM_PUBLIC_URL: 'http://scim.example/v2' }, { url: 'https://x.supabase.co', serviceKey: 'k' })).toThrow(/HTTPS/);
  });

  it('routes /scim/v2 to SCIM on the internal base, and everything else to the gateway', async () => {
    const seen: string[] = [];
    const scim = async (request: Request) => { seen.push(`${request.method} ${request.url} ${await request.text()}`); return new Response(null, { status: 204 }); };
    const handler = withScim(gateway, scim);
    await handler(new Request('http://institution.internal/scim/v2/Users?filter=x', { method: 'POST', body: '{"a":1}' }));
    expect(seen).toEqual([`POST ${SCIM_INTERNAL_BASE}/Users?filter=x {"a":1}`]);
    expect((await handler(new Request('http://institution.internal/v1/me'))).status).toBe(404);
    expect((await handler(new Request('http://institution.internal/scim/v2x'))).status).toBe(404);
    expect(seen).toHaveLength(1);
  });
});
