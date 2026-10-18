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

  let body: { result?: PolicyDecision };
  try {
    body = (await response.json()) as { result?: PolicyDecision };
  } catch {
    throw new Error("POLICY_UNAVAILABLE");
  }
  if (!body.result || typeof body.result.allow !== "boolean") {
    throw new Error("POLICY_UNAVAILABLE");
  }
  return body.result;
}
