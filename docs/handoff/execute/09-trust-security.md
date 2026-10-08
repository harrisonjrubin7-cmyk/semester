# Stream 09 · Security, privacy, accessibility, compliance

Evidence for HECVAT, SOC 2 readiness and VPAT/ACR.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `docs/secure/Security Policies.html`
- `docs/secure/Security Readiness.html`
- `ui_kits/compliance/`

## Tasks
1. Map each policy control to code or a procedure; store evidence links in the evidence register.
2. Backups and a timed restore drill; break-glass with review; access reviews; secret inventory.
3. Accessibility: axe in CI on every route, manual screen-reader pass on pilot paths, and the ACR test log.
4. Data inventory, retention jobs, privacy request flows (export, correction, deletion).

## Exit gates
- [ ] Restore drill timed and documented
- [ ] axe clean on pilot routes
- [ ] Evidence register complete for HECVAT answers

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/trust-security` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
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
