/**
 * Policy evaluation for the whole platform, in one vocabulary.
 *
 * Two kinds of action reach this:
 *
 * 1. Actions the institution package's decision point already has a rule for
 *    (`POLICY_ACTIONS` — support context, AI retrieval, grade passback). They
 *    are sent to `decide()` unchanged. This file does not re-implement them.
 * 2. Every other action, which must be **declared** here as an `ActionRule`:
 *    the capability it needs, the classification ceiling, whether the owner
 *    may do it to their own data, whether consent from the owner opens it to
 *    someone else, and the obligations an allowance carries. An action with no
 *    declaration is denied. That is the whole fail-closed property, and it is
 *    why a typo in an action name cannot grant anything.
 *
 * The evaluator is a pure function of its inputs plus a `PolicyInformation`
 * port that resolves what the request cannot carry (scope-resolved capabilities,
 * consent records, relationships). It never reads a tenant from anywhere but
 * the `RequestContext`, and it refuses a resource whose `tenantId` is not that
 * tenant before it looks at a single role.
 */

import { decide as decideInstitution, isPolicyAction } from '../seam/institution.ts';
import type { AuthorizationDecision, PolicyObligation, ResourceClassification, UserAction } from '../seam/institution.ts';
import { RESOURCE_CLASSIFICATIONS } from '../seam/institution.ts';
import { PlatformError } from '../gateway/errors.ts';
import type { RequestContext } from '../tenancy/context.ts';

export interface ActionRule {
  action: string;
  /** The capability that must be held at the resource's scope. `null` means no capability opens it: owner or consent only. */
  capability: string | null;
  classificationCeiling: ResourceClassification;
  /** The owner of the resource may do this to it without a capability. */
  ownerMay?: boolean;
  /** A live consent for this purpose and scope opens it to the grantee. */
  consent?: { purpose: string; scope: string };
  /** Sensitive actions: the session's MFA must be fresh. */
  requiresFreshMfa?: boolean;
  /** Needs a second person (`identity/approval.ts`); the evaluator reports it, the command enforces it. */
  requiresApproval?: boolean;
  obligations?: readonly PolicyObligation[];
  /** Purposes the action may be performed for. Empty or absent = `service_delivery` only. */
  purposes?: readonly string[];
}

export interface PolicyResource {
  type: string;
  id?: string;
  tenantId: string;
  ownerId?: string;
  nodeId?: string | null;
  classification?: ResourceClassification;
  attributes?: Record<string, unknown>;
}

/** What the evaluator cannot learn from the request itself. The production binding reads Postgres; the reference one is in `testing/`. */
export interface PolicyInformation {
  /** Capabilities the actor holds at the resource's node, scope-resolved, expired grants already gone. */
  capabilities(ctx: RequestContext, nodeId: string | null): Promise<ReadonlySet<string>> | ReadonlySet<string>;
  /** Whether a live consent covers this exact request. */
  hasConsent(ctx: RequestContext, q: { subjectId: string; purpose: string; scope: string; resourceId: string }): Promise<boolean> | boolean;
}

export type PlatformDecision =
  | { allow: true; obligations: PolicyObligation[]; requiresApproval: boolean; reasonCode: string }
  | { allow: false; reasonCode: string; userMessage: string; userAction?: UserAction };

const deny = (reasonCode: string, userMessage: string, userAction?: UserAction): PlatformDecision =>
  userAction ? { allow: false, reasonCode, userMessage, userAction } : { allow: false, reasonCode, userMessage };

const FRESH_MFA: UserAction = { label: 'Confirm it is you', kind: 'open_screen' };

export class PolicyEngine {
  private readonly rules = new Map<string, ActionRule>();

  private readonly pip: PolicyInformation;
  private readonly clockMs: () => number;

  constructor(pip: PolicyInformation, rules: readonly ActionRule[], clockMs: () => number) {
    this.pip = pip;
    this.clockMs = clockMs;
    for (const r of rules) {
      if (isPolicyAction(r.action)) throw new Error(`Action ${r.action} belongs to the institution decision point and cannot be redeclared.`);
      if (this.rules.has(r.action)) throw new Error(`Action ${r.action} is declared twice.`);
      this.rules.set(r.action, r);
    }
  }

  declared(): string[] {
    return [...this.rules.keys()];
  }

