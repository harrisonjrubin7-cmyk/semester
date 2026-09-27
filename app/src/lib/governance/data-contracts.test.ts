import { describe, expect, it } from 'vitest';
import { FLAGS } from '../flags';
import { contractFor, contractProblems, CONTRACTS, readiness, REQUIRED_TO_GO_LIVE, type StewardAssignment } from './data-contracts';

describe('data contract registry', () => {
  it('has a contract for every connector flag, and none for a connector that does not exist', () => {
    const connectors = FLAGS.filter((f) => f.type === 'connector').map((f) => f.key);
    for (const k of connectors) expect(contractFor(k), k).toBeDefined();
    for (const c of CONTRACTS) expect(connectors, c.domain).toContain(c.connector);
  });

  it('has no structural faults', () => {
    for (const c of CONTRACTS) expect(contractProblems(c), c.domain).toEqual([]);
  });

  it('catches a contract for data Semester may not hold (control)', () => {
    expect(contractProblems({ ...CONTRACTS[0], classification: 'T4' })).toHaveLength(1);
  });

  it('is not ready until the owner, steward, integration and privacy roles are named people', () => {
    const c = CONTRACTS[0];
    expect(readiness(c, 't1', [])).toMatchObject({ ready: false, missing: [...REQUIRED_TO_GO_LIVE] });
    const staffed: StewardAssignment[] = REQUIRED_TO_GO_LIVE.map((role) => ({ tenantId: 't1', connector: c.connector, role, person: `Person for ${role}` }));
    expect(readiness(c, 't1', staffed)).toEqual({ ready: true });
    expect(readiness(c, 't2', staffed).ready).toBe(false);
    const blank = staffed.map((a) => (a.role === 'data_owner' ? { ...a, person: ' ' } : a));
    expect(readiness(c, 't1', blank)).toMatchObject({ ready: false, missing: ['data_owner'] });
  });
});
