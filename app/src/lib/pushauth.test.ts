import { describe, expect, it, vi } from 'vitest';
import { handlePushRequest } from '../../../supabase/functions/_shared/pushauth';

const URL = 'https://functions.example.edu/push';

describe('the push scheduler request boundary', () => {
  it('fails closed before protected work when the deployment secret is missing', async () => {
    const run = vi.fn(async () => Response.json({ sent: 1 }));
    const response = await handlePushRequest(new Request(URL, {
      headers: { Authorization: 'Bearer supplied-but-not-configured' },
    }), '', run);

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('not configured');
    expect(run).not.toHaveBeenCalled();
  });

  it.each([
    ['no authorization header', undefined],
    ['the wrong secret', 'Bearer wrong'],
    ['the wrong scheme', 'Basic scheduler-secret'],
  ])('rejects %s before protected work', async (_case, authorization) => {
    const run = vi.fn(async () => Response.json({ sent: 1 }));
    const headers = authorization ? { Authorization: authorization } : undefined;
    const response = await handlePushRequest(new Request(URL, { headers }), 'scheduler-secret', run);

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('no');
    expect(run).not.toHaveBeenCalled();
  });

  it('runs protected delivery only for the exact configured bearer secret', async () => {
    const protectedResponse = Response.json({ sent: 2, devices: 1 });
    const run = vi.fn(async () => protectedResponse);
    const response = await handlePushRequest(new Request(URL, {
      headers: { Authorization: 'Bearer scheduler-secret' },
    }), 'scheduler-secret', run);

    expect(run).toHaveBeenCalledOnce();
    expect(response).toBe(protectedResponse);
  });
});
