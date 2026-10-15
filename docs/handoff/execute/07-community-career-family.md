# Stream 07 · Community, career, family, developer platform

Groups H, I, J and the developer platform.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `ui_kits/community/`
- `ui_kits/external/`
- `handoff/semester-platform/` (migrations 020, 030)
- `ui_kits/workflow-runner/` (Community, Career, Family consent, Developer platform)

## Tasks
1. Community: verified profiles with per-field visibility, groups, Q&A with endorsed answers, reporting, moderation queue, appeals. AI pre-screen on public posts only.
2. Marketplace: listings with the academic-integrity filter, offers in chat, safe meet-up spots; payments via a processor.
3. Family: consent invitation, scoped categories, expiry, access history, revoke.
4. Career: skills, evidence portfolio, verified skills, opportunities; employers see approved evidence only.
5. Developer platform: OAuth clients, scopes, webhooks, sandbox tenants (can ship after the pilot).

## Coverage check
List every screen in docs/master/SEMESTER_SCREEN_CATALOG.md and every step in SEMESTER_WORKFLOW_CATALOG.md that belongs to this stream (see BUILD.md §10). Mark each implemented (route + test) or deferred (reason + priority). Use ui_kits/every-screen and ui_kits/workflow-runner as the visual and behavioural reference.

## Exit gates
- [ ] Coverage check complete with no unlisted screens or steps
- [ ] Feature switch per institution
- [ ] Revocation removes access immediately (tested)
- [ ] Moderation audit trail

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/community-career-family` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
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
