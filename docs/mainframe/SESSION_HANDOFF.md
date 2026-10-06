# Session handoff

**Date** 2026-10-06. **Branch** `audit/semester-mainframe-reconciliation`. **Base** `1ba54a92` (`origin/main` at the time the branch was created). **Push** not done. The execution prompt forbids remote changes, including push, deploy, and remote migrations.

## Objective that was completed

Reconcile the mainframe specification with the repository, then ship one local registration-plan increment that cannot be mistaken for an enrollment.

## Working tree at the start

Branch `cursor/role-journeys-3071` at `e01aa230`, nine commits behind `origin/main`, with uncommitted plan-preview files. Those files were kept. The audit branch was created from `origin/main` so the audit matches current main. Upstream was unset so a plain push cannot fast-forward `main`.

`origin/main` had not already added `planpreview` or `rolejourney`. `FirstRun.tsx` was identical between `e01aa230` and `1ba54a92`, so the local edit applied cleanly. Commit `0b0c7aa4` had already renamed the planner tab to Term plan; the new list uses that screen.

## What the next session should read first

1. This file.
2. `EXECUTION_BACKLOG.md` item 1 (readiness row for named courses).
3. `READINESS_REGISTER.csv` row `device-registration-plan`.
4. `app/src/lib/path-readiness.ts` and `app/src/components/RegistrationReadiness.tsx`.
5. `git diff` against `origin/main`.

## Do not redo

- Do not add a second registration screen.
- Do not point a role journey at a screen `forRole` rejects. Payer stays null.
- Do not wrap official registration as if the school gate were on.
- Do not apply migrations or call Stripe.

## Checks recorded

See `TEST_AND_RELEASE_GATES.md`. Typecheck, lint, design-system audit, and `npm test` passed (23316 tests, 69 skipped).

## Unverified

Hosted Supabase project, applied migrations, production audit rows, SSO for a named tenant, and any customer. The operations roadmap’s “no production audit row” sentence was not re-queried.
