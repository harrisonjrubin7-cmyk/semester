# Stream 06 · Governed AI gateway

One gateway for every AI request.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `handoff/semester-core/aigateway.ts.txt`
- `ui_kits/architecture/` (AI gateway tab)
- `guidelines/02-ai-governance.md`
- `components/trust/AIResponse.jsx`

## Starting code
- `handoff/semester-platform/app/api/ai/route.ts.txt`, `lib/ai/redact.ts.txt`, `supabase/migrations/070_ai_gateway.sql.txt`, `tests/ai-redteam.test.ts.txt`

## Tasks
1. Implement the 17-step AI workflow: scope, classification, consent, policy, provider routing, approved sources, tool permissions, response with sources, suggested action, human escalation, spend and audit log.
2. Red-team suite: prompts containing student IDs, grades or records must be blocked, and every block logged.
3. Course AI rules editor for faculty; per-tenant switches.

## Exit gates
- [ ] Red-team suite passes (launch gate)
- [ ] Every AI answer is labelled with sources
- [ ] Spend logged per tenant

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/ai-gateway` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
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
