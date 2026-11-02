import { describe, expect, it, vi } from "vitest";

const cookieValue = { current: undefined as string | undefined };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "semester_session" && cookieValue.current ? { value: cookieValue.current } : undefined) }),
  headers: async () => new Map<string, string>([["x-correlation-id", "corr-1"]]) as unknown as { get: (k: string) => string | null },
}));

const getSessionByToken = vi.fn();
vi.mock("@semester/database/sessions", () => ({ getSessionByToken }));

const { requireSession } = await import("./server");

describe("requireSession", () => {
  it("throws UNAUTHENTICATED when no cookie is present", async () => {
    cookieValue.current = undefined;
    await expect(requireSession()).rejects.toThrow("UNAUTHENTICATED");
    expect(getSessionByToken).not.toHaveBeenCalled();
  });

  it("throws UNAUTHENTICATED when the token does not resolve", async () => {
    cookieValue.current = "stale";
    getSessionByToken.mockResolvedValueOnce(null);
    await expect(requireSession()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("builds the request context with grants derived from the role", async () => {
    cookieValue.current = "good";
    getSessionByToken.mockResolvedValueOnce({
      id: "s1", accountId: "a1", tenantId: "t1", membershipId: "m1", activeWorkspace: null, roleKey: "student",
    });
    const ctx = await requireSession();
    expect(ctx).toMatchObject({ sessionId: "s1", accountId: "a1", tenantId: "t1", correlationId: "corr-1" });
    expect(ctx.grants).toContain("student.tasks.create");
  });
});
