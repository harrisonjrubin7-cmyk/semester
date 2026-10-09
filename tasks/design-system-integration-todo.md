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

## 2026-10-08 first registered projector transaction — runner pass 3, slice 11

- [x] Fetch `origin/main` and confirm `32dd8241` contains no equivalent projector transaction, read model, focused suite or migration-version collision.
- [x] Register one active, school-scoped `ops_tenant_entitlements` version-1 read model using the existing `tenant:configure` capability vocabulary.
- [x] Keep the materialized state private and service-only; store only policy id, capability, bounded state/tombstone, revision and source cursor.
- [x] Validate the exact existing `entitlement.changed` version-1 envelope and payload before any effect is written.
- [x] Apply effect, existing consumer receipt, monotonic watermark and invalidation in one transaction.
- [x] Settle delayed earlier events as `skipped` so they cannot regress a newer state, tombstone, watermark or invalidation stream.
- [x] Preserve repeat safety and rollback the whole transaction on malformed input.
- [x] Keep worker, cron, public read API, UI and additional producers/projectors outside this slice.
- [x] Add the read model and current outbox/projection behavior to `RETENTION.md`; keep the sweep and activation gate open.
- [x] Run the focused PostgreSQL 17 suite with migration reapply: 206 migrations, 369 unchanged table fingerprints and 4/4 checks passed.
- [x] Run adjacent grants, RLS, indexes, projection-foundation, outbox and producer suites; add the already guarded replay RPC to the deliberate authenticated-function allowlist; final combined run passed 53/53 checks.

### Verification for runner pass 3 / slice 11

- [x] Focused migration, retention, privacy, platform-reference, role-launch and control-facts guards passed: 208/208 plus 57/57 generated-register tests.
- [x] `pnpm exec tsc -b`, lint, `check:university`, production build, `design-system:check` and `design-system:report` passed; lint/design retained only their existing warning baselines.
- [ ] `pnpm test` — not green: before the long run was stopped it found the known mounted `.semester-reference` repository-map refusal and two generated-register drifts. The two registers were regenerated and their focused tests pass; `developers.test.ts` still fails only because the uncommitted runner mount is intentionally absent from the repository map. No slice-focused test failed.
- [ ] `pnpm run test:shuffle` — not run after the ordered gate remained non-green for the recorded mounted-directory refusal.
- [ ] HawkScan DAST — unavailable because the HawkScan runtime and `HAWK_API_KEY` are both absent; no scan is claimed and the release gate remains open.

## 2026-10-08 bounded dormant projector endpoint — runner pass 4, slice 12

- [x] Fetch `origin/main` before and after work; final `523091e9` contains no equivalent worker endpoint, dispatch migration or focused suite. Its new `20261008190000_console_postmerge_safety.sql` collision is reconciled by renumbering the branch-local projection migration to unused version `20261008190500`.
- [x] Add a service-role-only database batch capped at 25 events.
- [x] Claim only `entitlement.changed` version 1 rows and dispatch only the active registered entitlement handler; leave other outbox types untouched.
- [x] Preserve atomic effect/receipt/watermark/invalidation behavior and use the existing bounded retry/dead-letter transitions.
- [x] Dead-letter invalid envelopes with a generic bounded reason and no partial materialized state.
- [x] Add a POST-only Edge Function guarded by a dedicated bearer secret; fail closed while the secret or service credentials are absent.
- [x] Keep the endpoint unmounted from `scheduler.sql`; do not provision a secret, deploy, activate cron, expose a read API or add UI.
- [x] Register the function in the guard, config, deployment snapshot, secret inventory and generated function/configuration references.
- [x] Reconcile generated roadmap and definer registers, including the prior replay RPC's exact callable-definer classification.
- [x] Apply all 207 migrations on PostgreSQL 17 and pass the four focused worker checks.

### Verification for runner pass 4 / slice 12

- [x] Focused HTTP, edge-guard, deploy/config snapshot, secret and generated-register suites pass; the broader focused run is 316/317, with only the known runner-mounted `.semester-reference` repository-map refusal and all other 115 developer-document tests green.
- [x] PostgreSQL 17 reapply gate: all 207 migrations applied twice with 369 table fingerprints unchanged; grants, foundation, outbox, producer, handler and worker suites passed 40/40 checks.
- [x] `pnpm exec tsc -b`, lint, `check:university` and the production build pass with only existing warning baselines.
- [x] Design-system check/report equivalents pass through repository-local pnpm/Node: token export 9/9, five contract files 69/69, audits within the existing warning ledgers, and all eight report contract files pass. The package script's nested `npm` command is unavailable in this shell, so no direct `npm run` invocation is claimed.
- [ ] `pnpm test` and `pnpm run test:shuffle` — not rerun after the exact known mounted-directory guard remained red in the broader focused run; no slice-focused test failed.
- [ ] `deno check` — Deno is unavailable in this shell; the pure handler is imported by Vitest and the Edge Function source/config/import/RPC contracts pass repository guards.
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

## 2026-10-08 hold-aware projection retention — runner pass 5, slice 13

- [x] Fetch `origin/main` before and after the slice; it advanced from `523091e9` to `7d93d31b`, with no equivalent projection-retention migration/check or version collision.
- [x] Add a service-role-only manual retention operation; do not add or activate a scheduler.
- [x] Scrub only published payloads after 30 days and preserve pending and dead-lettered events for delivery, diagnosis and approved replay.
- [x] Expire terminal event envelopes and receipts by retention class: operational 90 days, student record/commercial 400 days and audit 3 years.
- [x] Expire projection invalidations after 90 days.
- [x] Preserve tenant-scoped history under a tenant hold and skip the entire operation visibly under a platform hold.
- [x] Prove all retention branches, receipt co-deletion, hold boundaries and client/service grants in disposable PostgreSQL 17.
- [x] Reapply all 208 migrations; schema and 369 table fingerprints remain unchanged; rerun 10 focused checks.
- [x] Run adjacent SQL guards — 145 checks across retention, outbox operations/foundation, outbox, legal holds, hold-blind sweeps, grants, RLS and indexes.
- [x] Run focused repository guards — 72 tests for retention, scheduler, definer and design tooling.
- [x] Run TypeScript, lint, university typecheck and production build; lint retains only three existing warnings. The first build hit a generated-output cleanup race and the immediate rerun passed.
- [x] Run the design-system check constituents and report contracts through the available pnpm runtime — 9 token tests, 69 check tests and 96 report-contract tests passed; zero audit violations and the existing 86 warnings remain within ledgers. The wrapper cannot invoke its nested `npm`/`npx` commands because this runner has neither binary.
- [ ] Scheduler activation — remains separate and requires a provisioned secret, deployment evidence, monitoring, an operating runbook and explicit activation authority.
- [ ] HawkScan DAST — preflight cannot start because the `hawk` executable is absent. `HAWK_API_KEY` is unset, although a local Hawk properties file exists and was not read. No scan or pass is claimed.

## 2026-10-08 tenant-rollout producer and projection — automation pass 6, slice 14

- [x] Merge current `origin/main` `7d93d31b` into the clean build branch; preserve both the projection replay entry and newer hardened console definitions in generated security registers.
- [x] Select tenant rollout as the next documented P1 producer after feature policy and bind it to the first justified consumer; do not add a parallel rollout command path.
- [x] Add cataloged `tenant_rollout.changed` version 1 events atomically with immutable rollout history, bound by that history UUID and stripped of reason/actor data.
- [x] Register one private school-scoped `ops_tenant_rollout` version-1 read model using the current `tenant:configure` capability vocabulary.
- [x] Apply effect, receipt, monotonic watermark and invalidation in one transaction; skip delayed events and isolate malformed input.
- [x] Extend the dormant 25-row worker to dispatch only the two exact registered handlers; keep unrelated event types untouched.
- [x] Keep client reads, UI, scheduler, secret provisioning, deployment and production execution outside the slice.
- [x] PostgreSQL 17 focused suite: 5/5 checks passed; reapply left all 370 table fingerprints unchanged.
- [x] Adjacent tenant-rollout, feature-policy producer, entitlement projector, worker, retention, grants, RLS and indexes suites: 73/73 checks passed.
- [x] Event catalog and generated reference guards: 66/66 tests passed.
- [x] TypeScript, lint, university typecheck, production build and design-system check/report contracts passed; lint retains three existing warnings.
- [x] Ordered and shuffled full suites completed with 23,771 passing and 69 skipped tests. Each has one environment-only failure because the repository-map guard sees the runner-mounted `.semester-reference`; shuffle seed `1791502868214` added no order-dependent failure.
- [ ] HawkScan DAST — `hawk` is absent and `HAWK_API_KEY` is unset; no scan or pass is claimed.

## 2026-10-08 permissioned tenant projection read — automation pass 7, slice 15

- [x] Merge current `origin/main` `a2c9a4d0` into the clean build branch and confirm its developer-tools documentation change does not duplicate or collide with the selected read contract.
- [x] Inspect final `origin/main` `b190f96a`; its Course Engine MVP adds no Supabase migration or equivalent projection reader. Keep its domain coverage for reconciliation before a later Course Studio slice; do not rebase or merge the dirty branch.
- [x] Add one exact-tenant `read_tenant_projection` RPC over the existing private entitlement and rollout projections; do not expose their tables.
- [x] Require live platform `console:operate` or exact-school `tenant:configure` authority and make forbidden access an explicit `42501` error.
- [x] Bound entitlement pages to 1–100 rows with a closed capability cursor and keep tenant, policy and event identifiers out of row payloads except the requested tenant envelope key.
- [x] Return the repository query envelope with projection authority, source/computation times, coverage, model version, correlation id, non-export permissions and warnings.
- [x] Compute `fresh`, `stale`, `failed` and `unknown` from each active registry row, watermark and SLO; never call a missing watermark fresh and never return private worker errors.
- [x] Prove no-grant/wrong-tenant refusal, platform and school access, pagination, cross-tenant non-disclosure, all freshness branches, minimal output, execute grants and continued table privacy on PostgreSQL 17.
- [x] Add the RPC to the whole-schema callable-function allowlist and security-definer register; regenerate the register document and rerun its guard.
- [x] Reapply all 211 migrations with 370 table fingerprints unchanged; pass 52/52 checks across the reader, grants, RLS, foundation, both projectors and worker.
- [x] Pass 35/35 focused repository/register tests, TypeScript, lint, university typecheck and the production build; lint retains only three existing warnings.
- [x] Pass design-system equivalents: 9 token tests, 69 check tests and 96 report-contract tests; zero violations and 86 existing ledgered warnings.
- [x] Connect this envelope to the existing Console Tenant operations UI through the bounded, read-only, exact-tenant consumer in slice 16.
- [ ] Scheduler/secret/deployment/monitoring activation — remains external and separately authorized; no production operation is claimed.
- [ ] HawkScan DAST — post-commit preflight stopped because the `hawk` executable is absent and `HAWK_API_KEY` is unset for the headless scan. No credential file was read; no scan or pass is claimed.

## 2026-10-08 Console tenant projection consumer — automation pass 8, slice 16

