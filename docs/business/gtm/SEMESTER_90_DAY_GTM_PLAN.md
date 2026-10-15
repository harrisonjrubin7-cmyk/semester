# Semester 90-Day Go-To-Market Plan

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERNAL - DEPENDENCY-GATED PLAN, NOT A LAUNCH-DATE OR REVENUE COMMITMENT** |
| Owner | Harrison Rubin (interim, single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: tax] [REVIEW: accounting] [REVIEW: insurance] [REVIEW: privacy] [REVIEW: security] [REVIEW: accessibility] [REVIEW: procurement]. `[APPROVED]` count: 0 |
| Audience | Internal |
| Parent | [`SEMESTER_MASTER_GTM_PLAYBOOK.md`](SEMESTER_MASTER_GTM_PLAYBOOK.md) section J |

> Operating plan, not legal, tax, accounting, insurance, privacy, security or accessibility advice. Dates, counts and targets are planning assumptions; none is a commitment to a customer.

Label legend. `[VERIFIED]` a repository path proves it. `[ASSUMPTION]` planning number, date or target. `[DRAFT]` new, awaiting review. `[INTERNAL]` never send to a customer as-is.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`30-60-90-DAY-EXECUTION-PLAN.md`](../../../30-60-90-DAY-EXECUTION-PLAN.md) | Evidence and operating-authority workstreams (release, legal, finance, operations, trust, product, revenue) with day-30/60/90 decisions | Commercial items (wedge, ICP, account list, demo, outreach, webinars, value report, conversion process, KPI rhythm), per-item priority, acceptance criteria and evidence of done | It has no commercial or marketing rows and no P0/P1/P2 or per-item acceptance criteria; it is dependency-gated and must not be rewritten |
| [`docs/90-DAY-LAUNCH-PROGRAM.md`](../../90-DAY-LAUNCH-PROGRAM.md) + `app/src/lib/launch/ninety-day.ts` | 24 coded tasks with ids, owner roles, dependency order, test-enforced | Cross-references to those ids; conditional treatment of `sign-pilot` | Test-enforced file; a doc edit would desynchronize it from code |
| [`docs/market-readiness/90-DAY-MARKET-READINESS-PLAN.md`](../../market-readiness/90-DAY-MARKET-READINESS-PLAN.md) | 13-week objectives through convert/expand/pause/stop review | Re-sequencing inside the go/no-go boundary | It signs an agreement in week 6 and launches in week 9, which presumes every gate flips |
| [`docs/gtm/EXECUTION-PLAN.md`](../../gtm/EXECUTION-PLAN.md), [`GROWTH-OPERATING-PLAN.md`](../../gtm/GROWTH-OPERATING-PLAN.md) section 12.3 | Rules as code; G0-G2 messaging gates and 30/60/90 for growth | Pointers; adds institutional commercial rows | Different scope |
| [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) | Motion decisions and ten blocking items | P0 list derived from priorities 1-9 (below) | Plan rows need ids and owners |

## Gate (what is allowed now vs held)

[VERIFIED] `GO-NO-GO-DECISION.md`, 2026-10-03.

| Allowed now | Held until the named gate flips |
| --- | --- |
| Discovery, synthetic demos, evidence exchange, fit/limitation review, **non-binding** conditional scoping, invitation-only **unpaid** student validation preparation | price quote, order form, invoice, payment, live data, tenant activation, annual conversion, case study, reference, logo |

**Paid institutional pilot: NO-GO / RED.** Do not plan a paid signature as a given. Days 61-90 plan a signed or near-signed **design-partner** engagement under the non-activation boundary; a paid pilot is conditional on gate flips (P0 list below). "Proposal" in days 31-60 means a non-binding conditional scope: price `[PRICE TO BE CONFIRMED]`, dates `[PLACEHOLDER]`, terms non-binding drafts pending counsel review.

## Conventions

