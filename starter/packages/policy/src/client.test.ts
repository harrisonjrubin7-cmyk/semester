import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePolicy, type PolicyInput } from "./client";

const input: PolicyInput = {
  actor: { accountId: "a1", tenantId: "t1", grants: ["student.today.read"] },
  resource: { tenantId: "t1" },
  action: "student.today.read",
};

describe("evaluatePolicy", () => {
  beforeEach(() => {
    process.env.OPA_BASE_URL = "http://opa.test";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPA_BASE_URL;
  });

  it("returns OPA's decision and posts to the access package path", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ result: { allow: true, reasons: ["tenant_match"], obligations: [] } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const decision = await evaluatePolicy(input);

    expect(decision.allow).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://opa.test/v1/data/semester/access/allow_with_context",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails closed when OPA_BASE_URL is unset", async () => {
    delete process.env.OPA_BASE_URL;
    await expect(evaluatePolicy(input)).rejects.toThrow("POLICY_UNAVAILABLE");
  });

  it("fails closed on transport error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    await expect(evaluatePolicy(input)).rejects.toThrow("POLICY_UNAVAILABLE");
  });

  it("fails closed on non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(evaluatePolicy(input)).rejects.toThrow("POLICY_UNAVAILABLE");
  });

  it("fails closed when the result is undefined", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    await expect(evaluatePolicy(input)).rejects.toThrow("POLICY_UNAVAILABLE");
  });
});
