# NEXT_ACTIONS (checkpoint, 25 Oct 2026, afternoon)

Resume from here; do not restart the architecture. Registers: `source-manifest.csv`, `role-app-requirements.csv`,
`scope-coverage.md`, `conflicts-and-decisions.md`, `requirements-traceability.csv` (Book 2 pilot workflows).

## Baseline (pinned)
- Zite monorepo: commit 36e5838 (Integration mappings and drift). GitHub `main` d4f0053 contains `zite/` up to Zite d8ee54e (PR #1687 merged).
- Gates run on 36e5838: `check_app` ok; `sh apps/semester/tests/run.sh` all suites green. Browser, accessibility,
  load, hosted-sync and restore tests: NOT RUN.

## Method per increment
migration (CHECKs, append-only triggers, plpgsql returning NULL or error) -> rolled-back Neon batch with a control ->
endpoint (requireAction, audit, notification) -> UI with empty/error/permission states -> role-app state update ->
check_app -> unit suites -> mutation check on pure modules -> commit -> re-import to GitHub on a new branch.

## Queue (dependency order, unblocked first)
1. DONE 25 Oct: registrar (97 rows) and security (70 rows) registers; module register (135 apps, S-53). Remaining unreconciled: 15 sources.
   Fixed from them: tenant check on office-staff grants (SEC-034), withdrawn requests closed for the registrar (REG-039),
   reg.seat outbox rows applied (REG-060), reg_audit/reg_receipts append-only (REG-058).
   DONE 25 Oct: commit-time re-check (REG-036) and idempotent, resumable submit (REG-065).
   DONE 25 Oct: per-student commit serialization (REG-023).
   DONE 26 Oct: allow/deny decision log with correlation id (SEC-039, partial: forbid()/requireAccess denials not yet logged).
   Next from the registers, local and unblocked: per-user rate limit on ask.ts and onboarding (SEC-045/046);
   add/drop deadline and course withdrawal 'W' (REG-006/049).
2. DONE 25 Oct: waitlists and registrar-decided drop/atomic swap. Follow-up: C17 resolved 25 Oct (staff desk direct write removed); concurrent decide load test.
3. DONE 25 Oct: Integration Admin scopes and reconciliation runs (api/reconciliation.ts, Console tab, lib/reconRules tests).
4. Course Studio: assessments and submissions with gradebook release behind approval (area 4).
5. Prospective Student: program discovery and fit/cost comparison from published catalog (area 1).
6. Trace the 552-task board (S-12) against role-app-requirements and close duplicates.

## Decided 25 Oct
See `decisions-2026-10-25.md` (D1–D6). GitHub branch `zite/sync-2026-10-25` holds the Zite tree.
DONE 26 Oct: private file store (D2) — You → Files. Next: attach stored files to course submissions and career evidence.

## Blocked (owner)
- Publish Semester / Company OS: founder presses Publish in Zite (publish_app was denied; do not work around).
- SSO/SIS live connections, private file storage, money movement, transcript posting: need institution authority and C5 decision.
- C14 repository authority (`app/` vs `zite/`); C13 role inventory; missing exports listed in `source-register.md`.

## Rules carried forward
No production deploy, live financial action, external send, destructive migration or permission change without explicit
approval. Synthetic data only. Student records never go to external model providers. Never authorize from client-supplied
role or tenant values. Never mark a feature complete because a page exists.

## Added 25 Oct: module inventory (parallel session)
`context/10-module-inventory.md` (135 modules, 13 domains) is now a build requirement. Each module has a row in
`docs/execution/module-build-records.csv`; every status column starts "not assessed" and moves only on evidence.
Next: fill owner, authority and operating mode, and map each module to the existing role apps.
`module-register.csv` (other session, same day) is a first-pass assessment of the same 135 modules against existing code.
Merge its evidence into `module-build-records.csv` after review and retire one of the two, so they cannot drift.
