# Handoff integration status

**Automation pass** 10 of 120 · **Integration slice** 18 · **Date** 2026-10-08 · **Branch** `codex/complete-semester-integration-2026-10-08` · **Current `origin/main`** `55adab11`

## State

Phase 0 reconciliation is complete for the archive populations and includes the Course Engine MVP as current-repository evidence. P1-01 through P1-07, the first repository-native Console consumer and the pre-ingestion course-source authority contract are locally implemented in bounded slices. Course Engine remains a disconnected MVP, not an integrated second app. Server course-source persistence, private buckets, scanning, extraction, routes and current-screen wiring remain absent. No deployment, production data or external system changed.

## Evidence locked in automation pass 10 / slice 18

- The clean branch fetched `origin/main` `55adab11`; no newer equivalent course-source authority or storage contract landed.
- `app/server/course-sources/contract.ts` reuses the existing platform file engine and adds only course-specific authority. Student sources require exact current course-row ownership and tenant membership; shared material requires exact `<tenant>/<CODE>` `course:publish` evidence and a current versioned retention policy.
- Upload planning requires the request context's idempotency key plus a successful shared rate-limit decision. The server contract accepts PDF, Word, PowerPoint, plain text and Markdown; ZIP and other archives remain refused until a sandboxed bounded expander exists.
- Only a tenant-bound service context can accept the storage receipt or settle scanning. Bytes remain quarantined until clean verdict, exact declared/detected type, SHA-256 and scanner version agree; mismatches, blocked verdicts and scanner errors reject the source.
- Student-source deletion preserves the existing 30-day Drive recovery rule; shared material uses the named institution retention policy; legal hold always wins. Confirmed corrections are append-only hash-linked revisions over an immutable available source.
- Audit facts contain bounded identity/outcome metadata only and exclude filename, excerpts, extracted text, prompts and old/new correction values. [`COURSE-SOURCE-AUTHORITY.md`](../COURSE-SOURCE-AUTHORITY.md) records the authority and every remaining persistence, scanner, route, deployment and approval gate.
- Authority/file tests pass 66/66 in ordered and shuffled runs. The authority, architecture, platform-reference and event-example guards pass 144/144 together. The broad suite caught and the slice fixed an audit discriminator that resembled a domain event plus a relative package import that bypassed the `@semester/platform` public boundary; the final producer/reference guards remain unchanged in meaning and green.
- TypeScript, lint, university typecheck and production build pass; lint retains only the existing three warnings. Design-system constituents/report pass with 9 token tests, zero violations and the existing 86-warning ledger, CSS within budget and 69 contract tests.
- The ordered full suite finishes with 23,786 passing and 69 skipped. Its two failures are unrelated to this slice: the runner-mounted `.semester-reference` repository-map refusal and a 30-second timeout in `waitingrow.test.tsx`. Full shuffle seed `1791508834946` finishes with 23,787 passing and 69 skipped; only the mounted-reference map guard fails.
- HawkScan preflight cannot start because the `hawk` executable is absent and `HAWK_API_KEY` is unset. No DAST result or security pass is claimed; the release gate remains open.
- No schema, bucket, storage object, scanner, route, UI, deployment, production data or external system changed.

## Evidence locked in automation pass 9 / slice 17

