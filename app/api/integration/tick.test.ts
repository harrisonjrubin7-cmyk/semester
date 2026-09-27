import { describe, expect, it, vi } from 'vitest';
import { bearerMatches, serveTick } from './tick.ts';

const ENV = { INTEGRATION_CRON_SECRET: 's3cret-value', SEMESTER_AUTH_URL: 'https://db.example', SEMESTER_AUTH_SERVICE_KEY: 'service' };
const SUMMARY = { outcome: 'ran', due: 0, ran: 0, succeeded: 0, failed: 0, refused: 0, replaysResolved: 0, skipped: {}, deferred: false } as const;

describe('the scheduled tick endpoint', () => {
  it('runs the tick for the scheduler’s bearer token and answers with counts', async () => {
    const run = vi.fn(async () => SUMMARY);
    const out = await serveTick('POST', 'Bearer s3cret-value', ENV, run);
    expect(out).toEqual({ status: 200, body: SUMMARY });
    expect(run).toHaveBeenCalledOnce();
  });

  it('answers 503 and runs nothing until the secret and the service credentials are all set', async () => {
    const run = vi.fn(async () => SUMMARY);
    for (const missing of Object.keys(ENV)) {
      const out = await serveTick('POST', 'Bearer s3cret-value', { ...ENV, [missing]: '' }, run);
      expect(out.status, missing).toBe(503);
    }
    // An unset secret is not an empty password: a bare "Bearer " does not match it.
    expect((await serveTick('POST', 'Bearer ', { ...ENV, INTEGRATION_CRON_SECRET: undefined }, run)).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses anything else', async () => {
    const run = vi.fn(async () => SUMMARY);
    expect((await serveTick('POST', undefined, ENV, run)).status).toBe(401);
    expect((await serveTick('POST', 'Bearer s3cret-valuE', ENV, run)).status).toBe(401);
    expect((await serveTick('POST', 's3cret-value', ENV, run)).status).toBe(401);
    expect((await serveTick('GET', 'Bearer s3cret-value', ENV, run)).status).toBe(405);
    expect(run).not.toHaveBeenCalled();
  });

  it('compares tokens of any length without throwing', () => {
    expect(bearerMatches('Bearer x', 'a much longer secret')).toBe(false);
    expect(bearerMatches('Bearer a much longer secret', 'a much longer secret')).toBe(true);
    expect(bearerMatches('Bearer anything', '')).toBe(false);
  });
});
