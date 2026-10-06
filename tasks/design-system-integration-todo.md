# Design-system integration checklist

Companion to `tasks/design-system-integration-plan.md` and `docs/design-system/HANDOFF-INTEGRATION-CROSSWALK.md`. `tasks/todo.md` is a different program.

## Inventory

- [x] Fetch `origin/main` (`3bd382dc`) and read what landed after the inventory commit.
- [x] Recount screens (119), components (382), `app/src` tests (1356), migrations (184), handoff files (139).
- [x] Read `CLAUDE.md`, `D-1287`, `D-1294`, `D-1298`, the stream 01 diff and report, and `REPO_AUDIT.md`.
- [x] Record that the Desktop zip and `ui_kits/` are not on this machine.
- [x] Write the plan, this checklist, and the crosswalk.
- [x] Drop the drafted prompt scan. `D-1298` says it is not built.

## Stream 01, still open

- [ ] Privacy owner narrows or writes down `community_volunteers` / `trust_safety_reviewer`.
- [x] Probe the eight tables that were inconclusive. Done on main (`D-1298`): 64 tables, floor 64.
- [x] Sweep the fifteen owner-column names in `D-1303` (79 tables). `created_by`, `subject`, `owner_id` and `account_id` stay out: they mostly name staff.
- [ ] Decide whether the shared-key path keeps a per-request audit row.
- [ ] `student-files` and `course-materials` buckets, with retention and course scope.
- [ ] Provenance ladder, conflict resolution, projection-lag freshness, consequence pattern.
- [x] Blanket anon revoke of `private` helpers — not done. `rls-coverage.check.sql` says it would break `private.form_open()`.

## Not pursued

- [x] Marketplace revival — `D-1287`.
- [x] Company roles `ceo` / `cfo` / `comms` / `social` / `people` / `data` — not now.
- [x] Per-field profile visibility and campus directory — declined.
- [x] General campus events table — reuse `community_sessions`.
- [x] Handoff migrations `010`–`080` — not applied.
- [x] Free-text prompt scanner — `D-1298`.
- [x] `Cross-Origin-Opener-Policy` — deliberately not added.

## This slice

- [x] Leave-university and approve-join confirmations use `ActionPreview`, including whether the action can be taken back.
- [x] `SchoolMembership.test.tsx` requires those sentences.
- [x] Sign-out-other-devices uses `ActionPreview` and says the sign-out cannot be undone (`AccountSecurity.test.tsx`).
- [x] Sharing a plan with an advisor uses `ActionPreview` and says the student can revoke it (`AdvisorMeeting.test.tsx`).

## Named screens

- [x] Term Plan — the Registration planner (`yes`). Tab and heading say Term plan. Cart conflicts render before the sections (`RegistrationPortal.conflicts.test.tsx`).
- [x] Advisor Caseload — the folded share list (`AdvisorSharedView`) says Caseload and that it is not every student. A school-wide list stays blocked on institution data and consent (`SCREEN-PACKS.md` §4).
- [x] Tenant Overview, Operations Inbox, Institutional Pilot page — recorded in `SCREEN-PACKS.md` §4. Tenant overview and the inbox exist in part and are not retitled. The pilot page is routed pages on the company site.

## Gates for this change

Documentation only. Application code was not changed after the reset onto `d577a348`.

- [x] `npx vitest run src/lib/designtooling.test.ts` — 22 passed. It is the test that reads `docs/design-system/README.md`.
- [ ] `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`, `npm run design-system:check`, `npm run design-system:report` — not re-run. They do not execute these Markdown files, except `designtooling.test.ts`, which is the one that reads `docs/design-system/README.md`.
- [ ] HawkScan — unverified. No schema change.
- [ ] `supabase/check.sh` — not re-run. No migration or policy change.

## External, still open

- [ ] Institutional acceptance and UAT
- [ ] Legal review, DPA, insurance, HECVAT
- [ ] Live SIS/LMS and IdP configuration
- [ ] Accessibility conformance review (not claimed)
- [ ] Restore drill and production evidence
- [ ] Founder re-supplies `ui_kits/` before a UI stream copies a prototype
