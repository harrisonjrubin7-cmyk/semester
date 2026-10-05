# AI Toolkit permission matrix and data model

## Today (device-only)

| Actor | Workspaces, research, data, declaration | Catalog | Policy card |
| --- | --- | --- | --- |
| The student on their device | create, read, edit, export, delete | read | read (their own record) |
| Instructor, staff, other students | no access — nothing leaves the device | — | — |
| Semester servers | no access — nothing is sent | — | — |

## Server phase — the model to start from

Every entity below carries `tenant_id`, an opaque public id (UUID, never sequential),
`owner_id`, `visibility` (default `private`), `created_at`, `updated_at`,
`delete_after` / `deleted_at`, and RLS that asks `private.has_capability` (the
pattern `supabase/expansion.check.sql` established), never a role name.

| Domain | Tables (brief names) | Owner reads/writes | Instructor | Admin |
| --- | --- | --- | --- | --- |
| Preferences | `ai_toolkit_preferences` | own | — | — |
| Catalog | `subject_workbench_configs`, `tool_catalog`, `tool_entitlements`, `tool_licenses`, `tool_data_classification_rules` | read | read | write, audited |
| Policy | `course_ai_policies`, `assignment_ai_policies`, `course_tool_policies` | read | write for own sections, with source link, effective and verified dates | write, audited |
| Declarations | `ai_use_declarations` | own | read only when the student attaches it to a submission | never |
| Assignments | `assignment_workspaces`, `assignment_milestones`, `assignment_deliverables`, `assignment_reflections` | own | — | — |
| Research | `research_projects`, `research_questions`, `search_strategies`, `research_sources`, `source_screening`, `source_extractions`, `evidence_matrix_entries`, `citation_records`, `claim_evidence_links`, `study_quality_assessments`, `literature_maps` | own; shareable to a named group with consent | — | — |
| Data | `data_projects`, `data_sources`, `data_dictionaries`, `data_columns`, `data_transformations`, `analysis_*`, `methods_notes`, `assumptions_checks`, `limitations_records` | own; raw storage separate from derived | — | — |
| Governance | `tool_usage_audits`, `audit_events`, `retention_jobs`, `consent_records` | own events visible | — | read, audited, just-in-time |

Rules the server phase must carry over from the client:

- the classification gate on every write and every AI call, server-side;
- `verified` recomputed from fields, never accepted from the client;
- `final-answers` never resolved to allowed by a blanket;
- no staff capability reads study, practice, research or declaration content for
  scoring, risk or profiling.
