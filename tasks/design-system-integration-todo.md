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
- [x] Reconcile each of the 281 prototype routes to the 589-row repository screen catalog and production owner paths.
- [x] Reconcile each of the 20 blueprint capabilities to repository capabilities, routes, data authority, policy and tests.
- [x] Reconcile each of the 122 archive registry capabilities to repository capabilities, routes, data authority, policy and tests.
- [x] Reconcile all 673 archive master-catalog screen rows; preserve the distinction from the 281 prototype routes and the 589 current catalog rows.
- [x] Reconcile all 49 archive roles, 88 systems and 82 documents without creating parallel roles, services or document authorities.
- [x] Reconcile streams 00–30 into Phases 0–12 at meaningful-item level, including dependencies and acceptance criteria.
- [x] Give every currently identified meaningful archive item exactly one allowed disposition; exact catalog populations retain their canonical row register and novel stream bundles are dispositioned once.
- [x] Identify P1-03 outbox claim/settle/replay operations as the earliest buildable dependency-ready slice after verifying P1-01 and P1-02 already landed.

## 2026-10-08 meaningful-item seed — pass 2

- [x] Fetch and rebase the clean branch onto current `origin/main` `ca0cc9ad`; inspect the migration-version repair and confirm it does not duplicate this slice.
- [x] Give all 20 `SEM-01`–`SEM-20` blueprint capabilities exactly one disposition.
- [x] Record the applicable production owner path, role/route, capability and permission, tenant/data authority, server operation, audit/recovery/states, tests, dependencies and release boundary for each blueprint row.
- [x] Reconcile six meaningful Stream 00 items without executing archive scripts or creating a parallel audit authority.
- [x] Reconcile all sixteen Stream 18 audit deliverables to the existing `docs/roles/*` authorities and separately disposition seven underlying role-platform decisions.
- [x] Reconcile all eighteen Stream 25 completion packages, all seven ecosystem rules and all three named open decisions.
- [x] Preserve the current eight-group navigation authority, strict AI student-record rule and single master/finish-line readiness system.
- [x] Classify P11 graduate/research education as missing and in scope, but not dependency-ready until its owner, authority/data contract, role map and acceptance path are established.
- [x] Reconcile the 122-row archive capability registry; all rows now have one disposition and one current evidence profile.

## 2026-10-08 capability-registry reconciliation — pass 3

- [x] Fetch current `origin/main` `ca0cc9ad` and confirm no equivalent registry reconciliation landed.
- [x] Preserve the archive's 122 ids, actors, routes and permissions as identification evidence without adopting its schemas or dotted permission vocabulary.
- [x] Map every row to a repository owner/evidence profile covering current permission, tenant/data authority, server behavior, audit/recovery/states, tests, dependencies and release ceiling.
- [x] Assign exactly one allowed disposition to all 122 rows: 91 existing but incomplete, 10 prototype only, 2 duplicate or superseded, 18 documentation or roadmap only and 1 intentionally excluded.
- [x] Correct the current authorization census to the migration-rendered 69 roles, 96 capabilities and 185 role-capability rows; retain the older 84/157 permission page as a named stale snapshot.
- [x] Keep marketplace excluded while treating developer apps, keys and sandboxes as roadmap-only concepts pending separate authority.
- [x] Reconcile the 281 prototype routes; each row now has one disposition, an owner/profile, route/navigation evidence and exact catalog/capability matches.

## 2026-10-08 prototype-route reconciliation — pass 4

- [x] Fetch current `origin/main` `ca0cc9ad` and confirm no equivalent route reconciliation landed.
- [x] Preserve all 281 unique archive route strings, workspaces, labels, streams and prototype components without importing archive routes or source.
- [x] Map every row to a P1–P11 evidence profile and current owner/evidence path.
- [x] Record exact current app-screen and discoverable-navigation evidence separately; do not treat repeated workspace keys such as `home` as global route equivalence.
- [x] Record exact normalized matches to the 589-row repository audit and exact/same-domain matches to the 122-row capability register; reject fuzzy similarity.
- [x] Assign exactly one disposition: 62 existing but incomplete, 201 prototype only, 13 documentation or roadmap only and 5 intentionally excluded.
- [x] Keep all unmatched designs out of `missing and in scope` until current authority, data ownership and vertical-slice acceptance evidence exist.
- [x] Reconcile the 673 archive master-catalog screen rows; all 589 base rows and 84 workflow aliases now have one bounded disposition.