- [x] Merge current `origin/main` `b190f96a` into the clean build branch and confirm its Course Engine MVP contains no equivalent Console projection consumer.
- [x] Inspect final `origin/main` `55adab11`; its productivity request-context security change has no overlapping Console client/component, projection migration or generated register. Do not rebase or merge the dirty branch.
- [x] Reuse the existing Tenant operations workspace and tenant groups; do not create a second route, operations shell or free-form tenant lookup.
- [x] Add a typed `read_tenant_projection` adapter with exact argument names, a 50-row default bound, cursor support, cross-tenant response rejection and fail-closed envelope validation.
- [x] Load projected state only after an operator opens a named tenant disclosure; keep the surface read-only and explicitly non-exportable.
- [x] Render authority, freshness, coverage/model/worker state, source and computation times, correlation, rollout and entitlement rows without policy ids, source event ids or private diagnostics.
- [x] Cover loading, recoverable error, permission denial, empty/unknown, stale/failed warning, pagination and narrow responsive cards with current shared state and Console components.
- [x] Keep worker scheduling, secret provisioning, deployment, monitoring and production freshness evidence outside this local UI slice.
- [x] Focused client and component tests pass 43/43; the adapter test proves refusal preservation, tenant binding, pagination arguments, non-export permissions and malformed-envelope rejection.
- [x] TypeScript, lint, university typecheck and production build pass; lint retains three existing warnings.
- [x] Design-system constituents pass: 9 token tests, zero audit violations with the existing 86 warnings, CSS within its ledger and 69 contract tests; the report was regenerated successfully.
- [x] Ordered full suite completes with 23,774 passing and 69 skipped tests. The only failures are the mounted `.semester-reference` repository-map refusal and two generated-register drifts; both registers were regenerated and their focused guards pass.
- [ ] Shuffled full suite — attempted with seed `1791505035827` after register reconciliation, but it developed unrelated import-scan timeouts and React `act()`/axe cascades and ended with exit 130 before a final count. The focused shuffled slice passes 43/43 with the same seed; no full-suite pass is claimed.
- [ ] 12ui external improvement pass — unavailable because its installer transitively requires missing `npm`/`npx`; repository-native UI and design gates are used instead.
- [ ] HawkScan DAST — required for this production UI change but unavailable because `hawk` is absent and `HAWK_API_KEY` is unset; no scan is claimed.

## 2026-10-08 Course Engine boundary reconciliation — automation pass 9, slice 17

- [x] Fetch and inspect current `origin/main` `55adab11`; merge its productivity request-context hardening into the clean build branch and confirm no Course Engine reconciliation overlap.
- [x] Measure the landed MVP: 89 tracked files, 15 Next.js workspace modes, 40 FastAPI route decorators and 21 SQLAlchemy entity models.
- [x] Confirm the root npm workspace, current screen registry and navigation do not integrate the separate app.
- [x] Map sixteen meaningful MVP families to current Semester owners and archive Course Studio rows with exactly one disposition each.
- [x] Keep the separate Next.js/Tailwind shell, JWT identity, Alembic schema and parallel deployment topology out of the integration path.
- [x] Preserve current Import/Study Studio evidence: multi-file course intake, explicit date review/confirmation, multi-source generation, course AI policy checks and verifiable quotations are existing but incomplete rather than absent or verified.
- [x] Keep provider adapters, credentials, KMS/AV services, deployment and institutional approval as explicit external gates.
- [x] Select the repository-native `student-files` / `course-materials` authority contract as the next dependency: course identity, tenant/course relationship, storage, validation/scanning, retention/deletion, provenance/correction propagation, idempotency, audit and recovery.
- [x] Run the focused design-tooling documentation guard through the repository-local Vitest binary — 1 file and 22 tests passed. The `npx` wrapper is unavailable in this shell; no result is attributed to it.
- [x] HawkScan is not applicable to this documentation/reconciliation-only slice; no production code or scan configuration changed.

### Next implementation boundary

- [x] Define and test the current-repository course-source authority contract before adding server storage or ingestion.
- [ ] Extend the existing Import/Study Studio path with the first bounded server-backed source slice; do not add a Course Engine route or parallel course model.
- [ ] Keep extracted dates/assignments uncommitted until explicit student confirmation, retain source links and propagate confirmed corrections.
- [ ] Keep faculty-published/official LMS course data behind exact teaching capability and institutional authority rather than treating a student's source as official.

## 2026-10-08 course-source authority contract — automation pass 10, slice 18

- [x] Fetch and inspect current `origin/main` `55adab11`; confirm no equivalent course-source authority or storage contract landed.
- [x] Reuse `packages/platform/src/engines/files.ts` for tenant-prefixed keys, classifications, size caps, quarantine lifecycle, signed-download limits and legal-hold deletion refusal.
- [x] Bind student sources to exact current course-row ownership and exact tenant membership; bind published course material to `course:publish` at exact `<tenant>/<CODE>` scope.
- [x] Require a current versioned institution retention policy for shared material; preserve the current 30-day student Drive recovery rule and legal-hold precedence.
- [x] Require request-context idempotency and a successful shared rate-limit decision before an upload can be planned.
- [x] Accept only bounded document formats; keep server archive ingestion refused until a sandboxed bounded expander exists.
- [x] Require a tenant-bound service context for storage receipt and scan settlement; keep ordinary users and cross-tenant services out.
- [x] Keep bytes quarantined until clean scan, exact detected/declared type, SHA-256 and scanner version agree; reject every mismatch and scanner failure.
- [x] Define immutable source/correction lineage and content-free audit facts without filename, excerpt, extracted text or old/new value content.
- [x] Document the authority, retention, provenance, recovery and remaining persistence/deployment gates in `docs/COURSE-SOURCE-AUTHORITY.md`.
- [x] Authority and generic file-engine tests pass 66/66 in ordered and shuffled runs; authority/architecture/generated-reference guards pass 144/144 together.
- [x] TypeScript, lint, university typecheck and production build pass; only the existing three lint warnings remain.
- [x] Design-system constituents/report pass: 9 token tests, zero audit violations with the existing 86 warnings, CSS within its ledger and 69 contract tests.
- [ ] Ordered full suite — 23,786 pass and 69 skip; only the runner-mounted `.semester-reference` repository-map refusal and an unrelated 30-second waiting-row timeout fail.
- [ ] Full shuffled suite — seed `1791508834946` finishes with 23,787 pass and 69 skip; only the runner-mounted `.semester-reference` repository-map refusal fails.
- [ ] HawkScan DAST — preflight cannot start because `hawk` is absent and `HAWK_API_KEY` is unset. No scan or pass is claimed.

### Next implementation boundary

- [x] Add repository-native student-source metadata, correction and deletion/recovery persistence with deny-by-default RLS and exact server-side relationship resolution.
- [x] Append content-free audit and source state atomically; prove idempotency and tenant isolation in focused PostgreSQL checks.
- [ ] Keep bucket provisioning, deployed scanning, extraction, public upload/download routes and Import/Study Studio UI wiring outside that schema slice unless their prerequisites are actually available.

## 2026-10-08 student course-source persistence — automation pass 11, slice 19

- [x] Fetch and inspect starting `origin/main` `55adab11`; confirm it is already an ancestor and contains no equivalent course-source persistence boundary.
- [x] Inspect `origin/main` `bf208b6e`; its design-component foundation, archive-audit documents and PWA cache namespacing contain no equivalent course-source migration or overlapping integration-control file.
- [x] Inspect final `origin/main` `f2b8b56d`; its production-support UAT and support-retention work contains no equivalent course-source persistence but overlaps `RETENTION.md`, `ROLE-LAUNCH-REGISTER.md` and `CONTROL-FACTS.md`. Do not merge or rebase the dirty branch.
- [x] Add private student-source metadata, append-only correction lineage and an append-only idempotency ledger without creating a second course model.
- [x] Give `anon` and `authenticated` no policy or table privilege; give service role read-only table grants and controlled function execution only.
- [x] Resolve the exact current `public.courses` ownership and active `institution_membership` inside PostgreSQL on create, correction, deletion and restore.
- [x] Enforce the repository document allowlist, 50 MiB student-private cap and exact tenant-prefixed object-key shape while creating no storage object or signed URL.
- [x] Scope idempotency by tenant, actor and action; reject reuse with a different request hash and return the original result on exact replay.
- [x] Require an available integrity-bound source for a correction and hash-link each revision to the latest derived-value revision.
- [x] Preserve an exact 30-day recovery window, restore the prior lifecycle state and refuse deletion under account, tenant or platform legal hold.
- [x] Append pseudonymous content-free audit in the same transaction and prove a failed audit append rolls back state and idempotency.
- [x] Keep shared `course-materials` closed until a current versioned institution retention-policy authority exists; do not accept request prose as policy evidence.
- [x] PostgreSQL 17 focused proof: 30/30 checks; reapply leaves the schema and all 373 table fingerprints unchanged.
- [x] Whole-schema grant/RLS/index guards: 30/30 checks after the first index run identified and the slice fixed seven uncovered foreign keys.
- [x] Adjacent legal-hold, deletion, membership, audit and Course Studio suites: 204/204 checks.
- [x] `pnpm exec tsc -b`, lint, `check:university` and the production build pass; lint retains the existing three-warning baseline.
- [x] Design-system constituents pass: 9/9 token-export tests, zero audit violations with the existing 86-warning ledger, CSS within its ledger and 69/69 contract tests. The aggregate `npm` wrapper and `design-system:report --with-tests` cannot launch their internal tests because this runtime has no `npm`; no wrapper/report pass is claimed.
- [x] Focused post-register proof passes 143/143 tests; generated-register/evidence guards pass 113/113 after the role, trust, retention and classification references were refreshed.
- [ ] Ordered full suite — 23,784 pass and 69 skip; the mounted `.semester-reference` map refusal and a `deadcss` timeout remain, while the two generated-document failures found by the run were refreshed and pass focused guards.
- [ ] Shuffled full suite — seed `1791510957791` finishes with 23,782 pass, 69 skip, six failures and eight teardown errors. The mounted-reference refusal and `deadcss` timeout remain; stale generated documents were refreshed, and the task-action/import teardown cascade passes in the 143-test focused rerun. No full-suite pass is claimed.
- [ ] HawkScan DAST — preflight cannot start because the `hawk` executable is absent and `HAWK_API_KEY` is unset. No scan or security pass is claimed; the release gate remains open.

### Next implementation boundary

- [ ] Merge/reconcile `origin/main` `f2b8b56d` on a clean branch, preserving its support-retention/UAT evidence and resolving the three overlapping generated/control files before the next slice.
- [ ] Add the service-only storage-receipt and scan-settlement persistence transition, preserving quarantine until declared/detected type, integrity hash and named scanner version agree.
- [ ] Provision neither bucket nor scanner until their private policy/runtime evidence exists; keep public upload/download and current-screen wiring closed.
- [ ] Define a repository authority for versioned institution course-material retention before enabling `course-materials` persistence.

## 2026-10-08 student course-source storage and scan settlement — automation pass 12, slice 20

- [x] Fetch and merge current `origin/main` `eb2504dd` on the clean branch; preserve support-retention/UAT, archive-audit, component-foundation, PWA and provider-state work.
- [x] Inspect final `origin/main` `f9f5d000`; its standalone-shell/developer-tool changes do not overlap or duplicate this slice.
- [x] Resolve the three generated-register conflicts through their repository generators; pass 101 focused generator tests and refresh the merged service-catalog count.
- [x] Add a service-only, tenant-bound storage-receipt transition that requires the planned object key and byte count plus a valid stored SHA-256 and bounded object version.
- [x] Keep every received source quarantined; a storage receipt alone never makes metadata readable.
- [x] Add service-only scan settlement with current course/membership recheck and exact declared/detected type plus stored/scanned SHA-256 agreement under a named scanner.
- [x] Settle type mismatch, integrity mismatch, blocked verdict and scanner error as rejected; only a matching clean result becomes available.
- [x] Scope receipt and scan idempotency by tenant, service actor and action; replay exact requests and refuse changed requests under the same key.
- [x] Append pseudonymous content-free audit atomically and prove an audit failure rolls state and idempotency back.
- [x] Preserve deny-by-default RLS and table grants; client roles cannot call either function and service role cannot bypass them with direct writes.
- [x] PostgreSQL 17 applies all 214 migrations twice with all 373 table fingerprints unchanged; 17 focused settlement checks and 30 adjacent persistence checks pass.
- [x] Definer, grant, index and RLS sweeps pass 34/34 checks; course-contract and generated-register guards pass 96/96 tests.
- [x] TypeScript, lint, university typecheck and production build pass; lint retains the four-warning merged-main baseline and build retains chunk-size warnings.
- [x] Design-system constituents pass: 9/9 token tests, zero audit violations with the existing 86-warning ledger, CSS within its ledger and 69/69 contract tests. Aggregate wrappers cannot run because they hardcode missing `npm`; no wrapper/report pass is claimed.
- [ ] HawkScan DAST — required for this production schema change but unavailable because `hawk` is absent and `HAWK_API_KEY` is unset; no scan or security pass is claimed.
- [ ] Bucket/scanner runtime, extraction, public routes, UI wiring, deployment and production operation remain unimplemented and unverified.

