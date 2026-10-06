# Session handoff

**Date** 2026-10-06. **Branch** `audit/semester-mainframe-reconciliation`. **Base at branch creation** `1ba54a92`. **Later `origin/main`** moved (operations console and company-site scan commits). The files this batch edits were unchanged on that newer main. **Push** not done.

## Objective that was completed

The connected-ecosystem specification (`docs/specifications/connected-ecosystem.pdf`) extends the mainframe. This batch depicted those connections in `ECOSYSTEM_CONNECTIONS.md` and implemented the next local fact: a course the student named is its own readiness row, and that row is not an enrollment.

## Working tree at the start

Branch `cursor/role-journeys-3071` at `e01aa230`, nine commits behind `origin/main`, with uncommitted plan-preview files. Those files were kept. The audit branch was created from `origin/main` so the audit matches current main. Upstream was unset so a plain push cannot fast-forward `main`.

`origin/main` had not already added `planpreview` or `rolejourney`. `FirstRun.tsx` was identical between `e01aa230` and `1ba54a92`, so the local edit applied cleanly. Commit `0b0c7aa4` had already renamed the planner tab to Term plan; the new list uses that screen.

## What the next session should read first

1. This file.
2. `EXECUTION_BACKLOG.md` next item: advisor handoff without a caseload.
3. `ECOSYSTEM_CONNECTIONS.md` for the four connection types.
4. `app/src/lib/path-readiness.ts` id `named`.
5. `git diff` against `origin/main` before editing. Main has moved since `1ba54a92`. Rebase before any push.

## Do not redo

- Do not add a second registration screen.
- Do not point a role journey at a screen `forRole` rejects. Payer stays null.
- Do not wrap official registration as if the school gate were on.
- Do not apply migrations or call Stripe.

## Checks recorded

See `TEST_AND_RELEASE_GATES.md`. After the named row: `npx tsc -b` exit 0, `npm run lint` exit 0, `npm test` exit 0 (23319 passed, 69 skipped). A 390px browser walk saved a plan, opened My Path, and showed “Courses you named” as Needs attention with “That is not an enrollment.”

## Unverified

Hosted Supabase project, applied migrations, production audit rows, SSO for a named tenant, and any customer. The operations roadmap’s “no production audit row” sentence was not re-queried.