## 2026-10-08 catalog-screen reconciliation — pass 5

- [x] Fetch and merge current `origin/main` `e53128a6`; confirm its capability-exposure and assistant-safety changes do not duplicate this slice.
- [x] Parse `catalog-data.js` as JSON data without evaluating archive JavaScript.
- [x] Prove that the 673 rows consist of the exact 589-row repository catalog plus 84 appended rows declared by the archive as workflow-step aliases.
- [x] Give all 673 rows exactly one disposition and a P1–P7 owner/boundary profile, current evidence or planned owner, dependencies, acceptance contract and release boundary.
- [x] Classify the 84 workflow projections as duplicate or superseded screen aliases; retain their canonical ownership in the upcoming 319-row workflow pass.
- [x] Identify 44 missing-and-in-scope candidates without selecting a production slice before workflow and stream dependencies are reconciled.
- [x] Preserve anti-surveillance, academic-authority, community-data, marketplace/directory and employer-isolation exclusions and keep four actual external prerequisites open.
- [x] Reconcile all 319 canonical workflow rows; all rows now have one bounded disposition and the 84 screen aliases point to their canonical owner.

### Verification for pass 5

- [x] Generator validation: exactly 673 archive rows, 589 exact ordered base rows, 84 exact declared workflow aliases and 673 unique emitted keys.
- [x] Structural validation: one allowed disposition and one evidence profile per CSV row; computed disposition/group totals match the summary.
- [x] Focused documentation guard: repository-local `vitest run src/lib/designtooling.test.ts` from `app/`.
- [ ] Full application gates — not required for this documentation/reconciliation-tooling slice; no production route, schema, policy, dependency or generated token changed.
- [x] HawkScan — not applicable to this non-production slice; runtime and `HAWK_API_KEY` remain unavailable.

## 2026-10-08 workflow reconciliation — pass 6

- [x] Fetch current `origin/main` `e53128a6` and confirm no equivalent workflow reconciliation landed.
- [x] Parse the archive catalog as JSON data without evaluating its JavaScript.
- [x] Prove exact group length, order and label equality between all 17 archive workflows and all 319 unique repository workflow keys.
- [x] Validate all 84 catalog-screen aliases against their exact workflow and zero-based step index; keep them non-independent.
- [x] Give all 319 canonical rows one disposition, evidence profile, current evidence or planned owner, dependency/acceptance contract and release boundary.
- [x] Identify 54 missing-and-in-scope workflow candidates without treating them as additive to the 44 screen candidates or selecting production work early.
- [x] Preserve the developer-platform/marketplace roadmap boundary, marketplace exclusions, external accommodation/signature authority and student-controlled advising boundary.
- [x] Reconcile the 49-role, 88-system and 82-document catalog populations with current owners, dependency contracts and release boundaries.
- [x] Reconcile the remaining Stream 00–30 meaningful items and resolve cross-stream dependencies for the buildable candidates.

### Verification for pass 6

- [x] Generator validation: exactly 319 archive rows, 319 unique repository rows, exact ordered labels, 84 exact screen aliases and 319 unique emitted keys.
- [x] Structural validation: one allowed disposition and one evidence profile per CSV row; computed disposition/workflow totals match the summary.
- [x] Focused documentation guard: repository-local `vitest run src/lib/designtooling.test.ts` from `app/`.
- [ ] Full application gates — not required for this documentation/reconciliation-tooling slice; no production route, schema, policy, dependency or generated token changed.
- [x] HawkScan — not applicable to this non-production slice; runtime and `HAWK_API_KEY` remain unavailable.

## 2026-10-08 role/system/document reconciliation — pass 7

