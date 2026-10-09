# Handoff integration crosswalk

**Refreshed** 2026-10-09 · **Latest observed `origin/main`** `e128a526` · **Archive SHA-256** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`

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
| Consequence pattern | Existing but incomplete. `ActionPreview` is used inside leave-university, approve-join and sign-out-other-devices dialogs, all three AI Toolkit irreversible local deletions, device-only filed-feedback and assistant-conversation deletion, device-only Support emergency-contact removal, whole Student Operating workspace deletion, single-plan plus whole-rhythm Operating Rhythm deletion, the reachable Today daily-plan deletion, student-owned Applications- and Opportunities-tracker deletion, the owner-checked Community-post deletion, owner-scoped published-form withdrawal, Start Here result plus private Learning Map concept/question deletion and saved Term-plan schedule deletion. Reversible connected-calendar removal restores exactly the source plus its imported events through the shared Undo path; student-created-link removal likewise restores the row, custom group and corrected address; saved-equation removal restores the exact formula, note and course/deadline filing; committed Study-plan removal restores its sittings, progress and live-session association; nested task-step removal restores the exact checklist row without reverting unrelated state; student-entered charge, aid and payment rows each restore through an isolated Bill-list snapshot without changing university records or moving money; student-authored graph-line removal restores the expression, visibility state and list order without reverting later calculator work. Other confirmations still write their own sentences; graph-wide Clear, permanent file purge and the same-origin demo reset need separate retention/isolation/recovery reconciliation before selection. |
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
