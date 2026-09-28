import { describe, expect, it } from 'vitest';
import { escalationBlock } from './Escalation';

const policy = {
  tenantId: 'vu',
  enabled: true,
  agreementRef: 'VU-DSA-2026-01',
  categories: ['threat_or_safety_concern'],
  identityRequired: false,
  hasChannel: true,
};
const threat = { severity: 'P1', category: 'threat_or_safety_concern' } as const;

/** The console's copy of private.escalation_allowed: never offers what the server refuses. */
describe('escalationBlock', () => {
  it('allows a covered P0 or P1 case under an agreement in force', () => {
    expect(escalationBlock(threat, policy, undefined)).toBeNull();
    expect(escalationBlock({ ...threat, severity: 'P0' }, policy, undefined)).toBeNull();
  });

  it('refuses without an agreement, a disabled one, or one with no reference or channel', () => {
    for (const p of [undefined, { ...policy, enabled: false }, { ...policy, agreementRef: '' }, { ...policy, hasChannel: false }]) {
      expect(escalationBlock(threat, p, undefined)).toMatch(/no escalation agreement/);
    }
  });

  it('refuses P2 and P3', () => {
    expect(escalationBlock({ ...threat, severity: 'P2' }, policy, undefined)).toMatch(/Only P0 and P1/);
    expect(escalationBlock({ ...threat, severity: 'P3' }, policy, undefined)).toMatch(/Only P0 and P1/);
  });

  it('refuses a category the agreement does not cover', () => {
    expect(escalationBlock({ ...threat, category: 'hate_or_discrimination' }, policy, undefined)).toMatch(/doesn’t cover/);
  });

  it('refuses a second live escalation, and says which kind is live', () => {
    const live = { status: 'requested' } as never;
    expect(escalationBlock(threat, policy, live)).toMatch(/already waiting/);
    expect(escalationBlock(threat, policy, { status: 'approved' } as never)).toMatch(/already been escalated/);
  });
});
