# Semester COO operating system

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NOT YET OPERATED.** Nothing here is evidence that a process runs. |
| Owner seat | `operations` (held by the Founder, acting). Every sub-document names its own seat. |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Review | Monthly while the company is at Stage 0 or Stage 1; quarterly after |
| Claim ceiling | Semester may say these are its *proposed* operating procedures and that the repository tests the links between them. It may not say any service level is offered, any coverage exists, or any process has been exercised. |

This set answers one question: **what has to be true, week after week, for Semester to implement, support, govern and scale across institutions without depending on one person's memory?**

It does not restate what the repository already holds. The company operating model, the council, the incident playbook, the release gates and the rollout state machine stay authoritative. This set adds what they lack: working cadences, step-by-step methods, templates, handoff contracts, service blueprints, a service-level ladder, staffing arithmetic and a plan for moving work off the founder. Where an existing page already decides something, the new page links to it and does not repeat it.

## How to read it

| If you are | Start with |
| --- | --- |
| The founder deciding what to run this week | [01 Operating cadence](01-operating-cadence.md), then [11 Founder-to-team transition](11-founder-to-team-transition.md) |
| Running a customer from first call to renewal | [02 Implementation methodology](02-implementation-methodology.md), [10 Tenant launch risk and readiness](10-tenant-launch-risk-and-readiness.md) |
| Staffing or running support | [04 Support operating model](04-support-operating-model.md), [05 Incident and continuity](05-incident-and-continuity.md) |
| Deciding who decides | [03 RACI and decision rights](03-raci-and-decision-rights.md) |
| Building a dashboard | [09 Dashboards and indicators](09-dashboards-and-indicators.md) |
| Doing the work | [Templates](templates.md), [Handoffs](handoffs.md), [Service blueprints](service-blueprints.md) |

## Traceability: the ten deliverables

| # | Deliverable | Where it is | Authoritative page it builds on | What is new here |
| --- | --- | --- | --- | --- |
| 1 | Operating cadence (weekly, monthly, quarterly, annual) | [01](01-operating-cadence.md) | [`OPERATING-RHYTHM`](../../operating-model/OPERATING-RHYTHM.md), [`PROOF-CALENDAR`](../../PROOF-CALENDAR.md), [`COMPANY-OPERATING-MODEL`](../../company/COMPANY-OPERATING-MODEL.md) | Agendas with inputs and outputs, a solo-founder compression, an academic-calendar overlay with freeze windows |
| 2 | Implementation methodology | [02](02-implementation-methodology.md) | [`PILOT-TO-PRODUCTION`](../../operating-model/PILOT-TO-PRODUCTION.md), [`INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK`](../../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md) | Phase mapping onto the stored stage values, week-by-week 26-week plan, adoption, renewal and expansion motions |
| 3 | RACI and decision rights | [03](03-raci-and-decision-rights.md) | [`OWNER-AND-ACCOUNTABILITY-MATRIX`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md), [`DECISION-RIGHTS`](../../DECISION-RIGHTS.md), [`RACI-MATRIX`](../../market-readiness/RACI-MATRIX.md) | An operational RACI of sixty-four decisions, decision classes, stop authority, delegation limits |
| 4 | Support model, taxonomy, SLAs, escalation, staffing | [04](04-support-operating-model.md) | [`SUPPORT-OPERATIONS`](../../commercial/SUPPORT-OPERATIONS.md), [`ON-CALL-AND-ESCALATION-POLICY`](../../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md) | Case taxonomy, priority matrix, the service-level ladder and catalog, escalation ladder, staffing formula |
| 5 | Incident, continuity, vendor, quality, change | [05](05-incident-and-continuity.md), [06](06-vendor-quality-change.md) | [`INCIDENT-RECOVERY-PLAYBOOK`](../../INCIDENT-RECOVERY-PLAYBOOK.md), [`QUALITY-MANAGEMENT`](../../operating-model/QUALITY-MANAGEMENT.md), [`CHANGE-MANAGEMENT`](../../operating-model/CHANGE-MANAGEMENT.md) | Severity crosswalk, on-call by stage, business-impact table, vendor tiers, CAPA loop, change classes and calendar |
| 6 | Documentation, training, enablement, knowledge | [07](07-knowledge-training-enablement.md) | [`RUNBOOKS`](../../RUNBOOKS.md), [`FACULTY-ENABLEMENT`](../../FACULTY-ENABLEMENT.md) | Document lifecycle, role curricula with sign-off, freshness rules |
| 7 | Marketplace, partner, trust and safety, fulfillment and disputes | [08](08-marketplace-partner-trust-fulfillment.md) | [`PARTNER-AND-CHANNEL-STRATEGY`](../../commercial/PARTNER-AND-CHANNEL-STRATEGY.md), [`PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS`](../../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md), [`VOLUNTEER-MODERATOR-PROGRAM`](../../VOLUNTEER-MODERATOR-PROGRAM.md) | Phase-gated marketplace operations that respect D-146, dispute handling, T&S queue and appeals |
| 8 | Dashboards and leading indicators | [09](09-dashboards-and-indicators.md) | [`COMPANY-FIRST-YEAR-MEASURES`](../../COMPANY-FIRST-YEAR-MEASURES.md), [`MONITORING`](../../../MONITORING.md) | A metric dictionary with formulas, owners, thresholds and the action a red metric triggers |
| 9 | Tenant risk and readiness system | [10](10-tenant-launch-risk-and-readiness.md) | [`LAUNCH-READINESS-COUNCIL`](../../LAUNCH-READINESS-COUNCIL.md), [`RELEASE-GATES`](../../RELEASE-GATES.md), [`LAUNCH-RISK-REGISTER`](../../../LAUNCH-RISK-REGISTER.md) | Per-tenant tiers, weighted scorecard, hard gates, T-90 to T+90 countdown, rollback triggers |
| 10 | Founder-led to repeatable | [11](11-founder-to-team-transition.md) | [`OWNER-AND-ACCOUNTABILITY-MATRIX`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) | Dependency inventory, transfer ladder, hiring triggers, the founder-removal test |
| — | Templates, service blueprints, handoff definitions | [templates](templates.md), [service-blueprints](service-blueprints.md), [handoffs](handoffs.md) | — | Twenty-six templates, six blueprints, eighteen handoff contracts |