### Next implementation boundary

- [ ] Add a private repository adapter/runtime boundary only when it can produce trustworthy tenant-bound storage and scanner receipts; do not synthesize receipt evidence.
- [x] Define a current versioned institution-retention authority before enabling shared `course-materials` persistence.
- [ ] Keep upload/download routes and Import/Study Studio wiring closed until private bucket policy, scanner runtime and route authorization/rate-limit prerequisites exist.

## 2026-10-08 versioned course-material retention authority — automation pass 13, slice 21

- [x] Fetch and inspect `origin/main` before work and again at `845645d3`; confirm its newer Phase A documentation contains no equivalent course-material retention authority, controlled operation, migration collision or overlapping file.
- [x] Reuse the existing `tenant-policy` duty and approval state machine; do not create a parallel policy workflow or treat request prose as authority.
- [x] Add one private append-only tenant policy history with exact versions, active/withdrawn state, bounded retention days, approval/evidence references, actor, correlation and effective time.
- [x] Require `console:operate`, fresh MFA, an approved unexpired exact-tenant request, the `course-materials` target, a closed detail shape and requester/approver participation.
- [x] Append fail-closed console audit before policy/effect settlement; prove an audit failure rolls back policy history and approval execution.
- [x] Make withdrawal append a version and make the service-only current resolver return no row when authority is absent or withdrawn.
- [x] Keep anon, authenticated and service role off direct table access; allow only the controlled authenticated writer and service-only resolver.
- [x] Add the callable RPC to the deliberate grant allowlist, definer inventory, table classification and retention schedule.
- [x] Reconcile the Console guard to the existing twelve duties and use the audit chain's UTC day in seal assertions; retain all manifest/head/signature checks.
- [x] PostgreSQL 17 applies all 215 migrations twice with 374 table fingerprints unchanged; 16 focused checks and the adjacent Console, Course Studio, source, grant, RLS, index and legal-hold suites pass.
- [ ] HawkScan DAST — required for this production schema change but unavailable because the `hawk` executable is absent and `HAWK_API_KEY` is unset; no scan or security pass is claimed.
- [ ] Shared-material metadata, buckets/objects, scanner/extraction runtime, public routes, UI wiring, deployment and institutional operation remain unimplemented and unverified.

### Next implementation boundary

- [x] Add private shared `course-materials` metadata and controlled lifecycle operations that resolve the current policy authority and bind its exact id/version to an exact tenant/course/term plus current `course:publish` grant.
- [x] Preserve policy withdrawal as a gate on new intake while keeping already-bound material governed by its recorded version and legal-hold precedence.
- [ ] Keep storage receipts, scan settlement, extraction and signed reads closed until a trustworthy private runtime exists; do not reuse student ownership as faculty/institution authority.

## 2026-10-08 shared course-material metadata — automation pass 14, slice 22

- [x] Fetch and inspect `origin/main`; merge `845645d3` before production edits, then inspect final `de9ee702`, commit the non-overlapping slice and merge that upstream registration-readiness head on the clean tree.
- [x] Reuse the Course Studio `<tenant>/<COURSE>` authority key, `course:publish` capability and canonical term grammar; do not bind faculty material to a student's private `public.courses` row.
- [x] Add deny-by-default metadata for one exact tenant/course/term, internal object-key plan, bounded filename/type/size and exact retention-policy id/version/duration.
- [x] Require service role, a current exact course-scoped publisher grant and an expected policy id/version equal to the current active resolver result before new intake.
- [x] Add request-hash idempotent plan, withdrawal and restore operations with append-only receipts and pseudonymous content-free audit in the same transaction.
- [x] Prove policy withdrawal blocks new intake and restore while existing rows retain their original policy binding; prove a later active version permits restore without rebinding history.
- [x] Refuse direct client/service writes and physical deletion; leave a future retention purge responsible for elapsed policy duration and tenant/platform legal-hold precedence.
- [x] Update the table classification, retention schedule, course-source authority and integration controls.
- [x] PostgreSQL 17 applies all 216 migrations twice with 376 unchanged table fingerprints; 24 focused and 188 adjacent checks pass, including exact policy/grant, RLS/grant/index, legal-hold and student-source proof.
- [x] TypeScript, lint, university typecheck and production build pass; lint retains the existing four-warning baseline and build retains existing chunk warnings.
- [x] Focused repository contracts pass 167/167; token/tooling/style contracts pass 78/78; design audit has zero violations with the existing 86-warning ledger, CSS stays within its ledger and the report regenerates without drift.
- [x] After the final upstream merge, the registration-readiness test plus slice structural guards pass 68/68 and TypeScript plus the university gateway typecheck remain green on the combined head.
- [ ] Ordered and shuffled full suites — not rerun in this database-only slice. Prior runs remain non-green for the recorded runner-mounted `.semester-reference`, timeout and teardown conditions; no focused slice test fails.
- [ ] HawkScan DAST — required for this production schema change but unavailable because `hawk` is absent and `HAWK_API_KEY` is unset; no scan or security pass is claimed.
- [ ] Bucket/object provisioning, trusted storage/scanner receipts, extraction, signed reads, browser routes, UI wiring, deployment and institutional operation remain unimplemented and unverified.

### Next implementation boundary

- [x] Reconcile the next dependency-ready Course Engine slice against the absent private bucket/scanner runtime; add only private deny-by-default bucket definitions and do not synthesize storage or scan evidence.
- [ ] Keep Import/Study Studio server wiring closed until route authentication, rate limiting, private object policy and actual adapter evidence can satisfy the existing contract.
- [ ] Do not add a Course Engine route, parallel course model or client-readable shared-material table.

## 2026-10-08 private course-source buckets — automation pass 15, slice 23

- [x] Fetch and inspect `origin/main` before work; inspect final `aac5da38`, commit slice `be28289f`, then merge it on the clean tree. Preserve both course-source and intelligence non-event importer allowlists; 370/370 combined focused tests plus TypeScript, lint, university typecheck and build pass.
- [x] Reuse the existing private `trust-packet` bucket convention instead of creating a browser upload policy or parallel storage model.
- [x] Define `student-files` and `course-materials` as private, idempotently repaired buckets with the current 50 MiB / 100 MiB classification caps and exact five-type course-document allowlist.
- [x] Revoke the repair function from all runtime roles and add no anon/authenticated object policy.
- [x] Prove direct authenticated inserts fail and browser reads, updates and deletes expose or affect zero planted objects in both buckets.
- [x] Show the guard red by temporarily making one bucket public, then restore the implementation and pass the focused suite.
- [x] PostgreSQL 17 applies all 217 migrations twice with 376 unchanged table fingerprints; 12 focused and 117 adjacent checks pass, 129/129 total.
- [x] Focused repository contracts pass 85/85; TypeScript, lint, university typecheck and production build pass; token/design contracts pass 78/78, audit/CSS stay within their ledgers and the design report regenerates without drift.
- [ ] Aggregate `design-system:check` launcher — cannot start because it hardcodes unavailable `npm`; the exact token, audit, CSS and 78-test constituent commands pass under the bundled runtime.
- [ ] Ordered and shuffled full suites — not rerun for this database-only boundary; prior runner-mount/timeout/teardown caveats remain open and no focused slice test fails.
- [ ] HawkScan DAST — required for this production schema change; committed configs exist, but `hawk`, `HAWK_API_KEY` and `HAWK_APP_HOST` are absent, so no scan or security pass is claimed.
- [ ] Stored bytes, trusted storage/scanner receipts, extraction, signed reads, browser routes, UI wiring, deployment and production bucket state remain unimplemented or unverified.

### Next implementation boundary

- [ ] Add a repository adapter/private runtime only when it can create the planned tenant-bound object and produce genuine storage plus named-scanner receipts; do not synthesize either receipt.
- [ ] Keep browser upload/download routes and Import/Study Studio wiring closed until session-derived tenant authority, shared rate limiting, signed-object policy and scanner runtime are all available.
- [ ] Do not add client object policies, a Course Engine route, a parallel course model or a client-readable material table.

## 2026-10-08 student-controlled re-import date conflicts — automation pass 16, slice 24

- [x] Begin from merged `origin/main` `aac5da38`, then inspect final `27be630d`; confirm its Education OS governance/documentation update has no equivalent Import conflict-choice behavior or overlapping production/control file. Do not merge or rebase the dirty branch before the coherent slice commit.
- [x] Verify the repository still has no document-malware scanner, configured scanner provider, scanner credential or runtime; do not reuse the image-only community scanner or synthesize a receipt.
- [x] Reuse the current Import/Rediff course-replacement path; add no route, second course model, server authority or provider claim.
- [x] Treat every moved or disappearing deadline as an unresolved source conflict with no preselected winner.
- [x] Require one explicit “Keep current” or imported-syllabus choice per conflict before save; independently refuse incomplete decision maps in the merge helper.
- [x] Preserve current dates/reminders when chosen, preserve stable item/course ids and ticks, and include newly dropped imported dates in the live conflict set.
- [x] Use each item's actual year for cross-year moves rather than silently applying the displayed term year to both sides.
- [x] Cover radio groups with native fieldsets/legends, keyboard-operable controls, 44px targets, semantic tokens, narrow wrapping and a live unresolved-count message.
- [x] Prove the guard red by temporarily bypassing unresolved-conflict detection, observe the focused test fail, restore it and pass 67/67 focused logic/UI/design/responsive tests.
- [x] TypeScript, lint, university typecheck and production build pass; lint retains the existing four-warning baseline and the build retains existing chunk warnings.
- [x] Token export, design audit, CSS budget and 69/69 design-system contracts pass; audit retains zero violations and the existing 86-warning ledger.
- [x] Commit the coherent slice as `4c258362`, merge `origin/main` `27be630d` on the clean branch, and pass 72/72 combined focused Course Engine/document tests plus TypeScript, lint, university typecheck and production build.
- [ ] HawkScan DAST — required for this production UI change, but `hawk`, `HAWK_API_KEY` and `HAWK_APP_HOST` remain absent; no scan or security pass is claimed.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.

### Next implementation boundary

- [x] Extend explicit conflict choices to changed course metadata and grading rows so re-import never silently chooses those conflicting values either. Completed in automation pass 17 / slice 25.
- [ ] Keep server ingestion, signed reads and current-screen server wiring closed until a real document-malware scanner and private runtime can generate trustworthy receipts.
- [ ] Keep archive/provider/institution/deployment evidence separate; this local client merge behavior does not make imported dates official.

## 2026-10-08 student-controlled metadata and grading conflicts — automation pass 17, slice 25

