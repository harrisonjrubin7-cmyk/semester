import { describe, expect, it } from "vitest";
import { nextState, type EscalationEvent, type EscalationState } from "./escalation";

describe("nextState", () => {
  it("walks the happy path from draft to active", () => {
    let state: EscalationState = "draft";
    const path: EscalationEvent[] = [
      "SUBMIT",
      "ROUTE",
      "MANAGER_APPROVE",
      "OWNER_APPROVE",
      "ACTIVATE",
    ];
    for (const event of path) state = nextState(state, event);
    expect(state).toBe("active");
  });

  it("returns a request for information to submitted", () => {
    expect(nextState("manager_review", "REQUEST_INFORMATION")).toBe("needs_information");
    expect(nextState("needs_information", "SUBMIT")).toBe("submitted");
  });

  it("ends in denied or withdrawn without further transitions being valid", () => {
    expect(nextState("owner_review", "DENY")).toBe("denied");
    expect(() => nextState("denied", "SUBMIT")).toThrow("Invalid transition: denied / SUBMIT");
    expect(() => nextState("withdrawn", "SUBMIT")).toThrow("Invalid transition: withdrawn / SUBMIT");
  });

  it("only expires or revokes an active grant", () => {
    expect(nextState("active", "EXPIRE")).toBe("expired");
    expect(nextState("active", "REVOKE")).toBe("revoked");
    expect(() => nextState("approved", "EXPIRE")).toThrow();
  });

  it("cannot activate before owner approval", () => {
    expect(() => nextState("manager_review", "ACTIVATE")).toThrow();
    expect(() => nextState("owner_review", "ACTIVATE")).toThrow();
  });

  it("cannot skip manager review", () => {
    expect(() => nextState("submitted", "OWNER_APPROVE")).toThrow();
  });
});