## Three conventions every page uses

### 1. Stages

Capacity, not calendar, decides what an operation may promise.

| Stage | Situation | Operating consequence |
| --- | --- | --- |
| **0 — Founder-run** (today) | One person holds seven council seats; no named backup; no staffed hours; no paging rota | Compressed cadence; no promised clocks; every process is documented *before* it is delegated |
| **1 — Design-partner pilot** | One or two pilot tenants, each cohort 10–200 students; two trained people on every critical process | Business-hours support with a tested after-hours path for SEV1 only |
| **2 — Repeatable pilots** | Three to ten tenants; functional leads for support, implementation and reliability | Weekday coverage plus extended hours at peaks; incident rota of at least four |
| **3 — Scaled operations** | More than ten tenants, or any contractual availability or response commitment | 24×7 coverage for SEV1 and SEV2; tiered support; dedicated trust and safety and partner operations |

Promotion between stages is by evidence ([11](11-founder-to-team-transition.md#stage-promotion-criteria)), not by headcount or date.

### 2. The service-level ladder

Every number in this set is a **target** until it climbs the ladder. This matches the repository's rule that an SLA is not promised until measured and staffed ([`SLO-SLI-DRAFT`](../../engineering-operations/SLO-SLI-DRAFT.md), [`ON-CALL-AND-ESCALATION-POLICY`](../../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md)).

| Rung | Name | Requires | May be said |
| --- | --- | --- | --- |
| SL0 | Designed | Written, with a measure, an owner and a source | "We aim for…" in internal documents only |
| SL1 | Measured | Instrumented; at least eight consecutive weeks of data with a denominator; no-data weeks counted as no data | The measured figure, with its window, never the target |
| SL2 | Staffed | Named primary and trained backup; alert-to-acknowledgement tested; one exercise passed | "Our support team targets…" in pilot materials, with the measured figure beside it |
| SL3 | Committed | Counsel-approved contract language, an entry in the public-claims register, customer-specific acceptance | A promise |

Every service level in [04](04-support-operating-model.md#service-level-catalog) carries its rung. All start at SL0. Counsel decides what may be promised at SL3; nothing here is a legal conclusion.

### 3. Severity vocabulary

Incidents use **SEV1–SEV4**, as in the [incident playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md). Support cases use **P0–P3**. They are different objects with a defined mapping ([05](05-incident-and-continuity.md#severity-crosswalk)).

## Hard boundaries this set keeps

- **No promise without evidence.** No page claims 24×7 coverage, response times, uptime, certification or institutional readiness. Those wait for the SL3 rung and the [public-claims register](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md).
- **No legal conclusion.** Anything touching notification duties, FERPA/COPPA/GDPR timelines, consumer protection, tax, money transmission, employment or contracts is marked *requires qualified human counsel review* and goes to the [legal review queue](../../../LEGAL-REVIEW-QUEUE.md).
- **No money moves through Semester** ([D-146](../../DECISION-LOG.md)). Marketplace operations in [08](08-marketplace-partner-trust-fulfillment.md) stay dormant past the referral phase until the owner makes a new decision.
- **A seat is an acceptance, not a username.** Pages name seats from the [council](../../LAUNCH-READINESS-COUNCIL.md). Acceptances, contacts and customer names live in the private operations system, not in this repository.
- **The council's verdict wins.** The scoring in [10](10-tenant-launch-risk-and-readiness.md) is planning input. `decide()` in `app/src/lib/launchreadiness.ts` stays the only thing that can return GO.
- **Security, privacy, accessibility and data-rights protections are not tradable for price or schedule.**

## Preamble outputs

The shared preamble asks every deliverable to state the following.

### Assumptions (labelled; replace with measurement as it arrives)

1. Company calendar year with a US academic-year overlay; each tenant supplies its own calendar.
2. Staffed hours, when approved, are Monday–Friday 08:00–18:00 America/Chicago.
3. Ticket volume, handling time, peak multipliers and tenant counts used in the staffing arithmetic are **unmeasured planning assumptions**.
4. A pilot runs 26 weeks and a cohort is 10–200 students, as the repository already fixes (D-134 and the pilot rules in [`PAID-PILOT-FRAMEWORK`](../../PAID-PILOT-FRAMEWORK.md)).
5. The company is pre-revenue-scale: no dedicated finance, security or support staff exist.

### Risks and unresolved questions

| Question | Owner seat | Needed before |
| --- | --- | --- |
| Which hours will support be staffed, and on what channels? | `operations` | Any SL2 claim |
| Who accepts the vacant `security`, `trust`, `data` and `finance` seats? | `founder` | Stage 1 |
| Will marketplace payments ever run through Semester, or always through the provider? | `founder`, counsel | Marketplace phase 2 ([08](08-marketplace-partner-trust-fulfillment.md#the-three-marketplace-phases)) |
| Which regulated timelines apply to data-rights requests per tenant jurisdiction? | `privacy` (counsel) | Any data-rights SL3 |
| Are on-call hours compensated, and how, under applicable employment law? | `finance`, counsel | First paid on-call |
| What are real RTO and RPO values? | `engineering` | Any recovery claim; the playbook leaves them unset until a timed restore |

### Files

New under `docs/operations/coo/`: this page, eleven numbered pages, `templates.md`, `service-blueprints.md`, `handoffs.md`; one test, `app/src/lib/ops/coo.test.ts`; one decision file, `docs/decisions/D-<this pull request>.md`. No existing file is edited or renumbered.

### Tests added

`coo.test.ts` holds three things: every relative link in this set resolves; every page carries the control table and a claim ceiling; and no page contains an unqualified guarantee. Each check has a control fixture it must catch.

### Accessibility

Pages use plain tables, descriptive headings and no colour-only meaning. Templates avoid tables that need horizontal scroll. The dashboards in [09](09-dashboards-and-indicators.md) require a text alternative for every chart and a non-colour status marker.

### Security and privacy

No credential, contact route, customer name or personal data belongs in these pages. Templates direct customer-specific records to the private operations system. Small-cell suppression (n ≥ 10) applies to every cohort metric.

### Operational and runbook implications

New recurring obligations appear in [01](01-operating-cadence.md). At Stage 0 they compress to about ten hours a week of founder time; the arithmetic is in [01](01-operating-cadence.md#stage-0-compression).

### Traceability updates

Table above. Registering any page as an authoritative entry in `SEMESTER-OPERATING-SYSTEM.md` is a separate decision made through `app/src/lib/ops/operatingsystem.ts` and `npm run registers`; this set does not edit that register.
