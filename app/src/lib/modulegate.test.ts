import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The module gate asks the two questions `private.registration_gate` asks, in
 * its order: a stopping kill switch first, then the school's state exactly
 * `production`. And it tells a school that has not turned a module on from a
 * request that failed, because only one of those is a fact about the school.
 */

const mock = vi.hoisted(() => ({
  configured: true,
  user: 'u-1' as string | null,
  school: 'vu' as string | null,
  state: 'production' as string | null,
  switches: [] as { switch_key: string; tenant_id: string | null; engaged: boolean }[],
  stateError: null as { message: string } | null,
  schoolError: null as { message: string } | null,
  asked: [] as unknown[],
}));

function chain(table: string) {
  const self: Record<string, unknown> = {};
  self.select = () => self;
  self.eq = () => self;
  self.maybeSingle = async () =>
    table === 'profiles' ? { data: mock.school ? { school_id: mock.school } : null, error: mock.schoolError } : { data: null, error: null };
  self.then = (ok: (r: unknown) => unknown) => Promise.resolve(table === 'feature_kill_switch' ? { data: mock.switches, error: null } : { data: [], error: null }).then(ok);
  return self;
}

vi.mock('./cloud', () => ({
  get cloudConfigured() {
    return mock.configured;
  },
  cloud: async () => ({
    auth: { getUser: async () => ({ data: { user: mock.user ? { id: mock.user } : null }, error: null }) },
    rpc: async (name: string, args: unknown) => {
      mock.asked.push([name, args]);
      return { data: mock.state, error: mock.stateError };
    },
    from: (table: string) => chain(table),
  }),
}));

import { decideGate, readModuleGate } from './modulegate';

const FLAG = 'writeback.registration_submit';

beforeEach(() => {
  mock.configured = true;
  mock.user = 'u-1';
  mock.school = 'vu';
  mock.state = 'production';
  mock.switches = [];
  mock.stateError = null;
  mock.schoolError = null;
  mock.asked = [];
});

describe('the decision', () => {
  it('is on only at production', () => {
    for (const state of ['off', 'preview', 'sandbox', null]) {
      expect(decideGate(FLAG, { school: 'vu', state, switches: [] })).toBe('off');
    }
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: [] })).toBe('on');
  });

  it('puts stopped before off, for this school or every school, and ignores other schools and other switches', () => {
    const engaged = (key: string, tenant: string | null) => [{ switch_key: key, tenant_id: tenant, engaged: true }];
    expect(decideGate(FLAG, { school: 'vu', state: 'off', switches: engaged('kill.writeback', null) })).toEqual({ stopped: 'kill.writeback' });
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: engaged('kill.integration_sync', 'vu') })).toEqual({ stopped: 'kill.integration_sync' });
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: engaged('kill.writeback', 'other') })).toBe('on');
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: engaged('kill.ai_generation', null) })).toBe('on');
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: [{ switch_key: 'kill.writeback', tenant_id: null, engaged: false }] })).toBe('on');
  });
});

describe('reading it', () => {
  it('is off with no account service, without asking anything', async () => {
    mock.configured = false;
    expect(await readModuleGate(FLAG)).toEqual({ status: 'off' });
    expect(mock.asked).toEqual([]);
  });

  it('is signed out, or has no school, before it reads the flag', async () => {
    mock.user = null;
    expect(await readModuleGate(FLAG)).toEqual({ status: 'signed_out' });
    mock.user = 'u-1';
    mock.school = null;
    expect(await readModuleGate(FLAG)).toEqual({ status: 'no_school' });
    expect(mock.asked).toEqual([]);
  });

  it('asks feature_state for this flag at this school, and is on at production', async () => {
    expect(await readModuleGate(FLAG)).toEqual({ status: 'on', school: 'vu', userId: 'u-1' });
    expect(mock.asked).toEqual([['feature_state', { want_capability: FLAG, want_tenant: 'vu' }]]);
  });

  it('is off when the school has it anywhere short of production', async () => {
    mock.state = 'preview';
    expect(await readModuleGate(FLAG)).toEqual({ status: 'off' });
  });

  it('is stopped by an engaged switch', async () => {
    mock.switches = [{ switch_key: 'kill.writeback', tenant_id: 'vu', engaged: true }];
    expect(await readModuleGate(FLAG)).toEqual({ status: 'stopped', switch: 'kill.writeback' });
  });

  it('is an error, never off, when a read fails', async () => {
    mock.stateError = { message: 'network' };
    expect((await readModuleGate(FLAG)).status).toBe('error');
    mock.stateError = null;
    mock.schoolError = { message: 'network' };
    expect((await readModuleGate(FLAG)).status).toBe('error');
  });
});