| Item | Rule |
| --- | --- |
| Priority | **P0** blocks sellable/pilot-ready status or a go/no-go gate; **P1** needed in-window, not blocking; **P2** useful, may slip |
| Owner | "HR" = Harrison Rubin (interim; backup unassigned). "Unassigned" = no person recorded; HR holds it by default. Professionals (counsel, CPA/tax adviser, broker, independent assessors) are unassigned |
| Day count | Day 1 begins when the founder accepts this plan and confirms authority; customer-dependent work starts only when a willing customer exists. If accepted on 2026-10-05: day 30 = 2026-11-03, day 60 = 2026-12-03, day 90 = 2027-01-02 [ASSUMPTION] |
| Review cadence | W = weekly operating review; M = monthly; G30/G60/G90 = gate review at day 30/60/90 |
| Evidence of done | A filed record (file path, register row, signed document or dated log). A document existing is not completion; a named producer and acceptor must create and accept the record |
| Stage ids | exact ids from [`app/src/lib/gtm/stages.ts`](../../../app/src/lib/gtm/stages.ts) |
| Claims | every public item maps to a `CLM-0xx` row in [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md); none has a named approver today |

## P0 list: blockers for a paid institutional pilot [VERIFIED] from `GO-NO-GO-DECISION.md` priorities 1-9

All nine are **open: no evidence filed** at the evidence date. Priority 10 (repeatability) blocks broad enterprise sale only.

| ID | Go/no-go priority | Blocker | Owner / authority | Remediation | Required evidence | Plan rows that depend on it |
| --- | ---: | --- | --- | --- | --- | --- |
| B1 | 1 | Authorized published candidate and current hosted release matrix | HR / engineering; hosted CI authority | publish/freeze candidate; rerun CI, PostgreSQL 17, account sync, target checks | immutable SHA, green run links, retained logs | D2-01, D3-02 |
| B2 | 2 | HawkScan and independent security assessment | HR coordinates; independent assessor (unassigned) | configure target; scan, triage, fix, clean rescan; independent assessment | DAST reports and independent report with no open launch-blocking finding | D2-02, D2-06 |
| B3 | 3 | Qualified accessibility review | qualified assessor (unassigned) + HR + counsel | manual AT, keyboard, zoom review; remediate; retest | dated report and approved ACR/public position | D2-03 |
| B4 | 4 | Public and institutional legal authority | HR + qualified counsel (unassigned) + customer counsel | resolve company facts; review public policies, pilot paper, DPA, exhibits | versioned approvals; executed applicable paper | D2-04, D3-03 |
| B5 | 5 | Entity, signing, price, tax/accounting, payment and insurance authority | HR + CPA/tax adviser + broker (all unassigned) + counsel | confirm facts; approve economics; implement controls | signed authority matrix, written advice, coverage/payment evidence | D1-05, D2-05 |
| B6 | 6 | Staffed support, monitoring and incident coverage | HR primary; backups required (unassigned) | establish queues, hours, routing, rota; acknowledgement/escalation drills | signed owner matrix; alert/support exercise record | D2-07, D2-08 |
| B7 | 7 | Recovery, rollback, rights and offboarding operation | engineering + security + privacy + support | execute on authorized target with named witnesses | dated restore, rollback, incident, export, deletion, revocation, offboarding records | D2-09 |
| B8 | 8 | Named customer scope and acceptance | customer sponsor, IT, privacy, security, accessibility, procurement/counsel | approve cohort, data/integration map, roles, limitations, UAT | signed approvals, UAT, responsibility matrix | D3-01, D3-02 |
| B9 | 9 | Baseline, outcome and reference authority | product/success + customer sponsor + counsel | freeze measures and guardrails; run pilot; reconcile; obtain permission | signed baseline, complete denominators, decision record, claim-specific permission | D3-04, D3-05 |

A paid pilot is reconsidered only after a bounded design-partner engagement has an **approved activation record and a measured closeout** (`GO-NO-GO-DECISION.md`, Checkpoint F table). Passing the executable profile `paid-institutional-manual-pilot` in [`app/src/lib/governance/release-profiles.ts`](../../../app/src/lib/governance/release-profiles.ts) authorizes only the exact named target.

## Days 1-30: Become sellable [DRAFT]

Exit decision G30: continue only if candidate identity, owner coverage, external-review scopes and legal/company-fact paths are credible; otherwise stay in preparation and do not manufacture an activation date.