- [x] Fetch current `origin/main` `e53128a6`, confirm it is already an ancestor and inspect the capability-state/assistant-safety change for overlap.
- [x] Parse the archive catalog as JSON data without evaluating its JavaScript.
- [x] Give all 49 archive role rows one disposition, current role/grant evidence or roadmap owner, dependency contract and release boundary.
- [x] Validate every named current role against the migration-rendered 69-role launch register; do not create archive text-role aliases.
- [x] Give all 88 system rows one disposition and current owner profile; keep marketplace excluded, developer platform and board reporting roadmap-only, and projection/read models missing and in scope.
- [x] Map all 82 archive document requirements to current repository authorities and classify the archive copies as duplicate or superseded without implying approval or operation.
- [x] Keep the graduate/research lifecycle gap separate from the existing `graduate_student` role and keep projection/read models behind the remaining stream dependency pass.

### Verification for pass 7

- [x] Generator validation: exactly 49 roles, 88 systems, 82 documents and 219 unique emitted keys.
- [x] Structural validation: every row has one allowed disposition, evidence profile, current owner/evidence, dependency/acceptance contract and release boundary; mapped roles and document evidence paths resolve.
- [x] Focused documentation guard: repository-local `vitest run src/lib/designtooling.test.ts` from `app/`.
- [ ] Full application gates — not required for this documentation/reconciliation-tooling slice; no production route, schema, policy, dependency or generated token changed.
- [x] HawkScan — not applicable to this non-production slice; runtime and `HAWK_API_KEY` remain unavailable.

## 2026-10-08 execution-stream reconciliation — pass 8

- [x] Fetch current `origin/main` `e53128a6` and verify no equivalent full Stream 00–30 reconciliation landed.
- [x] Link repeated route, screen, workflow, capability, role, system, document and Stream 00/18/25 rows to their canonical register instead of assigning duplicate statuses.
- [x] Give each remaining novel execution bundle exactly one allowed disposition, current owner/evidence, dependency/acceptance boundary and release ceiling.
- [x] Preserve current decisions: no archive migrations/scripts, no second app or navigation system, no marketplace/directory revival, no free-text scanner and no fabricated provider/institution readiness.
- [x] Correct the dependency graph for landed repository evidence: P1-01 projection tables/claim columns and P1-02 event writer exist but are incomplete operating paths.
- [x] Select P1-03 claim/complete/fail/approved-replay operations as the earliest dependency-ready production slice; keep worker/cron/producers/read models/UI out of that slice.
- [x] Keep Course Studio next at the domain-cluster level and keep P11 graduate/research education non-ready pending owner and authority contracts.

### Verification for pass 8

- [x] Structural validation: 53 unique stream-bundle ids, one allowed disposition per row, all named repository evidence paths resolve, and computed disposition totals match the register.
- [x] Focused documentation guard: repository-local `vitest run src/lib/designtooling.test.ts` from `app/` — 1 file, 22 tests passed.
- [ ] Full application gates — not required for this documentation-only reconciliation slice; no production code, schema, policy, dependency or generated token changed.
- [x] HawkScan — not applicable to this documentation-only slice; the runtime and `HAWK_API_KEY` are unavailable and no production code or scan configuration changed.

## 2026-10-08 projection outbox operations — pass 9

- [x] Fetch `origin/main` before work and again after it advanced to `d9640e45`; confirm no equivalent P1-03 migration, function, focused check or migration-version collision landed. Do not merge or rebase the dirty branch.
- [x] Add service-only, bounded claim/complete/fail operations over the existing outbox and receipt tables without adding a worker, scheduler, producer, projection, read model or UI.
- [x] Recover claims older than five minutes, cap claim batches at 100, delay retryable failures with deterministic jitter under fifteen minutes and dead-letter at attempt eight.
- [x] Preserve one receipt key per consumer/event; repeated completion and replay are idempotent and replay does not erase the failed receipt.
- [x] Add a dedicated `projection-replay` console duty with engineering request, independent data/security approvals and evidence naming the event, consumer, projector version and rollback.
- [x] Require `console:operate`, fresh MFA, an exact current approval and a fail-closed immutable audit append before replay resets delivery state.
- [x] Add focused SQL proof for grants, claim ordering/bounds/recovery, claim identity, completion, retry/dead letter, replay authorization/idempotency and audit failure rollback.
- [x] Regenerate the console, event, role-launch and control-facts registers affected by the new migration and duty.
- [x] Run `supabase/check.sh projection-outbox-operations` on PostgreSQL 17 — all 204 migrations applied and all six focused checks passed; the idempotency run left the schema and all 368 table fingerprints unchanged and passed the six checks again.
- [x] Commit the coherent P1-03 slice after the focused generated-register guards are rerun.