- The clean branch fetched, inspected and merged `origin/main` `55adab11`. Its productivity request-context hardening is current authorization evidence and has no equivalent Course Engine reconciliation.
- Commit `b190f96a` contributes 89 `course-engine/` files, 15 separate Next.js workspace modes, 40 FastAPI route decorators and 21 SQLAlchemy entities. The root npm workspace still includes only `app` and `packages/*`; current screen/navigation registries do not route the MVP.
- [`REFERENCE-COURSE-ENGINE-RECONCILIATION.md`](REFERENCE-COURSE-ENGINE-RECONCILIATION.md) gives sixteen meaningful families one disposition each: 8 existing but incomplete, 3 intentionally excluded, 2 prototype only, 2 documentation/roadmap only and 1 externally blocked. Zero are existing and verified.
- Useful behavior maps to current owners: multi-file import and explicit date confirmation in `Import`, selected multi-source and citation-checked generation in Study Studio, current Course Studio publication controls, the current AI policy/gateway and repository-native storage/tenancy boundaries.
- The separate Next.js/Tailwind shell, JWT identity, Alembic schema and Compose topology are excluded as integration patterns. They would create a second app, design system, identity authority and parallel data model.
- The next dependency is the current-repository `student-files` / `course-materials` source-authority contract. It must settle canonical course identity, exact tenant/course relationship, storage path, type/archive/size validation, scan/quarantine state, retention/deletion, provenance and correction propagation, idempotency, rate limits, audit and recovery before server ingestion.
- Structural validation confirms 16 unique CE rows and the stated 8/3/2/2/1 disposition totals. The repository-local design-tooling guard passes 22/22 tests; the unavailable `npx` wrapper is not claimed.
- This is a documentation/reconciliation slice. It changes no production code, route, schema, policy, dependency or generated token. HawkScan is therefore not applicable; no security result is claimed.

## Evidence locked in automation pass 8 / slice 16

- The clean branch merged `origin/main` `b190f96a` before implementation. Its citation-first Course Engine MVP contains no Supabase projection consumer or equivalent Console UI; it remains new repository evidence to reconcile before Course Studio work. The final fetch observed `55adab11`; its productivity request-context security change touches no Console projection or generated-register file, so the dirty branch was not rebased or merged.
- `app/src/lib/console/client.ts` now maps `read_tenant_projection` into a strict typed envelope. It forwards the exact tenant, cursor and 50-row bound; rejects malformed freshness/permission/row shapes; rejects a different returned tenant; and preserves the database refusal.
- The existing Tenant operations workspace owns the UI. A named tenant's projection is read only after explicit disclosure, never from a free-form tenant id. It is labeled projection authority, read only and non-exportable; there are no actions or mutations.
- Shared Semester/Console patterns cover loading, empty and unknown, permission denial, recoverable error, stale/failed warnings, bounded pagination, long identifiers and auto-fit narrow layouts. Source/computation times, model coverage, worker state, correlation, rollout and entitlements remain visible; policy/event ids and worker diagnostics do not.
- Focused client/component suites pass 43/43 tests. TypeScript, lint, university typecheck and production build pass; lint retains three existing warnings. Design-system constituents pass 9 token tests and 69 contract tests with zero violations and the existing 86-warning ledger; the report renders successfully.
- The ordered full suite completes with 23,774 passing and 69 skipped tests. Its three failures are not slice regressions: the runner-mounted `.semester-reference` map refusal and stale role/control generated documents. The two repository-owned documents were regenerated; focused guards pass. The full shuffle with seed `1791505035827` developed unrelated import-scan timeouts and React `act()`/axe cascades and ended with exit 130 before a final count; the focused slice passes 43/43 under that same seed.
- The 12ui CLI could not install because this runner lacks `npm`/`npx`; the failed install changed no repository file. Repository-native patterns and design contracts are the verified visual authority for this slice.
- HawkScan remains unavailable because the `hawk` executable and `HAWK_API_KEY` are absent. No DAST result or security pass is claimed.

## Evidence locked in automation pass 7 / slice 15

