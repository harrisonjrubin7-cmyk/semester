import { describe, expect, it } from "vitest";
import { createWorkspace } from "./flight-plan";

const loadStorage = () => import("./flight-plan-storage");

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe("Flight Plan storage", () => {
  it("creates a key scoped to institution, role and person", async () => {
    const { flightStorageKey } = await loadStorage();
    expect(flightStorageKey("northstar", "student", "northstar-student")).toBe(
      "semester.flight-plan.v1.northstar.student.northstar-student",
    );
    expect(
      flightStorageKey("northstar", "advisor", "northstar-advisor"),
    ).not.toBe(
      flightStorageKey("cedar-coast", "advisor", "cedar-coast-advisor"),
    );
  });

  it("reports available when no saved workspace exists", async () => {
    const { readFlightWorkspace } = await loadStorage();
    const result = readFlightWorkspace(
      memoryStorage(),
      "northstar",
      "student",
      "northstar-student",
    );
    expect(result.status).toBe("available");
    expect(result.workspace.tenant).toBe("northstar");
  });

  it("reports unavailable when browser storage cannot be read", async () => {
    const { readFlightWorkspace } = await loadStorage();
    const result = readFlightWorkspace(
      {
        getItem: () => {
          throw new DOMException("Blocked", "SecurityError");
        },
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      "northstar",
      "student",
      "northstar-student",
    );
    expect(result.status).toBe("unavailable");
    expect(result.workspace).toEqual(createWorkspace("northstar", "student"));
  });

  it("rejects a workspace with another schema version without overwriting it", async () => {
    const { flightStorageKey, readFlightWorkspace } = await loadStorage();
    const key = flightStorageKey("northstar", "student", "northstar-student");
    const saved = JSON.stringify({
      ...createWorkspace("northstar", "student"),
      version: 2,
    });
    const storage = memoryStorage({ [key]: saved });
    const result = readFlightWorkspace(
      storage,
      "northstar",
      "student",
      "northstar-student",
    );
    expect(result.status).toBe("rejected");
    expect(storage.getItem(key)).toBe(saved);
  });

  it("round-trips a matching workspace and reports restored", async () => {
    const { readFlightWorkspace, writeFlightWorkspace } = await loadStorage();
    const storage = memoryStorage();
    const workspace = createWorkspace("cedar-coast", "advisor");
    expect(
      writeFlightWorkspace(storage, "cedar-coast-advisor", workspace),
    ).toEqual({ status: "available" });
    const result = readFlightWorkspace(
      storage,
      "cedar-coast",
      "advisor",
      "cedar-coast-advisor",
    );
    expect(result.status).toBe("restored");
    expect(result.workspace).toEqual(workspace);
  });
});
