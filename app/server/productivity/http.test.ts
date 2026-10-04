import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter } from '../institution/rate-limit.ts';
import { POLICY_ACTIONS } from '../../../packages/institution/src/index.ts';
import { API_VERSION, decodeCursor, encodeCursor } from './contract.ts';
import { ALICE, BOB, EVENT_ID, T0, TASK_ID, cmd, createEvent, createTask, harness, person, shareGrant } from './fixtures.ts';
import { MAX_BODY_BYTES, ROUTES, createProductivityApi, type ErrorEnvelope } from './http.ts';
import { Metrics, createOpsHandler, instrument } from './ops.ts';
import type { Principal } from './service.ts';

const people: Record<string, Principal> = {
  alice: person(ALICE),
  bob: person(BOB, 'school-a', { consentGrantsFor: (o) => (o === ALICE ? [shareGrant()] : []) }),
};

function setup(over: { limiters?: { read: MemoryRateLimiter; write: MemoryRateLimiter } } = {}) {
  const h = harness();
  const seen: { route: string; status: number }[] = [];
  const api = createProductivityApi({
    service: h.service,
    authenticate: async (req) => people[(/^Bearer (\w+)$/.exec(req.headers.get('authorization') ?? '') ?? [])[1] ?? ''] ?? null,
    telemetry: (e) => void seen.push({ route: e.route, status: e.status }),
    now: () => T0,
    ...over,
  });
  const call = (path: string, init: RequestInit & { as?: string } = {}) => {
    const { as = 'alice', headers, ...rest } = init;
    return api(new Request(`http://api.test${path}`, { ...rest, headers: { authorization: `Bearer ${as}`, ...(headers as Record<string, string>) } }));
  };
  const post = (commands: unknown[], init: { as?: string; headers?: Record<string, string> } = {}) =>
    call('/v1/productivity/commands', { method: 'POST', as: init.as ?? 'alice', headers: { 'content-type': 'application/json', ...init.headers }, body: JSON.stringify({ commands }) });
  return { h, api, call, post, seen };
}

const errorOf = async (r: Response) => (await r.json()) as ErrorEnvelope;