- The clean branch merged `origin/main` `a2c9a4d0` before implementation. The final fetch observed `b190f96a`, whose citation-first Course Engine MVP adds no Supabase migration or equivalent projection reader. The dirty branch was not rebased or merged; that upstream domain surface remains a required input to the later Course Studio reconciliation.
- `20261008233000_tenant_projection_read.sql` adds one bounded `read_tenant_projection` RPC. The entitlement and rollout materializations retain no client table grants.
- A caller needs live platform `console:operate` or exact-school `tenant:configure`. Wrong-tenant and absent authority raise `42501`; the tenant filter is enforced inside every private projection query.
- The result follows the current query envelope: bounded data, generated/source/computation times, projection authority, coverage, version/correlation metadata, non-export permissions and warnings. Policy ids, source event ids and private worker diagnostics are excluded.
- Freshness is computed from the active registry row and watermark against each five-minute SLO: missing is `unknown`, failed is `failed`, rebuilding or expired is `stale`, and current is `fresh`. Degraded snapshots remain usable only with explicit authoritative-source warnings.
- PostgreSQL 17 applies all 211 migrations twice with 370 table fingerprints unchanged. Seven focused/adjacent suites pass 52/52 checks across the reader, grants, RLS coverage, foundation, both projectors and worker. Focused repository/register guards pass 35/35 tests.
- TypeScript, lint, university typecheck and the production build pass; lint retains three existing warnings. Design-system equivalents pass 9 token tests, 69 check tests and 96 report-contract tests with zero violations and the existing 86 warnings. The package wrappers cannot invoke their nested `npm`/`npx` binaries in this runner, so those exact wrapper invocations are not claimed.
- No Console consumer, action control, worker schedule, secret, deployment or production execution was added.
- Post-commit HawkScan preflight stopped because the `hawk` executable is absent and `HAWK_API_KEY` is unset for the headless scan. No credential file was read; no scan or security pass is claimed.

## Evidence locked in automation pass 6 / slice 14

- Merged `origin/main` `7d93d31b` before implementation; its Clerk, policy-evidence and hardened console changes contain no equivalent rollout event or projector. The final fetch observed `a2c9a4d0`; its only changed file is `docs/DEVELOPER-TOOLS.md`, with no overlap or equivalent work.
- Accepted tenant-rollout creation/transitions now write immutable history and one `tenant_rollout.changed` version-1 event atomically. Correlation/idempotency bind to the history UUID; payloads exclude the reason and actor.
- `ops_tenant_rollout` version 1 is private and school-scoped. Effect, receipt, watermark and invalidation are one transaction, delayed events cannot regress state, and malformed events dead-letter with a fixed message.
- The dormant worker keeps its 25-row bound and now dispatches only `entitlement.changed` and `tenant_rollout.changed`; no public read, schedule, secret, deployment or production run was added.
- PostgreSQL 17 applied all 210 migrations twice with 370 unchanged table fingerprints. The focused suite passed 5/5 and eight adjacent suites passed 73/73. Event/reference guards passed 66/66.
- TypeScript, lint, university typecheck, production build and the design-system check/report contracts pass; lint retains three existing warnings. Ordered and shuffled full suites each finish with 23,771 passing and 69 skipped tests. Their only failure is the repository-map guard detecting the runner-mounted `.semester-reference` directory; shuffle seed `1791502868214` adds no order-dependent failure.
- HawkScan remains unavailable because both the executable and API key are absent. No DAST pass is claimed.

## Evidence locked in runner pass 4 / slice 12

- The pre-slice fetch observed `origin/main` at `32dd8241`; the final fetch advanced to `523091e9`. It contains no equivalent worker endpoint, dispatch migration or focused suite. Its new `20261008190000_console_postmerge_safety.sql` conflicted with the earlier branch-local migration version, so projection operations now use unused version `20261008190500`; the dirty branch was not rebased or merged.
- `20261008210000_ops_projector_worker.sql` adds a service-role-only batch capped at 25. It claims only `entitlement.changed` version 1 events and dispatches only the active `ops_tenant_entitlements` handler; unrelated event types remain untouched.
- Invalid envelopes use the existing terminal transition with a generic bounded reason. Retryable errors use the existing delayed retry path. The underlying handler still commits effect, receipt, monotonic watermark and invalidation atomically.
- The `ops-projector` function is POST-only, checks a dedicated bearer secret, returns 503 when the secret or service credentials are absent and exposes counts only. No secret was provisioned and no scheduler entry was added.
- `supabase/check.sh ops-projector-worker` applied all 207 migrations on PostgreSQL 17 and passed all four focused checks: service-only/batch bound, selective dispatch, malformed-event terminal handling without partial state, and inactive-registration refusal before claim. The adjacent reapply run left 369 table fingerprints unchanged and passed 40/40 grants/foundation/outbox/producer/handler/worker checks.
- Focused HTTP, edge-guard, deployment/configuration, secret and generated-reference suites are green. The broader focused run passed 316/317; its only failure is the known runner-mounted `.semester-reference` repository-map refusal, while the other 115 developer-document tests pass.
- TypeScript, lint, university typecheck and the production build pass. Repository-local pnpm/Node equivalents pass token export, design audits, 69 design contract tests and all eight report contract files; the package script's nested `npm` binary is unavailable in this shell. Deno is also unavailable, so no `deno check` is claimed.
- HawkScan cannot run (`hawk runtime=false`, `HAWK_API_KEY=false`). No DAST pass is claimed and that release gate remains open.

