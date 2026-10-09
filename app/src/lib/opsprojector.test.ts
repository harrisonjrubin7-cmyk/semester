import { describe, expect, it, vi } from 'vitest';
import { serveOpsProjector, type OpsProjectorDeps } from '../../../supabase/functions/_shared/opsprojector';

const SECRET = 'projector-check-secret-with-at-least-32-characters';
const request = (authorization?: string, method = 'POST') => new Request(
  'https://x.supabase.co/functions/v1/ops-projector',
  { method, headers: authorization ? { Authorization: authorization } : {} },
);
const deps = (secret: string | undefined = SECRET): OpsProjectorDeps => ({
  secret,
  run: vi.fn(async () => ({ claimed: 1, processed: 1, skipped: 0, retrying: 0, deadLettered: 0 })),
});

describe('the ops-projector Edge Function', () => {
  it('runs one bounded database batch for the dedicated bearer secret', async () => {
    const d = deps();
    const response = await serveOpsProjector(request(`Bearer ${SECRET}`), d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, processed: 1, skipped: 0, retrying: 0, deadLettered: 0 });
    expect(d.run).toHaveBeenCalledOnce();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('is dormant without service credentials or a dedicated usable secret', async () => {
    expect((await serveOpsProjector(request(`Bearer ${SECRET}`), null)).status).toBe(503);
    expect((await serveOpsProjector(request(`Bearer ${SECRET}`), { ...deps(), secret: undefined })).status).toBe(503);
    expect((await serveOpsProjector(request('Bearer short'), deps('short'))).status).toBe(503);
  });

  it('refuses wrong, missing and malformed credentials and every non-POST method', async () => {
    const d = deps();
    expect((await serveOpsProjector(request('Bearer wrong'), d)).status).toBe(401);
    expect((await serveOpsProjector(request(), d)).status).toBe(401);
    expect((await serveOpsProjector(request(SECRET), d)).status).toBe(401);
    expect((await serveOpsProjector(request(`Bearer ${SECRET}`, 'GET'), d)).status).toBe(405);
    expect(d.run).not.toHaveBeenCalled();
  });

  it('does not expose database error details', async () => {
    const d = deps();
    d.run = vi.fn(async () => { throw new Error('connection to db-internal-host:5432 refused'); });
    const response = await serveOpsProjector(request(`Bearer ${SECRET}`), d);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('db-internal-host');
  });
});