| ID | Item | Pri | Owner | Dependency | Acceptance criteria | Evidence of done | Risk | Review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D1-01 | Freeze the launch wedge "Semester Registration Readiness Pilot": scope, exclusions, buyers, metrics, boundary statement | P0 | HR | none | one-page scope names workflow, cohort rule (10-200), exclusions, 8 primary metrics, "beside existing systems" wording tied to CLM-004/006 | scope file linked from the playbook; no unsupported claim (claims check) | scope creep toward replacement | W, G30 |
| D1-02 | Decide pilot length (26 weeks code vs 8-12 weeks assumption) | P0 | HR | none | decision recorded as `docs/decisions/D-<PR number>.md`; if 8-12 weeks, `PILOT_WEEKS` change scoped separately | decision file; proposals and MAP use the decided value | proposals stall on `duration` problem | W |
| D1-03 | Finalize ICP and account-scoring inputs; score >= 10 real accounts | P0 | HR | warm-path or observed-need evidence | each score cites dated observations; Tier A/B/C assigned; no disqualifier missed; no institution named externally | `gtm_accounts` rows with `target_score`; scoring note | fabricated warm path; scoring from prestige | W |
| D1-04 | Build 100-account list (template from `docs/business/sales/CRM_PIPELINE_DEFINITION.md`) | P1 | HR | D1-03 | list has role and work address only; owner, source, tier per row; dedupe done | `gtm_accounts` export (no personal data beyond role) | privacy: personal data in CRM | W |
| D1-05 | Record pricing **assumptions** (not prices) and the open-decision table; resolve student-price and institutional-unit decisions or leave placeholders | P1 | HR + finance reviewer (unassigned) | B5 | decision table in the playbook is current; quotes use `[PRICE TO BE CONFIRMED]`; CLM-015 unchanged | open-decision table; D-<PR> if decided | quoting an unapproved number | M |
| D1-06 | Hook GTM drivers to the Finance model (no numbers in GTM docs) | P1 | HR | lead's finance deliverables | each GTM KPI input names its Finance driver; Base scenario figures read from the model tab | cross-reference table in KPI tree | forked numbers | M |
| D1-07 | Claims map: every sentence on home, institutions, pricing, trust pages maps to a CLM row; name a claims approver or keep "not approved" | P0 | HR (claims owner interim) | none | zero pages with unmapped claims; takedown owner named | claims table; `docs/CLAIM-WITHDRAWAL-RUNBOOK.md` log | publishing before approval | W |
| D1-08 | Synthetic deck and demo (executive, operational, technical) with captions | P0 | HR | D1-01 | demo runs on synthetic data only; states available/pilot-dependent/planned; recorded and captioned | recording + transcript; `commercial/DEMO-SCRIPT-*.md` run log | accidental real data; overclaim | W |
| D1-09 | Pilot offer one-pager and conditional scope (non-binding) | P1 | HR | D1-01, D1-02 | states gate, exclusions, placeholders; marked non-binding draft pending counsel | file in `docs/business/sales/` | reads as an offer | G30 |
| D1-10 | Contract and trust inventory: list every paper and trust artifact, owner, status, review date | P0 | HR | none | each of DPA, pilot agreement, security addendum, accessibility exhibit, subprocessor list, HECVAT evidence listed with current status | inventory table; [`docs/trust/DOCUMENT-MAP.md`](../../trust/DOCUMENT-MAP.md) cross-checked | stale artifacts | G30 |
| D1-11 | Name security, privacy and accessibility owners and backups (or record "interim HR") and commission scopes | P0 | HR | B2, B3 | each seat has a name or an explicit interim record; assessor scopes requested | owner matrix update ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)) | seats stay vacant | W |
| D1-12 | Engage counsel, CPA/tax adviser, broker (engagement letters or recorded decision not to) | P0 | HR | funds | at least counsel engaged; the others have a dated decision | engagement record | cost; delay | W |
| D1-13 | Website conversion paths: audience routing, invite request, discovery contact, pilot page, Trust Center "Not yet in place" | P1 | HR | D1-07 | each path reaches a real route (`social.ts` funnels test); no price, logo, outcome; accessible | page list; funnel test green | claims drift | W |
| D1-14 | CRM readiness: stages configured with exact ids and exit checks | P1 | HR | D1-04 | `salesMoveProblems` mirrors checklist; fields from `ACCOUNT-SCORING-AND-FORECAST.md` added | schema/config note; one test move | stage skipping | W |
| D1-15 | Content calendar weeks 1-4 and consent text drafted for counsel | P2 | HR | D1-07 | assets have register row, captions, alt text, owner, expiry | content register rows | unreviewed publish | W |
| D1-16 | KPI baseline definitions frozen (no targets) | P1 | HR | none | every KPI in [`SEMESTER_GTM_KPI_TREE.md`](SEMESTER_GTM_KPI_TREE.md) has numerator, denominator, source | KPI tree reviewed | definitional drift | M |