### Verification for pass 9

- [x] Focused policy/reference tests: six files and 196 tests passed after the final evidence update.
- [x] `pnpm exec tsc -b`, `pnpm run lint`, `pnpm run check:university`, and `pnpm run build` passed. Lint retained only the existing warning baseline.
- [ ] `pnpm test` — ran, but not green: the mounted `.semester-reference` directory is absent from the repository map; generated registers were then refreshed; late unrelated `softtop`/`localask` timing failures and a worker SIGTERM occurred after roughly 25 minutes. Slice-focused tests remain green.
- [ ] `npm run test:shuffle`, `npm run design-system:check`, and `npm run design-system:report` — not run in this backend-only slice; the prior full ordered suite also remains non-green for the recorded unrelated failures.
- [ ] HawkScan DAST — unavailable because the HawkScan runtime and `HAWK_API_KEY` are both absent; no scan is claimed and the release gate remains open.

## 2026-10-08 first SQL-native domain producer — runner pass 2, slice 10

- [x] Fetch `origin/main` before and after work; final `32dd8241` changes seventeen non-overlapping app/vite files and contains no equivalent producer.
- [x] Keep the projector worker disabled until a registered handler can apply an effect, receipt, watermark and invalidation atomically.
- [x] Extend the existing feature-policy audit trigger rather than creating a second command path or audit table.
- [x] Emit one existing-catalog `entitlement.changed` event per committed feature-policy audit fact, bound by audit UUID correlation and idempotency keys.
- [x] Keep free-text reason, permitted roles/cohorts and actor details out of the payload; delete emits a bounded tombstone.
- [x] Preserve audit-only behavior for AI policy, approved-source and consent rows.
- [x] Prove insert/update/delete, bounded payload, one-to-one audit binding, client refusal and policy/audit/outbox rollback in PostgreSQL 17.
- [x] Reapply all 205 migrations without schema or data-fingerprint drift; rerun the five producer checks.
- [x] Run adjacent intelligence-policy, feature-cohort and governance suites — 149/149 checks passed in addition to the producer suite.
- [x] Regenerate the event, roadmap and definer registers; ordered and shuffled focused guards each pass 104/104 tests.
- [x] Run `tsc -b`, lint, `check:university` and the production build; all pass with only existing warning baselines.
- [ ] HawkScan DAST — unavailable because the HawkScan runtime and `HAWK_API_KEY` are both absent; no scan is claimed and the release gate remains open.

### Verification for pass 4

- [x] Generator validation: exactly 281 archive routes, 589 current catalog rows and 122 reconciled capability rows; 281 unique emitted route keys.
- [x] Structural validation: 281 CSV rows, one allowed disposition and one P1–P11 profile per row; computed disposition totals match the summary.
- [x] Focused documentation guard: repository-local `vitest run src/lib/designtooling.test.ts` from `app/`.
- [ ] Full application gates — not required for this documentation/reconciliation-tooling slice; no production route, schema, policy, dependency or generated token changed.
- [x] HawkScan — not applicable to this non-production slice; runtime and `HAWK_API_KEY` remain unavailable.

### Verification for pass 3

- [x] Structural validation: 122 archive ids, 122 unique register rows, zero missing/extra/duplicate ids, one allowed disposition and one P1–P11 evidence profile per row; computed counts match the register summary.
- [x] Focused documentation guard: repository-local `vitest run src/lib/designtooling.test.ts` from `app/` — 1 file, 22 tests passed.
- [ ] Full application gates — not required for this documentation-only slice; no production code, schema, policy, dependency or generated token changed.
- [x] HawkScan — not applicable to this documentation-only slice; runtime and `HAWK_API_KEY` are unavailable, and no production code or scan configuration changed.

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
