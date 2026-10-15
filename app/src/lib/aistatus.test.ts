import { describe, expect, it } from 'vitest';
import { KILLED_MESSAGE } from '../../../supabase/functions/_shared/killswitch';
import { KILLED, decideDoor, type AiStatus } from './aistatus';

const now = 1_000_000;
const status = (patch: Partial<AiStatus> = {}): AiStatus => ({
  killed: false, tenantOff: false, routesDisabled: [], issuedAt: now - 1_000, ttlMs: 60_000, ...patch,
});
const ask = (s: AiStatus | null, account: 'managed' | 'individual' = 'individual', route: Parameters<typeof decideDoor>[0]['route'] = 'device-key') =>
  decideDoor({ status: s, account, route, now });

describe('the client door decision', () => {
  it('says what the server says when the switch is engaged', () => {
    expect(KILLED).toBe(KILLED_MESSAGE);
  });

  it('lets a fresh, clear status through on every route, for both kinds of account', () => {
    for (const route of ['shared-key', 'device-key', 'device-key-openai', 'proxy', 'institution-gateway'] as const) {
      for (const account of ['managed', 'individual'] as const) expect(ask(status(), account, route)).toEqual({ allow: true });
    }
  });

  it('obeys a fresh kill on the student’s own key, which no server switch can otherwise reach', () => {
    for (const account of ['managed', 'individual'] as const) {
      expect(ask(status({ killed: true }), account, 'device-key')).toMatchObject({ allow: false, reason: 'killed' });
    }
  });

  it('obeys a school that is off, and a route that is disabled, only on what they name', () => {
    expect(ask(status({ tenantOff: true }), 'managed')).toMatchObject({ allow: false, reason: 'tenant-off' });
    const s = status({ routesDisabled: ['device-key'] });
    expect(ask(s, 'individual', 'device-key')).toMatchObject({ allow: false, reason: 'route-disabled' });
    expect(ask(s, 'individual', 'proxy')).toEqual({ allow: true });
  });

  it('fails a managed account closed when there is no status, a stale one, or one from the future', () => {
    expect(ask(null, 'managed')).toMatchObject({ allow: false, reason: 'status-stale' });
    expect(ask(status({ issuedAt: now - 61_000 }), 'managed')).toMatchObject({ allow: false, reason: 'status-stale' });
    expect(ask(status({ issuedAt: now + 5_000 }), 'managed')).toMatchObject({ allow: false, reason: 'status-stale' });
  });

  it('fails an individual open with a banner, and never without one', () => {
    const open = ask(null, 'individual');
    expect(open).toMatchObject({ allow: true });
    expect('banner' in open && open.banner).toMatch(/your own key/);
    expect(ask(status({ issuedAt: now - 61_000 }), 'individual')).toMatchObject({ allow: true });
  });

  it('never fails open from a last-known kill, for anyone, even when it has gone stale', () => {
    const old = status({ killed: true, issuedAt: now - 3_600_000 });
    for (const account of ['managed', 'individual'] as const) expect(ask(old, account)).toMatchObject({ allow: false, reason: 'killed' });
  });
});
