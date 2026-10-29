import { describe, expect, it, vi } from 'vitest';
import { handleFetchcalRequest } from '../../../supabase/functions/_shared/fetchcalauth';

const URL = 'https://semester.example/functions/v1/fetchcal';
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('fetchcal session boundary', () => {
  it.each([
    ['missing authorization', undefined],
    ['wrong scheme', 'Basic calendar-token'],
    ['empty bearer', 'Bearer   '],
  ])('rejects %s before authentication or protected fetch', async (_name, authorization) => {
    const authenticated = vi.fn(async () => true);
    const run = vi.fn(async () => new Response('calendar'));
    const headers = authorization ? { Authorization: authorization } : undefined;

    const response = await handleFetchcalRequest(new Request(URL, { headers }), authenticated, run, reply);

    expect(response.status).toBe(401);
    expect(authenticated).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid', async () => false],
    ['unreadable', async () => { throw new Error('auth unavailable'); }],
  ])('rejects an %s session before protected fetch', async (_name, check) => {
    const authenticated = vi.fn(check);
    const run = vi.fn(async () => new Response('calendar'));

    const response = await handleFetchcalRequest(
      new Request(URL, { headers: { Authorization: 'Bearer calendar-token' } }),
      authenticated,
      run,
      reply,
    );

    expect(response.status).toBe(401);
    expect(authenticated).toHaveBeenCalledWith('calendar-token');
    expect(run).not.toHaveBeenCalled();
  });

  it('runs protected fetch only after the exact bearer session is accepted', async () => {
    const authenticated = vi.fn(async (token: string) => token === 'calendar-token');
    const expected = new Response('BEGIN:VCALENDAR', { status: 200 });
    const run = vi.fn(async () => expected);

    const response = await handleFetchcalRequest(
      new Request(URL, { headers: { Authorization: 'Bearer calendar-token' } }),
      authenticated,
      run,
      reply,
    );

    expect(response).toBe(expected);
    expect(authenticated).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledOnce();
  });
});
