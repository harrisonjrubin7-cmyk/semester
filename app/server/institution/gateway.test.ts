import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  UNIVERSITY_AREAS,
  type UniversityIdentity,
  type UniversityRecord,
} from '../../../packages/institution/src/index.ts';
import type { InstitutionAdapter } from './adapter.ts';
import { trustedIdentity } from './auth.ts';
import { createGateway } from './gateway.ts';
import { ActionJournal } from './journal.ts';

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
  journals.splice(0).forEach((journal) => journal.close());
  dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'semester-gateway-'));
  dirs.push(dir);
  const path = join(dir, 'test.sqlite');
  const journal = new ActionJournal(path, key);
  journals.push(journal);

  let identity: UniversityIdentity | null = actor;
  let version = '1';
  let calls = 0;
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
    review: async () => ({ title: reviewTitle, details: [{ label: 'Action', value: 'Submit coursework' }] }),
    execute: async () => {
      calls++;
      // The message a vendor failure carries must never reach the student.
      if (mode === 'timeout') throw new Error('Vendor secret must not be exposed');
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
    adapters: [adapter],
    journal,
  });

  const input = {
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
    journal,
    path,
    input,
    request,
    prepare,
    calls: () => calls,
    identity: (v: UniversityIdentity | null) => {
      identity = v;
    },
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
  it('does not accept role claims from editable user metadata', () => {
    expect(
      trustedIdentity({ id: 'u', ...{ user_metadata: { semester: { institutionId: 's', roles: ['admin'] } } } }),
    ).toBeNull();
    expect(trustedIdentity({ id: 'u', app_metadata: { semester: { institutionId: 's', roles: ['invented', 'advisor'] } } })).toEqual(
      { userId: 'u', institutionId: 's', roles: ['advisor'] },
    );
  });

  it('requires a verified identity and rejects arbitrary web origins', async () => {
    const f = fixture();
    expect((await f.request('/status', undefined, { authorization: '' })).status).toBe(401);
    f.identity(null);
    expect((await f.request('/status')).status).toBe(403);
    expect((await f.request('/status', undefined, { origin: 'https://elsewhere.test' })).status).toBe(403);
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
