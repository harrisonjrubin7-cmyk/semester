# Handoff integration crosswalk

**Date** 2026-10-05 · **Base** `origin/main` `3bd382dc`

This page maps the design export onto the production repository. It does not replace `docs/design-system/MASTER-BRIEF-CROSSWALK.md` (the 19 visual deliverables) or `docs/master/REPO_AUDIT.md` (one row per catalogued screen and workflow step).

## How a row was classed

| Disposition | Meaning here |
| --- | --- |
| Existing and verified | A reachable implementation plus a named test or policy suite that fails when the behaviour is removed. |
| Existing but incomplete | Something real is reachable, and a material part of the release definition is absent. Catalog `exists` is this class: the audit says that word is not a test result. |
| Prototype only | A handoff file describes it. Production does not route it. The kit HTML is not in this repository. |
| Missing | Searched, and nothing implements it. |
| Duplicate or superseded | The repository already has the contract. The handoff copy is not imported. |
| Roadmap or business concept | Not authorized product scope. `D-1287` §4 answers four of these "no". `D-1298` withdraws the free-text scanner. |
| Blocked | Needs an external approval, credential, vendor, institution, legal review, or staffing. |

## What was inventoried

The Desktop zip and `ui_kits/` were not on this machine. `D-1287` keeps only `handoff/` under `docs/handoff/` (139 files, recounted). Catalogs in `docs/master/` are the committed screen, role, workflow, and gap lists.

Recount, this tree: 119 non-test screen files, 382 non-test components, 1356 test files under `app/src`, 184 migrations, 16 edge function directories. The audit's surface table still says 1351 tests; the later count is the one to use.

Audit totals, not re-judged row by row here: screens 260 / 272 / 57 (589). Workflow steps 116 / 128 / 75 (319).

## Catalog groups

Row-level notes stay in `REPO_AUDIT.md`. Catalog `exists` is existing but incomplete against the 22-point definition.

| Group | Audit exists / partial / missing | Disposition |
| --- | --- | --- |
| A · Public company site (80) | 53 / 26 / 1 | Existing but incomplete. Claims stay inside the approved register. The Pilot page is missing as an app route. |
| B · Student OS (70) | 60 / 10 / 0 | Existing but incomplete. Term Plan is the Registration planner (`yes`): the tab and heading say Term plan, and the cart names a time conflict before the sections. |
| C · Faculty and Course Studio (36) | 8 / 18 / 10 | Existing but incomplete. |
| D · Advisor and student success (25) | 3 / 13 / 9 | Existing but incomplete. Advisor Caseload is not a named screen. |
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

`SCREEN-PACKS.md` names 18 screens. Term Plan is the Registration planner (`yes`): the tab and heading say Term plan, and the cart names a time conflict before the sections. `SCREEN-PACKS.md` §4 records the other four brief names: Advisor Caseload is blocked on institution advisor–student data and consent; Tenant Overview and Operations Inbox exist in part (customer records, and the read-only exception queue) and are not retitled; the Institutional Pilot page is routed pages on the company site. Renaming is a product decision and is not made here. Kit paths are prototype only and are not in the repository.

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

57 catalog screens and 75 workflow steps are missing. The five brief names that looked absent are recorded in `SCREEN-PACKS.md` §4. This page does not say the handoff is integrated.