## Evidence locked in runner pass 3 / slice 11

- The pre-slice fetch observed `origin/main` unchanged at `32dd8241`; it contains no equivalent projector transaction, read model, focused suite or migration version.
- `20261008200000_tenant_entitlement_projection.sql` registers `ops_tenant_entitlements` version 1 and adds a private, school-scoped, service-only materialization of the bounded `entitlement.changed` event. It stores no reason, actor, role/cohort list or source prose.
- `private.apply_tenant_entitlement_event` validates the exact producer contract, applies current state or a tombstone, writes the existing consumer receipt, advances but never regresses the watermark and writes an invalidation only for a material change, all in one transaction.
- The source timestamp plus event UUID orders deliveries. An earlier delayed event is settled as `skipped`, cannot overwrite a newer state and does not create a spurious invalidation.
- `supabase/check.sh tenant-entitlement-projection` passed 4/4 focused checks on PostgreSQL 17. With `SEMESTER_CHECK_REAPPLY=1`, all 206 migrations reapplied with the schema and all 369 table fingerprints unchanged before the four checks passed again.
- The adjacent grant, RLS, index, foundation, outbox and producer suites passed with the projector suite, 53/53 checks. The first run identified that the already guarded replay RPC was absent from the authenticated-function allowlist; the allowlist now documents that exact capability/MFA/two-person-approval path and the grant suite passes.
- `RETENTION.md` now covers the new read model and corrects the old empty-outbox language. Event, receipt and invalidation sweeps remain absent and are a gate before worker activation.
- Focused repository guards passed 208/208; generated role-launch/control-facts guards passed 57/57 after their repository-owned outputs were refreshed.
- TypeScript, lint, university typecheck, production build, design-system check and design-system report pass. Existing lint/design warning baselines remain unchanged.
- The ordered full suite was not green: it first found the known `.semester-reference` repository-map refusal plus the two now-refreshed registers and was stopped during its long tail. The focused register reruns are green; `developers.test.ts` still fails only on the runner mount. Shuffle was not run after that unresolved repository-local gate. No slice-focused test failed.
- HawkScan cannot run (`hawk runtime=false`, `HAWK_API_KEY=false`). No DAST pass is claimed and that release gate remains open.

## Evidence locked in runner pass 2 / slice 10

- The final fetch observed `origin/main` advance from `d9640e45` to `32dd8241`. Its seventeen changed app/vite files do not overlap this slice and contain no equivalent feature-policy producer or P1-04 worker/producer increment.
- `20261008193000_tenant_feature_policy_events.sql` extends the current audit trigger instead of creating a second command/audit path. Each feature-policy insert, update or delete writes one existing-catalog `entitlement.changed` event whose correlation and idempotency keys bind it to the append-only audit UUID.
- The event payload contains only policy id, capability, action, bounded state and changed-field names. It excludes free-text reason, role/cohort scope and actor details; deletion emits a tombstone without the prior state.
- Other policy tables remain audit-only. The producer is not client-callable, and policy, audit and event commit or roll back together.
- `supabase/check.sh tenant-feature-policy-events` applied all 205 migrations on disposable PostgreSQL 17 and passed all five focused checks. With `SEMESTER_CHECK_REAPPLY=1`, a second application left the schema and all 368 table fingerprints unchanged before the five checks passed again. The adjacent intelligence-policy, feature-cohort and governance suites also passed 149 checks, for 154/154 SQL checks in the final focused run.
- The generated event scan was extended to recognize callers of the SQL emission helper, then the event, roadmap and definer registers were regenerated. Ordered and shuffled focused runs each passed 104/104 tests; the earlier 197/198 repository-local run had only the pre-existing repository-map refusal to treat mounted `.semester-reference` as a committed top-level directory.
- `tsc -b`, lint, the university gateway typecheck and the production build passed. Lint retained the existing warning baseline and the build retained its existing chunk-size warnings.
- HawkScan cannot run (`hawk runtime=false`, `HAWK_API_KEY=false`). No DAST pass is claimed and that release gate remains open.

