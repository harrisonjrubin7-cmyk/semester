import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mock.createClient }));

import { publishGuidance } from './publish-guidance.ts';

const config = { supabaseUrl: 'https://project.example.co', publicClientKey: 'publishable-key' };
const commandId = '4f1f8c2e-6a3b-4c1d-9e2f-0a1b2c3d4e5f';
const validCommand = {
  commandId,
  schoolId: 'school-1',
  courseCode: 'ECON 1020',
  term: '2026FA',
  body: 'Do the problem sets before office hours.',
  expectedVersion: 0,
  confirmed: true,
};

function request(body: unknown, init: { method?: string; auth?: string | null; type?: string } = {}) {
  const headers = new Headers({ 'content-type': init.type ?? 'application/json' });
  if (init.auth !== null) headers.set('authorization', init.auth ?? 'Bearer caller-token');
  const method = init.method ?? 'POST';
  return new Request('https://api.example.edu/guidance', {
    method,
    headers,
    body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function call(req: Request) {
  const res = await publishGuidance(req, config);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  mock.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'faculty-1' } }, error: null });
  mock.rpc.mockReset().mockResolvedValue({ data: 2, error: null });
  mock.createClient.mockReset().mockReturnValue({ auth: { getUser: mock.getUser }, rpc: mock.rpc });
});

describe('publishGuidance request handling', () => {
  it('refuses anything but POST before reading the body', async () => {
    expect(await call(request(validCommand, { method: 'GET' }))).toEqual({
      status: 405,
      body: { error: 'method_not_allowed' },
    });
    expect(mock.createClient).not.toHaveBeenCalled();
  });

  it('requires a bearer token and never reaches the database without one', async () => {
    expect((await call(request(validCommand, { auth: null }))).status).toBe(401);
    expect((await call(request(validCommand, { auth: 'Basic abc' }))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('requires JSON', async () => {
    expect((await call(request(validCommand, { type: 'text/plain' }))).status).toBe(415);
  });

  it('refuses a body over 24,000 bytes', async () => {
    const big = { ...validCommand, body: 'a'.repeat(24001) };
    expect((await call(request(big))).status).toBe(413);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('refuses malformed JSON and non-object bodies', async () => {
    expect((await call(request('{not json'))).body).toEqual({ error: 'invalid_json' });
    expect((await call(request('[]'))).body).toEqual({ error: 'invalid_command' });
  });

  it('refuses body fields the command does not define, so a caller cannot inject a role or actor', async () => {
    const injected = { ...validCommand, actorId: 'admin-1', role: 'registrar' };
    expect(await call(request(injected))).toEqual({ status: 400, body: { error: 'invalid_command' } });
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('refuses a command that is not confirmed', async () => {
    expect((await call(request({ ...validCommand, confirmed: false }))).status).toBe(400);
  });

  it.each([
    ['a non-UUID command id', { commandId: 'not-a-uuid' }],
    ['a term outside the pattern', { term: '2026XX' }],
    ['a body over 4000 characters', { body: 'x'.repeat(4001) }],
    ['a negative expected version', { expectedVersion: -1 }],
    ['a fractional expected version', { expectedVersion: 1.5 }],
    ['an empty school', { schoolId: '   ' }],
  ])('refuses %s', async (_label, override) => {
    expect((await call(request({ ...validCommand, ...override }))).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});

describe('publishGuidance outcomes', () => {
  it('returns the published version and calls the caller-scoped RPC with the caller token', async () => {
    const res = await call(request(validCommand));
    expect(res).toEqual({ status: 200, body: { commandId, state: 'published', version: 2 } });
    expect(mock.createClient).toHaveBeenCalledWith(
      config.supabaseUrl,
      config.publicClientKey,
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer caller-token' } },
      }),
    );
    expect(mock.rpc).toHaveBeenCalledWith('publish_course_guidance_once', {
      want_command: commandId,
      want_school: 'school-1',
      want_course: 'ECON 1020',
      want_term: '2026FA',
      want_body: validCommand.body,
      want_expected_version: 0,
    });
  });

  it('answers 401 when the token does not identify a user', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
    expect((await call(request(validCommand))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['42501', 403, 'not_permitted'],
    ['40001', 409, 'review_current_version'],
    ['23514', 400, 'invalid_command'],
    ['22P02', 400, 'invalid_command'],
  ])('maps database error %s to %i %s', async (code, status, error) => {
    mock.rpc.mockResolvedValue({ data: null, error: { code, message: 'refused' } });
    expect(await call(request(validCommand))).toEqual({ status, body: { error } });
  });

  it('reports an unconfirmed outcome for any other database failure, keeping the command id to retry with', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '08006', message: 'connection lost' } });
    expect(await call(request(validCommand))).toEqual({
      status: 503,
      body: { error: 'outcome_unconfirmed', commandId },
    });
  });

  it('reports an unconfirmed outcome when the database answers with no version', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: null });
    expect((await call(request(validCommand))).body).toEqual({
      error: 'outcome_unconfirmed',
      commandId,
    });
  });

  it('reports an unconfirmed outcome when the client throws', async () => {
    mock.rpc.mockRejectedValue(new Error('socket hang up'));
    expect((await call(request(validCommand))).status).toBe(503);
  });

  it('never echoes the caller token or the raw database message', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'secret detail' } });
    const res = await call(request(validCommand));
    expect(JSON.stringify(res.body)).not.toMatch(/caller-token|secret detail/);
  });
});
