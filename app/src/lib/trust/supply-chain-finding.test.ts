import { describe, expect, it } from 'vitest';
import { assessAdvisoryImpact } from '../supplychain';
import { openSupplyChainFinding } from './supply-chain-finding';

const SHA = 'a'.repeat(40);
const DIGEST = `sha256:${'b'.repeat(64)}`;
const advisory = {
  advisoryId: 'GHSA-test-5678',
  packageName: 'example-package',
  installedVersion: '2.0.0',
  detectedAt: '2026-10-29T18:00:00.000Z',
  lockfile: 'app',
} as const;

const source = {
  scanner: 'osv-scanner',
  run: 'github:40986567158/job/123',
  artifact: 'platform-control-reports',
  digest: DIGEST,
  commit: SHA,
  detectedAt: advisory.detectedAt,
};

describe('supply-chain finding intake', () => {
  it('opens an assessed advisory against immutable scan evidence without hiding impact blockers', () => {
    const assessment = assessAdvisoryImpact(advisory);
    const record = openSupplyChainFinding({
      assessment,
      findingId: 'SEC-2026-0043',
      severity: 'high',
      owner: 'security',
      source,
    });

    expect(record.finding).toMatchObject({
      id: 'SEC-2026-0043',
      component: 'app:example-package@2.0.0',
      summary: 'GHSA-test-5678 affects example-package@2.0.0',
      dueAt: '2026-11-12T18:00:00.000Z',
      status: 'open',
    });
    expect(record.impact).toEqual({
      complete: false,
      blockers: assessment.blockers,
      customerImpactDecision: 'not-decided',
    });
    expect(record.notification).toMatchObject({
      state: 'undetermined',
      customerNoticeSent: false,
    });
    expect(record.incidentClosureEligible).toBe(false);
  });

  it('preserves an authorized notification route without composing or sending a notice', () => {
    const assessment = assessAdvisoryImpact(advisory);
    const record = openSupplyChainFinding({
      assessment,
      findingId: 'SEC-2026-0044',
      severity: 'critical',
      owner: 'security',
      source,
      notificationTrigger: {
        kind: 'contractual-duty',
        decidedBy: 'Legal',
        evidence: 'Counsel decision LD-10 says unresolved reach requires notice under the contract.',
      },
    });

    expect(record.notification).toMatchObject({
      state: 'notice-required',
      basis: 'contractual-duty',
      exposure: 'Unknown',
      customerNoticeSent: false,
      unresolvedAssessmentBlockers: assessment.blockers,
    });
    expect(record.incidentClosureEligible).toBe(false);
    expect(record).not.toHaveProperty('message');
    expect(record).not.toHaveProperty('recipient');
  });

  it('rejects a scan reference that does not represent the assessed detection', () => {
    expect(() => openSupplyChainFinding({
      assessment: assessAdvisoryImpact(advisory),
      findingId: 'SEC-2026-0045',
      severity: 'high',
      owner: 'security',
      source: { ...source, detectedAt: '2026-10-29T18:00:01.000Z' },
    })).toThrow(/same detection timestamp/i);
  });

  it('inherits the lifecycle requirement for exact scanned bytes and code', () => {
    const assessment = assessAdvisoryImpact(advisory);
    expect(() => openSupplyChainFinding({
      assessment,
      findingId: 'SEC-2026-0046',
      severity: 'high',
      owner: 'security',
      source: { ...source, digest: 'latest' },
    })).toThrow(/digest/i);
    expect(() => openSupplyChainFinding({
      assessment,
      findingId: 'SEC-2026-0046',
      severity: 'high',
      owner: 'security',
      source: { ...source, commit: 'main' },
    })).toThrow(/commit/i);
  });
});
