import type { AdvisoryImpactAssessment } from '../supplychain';
import { AUDIENCES } from '../governance/incident-comms';

export type NotificationAuthority = 'Legal' | 'Privacy owner';

export type SupplyChainNotificationTrigger =
  | { kind: 'confirmed-impact'; decidedBy: NotificationAuthority; evidence: string }
  | { kind: 'contractual-duty'; decidedBy: NotificationAuthority; evidence: string }
  | { kind: 'authorized-uncertainty'; decidedBy: NotificationAuthority; evidence: string }
  | { kind: 'regulatory-duty'; decidedBy: NotificationAuthority; evidence: string; deadline: string };

export interface SupplyChainNotificationInput {
  assessment: AdvisoryImpactAssessment;
  trigger?: SupplyChainNotificationTrigger;
}

export type SupplyChainNotificationRoute =
  | {
      state: 'undetermined';
      blockers: readonly string[];
      customerNoticeSent: false;
    }
  | {
      state: 'notice-required';
      audience: 'security';
      exposure: 'Confirmed' | 'Unknown';
      basis: SupplyChainNotificationTrigger['kind'];
      basisEvidence: string;
      decidedBy: NotificationAuthority;
      deadline: string | null;
      requiredApprovers: readonly string[];
      notifyInstitution: true;
      unresolvedAssessmentBlockers: readonly string[];
      customerNoticeSent: false;
    };

const AUTHORITIES: readonly NotificationAuthority[] = ['Legal', 'Privacy owner'];
const PLACEHOLDER = /\[[^\]\n]+\]/;

const evidence = (value: string): string => {
  const clean = value.trim();
  if (!clean) throw new Error('Notification-basis evidence is required');
  if (PLACEHOLDER.test(clean)) throw new Error('Notification-basis evidence contains a placeholder');
  return clean;
};

const deadline = (value: string | undefined): string => {
  const clean = (value ?? '').trim();
  if (!clean || Number.isNaN(Date.parse(clean))) throw new Error('A valid regulatory notification deadline is required');
  return clean;
};

/**
 * Routes an evidenced supply-chain notification basis into the existing
 * security communications policy. It prepares no message and sends nothing.
 * Legal/privacy authority supplies the duty; repository code only checks that
 * the record is complete and preserves unresolved impact-assessment blockers.
 */
export function routeSupplyChainNotice(input: SupplyChainNotificationInput): SupplyChainNotificationRoute {
  const { assessment, trigger } = input;
  if (!trigger) {
    return {
      state: 'undetermined',
      blockers: ['An authorized notification basis has not been recorded.', ...assessment.blockers],
      customerNoticeSent: false,
    };
  }

  if (!AUTHORITIES.includes(trigger.decidedBy)) throw new Error(`${trigger.decidedBy} is not an authorized notification decision maker`);
  const basisEvidence = evidence(trigger.evidence);

  if (trigger.kind === 'confirmed-impact') {
    const blockers: string[] = [];
    if (!assessment.complete) blockers.push('The service and tenant impact assessment must be complete before confirmed impact can be recorded.');
    if (assessment.tenantReach.state === 'evidenced' && assessment.tenantReach.scope === 'no-active-tenants') {
      blockers.push('Confirmed customer impact cannot be recorded when the authoritative assessment says there are no active tenants.');
    }
    if (blockers.length) return { state: 'undetermined', blockers, customerNoticeSent: false };
  }

  const security = AUDIENCES.security;
  return {
    state: 'notice-required',
    audience: 'security',
    exposure: trigger.kind === 'confirmed-impact' ? 'Confirmed' : 'Unknown',
    basis: trigger.kind,
    basisEvidence,
    decidedBy: trigger.decidedBy,
    deadline: trigger.kind === 'regulatory-duty' ? deadline(trigger.deadline) : null,
    requiredApprovers: security.approvers,
    notifyInstitution: true,
    unresolvedAssessmentBlockers: assessment.blockers,
    customerNoticeSent: false,
  };
}
