# Design-system integration checklist

Companion to `tasks/design-system-integration-plan.md` and `docs/design-system/HANDOFF-INTEGRATION-CROSSWALK.md`. `tasks/todo.md` is a different program.

## 2026-10-08 mounted archive intake — pass 1

- [x] Confirm branch `codex/complete-semester-integration-2026-10-08`, clean starting tree and base/current `origin/main` `7b7603e1`.
- [x] Recompute the ZIP SHA-256 and match `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`.
- [x] Inventory all 3,570 extracted files (3,569 content files plus extraction sentinel) by stable relative path and SHA-256.
- [x] Assign exactly one file-artifact disposition to every inventory row without treating that disposition as a capability decision.
- [x] Read the archive entry maps, manifest, prototype inventory/JSON, registry, capability blueprint and stream map 00–30 as untrusted reference evidence.
- [x] Record contradictions instead of adopting the loudest archive count.
- [x] Recount the current repository's screen registry, navigation, screen/component/test files, migrations, functions, handlers, roles, capabilities and catalog totals.
- [x] Refresh the existing plan and crosswalk and add a status page for resumable automation.
- [ ] Reconcile each of the 281 prototype routes to the 589-row repository screen catalog and production owner paths.
- [x] Reconcile each of the 20 blueprint capabilities to repository capabilities, routes, data authority, policy and tests.
- [ ] Reconcile each of the 122 archive registry capabilities to repository capabilities, routes, data authority, policy and tests.
- [ ] Reconcile all 673 archive master-catalog screen rows; preserve the distinction from the 281 prototype routes.
- [ ] Reconcile streams 00–30 into Phases 0–12 at meaningful-item level, including dependencies and acceptance criteria.
- [ ] Give every meaningful archive item exactly one allowed disposition; file-family dispositions alone do not complete this gate.
- [ ] Identify the earliest buildable dependency-ready vertical slice only after the preceding row-level controls are complete.

## 2026-10-08 meaningful-item seed — pass 2

- [x] Fetch and rebase the clean branch onto current `origin/main` `ca0cc9ad`; inspect the migration-version repair and confirm it does not duplicate this slice.
- [x] Give all 20 `SEM-01`–`SEM-20` blueprint capabilities exactly one disposition.
- [x] Record the applicable production owner path, role/route, capability and permission, tenant/data authority, server operation, audit/recovery/states, tests, dependencies and release boundary for each blueprint row.
- [x] Reconcile six meaningful Stream 00 items without executing archive scripts or creating a parallel audit authority.
- [x] Reconcile all sixteen Stream 18 audit deliverables to the existing `docs/roles/*` authorities and separately disposition seven underlying role-platform decisions.
- [x] Reconcile all eighteen Stream 25 completion packages, all seven ecosystem rules and all three named open decisions.
- [x] Preserve the current eight-group navigation authority, strict AI student-record rule and single master/finish-line readiness system.
- [x] Classify P11 graduate/research education as missing and in scope, but not dependency-ready until its owner, authority/data contract, role map and acceptance path are established.
- [ ] Reconcile the 122-row archive capability registry; this is the next dependency-ready Phase 0 slice.

### Verification for pass 2

- [x] Focused documentation guard: repository-local `vitest run src/lib/designtooling.test.ts` from `app/` — 1 file, 22 tests passed. (`npx` is unavailable in this shell.)
- [x] Register structure check: 20 blueprint ids and 18 package ids occur once; all 77 meaningful-item data rows contain exactly one allowed disposition.
- [ ] Full application gates — not required for this documentation-only slice; no production code, schema, policy, dependency or generated token changed.
- [x] HawkScan — not applicable to this documentation-only slice; runtime and `HAWK_API_KEY` remain unavailable, and no production code or scan configuration changed.

### Verification for pass 1

- [x] Inventory validation: all 3,570 extracted paths, byte sizes and SHA-256 values match the CSV; zero missing, extra, duplicate-path or hash-mismatch rows.
- [x] Focused documentation guard: `npx vitest run src/lib/designtooling.test.ts` from `app/`.
- [ ] Full application gates — not required for this documentation/inventory-only slice; no production code, schema, policy or generated token changed.
- [ ] HawkScan — not applicable to this documentation/inventory-only slice; the runtime and `HAWK_API_KEY` are also unavailable.

## Earlier integration baseline preserved

- [x] Fetch `origin/main` (`3bd382dc`) and read what landed after the inventory commit.
- [x] Recount screens (119), components (382), `app/src` tests (1356), migrations (184), handoff files (139).
- [x] Read `CLAUDE.md`, `D-1287`, `D-1294`, `D-1298`, the stream 01 diff and report, and `REPO_AUDIT.md`.
- [x] Record that the Desktop zip and `ui_kits/` were unavailable to the earlier 2026-10-05 pass. Superseded on 2026-10-08 by the authenticated mounted archive; nothing was copied into production.
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
- [x] Archive availability resolved by the authenticated 2026-10-08 mount. Prototype material remains reference-only and must be rebuilt through repository-native controls.