- [x] Confirm current `origin/main` remains `27be630d`, is already merged and contains no equivalent metadata/grading conflict-choice work.
- [x] Reuse the existing Import/Rediff route, radio-control pattern and semantic form styles; add no route, shared component, dependency or parallel data model.
- [x] Require an unselected keep-current/use-imported choice for every changed course field, course-site URL, reweighted row, removed grading row and added grading row.
- [x] Keep the save action disabled while any current source conflict lacks a choice, and independently reject incomplete or invalid decision maps in the pure merge boundary.
- [x] Apply mixed decisions per field/row instead of making the whole imported or current grading table win.
- [x] Preserve the current term and student-recorded course AI policy because neither is controlled by syllabus extraction.
- [x] Cover stable conflict ids, no-default rendered radio groups, mixed merges, all-imported merges and local-control preservation.
- [x] Prove the regression guard red by temporarily bypassing unresolved-conflict detection, observe the named five-decision test fail, restore the guard and pass the focused suites.
- [x] Directly changed tests pass 31/31; broader course/import/document contracts pass 60/60.
- [x] TypeScript, lint, university typecheck and production build pass; lint retains the existing four-warning baseline and the build retains existing chunk warnings.
- [x] Token export passes 9/9; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; design/style contracts pass 138/138 and the report regenerates without drift.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because `hawk` is absent; `HAWK_API_KEY` and `HAWK_APP_HOST` are unset for a headless scan. No scan or security pass is claimed.

### Next implementation boundary

- [x] Extend the same explicit review to reworded deadline titles before re-import replaces student-visible task wording; retain stable ids and the existing date-choice behavior. Completed in automation pass 18 / slice 26.
- [ ] Keep server-authoritative conflict records, external reconciliation and safe ICS publication separate from this local client merge slice.
- [ ] Keep server ingestion and signed reads closed until a trustworthy private adapter/scanner runtime can produce genuine receipts.

## 2026-10-08 student-controlled deadline-title conflicts — automation pass 18, slice 26

- [x] Fetch and merge current `origin/main` `4a01b4a0` on the clean branch before work; confirm its separate Course Engine shell contains no equivalent Import/Rediff title-conflict behavior.
- [x] Reuse the existing Import/Rediff route, native fieldset/radio pattern and semantic form styles; add no route, component, dependency, schema or parallel course model.
- [x] Treat every confidently paired reworded deadline title as an unresolved source conflict, including items whose date also changed.
- [x] Use a stable `title:<current-item-id>` decision key with no preselected winner and independently reject incomplete or invalid maps in the pure merge boundary.
- [x] Apply title and date choices independently while preserving the current item id and its completion-tick relationship.
- [x] Update the live conflict guidance and render each title comparison in a keyboard-operable, 44px-target native radio group with existing semantic wrapping and narrow-layout behavior.
- [x] Prove the guard red by temporarily removing title conflicts, observe the named stable-id expectation fail, restore it and pass 35/35 directly changed logic/UI tests.
- [x] Broader focused Import contracts pass 39/39; TypeScript, lint, university typecheck and production build pass with existing warning baselines.
- [x] Token export passes 9/9; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; design contracts pass 69/69.
- [ ] Aggregate design report pass — the report file regenerates, but the wrapper exits 1 because it invokes unavailable `npm`; constituent checks above are green.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because `hawk` is absent. A local credential file exists but cannot be validated without the CLI, and no scan target was started; no DAST result or security pass is claimed.

### Next implementation boundary

- [x] Extend fail-closed item review to changed due times so re-import cannot silently move a reminder within the same day; keep title and date decisions independent. Completed in automation pass 19 / slice 27.
- [ ] Keep lower-consequence extracted item metadata, durable server conflicts, external reconciliation and safe ICS publication separate until each has a named authority and acceptance contract.
- [ ] Keep server ingestion and signed reads closed until a trustworthy private adapter/scanner runtime can produce genuine receipts.

## 2026-10-08 student-controlled deadline-time conflicts — automation pass 19, slice 27

- [x] Fetch current `origin/main` `4a01b4a0` and confirm no equivalent current-product Import/Rediff due-time choice landed.
- [x] Reuse the existing Import/Rediff route, native fieldset/radio pattern and semantic form styles; add no route, component, dependency, schema, raw design value or parallel course model.
- [x] Treat every changed due time on a confidently paired deadline as an unresolved source conflict, including an item whose title and calendar date also changed.
- [x] Use a stable `time:<current-item-id>` decision key with no preselected winner and reject incomplete or invalid maps in the pure merge boundary.
- [x] Apply due-time, title and calendar-date choices independently while preserving the current item id and completion-tick relationship.
- [x] Correct the date-choice merge so keeping the current date cannot implicitly keep the current time against an explicit use-imported-time choice.
- [x] Render the comparison in the existing keyboard-operable native radio group and extend the live conflict guidance to name due time.
- [x] Prove the guard red before implementation: three named failures showed the missing stable decision, absent control and ineffective keep-current merge.
- [x] Directly changed logic/render tests pass 38/38; the broader focused Import/course set passes 109/109.
- [x] TypeScript, lint, university typecheck and production build pass with the existing four lint and chunk warnings.
- [x] Token export passes 9/9; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; design contracts pass 69/69; the design report regenerates without drift.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because `hawk` is absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. No live target was started and no DAST result or security pass is claimed.

### Next implementation boundary

- [x] Reconcile the paired deadline category (`kind`) to the student-approved current copy versus newly extracted syllabus source, and require an explicit stable-id choice. Completed in automation pass 20 / slice 28.
- [ ] Reconcile the remaining paired-item fields (`weight`, `where`, `detail`, quote and source provenance) to named ownership and acceptance behavior before adding further conflict choices.
- [ ] Keep durable server conflict records, external reconciliation and safe ICS publication separate from this local client merge slice.
- [ ] Keep server ingestion and signed reads closed until a trustworthy private adapter/scanner runtime can produce genuine receipts.

## 2026-10-08 student-controlled deadline-type conflicts — automation pass 20, slice 28

- [x] Fetch current `origin/main` `4a01b4a0` and confirm no equivalent current-product Import/Rediff deadline-type choice landed.
- [x] Name the student-approved current course copy as the authority until the student explicitly accepts the newly extracted syllabus category.
- [x] Reuse the existing Import/Rediff route, native fieldset/radio pattern and semantic form styles; add no route, component, dependency, schema, raw design value or parallel course model.
- [x] Treat every changed kind on a confidently paired deadline as an unresolved source conflict and stop counting it as unchanged.
- [x] Use a stable `kind:<current-item-id>` decision key with no preselected winner and reject incomplete or invalid maps in the pure merge boundary.
- [x] Apply the kind choice independently from date, title and due time while preserving the current item id and completion-tick relationship.
- [x] Render the comparison in the existing keyboard-operable native radio group and extend the live conflict guidance to name deadline type.
- [x] Prove the guard red before implementation: three focused failures showed the absent stable decision, missing control and ineffective keep-current merge.
- [x] Directly changed logic/render tests pass 41/41; the broader focused Import/course set passes 178/178.
- [x] TypeScript, lint, university typecheck and production build pass with the existing four lint and chunk warnings.
- [x] The 78 token/design constituents pass; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; the design report regenerates without drift.
- [ ] Aggregate design report wrapper — writes the unchanged report, then exits 1 because it invokes unavailable `npm`; constituent checks are green and no wrapper pass is claimed.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because `hawk`, `HAWK_API_KEY`, `HAWK_APP_HOST` and Docker are absent. No live target was started and no DAST result or security pass is claimed.

### Next implementation boundary

- [x] Reconcile paired deadline `weight` to named ownership and acceptance behavior before implementing a conflict choice; do not conflate it with course-level grading rows. Completed in automation pass 21 / slice 29.
- [ ] Keep location/detail and quote/source provenance separate until each has an explicit authority and integrity contract.
- [ ] Keep durable server conflict records, external reconciliation, safe ICS publication, server ingestion and signed reads outside this local client merge slice.

## 2026-10-08 student-controlled deadline-weight conflicts — automation pass 21, slice 29

- [x] Fetch current `origin/main` `4a01b4a0`, confirm it is already an ancestor and find no equivalent paired-deadline weight choice.
- [x] Name the student-approved current item weight as the authority until the student explicitly accepts newly extracted syllabus text; keep this deadline-level value separate from course-level grading rows.
- [x] Reuse the existing Import/Rediff route, native fieldset/radio pattern and semantic form styles; add no route, component, dependency, schema, raw design value or parallel course model.
- [x] Treat every changed weight on a confidently paired deadline as an unresolved source conflict and stop counting it as unchanged.
- [x] Use a stable `weight:<current-item-id>` decision key, separate from `grading:*`, with no preselected winner; reject incomplete or invalid maps in the pure merge boundary.
- [x] Apply the weight choice independently from date, title, due time, kind and grading while preserving the current item id and completion-tick relationship.
- [x] Render the comparison in the existing keyboard-operable native radio group and extend live conflict guidance to name deadline weight.
- [x] Prove the guard red before implementation: three focused failures showed the absent stable decision, missing control and ineffective keep-current merge while 41 controls passed.
- [x] Directly changed logic/render tests pass 44/44; the broader focused Import boundary passes 99/99.
- [x] TypeScript, lint, university typecheck and production build pass with the existing four lint and chunk warnings.
- [x] The 78 token/design constituents pass; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; the design report regenerates without drift.
- [ ] Aggregate design report wrapper — writes the unchanged report, then exits 1 because it invokes unavailable `npm`; constituent checks are green and no wrapper pass is claimed.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because `hawk`, Docker and `HAWK_APP_HOST` are absent. A local credential file exists but was not read; no DAST result or security pass is claimed.

### Next implementation boundary

- [x] Reconcile paired deadline `where` to named ownership and acceptance behavior before implementing a conflict choice; keep location changes independent from deadline weight and course room metadata. Completed in automation pass 22 / slice 30.
- [ ] Keep free-form detail and quote/source provenance separate until each has an explicit authority and integrity contract.
- [ ] Keep durable server conflict records, external reconciliation, safe ICS publication, server ingestion and signed reads outside this local client merge slice.

## 2026-10-08 student-controlled deadline-location conflicts — automation pass 22, slice 30

- [x] Fetch current `origin/main` `4a01b4a0`, confirm it is already an ancestor and find no equivalent paired-deadline location choice.
- [x] Name the student-approved current item location as the authority until the student explicitly accepts newly extracted syllabus text; keep this deadline value separate from course room metadata.
- [x] Reuse the existing Import/Rediff route, native fieldset/radio pattern and semantic form styles; add no route, component, dependency, schema, raw design value or parallel course model.
- [x] Treat every changed location on a confidently paired deadline as an unresolved source conflict and stop counting it as unchanged.
- [x] Use a stable `where:<current-item-id>` decision key with no preselected winner; reject incomplete or invalid maps in the pure merge boundary.
- [x] Apply the location choice independently from date, title, due time, type, weight and course metadata while preserving the current item id and completion-tick relationship.
- [x] Render the comparison in the existing keyboard-operable native radio group and extend live conflict guidance to name deadline location.
- [x] Prove the guard red before implementation: three focused failures showed the absent stable decision, missing control and ineffective keep-current merge while 44 controls passed.
- [x] Directly changed logic/render tests pass 47/47; the broader focused Import/course/document boundary passes 221/221.
- [x] TypeScript, lint, university typecheck and production build pass with the existing four lint and chunk warnings.
- [x] The 78 token/design constituents pass; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; the design report regenerates without drift.
- [ ] Aggregate `design-system:check` launcher — not run because it requires unavailable `npm`; the exact constituent commands above are green.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because `hawk`, Docker and `HAWK_APP_HOST` are absent. A local credential file exists but was not read; no DAST result or security pass is claimed.

