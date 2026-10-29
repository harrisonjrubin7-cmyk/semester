import { describe, expect, it, vi } from 'vitest';
import { handleCanvasRequest } from '../../../supabase/functions/_shared/canvasauth';

const URL = 'https://semester.example/functions/v1/canvas';
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Canvas session boundary', () => {
  it.each([
    ['missing authorization', undefined],
    ['wrong scheme', 'Basic canvas-token'],
    ['empty bearer', 'Bearer   '],
  ])('rejects %s before authentication or protected Canvas fetch', async (_name, authorization) => {
    const authenticated = vi.fn(async () => true);
    const run = vi.fn(async () => new Response('assignments'));
    const headers = authorization ? { Authorization: authorization } : undefined;

    const response = await handleCanvasRequest(new Request(URL, { headers }), authenticated, run, reply);

    expect(response.status).toBe(401);
    expect(authenticated).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', async () => false],
    ['unreadable', async () => { throw new Error('auth unavailable'); }],
  ])('rejects an %s session before protected Canvas fetch', async (_name, check) => {
    const authenticated = vi.fn(check);
    const run = vi.fn(async () => new Response('assignments'));

    const response = await handleCanvasRequest(
      new Request(URL, { headers: { Authorization: 'Bearer canvas-token' } }),
      authenticated,
      run,
      reply,
    );

    expect(response.status).toBe(401);
    expect(authenticated).toHaveBeenCalledWith('canvas-token');
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the protected Canvas fetch only after the exact bearer session is accepted', async () => {
    const authenticated = vi.fn(async (token: string) => token === 'canvas-token');
    const expected = new Response('{"assignments":[]}');
    const run = vi.fn(async () => expected);

    const response = await handleCanvasRequest(
      new Request(URL, { headers: { Authorization: 'Bearer canvas-token' } }),
      authenticated,
      run,
      reply,
    );

    expect(response).toBe(expected);
    expect(authenticated).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledOnce();
  });
});
