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
const on = { killSwitched: false, moduleState: 'production', plan, requireSso: false, accountSso: false, accountCanLaunch: true };

describe('the LTI launch entitlement, in shadow', () => {
  it('would allow a joined launch at a school with LTI on and no switch thrown', () => {
    expect(launchEntitlement(joined, on, now)).toMatchObject({ evaluated: true, verdict: { allowed: true } });
  });

  it.each([
    ['kill-switch', joined, { ...on, killSwitched: true }],
    ['sso-policy', joined, { ...on, requireSso: true, accountSso: false }],
    ['capability', joined, { ...on, accountCanLaunch: false }],
    ['tenant-plan', joined, { ...on, plan: { status: 'suspended' as const } }],
    ['tenant-plan', joined, { ...on, plan: { status: 'active' as const, endsAt: '2026-09-01T00:00:00Z' } }],
    ['module', joined, { ...on, moduleState: 'off' }],
    ['lifecycle', membershipJoin([{ outcome: 'membership-suspended', tenant_id: 'north' }], null), on],
    ['lifecycle', membershipJoin([{ outcome: 'no-membership', tenant_id: 'north' }], null), on],
  ] as const)('would refuse at %s', (step, join, facts) => {
    expect(launchEntitlement(join, facts, now)).toMatchObject({ evaluated: true, verdict: { allowed: false, step } });
  });

  // `module` is judged before `lifecycle`: a school with LTI off refuses the
  // same way for everyone, before anything about the person is read.
  it('reports the earliest step, as the order does', () => {
    const suspended = membershipJoin([{ outcome: 'membership-suspended', tenant_id: 'north' }], null);
    expect(launchEntitlement(suspended, { ...on, moduleState: 'off' }, now))
      .toMatchObject({ verdict: { step: 'module' } });
  });

  it('treats preview and sandbox as the module being on, and only off as off', () => {
    for (const moduleState of ['preview', 'sandbox']) {
      expect(launchEntitlement(joined, { ...on, moduleState }, now))
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
  // The six sourced steps are the only ones a pass can mean anything for.
  it('names every step it did not check, and no step it did', () => {
    const sourced = ENTITLEMENT_STEPS.filter((s) => !(UNSOURCED_STEPS as readonly string[]).includes(s));
    expect(sourced).toEqual(['kill-switch', 'tenant-plan', 'module', 'sso-policy', 'lifecycle', 'capability']);
    const line = entitlementLogLine(launchEntitlement(joined, on, now));
    for (const step of UNSOURCED_STEPS) expect(line).toContain(step);
    expect(line).not.toContain('tenant-plan');
    expect(line).not.toContain('sso-policy');
    expect(line).not.toContain('capability');
    expect(line).toMatch(/^lti entitlement \(shadow\): would allow; unsourced=/);
  });

  // No plan row is "not recorded", not "ended": it passes and is named, so the
  // log never passes it off as a checked plan, and it never refuses on it.
  it('names tenant-plan as unsourced for a school with no plan row, and does not refuse on it', () => {
    const result = launchEntitlement(joined, { ...on, plan: null }, now);
    expect(result).toMatchObject({ evaluated: true, verdict: { allowed: true } });
    expect(entitlementLogLine(result)).toMatch(/unsourced=tenant-plan,/);
  });

  // A school that requires SSO lets a campus-SSO account through, and one
  // that requires nothing lets anyone through.
  it('passes sso-policy for a campus-SSO account, or when the school requires nothing', () => {
    expect(launchEntitlement(joined, { ...on, requireSso: true, accountSso: true }, now))
      .toMatchObject({ verdict: { allowed: true } });
    expect(launchEntitlement(joined, { ...on, requireSso: false, accountSso: false }, now))
      .toMatchObject({ verdict: { allowed: true } });
  });

  it('lets a trial plan through, as the order does', () => {
    expect(launchEntitlement(joined, { ...on, plan: { status: 'trial' } }, now))
      .toMatchObject({ verdict: { allowed: true } });
  });

  it('says where it would refuse, and why it did not evaluate', () => {
    expect(entitlementLogLine(launchEntitlement(joined, { ...on, moduleState: 'off' }, now)))
      .toMatch(/^lti entitlement \(shadow\): would refuse at module; unsourced=/);
    expect(entitlementLogLine({ evaluated: false, why: 'unbound' }))
      .toBe('lti entitlement (shadow): not evaluated — unbound');
  });
});

describe('reading the facts row', () => {
  it('reads a well-formed row, as the RPC returns it', () => {
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: 'active', plan_ends_at: '2027-06-30T00:00:00+00:00', require_sso: true, account_sso: false, account_can_launch: true }], null))
      .toEqual({ killSwitched: false, moduleState: 'off', plan: { status: 'active', endsAt: '2027-06-30T00:00:00+00:00' }, requireSso: true, accountSso: false, accountCanLaunch: true });
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: 'active', plan_ends_at: null, require_sso: false, account_sso: true, account_can_launch: false }], null))
      .toEqual({ killSwitched: false, moduleState: 'off', plan: { status: 'active' }, requireSso: false, accountSso: true, accountCanLaunch: false });
  });

  it('reads no plan row as no plan recorded', () => {
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: null, plan_ends_at: null, require_sso: false, account_sso: false, account_can_launch: false }], null))
      .toEqual({ killSwitched: false, moduleState: 'off', plan: null, requireSso: false, accountSso: false, accountCanLaunch: false });
  });

  // The function always returns both SSO fields, so a row without them is
  // not one it returned: not trusted, rather than read as "not required".
  it('does not trust a row missing the SSO or capability fields', () => {
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: null, plan_ends_at: null, require_sso: false, account_sso: false }], null)).toBeNull();
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: null, plan_ends_at: null }], null)).toBeNull();
    expect(readFacts([{ kill_switched: false, module_state: 'off', plan_status: null, plan_ends_at: null, require_sso: 'yes', account_sso: false }], null)).toBeNull();
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
