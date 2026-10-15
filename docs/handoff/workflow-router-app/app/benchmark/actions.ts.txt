'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/supabase/server';
import { GradeSchema, RunSchema } from '@/lib/validation/benchmark';
export async function recordRun(input: unknown) {
  const p = RunSchema.safeParse(input); if (!p.success) return { ok: false as const, error: p.error.flatten() };
  const { supabase, user } = await requireUser(); if (!user) return { ok: false as const, error: 'Sign in to record runs.' };
  const d = p.data;
  const { data, error } = await supabase.from('benchmark_runs').insert({ task_id: d.taskId, platform: d.platform, created_by: user.id, status: d.status, status_reason: d.statusReason ?? null, executed_prompt: d.executedPrompt, model_name: d.modelName ?? null, model_version: d.modelVersion ?? null, output_url: d.outputUrl || null, source_manifest: d.sourceManifest, runtime_notes: d.runtimeNotes ?? null, console_notes: d.consoleNotes ?? null, duration_ms: d.durationMs ?? null, persistence_tested: d.persistenceTested, persistence_survived_reload: d.persistenceSurvivedReload, persistence_mode: d.persistenceMode, persistence_evidence: d.persistenceEvidence ?? null, persistence_failure_notes: d.persistenceFailureNotes ?? null }).select('id').single();
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/benchmark'); return { ok: true as const, id: data.id };
}
export async function gradeRun(input: unknown) {
  const p = GradeSchema.safeParse(input); if (!p.success) return { ok: false as const, error: p.error.flatten() };
  const { supabase, user } = await requireUser(); if (!user) return { ok: false as const, error: 'Sign in to grade.' };
  const g = p.data;
  const { error } = await supabase.from('benchmark_grades').upsert({ run_id: g.runId, grader_id: user.id, correctness: g.correctness, code_quality: g.codeQuality, rendering: g.rendering, state_management: g.stateManagement, maintainability: g.maintainability, handoff: g.handoff, sandbox_fit: g.sandboxFit, persistence: g.persistence, evidence: g.evidence ?? null, notes: g.notes ?? null }, { onConflict: 'run_id,grader_id' });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/benchmark'); return { ok: true as const };
}
