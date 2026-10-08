/**
 * Row shapes for the tables created by supabase/migrations. Hand-maintained to
 * match the SQL; after changing a migration run
 *   npx supabase gen types typescript --local > types/database.generated.ts
 * and diff it against this file.
 */
export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type PlatformIdDb = "claude-artifacts" | "chatgpt-canvas" | "v0";
export type PersistenceModeDb = "none" | "local-preview" | "browser-local" | "session" | "database" | "project-backed";
export type RunStatusDb = "queued" | "running" | "completed" | "manual-review-required" | "unsupported" | "failed";

export type OrganizationRow = { id: string; name: string; slug: string; created_by: string; created_at: string };
export type OrganizationMemberRow = { organization_id: string; user_id: string; role: OrgRole; created_at: string };

export type WorkflowRecommendationRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  title: string;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
  primary_platform: PlatformIdDb;
  secondary_platform: PlatformIdDb;
  confidence: number;
  created_at: string;
};

export type BenchmarkSuiteRow = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  organization_id: string | null;
  is_template: boolean;
  created_at: string;
};

export type BenchmarkTaskRow = {
  id: string;
  suite_id: string;
  task_number: number;
  slug: string;
  title: string;
  category: string;
  prompt: string;
  requirements: string[];
  capabilities: Record<string, boolean>;
  acceptance_criteria: string[];
  recommended_platform: PlatformIdDb;
  rubric_weights: Record<string, number>;
  requires_persistence: boolean;
  created_at: string;
};

export type BenchmarkRunRow = {
  id: string;
  task_id: string;
  suite_id: string;
  platform: PlatformIdDb;
  attempt: number;
  status: RunStatusDb;
  executed_prompt: string;
  model_name: string | null;
  model_version: string | null;
  runtime_notes: string | null;
  output_url: string | null;
  output_text: string | null;
  source_manifest: Array<{ path: string; bytes?: number; language?: string; note?: string }>;
  console_notes: string | null;
  duration_seconds: number | null;
  persistence_mode: PersistenceModeDb;
  persistence_tested: boolean;
  persistence_survived_reload: boolean | null;
  persistence_evidence: string | null;
  persistence_evidence_url: string | null;
  persistence_failure_notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BenchmarkGradeRow = {
  id: string;
  run_id: string;
  suite_id: string;
  grader_id: string;
  correctness: number | null;
  code_quality: number | null;
  rendering: number | null;
  state_management: number | null;
  maintainability: number | null;
  handoff: number | null;
  sandbox_fit: number | null;
  persistence: number | null;
  criterion_notes: Record<string, string>;
  evidence_urls: string[];
  evaluator_notes: string | null;
  created_at: string;
  updated_at: string;
};
