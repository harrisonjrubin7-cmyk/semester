export type PolicyInput = {
  actor: { accountId: string; tenantId: string | null; grants: string[] };
  resource: {
    tenantId: string | null;
    ownerAccountId?: string | null;
    sensitivity?: "low" | "moderate" | "high";
    consentRequired?: boolean;
  };
  action: string;
};

export type PolicyDecision = {
  allow: boolean;
  reasons: string[];
  obligations: string[];
};

// Checks the whole shape. authorize() joins reasons, so a partial object would
// fail later as a TypeError instead of as POLICY_UNAVAILABLE.
function isPolicyDecision(value: unknown): value is PolicyDecision {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.allow === "boolean" &&
    Array.isArray(v.reasons) && v.reasons.every((r) => typeof r === "string") &&
    Array.isArray(v.obligations) && v.obligations.every((o) => typeof o === "string")
  );
}

/**
 * Asks OPA for a decision. Fails closed: a missing config, transport error,
 * timeout, non-2xx response, or undefined result all throw POLICY_UNAVAILABLE.
 */
export async function evaluatePolicy(input: PolicyInput): Promise<PolicyDecision> {
  const base = process.env.OPA_BASE_URL;
  if (!base) throw new Error("POLICY_UNAVAILABLE");

  let response: Response;
  try {
    response = await fetch(`${base}/v1/data/semester/access/allow_with_context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    throw new Error("POLICY_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("POLICY_UNAVAILABLE");

  let body: { result?: unknown };
  try {
    body = (await response.json()) as { result?: unknown };
  } catch {
    throw new Error("POLICY_UNAVAILABLE");
  }
  if (!isPolicyDecision(body.result)) throw new Error("POLICY_UNAVAILABLE");
  return body.result;
}
