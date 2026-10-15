/**
 * Server actions with a stubbed Supabase client. These tests prove the action
 * layer's own rules (auth first, validation, no trust in the client, persistence
 * pre-check). The database-side rules are proven against real Postgres in rls.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string },
  configured: true,
  calls: [] as Array<{ table?: string; op: string; payload?: unknown; opts?: unknown }>,
  runRow: null as null | Record<string, unknown>,
  taskRow: null as null | Record<string, unknown>,
  insertError: null as null | { code?: string; message: string },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => {
    if (!state.configured) return { supabase: null, user: null };
    const supabase = {
      from(table: string) {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: table === "benchmark_runs" ? state.runRow : state.taskRow, error: null }),
          single: async () => ({ data: { id: "new-id" }, error: state.insertError }),
          insert: (payload: unknown) => { state.calls.push({ table, op: "insert", payload }); return { select: () => ({ single: async () => ({ data: { id: "new-id" }, error: state.insertError }) }) }; },
          upsert: async (payload: unknown, opts: unknown) => { state.calls.push({ table, op: "upsert", payload, opts }); return { error: state.insertError }; },
          delete: () => ({ eq: async () => ({ error: null, count: 1 }) }),
        };
        return q;
      },
      rpc: async (fn: string, args: unknown) => { state.calls.push({ op: `rpc:${fn}`, payload: args }); return { data: "suite-123", error: state.insertError }; },
    };
    return { supabase, user: state.user };
  },
}));

import { createSuite, saveRun, submitGrade } from "@/app/benchmark/actions";
import { saveRecommendation } from "@/app/workflow-router/actions";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const routerFields = { deliverable: "diagram", interaction: "none", backend: "none", tech: "none", persistence: "none", handoff: "share-immediately" };
const runFields = { suiteId: uuid(1), taskId: uuid(2), platform: "v0", status: "completed", executedPrompt: "p", sourceManifest: "" };

beforeEach(() => {
  state.user = { id: uuid(9), email: "a@example.test" };
  state.configured = true;
  state.calls = [];
  state.insertError = null;
  state.runRow = null;
  state.taskRow = null;
});

describe("every mutation is protected", () => {
  it("prototype mode (no Supabase) refuses to save anything", async () => {
    state.configured = false;
    for (const r of [await saveRecommendation(null, fd({ title: "t", ...routerFields })), await createSuite(null, fd({})), await saveRun(null, fd(runFields)), await submitGrade(null, fd({ runId: uuid(3), correctness: "4" }))]) {
      expect(r).toMatchObject({ ok: false });
      expect((r as { message: string }).message).toMatch(/Prototype mode/);
    }
    expect(state.calls).toHaveLength(0);
  });

  it("signed-out users are refused before any validation or query", async () => {
    state.user = null;
    for (const r of [await saveRecommendation(null, fd({ title: "t", ...routerFields })), await createSuite(null, fd({})), await saveRun(null, fd(runFields)), await submitGrade(null, fd({ runId: uuid(3), correctness: "4" }))])
      expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/Sign in/) });
    expect(state.calls).toHaveLength(0);
  });
});

describe("saveRecommendation", () => {
  it("recomputes the result on the server and never trusts client-supplied results", async () => {
    const f = fd({ title: "My routing", ...routerFields, primary_platform: "v0", confidence: "1", result: '{"primary":"v0"}' });
    const r = await saveRecommendation(null, f);
    expect(r).toMatchObject({ ok: true, id: "new-id" });
    const row = state.calls[0]!.payload as Record<string, unknown>;
    expect(row.primary_platform).toBe("claude-artifacts"); // a diagram routes to Claude regardless of the forged field
    expect(row.confidence).not.toBe(1);
    expect(row.user_id).toBe(uuid(9));
    expect(row.organization_id).toBeNull();
  });
  it("rejects invalid selections and blank titles with field errors", async () => {
    const r = await saveRecommendation(null, fd({ title: " ", ...routerFields, tech: "rails" }));
    expect(r).toMatchObject({ ok: false });
    expect(Object.keys((r as { errors: object }).errors).sort()).toEqual(["inputs.tech", "title"]);
    expect(state.calls).toHaveLength(0);
  });
  it("surfaces an RLS refusal as a friendly permission message without leaking SQL", async () => {
    state.insertError = { code: "42501", message: 'new row violates row-level security policy for table "workflow_recommendations"' };
    const r = await saveRecommendation(null, fd({ title: "t", ...routerFields }));
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/permission/i) });
    expect((r as { message: string }).message).not.toMatch(/workflow_recommendations/);
  });
});

describe("createSuite", () => {
  it("clones the template through the RPC and redirects to the new suite", async () => {
    await expect(createSuite(null, fd({ name: "Q4", organizationId: "" }))).rejects.toThrow("REDIRECT:/benchmark/suite-123");
    expect(state.calls[0]).toMatchObject({ op: "rpc:clone_benchmark_template", payload: { p_name: "Q4", p_organization_id: null } });
  });
  it("rejects a malformed organization id", async () => {
    expect(await createSuite(null, fd({ organizationId: "x" }))).toMatchObject({ ok: false });
    expect(state.calls).toHaveLength(0);
  });
});

describe("saveRun", () => {
  it("upserts on (task, platform, attempt) and stamps the caller as recorder", async () => {
    expect(await saveRun(null, fd({ ...runFields, attempt: "2", modelName: "m" }))).toMatchObject({ ok: true });
    const c = state.calls[0]!;
    expect(c.opts).toEqual({ onConflict: "task_id,platform,attempt" });
    expect(c.payload).toMatchObject({ attempt: 2, platform: "v0", recorded_by: uuid(9), executed_prompt: "p", model_name: "m", persistence_survived_reload: null });
  });
  it("ignores a forged recorded_by field", async () => {
    await saveRun(null, fd({ ...runFields, recorded_by: uuid(666) }));
    expect((state.calls[0]!.payload as { recorded_by: string }).recorded_by).toBe(uuid(9));
  });
  it("stores the executed prompt verbatim", async () => {
    await saveRun(null, fd({ ...runFields, executedPrompt: "Build a\n  thing  (edited)" }));
    expect((state.calls[0]!.payload as { executed_prompt: string }).executed_prompt).toBe("Build a\n  thing  (edited)");
  });
  it("drops survival when persistence was not tested", async () => {
    await saveRun(null, fd({ ...runFields, persistenceTested: "true", persistenceSurvivedReload: "false", persistenceFailureNotes: "reset" }));
    expect(state.calls[0]!.payload).toMatchObject({ persistence_tested: true, persistence_survived_reload: false });
  });
  it("turns a duplicate attempt into an actionable message", async () => {
    state.insertError = { code: "23505", message: "duplicate key" };
    expect(await saveRun(null, fd(runFields))).toMatchObject({ ok: false, message: expect.stringMatching(/new attempt number/) });
  });
  it("returns field errors and writes nothing on invalid input", async () => {
    const r = await saveRun(null, fd({ ...runFields, outputUrl: "javascript:alert(1)" }));
    expect(r).toMatchObject({ ok: false });
    expect((r as { errors: Record<string, string[]> }).errors.outputUrl).toBeTruthy();
    expect(state.calls).toHaveLength(0);
  });
});

describe("submitGrade", () => {
  const runRow = (over: Record<string, unknown> = {}) => ({
    id: uuid(3), task_id: uuid(2), suite_id: uuid(1), platform: "v0", attempt: 1, status: "completed", executed_prompt: "p", model_name: null, model_version: null,
    runtime_notes: null, output_url: null, output_text: null, source_manifest: [], console_notes: null, duration_seconds: null,
    persistence_mode: "none", persistence_tested: false, persistence_survived_reload: null, persistence_evidence: null,
    persistence_evidence_url: null, persistence_failure_notes: null, recorded_by: null, created_at: "", updated_at: "", ...over,
  });
  const taskRow = (requires: boolean) => ({
    id: uuid(2), suite_id: uuid(1), task_number: 10, slug: "s", title: "t", category: "c", prompt: "p", requirements: [], capabilities: {}, acceptance_criteria: [],
    recommended_platform: "v0", requires_persistence: requires, created_at: "",
    rubric_weights: { correctness: 25, code_quality: 15, rendering: 5, state_management: 15, maintainability: 10, handoff: 5, sandbox_fit: 5, persistence: 20 },
  });

  it("saves a grade stamped with the caller and the run's suite, with evidence and notes", async () => {
    state.runRow = runRow(); state.taskRow = taskRow(false);
    const r = await submitGrade(null, fd({ runId: uuid(3), correctness: "4", rendering: "0", notes_correctness: "works", evidenceUrls: "https://e.example/1", evaluatorNotes: "solid" }));
    expect(r).toMatchObject({ ok: true });
    expect(state.calls[0]!.payload).toMatchObject({
      run_id: uuid(3), suite_id: uuid(1), grader_id: uuid(9), correctness: 4, rendering: 0, code_quality: null,
      criterion_notes: { correctness: "works" }, evidence_urls: ["https://e.example/1"], evaluator_notes: "solid",
    });
    expect(state.calls[0]!.opts).toEqual({ onConflict: "run_id,grader_id" });
  });
  it("cannot grade a run the user cannot see (RLS returns nothing)", async () => {
    state.runRow = null;
    expect(await submitGrade(null, fd({ runId: uuid(3), correctness: "4" }))).toMatchObject({ ok: false, message: expect.stringMatching(/not found/i) });
    expect(state.calls).toHaveLength(0);
  });
  it("refuses a persistence score above the recorded test, before touching the database", async () => {
    state.runRow = runRow({ persistence_mode: "local-preview", persistence_tested: true, persistence_survived_reload: false }); state.taskRow = taskRow(true);
    const r = await submitGrade(null, fd({ runId: uuid(3), persistence: "4" }));
    expect(r).toMatchObject({ ok: false });
    expect((r as { errors: Record<string, string[]> }).errors.persistence![0]).toMatch(/Maximum 1/);
    expect(state.calls).toHaveLength(0);
  });
  it("allows the ceiling itself, and any persistence score when persistence is not required", async () => {
    state.runRow = runRow({ persistence_mode: "database", persistence_tested: true, persistence_survived_reload: true, persistence_evidence: "row 7" }); state.taskRow = taskRow(true);
    expect(await submitGrade(null, fd({ runId: uuid(3), persistence: "5" }))).toMatchObject({ ok: true });
    state.calls = []; state.runRow = runRow(); state.taskRow = taskRow(false);
    expect(await submitGrade(null, fd({ runId: uuid(3), persistence: "5" }))).toMatchObject({ ok: true });
  });
  it("requires at least one score", async () => {
    state.runRow = runRow(); state.taskRow = taskRow(false);
    expect(await submitGrade(null, fd({ runId: uuid(3), evaluatorNotes: "only words" }))).toMatchObject({ ok: false });
  });
});
