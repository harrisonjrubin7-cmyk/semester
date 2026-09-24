import type { FeatureState } from '../intelligence/contracts';

export type ControlPlaneStatus =
  | 'contract only'
  | 'sandbox tested'
  | 'awaiting authorization'
  | 'connected but degraded'
  | 'production verified';

export interface VerifiedTenantCapability {
  tenantId: string;
  capability: string;
  verified: boolean;
}

export interface ControlPlaneInput {
  /** Tenant proved by the authenticated boundary, never by the selector. */
  tenantId: string;
  /** Tenant currently being inspected. */
  viewedTenantId: string;
  /** Presentation only. It deliberately has no bearing on canEdit. */
  previewRole?: string;
  featureState: FeatureState;
  gatewayStatus: ControlPlaneStatus;
  verifiedCapabilities: VerifiedTenantCapability[];
  approvedSourceCount: number;
  activeConsentCount: number;
  auditEventCount: number;
}

export interface ControlPlaneSection {
  id: string;
  title: string;
  status: ControlPlaneStatus;
  detail: string;
}

export interface ControlPlaneView {
  canEdit: boolean;
  canCreateProductionReceipt: boolean;
  authorization: string;
  sections: ControlPlaneSection[];
}

const section = (
  id: string,
  title: string,
  status: ControlPlaneStatus,
  detail: string,
): ControlPlaneSection => ({ id, title, status, detail });

export function controlPlaneView(input: ControlPlaneInput): ControlPlaneView {
  const sameTenant = input.tenantId === input.viewedTenantId;
  const canEdit = sameTenant && input.verifiedCapabilities.some(
    (grant) =>
      grant.verified &&
      grant.tenantId === input.viewedTenantId &&
      grant.capability === 'tenant_admin',
  );
  const canCreateProductionReceipt =
    canEdit && input.featureState === 'production' && input.gatewayStatus === 'production verified';
  const localState: ControlPlaneStatus =
    input.featureState === 'production' ? input.gatewayStatus :
      input.featureState === 'sandbox' ? 'sandbox tested' : 'contract only';

  return {
    canEdit,
    canCreateProductionReceipt,
    authorization: canEdit
      ? `Verified tenant administrator for ${input.viewedTenantId}.`
      : input.previewRole
        ? 'Preview persona does not grant authorization. Changes remain local demonstrations.'
        : 'A verified tenant administrator capability is required to change policy.',
    sections: [
      section('identity', 'Identity', input.gatewayStatus, 'SSO, SCIM lifecycle and tenant membership.'),
      section('roles', 'Roles', canEdit ? localState : 'awaiting authorization', 'Verified grants, scoped roles and separation of duties.'),
      section('integrations', 'Integrations', input.gatewayStatus, 'LTI 1.3, learning-system and student-system connections.'),
      section('intelligence', 'Intelligence', localState, 'Provider routing, allowed modes, budgets and course policy.'),
      section('sources', 'Sources', input.approvedSourceCount > 0 ? localState : 'awaiting authorization', `${input.approvedSourceCount} faculty-approved sources in this view.`),
      section('governance', 'Data governance', localState, `${input.activeConsentCount} active consent records; retention follows tenant policy.`),
      section('audit', 'Audit', input.auditEventCount > 0 ? input.gatewayStatus : 'contract only', `${input.auditEventCount} policy and access events available.`),
      section('accessibility', 'Accessibility', 'sandbox tested', 'Keyboard, labels, landmarks, motion and contrast checks.'),
      section('outcomes', 'Outcomes', 'contract only', 'Adoption and learning outcomes require an approved measurement agreement.'),
      section('support', 'Support', 'sandbox tested', 'Explainable, consent-aware academic signals only; no protected traits or emotion inference.'),
    ],
  };
}

export interface SupportSignalCandidate {
  tenantId: string;
  personId: string;
  consent: boolean;
  missedRequiredItems?: number;
  daysSinceCourseActivity?: number;
  masteryTrend?: 'up' | 'stable' | 'down';
  /** Explicitly accepted in input so callers can pass records without these fields ever being used. */
  protectedTraits?: unknown;
  emotion?: unknown;
}

export interface SupportSignal {
  tenantId: string;
  personId: string;
  reasons: string[];
  suggestedAction: string;
  disciplinaryUse: false;
}

export function supportSignals(candidates: SupportSignalCandidate[]): SupportSignal[] {
  return candidates.flatMap((candidate) => {
    if (!candidate.consent) return [];
    const reasons: string[] = [];
    if ((candidate.missedRequiredItems ?? 0) > 0) {
      reasons.push(`${candidate.missedRequiredItems} required course items are past due.`);
    }
    if ((candidate.daysSinceCourseActivity ?? 0) >= 7) {
      reasons.push(`No recorded course activity for ${candidate.daysSinceCourseActivity} days.`);
    }
    if (candidate.masteryTrend === 'down') {
      reasons.push('Recent mastery evidence declined across completed practice.');
    }
    if (reasons.length === 0) return [];
    return [{
      tenantId: candidate.tenantId,
      personId: candidate.personId,
      reasons,
      suggestedAction: 'Offer an optional check-in and show the student why it was suggested.',
      disciplinaryUse: false as const,
    }];
  });
}
