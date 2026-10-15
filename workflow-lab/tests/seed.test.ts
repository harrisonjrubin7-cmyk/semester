import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BENCHMARK_EXECUTION_CONFIG, BENCHMARK_WORKFLOWS, CRITERIA, validateExecutionConfig } from "@/lib/benchmark/benchmark.config";
import { renderSeedSql } from "@/lib/benchmark/seed";
import { ADAPTERS } from "@/lib/benchmark/adapters";
import { requiresBackend } from "@/lib/benchmark/adapters/capability-guard";
import { PLATFORM_IDS } from "@/lib/workflow-router/platforms";

describe("seed", () => {
  it("supabase/seed.sql is exactly what the generator produces (run `npm run seed:generate`)", () => {
    expect(readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8")).toBe(renderSeedSql());
  });
  it("contains all 12 workflows with unique numbers and slugs", () => {
    expect(BENCHMARK_WORKFLOWS.map((w) => w.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(BENCHMARK_WORKFLOWS.map((w) => w.slug)).size).toBe(12);
    for (const w of BENCHMARK_WORKFLOWS) {
      expect(w.prompt.length).toBeGreaterThan(40);
      expect(w.requirements.length).toBeGreaterThan(0);
      expect(w.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(Object.keys(w.weights).sort()).toEqual([...CRITERIA].sort());
    }
  });
});

describe("execution config", () => {
  it("the shipped configuration is valid and covers every platform and workflow", () => {
    expect(validateExecutionConfig(BENCHMARK_EXECUTION_CONFIG)).toEqual([]);
    expect(BENCHMARK_EXECUTION_CONFIG.runPlatforms).toEqual([...PLATFORM_IDS]);
    expect(BENCHMARK_EXECUTION_CONFIG.workflows).toHaveLength(12);
  });
  it("rejects configurations that would make the benchmark meaningless", () => {
    const c = BENCHMARK_EXECUTION_CONFIG;
    expect(validateExecutionConfig({ ...c, enforceSamePrompt: false })[0]).toMatch(/same canonical prompt/);
    expect(validateExecutionConfig({ ...c, requireHumanReview: false })[0]).toMatch(/human review/);
    expect(validateExecutionConfig({ ...c, enforceFreshSession: false })[0]).toMatch(/fresh-session/);
    expect(validateExecutionConfig({ ...c, runPlatforms: [] })[0]).toMatch(/At least one platform/);
  });
});

describe("honest adapters", () => {
  const tasks = BENCHMARK_WORKFLOWS.map((w) => ({ id: `t${w.number}`, number: w.number, title: w.title, prompt: w.prompt, capabilities: w.capabilities, requiresPersistence: w.requiresPersistence }));

  it("no adapter claims it can run automatically, and every answer carries a reason", () => {
    for (const p of PLATFORM_IDS) for (const t of tasks) {
      const d = ADAPTERS[p].canRun(t);
      expect(d.supported).toBe(false);
      expect(["manual-review-required", "unsupported"]).toContain(d.disposition);
      expect(d.reason.length).toBeGreaterThan(20);
    }
  });
  it("backend tasks are unsupported on Claude Artifacts and Canvas, manual on v0", () => {
    for (const t of tasks.filter((x) => requiresBackend(x))) {
      expect(ADAPTERS["claude-artifacts"].canRun(t).disposition, `claude ${t.number}`).toBe("unsupported");
      expect(ADAPTERS["chatgpt-canvas"].canRun(t).disposition, `canvas ${t.number}`).toBe("unsupported");
      expect(ADAPTERS.v0.canRun(t).disposition, `v0 ${t.number}`).toBe("manual-review-required");
    }
    expect(tasks.filter(requiresBackend).map((t) => t.number)).toEqual([9, 10, 11, 12]);
  });
  it("client-side and document tasks are manual-review-required everywhere", () => {
    for (const t of tasks.filter((x) => !requiresBackend(x))) for (const p of PLATFORM_IDS) expect(ADAPTERS[p].canRun(t).disposition).toBe("manual-review-required");
  });
  it("run() never fabricates output: it preserves the exact prompt and returns no URL, files or logs", async () => {
    for (const p of PLATFORM_IDS) for (const t of tasks) {
      const r = await ADAPTERS[p].run(t);
      expect(["manual-review-required", "unsupported"]).toContain(r.status);
      expect(r.executedPrompt).toBe(t.prompt);
      expect(r.outputUrl).toBeUndefined();
      expect(r.outputText).toBeUndefined();
      expect(r.sourceFiles).toBeUndefined();
      expect(r.consoleOutput).toBeUndefined();
      expect(r.limitations.length).toBeGreaterThan(0);
      expect(r.manualProtocol!.length).toBeGreaterThan(3);
    }
  });
  it("reportUnsupported carries the reason through", () => {
    const r = ADAPTERS.v0.reportUnsupported(tasks[0]!, "because");
    expect(r).toMatchObject({ status: "unsupported", limitations: ["because"] });
  });
  it("collectEvidence flags a modified prompt and missing artifacts; evaluatePersistence applies the ceiling", () => {
    const t = tasks.find((x) => x.number === 10)!;
    const run = {
      id: "r", taskId: t.id, suiteId: "s", platform: "v0" as const, attempt: 1, status: "completed" as const, executedPrompt: t.prompt + " (tweaked)",
      modelName: null, modelVersion: null, runtimeNotes: null, outputUrl: null, outputText: null, sourceManifest: [], consoleNotes: null, durationSeconds: null,
      persistenceMode: "local-preview" as const, persistenceTested: true, persistenceSurvivedReload: false, persistenceEvidence: null,
      persistenceEvidenceUrl: null, persistenceFailureNotes: "reset on refresh", recordedBy: null, createdAt: "",
    };
    const ev = ADAPTERS.v0.collectEvidence(run, t, [{ path: "a.ts", content: "NEXT_PUBLIC_SERVICE_ROLE_KEY=1" }]);
    expect(ev.promptMatchesCanonical).toBe(false);
    expect(ev.hasOutputUrl).toBe(false);
    expect(ev.secretLeaks).toHaveLength(1);
    expect(ev.notes.join(" ")).toMatch(/not comparable/);
    const v = ADAPTERS.v0.evaluatePersistence(run, t);
    expect(v).toMatchObject({ passed: false, ceiling: 1 });
    expect(v.evidence).toContain("reset on refresh");
  });
});
