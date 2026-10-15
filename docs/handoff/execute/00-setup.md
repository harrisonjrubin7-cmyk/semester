# Stream 00 · Repo audit and design-system sync

Make the repo ready for every later stream.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `handoff/claude-code-toolkit/`
- `docs/master/*.md`
- `github.md` (screen map)

## Tasks
1. Run handoff/claude-code-toolkit/EXECUTE.md steps 1, 2, 4 and 5 (skip Figma unless connected).
2. Write docs/master/REPO_AUDIT.md: every route, screen, component, migration, API route, test and doc in the repo, mapped to the rows of docs/master/SEMESTER_SCREEN_CATALOG.md and SEMESTER_WORKFLOW_CATALOG.md. Mark each row exists / partial / missing.
3. Update docs/master/SEMESTER_GAP_REGISTER.md from real evidence (repo beats design).
4. Add CI jobs if missing: typecheck, lint, unit tests, design-system check, RLS test job (can be empty until stream 01).

## Exit gates
- [ ] CI green
- [ ] REPO_AUDIT.md covers every catalog row
- [ ] Baseline JSON committed and approved

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/setup` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
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
