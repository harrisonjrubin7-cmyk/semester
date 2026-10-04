import { describe, expect, it } from 'vitest';
import { principalOf, PRINCIPAL_ROLES } from '../identity';
import { showsTodayDecisionSurface } from '../../lib/today-decision';
import type { Role } from '../../lib/role';
import { POLICY_ACTIONS, RULES, bindPolicy, decide } from './index';

const who = (role: string) => principalOf({ accountId: 'u1', role });
const live = { readOnly: false };

describe('the policy decision point', () => {
  it('has a rule for every action it names, and no rule for one it does not', () => {
    expect(Object.keys(RULES).sort()).toEqual([...POLICY_ACTIONS].sort());
  });

  it('fails closed on an action nobody wrote a rule for', () => {
    for (const action of ['', 'admin.everything', 'task.delete', 'TASK.READ', 'toString', '__proto__']) {
      const d = decide(who('student'), action, live);
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe('unknown_action');
    }
  });

  it('serves Today to exactly the roles the legacy screen does', () => {
    for (const role of PRINCIPAL_ROLES) {
      expect(decide(who(role), 'today.view', live).allow).toBe(showsTodayDecisionSurface(role as Role));
    }
    // The control: both sides are not trivially true or trivially false.
    expect(PRINCIPAL_ROLES.filter((r) => decide(who(r), 'today.view', live).allow)).toEqual(['student']);
  });

  it('gives a person who is not served a sentence, not just a refusal', () => {
    const d = decide(who('faculty'), 'today.view', live);
    expect(d.allow).toBe(false);
    if (!d.allow) {
      expect(d.reason).toBe('role_not_served');
      expect(d.message.length).toBeGreaterThan(10);
    }
  });

  it('offers a person their own tasks and calendar whatever their role', () => {
    for (const role of PRINCIPAL_ROLES) {
      for (const action of ['task.read', 'task.write', 'calendar.read', 'calendar.write'] as const) {
        expect(decide(who(role), action, live).allow).toBe(true);
      }
    }
  });

  it('turns read-only mode into an obligation on writes, and into nothing on reads', () => {
    const ro = { readOnly: true };
    expect(decide(who('student'), 'task.write', ro)).toEqual({ allow: true, obligations: ['keep_on_device'] });
    expect(decide(who('student'), 'calendar.write', ro)).toEqual({ allow: true, obligations: ['keep_on_device'] });
    expect(decide(who('student'), 'task.write', live)).toEqual({ allow: true, obligations: [] });
    expect(decide(who('student'), 'task.read', ro)).toEqual({ allow: true, obligations: [] });
  });

  it('binds a person and an environment, leaving only the action to ask', () => {
    const can = bindPolicy(who('student'), live);
    expect(can('today.view').allow).toBe(true);
    expect(bindPolicy(who('alumni'), live)('today.view').allow).toBe(false);
  });
});
