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
  /** What `feature_narrowing` answers: its rows, or an error. */
  narrowing: { data: [] as unknown, error: null as { message: string } | null },
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
      if (name === 'feature_narrowing') return mock.narrowing;
      return { data: mock.state, error: mock.stateError };
    },
    from: (table: string) => chain(table),
  }),
}));

import { decideGate, readModuleGate } from './modulegate';
import type { Narrowing } from './featurepolicy';

const FLAG = 'writeback.registration_submit';
const OPEN: Narrowing = { permittedRoles: [], permittedCohorts: [], roles: [], cohorts: [] };

beforeEach(() => {
  mock.configured = true;
  mock.user = 'u-1';
  mock.school = 'vu';
  mock.state = 'production';
  mock.switches = [];
  mock.stateError = null;
  mock.schoolError = null;
  mock.asked = [];
  mock.narrowing = { data: [], error: null };
});

describe('the decision', () => {
  it('is on only at production', () => {
    for (const state of ['off', 'preview', 'sandbox', null]) {
      expect(decideGate(FLAG, { school: 'vu', state, switches: [], narrowing: OPEN })).toBe('off');
    }
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: [], narrowing: OPEN })).toBe('on');
  });

  it('puts stopped before off, for this school or every school, and ignores other schools and other switches', () => {
    const engaged = (key: string, tenant: string | null) => [{ switch_key: key, tenant_id: tenant, engaged: true }];
    expect(decideGate(FLAG, { school: 'vu', state: 'off', switches: engaged('kill.writeback', null), narrowing: OPEN })).toEqual({ stopped: 'kill.writeback' });
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: engaged('kill.integration_sync', 'vu'), narrowing: OPEN })).toEqual({ stopped: 'kill.integration_sync' });
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: engaged('kill.writeback', 'other'), narrowing: OPEN })).toBe('on');
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: engaged('kill.ai_generation', null), narrowing: OPEN })).toBe('on');
    expect(decideGate(FLAG, { school: 'vu', state: 'production', switches: [{ switch_key: 'kill.writeback', tenant_id: null, engaged: false }], narrowing: OPEN })).toBe('on');
  });
});

describe('the narrowing', () => {
  it('is off at production for a caller the school’s role or cohort list leaves out, and on for one it names', () => {
    const at = (narrowing: Narrowing) =>
      decideGate(FLAG, { school: 'vu', state: 'production', switches: [], narrowing });
    expect(at({ ...OPEN, permittedCohorts: ['pilot'] })).toBe('off');
    expect(at({ ...OPEN, permittedCohorts: ['pilot'], cohorts: ['other'] })).toBe('off');
    expect(at({ ...OPEN, permittedCohorts: ['pilot'], cohorts: ['pilot'] })).toBe('on');
    expect(at({ ...OPEN, permittedRoles: ['university_staff'], roles: ['undergraduate_student'] })).toBe('off');
    expect(at({ ...OPEN, permittedRoles: ['university_staff'], roles: ['university_staff'] })).toBe('on');
    expect(at({ ...OPEN, permittedRoles: ['university_staff'], roles: ['university_staff'], permittedCohorts: ['pilot'] })).toBe('off');
  });

  it('still puts stopped before narrowed', () => {
    expect(decideGate(FLAG, {
      school: 'vu', state: 'production', narrowing: { ...OPEN, permittedCohorts: ['pilot'] },
      switches: [{ switch_key: 'kill.writeback', tenant_id: 'vu', engaged: true }],
    })).toEqual({ stopped: 'kill.writeback' });
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
    expect(mock.asked).toEqual([
      ['feature_state', { want_capability: FLAG, want_tenant: 'vu' }],
      ['feature_narrowing', { want_capability: FLAG, want_tenant: 'vu' }],
    ]);
  });

  it('is off when the school has it anywhere short of production', async () => {
    mock.state = 'preview';
    expect(await readModuleGate(FLAG)).toEqual({ status: 'off' });
  });

  it('is stopped by an engaged switch', async () => {
    mock.switches = [{ switch_key: 'kill.writeback', tenant_id: 'vu', engaged: true }];
    expect(await readModuleGate(FLAG)).toEqual({ status: 'stopped', switch: 'kill.writeback' });
  });

  it('reads the school’s cohort list and the caller’s cohorts, and is off for a non-member', async () => {
    mock.narrowing = { data: [{ permitted_roles: [], permitted_cohorts: ['reg-pilot'], roles: [], cohorts: [] }], error: null };
    expect(await readModuleGate(FLAG)).toEqual({ status: 'off' });
    mock.narrowing = { data: [{ permitted_roles: [], permitted_cohorts: ['reg-pilot'], roles: [], cohorts: ['reg-pilot'] }], error: null };
    expect(await readModuleGate(FLAG)).toEqual({ status: 'on', school: 'vu', userId: 'u-1' });
  });

  it('is off for a role the school did not name, and on for one it did', async () => {
    mock.narrowing = { data: [{ permitted_roles: ['university_staff'], permitted_cohorts: [], roles: [], cohorts: [] }], error: null };
    expect(await readModuleGate(FLAG)).toEqual({ status: 'off' });
    mock.narrowing = { data: [{ permitted_roles: ['university_staff'], permitted_cohorts: [], roles: ['university_staff'], cohorts: [] }], error: null };
    expect((await readModuleGate(FLAG)).status).toBe('on');
  });

  it('is an error, never on, when the narrowing cannot be read or is not the shape it should be', async () => {
    mock.narrowing = { data: null, error: { message: 'network' } };
    expect((await readModuleGate(FLAG)).status).toBe('error');
    mock.narrowing = { data: 'production', error: null };
    expect((await readModuleGate(FLAG)).status).toBe('error');
    mock.narrowing = { data: [{ permitted_roles: [], permitted_cohorts: ['reg-pilot'] }], error: null };
    expect((await readModuleGate(FLAG)).status).toBe('error');
  });

  it('is an error, never off, when a read fails', async () => {
    mock.stateError = { message: 'network' };
    expect((await readModuleGate(FLAG)).status).toBe('error');
    mock.stateError = null;
    mock.schoolError = { message: 'network' };
    expect((await readModuleGate(FLAG)).status).toBe('error');
  });
});
