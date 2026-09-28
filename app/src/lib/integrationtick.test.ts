import { describe, expect, it, vi } from 'vitest';
import { serveTick, type TickDeps } from '../../../supabase/functions/_shared/integrationtick';

const SUMMARY = { outcome: 'ran', due: 0, ran: 0, succeeded: 0, failed: 0, refused: 0, replaysResolved: 0, skipped: {}, deferred: false };
const post = (auth?: string, method = 'POST') =>
  new Request('https://x.supabase.co/functions/v1/integration-tick', {
    method, headers: auth ? { Authorization: auth } : {}, ...(method === 'POST' ? { body: '{}' } : {}),
  });
const deps = (ok: boolean | 'throws' = true) => {
  const d: TickDeps = {
    authorized: vi.fn(async (t: string) => { if (ok === 'throws') throw new Error('rpc missing'); return ok && t === 'right-token'; }),
    run: vi.fn(async () => SUMMARY),
  };
  return d;
};

describe('the integration-tick Edge Function', () => {
  it('runs the tick for the scheduler’s token and answers with counts only', async () => {
    const d = deps();
    const res = await serveTick(post('Bearer right-token'), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(SUMMARY);
    expect(d.authorized).toHaveBeenCalledWith('right-token');
    expect(d.run).toHaveBeenCalledOnce();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses a wrong, missing or malformed token, and anything but POST, without running', async () => {
    const d = deps();
    expect((await serveTick(post('Bearer wrong'), d)).status).toBe(401);
    expect((await serveTick(post(), d)).status).toBe(401);
    expect((await serveTick(post('right-token'), d)).status).toBe(401);
    expect((await serveTick(post('Bearer '), d)).status).toBe(401);
    expect((await serveTick(post('Bearer right-token', 'GET'), d)).status).toBe(405);
    expect(d.run).not.toHaveBeenCalled();
  });

  it('fails closed when it cannot know: no credentials, or a token check that errors', async () => {
    expect((await serveTick(post('Bearer right-token'), null)).status).toBe(503);
    const d = deps('throws');
    expect((await serveTick(post('Bearer right-token'), d)).status).toBe(503);
    expect(d.run).not.toHaveBeenCalled();
  });

  it('says the tick failed, and nothing more, when it throws', async () => {
    const d = deps();
    d.run = vi.fn(async () => { throw new Error('connection to db-internal-host:5432 refused'); });
    const res = await serveTick(post('Bearer right-token'), d);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('db-internal-host');
  });
});