## Evidence locked in pass 9

- `origin/main` advanced during the pass from `e53128a6` to `d9640e45`; the intervening Phase A, HawkScan-source-tag and developer-tooling commits contain no equivalent P1-03 migration, function, focused check or migration-version collision. The dirty branch was not merged or rebased.
- `20261008190500_projection_outbox_operations.sql` adds service-role-only claim, complete and fail transitions with a five-minute recoverable lease, 100-row batch limit, deterministic jitter under a fifteen-minute retry cap, dead-letter at attempt eight and idempotent per-consumer receipts.
- The dedicated `projection-replay` duty requires an engineering requester, two distinct data/security approvals and evidence binding one event, consumer, projector version and rollback plan. Execution also requires `console:operate`, fresh MFA, a current exact approval and a fail-closed console audit append.
- `projection-outbox-operations.check.sql` covers privilege refusal, due ordering, stale recovery, claim identity, atomic/idempotent completion, retry/dead-letter state, approval binding, capability/MFA checks, replay idempotency and audit failure rollback.
- Repository-owned console/event/role/control registers were regenerated. Focused guards passed 39/39, 54/54 and 57/57. TypeScript build, lint, university gateway typecheck and production build passed.
- The full application suite was not green: the mounted `.semester-reference` directory remains absent from the repository map; affected generated registers were then refreshed; unrelated late `softtop`/`localask` timing failures and a worker SIGTERM occurred after about 25 minutes. No slice-focused TypeScript test failed.
- `supabase/check.sh projection-outbox-operations` ran on PostgreSQL 17: all 204 migrations applied and all six focused P1-03 checks passed. With `SEMESTER_CHECK_REAPPLY=1`, a second application left the schema and all 368 table fingerprints unchanged and the six checks passed again. P1-03 therefore moves from missing and in scope to existing and verified locally; deployment remains unverified.
- Six focused TypeScript/register files passed 196/196 tests. `tsc -b`, lint and the university gateway typecheck also passed; lint retained only the existing warning baseline.
- HawkScan cannot run (`hawk runtime=false`, `HAWK_API_KEY=false`). No DAST pass is claimed and that release gate remains open.

## Evidence locked in pass 8

- Current `origin/main` is `e53128a6`; no equivalent full Stream 00–30 reconciliation landed.
- [`REFERENCE-EXECUTION-STREAM-RECONCILIATION.md`](REFERENCE-EXECUTION-STREAM-RECONCILIATION.md) dispositions 53 remaining novel task, behavior, addendum, gate and implementation-pattern bundles while linking exact catalog populations to their canonical row registers. Its SHA-256 is `1620824dc241dc7c32382b9716e88e8b26e551d68b9d7a5c04cd621f1fec2d58`.
- Repeated archive screen tables and shared rules are not counted as new product obligations. Archive scripts, migrations, source trees, branch instructions and completion claims remain non-authoritative.
- Projection P1-01 is now existing but incomplete: `20261006130000_projection_foundation.sql` provides private registry, watermark, invalidation and rebuild tables plus outbox claim columns, with `projection-foundation.check.sql`.
- Projection P1-02 is existing but incomplete: `20261008183934_emit_domain_event.sql` provides the sanitized idempotent writer, with `emit-domain-event.check.sql`; no production domain producer calls it yet.
- P1-03 is the earliest missing-and-in-scope shared slice: server-only claim, complete, fail and capability/audit-gated replay operations with stale-claim recovery, bounded retry/dead letter, idempotent receipts and focused SQL proof.
- P1-04 worker/cron, producers, projected tenant/inbox models and Console UI remain later slices. Course Studio follows as the earliest domain cluster. P11 graduate/research education remains non-ready pending owner and source-of-truth authority.

