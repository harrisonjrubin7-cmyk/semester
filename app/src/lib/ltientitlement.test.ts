import { describe, expect, it } from 'vitest';
import {
  UNSOURCED_STEPS,
  entitlementLogLine,
  launchEntitlement,
  readFacts,
} from '../../../supabase/functions/_shared/ltientitlement';
import { ENTITLEMENT_STEPS } from '../../../supabase/functions/_shared/entitlement';
import { membershipJoin } from '../../../supabase/functions/_shared/ltimembership';

/**
 * The entitlement order on an LTI launch, in shadow. The order itself is
 * walked in packages/institution/src/entitlement.test.ts; this proves what a
 * launch feeds it, and that the log never passes off an unchecked step.
 */
const now = new Date('2026-09-27T20:00:00Z');
const joined = membershipJoin([{ outcome: 'joined', tenant_id: 'north', membership_id: 'm-1', roles: ['student'] }], null);
const plan = { status: 'active' as const, endsAt: '2027-06-30T00:00:00Z' };
const on = { killSwitched: false, moduleState: 'production', plan };

describe('the LTI launch entitlement, in shadow', () => {
  it('would allow a joined launch at a school with LTI on and no switch thrown', () => {
    expect(launchEntitlement(joined, on, now)).toMatchObject({ evaluated: true, verdict: { allowed: true } });
  });

  it.each([
    ['kill-switch', joined, { killSwitched: true, moduleState: 'production', plan }],
    ['tenant-plan', joined, { ...on, plan: { status: 'suspended' as const } }],
    ['tenant-plan', joined, { ...on, plan: { status: 'active' as const, endsAt: '2026-09-01T00:00:00Z' } }],
    ['module', joined, { killSwitched: false, moduleState: 'off', plan }],
    ['lifecycle', membershipJoin([{ outcome: 'membership-suspended', tenant_id: 'north' }], null), on],
    ['lifecycle', membershipJoin([{ outcome: 'no-membership', tenant_id: 'north' }], null), on],
  ] as const)('would refuse at %s', (step, join, facts) => {
    expect(launchEntitlement(join, facts, now)).toMatchObject({ evaluated: true, verdict: { allowed: false, step } });
  });

  // `module` is judged before `lifecycle`: a school with LTI off refuses the
  // same way for everyone, before anything about the person is read.
  it('reports the earliest step, as the order does', () => {
    const suspended = membershipJoin([{ outcome: 'membership-suspended', tenant_id: 'north' }], null);
    expect(launchEntitlement(suspended, { killSwitched: false, moduleState: 'off', plan }, now))
      .toMatchObject({ verdict: { step: 'module' } });
  });

  it('treats preview and sandbox as the module being on, and only off as off', () => {
    for (const moduleState of ['preview', 'sandbox']) {
      expect(launchEntitlement(joined, { killSwitched: false, moduleState, plan }, now))
        .toMatchObject({ verdict: { allowed: true } });
    }
  });

  it('does not evaluate without a school, or with facts it cannot trust', () => {
    const unbound = membershipJoin([{ outcome: 'unbound', tenant_id: null }], null);
    expect(launchEntitlement(unbound, on, now)).toEqual({ evaluated: false, why: 'unbound' });
    expect(launchEntitlement(joined, null, now)).toEqual({ evaluated: false, why: 'facts-unreadable' });
  });

  it('never reads an unrecognised membership word as a status', () => {
    const odd = membershipJoin([{ outcome: 'membership-archived', tenant_id: 'north' }], null);
    expect(launchEntitlement(odd, on, now)).toMatchObject({ verdict: { allowed: false, step: 'lifecycle' } });
  });
});

describe('the shadow log', () => {
  // The four sourced steps are the only ones a pass can mean anything for.
  it('names every step it did not check, and no step it did', () => {
    const sourced = ENTITLEMENT_STEPS.filter((s) => !(UNSOURCED_STEPS as readonly string[]).includes(s));
    expect(sourced).toEqual(['kill-switch', 'tenant-plan', 'module', 'lifecycle']);
    const line = entitlementLogLine(launchEntitlement(joined, on, now));
    for (const step of UNSOURCED_STEPS) expect(line).toContain(step);
    expect(line).not.toContain('tenant-plan');
    expect(line).toMatch(/^lti entitlement \(shadow\): would allow; unsourced=/);
  });

  // No plan row is "not recorded", not "ended": it passes and is named, so the
  // log never passes it off as a checked plan, and it never refuses on it.
  it('names tenant-plan as unsourced for a school with no plan row, and does not refuse on it', () => {
    const result = launchEntitlement(joined, { ...on, plan: null }, now);
    expect(result).toMatchObject({ evaluated: true, verdict: { allowed: true } });
    expect(entitlementLogLine(result)).toMatch(/unsourced=tenant-plan,/);
  });

  it('lets a trial plan through, as the order does', () => {
    expect(launchEntitlement(joined, { ...on, plan: { status: 'trial' } }, now))
      .toMatchObject({ verdict: { allowed: true } });
  });

  it('says where it would refuse, and why it did not evaluate', () => {
    expect(entitlementLogLine(launchEntitlement(joined, { killSwitched: false, moduleState: 'off', plan }, now)))
      .toMatch(/^lti entitlement \(shadow\): would refuse at module; unsourced=/);
    expect(entitlementLogLine({ evaluated: false, why: 'unbound' }))
      .toBe('lti entitlement (shadow): not evaluated — unbound');
  });
});

describe('reading the facts row', () => {
  it('reads a well-formed row, as the RPC returns it', () => {
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: 'active', plan_ends_at: '2027-06-30T00:00:00+00:00' }], null))
      .toEqual({ killSwitched: false, moduleState: 'off', plan: { status: 'active', endsAt: '2027-06-30T00:00:00+00:00' } });
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: 'active', plan_ends_at: null }], null))
      .toEqual({ killSwitched: false, moduleState: 'off', plan: { status: 'active' } });
  });

  it('reads no plan, or a database that predates tenant_plan, as no plan recorded', () => {
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: null, plan_ends_at: null }], null))
      .toEqual({ killSwitched: false, moduleState: 'off', plan: null });
    expect(readFacts([{ kill_switched: false, module_state: 'off' }], null))
      .toEqual({ killSwitched: false, moduleState: 'off', plan: null });
  });

  it.each([
    [[{ kill_switched: 'false', module_state: 'off' }], null],
    [[{ kill_switched: false, module_state: 'on' }], null],
    [[{ kill_switched: false, module_state: 'off', plan_status: 'lapsed', plan_ends_at: null }], null],
    [[{ kill_switched: false, module_state: 'off', plan_status: 'active', plan_ends_at: 'soon' }], null],
    [[{ kill_switched: false, module_state: 'off', plan_status: null, plan_ends_at: '2027-01-01' }], null],
    [[], null],
    [null, { message: 'connection reset' }],
  ])('refuses to trust %j', (data, error) => {
    expect(readFacts(data, error)).toBeNull();
  });
});