describe('the envelope, the ids, and who is asking', () => {
  it('refuses an unknown caller before it reads anything, in the one error shape', async () => {
    const { api, seen } = setup();
    const r = await api(new Request('http://api.test/v1/tasks'));
    expect(r.status).toBe(401);
    const body = await errorOf(r);
    expect(body.error).toMatchObject({ code: 'unauthenticated', retryable: false });
    expect(body.error.user_action).toMatchObject({ kind: 'open_screen' });
    expect(body.message).toBe(body.error.message);
    expect(r.headers.get('www-authenticate')).toBe('Bearer');
    expect(seen).toEqual([{ route: '/v1/tasks', status: 401 }]);
  });

  it('sets a request id of its own and the API version on every response', async () => {
    const { call } = setup();
    const r = await call('/v1/tasks', { headers: { 'x-request-id': 'attacker-chosen' } });
    expect(r.headers.get('x-request-id')).not.toBe('attacker-chosen');
    expect(r.headers.get('semester-api-version')).toBe(API_VERSION);
    expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('echoes a well-formed correlation id and replaces five malformed ones', async () => {
    const { call } = setup();
    expect((await call('/v1/tasks', { headers: { 'x-correlation-id': 'trace-0123456789' } })).headers.get('x-correlation-id')).toBe('trace-0123456789');
    for (const bad of ['short', 'has space in it', 'x'.repeat(129), '<script>alert(1)</script>', 'new\u0000line-id-here']) {
      let got: string | null = null;
      try {
        got = (await call('/v1/tasks', { headers: { 'x-correlation-id': bad } })).headers.get('x-correlation-id');
      } catch {
        // A header Node itself refuses cannot reach the server at all.
        continue;
      }
      expect(got).not.toBe(bad);
      expect(got).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    }
  });

  it('writes the correlation id it was given onto the audit row and the event', async () => {
    const { post, h } = setup();
    await post([createTask()], { headers: { 'x-correlation-id': 'trace-0123456789' } });
    expect(h.repo.auditRows[0]!.correlationId).toBe('trace-0123456789');
    expect(h.repo.outbox.rows[0]!.event.correlationId).toBe('trace-0123456789');
  });

  it('says 404 for an unknown path and 405, with Allow, for a wrong method', async () => {
    const { call } = setup();
    expect((await call('/v1/nothing')).status).toBe(404);
    const r = await call('/v1/productivity/commands');
    expect(r.status).toBe(405);
    expect(r.headers.get('allow')).toBe('POST');
    expect((await call('/v2/tasks')).status).toBe(404);
  });
});

describe('commands', () => {
  it('applies a batch and answers per command', async () => {
    const { post, call } = setup();
    const r = await post([createTask(), createEvent()]);
    expect(r.status).toBe(200);
    expect((await r.json()).results.map((x: { status: string }) => x.status)).toEqual(['applied', 'applied']);
    expect(((await (await call('/v1/tasks')).json()).data)).toHaveLength(1);
  });

  it('answers a resent batch with duplicates, byte for byte the same intent', async () => {
    const { post } = setup();
    const batch = [createTask()];
    await post(batch);
    expect((await (await post(batch)).json()).results[0]).toMatchObject({ status: 'duplicate', original: { status: 'applied' } });
  });

  it('reports a refused command beside an applied one, rather than failing the batch', async () => {
    const { post } = setup();
    const r = (await (await post([createTask(), { type: 'task.create', commandId: 'nope' }])).json()).results;
    expect(r.map((x: { status: string }) => x.status)).toEqual(['applied', 'rejected']);
    expect(r[1]).toMatchObject({ code: 'validation_failed' });
  });

  it.each([
    ['text/plain', 'x', 415, 'unsupported_media_type'],
    ['application/json', '{not json', 400, 'invalid_json'],
    ['application/json', '[]', 400, 'validation_failed'],
    ['application/json', JSON.stringify({ commands: [] }), 400, 'validation_failed'],
    ['application/json', JSON.stringify({ commands: [], extra: 1 }), 400, 'validation_failed'],
    ['application/json', JSON.stringify({ commands: Array.from({ length: 51 }, () => ({})) }), 400, 'validation_failed'],
    ['application/json', JSON.stringify({ commands: ['x'.repeat(MAX_BODY_BYTES)] }), 413, 'payload_too_large'],
  ])('refuses a %s body that is not a command batch (%#)', async (type, body, status, code) => {
    const { call } = setup();
    const r = await call('/v1/productivity/commands', { method: 'POST', headers: { 'content-type': type }, body });
    expect(r.status).toBe(status);
    expect((await errorOf(r)).error.code).toBe(code);
  });

  it('weighs a large batch against the rate limit', async () => {
    const limiters = { read: new MemoryRateLimiter({ windowMs: 60_000, max: 100 }), write: new MemoryRateLimiter({ windowMs: 60_000, max: 4 }) };
    const { post } = setup({ limiters });
    const forty = Array.from({ length: 40 }, (_, i) => createTask({ title: `t${i}` }, { at: T0 + i }) as never);
    // 40 commands cost 4 tokens; a fifth token is not there for the next request.
    expect((await post(forty)).status).toBe(200);
    const again = await post([createTask()]);
    expect(again.status).toBe(429);
    expect(again.headers.get('retry-after')).toBe('60');
    expect(await errorOf(again)).toMatchObject({ error: { code: 'rate_limited', retryable: true } });
  });

  it('never lets a person name another owner in the URL, the query or the body', async () => {
    const { post, call, h } = setup();
    await post([createTask()], { as: 'bob' });
    const r = await call(`/v1/productivity/commands?owner_id=${ALICE}`, { method: 'POST', as: 'bob', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commands: [cmd({ type: 'task.delete', id: TASK_ID }, { at: T0 + 1 })] }) });
    expect(r.status).toBe(200);
    expect(h.repo.auditRows.every((a) => a.ownerId === BOB)).toBe(true);
  });

  it('answers an unexpected failure with no detail and says the outcome is unknown', async () => {
    const { h, call } = setup();
    h.repo.faults.read = new Error('password=hunter2 at db.internal:5432');
    const r = await call('/v1/productivity/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commands: [createTask()] }) });
    // The write path catches store failures per command...
    expect(r.status).toBe(200);
    // ...and a failure outside it, like a job with no owner, is a 500 that leaks nothing.
    const jobApi = createProductivityApi({ service: h.service, authenticate: async () => ({ ...people.alice!, actor: { id: 'job', type: 'integration', authenticatedAt: new Date(T0).toISOString() } }) });
    const boom = await jobApi(new Request('http://api.test/v1/productivity/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commands: [createTask()] }) }));
    expect(boom.status).toBe(500);
    const body = await errorOf(boom);
    expect(body.error).toMatchObject({ code: 'internal', retryable: false, outcome_known: false });
    expect(JSON.stringify(body)).not.toMatch(/whose data|password|hunter2|db\.internal/);
  });
});

describe('queries', () => {
  const seed = async (s: ReturnType<typeof setup>) => {
    await s.post(Array.from({ length: 5 }, (_, i) => cmd({ type: 'task.create', id: `00000000-0000-4000-8000-00000000000${i}`, fields: { title: `t${i}`, dueAt: `2026-10-0${i + 1}T12:00:00Z` } }, { at: T0 + i })));
  };

  it('pages by cursor without overlap, and says when there is no more', async () => {
    const s = setup();
    await seed(s);
    const first = await (await s.call('/v1/tasks?limit=2')).json();
    expect(first.data.map((t: { title: string }) => t.title)).toEqual(['t0', 't1']);
    expect(first.page.has_more).toBe(true);
    const second = await (await s.call(`/v1/tasks?limit=2&cursor=${first.page.next_cursor}`)).json();
    expect(second.data.map((t: { title: string }) => t.title)).toEqual(['t2', 't3']);
    const third = await (await s.call(`/v1/tasks?limit=2&cursor=${second.page.next_cursor}`)).json();
    expect(third).toMatchObject({ data: [{ title: 't4' }], page: { has_more: false, next_cursor: null } });
  });

  it('does not let a forged cursor reach another person\'s rows', async () => {
    const s = setup();
    await seed(s);
    await s.post([createTask({ title: 'bob only' })], { as: 'bob' });
    const forged = encodeCursor({ k: 'k', key: '0000-01-01T00:00:00.000Z', id: '00000000-0000-4000-8000-000000000000' });
    const r = await (await s.call(`/v1/tasks?cursor=${forged}`)).json();
    expect(r.data.map((t: { title: string }) => t.title)).not.toContain('bob only');
    expect(r.data).toHaveLength(5);
  });

  it.each([
    ['a cursor that is not ours', '/v1/tasks?cursor=not-a-cursor!'],
    ['a sync cursor on a list', `/v1/tasks?cursor=${encodeCursor({ k: 's', seq: 1 })}`],
    ['an unknown parameter', '/v1/tasks?sort=title'],
    ['a limit over the maximum', '/v1/tasks?limit=201'],
    ['a limit that is not a number', '/v1/tasks?limit=ten'],
    ['an unknown status', '/v1/tasks?status=maybe'],
    ['a date with no zone', '/v1/tasks?due_before=2026-10-08T17:00:00'],
    ['an owner that is not a UUID', '/v1/tasks?owner_id=alice'],
    ['a calendar window with no bounds', '/v1/calendar/events'],
    ['a calendar window that runs backwards', '/v1/calendar/events?from=2026-10-08T00:00:00Z&to=2026-10-01T00:00:00Z'],
    ['a calendar window over a year', '/v1/calendar/events?from=2026-01-01T00:00:00Z&to=2027-06-01T00:00:00Z'],
    ['an agenda window over sixty-two days', '/v1/agenda?from=2026-10-01T00:00:00Z&to=2026-12-31T00:00:00Z'],
  ])('refuses %s', async (_name, path) => {
    const s = setup();
    const r = await s.call(path);
    expect(r.status).toBe(400);
    expect((await errorOf(r)).error).toMatchObject({ code: 'validation_failed', retryable: false });
    expect((await s.call('/v1/tasks')).status).toBe(200);
  });

  it('serves one record with an ETag, and 304 when it has not changed', async () => {
    const s = setup();
    await s.post([createTask()]);
    const r = await s.call(`/v1/tasks/${TASK_ID}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('etag')).toBe('"v1"');
    expect(r.headers.get('cache-control')).toBe('private, no-cache');
    expect(await r.json()).not.toHaveProperty('clocks');
    expect((await s.call(`/v1/tasks/${TASK_ID}`, { headers: { 'if-none-match': '"v1"' } })).status).toBe(304);
    await s.post([cmd({ type: 'task.update', id: TASK_ID, changes: { title: 'B' } }, { at: T0 + 1 })]);
    expect((await s.call(`/v1/tasks/${TASK_ID}`, { headers: { 'if-none-match': '"v1"' } })).status).toBe(200);
  });

  it('says not-found for another person\'s record and for an id that is not an id', async () => {
    const s = setup();
    await s.post([createTask()]);
    expect((await s.call(`/v1/tasks/${TASK_ID}`, { as: 'bob' })).status).toBe(404);
    expect((await s.call('/v1/tasks/..%2Fadmin')).status).toBe(404);
    expect((await s.call('/v1/calendar/events/not-a-uuid')).status).toBe(404);
  });

  it('shows a shared list only with a purpose, and only the shared fields', async () => {
    const s = setup();
    await s.post([createTask()]);
    const without = await s.call(`/v1/tasks?owner_id=${ALICE}`, { as: 'bob' });
    expect(without.status).toBe(403);
    expect((await errorOf(without)).error.code).toBe('purpose_missing');
    const withPurpose = await s.call(`/v1/tasks?owner_id=${ALICE}`, { as: 'bob', headers: { 'x-semester-purpose': 'advising check-in' } });
    expect(withPurpose.status).toBe(200);
    expect((await withPurpose.json()).data[0]).not.toHaveProperty('notes');
  });

  it.each(['x'.repeat(201), 'two\nlines'])('refuses a purpose header that is not plain bounded text (%#)', async (purpose) => {
    const s = setup();
    // Node's Headers refuses a newline outright; the length case reaches the handler.
    let status = 400;
    try {
      status = (await s.call('/v1/tasks', { headers: { 'x-semester-purpose': purpose } })).status;
    } catch {
      status = 400;
    }
    expect(status).toBe(400);
  });

  it('serves the agenda and the sync feed', async () => {
    const s = setup();
    await s.post([createTask({ dueAt: '2026-10-06T21:00:00Z' }), createEvent()]);
    const agenda = await (await s.call('/v1/agenda?from=2026-10-06T00:00:00Z&to=2026-10-07T00:00:00Z')).json();
    expect(agenda.data.map((d: { type: string }) => d.type)).toEqual(['calendar_event', 'task']);
    const feed = await (await s.call('/v1/productivity/changes')).json();
    expect(feed.data.map((d: { seq: number }) => d.seq)).toEqual([1, 2]);
    const after = await (await s.call(`/v1/productivity/changes?after=${feed.page.next_cursor}`)).json();
    expect(after.data).toEqual([]);
    expect(decodeCursor(feed.page.next_cursor, 's')).toEqual({ k: 's', seq: 2 });
  });

  it('answers a store failure with a retryable 503 that leaks nothing', async () => {
    const s = setup();
    s.h.repo.faults.read = new Error('password=hunter2 at db.internal:5432');
    const r = await s.call('/v1/tasks');
    expect(r.status).toBe(503);
    const body = await errorOf(r);
    expect(body.error).toMatchObject({ code: 'unavailable', retryable: true });
    expect(JSON.stringify(body)).not.toMatch(/hunter2|db\.internal/);
  });

  it('limits reads separately from writes', async () => {
    const limiters = { read: new MemoryRateLimiter({ windowMs: 60_000, max: 2 }), write: new MemoryRateLimiter({ windowMs: 60_000, max: 100 }) };
    const s = setup({ limiters });
    expect([(await s.call('/v1/tasks')).status, (await s.call('/v1/tasks')).status, (await s.call('/v1/tasks')).status]).toEqual([200, 200, 429]);
    expect((await s.post([createTask()])).status).toBe(200);
    expect((await s.call('/v1/tasks', { as: 'bob' })).status).toBe(200);
  });
});

describe('every endpoint asks the policy decision point', () => {
  const W = 'from=2026-10-06T00:00:00Z&to=2026-10-07T00:00:00Z';
  const call: Record<string, (s: ReturnType<typeof setup>) => Promise<Response>> = {
    commands: (s) => s.post([createTask(), createEvent()]),
    changes: (s) => s.call('/v1/productivity/changes'),
    'tasks.list': (s) => s.call('/v1/tasks'),
    'tasks.get': (s) => s.call(`/v1/tasks/${TASK_ID}`),
    'events.list': (s) => s.call(`/v1/calendar/events?${W}`),
    'events.get': (s) => s.call(`/v1/calendar/events/${EVENT_ID}`),
    agenda: (s) => s.call(`/v1/agenda?${W}`),
  };

  it('has a case for every route, and every route declares at least one action that exists', () => {
    expect(Object.keys(call).sort()).toEqual(ROUTES.map((r) => r.name).sort());
    for (const r of ROUTES) {
      expect(r.policy.length, r.template).toBeGreaterThan(0);
      for (const a of r.policy) expect(Object.keys(POLICY_ACTIONS), `${r.template} names ${a}`).toContain(a);
    }
  });

  it.each(ROUTES.map((r) => [r.template, r.name] as const))('%s asks every action it declares', async (_t, name) => {
    const s = setup();
    const route = ROUTES.find((r) => r.name === name)!;
    await call[name]!(s);
    const asked = new Set(s.h.decisions.map((d) => d.action));
    for (const a of route.policy) expect(asked, `${route.template} never asked ${a}`).toContain(a);
  });

  it.each(ROUTES.map((r) => [r.template, r.name] as const))('%s serves nothing to a person the decision point refuses', async (_t, name) => {
    people.nobody = person('44444444-4444-4444-8444-444444444444', 'school-a', { membershipIds: [] });
    const s = setup();
    const withNobody = (path: string, init: RequestInit = {}) => s.call(path, { ...init, as: 'nobody' });
    const requests: Record<string, () => Promise<Response>> = {
      commands: () => s.call('/v1/productivity/commands', { as: 'nobody', method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commands: [createTask()] }) }),
      changes: () => withNobody('/v1/productivity/changes'),
      'tasks.list': () => withNobody('/v1/tasks'),
      'tasks.get': () => withNobody(`/v1/tasks/${TASK_ID}`),
      'events.list': () => withNobody(`/v1/calendar/events?${W}`),
      'events.get': () => withNobody(`/v1/calendar/events/${EVENT_ID}`),
      agenda: () => withNobody(`/v1/agenda?${W}`),
    };
    const r = await requests[name]!();
    if (name === 'commands') {
      expect((await r.json()).results[0]).toMatchObject({ status: 'rejected', code: 'membership_missing' });
    } else {
      expect(r.status).toBe(403);
      expect((await errorOf(r)).error.code).toBe('membership_missing');
    }
  });
});

describe('every route, and every way of failing it, carries both ids', () => {
  const PATH: Record<string, string> = {
    commands: '/v1/productivity/commands', changes: '/v1/productivity/changes', 'tasks.list': '/v1/tasks', 'tasks.get': `/v1/tasks/${TASK_ID}`,
    'events.list': '/v1/calendar/events?from=2026-10-06T00:00:00Z&to=2026-10-07T00:00:00Z', 'events.get': `/v1/calendar/events/${EVENT_ID}`, agenda: '/v1/agenda?from=2026-10-06T00:00:00Z&to=2026-10-07T00:00:00Z',
  };
  const ids = (r: Response) => {
    expect(r.headers.get('x-request-id'), 'X-Request-Id').toMatch(/^[0-9a-f-]{36}$/);
    expect(r.headers.get('x-correlation-id'), 'X-Correlation-Id').toMatch(/^[A-Za-z0-9._:-]{8,100}$/);
    expect(r.headers.get('semester-api-version')).toBe(API_VERSION);
  };

  it.each(ROUTES.map((r) => [r.template, r.name, r.method] as const))('%s: on success, 401, 405, 400 and 429', async (_t, name, method) => {
    const s = setup();
    const wrong = method === 'GET' ? 'POST' : 'GET';
    const body = method === 'POST' ? { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commands: [createTask()] }) } : { method };
    ids(await s.call(PATH[name]!, body));
    ids(await s.api(new Request(`http://api.test${PATH[name]}`, { method })));
    const notAllowed = await s.call(PATH[name]!, { method: wrong });
    expect(notAllowed.status).toBe(405);
    ids(notAllowed);
    const bad = await s.call(method === 'POST' ? PATH[name]! : `${PATH[name]!}${PATH[name]!.includes('?') ? '&' : '?'}bogus=1`, method === 'POST' ? { method, headers: { 'content-type': 'text/plain' }, body: 'x' } : { method });
    expect([400, 415]).toContain(bad.status);
    ids(bad);
    const limited = setup({ limiters: { read: new MemoryRateLimiter({ windowMs: 60_000, max: 1 }), write: new MemoryRateLimiter({ windowMs: 60_000, max: 1 }) } });
    await limited.call(PATH[name]!, body);
    const over = await limited.call(PATH[name]!, body);
    expect(over.status).toBe(429);
    ids(over);
    expect((await errorOf(over)).error).toMatchObject({ code: 'rate_limited', retryable: true, retry_after_seconds: 60 });
  });

  it('puts the same ids on a 404 for an unknown path and a 503 from a failing store', async () => {
    const s = setup();
    ids(await s.call('/v1/nothing'));
    s.h.repo.faults.read = new Error('down');
    const r = await s.call('/v1/tasks');
    expect(r.status).toBe(503);
    ids(r);
  });

  it('hands the real error to the hook with the same request id the caller was given', async () => {
    const seen: { message: string; requestId: string; route: string }[] = [];
    const h = harness();
    const api = createProductivityApi({
      service: h.service, authenticate: async () => people.alice!, now: () => T0,
      onError: (e, c) => void seen.push({ message: (e as Error).message, requestId: c.requestId, route: c.route }),
    });
    h.repo.faults.read = new Error('password=hunter2');
    const r = await api(new Request('http://api.test/v1/tasks'));
    expect(seen).toEqual([{ message: 'password=hunter2', requestId: r.headers.get('x-request-id')!, route: '/v1/tasks' }]);
    expect(JSON.stringify(await r.json())).not.toContain('hunter2');
  });
});

describe('what is measured, and what is not', () => {
  it('counts by route template and status, never by id or person', async () => {
    const s = setup();
    await s.post([createTask()]);
    await s.call(`/v1/tasks/${TASK_ID}`);
    await s.call(`/v1/calendar/events/${EVENT_ID}`);
    expect(s.seen.map((x) => x.route)).toEqual(['/v1/productivity/commands', '/v1/tasks/{id}', '/v1/calendar/events/{id}']);
  });
});

describe('operational endpoints', () => {
  const ops = (over: Partial<Parameters<typeof createOpsHandler>[0]> = {}) => {
    const metrics = new Metrics();
    return { metrics, handle: createOpsHandler({ checks: { store: async () => undefined }, metrics, ...over }) };
  };
  const get = (handle: ReturnType<typeof createOpsHandler>, path: string, headers: Record<string, string> = {}) =>
    handle(new Request(`http://ops.test${path}`, { headers }));

  it('answers liveness without asking a dependency anything', async () => {
    const { handle } = ops({ checks: { store: async () => { throw new Error('down'); } } });
    expect((await get(handle, '/healthz'))!.status).toBe(200);
  });

  it('answers readiness from the dependencies, naming which failed and not why', async () => {
    const { handle } = ops({ checks: { store: async () => undefined, bus: async () => { throw new Error('secret connection string'); } } });
    const r = (await get(handle, '/readyz'))!;
    expect(r.status).toBe(503);
    const text = await r.text();
    expect(JSON.parse(text)).toEqual({ status: 'not_ready', checks: { store: 'ok', bus: 'failed' } });
    expect(text).not.toContain('secret');
    expect((await get(ops().handle, '/readyz'))!.status).toBe(200);
  });

  it('treats a dependency that does not answer as down', async () => {
    const { handle } = ops({ checkTimeoutMs: 20, checks: { store: () => new Promise(() => undefined) } });
    expect((await get(handle, '/readyz'))!.status).toBe(503);
  });

  it('does not have a metrics page unless a token is configured, and demands it when there is one', async () => {
    expect((await get(ops().handle, '/metrics'))!.status).toBe(404);
    const { handle, metrics } = ops({ metricsToken: 's3cret-token', gauges: async () => ({ semester_outbox_pending: 3 }) });
    metrics.observeHttp('/v1/tasks/{id}', 200, 0.04);
    metrics.observeCommand('task.create', 'applied');
    expect((await get(handle, '/metrics'))!.status).toBe(401);
    expect((await get(handle, '/metrics', { authorization: 'Bearer wrong' }))!.status).toBe(401);
    const ok = (await get(handle, '/metrics', { authorization: 'Bearer s3cret-token' }))!;
    expect(ok.status).toBe(200);
    const text = await ok.text();
    expect(text).toContain('semester_http_requests_total{route="/v1/tasks/{id}",status="200"} 1');
    expect(text).toContain('semester_commands_total{type="task.create",status="applied"} 1');
    expect(text).toContain('semester_outbox_pending 3');
    expect(text).toMatch(/semester_http_request_duration_seconds_bucket\{route="\/v1\/tasks\/\{id\}",le="0.05"\} 1/);
  });

  it('is wired end to end by one call: requests, commands, decisions and the outbox all reach the scrape', async () => {
    const metrics = new Metrics();
    const h = harness();
    const hooks = instrument(metrics, () => h.service.outboxStats());
    const { ProductivityService } = await import('./service.ts');
    const service = new ProductivityService({ repo: h.repo, now: () => T0, ...hooks.service });
    const api = createProductivityApi({ service, authenticate: async () => people.alice!, telemetry: hooks.telemetry, now: () => T0 });
    await api(new Request('http://api.test/v1/productivity/commands', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commands: [createTask()] }) }));
    await api(new Request(`http://api.test/v1/tasks/${TASK_ID}`));
    const scrape = createOpsHandler({ checks: {}, metrics, metricsToken: 't', gauges: hooks.gauges });
    const text = await (await scrape(new Request('http://ops.test/metrics', { headers: { authorization: 'Bearer t' } })))!.text();
    expect(text).toContain('semester_http_requests_total{route="/v1/productivity/commands",status="200"} 1');
    expect(text).toContain('semester_commands_total{type="task.create",status="applied"} 1');
    expect(text).toContain('semester_policy_decisions_total{action="task.write",outcome="allow"} 1');
    expect(text).toContain('semester_policy_decisions_total{action="task.read",outcome="allow"} 1');
    expect(text).toContain('semester_outbox_pending 1');
    // Nothing a person typed, and nobody's id, is a label or a value.
    expect(text).not.toContain(ALICE);
    expect(text).not.toContain('Read chapter');
  });

  it('passes every other path through, so it can sit in front of the API', async () => {
    expect(await get(ops().handle, '/v1/tasks')).toBeNull();
  });
});