### Next implementation boundary

- [x] Reconcile paired deadline free-form `detail` to named ownership and acceptance behavior before implementing a conflict choice; keep it independent from source quotes and provenance. Completed in automation pass 23 / slice 31.
- [x] Keep quote/source provenance separate until its integrity and checked-citation behavior have an explicit acceptance contract. Completed atomically in automation pass 24 / slice 32.
- [ ] Keep durable server conflict records, external reconciliation, safe ICS publication, server ingestion and signed reads outside this local client merge slice.

## 2026-10-08 student-controlled deadline-detail conflicts — automation pass 23, slice 31

- [x] Fetch current `origin/main` `4a01b4a0`, confirm it is already an ancestor and find no equivalent paired-deadline detail choice.
- [x] Name the student-approved current item detail as the authority until the student explicitly accepts newly extracted syllabus text; keep it separate from verbatim quotes, checked citation locators and source labels.
- [x] Reuse the existing Import/Rediff route, native fieldset/radio pattern and semantic form styles; add no route, component, dependency, schema, raw design value or parallel course model.
- [x] Treat every changed detail on a confidently paired deadline as an unresolved source conflict and stop counting it as unchanged.
- [x] Use a stable `detail:<current-item-id>` decision key with no preselected winner; reject incomplete or invalid maps in the pure merge boundary.
- [x] Apply the detail choice independently from date, title, due time, type, weight, location and course metadata while preserving the current item id and completion-tick relationship.
- [x] Render the comparison in the existing keyboard-operable native radio group and extend live conflict guidance to name deadline detail.
- [x] Prove the guard red before implementation: three focused failures showed the absent stable decision, missing control and ineffective keep-current merge while 47 controls passed.
- [x] Directly changed logic/render tests pass 50/50; the broader focused Import/document/source boundary passes 153/153.
- [x] TypeScript, lint, university typecheck and production build pass with the existing four lint and chunk warnings.
- [x] The 78 token/design constituents pass; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; the design report regenerates without drift.
- [ ] Aggregate design report wrapper — writes the unchanged report, then exits 1 because it invokes unavailable `npm`; constituent checks are green and no wrapper pass is claimed.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because the Hawk CLI v6+, Docker, `HAWK_API_KEY` and `HAWK_APP_HOST` are absent. A local credential file exists but was not read; no DAST result or security pass is claimed.

### Next implementation boundary

- [x] Reconcile the paired deadline provenance bundle (`quote`, `checked` locator and `source`) to an integrity-preserving acceptance contract before offering any source choice. Completed in automation pass 24 / slice 32.
- [ ] Keep durable server conflict records, external reconciliation, safe ICS publication, server ingestion and signed reads outside this local client merge slice.

## 2026-10-08 student-controlled deadline-provenance conflicts — automation pass 24, slice 32

- [x] Fetch current `origin/main` `4a01b4a0`, confirm it is already an ancestor and find no equivalent paired-deadline provenance choice.
- [x] Define `quote`, `checked` confirmation/document/page locator and `source` as one atomic evidence bundle; never combine fields from different syllabus versions.
- [x] Treat a change to any bundle field, including a locator-only change, as an unresolved conflict and stop counting the item as unchanged.
- [x] Use a stable `provenance:<current-item-id>` decision key with no preselected winner; reject incomplete or invalid maps in the pure merge boundary.
- [x] Restore or accept the whole bundle together, including removing an imported locator when the selected current bundle had none, while preserving the current item id and completion-tick relationship.
- [x] Reuse the existing Import/Rediff route and keyboard-operable native fieldset/radio pattern; show quotation, named document/source and page where present without adding a route, component, schema, dependency or raw design value.
- [x] Prove the guard red before implementation: four failures showed the absent stable decision, missing control, ineffective keep-current restoration and silent locator replacement while 50 controls passed.
- [x] Directly changed logic/render tests pass 54/54; the broader focused Import/source boundary passes 176/176.
- [x] TypeScript, lint, university typecheck and production build pass with the existing four lint and chunk warnings.
- [x] The 78 token/design constituents pass; design audit has zero violations with 86 existing warnings; CSS remains within its ledger; the design report regenerates without drift.
- [ ] Aggregate design report wrapper — writes the unchanged report, then exits 1 because it invokes unavailable `npm`; constituent checks are green and no wrapper pass is claimed.
- [ ] Ordered and shuffled full suites — not run for this bounded client slice; focused regression and phase gates are green.
- [ ] HawkScan DAST — preflight stops because the required Hawk CLI v6+, Docker fallback and `HAWK_APP_HOST` are absent. A local credential file exists but was not read; no DAST result or security pass is claimed.

### Next implementation boundary

- [x] Reconcile durable re-import conflict records to the current tenant, authorization, audit, idempotency and recovery contracts before moving this local decision map server-side. Completed in automation pass 25 / slice 33.
- [ ] Keep external reconciliation and safe ICS publication separate until each has a named authority and acceptance contract.
- [ ] Keep server ingestion and signed reads closed until a trustworthy private adapter/scanner runtime can produce genuine receipts.

## 2026-10-08 durable re-import conflict evidence — automation pass 25, slice 33

- [x] Begin from merged `origin/main` `4a01b4a0`; final-fetch and merge `0d8f70b2`, confirm its registration-readiness workflow has no overlapping course-source/migration/control file or equivalent ledger, and reconcile the combined 65-type generated event catalog.
- [x] Bind one resolution batch to two distinct available/hash-settled sources, both derived snapshot hashes, the owner, active membership, tenant, local course record, course code and term.
- [x] Store only 1–256 validated stable conflict keys and explicit keep-current/use-imported choices; keep compared values, quotations and extracted text out of the ledger and audit event.
- [x] Deny browser table/function access and require the service-only functions to revalidate the current student relationship independently.
- [x] Make recording and withdrawal idempotent, atomic and audit-bound; preserve choice rows append-only and represent recovery as a voided batch rather than erased evidence.
- [x] Return the current voided state when the original recording idempotency key is replayed after withdrawal.
- [x] Prove audit failure rolls back the batch, choices and operation receipt; prove cross-tenant/course refusal, invalid-key/choice refusal, direct-mutation refusal, relationship revocation and idempotent replay.
- [x] Add retention, classification, covering-index and account-erasure evidence for the two new private tables.
- [x] Apply all 218 migrations twice on PostgreSQL 17 with 378 unchanged table fingerprints; pass 24 focused and 179 adjacent checks, 203/203 total.
- [x] Pass 64/64 focused repository guards, TypeScript, lint, university typecheck and production build; lint retains four existing warnings.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks and 69/69 design contracts.
- [x] On the merged head, pass 118 generated-reference/control tests, all six readiness-workflow tests, TypeScript, university typecheck and the production build.
- [ ] Ordered and shuffled full application suites — not run for this database-only slice; focused, adjacent security and phase gates are green.
- [ ] HawkScan DAST — unavailable because the Hawk CLI, Docker fallback, `HAWK_API_KEY` and `HAWK_APP_HOST` are absent; no scan or security pass is claimed.

### Next implementation boundary

- [x] Define an atomic server-side apply command that consumes only an active resolution batch, rechecks source/snapshot hashes and current relationship, preserves course/item ids and completion state, and has an audited idempotent rollback path. Completed in pass 26 / slice 34 below.
- [ ] Do not wire Import to the service until the command and a private server adapter exist; the current save remains local-only.
- [ ] Keep external reconciliation, safe ICS publication, trustworthy ingestion/scanning and signed reads separate.

## 2026-10-09 atomic re-import application and recovery — automation pass 26, slice 34

- [x] Fetch `origin/main` `0d8f70b2` and confirm its registration-readiness changes contain no equivalent course-source apply/rollback command, recovery table or check.
- [x] Consume only an active resolution batch; lock and recheck the owner, active membership, exact tenant/course relationship and both available source bindings.
- [x] Recompute canonical current/imported course-document hashes and refuse either stale snapshot before mutation.
- [x] Derive the replacement in the database from append-only choices; do not accept a caller-supplied resolved document.
- [x] Require normalized stable course/item ids, preserve current ids and refuse any current-item removal without an explicit use-imported removal choice.
- [x] Apply independent date, title, type, weight, location, detail, provenance, course-field and grading choices cumulatively.
- [x] Update the existing `public.courses` row atomically with application evidence, batch state, content-free audit and idempotency receipt; leave `public.state` completion ticks untouched.
- [x] Keep a private service-only 30-day recovery copy; rollback only when the exact applied hash is still current, then restore the prior document and clear its copy.
- [x] Make apply and rollback idempotent and fail closed after relationship revocation, a later course edit, an expired window or an audit append failure.
- [x] Add the application table to classification and retention controls without claiming automatic recovery-copy expiry.
- [x] Prove and fix cumulative-choice behavior: the first focused run exposed date/provenance choices being overwritten by a later title choice; the corrected 17-check PostgreSQL 17 suite passes and an apply replay reports a later rollback honestly.
- [x] Apply all 219 migrations twice on PostgreSQL 17 with 379 unchanged table fingerprints; pass 309/309 focused and adjacent course-source, grants, RLS, index, hold, deletion and recovery checks.
- [x] Pass 64/64 classification, retention, definer and design-tooling guards; TypeScript, lint, university typecheck and the production build pass with four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks and 69/69 design contracts. The design report file regenerates unchanged, but its wrapper exits 1 because it invokes unavailable `npm`; no aggregate report pass is claimed.
- [ ] Ordered and shuffled full application suites — not run for this database-only slice; focused, adjacent security and phase gates are green.
- [ ] HawkScan DAST — required for this production schema change, but the Hawk CLI, Docker fallback, `HAWK_API_KEY` and `HAWK_APP_HOST` are unavailable. No scan or security pass is claimed.

### Next implementation boundary

- [ ] Add the private server adapter only when session-derived actor/tenant authority, shared rate limiting and trustworthy canonical snapshot creation can call the service-only record/apply contracts without exposing `service_role`.
- [ ] Do not wire Import or call the workflow server-backed until that adapter, deployment and operating evidence exist.
- [x] Add a hold-aware expiry operation before claiming the 30-day recovery copy is physically scrubbed after its deadline. Completed locally in automation pass 27 / slice 35 below; no schedule, deployment or production run is claimed.
- [ ] Keep external reconciliation, safe ICS publication, trustworthy ingestion/scanning and signed reads separate.

## 2026-10-09 hold-aware re-import recovery expiry — automation pass 27, slice 35

- [x] Fetch `origin/main` `0d8f70b2` and confirm its registration-readiness changes contain no equivalent course-source recovery expiry operation or guard.
- [x] Prove the new guard red against the absent operation before implementation.
- [x] Clear only the exact prior course document after the 30-day rollback deadline; retain the application row, hashes, tenant/owner binding and resolution batch as bounded evidence.
- [x] Add an explicit `expired` state and timestamp so a scrubbed copy cannot be mistaken for an applied or rolled-back recovery.
- [x] Serialize against legal-hold placement/release; visibly skip on a platform hold and preserve rows covered by exact tenant or account holds.
- [x] Keep the operation private, service-only, manually invoked and idempotent; preserve browser refusal and direct table-mutation revocation.
- [x] Apply all 220 migrations twice on PostgreSQL 17 with 379 unchanged table fingerprints; pass 9 focused and 135 adjacent apply, hold, grant, RLS, index and definer checks.
- [x] Pass 127/127 retention, scheduler, classification, privacy, migration, definer and design-tooling guards; TypeScript, lint, university typecheck and production build pass with four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks and 69/69 design contracts. The design report file regenerates unchanged, but its wrapper exits 1 because it invokes unavailable `npm`; no aggregate report pass is claimed.
- [ ] Ordered and shuffled full application suites — not yet run for this database-only slice.
- [ ] HawkScan DAST — preflight stopped because `hawk` v6+, Docker, `HAWK_API_KEY` and `HAWK_APP_HOST` are unavailable. A local properties file exists but was not read; no scan or security pass is claimed.

