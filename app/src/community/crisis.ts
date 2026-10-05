/**
 * Crisis handling and the institution escalation adapter.
 *
 * Community is not an emergency service and must never look like one: nobody
 * watches it at 3am, and a student who believes somebody does may wait for a
 * response that is not coming. So the notice below is shown on every report
 * form and every crisis-adjacent surface, word for word.
 *
 * Crisis language from a detector is a *possible concern*, routed to a
 * professional with support resources offered to the author. It is never a
 * diagnosis, never enforcement, and never an escalation on its own.
 *
 * Escalation to a university is the most consequential thing this module can
 * do, so it is the hardest to do:
 *
 * - off unless the tenant has configured it *and* the flag is on;
 * - requested and approved by two different professionals, neither of them
 *   automation;
 * - only for P0/P1 cases and only for the purposes the tenant agreed in writing;
 * - carrying an allowlisted, minimum-data payload — a vault reference, never a
 *   name or email, and only when the agreement requires identity at all;
 * - one delivery per case, audited. There is no dashboard and no standing feed.
 */

import { enabled, type CommunityFlags } from './flags';
import type { ModerationCase, ReportCategory, Severity } from './moderation';

export const CRISIS_NOTICE =
  'If someone is in immediate danger, contact local emergency services or your campus emergency/safety service now. Semester Community is not monitored as an emergency-response service.';

export interface CrisisSignal {
  kind: 'possible_concern';
  /** Always a human decision, never the detector's. */
  route: 'professional';
  showSupportResources: true;
  note: string;
}

/** What a crisis-language detector hit becomes. Deliberately not a diagnosis. */
export function crisisSignal(): CrisisSignal {
  return {
    kind: 'possible_concern',
    route: 'professional',
    showSupportResources: true,
    note: 'Language that may indicate a concern. Keyword matches alone are not an assessment; a trained reviewer decides what, if anything, to do.',
  };
}

export interface TenantEscalationPolicy {
  tenantId: string;
  /** Off unless the institution signed an agreement and it was configured. */
  enabled: boolean;
  agreementRef: string;
  /** Which categories the agreement covers. */
  categories: ReportCategory[];
  /** Whether the agreement requires the student's identity to be shared. */
  identityRequired: boolean;
  /** Where deliveries go: an adapter id, never an open dashboard. */
  channel: string;
}

export const DEFAULT_ESCALATION_POLICY = (tenantId: string): TenantEscalationPolicy => ({
  tenantId,
  enabled: false,
  agreementRef: '',
  categories: [],
  identityRequired: false,
  channel: '',
});

export interface EscalationApproval {
  actorId: string;
  actorKind: 'professional' | 'senior_professional' | 'automation' | 'volunteer';
  reason: string;
  at: string;
}

export interface EscalationPayload {
  caseId: string;
  tenantId: string;
  category: ReportCategory;
  severity: Severity;
  summary: string;
  occurredAt: string;
  agreementRef: string;
  /** Present only when the agreement requires identity. A reference, not the identity. */
  vaultRef?: string;
}

export class EscalationRefused extends Error {}

export const SUMMARY_MAX = 500;

export function prepareEscalation(args: {
  flags: CommunityFlags;
  policy: TenantEscalationPolicy;
  kase: ModerationCase;
  approvals: EscalationApproval[];
  summary: string;
  vaultRef?: string;
  alreadyDelivered: boolean;
  now: Date;
}): EscalationPayload {
  const { flags, policy, kase, approvals, summary, vaultRef, now } = args;
  if (!enabled(flags, 'institutionEscalation')) throw new EscalationRefused('Institution escalation is switched off.');
  if (!policy.enabled || !policy.agreementRef || !policy.channel) {
    throw new EscalationRefused('This institution has no escalation agreement configured.');
  }
  if (kase.severity !== 'P0' && kase.severity !== 'P1') throw new EscalationRefused('Only P0 and P1 cases can be escalated.');
  if (!policy.categories.includes(kase.category)) throw new EscalationRefused('The agreement does not cover this category.');
  if (args.alreadyDelivered) throw new EscalationRefused('This case has already been escalated once.');

  const human = approvals.filter(
    (a) => (a.actorKind === 'professional' || a.actorKind === 'senior_professional') && a.reason.trim().length >= 10,
  );
  const distinct = new Set(human.map((a) => a.actorId));
  if (distinct.size < 2) throw new EscalationRefused('Two different professionals must approve, each with a reason.');
  if (approvals.some((a) => a.actorKind === 'automation' || a.actorKind === 'volunteer')) {
    throw new EscalationRefused('Automation and volunteers cannot take part in escalation.');
  }
  if (policy.identityRequired && !vaultRef) throw new EscalationRefused('The agreement requires an identity reference.');

  const payload: EscalationPayload = {
    caseId: kase.id,
    tenantId: policy.tenantId,
    category: kase.category,
    severity: kase.severity,
    summary: summary.slice(0, SUMMARY_MAX),
    occurredAt: now.toISOString(),
    agreementRef: policy.agreementRef,
  };
  if (policy.identityRequired) payload.vaultRef = vaultRef;
  return payload;
}
