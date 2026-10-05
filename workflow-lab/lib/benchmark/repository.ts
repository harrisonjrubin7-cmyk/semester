/**
 * Database access for benchmark data. Every call runs as the signed-in user, so
 * Row Level Security decides what comes back; there is no service-role client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BenchmarkGradeRow,
  BenchmarkRunRow,
  BenchmarkSuiteRow,
  BenchmarkTaskRow,
  WorkflowRecommendationRow,
} from "@/types/database";
import { BENCHMARK_WORKFLOWS, CRITERIA, DEFAULT_WEIGHT_PERCENTS, SUITE_NAME, type Criterion, type WeightPercents } from "./benchmark.config";
import type { GradeRecord, RunRecord, SuiteBundle, SuiteRecord, TaskRecord } from "./types";

export const LOCAL_SUITE_ID = "local-template";

export const mapSuite = (r: BenchmarkSuiteRow): SuiteRecord => ({
  id: r.id,
  name: r.name,
  description: r.description,
  ownerId: r.owner_id,
  organizationId: r.organization_id,
  isTemplate: r.is_template,
  createdAt: r.created_at,
});

export function mapTask(r: BenchmarkTaskRow): TaskRecord {
  const weights = { ...DEFAULT_WEIGHT_PERCENTS } as WeightPercents;
  for (const c of CRITERIA) weights[c] = Number(r.rubric_weights?.[c] ?? 0);
  return {
    id: r.id,
    suiteId: r.suite_id,
    number: r.task_number,
    slug: r.slug,
    title: r.title,
    category: r.category,
    prompt: r.prompt,
    requirements: r.requirements ?? [],
    capabilities: r.capabilities ?? {},
    acceptanceCriteria: r.acceptance_criteria ?? [],
    recommendedPlatform: r.recommended_platform,
    weights,
    requiresPersistence: r.requires_persistence,
  };
}

export const mapRun = (r: BenchmarkRunRow): RunRecord => ({
  id: r.id,
  taskId: r.task_id,
  suiteId: r.suite_id,
  platform: r.platform,
  attempt: r.attempt,
  status: r.status,
  executedPrompt: r.executed_prompt,
  modelName: r.model_name,
  modelVersion: r.model_version,
  runtimeNotes: r.runtime_notes,
  outputUrl: r.output_url,
  outputText: r.output_text,
  sourceManifest: r.source_manifest ?? [],
  consoleNotes: r.console_notes,
  durationSeconds: r.duration_seconds === null ? null : Number(r.duration_seconds),
  persistenceMode: r.persistence_mode,
  persistenceTested: r.persistence_tested,
  persistenceSurvivedReload: r.persistence_survived_reload,
  persistenceEvidence: r.persistence_evidence,
  persistenceEvidenceUrl: r.persistence_evidence_url,
  persistenceFailureNotes: r.persistence_failure_notes,
  recordedBy: r.recorded_by,
  createdAt: r.created_at,
});

export function mapGrade(r: BenchmarkGradeRow): GradeRecord {
  const scores = {} as Record<Criterion, number | null>;
  for (const c of CRITERIA) scores[c] = r[c] === null ? null : Number(r[c]);
  return {
    id: r.id,
    runId: r.run_id,
    graderId: r.grader_id,
    scores,
    criterionNotes: r.criterion_notes ?? {},
    evidenceUrls: r.evidence_urls ?? [],
    evaluatorNotes: r.evaluator_notes,
    createdAt: r.created_at,
  };
}

/** The canonical workflows with no runs: what prototype mode (no Supabase) shows. */
export function localTemplateBundle(): SuiteBundle {
  return {
    suite: {
      id: LOCAL_SUITE_ID,
      name: SUITE_NAME,
      description: "Canonical benchmark definition from lib/benchmark/benchmark.config.ts. Read-only: connect Supabase and sign in to record runs.",
      ownerId: null,
      organizationId: null,
      isTemplate: true,
      createdAt: new Date(0).toISOString(),
    },
    tasks: BENCHMARK_WORKFLOWS.map((w) => ({
      id: `local-${w.number}`,
      suiteId: LOCAL_SUITE_ID,
      number: w.number,
      slug: w.slug,
      title: w.title,
      category: w.category,
      prompt: w.prompt,
      requirements: w.requirements,
      capabilities: w.capabilities,
      acceptanceCriteria: w.acceptanceCriteria,
      recommendedPlatform: w.recommendedPlatform,
      weights: w.weights,
      requiresPersistence: w.requiresPersistence,
    })),
    runs: [],
    grades: [],
  };
}

export async function listSuites(supabase: SupabaseClient): Promise<SuiteRecord[]> {
  const { data, error } = await supabase.from("benchmark_suites").select("*").order("is_template", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as BenchmarkSuiteRow[]).map(mapSuite);
}

export async function loadSuiteBundle(supabase: SupabaseClient, suiteId: string): Promise<SuiteBundle | null> {
  const { data: suite, error } = await supabase.from("benchmark_suites").select("*").eq("id", suiteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!suite) return null;
  const [tasks, runs, grades] = await Promise.all([
    supabase.from("benchmark_tasks").select("*").eq("suite_id", suiteId).order("task_number"),
    supabase.from("benchmark_runs").select("*").eq("suite_id", suiteId).order("created_at"),
    supabase.from("benchmark_grades").select("*").eq("suite_id", suiteId).order("created_at"),
  ]);
  for (const r of [tasks, runs, grades]) if (r.error) throw new Error(r.error.message);
  return {
    suite: mapSuite(suite as BenchmarkSuiteRow),
    tasks: (tasks.data as BenchmarkTaskRow[]).map(mapTask),
    runs: (runs.data as BenchmarkRunRow[]).map(mapRun),
    grades: (grades.data as BenchmarkGradeRow[]).map(mapGrade),
  };
}

export async function listRecommendations(supabase: SupabaseClient, limit = 20): Promise<WorkflowRecommendationRow[]> {
  const { data, error } = await supabase
    .from("workflow_recommendations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as WorkflowRecommendationRow[];
}

export async function listMyOrganizations(supabase: SupabaseClient): Promise<Array<{ id: string; name: string; role: string }>> {
  const { data, error } = await supabase.from("organization_members").select("role, organizations(id, name)");
  if (error) throw new Error(error.message);
  const out: Array<{ id: string; name: string; role: string }> = [];
  for (const row of (data ?? []) as unknown as Array<{ role: string; organizations: { id: string; name: string } | { id: string; name: string }[] | null }>) {
    const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (org) out.push({ id: org.id, name: org.name, role: row.role });
  }
  return out;
}