  async evaluate(ctx: RequestContext, action: string, resource: PolicyResource): Promise<PlatformDecision> {
    // 1. Tenant first. A resource from elsewhere is refused before any role is read.
    if (resource.tenantId !== ctx.tenantId) {
      return deny('tenant_mismatch', 'You do not have access to that.');
    }

    // 2. Actions the institution decision point owns go to it, unchanged.
    if (isPolicyAction(action)) return this.viaInstitution(ctx, action, resource);

    const rule = this.rules.get(action);
    if (!rule) return deny('action_not_declared', 'That action is not available.');

    const allowedPurposes = rule.purposes?.length ? rule.purposes : ['service_delivery'];
    if (!allowedPurposes.includes(ctx.purpose)) return deny('purpose_not_allowed', 'That action is not available for this purpose.');

    const ceiling = RESOURCE_CLASSIFICATIONS.indexOf(rule.classificationCeiling);
    const level = RESOURCE_CLASSIFICATIONS.indexOf(resource.classification ?? 'internal');
    if (level > ceiling) return deny('classification_above_ceiling', 'That action cannot be used on this kind of record.');

    if (rule.requiresFreshMfa && ctx.actor.mfaLevel !== 'fresh') {
      return deny('fresh_mfa_required', 'Confirm it is you to continue.', FRESH_MFA);
    }

    const opened = await this.opens(ctx, rule, resource);
    if (!opened) {
      // A consent could have opened this: say so, so the surface can offer the person who owns the data a prompt.
      return rule.consent
        ? deny('consent_required', 'You need the owner\'s permission to see this.')
        : deny('no_grant', 'You do not have access to that.');
    }

    const obligations: PolicyObligation[] = [{ type: 'audit', eventType: rule.action }, ...(rule.obligations ?? [])];
    return { allow: true, obligations, requiresApproval: rule.requiresApproval === true, reasonCode: opened };
  }

  /** Why the request is opened, or `null`. Owner, then capability, then consent: the cheapest and most specific first. */
  private async opens(ctx: RequestContext, rule: ActionRule, resource: PolicyResource): Promise<string | null> {
    if (rule.ownerMay && resource.ownerId !== undefined && resource.ownerId === ctx.actor.personId) return 'owner';
    if (rule.capability !== null) {
      const caps = await this.pip.capabilities(ctx, resource.nodeId ?? null);
      if (caps.has(rule.capability)) return 'capability';
    }
    if (rule.consent && resource.ownerId !== undefined && resource.id !== undefined) {
      const ok = await this.pip.hasConsent(ctx, {
        subjectId: resource.ownerId,
        purpose: rule.consent.purpose,
        scope: rule.consent.scope,
        resourceId: resource.id,
      });
      if (ok) return 'consent';
    }
    return null;
  }

  private viaInstitution(ctx: RequestContext, action: string, resource: PolicyResource): PlatformDecision {
    const d: AuthorizationDecision = decideInstitution(
      {
        actor: {
          id: ctx.actor.personId,
          type: ctx.actor.type,
          authenticatedAt: ctx.actor.authenticatedAt,
          ...(ctx.actor.mfaLevel ? { mfaLevel: ctx.actor.mfaLevel } : {}),
          ...(ctx.actor.sessionId ? { sessionId: ctx.actor.sessionId } : {}),
        },
        tenant: { id: ctx.tenantId, environment: ctx.environment, verifiedBy: ctx.verifiedBy },
        action,
        resource: {
          type: resource.type,
          ...(resource.id !== undefined ? { id: resource.id } : {}),
          ...(resource.ownerId !== undefined ? { ownerId: resource.ownerId } : {}),
          ...(resource.classification ? { classification: resource.classification } : {}),
          ...(resource.attributes ? { attributes: resource.attributes } : {}),
        },
        context: {
          membershipIds: [...ctx.membershipIds],
          roleGrants: [...ctx.roleGrants],
          capabilities: [...ctx.capabilities],
          consentGrants: [],
          featureFlags: [],
          policyVersions: {},
          purpose: ctx.purpose,
          correlationId: ctx.correlationId,
          ...(ctx.idempotencyKey ? { idempotencyKey: ctx.idempotencyKey } : {}),
        },
      },
      this.clockMs(),
    );
    return d.allow
      ? { allow: true, obligations: d.obligations, requiresApproval: false, reasonCode: 'institution_rule' }
      : { allow: false, reasonCode: d.reasonCode, userMessage: d.userMessage, ...(d.userAction ? { userAction: d.userAction } : {}) };
  }
}

/** The enforcement half: throws `forbidden` with the person's sentence, and hands back the obligations on allow. */
export async function requirePolicy(
  engine: PolicyEngine,
  ctx: RequestContext,
  action: string,
  resource: PolicyResource,
): Promise<Extract<PlatformDecision, { allow: true }>> {
  const d = await engine.evaluate(ctx, action, resource);
  if (d.allow) return d;
  throw new PlatformError(d.reasonCode === 'consent_required' ? 'consent_required' : 'forbidden', d.userMessage, d.userAction ? { userAction: d.userAction } : {});
}
