import type { AdvisoryImpactAssessment } from '../supplychain';
import { openFinding, type Finding, type FindingSeverity, type ScanReference } from './finding-lifecycle';
import {
  routeSupplyChainNotice,
  type SupplyChainNotificationRoute,
  type SupplyChainNotificationTrigger,
} from './supply-chain-notification';

export interface OpenSupplyChainFinding {
  assessment: AdvisoryImpactAssessment;
  findingId: string;
  severity: FindingSeverity;
  owner: string;
  source: ScanReference;
  notificationTrigger?: SupplyChainNotificationTrigger;
}

export interface SupplyChainFindingRecord {
  finding: Finding;
  impact: {
    complete: boolean;
    blockers: readonly string[];
    customerImpactDecision: 'not-decided';
  };
  notification: SupplyChainNotificationRoute;
  /** A remediated finding alone cannot close the surrounding incident. */
  incidentClosureEligible: false;
}

const sameInstant = (left: string, right: string): boolean => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
};

/**
 * Opens repository-only corrective-action state for one assessed advisory.
 * The assessment and immutable scan reference must represent the same
 * detection. Notification policy is evaluated against that same assessment,
 * but no message is composed and nothing is sent. Incident closure remains a
 * separate operated decision even if the security finding later closes.
 */
export function openSupplyChainFinding(input: OpenSupplyChainFinding): SupplyChainFindingRecord {
  if (!sameInstant(input.assessment.detectedAt, input.source.detectedAt)) {
    throw new Error('The assessment and scan reference must cite the same detection timestamp');
  }

  const finding = openFinding({
    id: input.findingId,
    severity: input.severity,
    component: `${input.assessment.lockfile}:${input.assessment.packageName}@${input.assessment.installedVersion}`,
    summary: `${input.assessment.advisoryId} affects ${input.assessment.packageName}@${input.assessment.installedVersion}`,
    owner: input.owner,
    source: input.source,
  });
  const notification = routeSupplyChainNotice({
    assessment: input.assessment,
    trigger: input.notificationTrigger,
  });

  return {
    finding,
    impact: {
      complete: input.assessment.complete,
      blockers: input.assessment.blockers,
      customerImpactDecision: input.assessment.customerImpactDecision,
    },
    notification,
    incidentClosureEligible: false,
  };
}
