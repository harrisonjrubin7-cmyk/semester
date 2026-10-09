# Handoff integration crosswalk

**Refreshed** 2026-10-08 · **Base** `origin/main` `55adab11` · **Archive SHA-256** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`

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

## Course Engine current-artifact reconciliation

The repository gained a separate `course-engine/` MVP at `b190f96a`. It is not mounted-archive code, but it overlaps Course Studio requirements and therefore had to be reconciled before selecting that domain slice. [`REFERENCE-COURSE-ENGINE-RECONCILIATION.md`](REFERENCE-COURSE-ENGINE-RECONCILIATION.md) covers its sixteen meaningful families and records why its 15-route Next.js/Tailwind shell, separate JWT identity, 21-entity Alembic model and Compose topology are not integration targets.

The reconciliation preserves useful current-product evidence: Semester's existing Import path accepts multiple syllabus/readings, holds dates for review and explicit confirmation, and retains source excerpts; Study Studio selects multiple sources, checks course AI policy and exact quotations, and saves editable source-linked drafts. Those behaviors remain existing but incomplete because server-side course/source persistence, approved storage/scanning/retention, exact request-context and course-relationship enforcement, correction propagation and operating evidence are not complete. The next dependency is the repository-native `student-files` / `course-materials` authority contract, followed by a bounded extension of current Import and Study Studio—not a new route or parallel course model.

Automation pass 10 implements and tests that pre-ingestion authority in `app/server/course-sources/contract.ts` and [`COURSE-SOURCE-AUTHORITY.md`](../COURSE-SOURCE-AUTHORITY.md). It reuses the platform file engine; binds student sources to exact course-row ownership and tenant membership; binds shared course material to exact course-scoped publication authority and a versioned retention policy; requires idempotency and rate-limit approval; restricts server intake to bounded document types; reserves quarantine/scan settlement to a tenant-bound service; rejects type, scan and integrity failures; and records hash-linked corrections plus content-free audit facts. This changes CE-05's authority sub-contract from missing to locally verified, but CE-05 remains **existing but incomplete** because no metadata schema/RLS, bucket, scanner, extraction worker, route, current-screen wiring, deployment or operating evidence exists.

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
| `student-files`, `course-materials` buckets | Missing. |
| Evidence bucket | Duplicate or superseded. `trust-packet` is the pattern. |
| Free-text scan (`lib/ai/redact.ts`) | Not built. `D-1298`: the class gate does not read free text on purpose. A drafted scan on this branch was discarded before push. |
| Provenance ladder and conflict resolution | Existing but incomplete. Five source labels, no ranked conflict pick. |
| Freshness windows | Duplicate or superseded. Callers pass `maxAgeMs`. |
| Projection-lag freshness | Missing. |
| Next-action scoring | Existing but incomplete. |
| Access matrix | Duplicate or superseded as a second matrix. |
| Break-glass two-person | Existing and verified in SQL. `decide_approval` plus `console-approvals.check.sql`. |
| Consequence pattern | Existing but incomplete. `ActionPreview` is the preview inside the leave-university and approve-join dialogs (`SchoolClaim.tsx`, `SchoolMembership.test.tsx`) and inside sign-out-other-devices (`AccountSecurity.tsx`, `AccountSecurity.test.tsx`). Other confirmations still write their own sentences. |
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

The source audit still records 57 missing screen rows and 75 missing workflow steps. Pass 5 dispositions the screen set as 44 missing and in scope, 4 externally blocked, 6 excluded, 1 roadmap-only and 2 consent-bounded existing analogues. Pass 6 dispositions the workflow set as 54 missing and in scope, 18 roadmap-only, 2 externally blocked, 4 excluded and 241 existing incomplete. Role, system, document and execution-stream reconciliation are closed for the identified populations, but implementation is not: P1-07 and slice 16 supply only the first projection query/Console read path, while slice 18 supplies only a pre-ingestion course-source authority contract and the buildable screen/workflow candidates remain open. The five brief names that looked absent are recorded in `SCREEN-PACKS.md` §4. The folded advisor list is labeled Caseload and is shared plans only. This page does not say the handoff is integrated.
