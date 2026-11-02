# Ecosystem coverage matrix

**Date** 2026-10-12 · **Base** `origin/main` `91cf0ddc` · **Branch** `claude/housing-maintenance-requests`

One page that answers "how much of Semester is built", from the reconciliation files that already disposition every item in the design handoff. It adds no new inventory. Every count below is regenerated from these sources, not copied from an older page:

| Population | Source | Rows |
| --- | --- | --- |
| Catalog screens | [`REFERENCE-CATALOG-SCREEN-RECONCILIATION.csv`](REFERENCE-CATALOG-SCREEN-RECONCILIATION.csv) | 673 |
| Workflow steps | [`REFERENCE-WORKFLOW-RECONCILIATION.csv`](REFERENCE-WORKFLOW-RECONCILIATION.csv) | 319 (17 workflows) |
| Prototype routes | [`REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.csv`](REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.csv) | 281 (26 workspaces) |
| Roles, systems, documents | [`REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.csv`](REFERENCE-ROLE-SYSTEM-DOCUMENT-RECONCILIATION.csv) | 219 |
| Archive files | [`REFERENCE-ARCHIVE-INVENTORY.csv`](REFERENCE-ARCHIVE-INVENTORY.csv) | 3,570 |

Every item still open (missing, blocked or partial) is one row of [`ECOSYSTEM-OPEN-ITEMS.csv`](ECOSYSTEM-OPEN-ITEMS.csv), with the acceptance contract its source row states and any open pull request that may already be doing it.

## Status vocabulary

The handoff's seven-level ladder (`handoff/REPO-CROSSWALK.md` in the design export, landing as `docs/handoff/` with #1495): specified → schema-present → code-present → connected → tested → deployed → operational. The reconciliation files use a coarser disposition. "Existing but incomplete" means code or schema is present and the full vertical-slice contract (states, server authorization, persistence, tests, deployment) is not shown. **No row in any population is "existing and verified".** That is the headline, and it is not a failure of the counting: it is what the evidence supports.

## Catalog screens, by system

| System | Incomplete | Missing | Blocked | Duplicate | Excluded | Doc only |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A · Public site | 79 | 0 | 1 | 0 | 0 | 0 |
| B · Student OS | 70 | 0 | 0 | 12 | 0 | 0 |
| C · Faculty & Course Studio | 26 | 8 | 0 | 3 | 2 | 0 |
| D · Advisor & student success | 18 | 6 | 0 | 4 | 1 | 0 |
| E · Registrar & academic operations | 32 | 3 | 0 | 1 | 0 | 0 |
| F · Student accounts, aid & commerce | 28 | 1 | 0 | 0 | 0 | 0 |
| G · Campus life | 30 | 4 | 0 | 3 | 1 | 0 |
| H · Community & moderation | 26 | 2 | 0 | 6 | 1 | 0 |
| I · Family & guardian | 10 | 2 | 0 | 1 | 0 | 0 |
| J · Career, employer, alumni | 30 | 8 | 0 | 0 | 1 | 1 |
| K · Institutional administration | 40 | 1 | 0 | 8 | 0 | 0 |
| L · Integrations | 25 | 1 | 2 | 25 | 0 | 0 |
| M · Trust, privacy, security | 42 | 5 | 1 | 0 | 0 | 0 |
| N · Operations Command Center | 78 | 3 | 0 | 21 | 0 | 0 |
| **Total (673)** | **534** | **44** | **4** | **84** | **6** | **1** |

The four blocked screens wait on something outside the repository: calendar booking (A-035), OneRoster REST sync (L-024), Edu-API configuration (L-025) and pen-test evidence (M-027).

## Workflows

| Workflow | Incomplete | Missing | Other |
| --- | ---: | ---: | --- |
| Student | 40 | 0 | |
| Faculty | 15 | 9 | |
| Advisor / student success | 7 | 10 | |
| Registrar | 20 | 1 | |
| Institutional implementation | 19 | 3 | |
| Controlled integration | 20 | 0 | |
| AI | 17 | 0 | |
| Support | 11 | 1 | |
| Incident | 8 | 9 | |
| Domain migration | 16 | 1 | |
| Student finance | 15 | 1 | |
| Campus services | 11 | 3 | 1 blocked |
| Community & moderation | 14 | 1 | 4 excluded, 1 doc |
| Career & employer | 9 | 8 | 1 doc |
| Family consent | 12 | 1 | |
| Developer platform | 0 | 0 | 16 doc only |
| Analytics & outcomes | 7 | 6 | 1 blocked |

The weakest areas by missing share are the advisor caseload (10 of 17), incident response (9 of 17) and career/employer (8 of 18). Each needs a staff-side queue with server authorization, not a student screen.

## Prototype workspaces

201 of the 281 prototype routes are **prototype only**: the route exists in the design project and no current app screen owns it. The workspaces with no current owner at all are applicant, advisor, finops, support, admissions, career, insights, family, alumni, success and clubs. The student workspace is the most covered (32 owned, 28 prototype only). A prototype route without an owner is not a missing feature by itself. Several duplicate catalog rows that are already owned, which is why the catalog's 44 missing screens and these 201 routes are different numbers.

## What this branch changes

| Item | Before | After | Evidence |
| --- | --- | --- | --- |
| G-010 Maintenance (screen) | Missing and in scope | Code-present, connected to the device store and Today's Action Center, tested locally. Not deployed. | `app/src/lib/maintenance.ts`, `app/src/lib/maintenance-actions.ts`, `app/src/components/MaintenanceRequests.tsx`; 37 tests |
| Campus services · Submit housing maintenance request (workflow step) | Missing | **Partial.** The student keeps a record of a request submitted to housing elsewhere. Submitting it inside Semester needs a housing queue the school authorizes. | same |
| Campus services · Housing staff accepts / Request resolved | Missing | Unchanged. Blocked on an institution-authorized staff queue. | — |

## Reading the open-items file before starting work

About 70 pull requests are open against this repository. `possible_open_pr_overlap` names the ones whose titles touch an item (access reviews #1469, advisor check-ins #1448, operations work items #1422/#1424, notification inbox #1464, course studio #1346). It is a title match, not a review, so read the pull request before starting or skipping the item. The handoff intake itself (645 files, the 281-screen and 122-capability registry) is #1495.

## Not claimed

No count here is a deployment, an institutional authorization or a production row. Hosted Supabase, applied migrations and any customer tenant were not inspected.
