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
| 3 | Registration engine order (term, window, holds, prereq, coreq, credit limit, capacity, override) | The order is real and documented in `lib/enrollment/service.ts`: key, replay, kill switch, flag, section, term, student, window, hold, duplicate, prerequisite, clash, credit load, approval, seats. A 14-rung test in `enrollment.test.ts` now pins it (N-3). **No co-requisite check exists in the engine**; the PDF lists one. Capacity and override are not a check but a placement and a waiver. | Order pinned; coreq not started |
| 4 | §S "CQRS read models, projection workers" | Same finding as gap #1 in the gap register; not re-listed | Duplicate |
| 5 | Requested `docs/native-platform/NATIVE_*.md` (16 names) | Content exists under other names; see [`docs/native-platform/README.md`](../native-platform/README.md) | Mapping, not rebuild |

Everything else in the PDF is already catalogued; this page adds no row to the backlog beyond items 1 and 2.

## Proposed backlog additions

| ID | Item | Owner seat | Closed when |
| --- | --- | --- | --- |
| N-1 | A per-entity matrix of the 16 graph attributes over the tables in `SEMESTER_DATA_AUTHORITY_MATRIX.md`, with each blank marked blank | `data` | Matrix merged and a test fails when a catalogued entity has no row |
| N-2 | Decide whether Spreadsheet/Deck workspaces and Campus Operations Analytics are in scope; if not, add them to `docs/DO-NOT-BUILD.md` | `product` | Decision recorded as `docs/decisions/D-<pull request number>.md` |
| N-3 | A test pinning the registration check order | `engineering` | **Done.** `the order of the checks` in `app/src/lib/enrollment/enrollment.test.ts`: from a request every check refuses, repair one cause per rung. Four swaps of adjacent checks (window/hold, prerequisite/clash, gate/section lookup, approval/seats) each turned only the rung between them red; all pre-existing tests stayed green under each. |
| N-4 | Decide whether a co-requisite check belongs in the registrar engine, and where it sits in the order | `product` | Decision recorded as `docs/decisions/D-<pull request number>.md`; if yes, a rung is added to the ladder first |

## Second PDF: "connected ecosystem" expansion (2026-10-06)

An illustrative expansion of the mainframe PDF: three operating environments over one platform, a record-ownership map, ten proposed events, a connection-completeness checklist and ten journey-level readiness checks. **No new domain**; it restates the master doctrine. Two things are new to the backlog.

| # | Item | Finding | Class |
| --- | --- | --- | --- |
| E-1 | Ten proposed event names. Grep of `app`, `supabase`, `docs`, `packages` finds `membership.activated`, `onboarding.first_value_achieved`, `enrollment.confirmed`, `assignment.published`, `referral.accepted`, `payment.settlement_confirmed` and `tenant.rollout_paused` nowhere; `grade.released`, `consent.revoked` and `membership.ended` appear in a few files, not verified to be emitted. `domain_outbox_events.event_type` accepts all ten by its `^[a-z_]+\.[a-z_]+$` check, and the outbox has no relay (gap register #1, #4). | Contracts undefined; depends on the projection foundation (roadmap branch 6) | Not started |
| E-2 | Readiness reported per connected journey (marketing to activation, registration to roster to schedule, checkout to settlement, and seven more), not per screen | Not a register today; the registration journey is the only one with an engine and a test of its refusal order (N-3) | Proposed |

Both wait on roadmap branch 6. Neither is started here.

## Third PDF: "continue illustrating the ecosystem" (2026-10-06)

Same narrative a third time (12 pp, read in full). **No new domain, no new requirement.** Three items overlap or extend rows above, so they are folded in rather than added as new backlog.

| Item in the PDF | Where it already lives |
| --- | --- |
| An 11-field "record envelope" (identity, owning domain, scope, authority, source and effective date, version and freshness, classification, permitted relationships, policy or sharing basis, retention and export, audit references) | A subset of the 16 attributes in N-1; N-1 stays the contract and should be checked against these 11 so none is lost |
| A command path and an event path, joined by audit plus outbox | The shared command model in `docs/operations/CONTROLLED_ACTION_PATTERNS.md`; the event half is E-1 |
| Ten "complete connected behaviour" rows (onboarding, registration, Course Studio, advising, finance, campus, family, career, company operations, developer platform) | E-2; same journey-level readiness idea |

One rule in its connection table is testable today and is worth a test when someone next touches the engine: "payment does not silently override unrelated holds". In `lib/enrollment/service.ts` a hold is a fact on the student and the only thing that clears it is the owning office; nothing in the engine reads a payment. That is the intended behaviour, but no test states it.