## Days 31-60: Become pilot-ready [DRAFT]

Exit decision G60: a live design-partner activation remains NO-GO unless every applicable launch-checklist item has accepted evidence. A delayed pilot is preferable to an unevidenced one.

| ID | Item | Pri | Owner | Dependency | Acceptance criteria | Evidence of done | Risk | Review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D2-01 | Publish/freeze candidate; hosted CI, PostgreSQL 17, account sync | P0 | HR / engineering | B1 | immutable SHA and green run links retained | go/no-go priority 1 evidence | CI red | W |
| D2-02 | HawkScan and independent security assessment scoped, scheduled, started | P0 | HR + assessor | B2, D1-11 | signed scope, independence, target, dates | scope document | assessor lead time | W |
| D2-03 | Qualified accessibility review scoped and started | P0 | HR + assessor | B3 | scope covers exact pilot workflows with AT | scope + schedule | no assessor | W |
| D2-04 | Pilot agreement through counsel: evaluation/pilot paper, DPA, security addendum, accessibility exhibit | P0 | counsel (unassigned) + HR | B4, D1-12 | counsel-reviewed versions filed; deviation matrix ([`CONTRACT-DEVIATION-APPROVAL-MATRIX.md`](../../legal-drafts/CONTRACT-DEVIATION-APPROVAL-MATRIX.md)) agreed | versioned counsel approvals | counsel delay; scope creep | W, G60 |
| D2-05 | Entity, signing authority, tax/payment, insurance facts and decisions | P0 | HR + CPA + broker | B5, D1-12 | written advice; authority matrix signed | filed advice | open facts | G60 |
| D2-06 | HECVAT Lite evidence plan: map each question to an evidence row or a stated gap | P0 | HR (security owner interim) | B2; [`HECVAT-EVIDENCE-MATRIX.md`](../../market-readiness/HECVAT-EVIDENCE-MATRIX.md) | every question labelled implemented / pilot-scoped / planned / not applicable / customer responsibility / gap; no "compliant" answer | plan + matrix delta | answering from memory | W |
| D2-07 | Onboarding, training and support workflow rehearsed on synthetic cohort | P0 | HR / CS | B6 | rehearsal record; first-day checklist; escalation path; known-limitations disclosure | rehearsal log ([`docs/pilot/`](../../pilot/QUICK-START.md)) | no staffed backup | G60 |
| D2-08 | Named primary and backup for support, security, privacy, incident | P0 | HR | B6 | signed owner matrix; acknowledgement drill | drill record | backup unavailable | W |
| D2-09 | Restore, rollback, export, deletion, revocation, offboarding rehearsals on target | P0 | engineering + security + privacy | B7 | dated records with witnesses | rehearsal records | no authorized target | G60 |
| D2-10 | Student ambassador kit (training, conduct, disclosure text for counsel) | P1 | HR | counsel on disclosure | kit ready; not launched until counsel clears | kit + counsel note | peer pressure risk | M |
| D2-11 | First webinar(s) on synthetic demo: registration readiness without surveillance; advisor prep | P1 | HR | D1-08, D1-07 | recorded, captioned; consent text on registration; no outcome claims | recording, attendee log (aggregate) | claims drift | W |
| D2-12 | Outbound sequences (warm paths only), email nurture set live to opted-in contacts | P1 | HR | D1-03, D1-07; [`docs/business/sales/`](../sales/) sequences | `messaging.ts` consent and suppression pass; first touches logged against `gtm_accounts` | send audit log | cold-bulk temptation | W |
| D2-13 | Pilot proposals issued **non-binding** to qualified accounts (target: those at `proposal` stage only) | P1 | HR | D1-09, D1-02, D2-04 draft | each carries gate statement, placeholders, "non-binding draft pending counsel review"; stage moves per `SALES_EXIT.proposal` | proposal register | read as binding | W |
| D2-14 | Trust room readiness: publish artifact versions with owners and review dates | P1 | HR (trust officer interim) | D1-10 | versions pinned to a commit; expiring links; every open logged | trust-room records | stale version | M |
| D2-15 | Mutual Action Plan and pilot design-session run with first qualified account | P1 | HR | account at `outcome_workshop` | session produces committee map, cohort rule, draft scorecard, dated conversion decision | session notes in `gtm_decision_log` | no willing account | W |
| D2-16 | Content calendar weeks 5-8; claims register QA | P2 | HR | D1-15 | per-asset register rows | content register | none | W |
| D2-17 | Weekly KPI snapshot started (actual vs forecast labelling) | P1 | HR | D1-16 | snapshot has labels "observed / estimated / assumption / unavailable" | weekly note | vanity metrics | W |

