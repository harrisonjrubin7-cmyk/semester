import { describe, expect, it } from 'vitest';
import { isOverdue, openFinding, transition } from './finding-lifecycle';

const SHA = 'a'.repeat(40);
const FIX = 'b'.repeat(40);
const DIGEST = `sha256:${'c'.repeat(64)}`;
const RETEST_DIGEST = `sha256:${'d'.repeat(64)}`;

const finding = () => openFinding({
  id: 'SEC-2026-0042',
  severity: 'high',
  component: 'zite/better-auth',
  summary: 'Authentication advisory reaches a locked dependency',
  owner: 'security',
  source: {
    scanner: 'osv-scanner',
    run: 'github:40976717246/job/123806462570',
    artifact: 'platform-control-reports',
    digest: DIGEST,
    commit: SHA,
    detectedAt: '2026-10-29T23:55:03.000Z',
  },
});

describe('the security finding lifecycle', () => {
  it('opens from an immutable scan reference and derives the severity deadline', () => {
    const value = finding();
    expect(value.status).toBe('open');
    expect(value.revision).toBe(1);
    expect(value.dueAt).toBe('2026-11-12T23:55:03.000Z');
    expect(value.history).toHaveLength(1);
    expect(isOverdue(value, '2026-11-13T00:00:00.000Z')).toBe(true);
    expect(isOverdue(value, '2026-11-01T00:00:00.000Z')).toBe(false);
  });

  it('rejects findings that cannot identify the scanned bytes and exact code', () => {
    expect(() => openFinding({ ...finding(), source: { ...finding().source, digest: 'latest' } })).toThrow(/digest/i);
    expect(() => openFinding({ ...finding(), source: { ...finding().source, commit: 'main' } })).toThrow(/commit/i);
    expect(() => openFinding({ ...finding(), source: { ...finding().source, run: '' } })).toThrow(/run/i);
  });

  it('uses expected revisions and leaves the prior record unchanged', () => {
    const before = finding();
    const after = transition(before, {
      type: 'mitigate', expectedRevision: 1, at: '2026-10-30T00:10:00.000Z',
      control: 'Disable the affected authentication path', evidence: 'flag:audit:evt-42',
    });
    expect(after.status).toBe('mitigated');
    expect(after.revision).toBe(2);
    expect(before.status).toBe('open');
    expect(before.history).toHaveLength(1);
    expect(() => transition(after, {
      type: 'assign', expectedRevision: 1, at: '2026-10-30T00:11:00.000Z', owner: 'engineering',
    })).toThrow(/stale/i);
  });

  it('cannot call a finding fixed without a reviewed remediation and exact commit', () => {
    const value = finding();
    expect(() => transition(value, {
      type: 'fix', expectedRevision: 1, at: '2026-10-30T01:00:00.000Z',
      fixedCommit: 'main', remediation: 'PR #1712',
    })).toThrow(/commit/i);
    expect(() => transition(value, {
      type: 'fix', expectedRevision: 1, at: '2026-10-30T01:00:00.000Z',
      fixedCommit: FIX, remediation: '',
    })).toThrow(/remediation/i);
  });

  it('closes only after an independent passing retest of the fixed commit', () => {
    const fixed = transition(finding(), {
      type: 'fix', expectedRevision: 1, at: '2026-10-30T01:00:00.000Z',
      fixedCommit: FIX, remediation: 'github:pull/1712',
    });
    expect(() => transition(fixed, {
      type: 'retest', expectedRevision: 2, at: '2026-10-30T02:00:00.000Z', result: 'passed',
      scanner: 'osv-scanner', run: fixed.source.run, artifact: 'retest', digest: RETEST_DIGEST, testedCommit: FIX,
    })).toThrow(/independent/i);
    expect(() => transition(fixed, {
      type: 'retest', expectedRevision: 2, at: '2026-10-30T02:00:00.000Z', result: 'passed',
      scanner: 'osv-scanner', run: 'github:retest/2', artifact: 'retest', digest: RETEST_DIGEST, testedCommit: SHA,
    })).toThrow(/fixed commit/i);

    const closed = transition(fixed, {
      type: 'retest', expectedRevision: 2, at: '2026-10-30T02:00:00.000Z', result: 'passed',
      scanner: 'osv-scanner', run: 'github:retest/2', artifact: 'retest', digest: RETEST_DIGEST, testedCommit: FIX,
    });
    expect(closed.status).toBe('closed');
    expect(closed.retest?.result).toBe('passed');
    expect(() => transition(closed, {
      type: 'assign', expectedRevision: 3, at: '2026-10-30T03:00:00.000Z', owner: 'engineering',
    })).toThrow(/closed finding/i);
  });

  it('reopens a fixed finding when the retest still finds the defect', () => {
    const fixed = transition(finding(), {
      type: 'fix', expectedRevision: 1, at: '2026-10-30T01:00:00.000Z', fixedCommit: FIX, remediation: 'github:pull/1712',
    });
    const reopened = transition(fixed, {
      type: 'retest', expectedRevision: 2, at: '2026-10-30T02:00:00.000Z', result: 'failed',
      scanner: 'osv-scanner', run: 'github:retest/3', artifact: 'retest', digest: RETEST_DIGEST, testedCommit: FIX,
    });
    expect(reopened.status).toBe('open');
    expect(reopened.history.at(-1)?.type).toBe('retest-failed');
  });

  it('records expiring risk acceptance without pretending the finding is closed', () => {
    const accepted = transition(finding(), {
      type: 'risk-accept', expectedRevision: 1, at: '2026-10-30T03:00:00.000Z',
      approver: 'security', reason: 'Compensating control blocks the affected path', expiresAt: '2026-11-06T03:00:00.000Z',
    });
    expect(accepted.status).toBe('risk-accepted');
    expect(accepted.revision).toBe(2);
    expect(() => transition(finding(), {
      type: 'risk-accept', expectedRevision: 1, at: '2026-10-30T03:00:00.000Z',
      approver: 'security', reason: 'wait', expiresAt: '2026-10-29T03:00:00.000Z',
    })).toThrow(/expiry/i);
  });
});
