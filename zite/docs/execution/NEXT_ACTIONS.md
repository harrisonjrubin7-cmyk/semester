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
   Next from the registers, local and unblocked: DONE 26 Oct: per-user/per-tenant token bucket on ask.ts and onboarding (SEC-046 partial; SEC-045 is platform edge, not app-configurable);
   add/drop deadline and course withdrawal 'W' (REG-006/049).
2. DONE 25 Oct: waitlists and registrar-decided drop/atomic swap. Follow-up: C17 resolved 25 Oct (staff desk direct write removed); concurrent decide load test.
3. DONE 25 Oct: Integration Admin scopes and reconciliation runs (api/reconciliation.ts, Console tab, lib/reconRules tests).
4. Course Studio: assessments and submissions with gradebook release behind approval (area 4).
5. Prospective Student: program discovery and fit/cost comparison from published catalog (area 1).
6. Trace the 552-task board (S-12) against role-app-requirements and close duplicates.

## Decided 25 Oct
See `decisions-2026-10-25.md` (D1–D6). GitHub branch `zite/sync-2026-10-25` holds the Zite tree.
DONE 26 Oct: private file store (D2) — You → Files. DONE 26 Oct: files attach to course submissions and achievement evidence (locked at submit/verify); fixed cross-institution leak in the staff achievement review list. (Rate limits SEC-045/046 landed from the parallel session in 6ab3f6c.)
DONE 26 Oct: Course Studio assessments (asm-001). Not yet: rubrics, question banks reused across assessments, accommodations (extended time), regrade requests for assessments. Next: separate DDL credential (SEC-051) and staging database (SEC-061) need owner action; DONE 26 Oct: rubrics and grading delegation (team-001). DONE 26 Oct: delegated sections in the TA queue; course groups (grp-001). Next: advising appointments and office hours (MOD-042).

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

## 26 Oct: S-54 reconciled (expanded outline PDF)
- domain-families.csv: 45 families D01–D45; 34 partial, 11 missing (International/Veterans, Athletics, Housing, Dining, Facilities, Marketplace, Research admin, Research ethics, Library, HR/Payroll, Institutional finance). None are complete.
- proposed-roles.csv: 51 roles in 11 groups. 48 are proposals only and are not in roleApps.ts until the founder decides (C20). The other 3 are already covered by existing apps.
- cross-app-workflows.csv: 10 acceptance workflows XW-01..XW-10. 8 are partial and 2 missing; no end-to-end test has been run for any of them.
- Next: advising appointments and office hours (MOD-042, D14/D15). After that, accommodation extended time in assessments (closes a gap in XW-03).

## 26 Oct: Semester Institution, first workflow (S-55 §10)
- DONE: /institution command center (modules by role, waiting-on-you counts) and /institution/sections.
- Section request flow: department request → chair review (chair ≠ requester) → registrar authorization (≠ requester, ≠ approving chair; room and instructor clash re-checked under a per-term lock) → canonical Zite section created or adopted on retry (never duplicated) → instructor notified → opened for registration → reconciled against the request, with receipt SR-n.
- Evidence: 9 unit tests; 26 database checks rolled back, including a mutation check; typecheck. Browser NOT RUN.
- Gaps: creates in Semester's catalog only, with no write to the institution's SIS (operating mode: request_and_handoff for real tenants). No department membership or chair delegation. No demand view.
- S-56 recorded; capability-registry.csv started (first record).
- Next: Semester Faculty workspace (S-55 §11): Today for teaching, office hours, accommodation implementation, extended time. Then S-56 Prompt F readiness view, driven by capability-registry.csv.

## 26 Oct: Semester Faculty and office hours (S-55 §11, S-58 app factory)
- DONE: /faculty, the teaching home (sections taught, today's office hours, teaching tools, publishing office hours).
- DONE: /help/appointments for students (book, cancel before the start time, see host follow-ups).
- DONE: apt-001. Host slots have a capacity. Booking takes a per-student lock plus a row lock: no overbooking, no overlapping bookings, no host self-booking, and section office hours only for enrolled or completed students. Hosts cannot publish overlapping slots. A host cancel needs a reason and notifies booked students. Attendance and follow-up are host-only and only after the start time. The event log is append-only.
- FIXED: the race on legacy advising slots (read-then-update). Booking now goes through an atomic apt_claims insert and refuses slots that have started; cancel is allowed only before the start time.
- Role apps: "office hours", "appointments" and "availability" previously pointed at /plan and were marked existing. They now route to the real pages; the TA row is marked incomplete.
- S-57 (zip) and S-58 recorded: work-packages.csv (W01–W18) and acceptance-scenarios.csv (T01–T18), each with status, evidence and gaps.
- Next: accommodation extended time in assessments (W10/W11, T10). Then a readiness view driven by capability-registry.csv and acceptance-scenarios.csv (S-56 Prompt F).

## 26 Oct: Accommodation implementation, extended exam time (W10/W11, T10)
- DONE: acc-002. The accessibility office sets a 1.25x–3x time multiplier on an approved accommodation (staff only, not on their own request, with a version check; logged in acc_events).
- DONE: asm-002. At attempt start the database works out the extra minutes. They apply only if the student has an active letter for that section, the approval is still valid, and the assessment is timed. The extra time is stored on the attempt, so a resumed attempt keeps it. The late flag uses the extended limit and close time.
- The student sees their total time. Instructors see only "extended time applied" and never the request. The client never supplies the multiplier.
- Evidence: 5 unit tests; 18 database checks rolled back; a mutation check showed that removing section scoping leaks 1.5x into another course, and the test caught it. Browser NOT RUN.
- Next: readiness view (S-56 Prompt F) driven by capability-registry.csv and acceptance-scenarios.csv. Then T01, a cross-tenant sweep across all endpoints.
- BLOCKER (C23): apps/semester-institution (3nybmrumkp, from another agent session at 09:08) duplicates the section-request flow. Its "Section Requests" table is not in the live database and it fails typecheck. Founder to decide: keep it as a thin front door or remove it. One builder in Zite (D5) also needs re-confirming.