### Next implementation boundary

- [ ] Add the private server adapter only when session-derived actor/tenant authority, shared rate limiting and a real private scanner/extractor can create the hash-only receipt and call the service-only record/apply contracts without exposing `service_role`.
- [ ] Do not wire Import or call the workflow server-backed until that adapter, deployment and operating evidence exist.
- [ ] Keep external reconciliation, safe ICS publication, trustworthy ingestion/scanning and signed reads separate.

## 2026-10-09 hash-only derived-snapshot authority — automation pass 28, slice 36

- [x] Fetch `origin/main` `0d8f70b2` and confirm no equivalent derived-snapshot receipt, conflict precondition or migration collision landed.
- [x] Add one append-only, tenant/owner/source-bound receipt containing only the exact scanned source hash, derived snapshot hash, revision and bounded named extractor version; store no extracted text or course document.
- [x] Require service role, an available hash-settled source and a current exact tenant/course relationship before recording a receipt; deny browser table/function access and direct service-role table mutation.
- [x] Make receipt creation request-hash idempotent and atomic with pseudonymous content-free audit and bounded operation evidence.
- [x] Make conflict recording refuse an imported snapshot hash unless it has a receipt for the exact imported source, tenant, owner and current source hash.
- [x] Cover the new table in the tenant-scoped classification and retention authorities and add the exact foreign-key covering index.
- [x] Correct the focused fixture to satisfy the existing storage-receipt constraint instead of weakening that contract.
- [x] Apply all 221 migrations twice on PostgreSQL 17 with 380 unchanged table fingerprints; pass 17 focused and 215 adjacent SQL checks.
- [x] Pass 72/72 classification, retention, design-tooling, inventory and course-source contract guards.
- [x] Pass TypeScript, lint, university typecheck and production build with four existing lint warnings and the existing chunk-size warning; pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 69/69 design contracts and design-report generation.
- [ ] Ordered and shuffled full application suites — not run for this database-only slice; focused, adjacent security and phase gates are green.
- [ ] HawkScan DAST — preflight stops because the Hawk CLI v6+, Docker fallback and `HAWK_APP_HOST` are absent. A local credential file exists but was not read; no scan or security pass is claimed.

### Next implementation boundary

- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and derived-snapshot receipts under session-derived authority and shared rate limits.
- [ ] Keep external reconciliation, safe ICS publication, signed reads, scheduling, deployment and production operation separate.

## 2026-10-09 confirmed-correction propagation — automation pass 29, slice 37

- [x] Fetch `origin/main` `0d8f70b2` and confirm no equivalent correction-bound derived-snapshot receipt or migration collision landed.
- [x] Prove the guard red: the prior conflict function accepted a snapshot receipt created before a later student-confirmed correction.
- [x] Bind each new receipt to a deterministic count and SHA-256 of the append-only correction chain while the source row is locked.
- [x] Recompute the correction state under the locked source pair and refuse legacy or stale receipts before recording a conflict batch.
- [x] Preserve legacy receipts as append-only evidence instead of backfilling them with a correction state they may not have incorporated.
- [x] Store no corrected value or extracted content in the receipt; keep browser policy, table grants and direct-mutation refusal unchanged.
- [x] Apply all 222 migrations twice on PostgreSQL 17 with 380 unchanged table fingerprints; the focused suite passes 20 checks and every relevant course-source, grant, RLS, index, definer, retention, deletion and hold suite is green.
- [x] Pass 113/113 focused repository guards, TypeScript, lint, university typecheck and production build; lint retains four existing warnings and build retains its chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 138/138 design contracts and design-report generation.
- [ ] The aggregate SQL run retains two unrelated failures in `financial-retention.check.sql` and `ledger-seals.check.sql`; no full SQL-suite pass is claimed.
- [ ] Ordered and shuffled full application suites — not run for this database-only slice.
- [ ] HawkScan DAST — preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; no scan or security pass is claimed.

### Next implementation boundary

- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

- [ ] Keep external reconciliation, safe ICS publication, signed reads, scheduling, deployment and production operation separate.

## 2026-10-09 full-suite reconciliation — automation pass 30, slice 38

- [x] Fetch `origin/main` `0d8f70b2` and confirm no newer equivalent work or migration collision landed.
- [x] Run the complete ordered suite and classify all five initial failures: one runner-mount map mismatch, two stale generated registers, one stale support label and one reserved migration-filename collision affecting both new files.
- [x] Ignore `.semester-reference/` explicitly as an untrusted runner mount instead of adding it to the repository map.
- [x] Rename both migration files without changing their versions or SQL, refresh every exact documentation reference and pass the snapshot-location guard.
- [x] Align the support article with the current `Reworded` interface label and regenerate the role-launch and control-facts authorities.
- [x] Pass the five directly affected guard files, 246/246 tests.
- [x] Apply all 222 migrations twice on PostgreSQL 17 with 380 unchanged table fingerprints and pass the 20-check derivation-receipt suite.
- [x] Pass the complete ordered suite: 1,490 files and 23,872 tests passed; one file and 69 tests skipped.
- [x] Pass the complete shuffled suite at seed `1791526111475` with the same 1,490-file / 23,872-test result.
- [x] Pass TypeScript, lint, university typecheck, production build, 147 design contracts, design audit/CSS and design-report generation with existing warning ledgers.
- [ ] HawkScan DAST — preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; a local properties file exists but was not read. No scan or security pass is claimed.

### Next implementation boundary

- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.
- [ ] Keep external reconciliation, safe ICS publication, signed reads, scheduling, deployment and production operation separate.

## 2026-10-09 governed AI Toolkit deletion previews — automation pass 31, slice 39

- [x] Fetch current `origin/main` `0d8f70b2` before and after the slice and confirm no equivalent Toolkit consequence-preview work landed.
- [x] Select the independent Phase 1 consequence-pattern gap while the authenticated scanner/extractor adapter remains externally gated.
- [x] Replace native browser confirms for assignment-workspace, research-project and dataset deletion with the existing `ConfirmDialog` plus `ActionPreview` contract.
- [x] State the exact device-local records removed, what external assignment/source/file stays unchanged and that the deletion cannot be undone.
- [x] Preserve explicit confirmation, safe cancel-first modal behavior and device-local persistence; add no route, shared component, dependency, schema, server operation or provider claim.
- [x] Add a structural recurrence guard for all three panels and prove it red with a temporary `window.confirm` probe before restoring the implementation.
- [x] Pass 31/31 focused Toolkit/ActionPreview tests, TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 69/69 design contracts and design-report generation.
- [ ] Aggregate `design-system:check` launcher — cannot start because it hardcodes unavailable `npm`; its exact constituents pass.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this slice.
- [ ] HawkScan DAST — required for this production UI change, but preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; a local properties file exists but was not read. No scan or security pass is claimed.

### Next implementation boundary

- [ ] Apply the governed consequence preview to the device-only feedback deletion as the next bounded safe candidate after a fresh mainline check.
- [ ] Keep permanent file purge separate until its trash, retention and recovery semantics are reconciled; do not imply that all irreversible actions are covered.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed feedback deletion preview — automation pass 32, slice 40

- [x] Fetch current `origin/main` `0d8f70b2` and confirm no equivalent feedback-deletion consequence preview landed.
- [x] Reuse `ConfirmDialog` and `ActionPreview` in the existing Feedback inbox; add no route, shared component, dependency, schema or server operation.
- [x] Name the exact filed-feedback fields removed, the returned work plus existing plan actions/evidence that remain and the lack of recovery.
- [x] Preserve device-only storage, safe cancel and an explicit-confirmation-only write; report successful deletion without fabricating any server or institutional effect.
- [x] Demonstrate the focused guard red by temporarily suppressing this exact dialog, restore it and pass 31/31 focused Feedback inbox, Learning hub, study-hierarchy and ActionPreview tests.
- [x] Pass TypeScript, all lint constituents, university typecheck and production build with the existing four lint warnings and chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 69/69 design contracts and design-report generation.
- [ ] Aggregate `design-system:check` / report launcher — cannot complete because it invokes unavailable `npm`; the exact constituents pass and the report regenerates before the wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this slice.
- [ ] HawkScan DAST — preflight confirms Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset; a local properties file exists but was not read. No scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining consequence-pattern gaps against current repository authority and select only a bounded action whose payload, external effects and recovery semantics are already explicit.
- [ ] Keep permanent file purge separate until its trash, retention and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed conversation deletion preview — automation pass 33, slice 41

- [x] Fetch current `origin/main` `0d8f70b2`, confirm it is the branch merge-base and find no equivalent Trust Center conversation-preview change.
- [x] Select the device-only assistant-conversation deletion after re-ranking remaining consequence paths; keep server revocations, synced facts and permanent file purge separate.
- [x] Reuse the existing `ConfirmDialog` and `ActionPreview`; name the current conversation/message count, live-plus-archive local payload, profile/notes/plans that remain and the lack of recovery.
- [x] Preserve `clearConversations()`, content-free journaling, safe cancel-first behavior and the device-only storage boundary; add no route, shared component, dependency, schema or server operation.
- [x] Prove the focused regression red on the missing `.action-preview`, then pass 16/16 Trust Center and ActionPreview tests.
- [x] Pass TypeScript, lint, university typecheck and production build with the existing four lint warnings and chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks and 69/69 design contracts.
- [ ] Aggregate design report wrapper — writes the unchanged report, then exits 1 because it invokes unavailable `npm`; no aggregate launcher pass is claimed.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this slice.
- [ ] HawkScan DAST — the active skill stops at preflight because `hawk` v6 and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining consequence-pattern gaps and choose only a bounded action with explicit ownership, external effects and recovery.
- [ ] Keep permanent file purge separate until its trash, retention and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed Student Operating workspace deletion — automation pass 34, slice 42

- [x] Fetch current `origin/main` `0d8f70b2`, confirm it is already merged and find no equivalent Student Operating deletion-preview work.
- [x] Select the whole Student Operating workspace deletion after re-ranking; keep permanent file purge, server revocations and scanner-backed Import wiring separate.
- [x] Replace the hand-written inline question with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema or server operation.
- [x] Name the current workflow-item count, saved preferences, unsaved editor/review/handoff-draft state and account-sync behavior; separately preserve downloaded exports, imported calendar entries and official records.
- [x] State that deletion cannot be undone and direct the student to export a backup first when recovery is needed.
- [x] Preserve the existing state mutation and editor reset, safe cancel-first modal behavior and explicit-confirmation-only write.
- [x] Prove the guard red against the old inline confirmation, then pass 23/23 Student Operating, ActionPreview and modal tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks and 69/69 design contracts.
- [ ] Aggregate `design-system:check` and report launchers — both invoke unavailable `npm`; exact constituents pass and the report regenerates before its wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this slice.
- [ ] HawkScan DAST — preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining consequence-pattern gaps and choose only a bounded action with explicit ownership, external effects and recovery.
- [ ] Keep permanent file purge separate until its trash, retention and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed operating-rhythm deletion previews — automation pass 35, slice 43