## Evidence locked in pass 7

- Current `origin/main` remains `e53128a6`, is already an ancestor of the branch and contains no equivalent catalog reconciliation.
- [`REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.md`](REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.md) and its generated CSV cover 219 unique rows.
- The generated CSV SHA-256 is `bd3d790ae54cb114accd53657707509801df165ff3d00d398337ee8f6dcf28a3`.
- Role results: 36 existing but incomplete, 9 duplicate or superseded and 4 documentation or roadmap only. Every named role analogue resolves to the current 69-role launch register; no archive text role was added.
- System results: 84 existing but incomplete, 1 missing and in scope, 2 documentation or roadmap only and 1 intentionally excluded. Projection/read models are the single buildable system gap; marketplace remains excluded.
- Document results: all 82 are duplicate or superseded by current repository authorities. The classification does not imply legal approval, external assurance, deployment, operation or live restore evidence.
- P11 graduate/research education remains missing independently of the existing `graduate_student` role. Projection/read models remain behind current outbox/domain-event and remaining stream dependencies rather than being selected prematurely.

## Evidence locked in pass 6

- Current `origin/main` remains `e53128a6`; no equivalent workflow reconciliation landed.
- [`REFERENCE-WORKFLOW-RECONCILIATION.md`](REFERENCE-WORKFLOW-RECONCILIATION.md) and its generated CSV preserve and disposition all 319 canonical archive workflow steps.
- The generated CSV SHA-256 is `bea99779e050238555b02a358bc13fae98e30b49df2795209af6a30efffc0c8e`.
- Structural proof shows exact group length, ordered-label and key equality across all 17 archive and repository workflows.
- All 84 catalog-screen projections resolve to exact archive workflow indices and labels; they remain aliases of canonical workflow rows.
- Results: 241 existing but incomplete, 54 missing and in scope, 18 documentation or roadmap only, 2 externally blocked and 4 intentionally excluded.
- Every row names a P3/P5/P6/P7/P8/P9 authorization/data-boundary profile, current evidence or planned owner, dependencies and acceptance contract, and release boundary.
- The 54 buildable rows overlap the 44 buildable screen rows; they are not additive totals. Pass 7 now closes the role, system and document catalogs; remaining execution-stream dependencies still prevent an evidence-based production selection.

## Evidence locked in pass 5

- The clean branch merged current `origin/main` `e53128a6`; its capability-exposure and assistant-safety changes do not duplicate or alter this reconciliation population.
- [`REFERENCE-CATALOG-SCREEN-RECONCILIATION.md`](REFERENCE-CATALOG-SCREEN-RECONCILIATION.md) and its generated CSV preserve and disposition all 673 archive screen-catalog rows.
- The generated CSV SHA-256 is `989d65402940915083ceea8d33237dc8cfe7e0b5d68ca02fe2e0c9d4f0cbf8e1`.
- Structural proof shows 589 base rows exactly equal the repository catalog labels group by group and in order; the other 84 exactly equal the archive's declared `addedScreens` workflow aliases.
- Results: 534 existing but incomplete, 44 missing and in scope, 84 duplicate or superseded, 1 documentation or roadmap only, 4 externally blocked and 6 intentionally excluded.
- Every row names a P1–P7 current authorization/data-boundary profile, current evidence or planned owner, dependencies and acceptance contract, and release boundary.
- The 84 aliases stay owned by the canonical workflow population. No route or screen is created merely because a workflow step was projected into the archive screen array.
- The 44 buildable rows remain candidates and are now cross-bounded by the canonical workflow register; remaining execution streams and catalog populations still establish dependency order.

## Evidence locked in pass 4