## Days 61-90: Become repeatable [DRAFT]

Exit decision G90: run or decline one bounded design-partner engagement. A signed or near-signed design-partner engagement is a **target** conditional on a willing prospect and the non-activation boundary; it is not a plan to sign paid paper.

| ID | Item | Pri | Owner | Dependency | Acceptance criteria | Evidence of done | Risk | Review |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D3-01 | Signed or near-signed **design-partner** engagement for non-activation scope (discovery, synthetic demo, evidence exchange, written scoping); name a conditional activation path for one bounded cohort | P0 | HR + customer sponsor | B8, D2-04, D2-15 | counsel-reviewed paper (or explicit "near-signed" status with open items listed); no live data, no activation, no logo; sponsor and champion named | paper or status record; `pilotReadiness` run shows remaining problems | counterparty delay; mistaken for paid pilot | W, G90 |
| D3-02 | Activation GO/NO-GO for the exact configuration (only if all applicable gates are evidenced) else a dated NO-GO/deferral | P0 | launch council (HR interim) + customer | B1, B8, D2-09 | signed decision naming scope, revision, target, owners, expiry | signed decision | pressure to launch | G90 |
| D3-03 | Paid-pilot decision: update the go/no-go with evidence, price authority and capacity | P0 | HR + counsel + CPA | B2-B5 | updated `GO-NO-GO-DECISION.md` reissued if scope or evidence changed | reissued decision | assuming a flip | G90 |
| D3-04 | Measurement design for the first engagement: baseline source, definitions frozen, denominators, privacy floor n >= 10 | P0 | HR | B9 | signed baseline plan; no backfill | scorecard fields complete | no baseline | W |
| D3-05 | Weekly pilot report, midpoint exec review and final value report templates exercised on synthetic data | P1 | HR | [`docs/business/templates/`](../templates/) | each template filled once with synthetic data; clearly labelled | filled samples | none | M |
| D3-06 | Annual conversion process rehearsed (verdict -> pre-decision reconciliation -> paper) | P1 | HR | [`PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md) | decision date placement and notice dates modelled | process walkthrough | none | G90 |
| D3-07 | Case-study and reference process (permission-first); confirm none published | P1 | HR | CLM-013 | process documented; zero case studies, logos or quotes | process doc; claim log | premature use | M |
| D3-08 | QBR/EBR and renewal cadence set before any contract exists | P2 | HR | D3-06 | calendar of reviews 120 days before term end | cadence doc | none | M |
| D3-09 | KPI and board rhythm: first monthly pack and quarterly strategy/OKR session held | P1 | HR | D2-17 | pack with labels; OKRs with guardrails; no unset targets treated as targets | pack | none | M |
| D3-10 | Expansion plan (adjacent cohorts, one condition each) | P2 | HR | D3-01 | plan states each expansion needs its own readiness check and launch-council go | plan | none | M |
| D3-11 | Student validation cohort (invitation-only, unpaid) **only if** individual-validation gates accepted | P1 | HR + product | individual-validation profile; B1, B6, B7 | named cohort, capacity, support, stop criteria recorded | validation decision | broad promotion | G90 |
| D3-12 | Paid-media validation gates reviewed (no spend) | P2 | HR | master E.9 | gates P-1..P-7 status recorded; spend remains 0 | gate table | premature spend | G90 |
| D3-13 | Content calendar weeks 9-12; spring syllabus-week prep | P2 | HR | D2-16 | register rows | content register | none | W |

## Weekly activity targets [ASSUMPTION]

Activity (leading, within founder capacity) targets only. They are **not** outcome forecasts, pipeline values or win rates. A week missing a target is a finding, not a failure to hide. Each target stops when the capacity cap of three active pursuits binds.

| Weeks | Warm-path outreach touches / week | Discovery calls held / week | Qualification scores completed / week | Synthetic demos / week | Evidence exchanges (trust room, questionnaire) active | Content assets published / week | Webinars |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1-4 | 5 | 0-1 (rehearse) | 2 | rehearsal | 0 | 1-2 (use-case or LinkedIn) | none |
| 5-8 | 8 | 2 | 2 | 1 | up to 2 | 2 | 1 in the window |
| 9-13 | 8 | 2 | 2 | 1 | up to 3 | 2 | 1 in the window |

## Reconciliation with existing 30/60/90 plans [DRAFT]

| Plan | Authoritative for | Not authoritative for |
| --- | --- | --- |
| [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) | the boundary and the ten blockers; every date here is subordinate | n/a |
| [`30-60-90-DAY-EXECUTION-PLAN.md`](../../../30-60-90-DAY-EXECUTION-PLAN.md) | evidence and operating-authority workstreams and the day-30/60/90 decisions (rows B1-B9 map to its release, company/legal, finance/risk, operations, trust, reliability, customer, product workstreams) | commercial and marketing rows (this plan) |
| [`docs/90-DAY-LAUNCH-PROGRAM.md`](../../90-DAY-LAUNCH-PROGRAM.md) | task ids and dependency order, held by `ninety-day.test.ts`: `icp-cohort` = D1-03/D1-01, `charter-drafts` = D1-09/D2-04, `demo-pages` = D1-08, `trust-outline` = D1-13/D2-14, `launch-metrics` = D1-16, `a11y-core` = D2-03, `sign-pilot` = D3-01 (re-read as design-partner non-activation agreement), `uat`, `training`, `support-ready`, `restore-rehearsal` = D2-07..D2-09, `launch-cohort` = D3-02, `midpoint-report`, `annual-proposal`, `quotes` = D3-05..D3-07 | its assumption that a pilot launches inside 90 days; the code states launch only after UAT, training, support readiness, restore rehearsal, comms and core accessibility testing |
| [`docs/market-readiness/90-DAY-MARKET-READINESS-PLAN.md`](../../market-readiness/90-DAY-MARKET-READINESS-PLAN.md) | weekly objective vocabulary | the week-6 signature and week-9 launch (best-case path only) |
| [`docs/gtm/EXECUTION-PLAN.md`](../../gtm/EXECUTION-PLAN.md) | which rules are code and the build backlog (campaign manager, preference center, retention sweep) | dates |
| **This plan** | GTM sequencing, commercial rows, weekly activity targets, P0 blocker list for a paid pilot | gates and evidence acceptance |

Conflicts found: (1) pilot length 26 weeks versus 8-12 weeks (D1-02); (2) `sign-pilot` in days 31-60 and a week-6 signature versus the paid-pilot NO-GO; (3) the existing plans assume a launch inside 90 days, while the go/no-go sets gates, not a schedule. Resolution: the more conservative boundary governs; dates extend, evidence is never waived.

## Review cadence and escalation

Weekly operating review (W): rows due, blocked rows, evidence filed, claims check, pipeline hygiene. G30/G60/G90 reviews: decide continue / extend / stop with a dated record. A row blocked more than one week goes to HR with what it waits on. Reissue the go/no-go whenever material scope, evidence, ownership or risk changes.

## Evidence state

**Repository evidence.** Go/no-go, existing 30/60/90 and launch program, scoring and stage definitions, finance gates.

**Operational evidence.** None of the P0 blockers B1-B9 has filed evidence; no prospect scored, no discovery recorded, no demo recorded.

**Missing proof.** Everything in the "Evidence of done" column.

## Claim ceiling

This plan may be used internally to organize non-activation GTM preparation. It supports no external statement of dates, customers or readiness.

## Prohibited claims

Do not state a launch date, a pilot start, a customer or design-partner name, or that a paid pilot is available, from this plan.

## Professional review required

[REVIEW: counsel] D2-04, D3-01, D2-10. [REVIEW: tax] [REVIEW: accounting] D1-05, D2-05. [REVIEW: insurance] D2-05. [REVIEW: privacy] D1-04, D3-04. [REVIEW: security] D2-02, D2-06. [REVIEW: accessibility] D2-03. [REVIEW: procurement] D2-13, D3-01.