- [x] Fetch current `origin/main` `0d8f70b2` and confirm no equivalent daily/weekly operating-rhythm deletion-preview work landed.
- [x] Select only the existing single-plan and whole-rhythm device-library deletions; keep permanent file purge, server revocations and scanner-backed Import wiring separate.
- [x] Replace both hand-written inline questions with the shared `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema or server operation.
- [x] Name the selected plan date or current plan count, private plan fields and working preferences removed, the other plans/rhythm kind and exported/official records that stay, and recovery only from a previously exported private backup.
- [x] Preserve the existing account/term/rhythm-scoped library updates and explicit-confirmation-only mutation; verify cancel leaves storage unchanged.
- [x] Prove the focused guard red against the old inline questions, then pass 17/17 Operating Rhythm and ActionPreview tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks and 69/69 design contracts.
- [ ] Aggregate design report wrapper — regenerates the report, then exits after invoking unavailable `npm`; no aggregate report pass is claimed.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this slice.
- [ ] HawkScan DAST — preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; the local properties file was not read, and no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining consequence-pattern gaps and choose only a bounded action with explicit ownership, external effects and recovery.
- [ ] Keep permanent file purge separate until its trash, retention and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed Today daily-plan deletion preview — automation pass 36, slice 44

- [x] Fetch current `origin/main` `0d8f70b2`, confirm it is already merged into the clean branch and find no equivalent Today daily-plan deletion-preview work.
- [x] Re-rank the remaining consequence paths and select only the reachable legacy Today daily-plan deletion: one account-scoped device record with existing per-plan export and workspace-backup recovery.
- [x] Replace the hand-written inline question with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema or server operation.
- [x] Name the selected date and private outcome, Daily Three, fallback, support, check-in, reflection and support-audit fields removed; preserve other account plans, downloads, backups and official course/calendar records.
- [x] State that recovery requires an export or device workspace backup created before deletion; preserve safe cancel-first focus and explicit-confirmation-only device-library mutation.
- [x] Prove the focused guard red against the old inline question, then pass 25/25 related Daily Rhythm, Operating Rhythm, backup, modal and accessibility tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 78/78 token/design contract tests, design audit with zero violations and 86 existing warnings, and CSS ledger checks.
- [ ] Aggregate design report wrapper — regenerates the report, then exits after invoking unavailable `npm`; no aggregate report pass is claimed.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this bounded client slice.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining consequence-pattern gaps and choose only a bounded action with explicit ownership, external effects and recovery.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed Applications-tracker deletion preview — automation pass 37, slice 45

- [x] Fetch current `origin/main` `0d8f70b2` and confirm no equivalent Applications-tracker deletion preview landed.
- [x] Re-rank the remaining consequence paths and select only one student-owned device-local application record; keep external applications, permanent file purge and the demo reset separate.
- [x] Replace immediate deletion with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema or server operation.
- [x] Name the application and its organisation, role, posting link, deadline, stage history, next action, dates, location and private note; preserve other applications, exports, backups and employer/careers-system state.
- [x] State that recovery requires an earlier device workspace backup or export; verify cancel preserves persistence and explicit confirmation removes only the selected local record.
- [x] Prove the focused guard red against the absent preview, then pass 26/26 Applications deletion, dead-end and ActionPreview tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 69/69 design contracts and design-report generation.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this bounded client slice.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining consequence-pattern gaps and choose only a bounded action with explicit ownership, external effects and recovery.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed Community-post deletion preview — automation pass 38, slice 46

- [x] Fetch current `origin/main` `0d8f70b2` and confirm no equivalent governed Community-post deletion preview landed.
- [x] Re-rank the remaining consequence paths and select the existing owner-checked authenticated post deletion; keep permanent file purge and the same-origin demo reset separate.
- [x] Replace the immediate client RPC with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema, policy or server operation.
- [x] Name the selected post, author/member visibility change, active-review evidence retention, no-active-review permanent deletion, unaffected membership/account/other posts and irreversible recovery.
- [x] Verify cancel calls no RPC and explicit confirmation calls the unchanged owner-checked `delete_community_post` path for the selected id.
- [x] Prove the focused guard red against the missing preview, then pass 42/42 Community and ActionPreview tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 69/69 design contracts and design-report generation.
- [ ] Aggregate design report/check launchers — unavailable because this environment has no `npm`; exact constituents pass and the report regenerates before its wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this bounded client slice.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed published-form withdrawal preview — automation pass 39, slice 47

- [x] Fetch current `origin/main` `0d8f70b2` and confirm no equivalent published-form withdrawal preview landed.
- [x] Re-rank dependency-ready consequence paths and select the existing owner-scoped live form withdrawal; keep permanent file purge and the same-origin demo reset separate.
- [x] Replace the native `window.confirm` with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema, policy or server operation.
- [x] Name the form, shared-link shutdown, permanent deletion of server-held responses, preserved device questions/settings/collected responses and irreversible recovery boundary.
- [x] Verify Cancel calls no delete and changes no project state; explicit confirmation invokes the unchanged `withdraw` operation for the exact published id.
- [x] Prove the focused guard red against the browser-native prompt, then pass 32/32 form-sharing, publishing, modal, ActionPreview and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 100/100 token/design/responsive contracts and design-report generation.
- [ ] Aggregate npm launchers — unavailable because this shell has no `npm`; exact constituents pass and the report regenerates.
- [ ] Ordered and shuffled full suites — not rerun after pass 30’s green 23,872-test baseline; no full-suite result is claimed for this bounded client slice.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed Opportunities-tracker deletion preview — automation pass 40, slice 48

- [x] Fetch current `origin/main` `0d8f70b2`, confirm it is already merged and find no equivalent Opportunities deletion-preview work.
- [x] Re-rank dependency-ready consequence paths and select the one-entry student-owned Opportunities tracker deletion; keep permanent file purge and same-origin demo reset separate.
- [x] Replace immediate device-library deletion with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema, policy or server operation.
- [x] Name the opportunity and every removed field; preserve other opportunities, the weekly time budget, official listings and external employer/lab/program/office state.
- [x] State the truthful recovery boundary: this tracker has no undo, separate export or device-workspace backup. Verify Cancel preserves the edited entry and explicit confirmation removes only the selected id.
- [x] Prove the focused guard red against immediate deletion, then pass 32/32 journey, ActionPreview, modal-accessibility and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 100/100 token/design/responsive contracts and design-report generation.
- [ ] Aggregate npm launchers — unavailable because this shell has no `npm`; exact constituents pass and the report regenerates before its wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this bounded client slice.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed Learning Map deletion previews — automation pass 41, slice 49

- [x] Fetch current `origin/main` `0d8f70b2`, confirm the branch already contains it and find no equivalent Learning Map deletion-preview work.
- [x] Re-rank dependency-ready consequence paths and select the two bounded current-account/current-term Learning Map deletions; verify `workspace-backup.ts` includes the complete map before stating recovery.
- [x] Replace immediate Start Here result and private concept/question deletion with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema, policy or server operation.
- [x] Name saved check answers and plan-shaping choice, or the concept status/note/question flag and office-hours agenda effect; preserve course content, grades, review evidence, plan actions and unrelated private concepts.
- [x] Verify Cancel performs no write and explicit confirmation removes only the selected result or concept from the existing device library; state recovery only from a device workspace backup created before deletion.
- [x] Prove both focused guards red against the prior immediate deletions, then pass 57/57 Learning Map, office-agenda, workspace-backup, modal, ActionPreview and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 69/69 design-check contracts and 96/96 report contracts.
- [ ] Aggregate design report/check launchers — unavailable because this shell has no `npm`/`npx`; exact constituents pass and the report regenerates unchanged before its wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this bounded client slice.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 is absent; Docker, `HAWK_API_KEY` and `HAWK_APP_HOST` are also unavailable from the recorded environment preflight. No target, DAST result or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed saved-schedule deletion preview — automation pass 42, slice 50

- [x] Fetch current `origin/main` `0d8f70b2`, confirm the branch contains it and find no equivalent Registration saved-schedule deletion preview.
- [x] Re-rank dependency-ready consequence paths and select one saved potential schedule in the existing Term plan; verify the complete registration library is included in device-workspace backup coverage.
- [x] Replace immediate device-library deletion with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema, policy or server operation.
- [x] Name the selected schedule and every copied course section removed; preserve the current cart, imported catalog, other saved schedules and official registration.
- [x] Verify Cancel performs no write and explicit confirmation removes only the selected schedule; state recovery only from a device workspace backup created before deletion.
- [x] Prove the guard red against the prior immediate deletion, then pass 62/62 Registration, ActionPreview, workspace-backup, modal-accessibility and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass design audit with zero violations and 86 existing warnings, CSS ledger checks and 147/147 token/design/responsive contracts.
- [ ] Ordered and shuffled full suites — not rerun after pass 30's green 23,872-test baseline; no full-suite result is claimed for this bounded client slice.
- [ ] HawkScan DAST — preflight confirms Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. No credential file was read, no target was started and no scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable connected-calendar removal — current automation pass 1, integration slice 51

- [x] Begin at supplied `INITIAL_MAIN_SHA` `8ea0fec5`, then inspect new `origin/main` `d50e699e`; its two new commits only consolidate device permission states and contain no equivalent `removeFeed`, Connect, undo, reducer or integration-control work.
- [x] Re-rank the remaining consequence paths and select the bounded local Connected calendars removal; keep permanent file purge, same-origin demo reset and scanner-backed Import separate.
- [x] Register `removeFeed` with the existing cross-cutting Undo contract for exactly `feeds` and `feedEvents`; do not add a competing confirmation pattern.
- [x] Give the Connect control an accessible name that identifies the selected calendar and its calendar events.
- [x] Prove both guards red with the undo registration absent, then pass 117/117 focused undo, reducer and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass token export 9/9, design audit with zero violations and 86 existing warnings, CSS ledger checks, 138/138 token/design/responsive contracts and design-report generation.
- [ ] Ordered and shuffled full suites — not rerun for this bounded local recovery slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed Drive folder-hierarchy deletion — current automation pass 1, integration slice 52

- [x] Start from and re-fetch current `origin/main` `3c17385d`; confirm no equivalent Drive folder-deletion preview or overlapping control-file work landed.
- [x] Re-rank the remaining consequence paths and select bounded custom-folder hierarchy deletion; keep permanent file purge, broad demo reset and scanner-backed Import separate.
- [x] Replace immediate folder deletion with the existing `ConfirmDialog` and `ActionPreview`; add no route, shared component, dependency, schema, server operation or provider behavior.
- [x] Name the selected folder, nested-folder count and affected-file count; preserve file bytes, course/deadline links, course folders and folders outside the subtree; state the manual-only recovery boundary.
- [x] Verify Cancel performs no write; confirmation moves direct and nested files to the folder's parent before removing the subtree; a failed move leaves the hierarchy intact and reports recovery guidance.
- [x] Prove the guard red against the prior immediate deletion, then pass 33/33 Drive, folder, ActionPreview and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning. The build succeeded after moving aside the generated `dist/` that twice raced Vite cleanup with `ENOTEMPTY`.
- [x] Pass 78/78 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and design-report generation.
- [ ] Aggregate design report/check launchers — unavailable because this shell has no `npm`/`npx`; exact constituents pass and the report regenerates before its wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun for this bounded device-only slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but the runner reports `hawk runtime=false`, `HAWK_API_KEY=false` and no Docker/target host; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable student-created link removal — automation pass 2, integration slice 53

- [x] Start from `origin/main` `3c17385d`; a final dirty-tree fetch observed `34ac2e1d`, whose governed Course Engine review workflow has no Links, `removeLink`, Undo, test or integration-control overlap.
- [x] Re-rank the remaining consequence paths and select bounded student-created link removal; keep permanent file purge, broad demo reset and scanner-backed Import separate.
- [x] Add `removeLink` to the existing eight-second Undo contract with only `extraLinks` and `linkUrls`, restoring the exact row, custom group and corrected address without reverting unrelated state.
- [x] Give the visible `REMOVE` control an accessible name that identifies the exact student-created link; add no route, component, dependency, schema, server operation or provider behavior.
- [x] Prove three focused guards red against the prior behavior, then pass 128/128 reducer, Links, Undo and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 78/78 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and design-report generation.
- [ ] Aggregate design report/check launchers — the report regenerates, then its wrapper exits because `npm` is unavailable; exact constituents pass.
- [ ] Ordered and shuffled full suites — not rerun for this bounded device-only recovery slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but the Hawk CLI and Docker are absent and `HAWK_APP_HOST` is unset; a local properties file exists but was not read. No target, scan or security pass is claimed.

### Next implementation boundary

- [x] Merge and reconcile `origin/main` `34ac2e1d` on the clean branch before selecting another slice; its separate Course Engine review workflow remains outside the current product. Completed before automation pass 3 / slice 54.
- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable saved-equation removal — automation pass 3, integration slice 54

- [x] Merge current `origin/main` `34ac2e1d` on the clean branch and confirm its separate Course Engine review-resolution workflow has no saved-equation, Undo or current-screen equivalent.
- [x] Re-rank the remaining consequence paths and select bounded saved-equation removal; keep permanent file purge, broad demo reset and scanner-backed Import separate.
- [x] Add `deleteEquation` to the existing eight-second Undo contract with only `equations`, restoring the exact saved formula and filing without reverting unrelated calculator work.
- [x] Give the visible Remove control an accessible name identifying the exact saved equation; add no route, component, dependency, schema, server operation or provider behavior.
- [x] Prove the focused regression red against the prior behavior, then pass 142/142 Undo, reducer, made-slice and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 78/78 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and design-report generation.
- [ ] Aggregate npm design-system launchers — unavailable because this shell has no `npm`; their exact constituents pass and the report regenerates.
- [ ] Ordered and shuffled full suites — not rerun for this bounded device-only recovery slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable committed Study-plan removal — automation pass 4, integration slice 55

- [x] Start from and re-fetch current `origin/main` `34ac2e1d`; confirm no equivalent `clearPlan`, Undo or Study-plan recovery work landed.
- [x] Re-rank the remaining consequence paths and select bounded committed Study-plan removal; keep permanent file purge, broad demo reset and scanner-backed Import separate.
- [x] Add `clearPlan` to the existing eight-second Undo contract with only `sessions` and `liveSession`, restoring the exact sitting schedule, progress and live association without reverting unrelated work.
- [x] Preserve the existing Study route and **Drop the plan** control; add no component, dependency, schema, server operation or provider behavior.
- [x] Prove the focused guard red against the missing Undo registration, then pass 152/152 Undo, reducer, plan and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 78/78 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and design-report generation.
- [ ] Aggregate npm design-system launchers — unavailable because this shell has no `npm`; exact constituents pass and the report regenerates before its wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun for this bounded device-only recovery slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

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
- [x] `student-files` and `course-materials` bucket definitions, with current retention/course metadata scope and deny-by-default browser policy; production provisioning and runtime remain unverified.
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

## 2026-10-09 recoverable course-material removal — automation pass 5, integration slice 56

- [x] Start from and re-fetch current `origin/main` `34ac2e1d`; confirm its separate Course Engine review-resolution work has no equivalent current-product course-material removal or Undo path.
- [x] Re-rank the remaining consequence paths and select the bounded device-owned **Already added** removal; keep Source Locker file trash, permanent purge, broad demo reset and scanner-backed Import separate.
- [x] Replace the two-dispatch update/deadline removal with one `removeUpdate` reducer action bounded by the selected update's `courseId` and recorded `addedItems` ids.
- [x] Add `removeUpdate` to the existing eight-second Undo contract with `updates` and `courses`; restore the exact material/deadline pair without reverting unrelated completion state.
- [x] Give the visible **REMOVE** control an accessible name identifying the exact material; add no route, component, dependency, schema, server operation or provider behavior.
- [x] Prove the focused reducer guard red against the prior behavior, then pass 140/140 Undo, reducer, Add Material and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 9/9 token-export and 138/138 token/design/responsive contract tests, design audit with zero violations and 86 existing warnings, and CSS ledger checks.
- [ ] Aggregate npm design-system launchers and report wrapper — unavailable because this shell has no `npm`/`npx`; exact constituents pass, but no aggregate or regenerated-report pass is claimed.
- [ ] Ordered and shuffled full suites — not rerun for this bounded device-only recovery slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 governed emergency-contact removal — automation pass 6, integration slice 57

- [x] Re-fetch current `origin/main` `34ac2e1d` and confirm it contains no equivalent Support-workspace consequence preview.
- [x] Select only the current student's device-owned emergency-contact removal; keep server support tickets, official campus contacts and external systems outside the mutation.
- [x] Reuse `ConfirmDialog` and `ActionPreview` to name the selected contact and phone number, the exact device-only removal boundary, preserved Support data and the honest no-backup recovery limit.
- [x] Keep Cancel as the safe initial modal action and prove it leaves rendered and persisted state unchanged.
- [x] Remove only the selected contact after explicit confirmation and a successful guarded device-library write; announce the local result.
- [x] Prove the rendered guard red against the immediate deletion, then pass 14/14 focused journey and ActionPreview tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 9/9 token-export, 69/69 design-check and 96/96 report-contract tests, design audit with zero violations and 86 existing warnings, and CSS ledger checks.
- [ ] Aggregate design report/check launchers — `npm`/`npx` are unavailable; the report regenerates before its wrapper exits and the exact constituents pass, so no aggregate launcher pass is claimed.
- [ ] Ordered and shuffled full suites — not rerun for this bounded device-only slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but preflight confirms `hawk runtime=false`, `docker runtime=false`, `HAWK_API_KEY=false` and `HAWK_APP_HOST=false`; no target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable task-step removal — automation pass 7, integration slice 58

- [x] Fetch and merge current `origin/main` `e128a526`; confirm its governed system-passport registry has no equivalent `dropStep`, nested-task Undo or current-screen change.
- [x] Re-rank the remaining consequence paths and select only the current student's device-owned task checklist step; keep whole-task deletion, permanent file purge, broad demo reset and scanner-backed Import separate.
- [x] Add `dropStep` to the existing eight-second Undo contract with only `tasks` and `onChange`, because the nested removal does not shrink the top-level task list.
- [x] Restore the exact step text, completion state and order without reverting unrelated deadline completion; retain the existing named Remove control and route.
- [x] Prove the focused guards red against the missing registration, then pass 126 Undo, reducer and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 78/78 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and design-report generation.
- [ ] Aggregate design report/check launchers — `npm`/`npx` are unavailable; the report regenerates before its wrapper exits and the exact constituents pass, so no aggregate launcher pass is claimed.
- [ ] Ordered and shuffled full suites — not rerun for this bounded device-only recovery slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — required after this production change, but preflight confirms the Hawk CLI, Docker runtime and target host are absent; a local credential properties file exists but was not read. No target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable Semester Mail rule deletion — automation pass 8, integration slice 59

- [x] Re-fetch and reconcile current `origin/main` `e128a526`; confirm it is already an ancestor and contains no equivalent `dropMailRule` Undo registration.
- [x] Re-rank remaining consequence paths and select only the student-created Semester Mail rule; keep provider mailbox state, permanent purge, broad demo reset and scanner-backed Import outside the mutation.
- [x] Add `dropMailRule` to the existing eight-second Undo contract with only `mailRules`; preserve later read, star, label, folder and snooze marks.
- [x] Retain the existing named delete control and rule semantics; add no route, component, dependency, schema, server operation or provider behavior.
- [x] Prove the guard red in two focused assertions, then pass 164/164 Undo, reducer, mailbox and mail-rule tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 78/78 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and unchanged design-report generation.
- [ ] Aggregate design-report/check launchers — the report writes successfully, then its wrapper exits because this shell has no `npm`; exact constituents pass.
- [ ] Ordered and shuffled full suites — not rerun for this bounded state-contract slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 and Docker are absent, `HAWK_API_KEY` and `HAWK_APP_HOST` are unset, and the local properties file was not read. No target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable student-entered bill-row removal — automation pass 9, integration slice 60

- [x] Re-fetch and reconcile current `origin/main` `e128a526`; confirm it is already an ancestor and contains no equivalent `dropCharge`, `dropAid` or `dropPayment` Undo registration.
- [x] Re-rank remaining consequence paths and select the three student-entered Bill rows as one bounded screen/state-owner slice; keep university ledgers, official aid decisions, money movement, permanent purge, broad demo reset and scanner-backed Import outside the mutation.
- [x] Add each action to the shared eight-second Undo contract with only its exact field: `charges`, `aid` or `payments`.
- [x] Preserve the existing Bill route, row-specific accessible remove names, `student_entered` provenance, export behavior and official payment deep-link boundary.
- [x] Prove the registry/snapshot guard red in two assertions, then pass 295/295 focused Undo, reducer, bill, export and root-unmount tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 147/147 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and design-report generation with all contracts passing.
- [ ] Ordered and shuffled full suites — not rerun for this bounded state-contract slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — the active skill stops at preflight because `hawk` and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. No target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.

## 2026-10-09 recoverable registrar-date clearing — automation pass 10, integration slice 61

- [x] Re-fetch current `origin/main` `e128a526`; confirm it remains an ancestor and contains no equivalent `dropTermDate` Undo registration or row-specific Clear name.
- [x] Re-rank remaining consequence paths and select only the student-managed Registrar sheet; keep official institutional calendars, registration records, permanent purge, broad demo reset and scanner-backed Import outside the mutation.
- [x] Add `dropTermDate` to the shared eight-second Undo contract with only `registrar` and `onChange`, covering both removal of a student-added row and same-length clearing of a built-in landmark.
- [x] Give each repeated Clear control an accessible name containing its exact date label; add no route, component, dependency, schema, server operation or provider behavior.
- [x] Prove the registry guard red, then pass 184/184 focused Undo, reducer, registrar and rendered Registrar tests.
- [x] Pass TypeScript, lint, university typecheck and production build; retain four existing lint warnings and the existing chunk-size warning.
- [x] Pass 78/78 token/design contracts, design audit with zero violations and 86 existing warnings, CSS ledger checks and unchanged design-report generation.
- [ ] Aggregate npm design-system launchers — unavailable because this shell has no `npm`/`npx`; exact constituents pass and the report regenerates before its wrapper exits.
- [ ] Ordered and shuffled full suites — not rerun for this bounded state-contract slice; the last recorded full-suite baseline remains pass 30's green 23,872 tests.
- [ ] HawkScan DAST — the active skill stops at preflight because Hawk v6 and Docker are absent and no target host is set; a local credential properties file exists but was not read. No target, scan or security pass is claimed.

### Next implementation boundary

- [ ] Re-rank the remaining dependency-ready gaps and consequence paths against current repository authority before choosing another bounded slice.
- [ ] Keep permanent file purge, folder-tree deletion and same-origin demo reset separate until their broader erase, isolation and recovery semantics are reconciled.
- [ ] Keep the authenticated adapter and Import wiring closed until a deployed private scanner/extractor can produce genuine storage, scan and correction-current derived-snapshot receipts under session-derived authority and shared rate limits.
