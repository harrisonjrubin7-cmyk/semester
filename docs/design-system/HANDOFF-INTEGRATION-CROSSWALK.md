# Handoff integration crosswalk

**Refreshed** 2026-10-16 · **Latest observed `origin/main`** `06c2d5c74` · **Archive SHA-256** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`

This page maps the design export onto the production repository. It does not replace `docs/design-system/MASTER-BRIEF-CROSSWALK.md` (the 19 visual deliverables) or `docs/master/REPO_AUDIT.md` (one row per catalogued screen and workflow step).

## Mounted archive coverage

The earlier crosswalk covered the 139 committed `docs/handoff/` files because the full kit was unavailable. The exact archive is now mounted. [`REFERENCE-ARCHIVE-INVENTORY.csv`](REFERENCE-ARCHIVE-INVENTORY.csv) covers every extracted file with path, content hash, size, exact-duplicate group, family, one disposition and basis. It contains 3,570 data rows; `.extracted-complete` is the extraction sentinel, leaving 3,569 archive-content files.

| File-artifact disposition | Rows | Meaning at intake |
| --- | ---: | --- |
| Prototype only | 1,474 | UI/source/assets are reference implementations, not code to ship. |
| Documentation or roadmap only | 1,113 | Prose, PDFs and planning datasets provide requirements or context, not implementation evidence. |
| Duplicate or superseded | 856 | Exact byte duplicates after the first stable path, plus extraction/design-workspace metadata. |
| Intentionally excluded with a repository-backed rationale | 127 | Archive skill, prompt and executable material is not instruction authority and is not run. |
| **Total** | **3,570** | Every extracted path has exactly one file-artifact disposition. |

These are dispositions of files as evidence artifacts. They do not pre-judge the production capability a prototype or document describes. Meaningful rows are tracked separately below and remain open until repository evidence gives each one exactly one allowed disposition.

## Newly mounted meaningful catalogs

| Archive authority claimed | Measured content | Current disposition |
| --- | ---: | --- |
| `handoff/prototype/screens.json` | 281 unique routes in 26 workspaces; generated 2026-10-06 | Reconciled row by row in [`REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md`](REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md): 62 existing but incomplete, 201 prototype only, 13 documentation or roadmap only and 5 intentionally excluded. Archive URLs are not imported. |
| `handoff/registry/capabilities.json` | 122 rows; all say implemented/tested/deployed false; 55 claim backend true and all 122 claim data true | Reconciled row by row in [`REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md`](REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md): 91 existing but incomplete, 10 prototype only, 2 duplicate or superseded, 18 documentation or roadmap only and 1 intentionally excluded. Archive status is not repository evidence. |
| `handoff/capability-blueprint/SEM-01.md`–`SEM-20.md` and CSV | 20 proposed capabilities; all implementation/test/deployment/authorization/enabled fields unverified or not established in the archive | Reconciled in [`REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md`](REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md): 16 existing but incomplete, 2 documentation or roadmap only, 1 blocked externally and 1 intentionally excluded. Repository evidence, not archive status, sets each result. |
| `handoff/capability-blueprint/tenant-isolation-proof-manifest.json` | Zero objects; explicitly illustrative | Documentation or roadmap only; do not treat as tenant-isolation proof. |
| `ui_kits/master-catalog/catalog-data.js` | 673 screen rows, 319 workflow steps, 49 role rows, 88 systems, 82 documents and 84 added-screen rows; prose claims 51 roles | Screens, workflows, roles, systems and documents are reconciled row by row. [`REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.md`](REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.md) closes the latter three populations without adopting archive roles, services or document authorities. |
| Streams `00`–`30` | 31 numbered streams plus index; later files override earlier ordering inside the archive | Documentation or roadmap only; mapped into the user's Phases 0–12, not executed as instructions. |

## Pass 2 meaningful-item coverage

The first capability-level register now covers every meaningful item selected for the Phase 0 seed:

| Population | Rows dispositioned | Result |
| --- | ---: | --- |
| Capability blueprint | 20 / 20 | Production owner, authority, tenant/data boundary, recovery/test evidence, dependency and release ceiling recorded. |
| Stream 00 | 6 / 6 | Current audit/design authorities retained; archive executable procedure excluded. |
| Stream 18 | 23 / 23 | Sixteen requested documents map to current `docs/roles/*`; seven underlying product decisions remain separately honest. |
| Stream 25 | 28 / 28 | Eighteen packages, seven “one” rules and three open decisions map to current authorities. |

The seed identified no production implementation safe to start ahead of capability mapping. Pass 3 completed that 122-row mapping without importing the archive permission vocabulary, pass 4 mapped all 281 prototype routes without adopting archive URLs, pass 5 reconciled all 673 catalog-screen rows, pass 6 reconciled all 319 canonical workflow steps, and pass 7 reconciled all 49 roles, 88 systems and 82 documents. P11 graduate/research education remains missing and in scope but lacks authority/data ownership. Projection/read models are also missing and in scope, but remaining stream-owned dependencies must establish the implementation order.

## Pass 7 role, system and document coverage

The 219-row register classifies roles as 36 existing incomplete, 9 duplicate/superseded and 4 roadmap-only; systems as 84 existing incomplete, 1 missing/in-scope, 2 roadmap-only and 1 excluded; and all 82 document requirements as duplicate or superseded by current repository authorities. No row is existing and verified.

The role mapping validates every grantable analogue against `ROLE-LAUNCH-REGISTER.md` and preserves student-controlled delegated access instead of creating a family role. The system mapping keeps marketplace excluded under `D-1287`, retains developer platform and board reporting as roadmap concepts, and names projection/read models as the sole new system-level buildable gap. The document mapping prevents archive drafts and catalogs from becoming competing sources of truth or implied external approval.

## Current repository mapping baseline

The last full census has 97 app screen-registry keys including `home` and `onboarding`, 62 navigation destinations, 120 non-test screen files, 407 non-test component files, 1,393 `app/src` test files, 203 migrations, 17 edge-function directories and 51 non-test gateway handlers. The migration-rendered role launch register records 69 roles, 96 capabilities and 185 role-capability rows; the older permission matrix's 84/157 heading is stale. Pass 5 merged `origin/main` `e53128a6`, whose changed files do not alter these counted populations. These counts are repository census evidence only; they do not elevate any catalog row to verified.

## Pass 3 capability-registry coverage

All 122 archive registry ids now have one row-level disposition and an evidence profile covering the current owner, role/route/capability boundary, tenant/data authority, operation, audit/recovery/state expectations, tests, dependencies and release ceiling. No full archive row qualifies as existing and verified because the rows combine broad experiences and archive-specific route/data/action claims; verified repository subcontracts remain named without inflating the whole row. The route inventory can now reuse those profiles instead of inventing a second permission model.

The repository catalog remains 589 screens (260 exists / 272 partial / 57 missing) and 319 workflow steps (116 exists / 128 partial / 75 missing). Pass 5 reclassifies screen rows against the stricter integration contract without rewriting the source audit: 534 existing but incomplete (including two consent-bounded advisor analogues), 44 missing and in scope, 1 roadmap-only, 4 externally blocked and 6 excluded. Pass 6 likewise reclassifies workflows as 241 existing incomplete, 54 missing and in scope, 18 roadmap-only, 2 externally blocked and 4 excluded. The archive's prototype routes, catalog screens and canonical workflows remain separate populations.

## Pass 4 prototype-route coverage

All 281 archive prototype routes now have one row-level disposition plus a current owner/profile, screen/navigation evidence, exact catalog matches and capability-register matches. The result deliberately leaves 201 rows prototype-only: one prototype may split a current bounded surface into multiple demonstration, lab or control views, and fuzzy naming does not establish equivalence. Five marketplace routes remain excluded under `D-1287`. The generated route CSV is traceability evidence, not a production route registry or implementation backlog.

## Pass 5 catalog-screen coverage

All 673 archive catalog-screen rows now have one disposition, owner/evidence profile, dependency and acceptance boundary. Structural comparison proves that 589 are exact current-catalog rows and 84 are workflow-step projections declared by the archive itself. Those projections are not independent screen obligations. Forty-four rows are missing and in scope, but remain candidates until the canonical workflow and execution-stream passes determine dependency order. No row is called existing and verified.

## Pass 6 workflow coverage

All 319 canonical archive workflow steps now have one disposition, owner/evidence profile, dependency and acceptance boundary. Structural comparison proves exact ordered equality with the repository workflow audit across all 17 flows. The 84 screen projections resolve to exact workflow indices and remain aliases, not additional obligations. Fifty-four rows are missing and in scope; they overlap the screen candidates. Pass 7 closes the role, system and document catalogs, while remaining execution-stream dependencies still prevent selection. No row is called existing and verified.

## Pass 8 execution-stream coverage

All remaining novel task, behavior, late-addendum, gate and implementation-pattern bundles in Streams 00–30 now have one disposition in `REFERENCE-EXECUTION-STREAM-RECONCILIATION.md`. Exact route, screen, workflow, capability, role, system and document tables keep their canonical row-level registers, so repeated archive screen tables and shared rules are linked rather than double-counted.

Current repository evidence resolves the first shared dependency. Projection P1-01 (private registry/watermark/invalidation/rebuild tables and outbox claim columns) and P1-02 (the sanitized event-emission helper) have landed and are existing but incomplete. Pass 9 implements and verifies P1-03 claim/complete/fail/approval-gated replay operations on the branch, so that slice is **existing and verified locally**. Runner pass 2 adds the first SQL-native producer through that helper: tenant feature-policy insert/update/delete writes one bounded `entitlement.changed` event atomically with its audit fact. Runner pass 3 adds the first registered projector transaction: one private school-scoped entitlement read model whose effect, receipt, monotonic watermark and invalidation commit atomically, with delayed earlier events settled as skipped. Runner pass 4 adds a service-only batch and POST-only Edge Function capped at 25 matching events; runner pass 5 adds manual, service-only P1-05 retention for published history, receipts and invalidations with pending/dead-letter and legal-hold preservation. Automation pass 6 adds P1-06: accepted tenant-rollout transitions now emit a history-bound `tenant_rollout.changed` fact and a second private school-scoped projector, and the same dormant worker dispatches only those two exact handlers within its existing 25-row bound. Automation pass 7 adds P1-07: one bounded, exact-tenant read envelope over both private projections with computed `fresh`, `stale`, `failed` and `unknown` states. Activation, UI consumption, additional domain producers/projectors and other query models remain separate missing-and-in-scope slices. Course Studio remains the first domain cluster after the projection foundation; P11 remains non-ready pending owner and authority contracts.

Automation passes 31–42 and integration slices 51–53 close bounded parts of the shared consequence-pattern gap. Assignment-workspace, research-project and dataset deletion in the existing AI Toolkit, device-only filed-feedback deletion, device-only assistant-conversation deletion, whole Student Operating workspace deletion, single-plan/whole-rhythm deletion in Operating Rhythm, the reachable Today daily-plan deletion, student-owned Applications-tracker deletion, owner-checked Community-post deletion, owner-scoped published-form withdrawal, student-owned Opportunities-tracker deletion, Start Here result/private Learning Map concept deletion, saved Term-plan schedule deletion and custom Drive folder-hierarchy deletion now use the repository's governed `ConfirmDialog` and `ActionPreview` with exact scope, non-effects and recovery language. Drive confirmation preserves file bytes and links, moves every direct or nested file to the deleted folder's parent, stops before hierarchy removal when a file move fails and names the manual-only organization recovery boundary. Connected-calendar and student-created-link removal instead follow the repository's preferred reversible-work contract: bounded eight-second Undo snapshots restore respectively the selected calendar plus its imported events, and the exact custom link plus its group and corrected address, without reverting unrelated state. Both controls have exact accessible names. The existing mutations are unchanged and no new server or provider behavior is inferred. These bounded actions are **existing and verified locally**; permanent file purge and other consequential actions remain separate rows and slices.

## Course Engine current-artifact reconciliation

The repository gained a separate `course-engine/` MVP at `b190f96a`. It is not mounted-archive code, but it overlaps Course Studio requirements and therefore had to be reconciled before selecting that domain slice. [`REFERENCE-COURSE-ENGINE-RECONCILIATION.md`](REFERENCE-COURSE-ENGINE-RECONCILIATION.md) covers its sixteen meaningful families and records why its 15-route Next.js/Tailwind shell, separate JWT identity, 21-entity Alembic model and Compose topology are not integration targets.

The reconciliation preserves useful current-product evidence: Semester's existing Import path accepts multiple syllabus/readings, holds dates for review and explicit confirmation, and retains source excerpts; Study Studio selects multiple sources, checks course AI policy and exact quotations, and saves editable source-linked drafts. Those behaviors remain existing but incomplete because server-side course/source persistence, approved storage/scanning/retention, exact request-context and course-relationship enforcement, correction propagation and operating evidence are not complete. The next dependency is the repository-native `student-files` / `course-materials` authority contract, followed by a bounded extension of current Import and Study Studio—not a new route or parallel course model.

Automation pass 10 implements and tests that pre-ingestion authority in `app/server/course-sources/contract.ts` and [`COURSE-SOURCE-AUTHORITY.md`](../COURSE-SOURCE-AUTHORITY.md). It reuses the platform file engine; binds student sources to exact course-row ownership and tenant membership; binds shared course material to exact course-scoped publication authority and a versioned retention policy; requires idempotency and rate-limit approval; restricts server intake to bounded document types; reserves quarantine/scan settlement to a tenant-bound service; rejects type, scan and integrity failures; and records hash-linked corrections plus content-free audit facts. This changes CE-05's authority sub-contract from missing to locally verified, but CE-05 remains **existing but incomplete** because no metadata schema/RLS, bucket, scanner, extraction worker, route, current-screen wiring, deployment or operating evidence exists.

Automation pass 11 implements the student-owned half of CE-05's persistence boundary in `20261008234500_course_source_persistence.sql`. Student metadata, correction revisions and idempotency facts are now **existing and verified locally** through service-only controlled functions, deny-by-default RLS, current course/membership rechecks, hash-linked correction ordering, 30-day recovery, legal-hold refusal and transactional pseudonymous audit. CE-05 as a whole remains **existing but incomplete**: shared `course-materials` still lacks a current versioned retention-policy authority, and neither bucket policy, byte storage, scan settlement, extraction, route/read boundary, current-screen wiring, deployment nor operating evidence exists.

Automation pass 12 adds the student-source storage-receipt and scan-settlement persistence transitions in `20261009000000_course_source_scan_settlement.sql`. This bounded portion of CE-05 is **existing and verified locally**: only service role can record a tenant-matching receipt or settle a quarantined source; current course membership is rechecked; retries are request-hash idempotent; audit and state commit atomically; and availability requires an allowlisted exact type match plus equal stored/scanned SHA-256 under a named clean scanner. Rejections remain unreadable. CE-05 remains **existing but incomplete** because no bucket, object, scanner, extraction runtime, route/read boundary, current-screen wiring, deployment or operating evidence exists, and shared `course-materials` remains closed.

Automation pass 29 closes the confirmed-correction propagation prerequisite inside CE-07/CE-08 without claiming an extractor. `20261009020000_course_source_correction_bindings.sql` binds every new derived-snapshot receipt to a deterministic count and SHA-256 of the append-only correction chain under the source lock. Conflict recording rejects legacy or stale receipts when the current correction state differs. This is **existing and verified locally** as an integrity sub-contract; CE-07 and CE-08 remain **existing but incomplete** until a trusted runtime incorporates those corrections, current screens use the server path and external reconciliation/publication is proven.

Automation pass 30 reconciles the full repository gates without widening that capability claim. The ordered and shuffled suites are now green at 23,872 passing tests each; the current 222-migration history reapplies with 380 unchanged table fingerprints; generated role/control registers and support copy match their sources; and migration filenames no longer violate the repository's schema-snapshot guard. This strengthens local verification for CE-05/CE-07/CE-08 but does not supply a scanner, extractor, authenticated adapter, deployment or production evidence, so their existing-but-incomplete dispositions do not change.

Automation pass 3 / integration slice 54 extends the shared consequence/recovery pattern to Kept formulas without changing capability breadth. One device-owned `equations` row now enters the existing eight-second Undo path, restoring its formula, note and course/deadline filing while leaving calculator work and unrelated state intact. This bounded path is **existing and verified locally** by a proved-red regression, 142/142 focused tests and green type/lint/university/build plus 78 token/design constituents. Equation removal remains device-local; no server persistence, external-system mutation, deployment or production operation is inferred.

Automation pass 13 adds the versioned tenant authority that the shared-material contract previously lacked. `20261009001500_course_material_retention_policy.sql` consumes one approved `tenant-policy` request under `console:operate`, fresh MFA, exact tenant/target/detail binding and fail-closed audit, then appends an active or withdrawn private version. The service-only resolver fails closed to no row when authority is absent or withdrawn. This policy sub-contract is **existing and verified locally**; shared `course-materials` remains **missing and in scope** until metadata and controlled lifecycle operations bind the exact policy version and exact course-scoped publication authority. No storage/scanner/runtime or route evidence is inferred.

Automation pass 14 adds that bounded shared-material metadata/lifecycle layer in `20261009003000_course_material_metadata.sql`. It is **existing and verified locally** for metadata only: the service rechecks current exact `course:publish` scope and current expected retention-policy version, binds one tenant/course/term and the original policy duration, records idempotent plan/withdraw/restore history, and commits pseudonymous content-free audit atomically. Policy withdrawal closes new intake/restore without rebinding existing rows, and metadata cannot be physically deleted before a separate hold-aware purge exists. CE-05 remains **existing but incomplete** because the `course-materials` bucket, objects, trustworthy storage/scanner runtime and receipts, extraction, signed reads, route/rate-limit boundary, current-screen wiring, deployment and operating evidence remain absent.

Automation pass 15 adds the deny-by-default Storage boundary in `20261009004500_course_source_storage_buckets.sql`. The two bucket definitions are **existing and verified locally**: both are private, repair configuration drift idempotently, use the current classification caps and exact five-type course-document allowlist, expose no repair function to runtime roles and grant no browser object policy. CE-05 remains **existing but incomplete** because no byte, trustworthy adapter/scanner receipt, extraction, signed read, route/rate-limit boundary, current-screen wiring, deployment or operating evidence exists. Local bucket definitions are not production bucket evidence.

Automation pass 16 advances CE-08's current re-import behavior without claiming server ingestion. `Import.tsx` and `rediff.ts` now treat moved and disappearing deadlines as explicit source conflicts: each requires an un-defaulted keep-current/use-imported choice, unresolved conflicts disable save and the pure merge guard refuses incomplete decision maps. Chosen current reminders survive, imported moves preserve stable ids/ticks, dropped dates participate in the recalculated conflict set and cross-year moves use actual item years. This bounded date-conflict path is **existing and verified locally**; after slice commit `4c258362`, current `origin/main` `27be630d` merged without conflict and the combined head passed 72/72 focused Course Engine/document tests plus the TypeScript, lint, university and build gates. Course metadata/grading conflict choices, server-authoritative conflict records, external reconciliation and safe ICS publication remain incomplete. The absent document-malware scanner remains an external gate and no receipt is synthesized.

Automation pass 17 extends CE-08's same fail-closed review to course metadata and grading. Every changed extracted course field, including the course-site URL, and every reweighted, added or removed grading row now requires an un-defaulted keep-current/use-imported choice. The pure merge boundary rejects incomplete maps and applies mixed choices per value; current term and student-recorded course AI policy survive because syllabus extraction does not own them. This metadata/grading subpath is **existing and verified locally** by a proved-red regression guard, 31/31 directly changed tests, 60/60 broader focused contracts and green TypeScript/lint/university/build plus design constituents. Reworded task titles, server-authoritative conflict records, external reconciliation and safe ICS publication remain incomplete; no server ingestion or official-record authority is inferred.

Automation pass 18 extends CE-08 to reworded deadline titles. Every confidently paired title change, including one combined with a date move, now requires an un-defaulted stable-id choice. Title and date decisions apply independently while the current item id and completion-tick relationship survive. This title subpath is **existing and verified locally** by a proved-red guard, 35/35 directly changed tests, 39/39 broader focused Import contracts and green TypeScript/lint/university/build plus design constituents. Changed due times, durable server conflict records, external reconciliation and safe ICS publication remain incomplete; the separately merged Course Engine shell does not make this current-product path server-backed or official.

Automation pass 19 extends CE-08 to changed deadline due times. Every changed time on a confidently paired item, including one whose title and calendar date also changed, now requires an un-defaulted stable `time:<current-id>` choice. Time, title and date decisions apply independently; keeping a current date cannot implicitly override an explicit imported-time choice, and the current item id/tick relationship survives. This time subpath is **existing and verified locally** by a proved-red guard, 38/38 directly changed tests, 109/109 broader focused Import/course contracts and green TypeScript/lint/university/build plus design constituents and report. Remaining item metadata, durable server conflict records, external reconciliation and safe ICS publication remain incomplete; no server ingestion or official-record authority is inferred.

Automation pass 20 extends CE-08 to the paired deadline category (`kind`). The student-approved current course copy remains authoritative until the student explicitly chooses the newly extracted syllabus value; every changed kind now requires an un-defaulted stable `kind:<current-id>` choice and is no longer counted as unchanged. The merge applies that choice independently from date, title and due time while preserving the current item id/tick relationship. This deadline-type subpath is **existing and verified locally** by a proved-red guard, 41/41 directly changed tests, 178/178 broader focused Import/course contracts and green TypeScript/lint/university/build plus 78 token/design constituents. Weight/location/detail and quote/source provenance, durable server conflict records, external reconciliation and safe ICS publication remain incomplete; no server ingestion or official-record authority is inferred.

Automation pass 21 extends CE-08 to paired deadline-level `weight`, which repository consumers use as student planning data and which remains separate from course grading-table rows. Every changed item weight now requires an un-defaulted stable `weight:<current-id>` choice in a namespace separate from `grading:*`; the merge applies that choice independently while preserving the current item id/tick relationship. This deadline-weight subpath is **existing and verified locally** by a proved-red guard, 44/44 directly changed tests, 99/99 broader focused Import contracts and green TypeScript/lint/university/build plus 78 token/design constituents. Location/detail and quote/source provenance, durable server conflict records, external reconciliation and safe ICS publication remain incomplete; no server ingestion or official-record authority is inferred.

Automation pass 22 extends CE-08 to paired deadline-level `where`, which is deadline planning data and remains separate from course room metadata. Every changed item location now requires an un-defaulted stable `where:<current-id>` choice; the merge applies that choice independently from date, title, due time, type, weight and course fields while preserving the current item id/tick relationship. This deadline-location subpath is **existing and verified locally** by a proved-red guard, 47/47 directly changed tests, 221/221 broader focused Import/course/document contracts and green TypeScript/lint/university/build plus 78 token/design constituents. Free-form detail and quote/source provenance, durable server conflict records, external reconciliation and safe ICS publication remain incomplete; no server ingestion or official-record authority is inferred.

Automation pass 23 extends CE-08 to paired deadline-level `detail`, which repository consumers use as student-facing deadline context and which remains separate from the verbatim quote, checked citation locator and source label. Every changed item detail now requires an un-defaulted stable `detail:<current-id>` choice; the merge applies that choice independently from date, title, due time, type, weight, location and course fields while preserving the current item id/tick relationship. This deadline-detail subpath is **existing and verified locally** by a proved-red guard, 50/50 directly changed tests, 153/153 broader focused Import/document/source contracts and green TypeScript/lint/university/build plus 78 token/design constituents. Quote/source provenance, durable server conflict records, external reconciliation and safe ICS publication remain incomplete; no server ingestion or official-record authority is inferred.

Automation pass 24 extends CE-08 to paired deadline provenance as one integrity-preserving bundle: verbatim `quote`, its `checked` confirmation/document/page locator and the `source` label. A change to any field, including only the locator, now requires one un-defaulted stable `provenance:<current-id>` choice; keep-current and use-imported each move the entire bundle without mixing evidence from syllabus versions, while the current item id/tick relationship survives. This provenance subpath is **existing and verified locally** by a proved-red guard, 54/54 directly changed tests, 176/176 broader focused Import/source contracts and green TypeScript/lint/university/build plus 78 token/design constituents. Durable server conflict records, external reconciliation and safe ICS publication remain incomplete; no server ingestion, signed-read or official-record authority is inferred.

Automation pass 25 advances CE-08's durable-decision prerequisite without calling the re-import server-backed. A private source-pair batch now binds the student, active tenant/course relationship, two available hash-settled sources, two distinct derived snapshot hashes and 1–256 stable conflict keys; append-only rows store only keep-current/use-imported choices. Service-only recording and withdrawal are idempotent, audit-bound, atomic and deny browser access; withdrawal voids rather than erases evidence. This persistence boundary is **existing and verified locally** by 24 focused and 179 adjacent PostgreSQL 17 checks, migration reapply stability and current repository gates. The current Import route still applies to the local course store, so a server-side apply command, browser adapter, external reconciliation and safe ICS publication remain incomplete; no production ingestion or official-record authority is inferred.

Automation pass 26 closes CE-08's local server-side apply/recovery contract. An active hash-bound batch now derives and atomically replaces the existing private `courses` document through service-only SQL after current relationship/source revalidation; it preserves stable course/item identities, leaves the separate completion map untouched, audits/idempotently receipts the transition and keeps a private 30-day rollback copy that refuses to overwrite later edits. The focused PostgreSQL 17 suite passes 17 checks after catching and correcting a cumulative-choice bug. CE-08 remains **existing but incomplete** because no private authenticated/rate-limited adapter, current Import wiring, deployment, operating evidence, external reconciliation or safe ICS publication exists; automatic expiry of an unused recovery copy is also still open.

Automation pass 27 closes that local recovery-retention subpath. A manual service-only operation clears an unused prior course document only after its exact 30-day window, marks the application evidence expired and preserves its hashes and batch linkage. It serializes against legal-hold changes; platform, exact-tenant and owner-account holds preserve covered copies. The guard was proved red before implementation, then passes 9 focused and 135 adjacent PostgreSQL 17 checks with all 220 migrations reapplying without schema or row drift. CE-08 remains **existing but incomplete** because no scheduler/deployment/production run, private authenticated/rate-limited adapter, current Import wiring, trustworthy storage/scanner runtime, external reconciliation or safe ICS publication exists.

Automation pass 28 adds a hash-only source-to-snapshot authority before any browser adapter. A service-only append records the exact available source hash, derived snapshot hash, revision and bounded named extractor version after current tenant/course relationship revalidation; no extracted text or course document is stored. Conflict recording now refuses an imported snapshot hash without that exact append-only receipt. This prerequisite is **existing and verified locally** by 17 focused and 215 adjacent PostgreSQL 17 checks, migration reapply stability and 72 repository guards. CE-06 and CE-08 remain **existing but incomplete** because no real scanner/extractor produced a receipt, no authenticated/rate-limited adapter or current Import wiring exists, and deployment, external reconciliation and safe ICS publication remain unverified.

## How a row was classed

| Disposition | Meaning here |
| --- | --- |
| Existing and verified | A reachable implementation plus a named test or policy suite that fails when the behaviour is removed. |
| Existing but incomplete | Something real is reachable, and a material part of the release definition is absent. Catalog `exists` is this class: the audit says that word is not a test result. |
| Missing and in scope | Repository evidence shows the item is absent, current authority permits it, and its dependencies and acceptance evidence can be named. |
| Prototype only | A handoff file describes it. Production does not route it. The kit HTML is not in this repository. |
| Duplicate or superseded | The repository already has the contract. The handoff copy is not imported. |
| Documentation or roadmap only | The item supplies planning context but is not authorized product scope or implementation evidence. `D-1287` §4 answers four concepts "no" and `D-1298` withdraws the free-text scanner. |
| Blocked by external authority, credentials, vendor, environment, legal review, staffing, or institutional decision | The repository cannot truthfully complete the item without the named external prerequisite. |
| Intentionally excluded with a repository-backed rationale | Current repository authority rejects the item or its proposed implementation pattern; the supporting decision or contract is recorded. |

## Earlier committed-handoff baseline

Before this archive was mounted, the 2026-10-05 crosswalk could inspect only the 139 committed files under `docs/handoff/`; `D-1287` records that boundary. The authenticated archive inventory above supersedes that availability statement without changing the rule that archive source is reference-only.

That earlier tree had 119 non-test screen files, 382 non-test components, 1,356 tests, 184 migrations and 16 edge-function directories. Those historical figures remain useful for provenance but are not current counts; use the refreshed census above.

Audit totals, not re-judged row by row here: screens 260 / 272 / 57 (589). Workflow steps 116 / 128 / 75 (319).

## Catalog groups

Row-level notes stay in `REPO_AUDIT.md`. Catalog `exists` is existing but incomplete against the 22-point definition.

| Group | Audit exists / partial / missing | Disposition |
| --- | --- | --- |
| A · Public company site (80) | 53 / 26 / 1 | Existing but incomplete. Claims stay inside the approved register. The Pilot page is missing as an app route. |
| B · Student OS (70) | 60 / 10 / 0 | Existing but incomplete. Term Plan is the Registration planner (`yes`): the tab and heading say Term plan, and the cart names a time conflict before the sections. |
| C · Faculty and Course Studio (36) | 8 / 18 / 10 | Existing but incomplete. |
| D · Advisor and student success (25) | 3 / 13 / 9 | Existing but incomplete. Advisor Caseload is the shared-plan list on the degree meeting tab. It is not a school-wide roster. |
| E · Registrar (35) | 13 / 19 / 3 | Existing but incomplete. User-entered plans are not SIS data. |
| F · Accounts, aid, commerce (29) | 20 / 8 / 1 | Existing but incomplete. |
| G · Campus life (35) | 17 / 13 / 5 | Existing but incomplete. A general events table is not authorized. |
| H · Community and moderation (29) | 20 / 6 / 3 | Existing but incomplete. Marketplace is not revived. |
| I · Family and guardian (12) | 7 / 3 / 2 | Existing but incomplete. |
| J · Career, employer, alumni (40) | 12 / 18 / 10 | Existing but incomplete. |
| K · Institutional administration (41) | 9 / 31 / 1 | Existing but incomplete. |
| L · Integrations (28) | 6 / 19 / 3 | Existing but incomplete. Live connectors are blocked. |
| M · Trust, privacy, security (48) | 20 / 22 / 6 | Existing but incomplete. Accessibility conformance is not claimed. |
| N · Operations command center (81) | 12 / 66 / 3 | Existing but incomplete. Company roles in the handoff are not authorized now. |

Developer platform and marketplace (0 / 3 / 13) is a roadmap concept. Incident response (0 / 8 / 9) is existing but incomplete and partly blocked on staffing and a restore drill. Controlled integration (0 / 20 / 0) is existing but incomplete and blocked on vendor configuration.

## Design deliverables and named screens

`MASTER-BRIEF-CROSSWALK.md` places the 19 deliverables. Authority stays `app/src/lib/look.ts`, then `app/src/styles/tokens.css`. The handoff palette is offered, not the default (`D-1293`).

`SCREEN-PACKS.md` names 18 screens. Term Plan is the Registration planner (`yes`): the tab and heading say Term plan, and the cart names a time conflict before the sections. The folded advisor list on the degree meeting tab is labeled Caseload and lists only plans a student shared. `SCREEN-PACKS.md` §4 records the rest: a school-wide caseload is blocked on institution advisor–student data and consent; Tenant Overview and Operations Inbox exist in part and are not retitled; the Institutional Pilot page is routed pages on the company site. Kit paths are prototype only and have not been copied into the production repository.

## Handoff tree (139 files)

| Path | Files | Disposition |
| --- | --- | --- |
| `docs/handoff/execute/` | 15 | Roadmap for streams 00–13. Streams 00 and two slices of 01 have reports. Later streams are not authorization to copy. |
| `docs/handoff/semester-core/` | 11 | Duplicate or superseded where the repo has `lib/source.ts`, `lib/policy.ts`, and approvals SQL. Remaining ports are still open (provenance ranking, projection lag, consequence pattern). |
| `docs/handoff/semester-platform/` | 25 | Reference. Migrations `010`–`080` are not applied. `lib/ai/redact.ts.txt` is not imported (`D-1298`). |
| `docs/handoff/workflow-router-app/` | 64 | Prototype only. A second Next app is not created. |
| `docs/handoff/claude-code-toolkit/` | 17 | Duplicate of instructions already in `.claude/skills/` and `docs/design-system/`. |
| `install.sh`, `BUILD.md` | — | Not run as shipped (`D-1287`). |

`docs/master/*` business, launch, and 12-month documents are roadmap or business concepts unless a row in `REPO_AUDIT.md` points at code. The 2026-10-08 projection foundation, event helper, feature-policy and tenant-rollout producers, two registered projector transactions, bounded dormant endpoint, manual hold-aware retention operation, first permissioned tenant query envelope and exact-tenant Console consumer supersede the older master-current-state sentence that says all registry/watermark infrastructure is absent. A schedule, activated worker and operating deployment are still absent.

## Stream 01 work list

The diff is `docs/execute/01-platform-core-diff.md` §4. Section 8 corrects three rows. `D-1298` and the stream 01 report, as they stand on this base, override the "largest gap" sentence that report used to carry.

| Item | Disposition |
| --- | --- |
| `institutions.features` jsonb | Duplicate or superseded. Flags are rows. |
| `core.profiles` | Duplicate or superseded. `public.profiles` and membership exist. |
| Per-field visibility, campus directory | Roadmap or business concept. `D-1287`. |
| `feature_on` | Duplicate or superseded. `feature_state` exists. |
| Blanket anon revoke | Not pursued as a blanket. `supabase/rls-coverage.check.sql` records why: `private.form_open()` admits a visitor with no account, and revoking anon execute on `private` would break that form. Anon DML grants remain behind RLS. |
| `community.events` | Roadmap or business concept. Reuse `community_sessions`. |
| `ops.social_posts`, crisis-mode settings | Roadmap or business concept until stream 08. |
| `ai_policy.student_id_pattern` | Not authorized with the scanner. `D-1298` withdrew the row. |
| `audit.ai_usage` | Existing but incomplete. Institution gateway writes a content-free row. Shared-key path keeps monthly totals. |
| `student-files`, `course-materials` buckets | Existing and verified locally as private, deny-by-default bucket definitions with exact caps/types and no browser object policy. Production provisioning, stored bytes and a trusted adapter/scanner runtime remain unverified. |
| Evidence bucket | Duplicate or superseded. `trust-packet` is the pattern. |
| Free-text scan (`lib/ai/redact.ts`) | Not built. `D-1298`: the class gate does not read free text on purpose. A drafted scan on this branch was discarded before push. |
| Provenance ladder and conflict resolution | Existing but incomplete. Five source labels, no ranked conflict pick. |
| Freshness windows | Duplicate or superseded. Callers pass `maxAgeMs`. |
| Projection-lag freshness | Missing. |
| Next-action scoring | Existing but incomplete. |
| Access matrix | Duplicate or superseded as a second matrix. |
| Break-glass two-person | Existing and verified in SQL. `decide_approval` plus `console-approvals.check.sql`. |
| Consequence pattern | Existing but incomplete. `ActionPreview` is used inside leave-university, approve-join and sign-out-other-devices dialogs, all three AI Toolkit irreversible local deletions, device-only filed-feedback and assistant-conversation deletion, device-only Support emergency-contact removal, Advisor Meeting preparation deletion, whole Student Operating workspace deletion, single-plan plus whole-rhythm Operating Rhythm deletion, the reachable Today daily-plan deletion, student-owned Applications- and Opportunities-tracker deletion, the owner-checked Community-post deletion, owner-scoped published-form withdrawal, Start Here result plus private Learning Map concept/question deletion and saved Term-plan schedule deletion. The shared Undo path now covers connected-calendar, student-created-link, saved-equation, committed Study-plan, nested task-step, Semester Mail rule, student-entered Bill-row, registrar-date, graph-line, graph-wide Clear, custom-school, university-pack, Study-evidence and opportunity-suggestion removals with bounded snapshots that preserve unrelated state. Other confirmations still write their own sentences; permanent file purge and the same-origin demo reset need separate retention/isolation/recovery reconciliation before selection. |
| AI class gate | Existing and verified. Ceiling T2. It does not read prose. |
| Approvals state machine | Existing and verified in SQL. |
| Red-team corpus for blocked prompts | Not ported. It depended on the scanner `D-1298` declined. |
| CI grep guards | Existing and verified. `boundaries.test.ts`. |
| COOP header | Blocked on an LTI new-window test. Not added. |
| Company-role student reads | Existing and verified by `company-roles-student-data.check.sql`. Slice 2 probes 64 tables. Slice 3 (`D-1303`) keys on fifteen owner-column names and probes 79. `created_by`, `subject`, `owner_id` and `account_id` stay unswept because they mostly name the staff who wrote the row. `course_review_authors` / `moderator` is recorded, not changed: the privacy owner decides whether each read is audited. `community_volunteers` / `trust_safety_reviewer` is still to narrow. |

## Phase 0 documents already on main

`docs/master/SEMESTER_PDF_RECONCILIATION.md`, `SEMESTER_SOURCE_OF_TRUTH.md`, `SEMESTER_MASTER_CURRENT_STATE.md`, `SEMESTER_GAP_AND_STATUS_REGISTER.md`, `SEMESTER_ROLE_SCREEN_WORKFLOW_MATRIX.md` and `SEMESTER_EXECUTION_ROADMAP.md` landed in #1305. They do not replace this page. The matrix §3 is the component-name map: 18 PDF names match an export, 13 have an equivalent under another name, and the rest are not created here. A new shared component still needs `docs/design/GOVERNANCE.md` §2. The projection worker is locally implemented but dormant; two private tenant read models, their first permissioned read envelope and a read-only exact-tenant Console consumer now exist locally. Deployment, scheduling, monitoring and production freshness evidence remain absent.

## Blocked outside the repository

Legal review, DPA, insurance, HECVAT, named institutional contacts, live IdP, live SIS/LMS, production cutover, HawkScan for this change, accessibility conformance review, restore drill, and staffing for incident response. None of these is claimed.

## Not complete

The source audit still records 57 missing screen rows and 75 missing workflow steps. Pass 5 dispositions the screen set as 44 missing and in scope, 4 externally blocked, 6 excluded, 1 roadmap-only and 2 consent-bounded existing analogues. Pass 6 dispositions the workflow set as 54 missing and in scope, 18 roadmap-only, 2 externally blocked, 4 excluded and 241 existing incomplete. Role, system, document and execution-stream reconciliation are closed for the identified populations, but implementation is not: P1-07 and slice 16 supply only the first projection query/Console read path, while slices 18–19 supply a pre-ingestion contract plus private student-source metadata/correction/recovery persistence—not storage, scanning, extraction, routes or current-screen wiring. The buildable screen/workflow candidates remain open. The five brief names that looked absent are recorded in `SCREEN-PACKS.md` §4. The folded advisor list is labeled Caseload and is shared plans only. This page does not say the handoff is integrated.

## Pass 5 current-product consequence mapping — integration slice 56

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for removing student-added course material | `app/src/screens/Update.tsx`, `app/src/state/slices/library.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: the **Already added** row now dispatches one bounded `removeUpdate` transition for the selected `CourseUpdate` plus only its recorded `addedItems`, and the shared eight-second Undo restores the pair. The source file and unrelated course data remain outside the mutation. Reducer and rendered-control guards are included in the 140 focused passing tests. |
| Source Locker material/file cascade | `app/src/components/SourceLocker.tsx`, `app/src/lib/source-locker.ts` | Existing but incomplete and intentionally separate from this slice. File trash, generated-item cascade and recovery semantics remain authoritative there; `deleteUpdate` is retained for that plan rather than silently adopting the Add Material Undo boundary. |

This mapping adds no archive route, role, capability, schema or provider claim. Deployment, HawkScan, external ingestion/scanning and institutional readiness remain unverified.

## Pass 6 current-product consequence mapping — integration slice 57

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for removing a student-created emergency contact | `app/src/screens/Support.tsx`, `app/src/lib/device-library.ts`, `app/src/lib/support.ts` | Existing but incomplete is narrowed: the immediate device-library filter now follows the shared preview-and-choice pattern. The preview binds the selected name and phone number, preserves the remaining Support data and official records, and states the repository-backed lack of workspace-backup recovery. The rendered guard proves cancel/no-write and confirm/one-contact removal. |
| Support workspace backup/recovery | `app/src/lib/workspace-backup.coverage.test.ts` | The explicit `semester.support.v1` exemption remains authoritative. This slice does not add the sensitive Support module to portable backup or claim an Undo path; recovery is limited to manually re-adding details the student still knows. |

This mapping adds no archive route, role, capability, schema or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 7 current-product consequence mapping — integration slice 58

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for removing one student-created task step | `app/src/screens/Mine.tsx`, `app/src/state/slices/mine.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `dropStep` now enters the shared eight-second Undo path and snapshots only `tasks`. It uses `onChange` because the nested row disappears while the top-level task count remains constant. Undo restores the exact step text, completion state and order without reverting unrelated completion state. |
| Whole-task removal and broader recovery | `app/src/lib/undo.ts`, `app/src/components/Undone.tsx` | Existing and unchanged. Whole-task deletion already has its own `deleteTask` Undo entry; this slice adds no history stack, backup claim, server persistence or cross-device rollback. |

This mapping adds no archive route, role, capability, schema or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 8 current-product consequence mapping — integration slice 59

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for deleting a student-created Semester Mail rule | `app/src/components/mail/Rules.tsx`, `app/src/state/slices/mailbox.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `dropMailRule` now enters the shared eight-second Undo path and snapshots only `mailRules`. Undo restores the exact search/action rule and order while preserving later message marks. The two red-before-green assertions and reducer integration guard are included in 164 focused passing tests. |
| Provider and mailbox history boundary | `app/src/lib/mailrules.ts`, `app/src/lib/mailbox.ts` | Existing and unchanged. Rules are an account-local derived layer beneath explicit message marks; deleting or restoring one does not mutate provider mail, replay historical effects or overwrite later read, star, label, folder or snooze actions. |

This mapping adds no archive route, role, capability, schema or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 9 current-product consequence mapping — integration slice 60

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for deleting student-entered bill-planning rows | `app/src/screens/Bill.tsx`, `app/src/state/slices/mine.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `dropCharge`, `dropAid` and `dropPayment` now use the shared eight-second Undo path. Each snapshots only `charges`, `aid` or `payments`; Undo restores the exact row and order while preserving later changes in the other bill lists. The red-before-green registry/snapshot guard and reducer integration are included in 295 focused passing tests. |
| Official finance and payment boundary | `app/src/lib/bill.ts`, `app/src/screens/Bill.tsx`, `app/src/lib/export.ts` | Existing and unchanged. These rows are student-entered planning data, carry the `student_entered` provenance label and are covered by the core export. They do not edit a university ledger, determine official aid, process a payment or claim provider reconciliation. |

This mapping adds no archive route, role, capability, schema, server operation or provider claim. Deployment, HawkScan, official finance integration, external approvals and institutional readiness remain unverified.

## Pass 10 current-product consequence mapping — integration slice 61

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for clearing one student-managed Registrar date | `app/src/screens/Registrar.tsx`, `app/src/state/slices/library.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `dropTermDate` now uses the shared eight-second Undo path and snapshots only `registrar`. `onChange` covers the built-in landmark case where the row remains but both dates are blanked; the same contract restores a removed student-added row and its original order. The repeated Clear controls expose row-specific accessible names. The red-before-green registry guard and reducer integration are included in 184 focused passing tests. |
| Official academic-calendar and registration-record boundary | `app/src/lib/registrar.ts`, `app/src/lib/governance/capability-governance.ts` | Existing and unchanged. The landmarks and student-entered dates are a private planning sheet; clearing or restoring one does not alter the institution's authoritative calendar, enrollment, add/drop status or registration record. |

This mapping adds no archive route, role, capability, schema, policy, server operation or provider claim. Deployment, HawkScan, official registrar integration, external approvals and institutional readiness remain unverified.

## Pass 11 current-product consequence mapping — integration slice 62

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for removing one student-authored graph line | `app/src/components/Grapher.tsx`, `app/src/state/slices/made.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `dropPlot` now uses the shared eight-second Undo path and snapshots only `plots`. Undo restores the exact expression, visibility state and order while preserving later calculator work. The existing row control already exposes its exact position through an accessible name. The red-before-green registry/snapshot guard and reducer integration are included in 157 focused passing tests. |
| Graph-wide clearing and external authority boundary | `app/src/components/Grapher.tsx`, `app/src/lib/onegraph.test.ts` | Existing and unchanged. This slice does not make the separate all-lines Clear action recoverable, create a second graph implementation, edit course/grade records or invoke any provider or institution system. |

This mapping adds no archive route, role, capability, schema, policy, server operation or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 12 current-product consequence mapping — integration slice 63

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for clearing every student-authored graph line | `app/src/components/Grapher.tsx`, `app/src/state/slices/made.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: the graph-wide Clear control now dispatches a dedicated `clearPlots` transition through the shared eight-second Undo path. It snapshots only `plots` and restores all expressions, visibility states and list positions without reverting later calculator work. Example loading remains the separate non-destructive `setPlot` path. The red-before-green UI, registry, snapshot and reducer guards are included in 145 focused passing tests. |
| Graph authority and external boundary | `app/src/lib/onegraph.test.ts`, `app/src/components/Grapher.tsx` | Existing and unchanged. The repository still has one graphing implementation and this local recovery path does not edit course work, grades, submissions, provider data or institution records. |

This mapping adds no archive route, role, capability, schema, policy, server operation or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 13 current-product consequence mapping — integration slice 64

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for forgetting one student-created school profile | `app/src/components/SchoolPicker.tsx`, `app/src/state/slices/settings.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `forgetSchool` now enters the shared eight-second Undo path and snapshots exactly `mySchools` plus `schoolId`. Undo restores the exact custom profile, order and active selection while preserving unrelated work. The existing row control already exposes the school's name to assistive technology. The red-before-green registry/snapshot guard and reducer integration are included in 217 focused passing tests. |
| Institution-authored school-pack and provider boundary | `app/src/components/SchoolPackDoor.tsx`, `app/src/state/slices/settings.ts`, `app/src/lib/schoolpack.ts` | Existing and unchanged. This slice does not restore, remove or reclassify an institution-authored pack, claim current institutional data, mutate a server/provider record or change capability authority. Pack removal remains a separate provenance/recovery decision. |

This mapping adds no archive route, role, capability, schema, policy, server operation or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 14 current-product consequence mapping — integration slice 65

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for removing one loaded university file | `app/src/components/SchoolPackDoor.tsx`, `app/src/state/slices/settings.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `forgetSchoolPack` now enters the shared eight-second Undo path and snapshots exactly `schoolPack`. Undo restores the exact institution-authored snapshot and import date while preserving later unrelated work. The red-before-green registry/snapshot guard and reducer integration are included in 165 focused passing tests. |
| School selection, provenance and external authority boundary | `app/src/lib/schoolpack.ts`, `app/src/state/slices/settings.ts` | Existing and unchanged. Removal and restoration leave `schoolId` intact, use the existing bundled/custom fallback, do not upgrade file verification or freshness, and do not mutate a server, provider or institution record. Import review and current institutional data remain separate authority questions. |

This mapping adds no archive route, role, capability, schema, policy, server operation or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 15 current-product consequence mapping — integration slice 66

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for dismissing one shipped opportunity suggestion | `app/src/components/Suggested.tsx`, `app/src/state/slices/settings.ts`, `app/src/lib/undo.ts` | Existing but incomplete is narrowed: `dismissProgramme` now enters the shared eight-second Undo path and snapshots exactly `wanted`. Change detection covers the nested dismissal, and Undo restores the exact dismissed list plus year/field filters while preserving unrelated work. The existing **Not for me** control remains keyboard-operable and named by visible text. The red-before-green registry/snapshot guard and reducer integration are included in 190 focused passing tests. |
| Opportunity provenance and external authority boundary | `app/src/data/fellowships.ts`, `app/src/lib/suggest.ts`, `app/src/components/Suggested.tsx` | Existing and unchanged. The catalog still asserts no deadline, labels opening months as an unchecked rough guide, links to the official page and never creates an application without an explicit student action. Dismissal and Undo do not mutate any provider, employer, campus or institution record. |

This mapping adds no archive route, role, capability, schema, policy, server operation or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 16 current-product consequence mapping — integration slice 67

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for deleting a device-owned Advisor Meeting preparation | `app/src/components/AdvisorMeeting.tsx`, `app/src/lib/advisor-meeting.ts` | Existing but incomplete is narrowed: the existing confirmation now uses the shared `ActionPreview` to identify the selected meeting and the agenda, questions, follow-ups and private notes removed from this device. It states that prior shares and official advising records are unchanged. Cancel remains the initial focused action and writes nothing. The focused rendered guard was red before the port and is included in 30 passing Advisor Meeting, preview, backup and root-unmount tests. |
| Recovery, account isolation and share-authority boundary | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.coverage.test.ts`, `app/src/lib/advisor-shares.ts` | Existing and unchanged. Advisor Meeting storage remains account-keyed. A prior device workspace backup can restore the meeting structure but intentionally excludes private notes, so the preview does not promise full recovery. Already-created shares remain separately revocable/deletable server records; local preparation deletion does not revoke them or change official records. |

This mapping adds no archive route, role, capability, schema, policy, server operation or provider claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 17 current-product consequence mapping — integration slice 68

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for deleting student-authored assistant context | `app/src/components/AboutMe.tsx`, `app/src/components/TrustCenter.tsx`, `app/src/lib/aboutme.ts` | Existing but incomplete is narrowed across both reachable entry points. Profile no longer dispatches from the first × press; it and Trust & Data use the shared `ConfirmDialog` plus `ActionPreview` to name the exact line, device and post-sync account effect, non-effects and no-Undo boundary. Cancel writes nothing, confirmation keeps every other fact, and the red-before-green regression is included in 146 focused passing tests. |
| Assistant-memory export, recovery and provider boundary | `app/src/lib/export.ts`, `app/src/state/store.tsx`, `app/src/lib/workspace-backup.private.test.ts` | Existing and unchanged. Full-data export includes `aboutMe`, so a prior downloaded file retains the old text, but no automatic restore is claimed. Workspace backup continues to exclude assistant memory. The existing in-memory context updates from state; this slice sends no provider prompt or request and changes no model, sync or merge policy. |

This mapping adds no archive route, role, capability, schema, policy, provider operation or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 18 current-product consequence mapping — integration slice 69

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for deleting one private Student Operating workflow item | `app/src/components/StudentOperating.tsx`, `app/src/lib/student-operating.ts`, `app/src/state/slices/notes.ts` | Existing but incomplete is narrowed: **Delete this item** now opens the shared `ConfirmDialog` and `ActionPreview` before the existing selected-entry filter writes `operatingWorkspace`. It identifies the item and workflow kind, device/account-sync effect, unaffected items/preferences/exports/official records and open editor/review boundary. Cancel writes nothing. The red-before-green guard is included in 122 focused passing tests. |
| Recovery, persistence and external-authority boundary | `app/src/lib/export.ts`, `app/src/state/store.tsx` | Existing and unchanged. The core Semester backup contains `operatingWorkspace`, so a pre-deletion backup can restore the earlier workspace. Deletion creates no share or message, changes no official record and invokes no provider or institution system. |

This mapping adds no archive route, role, capability, schema, policy, provider operation or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 19 current-product consequence mapping — integration slice 70

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for deleting saved Student Operating preferences | `app/src/components/StudentOperating.tsx`, `app/src/lib/student-operating.ts`, `app/src/state/slices/notes.ts` | Existing but incomplete is narrowed: **Delete preferences** now opens the shared `ConfirmDialog` and `ActionPreview` before the existing `operatingWorkspace` JSON write. It identifies the saved term, preference families removed, editor reset, device/account-sync effect and non-effects. Cancel writes nothing; confirmation clears only `manual` and preserves all workflow entries. The red-before-green guard is included in 161 focused passing tests. |
| Recovery, export and external-authority boundary | `app/src/lib/export.ts`, `app/src/state/store.tsx` | Existing and unchanged. The core Semester backup contains `operatingWorkspace`, so a pre-deletion backup can restore the earlier workspace. Existing downloaded exports remain outside the mutation. Preference deletion creates no share or message, changes no official record and invokes no provider or institution system. |

This mapping adds no archive route, role, capability, schema, policy, provider operation or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 6 current-product consequence mapping — integration slice 71

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for permanently deleting one device-local file | `app/src/screens/mine/Drive.tsx`, `app/src/lib/files.ts`, `app/src/components/TypeToConfirm.tsx` | Existing but incomplete is narrowed: **Delete for good** no longer erases the only in-app byte record on its first press. It opens the existing irreversible confirmation, requires the exact file name, names the byte count and explains the surviving-but-broken course/deadline/note links before calling the unchanged single-record IndexedDB delete. Cancellation writes nothing. The regression was red against the prior behavior and is included in 53 focused passing tests. |
| File recovery, external-copy and authority boundary | `app/src/lib/files.ts`, `app/src/lib/workspace-backup.ts` | Existing and unchanged. Files in the bin remain device-local; Undo and workspace backup do not contain their bytes. An original or downloaded copy outside Semester is not affected and may be added again. This slice does not empty the bin, change 30-day cleanup, add upload/download authority or claim server/provider storage. |

This mapping adds no archive route, role, capability, schema, policy, server operation, provider behavior or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 7 current-product consequence mapping — integration slice 72

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 consequence pattern for permanently emptying device-local file trash | `app/src/screens/mine/Drive.tsx`, `app/src/components/TypeToConfirm.tsx` | Existing but incomplete is narrowed: **Empty the bin** now previews the exact captured file count and stored-byte total, requires **EMPTY BIN**, preserves cancellation and names surviving broken links, external copies and the no-Undo/no-backup boundary. The two rendered assertions were red against first-press deletion and now pass. |
| Bulk deletion concurrency and recovery boundary | `app/src/lib/files.ts`, `app/src/lib/files.test.ts` | Existing but incomplete is narrowed: `purgeTrash` accepts only the previewed ids, deduplicates them and re-reads each record inside its delete transaction. Files added later are outside the id set; restored files fail the still-binned check. The storage guard was red before the operation existed and proves both exclusions. |

This mapping adds no archive route, role, capability, schema, policy, server operation, provider behavior or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 8 current-product consequence mapping — integration slice 73

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Stream 01 retention and irreversible-consequence state for automatic Drive-bin cleanup | `app/src/screens/mine/Drive.tsx`, `app/src/components/ui.tsx` | Existing but incomplete is narrowed: Drive now announces the actual number of files permanently removed after the 30-day window, names the no-Undo/no-backup boundary and preserves external copies. A cleanup failure uses the shared assertive notice with inspect-and-retry guidance instead of remaining silent. Rendered success and failure assertions were red against the prior screen and now pass. |
| Strict retention authority, cutoff and concurrent restore safety | `app/src/lib/files.ts`, `app/src/lib/files.test.ts` | Existing but incomplete is narrowed: ordinary browsing retains its resilient empty-list fallback, while cleanup uses a strict IndexedDB read so refusal propagates. Eligibility begins only when the full 30-day window has elapsed, and each candidate is re-read inside its delete transaction; restored and newer files survive. The cutoff and refusal guards pass after failing against the prior contract. |

This mapping adds no archive route, role, capability, schema, policy, server operation, provider behavior or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 9 current-product consequence mapping — integration slice 74

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Device erase, same-origin isolation and controlled reset | `app/src/lib/erase.ts`, `app/src/screens/Privacy.tsx`, `app/src/components/InstitutionalPreviewBar.tsx` | **Existing but incomplete.** The core remains Semester-prefix scoped, attempts provider withdrawal before token removal and, after final upstream reconciliation at `f7dba6e6`, includes classified offline attachments. Both callers now reload only on resolution and expose an assertive close-other-tabs-and-retry state on rejection, so neither claims an incomplete wipe or sample reset succeeded. The combined caller/core/revocation/root/classified-attachment set passes 45/45. Per-store completion receipts and post-reload provider results remain open. |

This mapping adds no archive route, role, capability, schema, policy, server operation, provider configuration or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 10 current-product consequence mapping — integration slice 75

| Reference concern | Current repository owner | Disposition and evidence |
| --- | --- | --- |
| Device-erase completion receipts and partial-failure recovery | `app/src/lib/erase.ts`, `app/src/screens/Privacy.tsx`, `app/src/components/InstitutionalPreviewBar.tsx` | **Existing but incomplete is narrowed.** The core now verifies prefixed Web Storage removal, attempts every local area after failure and either returns the confirmed store list or throws a bounded partial receipt naming unconfirmed areas. Both existing callers continue to reload only after resolution and keep retry/recovery visible on rejection. The red-before-green refusal/no-op guard is included in 104 focused and adjacent passing tests. |
| Browser-store clear authority | `app/src/state/persist/db.ts`, `app/src/lib/snapshots.ts`, `app/src/lib/sync/outbox.ts`, `app/src/lib/vault/idb.ts`, `app/src/lib/sync/engine/persistent.ts`, `app/src/lib/shared.ts` | **Existing and verified locally for the changed contract.** Transaction abort/error, unavailable handles and adapter refusal no longer become successful erase evidence. Existing throwing file/draft/attachment operations and the history boolean share the same top-level aggregation. This is local completion evidence, not a live-browser restore drill or production execution. |
| Provider and account boundary | `app/src/lib/revoke.ts`, `app/src/lib/cloud.ts` | **Existing and unchanged.** Provider withdrawal remains attempted before local token removal and account deletion remains a distinct server action. This slice does not claim a post-reload provider result, activate a provider or delete an account. |

This mapping adds no archive route, role, capability, schema, policy, server operation, provider configuration or external-system claim. Deployment, HawkScan, external approvals and institutional readiness remain unverified.

## Pass 11 delta — governed study-abroad program removal (slice 76)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Student-controlled planning changes with an explicit consequence preview and recovery boundary | `app/src/components/StudyAbroad.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx`, `app/src/lib/abroad.ts` | **Existing but incomplete → existing and verified for one program removal.** The first press now previews the program details, course matches, recorded approval states and stage progress that will be removed. Cancel preserves the account-keyed device library; confirmation performs the existing exact-id removal and announces a device-only receipt. |
| Preserve official academic authority and distinguish student records from school records | `app/src/components/StudyAbroad.tsx`, `app/src/lib/abroad.ts`, `app/src/components/StudyAbroad.test.tsx` | **Existing and verified for this slice.** The preview says other plans, official applications, written approval decisions and school-held records stay unchanged, and that Semester sends no removal request. No provider, route, server operation, schema or policy changed. |
| Recovery for destructive local planning actions | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.coverage.test.ts`, `app/src/components/StudyAbroad.test.tsx` | **Existing and verified for this slice.** The dialog identifies a device workspace backup made before removal as the only restore path; the account-keyed abroad prefix remains in backup coverage. |
| Security verification after production UI behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset, so no target, DAST scan, finding result or security pass exists. |

The focused regression failed against the prior immediate removal and passes after restoration. The final focused/adjacent set passes 59/59; TypeScript, lint, university typecheck and production build pass; the design-check constituents pass 78/78, report contracts pass 96/96, and audit/CSS stay within their ledgers. Ordered and shuffled full suites were not rerun. Course-row removal and official study-abroad operations remain outside this slice and require separate authority-aware work.

## Pass 12 delta — governed study-abroad course-match removal (slice 77)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Student-controlled removal of one planning match with consequence and recovery evidence | `app/src/components/StudyAbroad.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx`, `app/src/lib/abroad.ts` | **Existing but incomplete → existing and verified for one course-match removal.** The first press now previews the exact host-to-home match, credits, recorded approval status and source note. Cancel preserves the account-keyed device plan; confirmation performs the existing exact-id mutation and announces a device-only receipt. |
| Preserve official academic authority and unaffected plan state | `app/src/components/StudyAbroad.tsx`, `app/src/lib/abroad.ts`, `app/src/components/StudyAbroad.test.tsx` | **Existing and verified for this slice.** The preview says the program, stage progress, other matches and school-held records remain unchanged and that Semester sends no removal request. No registrar, department, provider or institution record changes. |
| Recovery for destructive local planning actions | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.coverage.test.ts`, `app/src/components/StudyAbroad.test.tsx` | **Existing and verified for this slice.** The dialog identifies a device workspace backup made before removal as the only represented restore path; the account-keyed abroad prefix remains in backup coverage. |
| Security verification after production UI behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset, so no target, DAST scan, finding result or security pass exists. |

The regression failed against the prior immediate deletion. The final focused/adjacent set passes 76/76; TypeScript, lint, university typecheck and production build pass; token/design-check constituents pass 78/78, report contracts pass 96/96, and audit/CSS stay within their ledgers. Final observed `origin/main` `a607200c` changes none of the six slice files and adds no equivalent flow; it merged cleanly after slice commit `dc4ab398`, and 76/76 focused tests plus TypeScript pass on merged head `b7547bd2`. The aggregate npm launcher and ordered/shuffled full suites were not run. Official study-abroad operations remain outside this device-only slice.

## Pass 13 delta — governed graduation-scenario removal (slice 78)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Consequence preview before deleting a student-authored graduation what-if scenario | `app/src/components/GraduationSimulator.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one device scenario removal.** The first press now previews the selected scenario and exact credit-load assumptions; cancel preserves device storage, and confirmation performs the existing exact-id removal and announces a device-only receipt. |
| Separate device planning state, account draft and official degree authority | `app/src/lib/graduation.ts`, `app/src/lib/graduation-cloud.ts`, `app/src/components/GraduationSimulator.test.tsx` | **Existing and verified for this slice.** The preview says the current plan, other scenarios, downloads and registrar-owned degree audit remain unchanged. When the scenario has a draft for the signed-in account, the preview states that the account draft remains there; this slice invokes no cloud deletion. |
| Recovery for destructive local degree-planning changes | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.coverage.test.ts`, `app/src/components/GraduationSimulator.test.tsx` | **Existing and verified for this slice.** The dialog identifies a device workspace backup made before removal as the only represented restore path; the graduation device-library key remains covered by the backup contract. |
| Security verification after production UI behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset, so no target, DAST scan, finding result or security pass exists. |

The regression failed against the prior first-press deletion. The focused/adjacent set passes 57/57; TypeScript, lint, university typecheck and production build pass; the combined token/design/report-contract set passes 147/147, and audit/CSS stay within their ledgers. Aggregate npm design wrappers and ordered/shuffled full suites were not run. Account-draft deletion and official degree operations remain separate authority-aware paths.

## Pass 1 delta — governed graduation account-draft removal (slice 79)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Consequence preview before deleting one account-saved planning draft | `app/src/components/GraduationSimulator.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one signed-in-account draft removal.** The landed first press previews the account-only deletion, unchanged device scenario and records, and lack of automatic restore; cancellation performs no delete. |
| Require trustworthy completion before changing the client receipt | `app/src/lib/graduation-cloud.ts`, `app/src/lib/graduation-cloud.test.ts`, `app/src/components/GraduationSimulator.phase-d.test.tsx` | **Existing and verified for this slice.** The delete requests the removed id and refuses to report success when no row returns. A failure keeps the confirmation open, preserves the displayed account/device mapping and permits retry; confirmed completion clears only the signed-in account's cloud id. |
| Preserve student control and official academic authority | `app/src/components/GraduationSimulator.tsx`, `app/src/lib/graduation.ts` | **Existing and verified for this slice.** The device scenario remains available and can be saved again; other account drafts, downloads and the registrar-owned degree audit remain unchanged. Whole-account deletion and official degree operations are separate. |
| Security verification after the landed production change | `stackhawk.yml` | **Blocked by environment.** The landed slice recorded Hawk and Docker unavailable with no API key or app host. This pass changes documentation only, so it does not trigger a new scan; no DAST result or security pass is inferred. |

Exact-work inspection found commit `44950935` already present in clean current head `121eb809`; this pass records it instead of rebuilding it. The current focused/adjacent graduation, cloud, preview and root-unmount set passes 36/36. No route, dependency, schema, policy, provider configuration, deployment or external system changed in this reconciliation.

## Pass 2 delta — governed Productivity cloud-workspace deletion (slice 80)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Consequence preview before deleting a private account workspace | `app/src/components/ProductivityCloud.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one private cloud-workspace deletion.** The first press now previews the reviewed revision and row counts, starts on Cancel and writes nothing. Confirmation affects only the signed-in account's private cloud copy. |
| Preserve device state and state the exact recovery boundary | `app/src/components/ProductivityCloud.tsx`, `app/src/components/ProductivityCloud.test.tsx` | **Existing and verified for this slice.** The current device workspace, other account data, institution records and downloads remain unchanged. The preview directs the student to export the reviewed cloud copy first if its exact contents are needed and says the current device copy may be saved again later. |
| Require trustworthy server completion and retry on refusal | `app/src/lib/productivity-cloud.ts`, `app/src/lib/productivity-cloud.test.ts`, `app/src/components/ProductivityCloud.test.tsx` | **Existing and verified for this slice.** The delete now selects the removed account row and refuses to report success on a zero-row response. Errors retain the dialog and represented cloud/device state for retry or cancel. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and no app host is configured. A local credential properties file exists but was not read; no target, scan, finding result or security pass exists. |

The four regression assertions failed against the prior immediate/receipt-less behavior. The final focused and adjacent set passes 20/20; TypeScript, lint, university typecheck and production build pass; 147/147 exact token/design/report-contract tests pass, and audit/CSS stay within their ledgers. Final observed upstream `d44f10f6` changes only incident-evidence custody files and does not overlap this slice. No route, dependency, schema, policy, provider configuration, deployment or external system changed.

## Pass 3 delta — governed advisor-share deletion (slice 81)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Consequence preview before deleting one account advisor share | `app/src/components/AdvisorMeeting.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one signed-in-account share deletion.** The dialog identifies the share and access log, the advisor's immediate loss of access, unchanged device/official records and the no-restore boundary. Cancel is initially focused and writes nothing. |
| Require trustworthy server completion and retry on refusal | `app/src/lib/advisor-shares.ts`, `app/src/lib/advisor-shares.test.ts`, `app/src/components/AdvisorMeeting.test.tsx` | **Existing and verified for this slice.** The delete selects the removed id and refuses to report success when no account-scoped row returns. Failure keeps the dialog open with retry or cancel; repeat confirmation is guarded while the request is in flight. |
| Preserve advising authority and tenant boundary | `supabase/migrations/20260928301000_advisor_shares.sql`, `app/src/lib/advisor-shares.ts` | **Existing and unchanged.** Current RLS and signed-in-account scope remain authoritative. Meeting preparation on the device, other shares, official advising records and advisor/institution operations are not mutated. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset, so no target, DAST scan, finding result or security pass exists. |

The regression paths failed against the prior prose-only preview and receipt-less success behavior. The final focused/adjacent set passes 41/41; TypeScript, lint, university typecheck and production build pass; 147/147 exact token/design/report-contract tests pass, and audit/CSS stay within their ledgers. Current `origin/main` `d44f10f6` is already included and has no equivalent change. No route, dependency, schema, policy, provider configuration, deployment or external system changed.

## Pass 4 delta — governed advisor-share revocation (slice 82)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Consequence preview before ending one advisor's access | `app/src/components/AdvisorMeeting.tsx`, `app/src/components/TrustCenter.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one signed-in-account share revocation.** Both reachable callers disclose immediate advisor access loss, the retained share/access log, unchanged meeting preparation/other shares/official records and the no-undo/new-share boundary. Cancel is initially focused and writes nothing. |
| Require trustworthy server completion and retry on refusal | `app/src/lib/advisor-shares.ts`, `app/src/lib/advisor-shares.test.ts`, `app/src/components/AdvisorMeeting.test.tsx`, `app/src/components/TrustCenter.test.tsx` | **Existing and verified for this slice.** The update selects the exact id and requested timestamp and refuses success on a zero-row or mismatched receipt. Either caller retains the dialog and represented active share for retry or cancel; repeat confirmation is guarded while in flight. |
| Preserve advising authority, audit history and tenant boundary | `supabase/migrations/20260928301000_advisor_shares.sql`, `app/src/lib/advisor-shares.ts` | **Existing and unchanged.** Current account-scoped RLS, tenant-bound share row and one-way `revoked_at` update remain authoritative. The share and read log remain in the account; no schema, policy, role or capability changes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no runnable target, DAST scan, finding result or security pass exists. |

The three regression paths failed against the prior early-close and receipt-less behavior. The final focused/adjacent set passes 59/59; TypeScript, lint, university typecheck and production build pass; aggregate design check and report complete with 9 token tests, 69 design contracts, zero audit violations and no CSS-ledger increase. The locked install audit reports zero dependency vulnerabilities. Selection-time `origin/main` `d44f10f6` is already included and has no equivalent change; final observed `bb91c689` changes only platform-control execution-plan files and does not overlap this slice. No route, dependency, schema, policy, provider configuration, deployment or external system changed.

## Pass 5 delta — reversible custom-reminder deletion (slice 83)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Give a student recovery after removing one authored reminder rule | `app/src/components/MyRules.tsx`, `app/src/state/slices/settings.ts`, `app/src/lib/undo.ts` | **Existing but incomplete → existing and verified for one device-held rule deletion.** A dedicated action snapshots only `myRules` and enters the existing eight-second Undo path; Undo restores the exact rule without reverting later unrelated work. |
| Preserve ordinary editing and accessible operation | `app/src/components/MyRules.tsx`, `app/src/components/MyRules.test.tsx` | **Existing and verified for this slice.** Field edits and enable/disable remain on `setMyRules`, while deletion dispatches only `deleteMyRule`. The control keeps its exact rule-specific accessible name. |
| Preserve data and authority boundaries | `app/src/lib/myrules.ts`, `app/src/state/shape.ts` | **Existing and unchanged.** The mutation is device state owned by the student. Shipped defaults, other rules, course/deadline records, account data and notification providers are not changed. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset, so no target, DAST scan, finding result or security pass exists. |

The focused UI guard fails against the former immediate list replacement. The final focused/adjacent set passes 169/169; TypeScript, lint, university typecheck, production build, aggregate design check and the test-backed report pass. Selection-time `origin/main` `bb91c689` was already included and contained no equivalent reminder-rule recovery work; final observed `51dd47b8` changes only signed-in-device-session component/archive-permission files and does not overlap. No route, shared component, dependency, schema, policy, server operation, provider configuration, deployment or external system changed.

## Pass 6 delta — governed athletic-support share revocation (slice 84)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Let a student stop an athletic-support share with a consequence preview | `app/src/components/AthleteShare.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one share revocation.** The first press now opens the shared accessible dialog, naming immediate support-staff access loss, retained account history, unchanged local/official records and the no-undo/new-share boundary. Cancel writes nothing. |
| Require a truthful server completion receipt | `app/src/lib/athleteshare.ts`, `app/src/components/AthleteShare.test.tsx` | **Existing but incomplete → existing and verified for this caller.** The adapter returns success only when the update response contains the exact share id and requested revocation timestamp. Error or zero-row responses keep the represented share and dialog available for retry or cancel. |
| Preserve tenant, role and audit boundaries | `supabase/migrations/20260928308000_support_shares.sql`, `supabase/supportshares.check.sql` | **Existing and unchanged.** Student-owner RLS and tenant binding remain authoritative; the column grant limits updates to `revoked_at`, the check prevents reopening, and the share/read history stays in the account. No schema, grant, policy, role or capability changed. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no runnable target, DAST scan, finding result or security pass exists. |

The regression fails against the former first-press revocation. The final focused/adjacent set passes 30/30; TypeScript, lint, university typecheck and production build pass. Aggregate design check passes 9 token tests and 69 contracts with zero audit violations and no CSS-ledger increase; 96 report contracts pass and the report artifact is unchanged, though the aggregate report launcher remains unavailable without a real `npx`. Selection-time `origin/main` `51dd47b8` is already included; final observed `573af52b` changes only separate Course Engine MVP/upload-job and developer-tools files and contains no equivalent work. After slice commit `8edcba21`, it merged cleanly as `40eee878`; 30/30 focused tests and TypeScript pass again on the combined head. No route, dependency, schema, grant, RLS policy, provider configuration, deployment or external system changed.

## Pass 7 delta — governed family share-code revocation (slice 85)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Let a student call off an unused family code with a consequence preview | `app/src/components/FamilyInvite.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one unclaimed code.** The first press opens the shared accessible dialog, naming the exact code, immediate inability to accept it, unchanged claimed access/family state/other codes and the no-undo/new-code boundary. Cancel starts focused and writes nothing. |
| Require a truthful server completion receipt | `app/src/lib/familyinvites.ts`, `app/src/lib/familyinvites.test.ts`, `app/src/components/FamilyInvite.test.tsx` | **Existing but incomplete → existing and verified for this caller.** The adapter reports success only when the update response contains the exact code and requested revocation timestamp. Provider, empty-row or mismatched responses keep the code and dialog available for retry or cancel. |
| Preserve account ownership and one-way revocation | `supabase/migrations/20260928306000_family_invites.sql`, `supabase/familyinvites.check.sql` | **Existing and unchanged.** Student-owner RLS remains authoritative; the column grant limits updates to `revoked_at`, and policy prevents reopening. Claimed grants and official family/guardian operations are outside the slice. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no runnable target, DAST scan, finding result or security pass exists. |

The UI and adapter regressions fail against the former first-press and receipt-less behavior. The final focused/adjacent set passes 55/55; TypeScript, lint, university typecheck and production build pass. Exact token/design/report-contract constituents pass 147/147 with zero audit violations and no CSS-ledger increase. Aggregate wrappers remain unavailable without real `npm`/`npx`. Current `origin/main` `573af52b` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, provider configuration, deployment or external system changed.

## Pass 8 delta — governed claimed-family-access revocation (slice 86)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Let a student end already-claimed family access with a complete consequence preview | `app/src/components/FamilyInvite.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for the current caller.** The first press names the person and selected item count, immediate access loss and stored-copy removal, retained family plan/other shares/unused codes/read history, external-copy limit and new-share recovery. Cancel starts focused and writes nothing. |
| Require trustworthy grant and stored-copy completion receipts | `app/src/lib/familyshare.ts`, `app/src/lib/familyshare.test.ts`, `app/src/components/FamilyInvite.test.tsx` | **Existing but incomplete → existing and verified for the client boundary.** The adapter validates exact returned grant ids/timestamps before cleanup and structurally valid removed-copy rows before success. Missing grant evidence blocks cleanup; a cleanup refusal truthfully reports that access ended and retains the dialog for recovery. |
| Preserve account ownership, read history and recipient denial | `supabase/migrations/20260921161500_roles.sql`, `supabase/migrations/20260928307000_family_shared_items.sql`, `supabase/familyshare.check.sql` | **Existing and unchanged.** Student-owner RLS and the live-grant reader remain authoritative; read history is retained. The existing two account writes are not represented as atomic. A future server-side atomic operation requires a migration and PostgreSQL 17 proof and is not claimed here. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no runnable target, DAST scan, finding result or security pass exists. |

The focused/adjacent Family, invite, access-overview, preview/modal and root-lifecycle set passes 61/61. TypeScript, lint, university typecheck and production build pass. Design-check constituents pass 78/78; report contracts pass 96/96; audit reports zero violations and CSS stays within its ledger. Aggregate wrappers and full ordered/shuffled suites were not run successfully. Selection-time `origin/main` `573af52b` is already included; final observed `ec618dea` changes only `app/vite.config.ts` and contains no equivalent work. No route, dependency, schema, grant, RLS policy, provider configuration, deployment or external system changed.

## Pass 9 delta — governed Research Studio source removal (slice 87)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Give a student a complete consequence preview before removing research evidence | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one source row.** The first press now names the source, verification state and linked-claim count before any write. Cancel starts focused and preserves the row. |
| Preserve claim meaning while detaching removed evidence | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/toolkit/Toolkit.test.tsx` | **Existing and verified for this slice.** Confirmation removes only the chosen evidence row and its ids from claim links. Claim text, research question, search plan and other sources remain, and the device-only completion receipt appears only after the bounded write succeeds. |
| Represent recovery and authority honestly | `app/src/components/toolkit/store.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing and unchanged.** Research Studio is an account-keyed device library and does not alter original files or official academic records. Toolkit keys are explicitly exempt from the device-workspace backup contract, so the preview directs the student to re-enter the source from the original rather than promising restore. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. A local properties file exists but was not read; no runnable target, DAST scan, finding result or security pass exists. |

The regression fails against the former immediate removal. The final focused Toolkit, preview/modal and root-lifecycle set passes 34/34, including cancellation and a refused-storage write; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design-check contracts pass 69/69, report contracts pass 96/96, audit adds no violation and CSS stays within its ledger. Current `origin/main` `ec618dea` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, provider configuration, deployment or external system changed.

## Pass 10 delta — governed Research Studio claim removal (slice 88)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Give a student a complete consequence preview before removing authored claim text | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one claim row.** The first press now names the claim, its current citation-audit status and exact linked-source count before any write. Cancel starts focused and preserves it. |
| Preserve evidence rows while removing only the claim and its links | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/toolkit/Toolkit.test.tsx` | **Existing and verified for this slice.** Confirmation removes only the chosen claim. All source rows, the research question, search plan and other claims remain; a refused device write keeps the dialog and claim available for retry, and the device-only receipt appears only after success. |
| Represent recovery and authority honestly | `app/src/components/toolkit/store.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing and unchanged.** Research Studio remains an account-keyed device library and does not alter original files or official academic records. Toolkit keys remain explicitly exempt from the device-workspace backup contract, so recovery requires re-entering the claim and reconnecting its sources. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. No runnable target, DAST scan, finding result or security pass exists. |

The regression fails against the former immediate removal. The final focused Toolkit, preview/modal and root-lifecycle set passes 36/36, including cancel, refused storage, retry and source preservation; TypeScript, lint, university typecheck and production build pass. Design-check constituents pass 78/78, report contracts pass 96/96, audit adds no violation and CSS stays within its ledger. Current `origin/main` `ec618dea` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, provider configuration, deployment or external system changed.

## Automation pass 11 update — governed Research Studio project deletion (slice 89)

| Reference intent | Current repository authority | Disposition and evidence |
| --- | --- | --- |
| Give a student a complete consequence preview before deleting a research project | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing but incomplete → existing and verified for one project.** The preview now names exact source/claim counts, unchanged original files and other projects, and the explicit no-backup recovery boundary before any write. Cancel starts focused and preserves the project. |
| Preserve represented work when device storage refuses deletion | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/toolkit/Toolkit.test.tsx`, `app/src/lib/device-library.ts` | **Existing but incomplete → existing and verified for this slice.** A failed bounded write leaves the project and dialog available for retry and emits no success receipt. A confirmed exact-id removal emits the receipt only after storage accepts it. |
| Keep unchanged projects reachable after deleting the active project | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/toolkit/Toolkit.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Success selects the next remaining project rather than setting the active id to `null`; deleting the last project keeps the device-only receipt visible on the start state. |
| Represent storage, backup and authority boundaries honestly | `app/src/components/toolkit/store.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing and unchanged.** Research Studio remains an account-keyed device library. Toolkit keys remain outside the device-workspace backup contract; original files, account/institution records and providers are not mutated. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and `HAWK_API_KEY` / `HAWK_APP_HOST` are unset. No runnable target, DAST scan, finding result or security pass exists. |

The regression fails against the former incomplete preview. The final focused Toolkit, device-library, backup-coverage, preview and root-lifecycle set passes 51/51, including cancel, refused storage, retry and remaining-project selection; TypeScript, lint, university typecheck and production build pass. Design-check constituents pass 78/78, audit adds no violation and CSS stays within its ledger. Current `origin/main` `ec618dea` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, provider configuration, deployment or external system changed.

## Recoverable Toolkit workspaces — automation pass 12, integration slice 90

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Give student-owned Toolkit work a tested recovery path | `app/src/lib/workspace-backup.ts`, `app/src/lib/toolkit/store.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing but incomplete → existing and verified for both Toolkit stores.** The account-scoped Toolkit and Toolkit Data keys now enter the existing validated device-workspace backup and restore into the restoring account. |
| Reuse one data authority instead of creating a parallel backup schema | `app/src/lib/toolkit/store.ts`, `app/src/components/toolkit/store.ts`, `app/src/lib/toolkit/data.ts` | **Existing and verified.** Keys and the Toolkit reader live below React and are shared by the UI hooks and backup. Data projects reuse `readDataProjects`; no second model or permissive parser was added. |
| Refuse corrupt recovery files atomically | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for this slice.** A malformed Toolkit data project rejects the complete restore before either Toolkit record is written. Existing rollback behavior for storage refusal is unchanged. |
| State recovery honestly before destructive Research Studio actions | `app/src/components/toolkit/ResearchPanel.tsx`, `app/src/components/toolkit/Toolkit.test.tsx` | **Existing but incomplete → existing and verified for source, claim and project removal.** Each preview names a backup created before removal/deletion and explains the manual re-entry fallback when none exists. |
| Preserve account isolation in exported and restored work | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for Toolkit.** Export selects only exact account keys, excludes another account's record and remaps the validated records to the restoring account. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and the detected local properties file was not read. No runnable target, DAST scan, finding result or security pass exists. |

The new guards failed against the former backup exclusion and recovery copy. The final focused backup, Toolkit, preview/modal and root-lifecycle set passes 68/68; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design-check contracts pass 69/69, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Selection-time `origin/main` `ec618dea` was already included; final `bbf94ea2` changes production read-only wiring/reference files and contains no equivalent or overlapping work. Slice commit `178da384` merged that upstream cleanly as `0226ed29`; the combined head passes 68/68 focused tests, TypeScript and university gateway typecheck. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 1 update — recoverable Launchpad progress (slice 91)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Give student-owned onboarding progress a tested recovery path | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing but incomplete → existing and verified for the Launchpad store.** Exact-account stage, types, completed-step dates, mentor opt-in and chosen interests enter the validated workspace backup and restore only to the restoring account. |
| Preserve one Launchpad storage authority | `app/src/lib/launchpad.ts`, `app/src/screens/Launchpad.tsx`, `app/src/screens/Hub.tsx`, `app/src/lib/workspace-backup.ts` | **Existing and verified.** `LAUNCHPAD_PREFIX` is shared by both current consumers and backup code; values continue through the existing `readLaunchpad` validation rather than a parallel schema. |
| Keep private reflections device-only | `app/src/lib/launchpad.ts`, `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for export and restore.** Reflection answers are removed from the portable record. Restore keeps answers already on the target device while applying validated portable progress and choices. |
| Preserve account isolation | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for Launchpad.** Exact-key selection excludes another account's workspace and restore remaps to the restoring account. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and no local properties file was found. No runnable target, DAST scan, finding result or security pass exists. |

The new guards fail against the former generic backup exemption. Final focused workspace-backup, coverage and journey-reader verification passes 74/74; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, combined design contracts pass 138/138, the exact report set passes 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Aggregate wrappers and full ordered/shuffled suites are not claimed. Current `origin/main` `a4742f6b` is the clean slice base and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 2 update — recoverable Opportunities workspace (slice 92)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Give student-authored opportunity work a tested recovery path | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing but incomplete → existing and verified for the Opportunities store.** Exact-account tracker items and the weekly time budget enter the validated workspace backup and restore only to the restoring account. |
| Preserve one Opportunities storage authority | `app/src/lib/opportunities.ts`, `app/src/screens/Opportunities.tsx`, `app/src/screens/Hub.tsx`, `app/src/components/soft/SoftTopBody.tsx` | **Existing and verified.** `OPPORTUNITIES_PREFIX` is shared by every current consumer and backup code; values continue through `readOpportunities` rather than a parallel schema. |
| Keep work-study status device-private | `app/src/lib/opportunities.ts`, `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for export and restore.** The `workStudy` property is absent from the portable file. Restore preserves the same item's choice already on the target device and otherwise defaults it to not recorded. |
| Preserve account isolation | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for Opportunities.** Exact-key selection excludes another account's tracker and restore remaps the validated record to the restoring account. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and a local properties file was detected without reading it. No runnable target, DAST scan, finding result or security pass exists. |

The new guards fail against the former generic backup exemption. Final focused and adjacent backup, privacy and journey verification passes 89/89; TypeScript, lint, university typecheck and production build pass. The exact combined design set passes 147/147, the report set passes 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Aggregate wrappers and full ordered/shuffled suites are not claimed. Selection-time `origin/main` `a4742f6b` is already included; final `ccf2d45ff` changes account-pull/adoption code and contains no equivalent or overlapping work. Slice commit `19a7374c8` merged that upstream cleanly as `d9dd47eb6`; TypeScript and university gateway typecheck pass on the combined head. A post-merge focused rerun was interrupted by a concurrent full-suite worker-pool holder, so the 89/89 claim remains pre-merge only. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 3 update — recoverable Hub delivery preferences (slice 93)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Give account-scoped Hub choices a tested recovery path | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing but incomplete → existing and verified for portable Hub preferences.** Muted channels, quiet hours and digest cadence enter the validated backup and restore only to the restoring account. |
| Preserve one Hub storage authority | `app/src/lib/comms.ts`, `app/src/screens/Hub.tsx`, `app/src/lib/workspace-backup.ts` | **Existing and verified.** `HUB_PREFS_PREFIX` is shared by the current UI and backup; values continue through `readHubPrefs` rather than a parallel schema. |
| Keep notice-state markers device-specific | `app/src/lib/comms.ts`, `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for export and restore.** Read, saved and follow-up ids are empty in the portable file. Restore retains the target device's current markers and a new device starts empty. |
| Preserve account and data-authority boundaries | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for this slice.** Exact-key selection excludes another account; official notices, course facts, generated reminders and provider records are not exported. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` and app-host environment values are unset and the detected local properties file was not read. No runnable target, DAST scan, finding result or security pass exists. |

The new guards fail against the former generic backup exemption. Final focused and adjacent backup, coverage, comms and Hub journey verification passes 98/98; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design-check contracts pass 69/69, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Aggregate wrappers and full ordered/shuffled suites are not claimed. Current `origin/main` `ccf2d45ff` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 4 update — recoverable Support planning (slice 94)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Give student-owned Support planning a tested recovery path | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing but incomplete → existing and verified for portable Support planning.** Exact-account routines, continuity choices and commute planning enter the validated backup and restore only to the restoring account. |
| Preserve one Support storage authority | `app/src/lib/support.ts`, `app/src/screens/Support.tsx`, `app/src/lib/workspace-backup.ts` | **Existing and verified.** `SUPPORT_PREFIX` is shared by the current UI and backup; values continue through `readSupport` rather than a parallel schema. |
| Keep sensitive support details device-private | `app/src/lib/support.ts`, `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified for export and restore.** Emergency contacts and access-planning notes are absent from the portable file. Restore retains those fields already on the target device and a new device starts empty. |
| Keep destructive-action recovery language exact | `app/src/screens/Support.tsx`, `app/src/screens/journey.test.tsx` | **Existing and verified for emergency-contact removal.** The preview states that contacts remain intentionally excluded and must be re-entered, without suggesting that the new portable Support record can restore them. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and the detected local properties file was not read. No runnable target, DAST scan, finding result or security pass exists. |

The recovery guards fail against the former backup exclusion. Final focused and adjacent backup, coverage, Support journey and root-lifecycle verification passes 54/54; TypeScript, lint, university typecheck and production build pass. Design-check constituents pass 78/78, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `ccf2d45ff` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 5 update — private NIL record restore (slice 95)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Give the private NIL export a tested return path | `app/src/screens/Nil.tsx`, `app/src/screens/journey.test.tsx` | **Existing but incomplete → existing and verified for explicit device restore.** One student-selected JSON file is size-bounded, validated with `readNil`, staged without mutation and written only after confirmation. |
| Keep sensitive payment data outside general portability and sync | `app/src/lib/workspace-backup.coverage.test.ts`, `app/src/lib/nil.ts`, `app/src/screens/Nil.tsx` | **Intentionally excluded with repository-backed rationale.** Payer names, amounts and descriptions remain outside the general backup and server state; only the dedicated private export/restore path moves them. |
| Explain replacement consequence and recovery | `app/src/screens/Nil.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing and verified.** The preview names both deal counts and exact fields, preserves downloaded exports/Actions reminders/official records, and states that recovery requires a separate export made before replacement. |
| Preserve validation, cancellation and write-failure boundaries | `app/src/screens/Nil.tsx`, `app/src/screens/journey.test.tsx`, `app/src/lib/device-library.ts` | **Existing and verified for this slice.** Invalid input and Cancel leave current bytes unchanged; completion appears only after the guarded device-library accepts the validated record. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and the detected local properties file was not read. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The new guard fails against the former no-restore behavior. Final focused NIL/journey/backup-coverage/preview/root-lifecycle verification passes 57/57; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design contracts pass 69/69, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `ccf2d45ff` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 6 update — reversible athletics-hours removal (slice 96)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Make one student-authored hours-log deletion recoverable | `app/src/components/CaraLog.tsx`, `app/src/components/CaraLog.test.tsx` | **Existing but incomplete → existing and verified for one CARA row.** A successful removal offers Undo for eight seconds and restores the exact entry at its prior position without replacing later entries. |
| Give the repeated row control an exact accessible name | `app/src/components/CaraLog.tsx`, `app/src/components/CaraLog.test.tsx` | **Existing and verified.** The accessible name includes hours, activity kind and date while the visible label remains concise. |
| Preserve data authority and recovery boundaries | `app/src/lib/athletics.ts`, `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing and unchanged.** The current account/term-scoped validated athletics record and workspace backup remain authoritative; no parallel store, sync path or official/compliance mutation was added. |
| Preserve truthful athletics language | `app/src/components/CaraLog.tsx`, `app/src/lib/cara.ts` | **Existing and unchanged.** Semester records and totals student-entered hours but does not decide countability, the applicable limit or compliance. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and the detected local properties file was not read. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Both component guards fail against the former immediate generic removal. Final focused Cara/backup-coverage/root-lifecycle verification passes 27/27; TypeScript, lint, university typecheck and production build pass. Design-check constituents pass 78/78, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Selection-time `origin/main` `ccf2d45ff` contained no equivalent work; final `8107737a8` changes only access-saga adapter, migration and evidence files outside this slice. Slice commit `beda413e7` merged that upstream cleanly as `f41dc507e`, and the combined head passes the same 27/27 focused tests, TypeScript and university gateway typecheck. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 7 update — governed graduation cost-line removal (slice 97)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Require explicit student confirmation before one estimate changes graduation cost totals | `app/src/components/CostPlanner.tsx`, `app/src/components/GraduationSimulator.phase-d.test.tsx` | **Existing but incomplete → existing and verified for one cost line.** The first press now opens the shared confirmation and performs no write; confirmation removes only the selected id and recalculates totals. |
| Explain the exact consequence, preserved authorities and recovery path | `app/src/components/CostPlanner.tsx`, `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing and verified.** The preview identifies label, amount, cadence and source; preserves other estimates/scenarios/downloads/aid and the official audit; and names a pre-removal workspace backup or manual re-entry as recovery. |
| Refuse false completion when device storage rejects the update | `app/src/lib/device-library.ts`, `app/src/components/GraduationSimulator.tsx`, `app/src/components/GraduationSimulator.phase-d.test.tsx` | **Existing and verified for this slice.** The dialog and line remain represented after refusal, completion is not announced and retry uses the same validated graduation library. |
| Preserve route, data and official-record authority | `app/src/lib/graduation.ts`, `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.coverage.test.ts` | **Existing and unchanged.** The device graduation record and validated backup remain authoritative; no account draft, provider, aid or registrar record changes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and the detected local properties file was not read. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Both regression assertions fail against the former first-press removal. Final focused and adjacent coverage passes 100/100; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design contracts pass 69/69, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `8107737a8` is already included and contains no equivalent work. The coherent slice is committed locally as `633bfbfcb`; post-commit HawkScan preflight remains blocked by the recorded runtime, credential and target prerequisites. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 8 update — reversible athletics eligibility-requirement removal (slice 98)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Give a student-entered eligibility rule a tested recovery path | `app/src/components/EligibilityCheck.tsx`, `app/src/components/EligibilityCheck.test.tsx` | **Existing but incomplete → existing and verified for one eligibility row.** A successful removal offers Undo for eight seconds and restores the exact rule at its former position without replacing later work. |
| Give repeated removal controls exact accessible names | `app/src/components/EligibilityCheck.tsx`, `app/src/components/EligibilityCheck.test.tsx` | **Existing and verified.** The accessible name includes the rule and its student-entered source while the visible label stays concise. |
| Preserve validation and refused-write behavior | `app/src/lib/device-library.ts`, `app/src/lib/athletics.ts`, `app/src/components/EligibilityCheck.test.tsx` | **Existing and verified for this slice.** Removal and restoration use the current validated library; a refused write leaves the row represented and reports no false completion or Undo. |
| Preserve data and academic authority | `app/src/lib/athletics.ts`, `app/src/screens/Athletics.tsx`, `app/src/lib/workspace-backup.ts` | **Existing and unchanged.** The account/term-scoped device library and backup remain authoritative; Semester supplies no eligibility rule and makes no determination. |
| Keep mocked test execution isolated | `app/vite.config.ts`, `app/src/isolation.test.ts` | **Existing and verified.** Eligibility, Cara, My Rules and Productivity Cloud tests now appear in the explicit isolation register, and the structural guard passes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` and app-host environment values are unset and the detected local properties file was not read. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Focused eligibility, adjacent Cara and isolation verification passes 7/7; TypeScript, lint, university typecheck and production build pass. The aggregate design-system check passes 9 token tests and 69 contracts, while the test-backed report passes with zero violations, 86 existing warnings and CSS within its ledger. Selection-time `origin/main` `8107737a8` was included and contained no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

Slice commit `88a86781a` merged final upstream `ba24569ab` cleanly as `1948e3daa`. The upstream access-saga, projection-dashboard and GitBook changes do not overlap this row-level recovery slice; the combined head passes the same 7/7 focused tests, TypeScript and university gateway typecheck.

## Automation pass 9 update — account-scoped recoverable housing plans (slice 99)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Keep a private housing draft inside one account and term | `app/src/lib/portal-storage.ts`, `app/src/components/CampusDirectory.tsx`, `app/src/screens/Housing.tsx` | **Existing but incomplete → existing and verified for housing planning.** The v2 key contains account and term; account switching cannot display another account's roommate preferences, notes or checklist. |
| Handle the former term-only record without guessing its owner | `app/src/lib/workspace-backup.coverage.test.ts`, `app/src/components/CampusDirectory.housing.test.tsx` | **Intentionally preserved, not migrated.** The old record stays on the device but is neither displayed in an account workspace nor added to a portable backup. |
| Provide validated portable recovery | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified.** Backup selects one account's housing plans, validates them with `readHousingDraft` and remaps them only to the restoring account. |
| Preserve institution authority | `app/src/components/CampusDirectory.tsx`, `app/src/screens/Housing.tsx` | **Existing and unchanged.** This remains a private application plan; it does not submit an application, confirm eligibility or change an official assignment. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key and app host are unset and no runnable target exists; no DAST scan or security pass is claimed. |

The focused account-isolation, workspace-backup and coverage set passes 42/42. TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design contracts pass 69/69, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `ba24569ab` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 10 update — account-scoped recoverable meal estimates (slice 100)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Keep a private meal estimate inside one account and term | `app/src/lib/portal-storage.ts`, `app/src/components/CampusDirectory.tsx`, `app/src/screens/Meals.tsx` | **Existing but incomplete → existing and verified for meal planning.** The v2 key contains account and term; account switching cannot display another account's plan name, usage assumptions or cost estimate. |
| Handle the former term-only record without guessing its owner | `app/src/lib/workspace-backup.coverage.test.ts`, `app/src/components/CampusDirectory.housing.test.tsx` | **Intentionally preserved, not migrated.** The old record stays on the device but is neither displayed in an account workspace nor added to a portable backup. |
| Provide validated portable recovery | `app/src/lib/workspace-backup.ts`, `app/src/lib/workspace-backup.test.ts` | **Existing and verified.** Backup selects one account's meal estimates, validates them with `readMealDraft` and remaps them only to the restoring account. |
| Preserve financial and institution authority | `app/src/components/CampusDirectory.tsx`, `app/src/screens/Meals.tsx` | **Existing and unchanged.** The calculator remains a student-entered estimate, excludes named benefits and purchases, and does not change the enrolled plan, official balance, charge or payment. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key and app host are unset and no runnable target exists; no DAST scan or security pass is claimed. |

The final focused and adjacent meal, form, account-isolation, workspace-backup and coverage set passes 68/68, including the 44 core red-before-green isolation/backup tests. TypeScript, lint, university typecheck and production build pass. Exact design-check constituents pass 78/78, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Aggregate wrappers and ordered/shuffled full suites are not claimed. Selection-time `origin/main` `ba24569ab` is included and contains no equivalent work; final observed `6e382ff13` changes only `gitbook-docs.yaml`. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 11 update — governed degree-requirement removal (slice 101)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Preview a consequential student-planning deletion before it changes derived results | `app/src/screens/Degree.tsx`, `app/src/screens/degree.requirement-removal.test.tsx` | **Existing but incomplete → existing and verified for one degree-requirement row.** The first press opens a shared preview and does not mutate the requirement list. |
| Identify the exact affected planning input | `app/src/screens/Degree.tsx`, `app/src/screens/degree.requirement-removal.test.tsx` | **Existing and verified.** The preview names the programme, rule, course/hour count and accepted-course list before confirmation. |
| Preserve academic authority and unaffected work | `app/src/screens/Degree.tsx`, `app/src/lib/degree.ts` | **Existing and verified for this slice.** The dialog separates Semester's recalculated planning arithmetic from recorded courses, other rules, scenarios and the registrar's unchanged official audit. |
| State an honest recovery boundary | `app/src/screens/Degree.tsx`, `app/src/components/unity/ActionPreview.tsx` | **Existing and verified.** The action is not presented as undoable; restoring it requires copying the rule again from the current official audit. |
| Preserve accessible modal behavior | `app/src/components/ConfirmDialog.tsx`, `app/src/screens/degree.requirement-removal.test.tsx` | **Existing and verified.** Cancel starts focused, cancellation writes nothing and confirmation removes only the exact represented id. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key and app host are unset and the detected local properties file was not read; no DAST scan or security pass is claimed. |

Both regression tests failed against the former first-press removal. Final focused and adjacent coverage passes 28/28; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design contracts pass 69/69, report contracts pass 96/96, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Aggregate design-check and ordered/shuffled full suites are not claimed. Current `origin/main` `6e382ff13` is included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 1 update — governed recorded-course removal (slice 102)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Preview a consequential student-planning deletion before changing derived degree results | `app/src/screens/Degree.tsx`, `app/src/screens/degree.requirement-removal.test.tsx` | **Existing but incomplete → existing and verified for one recorded-course row.** The first press now opens the shared preview and performs no write; confirmation removes only the exact represented id. |
| Identify the exact copied transcript input and derived consequence | `app/src/screens/Degree.tsx`, `app/src/lib/degree.ts` | **Existing and verified for this slice.** The preview names code, title, term, hours and grade/current state and explains that Semester recalculates planning progress, completed hours and GPA. |
| Preserve academic authority and unaffected work | `app/src/screens/Degree.tsx`, `app/src/state/slices/mine.ts` | **Existing and verified for this slice.** Requirements, other courses, scenarios and the registrar's official transcript remain unchanged; the reducer stays limited to the student-entered planning row. |
| State an honest recovery boundary and preserve accessible modal behavior | `app/src/components/ConfirmDialog.tsx`, `app/src/components/unity/ActionPreview.tsx`, `app/src/screens/degree.requirement-removal.test.tsx` | **Existing and verified.** Cancel starts focused and writes nothing; the preview states that restoration requires entering the course again from the current official transcript. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, `HAWK_API_KEY` / `HAWK_APP_HOST` are unset and no local Hawk properties file was found. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Both regression tests fail against the former first-press removal. Final focused and adjacent coverage passes 30/30; TypeScript, lint, university typecheck and production build pass. Token export passes 9/9, design contracts pass 70/70, audit remains at zero violations with 86 existing warnings, CSS stays within its ledger and the test-backed report writes successfully. Current `origin/main` `c959de8e9` is already included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 2 update — distinguishable complete meal-balance history (slice 103)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Present every represented balance component in history | `app/src/screens/Meals.tsx`, `app/src/lib/meals.ts`, `app/src/screens/meals.balance-removal.test.tsx` | **Existing but incomplete → existing and verified for student-entered history.** Each row now presents swipes or an honest no-reading state, Commodore Cash and meal money. |
| Distinguish repeated row-removal controls | `app/src/screens/Meals.tsx`, `app/src/screens/meals.balance-removal.test.tsx` | **Existing and verified.** The accessible name contains the reading date and the complete displayed value line. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/mine.ts`, `app/src/components/GlobalUndoBar.tsx`, `app/src/screens/meals.balance-removal.test.tsx` | **Existing and unchanged.** Removal still targets one exact id and the shared eight-second Undo receipt remains the recovery path. |
| Preserve financial and institution authority | `app/src/lib/meals.ts`, `app/src/screens/Meals.tsx` | **Existing and unchanged.** The history is student-entered device planning; it does not change an enrolled plan, official dining balance, charge, payment or provider record. |
| Keep test isolation configuration exact | `app/vite.config.ts`, `app/src/isolation.test.ts` | **Existing and verified after reconciliation.** Two duplicate register entries were removed; the guard passes and the corrected ordered suite is green. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and no local Hawk properties file was found. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the prior incomplete row and duplicate accessible name. Focused and adjacent verification passes 166/166; TypeScript, lint and university typecheck pass. Token export passes 9/9, design contracts pass 70/70 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Ordered and shuffled full suites each pass 1,542 files with 2 skipped and 24,439 tests with 81 skipped. Production build passes with the existing chunk-size warning, and the test-backed report completes through a disposable local `npx` shim removed afterward. Selection-time `origin/main` `c959de8e9` is included; final `812960b5b` has no net overlap with this slice. Slice commit `57bf99706` merges it cleanly as `687c91f95`, and the combined head passes 168/168 focused/adjacent/isolation tests plus both TypeScript gates. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 3 update — distinguishable student bill removals (slice 104)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Distinguish repeated student-entered ledger removals | `app/src/screens/Bill.tsx`, `app/src/screens/bill.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Duplicate titles no longer produce duplicate accessible removal names. |
| Identify the exact represented consequence | `app/src/lib/bill.ts`, `app/src/lib/date.ts`, `app/src/screens/Bill.tsx` | **Existing and verified.** Charge names include category/amount; aid names include category, amount, financial meaning and confirmation state; payment names include amount/date. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/mine.ts`, `app/src/lib/undo.ts`, `app/src/screens/bill.removal-labels.test.tsx` | **Existing and unchanged.** Each action still targets one exact row and the shared eight-second Undo receipt remains the recovery path. |
| Preserve financial and institution authority | `app/src/screens/Bill.tsx`, `app/src/lib/bill.ts` | **Existing and unchanged.** These are student-entered planning rows; no school account, official award, money movement, card data, provider or institution record changes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and a local properties file was detected without reading it. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the former title-only labels. Focused and adjacent verification passes 94/94; TypeScript, lint and university typecheck pass. Production build passes with the existing chunk-size warning. Design-check constituents pass 79/79 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Selection-time `origin/main` `812960b5b` is included; final `822623170` changes only separate design-system registry/passport files and contains no equivalent work. Slice commit `c84ba0b7d` merges it cleanly as `1ab849165`, and the combined head passes 94/94 focused tests plus both TypeScript gates. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 4 update — distinguishable activity-commitment removals (slice 105)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Distinguish repeated student-owned consequence controls | `app/src/screens/Activities.tsx`, `app/src/screens/activities.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Commitments with the same name now expose distinct removal names when their represented facts differ. |
| Identify the exact represented commitment | `app/src/lib/activities.ts`, `app/src/screens/Activities.tsx` | **Existing and verified.** The accessible name reuses the row's kind, optional role, fixed schedule or weekly-hours estimate, and optional location. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/mine.ts`, `app/src/lib/undo.ts`, `app/src/screens/activities.removal-labels.test.tsx` | **Existing and unchanged.** Removal still targets one exact id and the shared eight-second Undo receipt remains the recovery path. |
| Preserve institution authority | `app/src/components/CampusDirectory.tsx`, `app/src/screens/Activities.tsx` | **Existing and unchanged.** The row is student-entered device planning; no official directory, membership, event or institution record changes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and a local properties file was detected without reading it. No scanner runtime, live target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the former name-only controls. Focused and adjacent verification passes 178/178; TypeScript, lint and university typecheck pass. Production build passes with the existing chunk-size warning. Token export passes 9/9, design-check contracts pass 70/70 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `822623170` is included and contains no equivalent work. The coherent code/test slice is commit `79abe524b`. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 5 update — distinguishable out-of-pocket cost removals (slice 106)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Distinguish repeated student-owned financial-planning controls | `app/src/screens/Costs.tsx`, `app/src/screens/costs.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Entries with the same free-text name now expose distinct removal names when their represented facts differ. |
| Identify the exact represented out-of-pocket entry | `app/src/lib/cost.ts`, `app/src/screens/Costs.tsx` | **Existing and verified.** The accessible name reuses course code, cost kind, optional rental/resale state and amount paid. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/mine.ts`, `app/src/lib/undo.ts`, `app/src/screens/costs.removal-labels.test.tsx` | **Existing and unchanged.** Removal still targets one exact id and the shared eight-second Undo receipt remains the recovery path. |
| Preserve financial and institution authority | `app/src/screens/Costs.tsx`, `app/src/screens/Bill.tsx` | **Existing and unchanged.** The row is student-entered device planning; no school account, official charge, payment, enrolled plan, provider or institution record changes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and a local properties file was detected without reading it. No scanner runtime, live target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the former name-only controls. Focused and adjacent verification passes 89/89; TypeScript, lint and university typecheck pass. Production build passes with the existing chunk-size warning. The aggregate design-system check passes 9/9 token tests and 70/70 contracts; the test-backed report passes 97/97 contracts with zero violations, 86 existing warnings and CSS within its ledger. Current `origin/main` `822623170` is included and contains no equivalent work. The coherent code/test slice is commit `6be940d97`. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 6 update — distinguishable Support contact removals (slice 107)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Distinguish repeated private contact removals | `app/src/screens/Support.tsx`, `app/src/screens/journey.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Contacts with the same name now expose distinct removal names when their phone records differ. |
| Identify the exact represented contact | `app/src/screens/Support.tsx`, `app/src/lib/support.ts` | **Existing and verified.** The accessible name reuses the contact name and phone number already visible in the row. |
| Preserve exact mutation and recovery behavior | `app/src/screens/Support.tsx`, `app/src/lib/device-library.ts`, `app/src/screens/journey.test.tsx` | **Existing and unchanged.** Preview and Cancel write nothing; confirmation removes only the exact id after the guarded device write succeeds. Emergency contacts remain intentionally excluded from portable backup. |
| Preserve support and institution authority | `app/src/lib/support.ts`, `app/src/screens/Support.tsx` | **Existing and unchanged.** This private device contact does not change an official support, safety, campus, provider or institution record. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and a local properties file was detected without reading it. No scanner runtime, live target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the former name-only controls. Focused and adjacent verification passes 98/98; TypeScript, lint and university typecheck pass. Production build passes with the existing chunk-size warning. Token export passes 9/9, design-check contracts pass 70/70 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. The coherent code/test slice is commit `4078f8e40`; final non-overlapping `origin/main` `02ad46ff0` merges as `70ce0608a`, and the combined head passes 98/98 focused tests plus both TypeScript gates. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 7 update — distinguishable People workspace removals (slice 108)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Distinguish repeated student-authored conversation removals | `app/src/screens/People.tsx`, `app/src/screens/people.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Same-day rows now expose distinct names when their visible subjects differ. |
| Distinguish repeated recommendation-letter removals | `app/src/screens/People.tsx`, `app/src/screens/people.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Same-purpose requests now identify recipient, deadline state and request stage. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/mine.ts`, `app/src/lib/undo.ts`, `app/src/screens/people.removal-labels.test.tsx` | **Existing and unchanged.** Each action still targets one exact id and the shared eight-second Undo receipt remains the recovery path. |
| Preserve relationship and institution authority | `app/src/lib/letters.ts`, `app/src/screens/People.tsx` | **Existing and unchanged.** Rows are private student-authored planning facts; no recommender is contacted and no official application, course or institution record changes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and a local properties file was detected without reading it. No scanner runtime, live target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Both regression paths failed against the former date-only/generic controls. Focused and adjacent verification passes 128/128; TypeScript, lint and university typecheck pass. Production build passes with the existing chunk-size warning. Token export passes 9/9, design-check contracts pass 70/70 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `02ad46ff0` is included and contains no equivalent work. The coherent slice is commit `056cb667e`; its post-commit HawkScan preflight retains the environment-blocked DAST disposition above. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 8 update — distinguishable source removals (slice 109)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Distinguish repeated student-owned citation removals | `app/src/screens/Sources.tsx`, `app/src/screens/sources.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Citations with the same opening text now expose distinct removal names when their complete raw citations differ. |
| Preserve source provenance | `app/src/lib/sources.ts`, `app/src/screens/Sources.tsx` | **Existing and unchanged.** The name repeats the complete student-entered raw citation; Semester does not invent, normalize or claim to verify it. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/papers.ts`, `app/src/lib/undo.ts`, `app/src/screens/sources.removal-labels.test.tsx` | **Existing and unchanged.** Removal still targets one exact id and the shared eight-second Undo receipt remains the recovery path. |
| Preserve academic and provider authority | `app/src/screens/Sources.tsx`, `app/src/lib/sources.ts` | **Existing and unchanged.** The private citation library does not mutate an official record, contact a provider or send source content to an AI service. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and a local properties file was detected without reading it. No scanner runtime, live target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the former 40-character label. Focused and adjacent verification passes 61/61; TypeScript, lint and university typecheck pass. Production build passes with the existing chunk-size warning. The aggregate design-system check passes 9/9 token tests and 70/70 contracts; the test-backed report passes 97/97 contracts with zero violations, 86 existing warnings and CSS within its ledger. Current `origin/main` `02ad46ff0` is included and contains no equivalent work. The coherent code/test slice is commit `04a6a4bae`; its post-commit HawkScan preflight retains the environment-blocked DAST disposition above. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 9 update — distinguishable student-created link removals (slice 110)

| Reference requirement | Current repository evidence | Disposition |
| --- | --- | --- |
| Distinguish repeated private shortcut removals | `app/src/screens/Links.tsx`, `app/src/screens/links.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Links with the same title now expose distinct names when their represented address or group differs. |
| Identify the exact represented shortcut | `app/src/screens/Links.tsx`, `app/src/lib/linkgroups.ts` | **Existing and verified.** The accessible name reuses the student-entered name, resolved address and current group. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/library.ts`, `app/src/lib/undo.ts`, `app/src/screens/links.test.tsx` | **Existing and unchanged.** Removal still targets one exact id and the shared eight-second snapshot restores `extraLinks` and `linkUrls`. |
| Preserve external and institution authority | `app/src/screens/Links.tsx`, `app/src/lib/governance/capability-governance.ts` | **Existing and unchanged.** This private shortcut does not contact its destination, change a campus directory, authenticate a user or mutate provider/institution state. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent, API key/app host are unset and a local properties file was detected without reading it. No scanner runtime, live target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Both removal-name assertions failed against the former title-only control. Focused and adjacent verification passes 167/167; TypeScript, lint and university typecheck pass. Production build passes with the existing chunk-size warning. Token export passes 9/9, design contracts pass 70/70 and the test-backed report completes; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `02ad46ff0` is included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 10 — distinguishable course-editor draft removals (slice 111)

| Reference requirement | Repository authority | Disposition and evidence |
| --- | --- | --- |
| Repeated draft controls remain distinguishable to assistive technology | `app/src/screens/EditCourse.tsx`, `app/src/screens/editcourse.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Duplicate titles no longer produce duplicate removal names when represented weights, schedules or due facts differ. |
| Preserve the course editor's explicit-save authority | `app/src/screens/EditCourse.tsx`, `app/src/lib/edit.ts`, `app/src/state/store.tsx` | **Existing and verified.** The controls still mutate only the local `CourseModule` draft through existing pure helpers. No store dispatch occurs until **Save the changes**; the regression verifies the unsaved-state notice remains. |
| Identify each represented grading/schedule/deadline row | `app/src/screens/EditCourse.tsx`, `app/src/lib/date.ts`, `app/src/lib/locale.ts` | **Existing and verified.** Labels reuse row values plus repository date/weekday locale authorities, and state missing title/time/kind/weight values explicitly. |
| Preserve official-system and data boundaries | Current course editor copy and explicit `replaceCourse` save operation | **Intentionally unchanged.** The slice adds no route, server operation, schema, provider call or institution mutation and does not reinterpret a syllabus or official record. |

The regression fails against the former generic/title-only labels, then 52/52 focused and adjacent tests pass. TypeScript, lint, university gateway typecheck and production build pass. Design-check constituents pass 79/79, report contracts pass 97/97, audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. HawkScan remains open because its mandatory preflight finds no Hawk v6 or Docker runtime and no API-key/app-host environment values; the detected local properties file was not read. No deployment or production execution is inferred.

## Automation pass 11 — distinguishable saved-course removal (slice 112)

| Reference requirement | Repository authority | Disposition and evidence |
| --- | --- | --- |
| Repeated saved-course controls remain distinguishable to assistive technology | `app/src/screens/Me.tsx`, `app/src/screens/me.course-removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Same-code rows now expose distinct removal names when their represented term or syllabus source differs. |
| Identify the exact represented private course copy | `app/src/screens/Me.tsx`, `app/src/lib/term.ts` | **Existing and verified.** The control and dialog reuse course code/name/source plus the repository's readable term authority. |
| Preserve irreversible consequence and exact mutation behavior | `app/src/components/TypeToConfirm.tsx`, `app/src/state/slices/library.ts`, `app/src/state/reducer.test.ts` | **Existing and unchanged.** The student must still type the course code; confirmation removes one exact id and does not offer a false Undo. |
| Preserve official-system and provider boundaries | Current saved-course copy and import recovery language | **Intentionally unchanged.** No registrar/LMS record, provider, authentication state or external system changes. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and API key/app host are unset. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the former unnamed **REMOVE** controls, then focused and adjacent verification passes 119/119. TypeScript, lint, university gateway typecheck and production build pass. Design-check constituents pass 79/79 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `02ad46ff0` is included and contains no equivalent work. No route, dependency, schema, grant, RLS policy, server operation, provider configuration, deployment or external system changed.

## Automation pass 12 — distinguishable Mine workspace removals (slice 113)

| Reference requirement | Repository authority | Disposition and evidence |
| --- | --- | --- |
| Repeated student-owned removal controls remain distinguishable | `app/src/screens/Mine.tsx`, `app/src/screens/mine.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Duplicate step text, action titles and appointment titles now expose distinct removal names when their represented facts differ. |
| Identify the exact represented step or action | `app/src/screens/Mine.tsx`, `app/src/lib/date.ts`, `app/src/lib/repeat.ts`, `app/src/lib/chores.ts` | **Existing and verified.** Step names include position/container/state; action names reuse scope, repository-formatted date/time, repeat and progress facts. |
| Identify the exact represented appointment | `app/src/screens/Mine.tsx`, `app/src/lib/kinds.ts`, `app/src/lib/date.ts`, `app/src/lib/repeat.ts` | **Existing and verified.** Appointment names reuse date, time, kind, location, duration/span and repeat facts already represented by the row/editor. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/mine.ts`, `app/src/composition/taskactions.ts`, `app/src/lib/undo.ts` | **Existing and unchanged.** The same exact-id operations run, and the shared eight-second Undo snapshot remains the recovery path. |
| Preserve official-system and data boundaries | Current Mine device-workspace copy and reducer authority | **Intentionally unchanged.** No official calendar, course, provider or institution record changes; no route, schema or server operation was added. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and API key/app host are unset. No target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Both regression paths failed against the former generic/title-only controls, then focused and adjacent verification passes 189/189. TypeScript, lint and university gateway typecheck pass with twelve existing warnings; production build passes with the existing chunk-size warning. Token export passes 9/9, design contracts pass 70/70 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Final fetched `origin/main` `8a29db78f` only removes isolation entries already absent from this branch and contains no equivalent Mine work. No deployment or production execution is inferred.

## Automation pass 13 — distinguishable saved-equation removals (slice 114)

| Reference requirement | Repository authority | Disposition and evidence |
| --- | --- | --- |
| Same-name saved-formula controls remain distinguishable | `app/src/screens/Equations.tsx`, `app/src/screens/equations.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Same-name formulas now expose distinct removal names when their represented notation, filing or note differs. |
| Identify the represented private formula | `app/src/screens/Equations.tsx`, `app/src/lib/maths.ts`, `app/src/lib/forwork.ts` | **Existing and verified.** The accessible name reuses plain-text notation, personal/course and optional deadline filing, and the optional student note already represented on the formula card. |
| Preserve exact mutation and recovery behavior | `app/src/state/slices/made.ts`, `app/src/lib/undo.ts` | **Existing and unchanged.** The same exact-id `deleteEquation` operation runs, and the shared eight-second snapshot continues to restore only `equations`. |
| Preserve official-system and data boundaries | Current device-owned formula library and recovery copy | **Intentionally unchanged.** Calculator work, plots, documents and official course records remain outside the mutation; no route, schema or server operation was added. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk and Docker are absent and API key/app host are unset. A local properties file was detected but not read; no target, DAST scan, finding result, fix/rescan loop or security pass exists. |

The regression failed against the former name-only control, then focused and adjacent verification passes 219/219. TypeScript, lint and university gateway typecheck pass with twelve existing warnings; production build passes with the existing chunk-size warning. Design-check constituents pass 79/79 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `8a29db78f` is included and contains no equivalent same-name formula guard. No deployment or production execution is inferred.

## Automation pass 14 — distinguishable degree-planning removals (slice 115)

| Reference requirement | Repository authority | Disposition and evidence |
| --- | --- | --- |
| Same-name requirement and same-code course controls remain distinguishable | `app/src/screens/Degree.tsx`, `app/src/screens/degree.requirement-removal.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Repeated names/codes now expose distinct removal names when their represented planning facts differ. |
| Identify the represented student-entered degree rule | `app/src/screens/Degree.tsx`, `app/src/lib/degree.ts` | **Existing and verified.** The accessible name reuses the program, count/unit and accepted-course rule already represented on the row and consequence preview. |
| Identify the represented student-entered recorded course | `app/src/screens/Degree.tsx`, `app/src/lib/degree.ts` | **Existing and verified.** The accessible name reuses title, term, hours and grade/in-progress state already represented on the row and consequence preview. |
| Preserve exact mutation, confirmation and recovery behavior | `app/src/screens/Degree.tsx`, `app/src/state/slices/mine.ts`, `app/src/lib/undo.ts` | **Existing and unchanged.** The same exact-id reducers run only after confirmation, and the shared eight-second snapshots remain the recovery path. |
| Preserve official-system and data boundaries | Current student-entered planning copy and registrar fallback language | **Intentionally unchanged.** No official transcript or degree-audit record changes; no route, schema, server operation or provider call was added. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk v6 and Docker are absent and no live app host is configured. A local properties file exists but was not read; `HAWK_API_KEY` is unset. No DAST scan, finding result, fix/rescan loop or security pass exists. |

Both regressions failed against the former name/code-only controls, then focused and adjacent verification passes 196/196. TypeScript, lint and university gateway typecheck pass with twelve existing warnings; production build passes with the existing chunk-size warning. Token export passes 9/9, design contracts pass 70/70 and exact report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `8a29db78f` is included and contains no equivalent work. No deployment or production execution is inferred.

## Automation pass 15 — distinguishable timer and alarm removals (slice 116)

| Reference requirement | Repository authority | Disposition and evidence |
| --- | --- | --- |
| Same-label timer and same-time alarm controls remain distinguishable | `app/src/screens/Clocks.tsx`, `app/src/screens/clocks.removal-labels.test.tsx` | **Existing but incomplete → existing and verified for this slice.** Repeated visible actions now expose distinct accessible names when their represented timer or alarm facts differ. |
| Identify the represented ordinary timer | `app/src/screens/Clocks.tsx`, `app/src/lib/clocks.ts` | **Existing and verified.** The clear name reuses label, requested duration, current remainder and running/paused state already represented on the timer card. |
| Identify the represented ordinary alarm | `app/src/screens/Clocks.tsx`, `app/src/lib/clocks.ts` | **Existing and verified.** The delete name reuses time, optional label, repeat schedule and on/off state already represented on the alarm row. |
| Preserve exact mutation and device-data behavior | `app/src/state/slices/mine.ts`, `app/src/state/shape.ts` | **Existing and unchanged.** The same exact-id `removeTimer` and `removeAlarm` operations run; no confirmation, Undo, persistence shape or ringing behavior changed. |
| Preserve academic and external-system boundaries | Current ordinary Clocks copy | **Intentionally unchanged.** Timers and alarms remain separate from academic work-session evidence, device notification providers and external clock systems; no server or institution operation was added. |
| Security verification after production behavior changes | `stackhawk.yml` | **Blocked by environment.** Hawk v6 and Docker are absent and API key/app host are unset. A local properties file was detected but not read; no target, DAST scan, finding result, fix/rescan loop or security pass exists. |

Both regressions failed against the former repeated **Clear** and time-only delete names, then focused and adjacent verification passes 182/182. TypeScript, lint/style/label/terms checks and university gateway typecheck pass with twelve existing warnings; production build passes with the existing chunk-size warning. Design-check constituents pass 79/79 and report contracts pass 97/97; audit remains at zero violations with 86 existing warnings and CSS stays within its ledger. Current `origin/main` `8a29db78f` is included and contains no equivalent work. No deployment or production execution is inferred.

## Automation pass 16 mapping — distinguishable graduation-scenario removals (slice 117)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Student can compare multiple graduation what-if scenarios without confusing destructive controls | `app/src/components/GraduationSimulator.tsx`; `app/src/lib/graduation.ts` | Existing but incomplete -> existing and verified for this slice | Removal names now include list position and every represented estimate assumption. The pre-existing exact-id device mutation remains authoritative. |
| Consequence and recovery are explicit before deleting a scenario | `ConfirmDialog`; `ActionPreview`; `useDeviceLibrary`; device workspace backup | Existing and verified for this slice | Cancel is non-mutating; confirmation removes only the selected id after a successful device write; failure keeps the dialog actionable; recovery remains backup-only. |
| Planning estimate remains separate from official and account-held records | `SourceBadge`; `RecordLabel`; per-account `cloudIds`; graduation removal preview | Existing and verified for this slice | Removing the device scenario does not remove its account draft, other scenarios, downloaded summaries or the registrar's official degree audit. No provider/institution action is implied. |
| Duplicate-name regression and repository gates | `GraduationSimulator.test.tsx` plus adjacent graduation/device/degree/a11y/root tests | Existing and verified locally for this slice | Red proof against the former name-only label; 121/121 adjacent tests, TypeScript, lint, university typecheck, build and 9/70/97 design contracts pass. Full ordered/shuffled suites and DAST remain open. |
| Security verification after production behavior changes | `stackhawk.yml` | Blocked by environment | Hawk v6 and Docker are absent and no live app host is configured. `HAWK_API_KEY` is unset; a local properties file exists but was not read. No scan, finding result, fix/rescan loop or security pass exists. |

No route, navigation, shared visual component, dependency, schema, policy, server operation or external system changed. The archive remains specification evidence only; this slice does not establish deployment, institutional acceptance or production readiness.

## Automation pass 17 mapping — distinguishable already-added course-material removals (slice 118)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Repeated student-added course sources remain distinguishable at removal | `app/src/screens/Update.tsx`; `app/src/screens/addmaterial.test.tsx` | Existing but incomplete -> existing and verified for this slice | Removal names now include list position and every represented summary fact. Position distinguishes otherwise identical same-name/source imports. |
| Identify the exact represented material copy | `CourseUpdate`; `formatDate`; the current Already added row | Existing and verified for this slice | The accessible name reuses title, course/unit location, card count, file count, source and added date. |
| Preserve exact mutation and recovery behavior | `removeUpdate`; `app/src/state/slices/library.ts`; `app/src/lib/undo.ts` | Existing and unchanged | The same exact id is removed and the shared snapshot restores `updates` and `courses`; unrelated sources and deadlines remain unchanged. |
| Preserve storage, official-system and provider boundaries | Current Add Material copy and source authority contract | Intentionally unchanged | Stored file bytes are not purged, no scanner/extractor is claimed, and no LMS, provider or institution record changes. |
| Regression and repository gates | `addmaterial.test.tsx` plus reducer/live/labels/root coverage | Existing and verified locally for this slice | Red proof against the title-only label; 216/216 adjacent tests, TypeScript, lint, university typecheck, build and 79/97 design contracts pass. Full ordered/shuffled suites and DAST remain open. |
| Security verification after production behavior changes | `stackhawk.yml` | Blocked by environment | Hawk v6/config and Docker are absent; API key/app host are unset. A local properties file exists but was not read. No live target, scan, finding result, fix/rescan loop or security pass exists. |

No route, navigation, shared visual component, dependency, schema, policy, server operation or external system changed. The archive remains specification evidence only; this slice does not establish deployed ingestion, institutional acceptance or production readiness.

## Automation pass 18 mapping — exact Course Capture original removal (slice 119)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Captured course originals remain individually identifiable | `app/src/components/CourseCapture.tsx`; `CaptureOriginal`; `captureHash` | Existing but incomplete -> existing and verified for this slice | Stable session sequence ids and removal names now distinguish duplicate filenames with position, MIME type, byte count and hash prefix. |
| One removal affects only the represented persisted copy | `CourseCapture.onFiles`; `CourseCapture.onRemovePersisted`; `Update.deleteFile` | Existing but incomplete -> existing and verified for this slice | Returned persisted ids are associated by input position with the exact original; removal sends a one-id array instead of every capture-session id. |
| Failed storage mutation cannot fabricate completion | Course Capture status region and selected-row pending state | Missing and in scope -> existing and verified for this slice | The selected control is disabled while pending. Rejection keeps both the local row and persisted id represented and announces that the copies remain with a retry. |
| Consent, data-authority and official-system boundaries remain separate | Effective capture policy; explicit consent control; current Course Capture copy | Existing and unchanged | Consent withdrawal remains session-wide; this row operation does not claim provider disposal, scanner/extractor execution or LMS/institution mutation. |
| Regression and repository gates | `CourseCapture.test.tsx` plus capture-policy/domain/a11y/root tests | Existing and verified locally for this slice | Red proof against filename-only/all-ids removal; 26/26 adjacent tests, TypeScript, lint, university typecheck, build and 79/97 design contracts pass. Full ordered/shuffled suites and DAST remain open. |
| Security verification after production behavior changes | `stackhawk.yml` | Blocked by environment | Hawk v6/config and Docker are absent; API key/app host are unset. A local properties file exists but was not read. No live target, scan, finding result, fix/rescan loop or security pass exists. |

Slice commit `f78ae804e` merges non-overlapping final `origin/main` `ee11c2789` as `09f395c8e`. The combined head passes 26/26 focused tests, TypeScript, university typecheck, regenerated production build and the refreshed performance-budget check.

No route, navigation, shared visual component, dependency, schema, policy, server authorization, provider configuration or external system changed. The archive remains specification evidence only; this slice does not establish deployed ingestion, institutional acceptance or production readiness.

## Automation pass 19 mapping — governed shared group-part removal (slice 120)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Shared academic actions identify the exact represented item | `app/src/screens/Groupwork.tsx`; `PartRow`; current group roster | Existing but incomplete -> existing and verified for this slice | Removal names include list position, title, completion, assignee/unclaimed state and deadline, distinguishing duplicate-titled rows. |
| A consequential collaborator-visible deletion is previewed before execution | Shared `ConfirmDialog`; shared `ActionPreview`; `app/src/screens/groupwork.part-removal.test.tsx` | Missing and in scope -> existing and verified for this slice | Cancel starts focused and writes nothing; confirmation states the group-wide effect, exact row, unaffected records and manual-only recovery. |
| Server authorization and failure truth remain authoritative | `dropPart`; `supabase/migrations/20260901000500_groups.sql` member policies | Existing and verified | The UI still invokes one exact-id delete under verified-student/class/group membership RLS. Refusal leaves the row visible and reports a retry instead of fabricating success. |
| Official records and unrelated shared state stay outside the mutation | Current Group Work copy and preview boundary | Intentionally unchanged | Group membership, other parts, course records and provider/institution systems are not changed or claimed. |
| Regression and repository gates | New Group Work removal test plus group-domain/room-key/signed-out/root/isolation/integration-control/repository-map guards | Existing and verified locally for this slice | Red proof against title-only one-press deletion; 36/36 adjacent and final 181/181 broader tests, TypeScript, lint, university typecheck, build and aggregate 9/70/97 design contracts pass. `MOCKS_MODULES` now covers this and the earlier omitted mocked Activities test. Full ordered/shuffled suites and DAST remain open. |
| Security verification after production behavior changes | `stackhawk.yml` | Blocked by environment | Hawk and Docker are absent; API key/app host are unset and no local properties file was detected. No runnable target, scan, finding result, fix/rescan loop or security pass exists. |

No route, navigation, dependency, schema, policy, grant, RLS rule, provider configuration or external system changed. The archive remains specification evidence only; this slice does not establish deployment, institutional acceptance or production readiness.

## Automation pass 20 mapping — governed shared group departure (slice 121)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| A collaborator-visible membership change is previewed before execution | `app/src/screens/Groupwork.tsx`; shared `ConfirmDialog`; shared `ActionPreview` | Missing and in scope -> existing and verified for this slice | Cancel starts focused and writes nothing. The preview identifies the group, current member/part/assignment counts, immediate checklist-access loss, unaffected records and rejoin recovery. |
| Only the signed-in student may leave the exact group | `leaveGroup`; `public.group_members`; `private.group_in_my_class`; self-only delete policy in `supabase/migrations/20260901000500_groups.sql` | Existing and verified | The UI still invokes the exact `(group_id, user_id)` delete only after confirmation; verified-student/class and self-only RLS remain unchanged. |
| Successful departure cannot fabricate continued task access | Group Work loaded roster; member-only `group_tasks` read policy | Existing but incomplete -> existing and verified for this slice | Success removes only the signed-in member from the loaded roster and clears the inaccessible task copy. It no longer performs the post-delete task read that RLS must refuse. |
| Refusal and recovery remain truthful | Group Work error region; same leave control; same public group list/join operation | Existing and verified for this slice | A refused delete leaves membership and tasks represented with a retry. A successful leaver can rejoin while still in the class; rejoining restores access without rewriting assignments. |
| Regression and repository gates | Extended `groupwork.part-removal.test.tsx` plus classmates/room-key/signed-out/root/isolation/repository-map coverage | Existing and verified locally for this slice | Three guards proved red against one-press/reload behavior; 76/76 adjacent and final 199/199 broader tests, TypeScript, lint, university typecheck, build and aggregate 9/70 design contracts pass. Full ordered/shuffled suites and DAST remain open. |
| Durable membership-history audit | Current `group_members` row and direct delete operation | Existing but incomplete | Current state is server-authoritative and the delete is naturally repeat-safe, but no immutable leave/rejoin history is evidenced. This broader server/data-contract gap remains open. |
| Security verification after production behavior changes | `stackhawk.yml` | Blocked by environment | Hawk/config and Docker are absent; API key/app host are unset. A local properties file exists but was not read. No live target, scan, finding result, fix/rescan loop or security pass exists. |

No route, navigation, dependency, schema, policy, grant, RLS rule, provider configuration or external system changed. The archive remains specification evidence only; this slice does not establish deployment, production execution, institutional acceptance, legal review or production readiness.

## Automation pass 21 — governed saved-residence removal

| Requirement | Repository authority | Disposition | Evidence and boundary |
|---|---|---|---|
| Identify the exact saved room before removal | `app/src/screens/Housing.tsx`; current term-scoped `Residence` | Existing but incomplete → existing and verified locally | The control now names the hall, optional room and readable term instead of generic **Remove this room**. |
| Preview the device-only consequence | Shared `ConfirmDialog`; shared `ActionPreview` | Existing but incomplete → existing and verified locally | Cancel starts focused and writes nothing. The preview names the term, move-out date and hours-after-final rule before any mutation. |
| Preserve separate authorities | `dropResidence`; maintenance rows; account/term housing plan; official housing portal | Existing and verified for this slice | Confirmation removes only the represented residence id. Maintenance requests, the separate application plan and official assignment stay unchanged. No provider call exists. |
| Keep recovery honest | Existing `dropResidence` entry in `app/src/lib/undo.ts`; validated workspace backup | Existing and verified | The existing eight-second residence snapshot remains available; a workspace backup is the longer recovery path. |
| Regression and repository gates | `app/src/screens/housing.residence-removal.test.tsx` plus adjacent Housing/maintenance/domain/Undo coverage | Existing and verified locally for this slice | Both guards proved red against the one-press action; 2/2 direct, 74/74 adjacent and final 198/198 focused/root/isolation/repository-map tests pass with both typechecks, lint, build and aggregate design check/report. |
| DAST security verification | `stackhawk.yml`; active HawkScan skill | Blocked by environment | Hawk v6/config and Docker are absent, API-key/app-host values are unset and no live target exists. The local properties file was detected but not read. No scan or security pass is claimed. |

No route, navigation, dependency, schema, authorization policy, provider configuration or external system changed. The archive remains specification evidence only; this local slice does not establish deployment, live provider behavior, institutional acceptance or production readiness.

## Automation pass 22 mapping — distinguishable maintenance-request removals (slice 123)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Repeated student-recorded repair requests remain distinguishable at removal | `app/src/components/MaintenanceRequests.tsx`; `app/src/components/MaintenanceRequests.test.tsx` | Existing but incomplete → existing and verified for this slice | Accessible names now include collection position and all represented summary facts, distinguishing otherwise identical rows. |
| Preserve exact mutation, reconciliation and recovery | `dropMaintenance`; `app/src/lib/deletions.ts`; `app/src/lib/merge.ts`; `app/src/lib/undo.ts` | Existing and unchanged | The same exact-id device mutation, deletion settlement and eight-second Undo snapshot remain authoritative. |
| Preserve housing authority and emergency boundaries | `app/src/lib/maintenance.ts`; current Maintenance intro and guidance | Intentionally unchanged | Semester records what the student already reported; removal neither contacts housing nor withdraws an official request. |
| Regression and focused verification | Maintenance component/domain/Undo, residence-removal, root-lifecycle and isolation tests | Existing and verified locally for this slice | Red proof against the generic name; 106/106 focused/adjacent and 109/109 broader tests pass with both typechecks, lint, build and aggregate design check/report. |
| DAST security verification | `stackhawk.yml`; active HawkScan skill | Blocked by environment | Hawk v6/config and Docker are absent, API-key/app-host values are unset and no runnable target exists. A local properties file was detected but not read; no scan or security pass is claimed. |

No route, navigation, dependency, schema, policy, provider configuration or external system changed. The archive remains specification evidence only; this local slice does not establish deployment, live provider behavior, institutional acceptance or production readiness.

## Automation pass 23 mapping — distinguishable connected-calendar removals (slice 124)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Repeated connected-source names remain distinguishable at removal | `app/src/screens/Connect.tsx`; `app/src/screens/connect.removal-labels.test.tsx` | Existing but incomplete → existing and verified for this slice | Accessible names identify list position, source name, import/subscription/Canvas authority, event count and read result. Private subscription URLs are not exposed in the name. |
| Preserve exact mutation and recovery | `removeFeed`; `app/src/state/slices/library.ts`; `app/src/lib/undo.ts` | Existing and unchanged | The same exact-id reducer removes only the represented source and its `sourceId` events; the shared eight-second snapshot restores only `feeds` and `feedEvents`. |
| Preserve external authority boundaries | Connect provider revocation flows; official calendar systems | Intentionally unchanged | Removing a device source does not revoke provider authorization, mutate an external calendar or claim an official institutional record changed. |
| Regression and focused verification | New rendered regression plus reducer/Undo/freshness/label/root/isolation guards | Existing and verified locally for this slice | Red proof against the former name-only control; final 184/184 focused/adjacent tests, both typechecks, lint, build and aggregate design check/report pass. Full ordered/shuffled suites remain open. |
| DAST security verification | `stackhawk.yml`; active HawkScan skill | Blocked by environment | Hawk v6/config and Docker are absent, API-key/app-host values are unset and no runnable target exists. A local properties file was detected but not read; no scan or security pass is claimed. |

No route, navigation, dependency, schema, policy, provider configuration or external system changed. The archive remains specification evidence only; this local slice does not establish deployment, live provider behavior, institutional acceptance or production readiness.

## Automation pass 24 mapping — distinguishable protected-time removals (slice 125)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Repeated student-authored protected-time labels remain distinguishable at removal | `app/src/components/Capacity.tsx`; `app/src/components/capacity.removal-labels.test.tsx` | Existing but incomplete → existing and verified for this slice | Accessible names identify list position, complete label, selected weekday set and local time span. Position distinguishes otherwise identical rows. |
| Preserve exact mutation, arithmetic and recovery | `dropRest`; `app/src/state/slices/mine.ts`; `app/src/lib/rest.ts`; `app/src/lib/undo.ts` | Existing and unchanged | The same exact-id reducer removes only the represented block; capacity recalculates from persisted state and the shared eight-second snapshot restores only `rest`. |
| Preserve schedule authority boundaries | Workload settings; student-authored protected time | Intentionally unchanged | Removing a private device block does not change a provider calendar, official timetable, course record or institution system. |
| Regression and focused verification | New rendered regression plus rest/reducer/Undo/label/root/isolation guards | Existing and verified locally for this slice | Red proof against the former label-only control; final 89/89 focused/adjacent tests, both typechecks, lint, build and aggregate design check/report pass. Final upstream changes only developer-tools documentation. Full ordered/shuffled suites remain open. |
| DAST security verification | `stackhawk.yml`; active HawkScan skill | Blocked by environment | Hawk v6/config and Docker are absent, API-key/app-host values are unset and no runnable target exists. A local properties file was detected but not read; no scan or security pass is claimed. |

No route, navigation, dependency, schema, policy, provider configuration or external system changed. The archive remains specification evidence only; this local slice does not establish deployment, live provider behavior, institutional acceptance or production readiness.

## Automation pass 25 mapping — distinguishable work-window removals (slice 126)

| Reference intent | Current production authority | Integration disposition | Evidence / remaining boundary |
| --- | --- | --- | --- |
| Repeated student-authored work-window labels remain distinguishable at removal | `app/src/components/WorkWindows.tsx`; `app/src/components/workwindows.removal-labels.test.tsx` | Existing but incomplete → existing and verified for this slice | Accessible names identify list position, complete label, selected weekday set, local time span and weekly hours. Position distinguishes otherwise identical rows. |
| Preserve exact mutation, arithmetic and recovery | `dropWindow`; `app/src/state/slices/mine.ts`; `app/src/lib/windows.ts`; `app/src/lib/undo.ts` | Existing and unchanged | The same exact-id reducer removes only the represented window; availability recalculates from persisted state and the shared eight-second snapshot restores only `windows`. |
| Preserve schedule authority boundaries | Workload settings; student-authored work windows | Intentionally unchanged | Removing a private device window does not change a provider calendar, official timetable, course record or institution system. |
| Regression and focused verification | New rendered regression plus window/storage/reducer/Undo/label/root/isolation guards | Existing and verified locally for this slice | Red proof against the former label-only control; final 118/118 focused/adjacent tests, both typechecks, lint, build and aggregate 9/70/97 design contracts pass. Full ordered/shuffled suites remain open. |
| Final upstream reconciliation | Slice commit `529e1858f`; `origin/main` `45d7260c4`; merge `59af98c30` | Existing and verified for this slice | Upstream changes only production-smoke workflow/docs and its status-history guard; it does not overlap WorkWindows or these controls. The merged head passes 151/151 focused/adjacent/upstream tests, both typechecks, lint and build. |
| DAST security verification | `stackhawk.yml`; active HawkScan skill | Blocked by environment | Hawk v6/config and Docker are absent, API-key/app-host values are unset and no runnable target exists. A local properties file was detected but not read; no scan or security pass is claimed. |

No route, navigation, dependency, schema, policy, provider configuration or external system changed. The archive remains specification evidence only; this local slice does not establish deployment, live provider behavior, institutional acceptance or production readiness.