- Current `origin/main` remains `ca0cc9ad`; no equivalent route reconciliation landed.
- [`REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md`](REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md) and its generated CSV preserve and disposition all 281 unique routes across 26 workspaces.
- The generated CSV SHA-256 is `5b57fdb108ef876f5cc75d004c2ef3bd3e595bc7ef42d40cdedd8fd47e30bee4`.
- Results: 62 existing but incomplete, 201 prototype only, 13 documentation or roadmap only and 5 intentionally excluded. No route is inflated to existing and verified or missing and in scope from archive evidence alone.
- Every row names one P1–P11 evidence profile, a current owner/evidence path, exact current app-screen/navigation evidence where applicable, exact normalized repository-catalog rows, capability-register rows and a release-boundary rationale.
- Matching is fail-conservative: no fuzzy label match, repeated workspace keys do not imply global route equivalence, and an archive URL is never adopted as a production route.
- The five exclusions are the three marketplace-workspace routes and two student marketplace/buy-and-sell aliases under `D-1287`.
- The generator validates exactly 281 source routes, 589 current repository catalog rows, 122 reconciled capability rows and 281 unique output routes before writing the CSV.

## Evidence locked in pass 3

- Current `origin/main` remains `ca0cc9ad`; no equivalent registry reconciliation landed.
- [`REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md`](REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md) preserves and dispositions all 122 unique registry ids.
- Results: 91 existing but incomplete, 10 prototype only, 2 duplicate or superseded, 18 documentation or roadmap only and 1 intentionally excluded. No row is inflated to existing and verified or missing and in scope from archive design evidence alone.
- Eleven evidence profiles name the current owner, role/route/capability boundary, tenant/data authority, server behavior, audit/recovery/states, tests, dependencies and release ceiling for every row.
- The archive's dotted permissions and parallel schema names are identification evidence only. Current capability/RLS contracts remain authoritative.
- Marketplace remains excluded by `D-1287`; developer API/app/sandbox concepts remain roadmap-only and require separate authority.
- The current migration-rendered authorization census is 69 roles, 96 capabilities and 185 role-capability rows. The older `ROLE-PERMISSION-MATRIX.md` 84/157 heading is retained as a named stale snapshot, not used as current authority.
- Structural validation found 122 archive ids and 122 unique register rows with zero missing, extra or duplicate ids; every row has one allowed disposition and one P1–P11 profile. The repository-local `src/lib/designtooling.test.ts` passed 22 of 22 tests.

## Evidence locked in pass 2

- The clean branch was rebased onto `origin/main` `ca0cc9ad`; the intervening migration-version repair does not duplicate this work and does not change the pass-1 census.
- [`REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md`](REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md) dispositions all 20 capability-blueprint rows.
- Six Stream 00 items, all sixteen Stream 18 audit deliverables plus seven role-platform decisions, and all eighteen Stream 25 packages plus seven ecosystem rules and three open decisions have exactly one disposition.
- Existing role-system documents are treated as audit authorities, not proof that the underlying capability is complete.
- Existing master/finish-line registers remain the one readiness authority; the archive completion register is not imported in parallel.
- P11 graduate/research education is missing and in scope, but is not implementation-ready until its domain owner, authority/data contract, role mapping and acceptance path exist.
- Structural validation found 20 unique blueprint ids, 18 unique package ids and 77 meaningful-item rows with exactly one allowed disposition. `src/lib/designtooling.test.ts` passed 22 of 22 tests through the repository-local Vitest binary.

## Evidence locked in pass 1

