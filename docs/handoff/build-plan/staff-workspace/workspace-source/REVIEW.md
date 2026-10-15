# Review — semester_workspace_source (uploaded)

Filed here; `.tsx` files carry `.txt` so this project's bundler skips them (rename to run). Nothing was installed, built or executed.

## What it is
A Vite + React wireframe (`src/App.tsx`, reducer-driven: draft → release → correction requested → approved → corrected, with expected-version checks and an audit ledger) and a fresh-project Supabase reference (`university_rls.sql`). It agrees with the authorization decision: **reads through RLS, no client writes**, private schema unexposed, grants bound to tenant + scope, active workspace carried in the JWT by a custom access-token hook and re-checked against live grants on every query — so revocation and expiry apply on the next request, not at token refresh.

## Findings → `university_rls.review.sql`
| # | Finding | Fix |
|---|---|---|
| 1 | RLS enabled but not forced — the table owner bypasses it | `force row level security` on all seven tables |
| 2 | No office-wide scope: a registrar or finance user would need a `student_scopes` row per student | `private.office_scopes` + `office_access()`; correction and finance read policies accept it |
| 3 | Duplicate `grade_drafts` per enrollment are allowed | unique (tenant, section, student) |
| 4 | A correction can reference another student's grade (left to command code) | composite FK `(grade_id, tenant, student, section)` + approver ≠ requester check |
| 5 | Writes left to "server command handlers" | use definer commands owned by `semester_writer`; published grades never updated in place |

## Fit with the repo
This is a **fresh-project** schema (`private.tenants`, `public.grade_drafts`…). The repo already has ~227 tables and its own gradebook and registration tables. Don't apply it alongside them — map its policy pattern (grant-scoped helpers + JWT workspace claim) onto the existing tables first. That mapping is the first data task in SPRINT-PILOT-001 too.

## The prototype in this project
`ui_kits/staff-workspace/` already covers the same six roles, six screen states and 12 acceptance scenarios; this wireframe adds the grade-correction loop across Faculty → Registrar → Advisor, which is worth porting into that page next.
