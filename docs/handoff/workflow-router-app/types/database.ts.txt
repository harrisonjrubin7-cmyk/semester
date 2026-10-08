// Regenerate with: npx supabase gen types typescript --local > types/database.ts
type Row<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
export interface Database { public: { Tables: {
  organizations: Row<{ id: string; name: string; created_by: string; created_at: string }>;
  organization_members: Row<{ organization_id: string; user_id: string; role: 'owner' | 'admin' | 'member' | 'viewer'; created_at: string }>;
  workflow_recommendations: Row<{ id: string; owner_id: string; organization_id: string | null; visibility: 'private' | 'organization'; title: string; answers: unknown; primary_platform: string; secondary_platform: string; confidence: number; result: unknown; created_at: string }>;
  benchmark_suites: Row<{ id: string; owner_id: string; organization_id: string | null; visibility: 'private' | 'organization'; name: string; description: string | null; created_at: string }>;
  benchmark_tasks: Row<{ id: string; suite_id: string; number: number; slug: string; title: string; category: string; prompt: string; requirements: unknown; acceptance: unknown; recommended_platform: string; requires_persistence: boolean; weights: unknown }>;
  benchmark_runs: Row<{ id: string; task_id: string; platform: string; created_by: string; status: string; status_reason: string | null; executed_prompt: string; model_name: string | null; model_version: string | null; output_url: string | null; source_manifest: unknown; runtime_notes: string | null; console_notes: string | null; duration_ms: number | null; persistence_tested: boolean; persistence_survived_reload: boolean | null; persistence_mode: string; persistence_evidence: string | null; persistence_failure_notes: string | null; created_at: string }>;
  benchmark_grades: Row<{ id: string; run_id: string; grader_id: string; correctness: number | null; code_quality: number | null; rendering: number | null; state_management: number | null; maintainability: number | null; handoff: number | null; sandbox_fit: number | null; persistence: number | null; evidence: string | null; notes: string | null; created_at: string }>;
}; Views: {}; Functions: {}; Enums: {}; CompositeTypes: {} } }
