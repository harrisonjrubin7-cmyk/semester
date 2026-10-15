# Stream 04 · Faculty, TA, advisor, registrar, finance, student affairs

Staff workspaces (catalog groups C, D, E and the staff side of F).

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `ui_kits/staff/`
- `ui_kits/workflow-runner/` (Faculty, Advisor, Registrar, Student finance)
- `templates/console-screen/`

## Tasks
1. Course Studio (faculty authoring): syllabus, objectives, assignments, rubrics, course AI rules, gradebook, grade release, regrade queue.
2. Advisor caseload, check-ins, referrals, consented shares.
3. Registrar desk: terms, sections, holds sync, overrides (two-person), add/drop, reconciliation with SIS.
4. Student accounts: balance, payment plans, hold release, reconciliation. Payments go through a processor only.

## Coverage check
List every screen in docs/master/SEMESTER_SCREEN_CATALOG.md and every step in SEMESTER_WORKFLOW_CATALOG.md that belongs to this stream (see BUILD.md §10). Mark each implemented (route + test) or deferred (reason + priority). Use ui_kits/every-screen and ui_kits/workflow-runner as the visual and behavioural reference.

## Exit gates
- [ ] Coverage check complete with no unlisted screens or steps
- [ ] Two-person approvals tested
- [ ] Official-record changes go to the SIS, never edited in Semester
- [ ] Workflow steps pass e2e

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/staff-academic` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
- Read first: CLAUDE.md, README, `git log --oneline -30`, and this design project's `readme.md`, `SKILL.md`, `docs/master/*`.
- Audit before you write: find what already exists for each item and extend it. Do not create a parallel implementation. Record each "exists / extended / new" decision in the PR description.
- Design system: use tokens and components only (no raw hex, px z-index or durations); `npm run design-system:check` must pass.
- Data: RLS on every table, `tenant_id` on every row, browser calls `api.*` only. Company roles (investor, CS, RevOps, finance) never read student tables. AI never receives student records.
- Every consequential action: preview, then audit event written first, then apply, then an undo or request path.
- Every screen: loading, empty, error, forbidden and offline states, keyboard path, visible focus, accessible names, 44px targets.
- Do not commit secrets, change production settings, deploy, or write to Figma. Stop and report on the first failure you cannot fix inside this stream.
- Nothing is "done" without code, tests, RLS proof, accessibility check, monitoring hook, docs and release evidence (the 22-point definition in `docs/master/SEMESTER_RELEASE_GATE_CATALOG.md`).

## Report at the end
Files changed · commands run with results · tests added · RLS cases proven · open gaps with priority · what the next stream needs.
