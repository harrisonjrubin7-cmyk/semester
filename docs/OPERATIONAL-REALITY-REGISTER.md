# Operational reality register

<!-- Rendered from app/src/lib/operationalreality.ts by operationalreality.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Two documents of 28 September 2026 say, from different ends, that the vision,
the domains, the compliance architecture and the commercial model are
described and that what is missing is the execution, validation and evidence
layer: owners, a hard launch definition, verified production behaviour,
failure and load testing, data-quality operations, support as a product,
implementation capacity, revenue operations, key-person resilience, and one
go-live dossier per launch. They are kept under `docs/expansion/` as supplied.
This page holds each thing they ask for to what the tree has, under the rule of
[D-108](DECISION-LOG.md#d-108--the-modernization-blueprint-is-a-crosswalk-onto-the-master-register-not-a-second-register)
and [D-111](DECISION-LOG.md#d-111--five-research-documents-are-held-to-the-tree-as-crosswalks-and-the-pdfs-are-never-their-own-evidence):
a supplied PDF is never its own evidence, every cited file exists, every
standing is held to the kind of file it cites, and every edge case, risk, game
day or maturity control named here exists in the register that owns it.
Standings were read at `origin/main` `ff52ba4` on 28 September 2026. The
company side — entity, insurance, contracts, pricing, go-to-market, the council — is [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md).

| Supplied document | What it holds |
| --- | --- |
| [Anything else needed to make this a reality](expansion/Anything-Else-Needed-to-Make-This-a-Reality.pdf) | The company operating system, the organizational model, the customer-proof engine, service tiers, the implementation factory, packaging discipline, brand and category assets, the whole-platform readiness test and the execution priorities. |
| [Anything missing or not covered for this to be operational](expansion/Anything-Missing-for-This-to-Be-Operational.pdf) | The master operating plan, the launch readiness review, production verification, failure and recovery testing, capacity and cost proof, data quality, support as a product, implementation capacity, revenue operations, key-person resilience, the go-live dossier and the final checklist. |

## Standings

| Standing | Meaning |
| --- | --- |
| tested | An automated test, a database check or a CI script holds it |
| building | Code carries some of it; the gap says what it does not |
| designed | A document says what it would be; nothing runs |
| not-started | Nothing in the tree beyond the register that names it |
| held | A decision already on main answers it differently, and holds until the owner reopens it |

Across the 81 items with a standing: tested 36 · building 16 · designed 20 · not-started 7 · held 2.

## 1. One master operating plan

A roadmap without named owners, budget, dependencies, evidence and decision
gates is still a strategy document. No register here holds all thirteen fields
on one row; the two nobody holds are a backup owner and a budget.

| Field | Already carried by |
| --- | --- |
| Initiative | masterregister `Requirement.capability`; ninety-day `title` |
| Outcome | masterregister `requirement`; commitments `scope` |
| Workstream | masterregister domain prefix; gates A–H |
| Owner | ninety-day `owner`; proofcalendar `owner`; risk `owner`; warroom `owner` — every seat vacant |
| Backup owner | **nothing** |
| Budget | **nothing** |
| Dependencies | ninety-day `after`; commitments `dependsOn` |
| Risk level | masterregister `severity` P0–P2; risk `RISKS` |
| Evidence required | ninety-day `evidence`; masterregister `validation`; proofcalendar `artifact` |
| Target date | proofcalendar `window`; commitments `due` — no date on a master row |
| Status | masterregister `status`; ninety-day `Status` |
| Go/no-go gate | masterregister gates A–H; launchreadiness `GATES` |
| Customer impact | commitments `communication`; console `CUSTOMER_IMPACT` |

### The five workstreams, on the seats

| Workstream | Goal | Seats | Where it lives |
| --- | --- | --- | --- |
| Product & Engineering | Build a coherent, accessible, reliable platform | `product`, `engineering`, `accessibility` | The master register’s PRG, STU, LMS, UX and A11Y rows. |
| Trust & Compliance | Prove privacy, security, AI, accessibility and interoperability controls | `security`, `privacy`, `trust`, `data` | SEC, TRUST, AI and INT rows; docs/trust/; the proof calendar. |
| Customer Delivery | Implement, train, support, measure and renew institutions | `success`, `operations`, `champion` | IMP and SUP rows; the ninety-day programme; pilot-to-production. |
| Commercial | Generate qualified pipeline, sell pilots, manage contracts, collect revenue | `founder`, `finance` | COM and LEG rows; the deal desk; the GTM plan. No sales seat exists; the finance seat (D-118) is vacant. |
| Corporate Operations | Entity, finance, people, insurance, legal, vendor and board operations | `founder`, `finance` | LEG-001 and nothing else; the finance seat (D-118) is vacant, and no people or legal seat exists. |

Every seat is vacant ([`LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md)).

## 2. The company operating system

Five areas: tested 2 · building 0 · designed 3 · not-started 0 · held 0.

| ID | Item | The document asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OR-OS-01 | Company | Legal entity, IP assignment, founder and contractor agreements, banking, accounting, tax, insurance, cap table, board and advisor governance. | designed | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md) — COMP-01: a single-member LLC by attestation; COMP-03: no insurance<br>[`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) — the formation checklist, item by item<br>[`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts) — LEG-001, designed | The entity exists by attestation; nothing else in the list is recorded. |
| OR-OS-02 | Commercial | Pricing book, order form, MSA, DPA, pilot agreement, SOW, security addendum, SLA, implementation terms, renewal terms, procurement response library, discount-approval policy. | tested | [`app/src/lib/governance/deal-desk.test.ts`](../app/src/lib/governance/deal-desk.test.ts) — the discount ladder and the refusals<br>[`app/src/lib/gtm/rfp.test.ts`](../app/src/lib/gtm/rfp.test.ts) — the procurement response library refuses unsupported claims<br>[`docs/trust/PILOT-AGREEMENT-OUTLINE.md`](trust/PILOT-AGREEMENT-OUTLINE.md) — the agreement outline<br>[`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md) — the DPA checklist<br>[`docs/trust/SLA.md`](trust/SLA.md) — the SLA once it can be offered | Rules and outlines; no price book, no MSA, no order form, no signed anything (LEG-002, COM-002). |
| OR-OS-03 | People | An org chart for now and twelve months out, role scorecards, a hiring plan, a contractor policy, security, accessibility and AI training, onboarding and offboarding. | designed | [`docs/LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md) — twelve seats; four held by the founder, acting, eight vacant<br>[`docs/trust/SOC2-READINESS.md`](trust/SOC2-READINESS.md) — CC1-01 org chart and RACI; CC1-07 training before access; CC6-06 joiner-mover-leaver<br>[`docs/operating-model/OPERATING-RHYTHM.md`](operating-model/OPERATING-RHYTHM.md) — monthly: hiring and capacity | One person; no org chart, scorecard, hiring plan, contractor policy or training record. |
| OR-OS-04 | Decision-making | Annual strategy, quarterly priorities, a product council, a security, privacy, accessibility and AI governance council, a customer escalation process, risk-acceptance authority, an ADR process. | tested | [`app/src/lib/governance/risk.test.ts`](../app/src/lib/governance/risk.test.ts) — exceptions expire within 90 days; no P0 exception without executive, security and legal<br>[`app/src/lib/launchreadiness.test.ts`](../app/src/lib/launchreadiness.test.ts) — risk acceptance is the founder seat’s, with an expiry<br>[`docs/architecture/README.md`](architecture/README.md) — the ADR process, ten records<br>[`docs/operating-model/OPERATING-RHYTHM.md`](operating-model/OPERATING-RHYTHM.md) — weekly, monthly, quarterly, annually<br>[`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md) — company strategy: missing | The authorities are code and the cadence is a page; no strategy memo, and no council has met. |
| OR-OS-05 | Finance | Budget, runway, burn, cash forecast, unit economics, module-level gross margin, AI and cloud cost allocation, pricing and discount controls, a receivables process. | designed | [`docs/operating-model/COMMERCIAL-GOVERNANCE.md`](operating-model/COMMERCIAL-GOVERNANCE.md) — financial controls: 13-week cash forecast, budget vs actual, close review, tax nexus<br>[`app/src/lib/ops/firstyear.ts`](../app/src/lib/ops/firstyear.ts) — runway, ARR/MRR and gross margin as measures; the numbers live outside the repository<br>[`app/src/lib/governance/maturity.ts`](../app/src/lib/governance/maturity.ts) — FO-01 cost allocation owed; FO-09 unit cost partial; FO-10 margin guardrails owed | Controls named, none operating; no budget, no forecast, no unit cost, no receivable. |

## 3. The organizational model

Clear ownership before headcount. Eight functions, each with the owner the
document names first and the seat in [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) that carries it.

| Function | Initial owner | Non-negotiable | Seat | Note |
| --- | --- | --- | --- | --- |
| Product and design | Founder / product lead | Product strategy, user research, plan, design quality | `product` |  |
| Engineering | Technical lead | Architecture, delivery, reliability, technical debt | `engineering` |  |
| Security and privacy | A named internal owner plus qualified outside support | Risk register, access, vendors, incidents, customer review | `security` | The privacy seat is separate. |
| Accessibility | A named owner plus disabled-user testing partners | WCAG delivery, ACR/VPAT, remediation, support | `accessibility` | No testing partner. |
| AI governance | A named owner | Model and provider approval, evaluations, policy, incident response | `trust` |  |
| Customer implementation | Customer-success lead | Launch plan, configuration, training, adoption, value review | `success` |  |
| Support and operations | Operations / support lead | Service desk, escalation, incident communications, runbooks | `operations` | The operations seat (D-120), vacant; the master register’s Support and SRE sign-offs are its to give. |
| Sales, partnerships, finance, legal | Founder, then outsourced until justified in-house | Pipeline, proposals, contracts, references, tax, insurance, cash controls | `founder` | Sales stays the founder’s; finance and legal have the finance seat (D-118), vacant. |

Every module needs a directly responsible individual for product, source and content accuracy, operations, support, privacy, accessibility, and revenue and entitlement decisions. charters.ts names product, engineering and support owners per module as role labels; no person holds any.

## 4. The customer-proof engine

The pilot-to-platform programme, stage by stage: tested 4 · building 1 · designed 0 · not-started 0 · held 0.

| ID | Item | The document asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OR-PROOF-01 | Discovery | Institution pain map, stakeholder map, current-stack map, baseline friction metrics, target cohort, success definition. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — a workflow, cohort, baseline, sponsor, champion and metrics, or the plan is refused<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held<br>[`docs/INSTITUTIONAL-CHANGE-MANAGEMENT.md`](INSTITUTIONAL-CHANGE-MANAGEMENT.md) — stakeholder mapping | No current-stack map or pain map template; no discovery has happened. |
| OR-PROOF-02 | Readiness | Security, privacy, accessibility and integration review, data map, roles, source-content owners, AI policy, training and launch communication plan. | tested | [`app/src/lib/launch/content.ts`](../app/src/lib/launch/content.ts) — CONTENT_READINESS: thirteen items with a named person each<br>[`app/src/lib/launch/content.test.ts`](../app/src/lib/launch/content.test.ts) — held<br>[`docs/operating-model/CHANGE-MANAGEMENT.md`](operating-model/CHANGE-MANAGEMENT.md) — the readiness assessment, scored 1–5, pilot threshold 30 of 50<br>[`supabase/tenant-rollout.check.sql`](../supabase/tenant-rollout.check.sql) — exit gates need evidence | The scored assessment is a page; the content register has never been filled for a real school. |
| OR-PROOF-03 | Launch | SSO and tenant setup, source configuration, onboarding, training, office hours, live support, measured rollout. | tested | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — tenant-flags, identity, content-loaded, uat, training, support-ready, launch-cohort<br>[`app/src/lib/launch/ninety-day.test.ts`](../app/src/lib/launch/ninety-day.test.ts) — a step cannot be done before its prerequisites<br>[`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — CUTOVER_CHECKLIST, sixteen lines | No cohort has launched. |
| OR-PROOF-04 | Value review | Student clarity, work completion, verified-resource discovery, support handoff, accessibility success, adoption by role, implementation effort, support burden, operational evidence. | building | [`ANALYTICS.md`](../ANALYTICS.md) — three figures, no cell under ten<br>[`app/src/lib/ops/firstyear.ts`](../app/src/lib/ops/firstyear.ts) — the first-year measures: measured, instrumented or defined<br>[`app/src/lib/gtm/kpi.ts`](../app/src/lib/gtm/kpi.ts) — no rate for an empty cohort; no causal claim | No verified-resource-discovery, handoff-success or accessibility-success measure is instrumented. |
| OR-PROOF-05 | Expansion | Mutual success plan, module plan, integration plan, commercial conversion, reference permission. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — pilotVerdict: convert or expand only signed and clean<br>[`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — expansion_decision gate; DECISION_OPTIONS<br>[`app/src/lib/governance/rollout.test.ts`](../app/src/lib/governance/rollout.test.ts) — held | No mutual success plan structure exists (below). |

### The three proofs

| Proof | What it shows | The measure that would show it |
| --- | --- | --- |
| Student proof | Students find the next action, complete work and reach support faster | ANALYTICS.md activation and actions; `firstyear.ts` students group; no time-to-support measure |
| Staff proof | Faculty, advisors and service offices do less repetitive work and receive better-prepared students | No staff-side measure is instrumented; `advisor-meeting.ts` prepares the student, nothing counts the meeting |
| IT proof | The platform is secure, accessible, interoperable, observable and easier to govern than point solutions | The master register and the proof calendar, 0 of 19 artifacts filed |

## 5. Reliability and service operations

The product is only as good as it behaves during registration, midterms,
finals, grading, orientation and major incidents. Five tiers: tested 1 · building 3 · designed 0 · not-started 0 · held 1.
No tier word exists on main; `config-tiers.ts` is what a school may configure,
not how a service is run.

| ID | Tier | Examples | Requirement | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| OR-TIER-01 | Tier 0 | Public marketing and resource pages | Standard monitoring and support | tested | [`.github/workflows/production-smoke.yml`](../.github/workflows/production-smoke.yml) — hourly public and gateway probes<br>[`app/src/lib/statuspage.test.ts`](../app/src/lib/statuspage.test.ts) — the status page checks from the reader’s browser | No tier word anywhere; the probe exists without being called a tier. |
| OR-TIER-02 | Tier 1 | Student planning, Today, actions, resource discovery | Business-critical monitoring and recovery | building | [`app/src/lib/governance/error-budgets.ts`](../app/src/lib/governance/error-budgets.ts) — today_load 99.9; SLOs per journey with burn policy<br>[`app/scripts/golden-path.mjs`](../app/scripts/golden-path.mjs) — the golden path, in CI<br>[`MONITORING.md`](../MONITORING.md) — the one alert: AI spend | SLOs are declared and unmeasured; the only alert is spend. |
| OR-TIER-03 | Tier 2 | SSO, course access, assignments, submissions, integrations | Enhanced monitoring, tested fallback, defined incident response | building | [`app/src/lib/governance/error-budgets.ts`](../app/src/lib/governance/error-budgets.ts) — sign_in 99.95, assignment_draft_save 99.99<br>[`app/src/lib/draft.test.ts`](../app/src/lib/draft.test.ts) — drafts survive<br>[`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md) — SEV1–SEV4<br>[`app/src/lib/syncstatus.test.ts`](../app/src/lib/syncstatus.test.ts) — stale-data fallback | No live SSO or LMS exchange has run; fallback is tested in unit tests only. |
| OR-TIER-04 | Tier 3 | Grading, assessments, payments, high-impact record workflows | Strongest controls, change-freeze periods, reconciliation, senior approval | held | [`docs/DECISION-LOG.md`](DECISION-LOG.md) — D-009: payments remain held<br>[`docs/decisions/D-1067.md`](decisions/D-1067.md) — gradebook direction reopened; cutover remains gated<br>[`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts) — SRE-009: no academic peak calendar or change-freeze policy | The gradebook is built, but Tier 3 activation remains held pending a peak calendar, change-freeze policy, institutional parallel run and cutover approval; payments remain out by decision. |
| OR-TIER-05 | Restricted | Basic-needs intake, accommodation workflows, health and safety data | Explicit institutional owner, restricted access, special privacy and safety controls | building | [`app/src/lib/ops/console.ts`](../app/src/lib/ops/console.ts) — the restricted classification: named grant, logged read<br>[`docs/MODULE-PRIVACY-MODEL.md`](MODULE-PRIVACY-MODEL.md) — no basic-needs case-manager role<br>[`docs/CRISIS-RESPONSE-RUNBOOK.md`](CRISIS-RESPONSE-RUNBOOK.md) — person-at-risk reports | A data class exists; no restricted workflow or owner does. |

### What every tier owes

| Definition | The tree, for any tier |
| --- | --- |
| Service-level objective | `error-budgets.ts` JOURNEYS, unmeasured |
| Availability target | docs/trust/SLA.md, once it can be offered |
| RTO | **nothing** |
| RPO | **nothing** |
| Monitoring signals | docs/trust/APM-RUNBOOK.md thresholds; only AI spend is wired |
| On-call coverage | **nothing** |
| Incident severity | INCIDENT_RESPONSE.md SEV1–SEV4; APM-RUNBOOK P0–P3 |
| Customer communication rule | INCIDENT_RESPONSE.md: contacts hear from us before their students; `incident-comms.ts` |
| Maintenance windows | **nothing** |
| Release and change-freeze periods | `error-budgets.ts` POLICY freezes on budget; `rollout.ts` avoids registration and finals; no calendar |
| Fallback or manual procedure | docs/REGISTRATION-DAY-MODE.md; docs/OFFLINE-MODE.md |
| Recovery test cadence | `risk.ts` GAME_DAYS, sixteen, none held; proof calendar restore quarterly |

## 6. The implementation factory

Seventeen reusable assets: tested 3 · building 4 · designed 7 · not-started 3 · held 0. A full-platform business succeeds only if each new university does not require a custom rebuild.

| ID | Item | The document asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OR-FACT-01 | Institution discovery workbook | A workbook for discovery. | not-started | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) — DISCOVER gives it one line | None exists. |
| OR-FACT-02 | Integration and capability questionnaire | What the institution runs and can connect. | designed | [`docs/SSO-TENANT-ONBOARDING.md`](SSO-TENANT-ONBOARDING.md) — “Before anything technical”<br>[`docs/SCHOOL_DATA_PACK.md`](SCHOOL_DATA_PACK.md) — a format, not a questionnaire | No questionnaire. |
| OR-FACT-03 | Data-map template | Sources, categories, purposes, retention, access. | building | [`app/src/lib/governance/data-contracts.ts`](../app/src/lib/governance/data-contracts.ts) — contracts with steward roles and readiness()<br>[`RETENTION.md`](../RETENTION.md) — every table and its class | A contract per domain, not a fillable map per institution. |
| OR-FACT-04 | Source-content import template | How official content arrives. | not-started | [`docs/launch/CONTENT-READINESS-REGISTER.md`](launch/CONTENT-READINESS-REGISTER.md) — what must be ready, not how it is imported | None exists. |
| OR-FACT-05 | Service-directory template | The support directory the institution fills. | building | [`app/src/lib/campusdirectory.ts`](../app/src/lib/campusdirectory.ts) — the campus directory<br>[`app/src/lib/serviceregister.ts`](../app/src/lib/serviceregister.ts) — the resource model, nine of fifteen fields carried | No template an institution takes and fills. |
| OR-FACT-06 | Role and permission matrix | Who may do what. | designed | [`docs/INTEGRATION-PERMISSION-MATRIX.md`](INTEGRATION-PERMISSION-MATRIX.md) — the matrix<br>[`docs/institutional-rollout/tenant-role-schema-map.md`](institutional-rollout/tenant-role-schema-map.md) — roles to schema | Held as pages; `app_roles` is the code. |
| OR-FACT-07 | AI policy configuration kit | The settings and the choices. | building | [`app/src/lib/launch/content.ts`](../app/src/lib/launch/content.ts) — ai_policy as a readiness item<br>[`app/src/lib/governance/config-tiers.ts`](../app/src/lib/governance/config-tiers.ts) — policy settings and their reviewers | No kit; a flag and a readiness line. |
| OR-FACT-08 | Accessibility configuration checklist | What to check before launch. | designed | [`docs/ACCESSIBILITY-POLISH-CHECKLIST.md`](ACCESSIBILITY-POLISH-CHECKLIST.md) — the checklist<br>[`docs/accessibility/AT-PASS-PROTOCOL.md`](accessibility/AT-PASS-PROTOCOL.md) — the AT pass | Engineering-facing, not an institution’s checklist. |
| OR-FACT-09 | Onboarding guides by role | Student, faculty, advisor, admin. | tested | [`app/src/lib/launch/content.ts`](../app/src/lib/launch/content.ts) — LAUNCH_PACKAGE: quick starts and admin onboarding<br>[`app/src/lib/launch/content.test.ts`](../app/src/lib/launch/content.test.ts) — held<br>[`docs/launch/STUDENT-QUICK-START.md`](launch/STUDENT-QUICK-START.md) — the student one | Written; never given. |
| OR-FACT-10 | SSO, LTI, OneRoster and SCIM setup guides | One per family. | designed | [`docs/SSO-TENANT-ONBOARDING.md`](SSO-TENANT-ONBOARDING.md) — SSO<br>[`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](LTI-1.3-LAUNCH-RUNBOOK.md) — LTI<br>[`docs/SCIM-LIFECYCLE-MANAGEMENT.md`](SCIM-LIFECYCLE-MANAGEMENT.md) — SCIM<br>[`docs/SAML-IMPLEMENTATION-RUNBOOK.md`](SAML-IMPLEMENTATION-RUNBOOK.md) — SAML | No OneRoster guide. |
| OR-FACT-11 | Testing scripts | What a school runs to accept. | tested | [`docs/GOLDEN-PATH-TEST-SCRIPT.md`](GOLDEN-PATH-TEST-SCRIPT.md) — the journey<br>[`app/scripts/golden-path.mjs`](../app/scripts/golden-path.mjs) — the same, in CI<br>[`docs/vanderbilt/identity-scim-acceptance.md`](vanderbilt/identity-scim-acceptance.md) — identity acceptance | Run by CI, never by a school. |
| OR-FACT-12 | Launch communications kit | Announcements per audience. | designed | [`docs/launch/ANNOUNCEMENT-TEMPLATES.md`](launch/ANNOUNCEMENT-TEMPLATES.md) — the templates | Never filled. |
| OR-FACT-13 | Go-live checklist | The cutover. | tested | [`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — CUTOVER_CHECKLIST<br>[`app/src/lib/governance/rollout.test.ts`](../app/src/lib/governance/rollout.test.ts) — held<br>[`docs/market-readiness/GO_LIVE_CHECKLIST.md`](market-readiness/GO_LIVE_CHECKLIST.md) — the technical list | Never run. |
| OR-FACT-14 | Hypercare plan | The first two weeks. | building | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — hypercare: a daily issue log for two weeks | A programme step, not a plan. |
| OR-FACT-15 | 30/60/90-day review | Reviews on a cadence. | designed | [`docs/90-DAY-LAUNCH-PROGRAM.md`](90-DAY-LAUNCH-PROGRAM.md) — reviews and escalation<br>[`docs/PROOF-CALENDAR.md`](PROOF-CALENDAR.md) — month 1, 2, 3 | No review template. |
| OR-FACT-16 | Expansion maturity model | What a mature deployment looks like. | not-started | [`docs/operating-model/PILOT-TO-PRODUCTION.md`](operating-model/PILOT-TO-PRODUCTION.md) — phases 0–7, which end at production | None exists. |
| OR-FACT-17 | Offboarding and export checklist | Leaving cleanly. | designed | [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](DATA-PORTABILITY-AND-OFFBOARDING.md) — the hard boundaries and the steps | No tenant-wide export job or deletion certificate (LEG-004). |

## 7. Packaging, brand and the readiness test

### Packages

Sold as a unified system with modular activation. Each package points at the modules in [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) that carry it.

| Package | Holds | Launch-kit modules |
| --- | --- | --- |
| Semester Institutional | The student operating system, native LMS and gradebook, institutional control plane, SSO/LTI/OneRoster and approved SIS integrations, plus pilot, migration, training, cutover and hypercare | [LK-MOD-01](SAAS-LAUNCH-KIT.md), [LK-MOD-02](SAAS-LAUNCH-KIT.md), [LK-MOD-03](SAAS-LAUNCH-KIT.md), [LK-MOD-04](SAAS-LAUNCH-KIT.md), [LK-MOD-05](SAAS-LAUNCH-KIT.md), [LK-MOD-06](SAAS-LAUNCH-KIT.md), [LK-MOD-07](SAAS-LAUNCH-KIT.md), [LK-MOD-08](SAAS-LAUNCH-KIT.md), [LK-MOD-09](SAAS-LAUNCH-KIT.md), [LK-MOD-10](SAAS-LAUNCH-KIT.md), [LK-MOD-11](SAAS-LAUNCH-KIT.md), [LK-MOD-12](SAAS-LAUNCH-KIT.md) |

Three commercial rules — do not discount away implementation, security,
migration or support; no unlimited custom scope inside an annual price; no
module promised before it has an owner, a support model, a data model and
tested controls — are the launch kit’s guardrails LK-GUARD-03, LK-GUARD-04 and
LK-GUARD-06.

### Brand, category and trust assets

| Asset | The document asks | The tree |
| --- | --- | --- |
| A clear category | The University Operating System / Academic Navigation Platform / Source-Aware Student Experience Layer | None chosen; Company strategy is missing in SEMESTER-OPERATING-SYSTEM.md |
| A clear belief | Students should not need to understand a university’s bureaucracy or fragmented technology to make progress | README.md and docs/launch/WHAT-IS-SEMESTER.md say it in their own words |
| A clear proof | One identity, one action layer, one trust model, one operating system | docs/SEMESTER-PLATFORM-UNITY-PATTERNS.md; the five destinations |
| A clear standard | “Semester Standard”: source, scope, status, accessibility, data agency, AI governance, portability, evidence | Each is a register; nothing names the set as a standard |

| Public body of work | The tree |
| --- | --- |
| Academic Friction Index | Unchecked in the service register (S26) |
| Transfer Navigation Playbook | None; docs/TRANSFER-TRANSITION-HUB.md is the product design |
| Accessible Learning Toolkit | None |
| Campus AI Governance Canvas | None; docs/operating-model/AI-GOVERNANCE-BOARD.md is Semester’s own |
| Student Data Agency Guide | None; docs/STUDENT-DATA-CONTROL-CENTER.md is the product |
| Interoperability Maturity Model | Unchecked in the service register (S26) |

### The whole-platform readiness test

Semester is ready to sell as a full university operating system when every
enabled domain can answer these twelve questions. What answers each today:

| Question | Required answer | Answered by |
| --- | --- | --- |
| What outcome does it create? | A measurable user or institution outcome, not “engagement” | `charters.ts` successMetrics; SCOPE_QUESTIONS “What student decision does it clarify?” |
| Who owns it? | Named product, operational and institutional owner | `charters.ts` owners (role labels); SCOPE_QUESTIONS “Who owns it?”; every seat vacant |
| What data does it use? | Mapped, classified, minimized, retained, controlled | RETENTION.md; `data-contracts.ts`; MODULE-PRIVACY-MODEL.md |
| Who can access it? | Role-based, least privilege, auditable, time-bound where needed | `app_roles`; ADR 0002; supabase/rls-coverage.check.sql; advisor shares expire |
| What is official? | Source, authority and status explicitly visible | `source.ts` labels; /platform/system-boundaries/ |
| What can fail? | Risk analysis, monitoring, fallback, recovery, support runbook | EDGE-CASE-CATALOG.md; RISK-GOVERNANCE.md; RUNBOOKS.md; monitoring is one alert |
| Is it accessible? | Tested with critical assistive-technology paths and alternatives | WCAG-UI-AUDIT-SCORECARD.md; the axe smoke; no human AT pass |
| Is AI involved? | Policy, sources, provider, limits, evaluation, human review defined | `ai-lifecycle.ts`; AI-ASSURANCE.md; the kill switch |
| How is it sold? | Entitlement, price, implementation scope, contract terms | Nothing: no entitlement per module, no price, no contract (SAAS-LAUNCH-KIT.md) |
| How is it supported? | Owner, support hours, escalation, SLA/SLO, knowledge base | SUPPORT_PLAYBOOK.md tiers; support tickets; no hours, owner or knowledge base |
| How does it leave? | Export, retention, deletion, offboarding, portability | DATA-PORTABILITY-AND-OFFBOARDING.md; student export and deletion tested; no tenant export |
| How do you prove it works? | Outcome metrics, customer evidence, audit evidence | ANALYTICS.md; PROOF-CALENDAR.md, 0 of 19 filed; no customer |

### Execution priorities

tested 4 · building 2 · designed 1 · not-started 1 · held 0.

| ID | Item | The document asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OR-PRI-01 | Company foundation | Entity, IP, contracts, finance, insurance, security and governance ownership. | designed | [`docs/SAAS-LAUNCH-KIT.md`](SAAS-LAUNCH-KIT.md) — the formation and insurance checklists, item by item<br>[`docs/LAUNCH-DECISIONS.md`](LAUNCH-DECISIONS.md) — step 1 | Entity attested; the rest not started. |
| OR-PRI-02 | Shared platform core | Identity, context, object model, permissions, source/scope/status, audit, search, notifications, data controls, integrations, design system. | tested | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) — source labels<br>[`supabase/rls-coverage.check.sql`](../supabase/rls-coverage.check.sql) — every table has RLS<br>[`app/src/lib/search.test.ts`](../app/src/lib/search.test.ts) — one ranker<br>[`docs/design/SEMESTER-UI-CONSTITUTION.md`](design/SEMESTER-UI-CONSTITUTION.md) — the design system | The core is the product as built. |
| OR-PRI-03 | Every domain a configurable module with a readiness brief | Complete briefs, not disconnected feature requests. | tested | [`app/src/lib/governance/charters.ts`](../app/src/lib/governance/charters.ts) — a charter per module flag<br>[`app/src/lib/governance/charters.test.ts`](../app/src/lib/governance/charters.test.ts) — held | Charters exist for flagged modules; the domains without a flag have none. |
| OR-PRI-04 | A design-partner council | Students, faculty, disability services, advising, IT and security, registrar, student affairs, transfer, career, executive leadership. | not-started | [`docs/operating-model/RISK-GOVERNANCE.md`](operating-model/RISK-GOVERNANCE.md) — a customer advisory board with no members | None exists. |
| OR-PRI-05 | A repeatable implementation factory | Templates, automation, training, measurable launch gates. | building | [`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — the lifecycle and cutover<br>[`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) — DISCOVER → CONFIGURE → INTEGRATE → PILOT → EXPAND → OPERATE | Seven of seventeen assets are missing or not started. |
| OR-PRI-06 | Real service operations | Monitoring, incident response, release management, support, reliability tiers, customer communication. | building | [`app/src/lib/governance/error-budgets.ts`](../app/src/lib/governance/error-budgets.ts) — SLOs<br>[`app/src/lib/supporttickets.ts`](../app/src/lib/supporttickets.ts) — tickets<br>[`MONITORING.md`](../MONITORING.md) — one alert | No on-call, no tiers, no measured SLO. |
| OR-PRI-07 | Compliance and evidence as a live capability | HECVAT and TrustEd readiness, accessibility evidence, AI controls, an always-current procurement room. | tested | [`supabase/trust-room.check.sql`](../supabase/trust-room.check.sql) — the room<br>[`app/src/lib/hecvat-readiness.test.ts`](../app/src/lib/hecvat-readiness.test.ts) — a READY claim needs a filed document<br>[`docs/PROOF-CALENDAR.md`](PROOF-CALENDAR.md) — 0 of 19 filed | The room is live and nearly empty. |
| OR-PRI-08 | Sell the unified story, deliver in waves | Modules activated in institution-configured waves. | tested | [`app/src/lib/ops/claims.ts`](../app/src/lib/ops/claims.ts) — institution-configured is a register word with a floor<br>[`app/src/lib/ops/claims.test.ts`](../app/src/lib/ops/claims.test.ts) — held | Nothing has been sold. |

## 8. A hard launch definition

The launch readiness review ends in one of three decisions. The code in [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) has two.

| Decision | When | The tree |
| --- | --- | --- |
| **GO** | All mandatory gates pass; known low-risk limitations are disclosed | `launchreadiness.decide()` go; docs/launch/KNOWN-LIMITATIONS.md is the disclosure |
| **GO WITH CONDITIONS** | Only time-bound, documented, non-critical conditions remain, with owners and customer disclosures assigned | `launchreadiness.decide()` go-with-conditions (D-117): nothing open except P2/P3 blockers the founder accepted with a reason, an expiry and what pilot users are told; the verdict lists each condition |
| **NO-GO** | Any P0 security, privacy, accessibility, grade-integrity, data-loss, operational-readiness, legal or unsupported-claim risk remains | `launchreadiness.decide()` no-go; the current verdict |

## 9. Real production verification

Nothing here is complete until a real test has evidence: an automated test record, a manual script, a screen recording where helpful, an audit event, the result, an owner, a date, and the remediation if it failed. A guard in this table proves the behaviour in CI against a disposable database; none has been run against production with a record filed, because docs/evidence/ does not exist.

67 checks across seven domains; 52 have a guard, 15 have none. Every payment check but two is unguarded because no payment exists (D-009).

| Domain | Check | Guard |
| --- | --- | --- |
| Authentication | Sign-up | [`supabase/invites.check.sql`](../supabase/invites.check.sql) |
| Authentication | Email verification | [`app/src/lib/cloud.test.ts`](../app/src/lib/cloud.test.ts) |
| Authentication | Sign-in | [`app/scripts/golden-path.mjs`](../app/scripts/golden-path.mjs) |
| Authentication | Password reset | [`app/src/lib/cloud.test.ts`](../app/src/lib/cloud.test.ts) |
| Authentication | SSO | [`supabase/identity-provisioning.check.sql`](../supabase/identity-provisioning.check.sql) |
| Authentication | MFA for privileged roles | **none** |
| Authentication | Session timeout | **none** |
| Authentication | Account recovery | [`app/src/lib/browser-recovery.test.ts`](../app/src/lib/browser-recovery.test.ts) |
| Authentication | Session revocation | [`app/src/lib/token.test.ts`](../app/src/lib/token.test.ts) |
| Authentication | Deprovisioning | [`supabase/scim-gateway.check.sql`](../supabase/scim-gateway.check.sql) |
| Authorization | Tenant isolation | [`supabase/tenancy.check.sql`](../supabase/tenancy.check.sql) |
| Authorization | Role escalation attempts | [`supabase/rolegrants.check.sql`](../supabase/rolegrants.check.sql) |
| Authorization | Cross-course access | [`supabase/coursestudio.check.sql`](../supabase/coursestudio.check.sql) |
| Authorization | Cross-institution access | [`supabase/integration-rls-matrix.check.sql`](../supabase/integration-rls-matrix.check.sql) |
| Authorization | Support-access expiry | [`supabase/support-access.check.sql`](../supabase/support-access.check.sql) |
| Authorization | Revoked-share behaviour | [`supabase/advisor.check.sql`](../supabase/advisor.check.sql) |
| Authorization | API authorization | [`app/server/institution/auth.test.ts`](../app/server/institution/auth.test.ts) |
| Authorization | Storage-bucket rules | [`supabase/community.check.sql`](../supabase/community.check.sql) |
| Authorization | Admin-console boundaries | [`supabase/admins.check.sql`](../supabase/admins.check.sql) |
| Data lifecycle | Create, update, delete | [`app/src/lib/records.test.ts`](../app/src/lib/records.test.ts) |
| Data lifecycle | Export | [`app/src/lib/export.test.ts`](../app/src/lib/export.test.ts) |
| Data lifecycle | Revoke share | [`supabase/familyshare.check.sql`](../supabase/familyshare.check.sql) |
| Data lifecycle | Disconnect integration | [`app/src/lib/revoke.test.ts`](../app/src/lib/revoke.test.ts) |
| Data lifecycle | Retention expiry | [`supabase/retention-sweeps.check.sql`](../supabase/retention-sweeps.check.sql) |
| Data lifecycle | Backup expiration | **none** |
| Data lifecycle | Legal hold | [`supabase/integration-hardening.check.sql`](../supabase/integration-hardening.check.sql) |
| Data lifecycle | Restore | [`supabase/restore.sh`](../supabase/restore.sh) |
| Data lifecycle | Account deletion | [`supabase/deletion.check.sql`](../supabase/deletion.check.sql) |
| Payment | Successful payment | **none** |
| Payment | Failed payment | **none** |
| Payment | Duplicate payment | **none** |
| Payment | Refund | **none** |
| Payment | Invoice and receipt | **none** |
| Payment | Tax calculation | **none** |
| Payment | Entitlement upgrade and downgrade | [`app/src/lib/entitlement.test.ts`](../app/src/lib/entitlement.test.ts) |
| Payment | Cancellation | **none** |
| Payment | Access revocation | [`supabase/tenant-plan.check.sql`](../supabase/tenant-plan.check.sql) |
| Integration | SSO | [`supabase/tenant-sso-policy.check.sql`](../supabase/tenant-sso-policy.check.sql) |
| Integration | LTI launch | [`supabase/lti.check.sql`](../supabase/lti.check.sql) |
| Integration | Roster and context data | [`supabase/lti-membership.check.sql`](../supabase/lti-membership.check.sql) |
| Integration | Grade sync where enabled | [`supabase/ltiags.check.sql`](../supabase/ltiags.check.sql) |
| Integration | Token expiration | [`app/src/lib/ltikey.test.ts`](../app/src/lib/ltikey.test.ts) |
| Integration | Permission revocation | [`app/src/lib/revoke.test.ts`](../app/src/lib/revoke.test.ts) |
| Integration | Rate limiting | [`supabase/rate-limits.check.sql`](../supabase/rate-limits.check.sql) |
| Integration | Duplicate events | [`supabase/outbox.check.sql`](../supabase/outbox.check.sql) |
| Integration | Source outage | **none** |
| Integration | Reconciliation | [`supabase/integration-quality.check.sql`](../supabase/integration-quality.check.sql) |
| Integration | Graceful degradation | [`app/src/lib/syncstatus.test.ts`](../app/src/lib/syncstatus.test.ts) |
| Student workflows | Today | [`app/scripts/golden-path.mjs`](../app/scripts/golden-path.mjs) |
| Student workflows | Plan | [`app/src/lib/degree.test.ts`](../app/src/lib/degree.test.ts) |
| Student workflows | Course and source access | [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts) |
| Student workflows | Assignment completion | [`app/src/lib/assignment.test.ts`](../app/src/lib/assignment.test.ts) |
| Student workflows | Study support | [`app/src/lib/studystudio.test.ts`](../app/src/lib/studystudio.test.ts) |
| Student workflows | Advisor and service handoff | [`app/src/lib/help-routes.test.ts`](../app/src/lib/help-routes.test.ts) |
| Student workflows | Notification preference | [`app/src/lib/notify.test.ts`](../app/src/lib/notify.test.ts) |
| Student workflows | Accessibility preferences | [`app/scripts/accessibility-smoke.mjs`](../app/scripts/accessibility-smoke.mjs) |
| Student workflows | Error recovery | [`app/src/lib/browser-recovery.test.ts`](../app/src/lib/browser-recovery.test.ts) |
| Student workflows | Support ticket | [`supabase/support-tickets.check.sql`](../supabase/support-tickets.check.sql) |
| Institution workflows | Tenant setup | [`supabase/tenant-rollout.check.sql`](../supabase/tenant-rollout.check.sql) |
| Institution workflows | User and role administration | [`supabase/role-grant-audit.check.sql`](../supabase/role-grant-audit.check.sql) |
| Institution workflows | Source-content management | [`app/src/lib/launch/content.test.ts`](../app/src/lib/launch/content.test.ts) |
| Institution workflows | Policy configuration | [`app/src/lib/governance/config-tiers.test.ts`](../app/src/lib/governance/config-tiers.test.ts) |
| Institution workflows | Integration health | [`app/src/components/institutional/IntegrationDashboard.test.tsx`](../app/src/components/institutional/IntegrationDashboard.test.tsx) |
| Institution workflows | Audit export | **none** |
| Institution workflows | Support escalation | **none** |
| Institution workflows | Data export | **none** |
| Institution workflows | Customer offboarding | **none** |

## 10. Stress, failure and recovery testing

An untested backup is not a recovery plan. The restore rehearsal runs in CI against a disposable project; no restore of production has been timed, so no RTO or RPO can be stated (R-10).

Eighteen scenarios, each with the edge cases (`EC-`), risks (`R-`), game days
(`GD-`) and maturity controls that already name it, and the runbook that would
be opened. Every game day is unheld.

| Scenario | Named by | Runbook |
| --- | --- | --- |
| Database unavailable | `GD-05` | [`docs/RUNBOOKS.md`](RUNBOOKS.md) |
| Migration fails halfway | `EC-INF-06` | [`ROLLBACK.md`](../ROLLBACK.md) |
| Backup restore required | `EC-INF-07`, `GD-13`, `R-10` | [`RESTORE.md`](../RESTORE.md) |
| Regional or cloud-provider outage | `EC-INF-08`, `EX-05`, `DS-07` | [`docs/market-readiness/DISASTER_RECOVERY.md`](market-readiness/DISASTER_RECOVERY.md) |
| DNS or CDN outage | `EC-INF-09`, `EX-09` | **none** |
| Payment-provider outage | `EC-COM-01`, `GD-15`, `DS-04` | **none** |
| Email-provider outage | `EC-INF-10` | **none** |
| Identity-provider outage | `GD-01`, `EC-ID-04` | [`docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md`](INSTITUTIONAL-SSO-LAUNCH-READINESS.md) |
| LMS or SIS integration outage | `GD-02`, `GD-03`, `EC-DQ-06` | [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md) |
| Webhook flood or duplicate events | `EC-DQ-04`, `EC-DQ-05`, `EC-INF-05`, `GD-07` | [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md) |
| AI-provider outage or unsafe-response surge | `EC-AI-04`, `EC-AI-09`, `GD-04`, `R-07` | [`docs/RUNBOOKS.md`](RUNBOOKS.md) |
| Queue backlog | `GD-06` | [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md) |
| Storage or upload outage | `EC-INF-12` | **none** |
| Expired certificate | `EC-INF-03` | **none** |
| Secret or key-rotation failure | `EC-INF-01`, `EC-INF-02` | [`SECRETS.md`](../SECRETS.md) |
| Malicious account or rate-limit attack | `EC-AI-09`, `R-12` | **none** |
| Accidental administrator misconfiguration | `EC-INF-11`, `GD-10`, `EC-ID-08`, `GD-11` | **none** |
| Critical staff member unavailable | `DS-01`, `DS-02`, `DS-11`, `R-08`, `R-09` | **none** |

### What every scenario owes

| Field | Already carried by |
| --- | --- |
| Detection signal | `edgecases.ts` guard, when one exists |
| Customer impact | `risk.ts` Risk.notify |
| Severity | `edgecases.ts` critical; `risk.ts` severity |
| Named incident commander | **nothing** |
| Technical mitigation | `risk.ts` mitigation |
| Manual fallback | `charters.ts` fallback, per module |
| Customer communication template | docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md; `incident-comms.ts` |
| Recovery objective | **nothing** |
| Evidence preservation | `postmortem.ts` |
| Post-incident review owner | **nothing** |

## 11. Capacity, performance and cost proof

One load harness exists, for the database only: supabase/load.sh runs registration-week and everyday-sync scenarios against every migration in CI, each against a latency budget, then asserts invariants, and PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md records its readings (SRE-007, D-154). Nothing loads PostgREST, GoTrue or the edge functions, and no journey that does not exist yet has a target.

The load scenarios to demonstrate before marketing a complete platform, none of which has been run:

- Concurrent sign-in at the start of term
- Course-material access before an exam
- Assignment-submission burst near a deadline
- Assessment delivery and autosave load
- Grade-release spike
- Notification and digest batch
- Roster sync and import volume
- Search-index update volume
- Document upload and processing volume
- AI request burst and provider throttling
- Admin and audit export volume

| Threshold | The tree |
| --- | --- |
| Response-time budgets | docs/trust/APM-RUNBOOK.md p95 1.5 s / 4 s; `error-budgets.ts` LCP ≤ 2.5 s, INP ≤ 200 ms, guard null |
| Error-rate threshold | APM-RUNBOOK.md 5xx > 1% / 5%, not wired |
| Queue-depth threshold | APM-RUNBOOK.md queue age 10 / 30 min, not wired |
| Database saturation threshold | APM-RUNBOOK.md 70% / 85%, not wired |
| Autosave durability requirement | `error-budgets.ts` assignment_draft_save 99.99; `draft.test.ts` |
| Maximum accepted upload and processing time | **nothing** |
| RTO and RPO by service tier | **nothing** |
| Cost per active student | `maturity.ts` FO-09, partial: no unit cost is measured |
| Cost per AI-successful action | COMMERCIAL-GOVERNANCE.md dashboard design; usage recorded per tenant |
| Cost per large integration sync | **nothing** |
| Cost per support ticket | **nothing** |
| Load test of any journey | **nothing** |

## 12. Data quality and migration readiness

The integration foundations must be operational requirements, not future ideas: tested 11 · building 0 · designed 2 · not-started 0 · held 0. Most are tested against mock sources; none has met a live one.

| ID | Item | The document asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OR-DQ-01 | Data reconciliation dashboard | What the source says against what Semester shows. | tested | [`app/src/lib/integration/reconcile.ts`](../app/src/lib/integration/reconcile.ts) — reconciliation<br>[`app/src/components/institutional/IntegrationDashboard.test.tsx`](../app/src/components/institutional/IntegrationDashboard.test.tsx) — the dashboard renders it | Admin-facing; never fed by a live source. |
| OR-DQ-02 | Schema-drift detection | A source changes shape and somebody knows. | tested | [`app/src/lib/integration/drift.ts`](../app/src/lib/integration/drift.ts) — detectDrift<br>[`app/src/lib/integration/quality.test.ts`](../app/src/lib/integration/quality.test.ts) — held<br>[`supabase/fingerprint.sql`](../supabase/fingerprint.sql) — our own schema’s fingerprint, checked by rehearse.sh | Held in code. |
| OR-DQ-03 | Field-level lineage | Every field knows its source. | tested | [`app/src/lib/integration/lineage.ts`](../app/src/lib/integration/lineage.ts) — breachLevel, ownerProblems<br>[`app/src/lib/integration/quality.test.ts`](../app/src/lib/integration/quality.test.ts) — held | Held in code. |
| OR-DQ-04 | Source owner and freshness SLA | A person and a deadline per source. | tested | [`app/src/lib/governance/data-contracts.ts`](../app/src/lib/governance/data-contracts.ts) — CONTRACTS with steward roles; REQUIRED_TO_GO_LIVE<br>[`app/src/lib/governance/data-contracts.test.ts`](../app/src/lib/governance/data-contracts.test.ts) — a contract is unstaffed until a named person holds each role<br>[`app/src/lib/integration/freshness.ts`](../app/src/lib/integration/freshness.ts) — freshness | Every contract is unstaffed. |
| OR-DQ-05 | Import validation and duplicate resolution | Bad rows quarantined; duplicates resolved and reversible. | tested | [`app/src/lib/integration/pipeline.ts`](../app/src/lib/integration/pipeline.ts) — quarantine<br>[`app/src/lib/integration/duplicates.ts`](../app/src/lib/integration/duplicates.ts) — resolveDuplicate, reverseResolution<br>[`app/src/lib/integration/quality.test.ts`](../app/src/lib/integration/quality.test.ts) — held | Held in code. |
| OR-DQ-06 | Connector contract tests | Every connector proves its declaration. | tested | [`app/src/lib/integration/adapter.ts`](../app/src/lib/integration/adapter.ts) — validateDeclaration<br>[`app/src/lib/integration/mock-sis.test.ts`](../app/src/lib/integration/mock-sis.test.ts) — the mock SIS<br>[`app/src/lib/integration/mock-campus.test.ts`](../app/src/lib/integration/mock-campus.test.ts) — the mock campus | Mock adapters only; no live provider. |
| OR-DQ-07 | Sync simulation sandbox | Run a sync without writing. | tested | [`app/src/lib/integration/simulate.ts`](../app/src/lib/integration/simulate.ts) — simulate<br>[`app/server/institution/sandbox.test.ts`](../app/server/institution/sandbox.test.ts) — held<br>[`docs/SYNC-SIMULATION-SANDBOX.md`](SYNC-SIMULATION-SANDBOX.md) — the design | Held in code. |
| OR-DQ-08 | Dead-letter queue and repair workflow | Failed events are kept and replayed. | tested | [`app/src/lib/integration/retry.ts`](../app/src/lib/integration/retry.ts) — retry<br>[`supabase/outbox.check.sql`](../supabase/outbox.check.sql) — the outbox<br>[`app/server/integration/worker.test.ts`](../app/server/integration/worker.test.ts) — the worker<br>[`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md) — §5 pause, resume, replay | Held in code. |
| OR-DQ-09 | Stale-data labels and fallback UX | A stale figure says so. | tested | [`app/src/lib/integration/freshness.ts`](../app/src/lib/integration/freshness.ts) — freshnessSentence<br>[`app/src/lib/syncstatus.test.ts`](../app/src/lib/syncstatus.test.ts) — the sync status<br>[`supabase/canonical-display.check.sql`](../supabase/canonical-display.check.sql) — the canonical display | Held in code. |
| OR-DQ-10 | Source outage behaviour | What the product does when a source is down. | designed | [`docs/operating-model/RISK-GOVERNANCE.md`](operating-model/RISK-GOVERNANCE.md) — game days GD-02 and GD-03, not held | A game day nobody has run. |
| OR-DQ-11 | Customer-visible integration health | The institution sees the health of its own connections. | tested | [`app/src/lib/control-plane.ts`](../app/src/lib/control-plane.ts) — integration health<br>[`app/src/lib/control-plane.test.ts`](../app/src/lib/control-plane.test.ts) — held | Admin-facing in the app; no customer has seen it. |
| OR-DQ-12 | Versioned data contracts | Mappings propose, simulate, approve, go live, roll back. | tested | [`app/src/lib/integration/mapping-versions.ts`](../app/src/lib/integration/mapping-versions.ts) — the five states<br>[`packages/institution/src/events.test.ts`](../packages/institution/src/events.test.ts) — event contracts<br>[`docs/data-contract.md`](data-contract.md) — the app sync contract | Held in code. |
| OR-DQ-13 | Migration rollback and reconciliation | A migration can be reversed and its result reconciled. | designed | [`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — MIGRATION_ACCEPTANCE<br>[`docs/DATA-MIGRATION-PLAN.md`](DATA-MIGRATION-PLAN.md) — the plan<br>[`docs/market-readiness/MIGRATION_PLAYBOOK.md`](market-readiness/MIGRATION_PLAYBOOK.md) — the playbook | Acceptance lines and a plan; no migration tooling. |

## 13. Support is a product

Before live customers, build the support service, not an email address: tested 5 · building 2 · designed 4 · not-started 2 · held 1.

| ID | Item | The document asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OR-SUP-01 | Help center and searchable documentation | A place to look first. | tested | [`app/src/lib/guidebook.ts`](../app/src/lib/guidebook.ts) — the guidebook<br>[`app/src/lib/guidebook.test.ts`](../app/src/lib/guidebook.test.ts) — held<br>[`docs/launch/FAQ.md`](launch/FAQ.md) — the FAQ | In-app only; no public help center. |
| OR-SUP-02 | In-app support route | Ask for help from inside the product. | tested | [`app/src/lib/supporttickets.ts`](../app/src/lib/supporttickets.ts) — seven categories; stable SUP references; 24 h / 72 h first-response targets<br>[`supabase/support-tickets.check.sql`](../supabase/support-tickets.check.sql) — five a day; identity-free staff queue; reply idempotency; three-notice rolling-day cap<br>[`app/src/components/console/supportqueue.test.tsx`](../app/src/components/console/supportqueue.test.tsx) — operator queue, approved context, replies and resolution states<br>[`app/src/lib/supportnotify.test.ts`](../app/src/lib/supportnotify.test.ts) — generic email hint, origin/auth/capability refusal, vendor gate, durable retries and visible dead letters | The individual beta queue is live and founder-staffed; production ticket creation, staff reply, Help-thread receipt and resolution passed UAT October 3, 2026. Email delivery mechanics reached provider acceptance in that UAT, but the worker and UI are parked until Resend vendor review, executed terms/DPA, ownership and activation approval are recorded; Outlook inbox receipt is also pending. |
| OR-SUP-03 | Ticket intake, triage, priority, ownership, SLA, escalation | A queue that is worked. | building | [`app/src/lib/supporttickets.ts`](../app/src/lib/supporttickets.ts) — categories and targets<br>[`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) — T1–T3 and when to escalate | Founder-operated beta owner; no published hours, rota, contracted escalation route or SLA commitment. |
| OR-SUP-04 | Student, institution and technical routing | Three doors. | designed | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) — T1–T3 only<br>[`app/src/lib/help-routes.ts`](../app/src/lib/help-routes.ts) — student → campus office, which is a different thing | One door. |
| OR-SUP-05 | Knowledge base with owner and review date | Articles that are somebody’s. | not-started | [`docs/launch/FAQ.md`](launch/FAQ.md) — a starting knowledge base with no owner or date | None exists. |
| OR-SUP-06 | Status page | Public, current. | tested | [`app/public/status.html`](../app/public/status.html) — checks from the reader’s browser<br>[`app/src/lib/statuspage.test.ts`](../app/src/lib/statuspage.test.ts) — held | No subscriber notification (SRE-010). |
| OR-SUP-07 | Incident communications | By audience, on a clock. | tested | [`app/src/lib/governance/incident-comms.ts`](../app/src/lib/governance/incident-comms.ts) — compose() by audience<br>[`app/src/lib/governance/incident-comms.test.ts`](../app/src/lib/governance/incident-comms.test.ts) — held<br>[`docs/market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`](market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md) — initial, update, resolution, handoff | Never sent. |
| OR-SUP-08 | Accessibility support route | A named way to ask for a format or a person. | tested | [`app/src/lib/supporttickets.ts`](../app/src/lib/supporttickets.ts) — the accessibility category, 24 h<br>[`supabase/support-tickets.check.sql`](../supabase/support-tickets.check.sql) — held | No named person behind it. |
| OR-SUP-09 | Privacy and security reporting route | Where a report goes. | designed | [`SECURITY.md`](../SECURITY.md) — the owner: a personal mailbox; no security.txt<br>[`app/src/lib/supporttickets.ts`](../app/src/lib/supporttickets.ts) — the privacy category | A personal Gmail; LAUNCH-DECISIONS item 2. |
| OR-SUP-10 | AI safety report route | Report an unsafe or wrong AI answer. | building | [`app/src/lib/feedback.ts`](../app/src/lib/feedback.ts) — wrong is a feedback kind<br>[`app/src/lib/safetyreport.test.ts`](../app/src/lib/safetyreport.test.ts) — safety reports | Generic feedback; no AI-specific route or owner. |
| OR-SUP-11 | Billing and refund route | Money questions. | held | [`docs/DECISION-LOG.md`](DECISION-LOG.md) — D-009: billing stays out | Out by decision. |
| OR-SUP-12 | After-hours policy | What happens at 2 a.m. | designed | [`docs/trust/APM-RUNBOOK.md`](trust/APM-RUNBOOK.md) — “There is no 24/7 coverage” | Stated honestly; no policy beyond that (SUP-002). |
| OR-SUP-13 | Customer admin escalation tree | Who at the institution hears what, in what order. | designed | [`docs/vanderbilt/incident-routing.md`](vanderbilt/incident-routing.md) — routing for the first tenant, every owner unassigned | One tenant’s draft. |
| OR-SUP-14 | Support QA and recurring-issue review | Tickets read for patterns. | not-started | [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md) — no QA step | None exists. |

### What every ticket type owes

| Field | Already carried by |
| --- | --- |
| Customer impact | **nothing** |
| Severity | `supporttickets.ts` category, which sets the target |
| Owner | **nothing** |
| Target response | `firstResponseHours`: 24 or 72 |
| Target resolution or update cadence | **nothing** |
| Escalation rule | SUPPORT_PLAYBOOK.md tiers |
| Communication template | INCIDENT_COMMUNICATION_TEMPLATES.md, for incidents only |
| Root-cause or problem-record link | `postmortem.ts`, for incidents only |

## 14. Implementation and change-management capacity

Do not sell a whole university operating system without knowing exactly how it gets adopted: tested 6 · building 4 · designed 3 · not-started 1 · held 0.

| ID | Item | The document asks | Standing | Evidence | Gap |
| --- | --- | --- | --- | --- | --- |
| OR-IMP-01 | Implementation manager role | A person who runs each implementation. | designed | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) — roles on our side: implementation lead, engineer, support lead | Nobody holds it; the success seat is vacant. |
| OR-IMP-02 | Institution readiness assessment | Scored before a pilot starts. | designed | [`docs/operating-model/CHANGE-MANAGEMENT.md`](operating-model/CHANGE-MANAGEMENT.md) — ten items scored 1–5; pilot threshold 30 of 50, no item at 1 | A page; never scored. |
| OR-IMP-03 | Executive and operational sponsor requirements | Both named before start. | tested | [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) — executiveSponsor and operationalChampion required<br>[`app/src/lib/gtm/pilot.test.ts`](../app/src/lib/gtm/pilot.test.ts) — held<br>[`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — sponsor_qualified and sponsor_go_live gates | Held in code. |
| OR-IMP-04 | Current-state workflow mapping | How the institution does it today. | not-started | [`docs/market-readiness/IMPLEMENTATION_PLAYBOOK.md`](market-readiness/IMPLEMENTATION_PLAYBOOK.md) — one line under DISCOVER | None exists. |
| OR-IMP-05 | Data and integration discovery | What connects and what it carries. | designed | [`docs/SSO-TENANT-ONBOARDING.md`](SSO-TENANT-ONBOARDING.md) — before anything technical<br>[`docs/SCHOOL_DATA_PACK.md`](SCHOOL_DATA_PACK.md) — the pack format | No questionnaire. |
| OR-IMP-06 | Content and source ownership inventory | Every official item has a named owner. | tested | [`app/src/lib/launch/content.ts`](../app/src/lib/launch/content.ts) — CONTENT_READINESS with namedPerson()<br>[`app/src/lib/launch/content.test.ts`](../app/src/lib/launch/content.test.ts) — held | Never filled for a real school. |
| OR-IMP-07 | Policy configuration | The institution’s settings, reviewed by tier. | tested | [`app/src/lib/governance/config-tiers.ts`](../app/src/lib/governance/config-tiers.ts) — SETTINGS, TIER_REVIEWERS, NEVER<br>[`app/src/lib/governance/config-tiers.test.ts`](../app/src/lib/governance/config-tiers.test.ts) — held | Held in code. |
| OR-IMP-08 | Accessibility and AI readiness | The statement and the policy before launch. | tested | [`app/src/lib/launch/content.ts`](../app/src/lib/launch/content.ts) — ai_policy, accessibility_statement, accessibility_guide, privacy_ai_guide<br>[`app/src/lib/launch/content.test.ts`](../app/src/lib/launch/content.test.ts) — held | Readiness lines; the accessibility statement itself is not started. |
| OR-IMP-09 | Training by role | Student, faculty, advisor, admin. | tested | [`app/src/lib/launch/checklists.ts`](../app/src/lib/launch/checklists.ts) — FIRST_DAY per role<br>[`app/src/lib/launch/checklists.test.ts`](../app/src/lib/launch/checklists.test.ts) — held<br>[`docs/LAUNCH-CONTENT-AND-TRAINING.md`](LAUNCH-CONTENT-AND-TRAINING.md) — §3 training | Never delivered. |
| OR-IMP-10 | Pilot communication calendar | Who hears what, when. | building | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — comms<br>[`app/src/lib/governance/maturity.ts`](../app/src/lib/governance/maturity.ts) — AD-06 partial: not a calendar an institution can take and fill | A programme step, not a calendar. |
| OR-IMP-11 | Student champion network | Students who carry the launch. | building | [`app/src/lib/launch/content.ts`](../app/src/lib/launch/content.ts) — ambassador_kit<br>[`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts) — the champion seat, vacant | A kit line and a seat. |
| OR-IMP-12 | Hypercare period | Two weeks of daily attention. | building | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — hypercare | A programme step. |
| OR-IMP-13 | Adoption review | Read the numbers with the sponsor. | building | [`app/src/lib/launch/ninety-day.ts`](../app/src/lib/launch/ninety-day.ts) — midpoint-report<br>[`docs/PROOF-CALENDAR.md`](PROOF-CALENDAR.md) — the cadence | No template. |
| OR-IMP-14 | Expansion decision | Decide what comes next, in writing. | tested | [`app/src/lib/governance/rollout.ts`](../app/src/lib/governance/rollout.ts) — expansion_decision; DECISION_OPTIONS<br>[`app/src/lib/governance/rollout.test.ts`](../app/src/lib/governance/rollout.test.ts) — held | Held in code. |

### The mutual success plan

Each customer needs one. No structure exists; the fields `PilotPlan` in [`app/src/lib/gtm/pilot.ts`](../app/src/lib/gtm/pilot.ts) already carries:

| Field | Already carried by |
| --- | --- |
| Institution objective | `PilotPlan.workflow` |
| Cohort | `PilotPlan.cohort` |
| Enabled modules | **nothing** |
| Success measures | `PilotPlan.metrics` |
| Baseline | `PilotPlan.baseline`; per-metric baseline |
| Target | per-metric target |
| Owner on each side | `executiveSponsor`, `operationalChampion`; nothing on Semester’s side |
| Milestones | `midpointReviewDate`, `conversionDate` |
| Risks | **nothing** |
| Decision dates | `conversionDate` |
| Expansion conditions | **nothing** |

## 15. Revenue operations and finance controls

Order-to-cash discipline. Sales stages and the discount matrix are code; the
financial controls are a page; nothing has been invoiced.

| Item | The tree |
| --- | --- |
| CRM source of truth | `gtm_accounts`, `gtm_stakeholders`, `gtm_decision_log`, written by Semester’s sales role; empty |
| Lead, account and contact hierarchy | `gtm_accounts` and `gtm_stakeholders` |
| Opportunity stages and exit criteria | `gtm/stages.ts` SALES_STAGES and SALES_EXIT, tested |
| Forecasting | **nothing** |
| Proposal generation | **nothing** |
| Contract approval | `deal-desk.ts` review(): the approvers a deal needs |
| Quote-to-order workflow | **nothing** |
| Invoice schedule | **nothing** |
| Collections and dunning | **nothing** |
| Revenue recognition guidance from a CPA | COMMERCIAL-GOVERNANCE.md: subscription ratably, implementation on delivery; no CPA |
| Expense approval | COMMERCIAL-GOVERNANCE.md: tiered by amount |
| Budget versus actual | COMMERCIAL-GOVERNANCE.md: monthly; no budget exists |
| Monthly close | COMMERCIAL-GOVERNANCE.md: close review; none has happened |
| Cash forecast | COMMERCIAL-GOVERNANCE.md: 13-week rolling; none exists |
| Tax and nexus review | COMMERCIAL-GOVERNANCE.md: external accountant, annually and per new state |
| Vendor approvals | COMMERCIAL-GOVERNANCE.md: finance plus security for data processors; docs/trust/VENDOR-RISK-REGISTER.md |
| Procurement and purchasing policy | **nothing** |
| Discount approval matrix | `deal-desk.ts` DEAL_POLICY, tested |
| Financial reporting | **nothing** |

## 16. Hiring and key-person resilience

A platform this broad cannot rely on one person’s memory or availability. It does.

| Item | The tree |
| --- | --- |
| Role scorecards | **nothing** |
| Hiring plan | OPERATING-RHYTHM.md monthly: open roles; none listed |
| Contractor and vendor access controls | SOC2-READINESS.md CC6-06; `console.ts` break-glass with two approvers |
| Documented onboarding and offboarding | SOC2-READINESS.md CC1-07, CC6-06; maturity DO-05 owed |
| Succession or backup owner for every critical system | **nothing** |
| Runbooks for production, support, finance, legal and sales | docs/RUNBOOKS.md for production; nothing for finance, legal or sales |
| Emergency secrets access under strict control | SECRETS.md: where they are, not who else may use them (DS-01) |
| Founder-unavailability plan | R-09 asks for it; none written |
| Customer-communication delegation | **nothing** |
| Knowledge-transfer requirements | maturity DO-02 owed |
| Investor and board reporting | RISK-GOVERNANCE.md board-level report, ten items; no board |

## 17. The go-live dossier

One dossier for each production launch, pilot, module and high-risk
integration. None exists as a single document; each section, and what already
carries it:

| Section | Holds | Already carried by |
| --- | --- | --- |
| Scope | Enabled, excluded, deferred | `RolloutRecord`; `PilotPlan`; no excluded list |
| Customer | Institution, cohort, roles, owner, contract or order form, support contacts | `gtm_accounts`, `gtm_pilots`; no order form |
| Product | User journeys, success measures, known limitations, accessibility status | docs/GOLDEN-PATH-TEST-SCRIPT.md; docs/launch/KNOWN-LIMITATIONS.md; WCAG-UI-AUDIT-SCORECARD.md |
| Data | Data map, classification, source owner, retention, sharing, deletion, integration scope, freshness plan | RETENTION.md; `data-contracts.ts`; MODULE-PRIVACY-MODEL.md |
| Security | Threat model, roles, MFA, logging, tests, vulnerabilities, secrets, approvals | docs/INTEGRATION-THREAT-MODEL.md; SECRETS.md; no MFA, no pen test |
| AI | Model and provider, data use, policy, evaluation, limitations, monitoring, disable plan | `ai-lifecycle.ts`; AI-ASSURANCE.md; the kill switch |
| Operations | SLOs, monitoring, alerts, on-call, support routes, runbooks, dependencies, RTO/RPO, rollback, DR evidence | `error-budgets.ts`; RUNBOOKS.md; ROLLBACK.md; no on-call, no RTO/RPO, no DR evidence |
| Commercial | Entitlements, pricing, invoicing, implementation scope, renewal path | `tenant_plan`; `deal-desk.ts`; no price, no invoice |
| Change | Training, communications, documentation, schedule, hypercare | `launch/content.ts`; `launch/checklists.ts`; ninety-day steps |
| Evidence | Links to every approval, test, policy, audit artifact and accepted exception | `LaunchState` acceptances; docs/evidence/ does not exist |
| Decision | Go / go with conditions / no-go; named approver; date; next review | `launchreadiness.decide()`: go, go-with-conditions or no-go, with the conditions listed; no approver name or next-review date on the verdict |

## 18. The final checklist

Semester is operational when it can say yes to all twelve. Today:

| Line | Answer | Why |
| --- | --- | --- |
| A registered company, bank account, accounting, contracts, IP ownership, insurance and a cash and runway model | **no** | An LLC by attestation; nothing else. |
| We can sell, sign, invoice, collect, support, renew and offboard a customer | **no** | No signatory, no invoice, no support hours; student offboarding only. |
| At least one paid, bounded pilot with named owners, success measures, data scope and a conversion path | **no** | The rules that would bound it are tested; no pilot exists. |
| A student can create an account or use SSO, reach real value, receive help, control eligible data and recover from failure | **partly** | Sign-up, value, data controls and recovery are tested; help is a ticket nobody answers; SSO has no live exchange. |
| An institution can configure its tenant, manage roles, control policies, review integrations, access evidence and receive support | **partly** | Configuration, roles, policies and integration health are tested; no evidence room contents, no support. |
| Production is separate from staging; secrets protected; access reviewed; isolation, backups, restore, monitoring, alerting and rollback tested | **partly** | Isolation and restore are tested in CI; no production restore, one alert, no access review, rollback untested in production. |
| We have tested performance, failure, recovery, security, privacy, accessibility, AI behaviour and integration reconciliation | **partly** | Reconciliation, privacy and AI behaviour are tested; no load test, no game day held, no pen test, no human AT pass. |
| Written and tested runbooks for incidents, customer communication, data requests, integration failures and vendor outages | **partly** | Written for incidents, communication and integrations; none tested; none for vendor outages. |
| A current Trust Center, procurement room, DPA, security package, accessibility statement, AI policy, retention policy and subprocessor list | **partly** | Room, security whitepaper, retention and subprocessors are current; no public Trust Center, DPA, accessibility statement or in-force AI policy. |
| A product governance council, evidence register, release gates, risk and exception process and accountable owners | **partly** | Gates and the exception process are code; the council has no members, the evidence register is empty, every owner is vacant. |
| We know which features are live, pilot-only or planned, and never sell or imply unsupported capability | **yes** | The claims register gives every public claim a register word with a floor, and the build fails above it. |
| We can measure activation, reliability, support quality, implementation effort, accessibility success, customer value, revenue, cost, retention and expansion | **partly** | Activation is measured; reliability and cost are instrumented; the rest are defined only. |

Build it · Test it · Secure it · Document it · Staff it · Sell it · Implement it · Support it · Measure it · Recover it · Renew it.
