import { describe, expect, it, vi } from 'vitest';
import { handleClaudeRequest } from '../../../supabase/functions/_shared/claudeauth';

const URL = 'https://semester.example/functions/v1/claude';
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Claude session boundary', () => {
  it.each([
    ['missing authorization', undefined],
    ['wrong scheme', 'Basic claude-token'],
    ['empty bearer', 'Bearer   '],
  ])('rejects %s before authentication or protected generation', async (_name, authorization) => {
    const authenticated = vi.fn(async () => ({ userId: 'student' }));
    const run = vi.fn(async () => new Response('generation'));
    const headers = authorization ? { Authorization: authorization } : undefined;

    const response = await handleClaudeRequest(new Request(URL, { headers }), authenticated, run, reply);

    expect(response.status).toBe(401);
    expect(authenticated).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', async () => null],
    ['unreadable', async () => { throw new Error('auth unavailable'); }],
  ])('rejects an %s session before protected generation', async (_name, check) => {
    const authenticated = vi.fn(check);
    const run = vi.fn(async () => new Response('generation'));

    const response = await handleClaudeRequest(
      new Request(URL, { headers: { Authorization: 'Bearer claude-token' } }),
      authenticated,
      run,
      reply,
    );

    expect(response.status).toBe(401);
    expect(authenticated).toHaveBeenCalledWith('claude-token');
    expect(run).not.toHaveBeenCalled();
  });

  it('runs protected generation only after the exact bearer session is accepted', async () => {
    const session = { userId: 'student' };
    const authenticated = vi.fn(async (token: string) => token === 'claude-token' ? session : null);
    const expected = new Response('generation');
    const run = vi.fn(async () => expected);

    const response = await handleClaudeRequest(
      new Request(URL, { headers: { Authorization: 'Bearer claude-token' } }),
      authenticated,
      run,
      reply,
    );

    expect(response).toBe(expected);
    expect(authenticated).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith(session);
  });
});
