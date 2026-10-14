# Claude Code — start here (for Teo Katz)

Open the Semester repo (`harrisonjrubin7-cmyk/semester`) in Claude Code and paste this:

> Read `handoff/build-plan/sprint-pilot-001/README.md`, `handoff/build-plan/DECISIONS-2026-10-14.md` and `handoff/build-plan/AUTHZ-DECISION.md`. We are building SPRINT-PILOT-001: registration readiness as one end-to-end release candidate. No new domains.
> 0. First produce two files in the repo: `docs/completion/REGISTER.md` — every capability with its status taken from code, tests and migrations actually present (not from the handoff) — and `docs/completion/JOURNEY-ACCEPTANCE.md` — the registration-readiness journey from sign-in to receipt to staff handoff, each step listing the code, test and evidence that proves it (or "missing"). Treat handoff migrations 010–120 as reference only.
> 1. Map the proposed readiness tables (`sprint-pilot-001/registry/data/pilot-table-classification.yaml`) onto the repo's existing `registration_*` / `academic_record_*` tables. Don't create a parallel schema. Report the mapping before writing migrations.
> 2. Port `source-state.ts.txt` into `packages/domain-core` (rename .txt). Add unit tests for `mayShowDefinitiveReadiness`, `studentOutcome`, `validate`.
> 3. Apply the authorization model: forced RLS on every exposed table, read policies scoped to grant + tenant, writes only via security-definer commands owned by `semester_writer` (NOLOGIN). Port the relevant parts of `handoff/build-plan/staff-workspace/record-model/` + its review patch.
> 4. Implement `readiness.evaluate` with idempotent receipt + outbox in one transaction.
> 5. Add `tests/rls/readiness-access.spec.ts` and the P0 ops specs (`platform-ops/tests/operations/*`).
> 6. Run on Semester2 (dev) first, then Semester-Platform (staging). Never production.
> 7. Paste every test run output back to Harrison — that output is the release evidence.

Environment refs: production `semester` (don't touch) · staging `Semester-Platform` · dev `Semester2`.
Reference implementation that already passes 34 tests: `handoff/strengthened-package/lab/` — see `LAB-ADOPTION.md`.
