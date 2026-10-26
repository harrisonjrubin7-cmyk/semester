import { afterEach, describe, expect, it, vi } from "vitest";
import { authorize } from "./authorize";
import { grantsForRole } from "./roles";

const actor = { accountId: "a1", tenantId: "t1", grants: grantsForRole("student") };

describe("authorize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws FORBIDDEN with OPA's reasons when the decision denies", async () => {
    process.env.OPA_BASE_URL = "http://opa.test";
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ result: { allow: false, reasons: ["default_deny"], obligations: [] } })),
    ));
    await expect(authorize(actor, "student.tasks.create", { tenantId: "t1" })).rejects.toThrow(
      "FORBIDDEN:default_deny",
    );
  });

  it("returns the decision when allowed", async () => {
    process.env.OPA_BASE_URL = "http://opa.test";
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ result: { allow: true, reasons: ["tenant_match"], obligations: [] } })),
    ));
    await expect(authorize(actor, "student.tasks.create", { tenantId: "t1" })).resolves.toMatchObject({ allow: true });
  });
});

describe("grantsForRole", () => {
  it("returns no grants for an unknown or missing role", () => {
    expect(grantsForRole(null)).toEqual([]);
    expect(grantsForRole("unknown-role")).toEqual([]);
  });
});
