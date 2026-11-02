import { evaluatePolicy, type PolicyDecision } from "@semester/policy/client";

export type ActorContext = {
  accountId: string;
  tenantId: string | null;
  grants: readonly string[];
};

export type ResourceContext = {
  tenantId: string | null;
  ownerAccountId?: string | null;
  sensitivity?: "low" | "moderate" | "high";
  consentRequired?: boolean;
};

export async function authorize(
  actor: ActorContext,
  action: string,
  resource: ResourceContext,
): Promise<PolicyDecision> {
  const decision = await evaluatePolicy({
    actor: {
      accountId: actor.accountId,
      tenantId: actor.tenantId,
      grants: [...actor.grants],
    },
    resource,
    action,
  });
  if (!decision.allow) {
    throw new Error(`FORBIDDEN:${decision.reasons.join(",")}`);
  }
  return decision;
}
