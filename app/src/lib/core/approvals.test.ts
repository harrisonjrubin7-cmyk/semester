import { describe, expect, it } from 'vitest';
import { type Approval, step } from './approvals';

const NOW = Date.UTC(2026, 9, 7, 12);
const H = 3600e3;
const MIN = 60e3;

const fresh: Approval = {
  id: '1',
  requester: 'r',
  approvers: [],
  state: 'requested',
  expiresAt: NOW + H,
  mfaAt: { x: NOW, y: NOW, r: NOW },
};

const isError = (v: unknown) => typeof v === 'object' && v !== null && 'error' in v;

describe('two-person approval', () => {
  it('needs two distinct non-requesters, then only the requester may execute', () => {
    expect(isError(step(fresh, { type: 'approve', by: 'r', at: NOW }))).toBe(true);
    const one = step(fresh, { type: 'approve', by: 'x', at: NOW }) as Approval;
    expect(one.state).toBe('approved-1');
    expect(isError(step(one, { type: 'approve', by: 'x', at: NOW }))).toBe(true);
    const two = step(one, { type: 'approve', by: 'y', at: NOW }) as Approval;
    expect(two.state).toBe('approved');
    expect((step(two, { type: 'execute', by: 'r', at: NOW }) as Approval).state).toBe('executed');
  });

  it('nobody but the requester can execute, and not before two approvals', () => {
    expect(isError(step(fresh, { type: 'execute', by: 'r', at: NOW }))).toBe(true);
    const one = step(fresh, { type: 'approve', by: 'x', at: NOW }) as Approval;
    expect(isError(step(one, { type: 'execute', by: 'r', at: NOW }))).toBe(true);
    const two = step(step(one, { type: 'approve', by: 'y', at: NOW }) as Approval, { type: 'execute', by: 'x', at: NOW });
    expect(isError(two)).toBe(true);
  });

  it('requires a second factor within the last 15 minutes', () => {
    const noMfa: Approval = { ...fresh, mfaAt: {} };
    expect(isError(step(noMfa, { type: 'approve', by: 'x', at: NOW }))).toBe(true);
    const stale: Approval = { ...fresh, mfaAt: { x: NOW - 16 * MIN } };
    expect(isError(step(stale, { type: 'approve', by: 'x', at: NOW }))).toBe(true);
  });

  it('rejects a second factor verified after the approval it backs', () => {
    const later: Approval = { ...fresh, mfaAt: { x: NOW + MIN } };
    expect(isError(step(later, { type: 'approve', by: 'x', at: NOW }))).toBe(true);
  });

  it('accepts a second factor exactly 15 minutes old, and rejects one 1 ms older', () => {
    const exact: Approval = { ...fresh, mfaAt: { x: NOW - 15 * MIN } };
    expect((step(exact, { type: 'approve', by: 'x', at: NOW }) as Approval).state).toBe('approved-1');
    const older: Approval = { ...fresh, mfaAt: { x: NOW - 15 * MIN - 1 } };
    expect(isError(step(older, { type: 'approve', by: 'x', at: NOW }))).toBe(true);
  });

  it('an approval exactly at the deadline is still live; one millisecond later it has expired', () => {
    const late: Approval = { ...fresh, mfaAt: { x: fresh.expiresAt - MIN } };
    expect((step(late, { type: 'approve', by: 'x', at: fresh.expiresAt }) as Approval).state).toBe('approved-1');
    expect((step(late, { type: 'approve', by: 'x', at: fresh.expiresAt + 1 }) as Approval).state).toBe('expired');
  });

  it('a rejection stays a rejection after the deadline passes', () => {
    const rejected = step(fresh, { type: 'reject', by: 'x', at: NOW }) as Approval;
    const late: Approval = { ...rejected, mfaAt: { y: fresh.expiresAt - MIN } };
    expect(step(late, { type: 'approve', by: 'y', at: fresh.expiresAt + 1 })).toEqual({ error: 'This request is rejected.' });
  });
  it('expires after the deadline and a rejection ends the request', () => {
    expect((step(fresh, { type: 'approve', by: 'x', at: NOW + 2 * H }) as Approval).state).toBe('expired');
    const rejected = step(fresh, { type: 'reject', by: 'x', at: NOW }) as Approval;
    expect(rejected.state).toBe('rejected');
    expect(isError(step(rejected, { type: 'approve', by: 'y', at: NOW }))).toBe(true);
  });
});
