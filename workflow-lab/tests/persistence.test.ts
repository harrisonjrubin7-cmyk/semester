import { describe, expect, it } from "vitest";
import {
  PERSISTENCE_MODES,
  clampPersistenceGrade,
  evaluatePersistenceFacts,
  persistenceCeiling,
  type PersistenceFacts,
} from "@/lib/benchmark/probes/persistence";
import { createDb, rows, type Db } from "./helpers/db";
import { afterAll, beforeAll } from "vitest";

const facts = (o: Partial<PersistenceFacts> = {}): PersistenceFacts => ({ required: true, tested: true, survivedReload: true, mode: "database", hasEvidence: true, ...o });

describe("persistenceCeiling", () => {
  it("is unrestricted when persistence is not required", () => {
    expect(persistenceCeiling(facts({ required: false, tested: false })).ceiling).toBe(5);
  });
  it("is 0 when required but never tested", () => {
    expect(persistenceCeiling(facts({ tested: false })).ceiling).toBe(0);
  });
  it("local UI state that did not survive a reload earns at most 1 (and 0 for 'none')", () => {
    expect(persistenceCeiling(facts({ mode: "local-preview", survivedReload: false })).ceiling).toBe(1);
    expect(persistenceCeiling(facts({ mode: "database", survivedReload: false })).ceiling).toBe(1);
    expect(persistenceCeiling(facts({ mode: "none", survivedReload: false })).ceiling).toBe(0);
  });
  it("an unrecorded survival result is treated as incomplete, not as success", () => {
    expect(persistenceCeiling(facts({ survivedReload: null })).ceiling).toBe(1);
    expect(persistenceCeiling(facts({ survivedReload: undefined })).ceiling).toBe(1);
  });
  it("caps by storage mode when state survived", () => {
    const c = (mode: PersistenceFacts["mode"]) => persistenceCeiling(facts({ mode })).ceiling;
    expect(c("none")).toBe(0);
    expect(c("local-preview")).toBe(1);
    expect(c("session")).toBe(2);
    expect(c("browser-local")).toBe(3);
    expect(c("database")).toBe(5);
    expect(c("project-backed")).toBe(5);
  });
  it("durable modes need evidence to exceed 3", () => {
    expect(persistenceCeiling(facts({ mode: "database", hasEvidence: false })).ceiling).toBe(3);
    expect(persistenceCeiling(facts({ mode: "project-backed", hasEvidence: false })).ceiling).toBe(3);
    expect(persistenceCeiling(facts({ mode: "browser-local", hasEvidence: false })).ceiling).toBe(3);
  });
  it("never exceeds 5 or goes below 0, for every combination", () => {
    for (const required of [true, false]) for (const tested of [true, false]) for (const survivedReload of [true, false, null])
      for (const mode of PERSISTENCE_MODES) for (const hasEvidence of [true, false]) {
        const { ceiling } = persistenceCeiling({ required, tested, survivedReload, mode, hasEvidence });
        expect(ceiling).toBeGreaterThanOrEqual(0);
        expect(ceiling).toBeLessThanOrEqual(5);
      }
  });
});

describe("clampPersistenceGrade and the verdict", () => {
  it("clamps down, never up", () => {
    const c = persistenceCeiling(facts({ mode: "browser-local" }));
    expect(clampPersistenceGrade(5, c)).toEqual({ value: 3, clamped: true });
    expect(clampPersistenceGrade(2, c)).toEqual({ value: 2, clamped: false });
  });
  it("a UI with only local state does not pass a persistence-required task", () => {
    const v = evaluatePersistenceFacts(facts({ mode: "local-preview", survivedReload: false }), "state reset on refresh");
    expect(v.passed).toBe(false);
    expect(v.score).toBe(1);
    expect(v.evidence.join(" ")).toMatch(/did not survive a reload/);
    expect(v.evidence).toContain("state reset on refresh");
  });
  it("passes when durable, evidenced storage survived", () => {
    expect(evaluatePersistenceFacts(facts()).passed).toBe(true);
  });
  it("passes trivially when persistence is not required", () => {
    expect(evaluatePersistenceFacts(facts({ required: false, tested: false })).passed).toBe(true);
  });
});

describe("TypeScript and SQL ceilings agree (private.persistence_ceiling)", () => {
  let db: Db;
  beforeAll(async () => { db = await createDb({ seed: false }); });
  afterAll(async () => { await db.close(); });

  it("for every combination of inputs", async () => {
    let n = 0;
    for (const required of [true, false]) for (const tested of [true, false]) for (const survivedReload of [true, false, null])
      for (const mode of PERSISTENCE_MODES) for (const hasEvidence of [true, false]) {
        const sql = await rows<{ c: number }>(db, "select private.persistence_ceiling($1, $2, $3, $4::public.persistence_mode, $5) as c", [required, tested, survivedReload, mode, hasEvidence]);
        expect(sql[0]!.c, JSON.stringify({ required, tested, survivedReload, mode, hasEvidence })).toBe(persistenceCeiling({ required, tested, survivedReload, mode, hasEvidence }).ceiling);
        n++;
      }
    expect(n).toBe(2 * 2 * 3 * 6 * 2);
  });
});
