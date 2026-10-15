"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NOT_CONFIGURED, SIGN_IN_REQUIRED, describeDbError, type ActionState } from "@/lib/actions/types";
import { CRITERIA } from "@/lib/benchmark/benchmark.config";
import { persistenceCeiling } from "@/lib/benchmark/probes/persistence";
import { mapRun, mapTask } from "@/lib/benchmark/repository";
import { getUser } from "@/lib/supabase/server";
import { createSuiteSchema, gradeSchema, runSchema } from "@/lib/validation/benchmark";
import { fieldErrors, formToObject } from "@/lib/validation/common";
import type { BenchmarkRunRow, BenchmarkTaskRow } from "@/types/database";

export async function createSuite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await getUser();
  if (!supabase) return NOT_CONFIGURED;
  if (!user) return SIGN_IN_REQUIRED;

  const parsed = createSuiteSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };

  const { data, error } = await supabase.rpc("clone_benchmark_template", {
    p_name: parsed.data.name ?? null,
    p_organization_id: parsed.data.organizationId ?? null,
  });
  if (error) {
    if (error.code === "P0002") return { ok: false, message: "The canonical template is not seeded. Run supabase/seed.sql first." };
    return { ok: false, message: describeDbError(error) };
  }
  revalidatePath("/benchmark");
  redirect(`/benchmark/${data as string}`);
}

export async function saveRun(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await getUser();
  if (!supabase) return NOT_CONFIGURED;
  if (!user) return SIGN_IN_REQUIRED;

  const parsed = runSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { error } = await supabase.from("benchmark_runs").upsert(
    {
      task_id: v.taskId,
      suite_id: v.suiteId,
      platform: v.platform,
      attempt: v.attempt,
      status: v.status,
      executed_prompt: v.executedPrompt,
      model_name: v.modelName ?? null,
      model_version: v.modelVersion ?? null,
      runtime_notes: v.runtimeNotes ?? null,
      output_url: v.outputUrl ?? null,
      output_text: v.outputText ?? null,
      source_manifest: v.sourceManifest,
      console_notes: v.consoleNotes ?? null,
      duration_seconds: v.durationSeconds ?? null,
      persistence_mode: v.persistenceMode,
      persistence_tested: v.persistenceTested,
      persistence_survived_reload: v.persistenceTested ? (v.persistenceSurvivedReload ?? null) : null,
      persistence_evidence: v.persistenceEvidence ?? null,
      persistence_evidence_url: v.persistenceEvidenceUrl ?? null,
      persistence_failure_notes: v.persistenceFailureNotes ?? null,
      recorded_by: user.id,
    },
    { onConflict: "task_id,platform,attempt" },
  );
  if (error) return { ok: false, message: describeDbError(error) };

  revalidatePath(`/benchmark/${v.suiteId}`);
  return { ok: true, message: "Run saved." };
}

export async function submitGrade(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await getUser();
  if (!supabase) return NOT_CONFIGURED;
  if (!user) return SIGN_IN_REQUIRED;

  const parsed = gradeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const v = parsed.data;

  // Look the run up through RLS: a run the user cannot see simply is not found.
  const { data: runRow, error: runErr } = await supabase.from("benchmark_runs").select("*").eq("id", v.runId).maybeSingle();
  if (runErr) return { ok: false, message: describeDbError(runErr) };
  if (!runRow) return { ok: false, message: "Run not found, or you cannot access it." };
  const run = mapRun(runRow as BenchmarkRunRow);
  const { data: taskRow } = await supabase.from("benchmark_tasks").select("*").eq("id", run.taskId).maybeSingle();
  if (!taskRow) return { ok: false, message: "Task not found." };
  const task = mapTask(taskRow as BenchmarkTaskRow);

  // Friendly pre-check; the database trigger is the actual guard.
  if (v.persistence !== undefined) {
    const c = persistenceCeiling({
      required: task.requiresPersistence,
      tested: run.persistenceTested,
      survivedReload: run.persistenceSurvivedReload,
      mode: run.persistenceMode,
      hasEvidence: Boolean(run.persistenceEvidence?.trim() || run.persistenceEvidenceUrl?.trim()),
    });
    if (v.persistence > c.ceiling)
      return { ok: false, message: "Persistence score is above what the recorded test supports.", errors: { persistence: [`Maximum ${c.ceiling}: ${c.reason}`] } };
  }

  const notes: Record<string, string> = {};
  for (const c of CRITERIA) {
    const n = v[`notes_${c}` as const];
    if (n) notes[c] = n;
  }

  const { error } = await supabase.from("benchmark_grades").upsert(
    {
      run_id: v.runId,
      suite_id: run.suiteId,
      grader_id: user.id,
      correctness: v.correctness ?? null,
      code_quality: v.code_quality ?? null,
      rendering: v.rendering ?? null,
      state_management: v.state_management ?? null,
      maintainability: v.maintainability ?? null,
      handoff: v.handoff ?? null,
      sandbox_fit: v.sandbox_fit ?? null,
      persistence: v.persistence ?? null,
      criterion_notes: notes,
      evidence_urls: v.evidenceUrls,
      evaluator_notes: v.evaluatorNotes ?? null,
    },
    { onConflict: "run_id,grader_id" },
  );
  if (error) return { ok: false, message: describeDbError(error) };

  revalidatePath(`/benchmark/${run.suiteId}`);
  return { ok: true, message: "Grade saved." };
}
