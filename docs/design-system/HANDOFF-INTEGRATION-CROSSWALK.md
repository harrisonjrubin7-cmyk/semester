# Handoff integration crosswalk

**Refreshed** 2026-10-08 · **Base** `origin/main` `ca0cc9ad` · **Archive SHA-256** `12edfe6ad1c1c02e7c4f0512f1ca4233b0b9f3943b30adde822bd67062867086`

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
| `handoff/prototype/screens.json` | 281 unique routes in 26 workspaces; generated 2026-10-06 | Prototype only pending route-by-route repository mapping. |
| `handoff/registry/capabilities.json` | 122 rows; all say implemented/tested/deployed false; 55 claim backend true and all 122 claim data true | Documentation or roadmap only pending capability-by-capability verification. Archive status is not repository evidence. |
| `handoff/capability-blueprint/SEM-01.md`–`SEM-20.md` and CSV | 20 proposed capabilities; all implementation/test/deployment/authorization/enabled fields unverified or not established in the archive | Reconciled in [`REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md`](REFERENCE-MEANINGFUL-ITEM-RECONCILIATION.md): 16 existing but incomplete, 2 documentation or roadmap only, 1 blocked externally and 1 intentionally excluded. Repository evidence, not archive status, sets each result. |
| `handoff/capability-blueprint/tenant-isolation-proof-manifest.json` | Zero objects; explicitly illustrative | Documentation or roadmap only; do not treat as tenant-isolation proof. |
| `ui_kits/master-catalog/catalog-data.js` | 673 screen rows, 319 workflow steps, 49 role rows, 88 systems, 82 documents and 84 added-screen rows; prose claims 51 roles | Documentation or roadmap only pending row-level reconciliation. The archive's generated `docs/master/SEMESTER_SCREEN_CATALOG.md` still has 589 rows, so neither archive population silently replaces the other or the repository audit. |
| Streams `00`–`30` | 31 numbered streams plus index; later files override earlier ordering inside the archive | Documentation or roadmap only; mapped into the user's Phases 0–12, not executed as instructions. |

## Pass 2 meaningful-item coverage

The first capability-level register now covers every meaningful item selected for the Phase 0 seed:

| Population | Rows dispositioned | Result |
| --- | ---: | --- |
| Capability blueprint | 20 / 20 | Production owner, authority, tenant/data boundary, recovery/test evidence, dependency and release ceiling recorded. |
| Stream 00 | 6 / 6 | Current audit/design authorities retained; archive executable procedure excluded. |
| Stream 18 | 23 / 23 | Sixteen requested documents map to current `docs/roles/*`; seven underlying product decisions remain separately honest. |
| Stream 25 | 28 / 28 | Eighteen packages, seven “one” rules and three open decisions map to current authorities. |

The seed identifies no production implementation that is safe to start ahead of the remaining capability mapping. P11 graduate/research education is missing and in scope, but its authority/data contract and role ownership are not defined. The next row-level population is the 122-row archive capability registry, followed by 281 prototype routes and 673 archive catalog screens.

## Current repository mapping baseline

The verified base has 97 app screen-registry keys including `home` and `onboarding`, 62 navigation destinations, 120 non-test screen files, 407 non-test component files, 1,393 `app/src` test files, 203 migrations, 17 edge-function directories and 51 non-test gateway handlers. The generated permission matrix records 69 roles, 84 capabilities and 157 role-capability grants. These counts are repository census evidence only; they do not elevate any catalog row to verified.

The repository catalog remains 589 screens (260 exists / 272 partial / 57 missing) and 319 workflow steps (116 exists / 128 partial / 75 missing) until row-level evidence is refreshed. The archive's 281 prototype routes and 673 catalog screens are separate populations and will not be merged by label alone.

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

`docs/master/*` business, launch, and 12-month documents are roadmap or business concepts unless a row in `REPO_AUDIT.md` points at code.

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

`docs/master/SEMESTER_PDF_RECONCILIATION.md`, `SEMESTER_SOURCE_OF_TRUTH.md`, `SEMESTER_MASTER_CURRENT_STATE.md`, `SEMESTER_GAP_AND_STATUS_REGISTER.md`, `SEMESTER_ROLE_SCREEN_WORKFLOW_MATRIX.md` and `SEMESTER_EXECUTION_ROADMAP.md` landed in #1305. They do not replace this page. The matrix §3 is the component-name map: 18 PDF names match an export, 13 have an equivalent under another name, and the rest are not created here. A new shared component still needs `docs/design/GOVERNANCE.md` §2. The roadmap's projection worker and `ops_*` read models are not started.

## Blocked outside the repository

Legal review, DPA, insurance, HECVAT, named institutional contacts, live IdP, live SIS/LMS, production cutover, HawkScan for this change, accessibility conformance review, restore drill, and staffing for incident response. None of these is claimed.

## Not complete

57 catalog screens and 75 workflow steps are missing. The five brief names that looked absent are recorded in `SCREEN-PACKS.md` §4. The folded advisor list is labeled Caseload and is shared plans only. This page does not say the handoff is integrated.
