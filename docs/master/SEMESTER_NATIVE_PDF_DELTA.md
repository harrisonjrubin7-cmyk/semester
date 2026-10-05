# "Native Education OS" PDF: delta against main

**As of** 2026-10-05 · **Base** `origin/main` `3bd382d` · **Status** Phase 0. Extends [`SEMESTER_PDF_RECONCILIATION.md`](SEMESTER_PDF_RECONCILIATION.md), which listed five PDFs and did not list this one (`now_break_down_entire_semester…`, 22 pp, read in full).

> **Claim ceiling.** "Not found" means a grep of `docs/master` and `docs/finish-line` found nothing, not that nothing exists elsewhere.

## What this PDF is

A lettered platform map (A–T): experience, learning, registrar/SIS, student success, productivity, AI, campus, finance, career, community, family, control plane, integration, trust, company OS, Operations Command Center, developer platform, education graph, stack, market strategy, and a "master native-first command". Its thesis (build native, integrate as a transition bridge, replace by domain with proof) is already the operating doctrine of `docs/master/SEMESTER_DOMAIN_REPLACEMENT_GATES.md` and the 40-domain catalog. **No new domain was found**; every lettered section maps to existing domains:

| PDF section | Existing domain(s) |
| --- | --- |
| A Experience, E Productivity | D01, D02, D08, D09, D20 |
| B Learning, C Registrar/SIS | D04, D05, D10, D11, D12 |
| D Student success | D09 |
| F AI | D06, D07 |
| G Campus, J Community, K Family | D15–D19, D21, D22, D24 |
| H Finance | D13, D14 |
| I Career | D23 |
| L Control plane, M Integration, N Trust | D25–D30 |
| O Company OS, P Command Center | D31–D33, D38, D39 |
| Q Developer/marketplace | D34, D35 |
| R Data/graph | D36 and `SEMESTER_DATA_AUTHORITY_MATRIX.md` |
| S Stack, T Market | `SEMESTER_COMPLETE_OPERATING_SYSTEM.md`, `docs/finish-line/*` |

## What main does not cover (the real delta)

| # | Item in the PDF | Finding | Class |
| --- | --- | --- | --- |
| 1 | §R: every graph node carries 16 attributes (canonical ID, tenant ID, owner, authority, source system, freshness, classification, consent scope, capability requirement, policy, version, audit history, retention, export behavior, deletion behavior, migration source, verification status) | No page states this as a per-entity contract; "Deletion behavior" and "Verification status" appear in no master or finish-line doc | Designed/documented only; gap |
| 2 | §G "Campus Operations Analytics", §E "Spreadsheet/Sheets workspace", "Presentation/Deck workspace" | Not named in any master or finish-line doc | Not started; confirm intent before cataloguing |
| 3 | Registration engine order (term, window, holds, prereq, coreq, credit limit, capacity, override) | Covered by `registration_*` and the workflow catalog; the **fixed order of checks** is not asserted by a test that was found | Verify |
| 4 | §S "CQRS read models, projection workers" | Same finding as gap #1 in the gap register; not re-listed | Duplicate |
| 5 | Requested `docs/native-platform/NATIVE_*.md` (16 names) | Content exists under other names; see [`docs/native-platform/README.md`](../native-platform/README.md) | Mapping, not rebuild |

Everything else in the PDF is already catalogued; this page adds no row to the backlog beyond items 1 and 2.

## Proposed backlog additions

| ID | Item | Owner seat | Closed when |
| --- | --- | --- | --- |
| N-1 | A per-entity matrix of the 16 graph attributes over the tables in `SEMESTER_DATA_AUTHORITY_MATRIX.md`, with each blank marked blank | `data` | Matrix merged and a test fails when a catalogued entity has no row |
| N-2 | Decide whether Spreadsheet/Deck workspaces and Campus Operations Analytics are in scope; if not, add them to `docs/DO-NOT-BUILD.md` | `product` | Decision recorded as `docs/decisions/D-<pull request number>.md` |
| N-3 | A test pinning the registration check order | `engineering` | Test red when two checks are swapped |
