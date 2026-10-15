# Stream 02 · Identity, SAML SSO, onboarding

Sign-in for the Vanderbilt pilot and first-run onboarding for every role.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `templates/role-onboarding/` (13 role onboardings + RoleOnboarding)
- `docs/launch/Cutover Plan.html` (steps C2-C3)
- `ui_kits/student` (Connect, Settings, Privacy)

## Tasks
1. SAML SSO via Supabase Auth (or the current auth in the repo) with role mapping from IdP attributes; staging test IdP first.
2. Account switcher, sessions list with remote sign-out, delegated access with expiry.
3. Build onboarding for each of the 13 roles from templates/role-onboarding/: sign in, connect, privacy choice, AI choice, first home.
4. Capabilities and Permissions screen: camera, microphone, location, notifications. Each asks, has a fallback and a revoke path.

## Exit gates
- [ ] Test login per pilot role in staging
- [ ] Role mapping tests
- [ ] Onboarding a11y check per role

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/identity-sso` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
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