- Source archive: `/Users/harrisonrubin/Desktop/The Main Semester design system (2) copy 4.zip`.
- Supplied and recomputed SHA-256: `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`.
- Extraction: 3,570 files and 468,325,601 bytes; 3,569 content files plus `.extracted-complete`.
- Content identity: 2,751 unique hashes; 568 duplicate-content groups containing 1,387 file instances.
- Committed inventory: `docs/design-system/REFERENCE-ARCHIVE-INVENTORY.csv`, 3,570 unique rows, SHA-256 `282a03e46761dc2c66bdc2cec384d49a3b3ae33357e220c8014a0c1453578ef8`.
- Archive prototype: 281 unique routes, 26 workspaces; no duplicate route key.
- Archive capability registry: 122 rows; it claims zero implemented, tested or deployed rows.
- Archive execution blueprint: 20 proposed capabilities with implementation, test, deployment, authorization and enablement unverified.
- Repository census: 97 screen-registry keys including two shell states; 62 navigation destinations; 120 screen files; 407 component files; 1,393 tests; 203 migrations; 17 edge functions; 51 gateway handlers; 69 roles; 96 capabilities; 185 role-capability rows.

## Truth boundary

The archive is design and product evidence. Its prototype checks, code, migrations, prompt files, completion labels, pilot statements, customer claims, dates and approval claims are not repository, deployment, institutional or GA evidence. Current repository controls and merged decisions win every conflict.

## Completed local slice gate

The projection database proof and reapply evidence remain green from slice 15. Slice 16's 43 focused tests, generated-reference guards and phase gates remain green; slice 17's 16-row structural and 22/22 design-tooling checks remain green. Slice 18 passes 66/66 ordered and shuffled authority/file tests, 144/144 combined architecture/reference guards, TypeScript, lint, university typecheck, production build and the design-system constituents/report. The ordered full suite is not wholly green only for the mounted-reference map refusal and an unrelated waiting-row timeout; full shuffle is not wholly green only for the mounted-reference map refusal. Deno and HawkScan remain explicitly open where applicable. Secret provisioning, scheduler activation, additional projectors, course-source persistence/storage/scanning and operating deployment remain separate.

## External gates kept open

HawkScan DAST, deployment, live provider credentials, IdP metadata, legal review, DPA/HECVAT/insurance, institutional approval, UAT, accessibility conformance, staffing, live restore evidence and production activation remain unverified. The HawkScan runtime and `HAWK_API_KEY` are unavailable; no DAST pass is claimed.

## Next dependency-ready work

Add the repository-native course-source metadata, correction and deletion/recovery schema with deny-by-default RLS, exact server-side relationship resolution and atomic content-free audit. Prove tenant isolation, idempotency, legal-hold/recovery behavior and relationship revocation in focused PostgreSQL checks. Do not provision buckets, expose upload/download routes or wire Import/Study Studio until the private storage and deployed scanner prerequisites are actually available; do not add a Course Engine route or parallel course model.

## Hold-aware projection-history retention — automation runner pass 5, slice 13

The pre-slice fetch observed `origin/main` at `523091e9`; the final fetch advanced it to `7d93d31b`. The intervening Phase B, Clerk, policy-evidence and console changes contain no equivalent retention function, migration or check and introduce no version collision. `20261008220000_projection_history_retention.sql` adds `private.prune_projection_history()`, a manually invoked, service-role-only operation. It scrubs published payloads after 30 days, expires published envelopes and their receipts by retention class, and removes projection invalidations after 90 days. It never touches pending or dead-lettered work. Tenant holds preserve covered rows, and a platform hold returns a visible `legal_hold` skip without mutating anything.

The operation has no cron entry and was not deployed or run against production. `projection-history-retention.check.sql` covers the four event-class windows, payload scrubbing, receipt co-deletion, pending/dead-letter preservation, invalidation aging, tenant and platform holds, and client/service grants. PostgreSQL 17 applies all 208 migrations twice with 369 unchanged table fingerprints; 10 focused and 145 adjacent SQL checks pass, including the repository's hold-blind deletion suite. The retention/scheduler/definer/design-tooling guards pass 72 tests; TypeScript, lint, university typecheck, the production build and design-system constituent/report contracts pass. HawkScan cannot start because the `hawk` executable is absent, so the DAST gate remains open.

At the end of slice 13, P1-05 was locally implemented and verified, not activated, and P1-06 was selected next. Slice 14 now closes that local producer/consumer increment. Worker activation still requires secret provisioning, deployment evidence, monitoring, an operating runbook and explicit authority.
