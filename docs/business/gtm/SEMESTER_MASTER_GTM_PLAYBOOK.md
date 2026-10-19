# Semester Master Go-To-Market Playbook

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERNAL - NOT APPROVED. Planning input for founder decision; not a price book, forecast, target, commitment or customer-facing document** |
| Owner | Harrison Rubin (interim, single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] plus professional-review flags [REVIEW: counsel] [REVIEW: tax] [REVIEW: accounting] [REVIEW: insurance] [REVIEW: privacy] [REVIEW: security] [REVIEW: accessibility] [REVIEW: procurement]. `[APPROVED]` count in this document: **0** (no named approver is recorded in `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` for any customer-facing wording) |
| Audience | **Internal.** The customer-safe derivative is [`SEMESTER_MASTER_GTM_PLAYBOOK_CUSTOMER_SAFE.md`](SEMESTER_MASTER_GTM_PLAYBOOK_CUSTOMER_SAFE.md) |
| Companion documents | [`SEMESTER_90_DAY_GTM_PLAN.md`](SEMESTER_90_DAY_GTM_PLAN.md) (section J detail), [`SEMESTER_GTM_KPI_TREE.md`](SEMESTER_GTM_KPI_TREE.md) (section I detail) |

> This is an operating document. It is not legal, tax, accounting, insurance, privacy, security or accessibility advice, and it states no conclusion in any of those fields. Every `[REVIEW: ...]` flag needs the named professional before anyone relies on the row. All prices, rates, targets and dates below are labelled planning assumptions.

Label legend. `[VERIFIED]` a repository path or evidence id follows and proves it. `[ASSUMPTION]` planning number, rate, price, date or target; never a quote or commitment. `[DRAFT]` new content awaiting review (the default). `[INTERNAL]` never send to a customer or prospect as-is. `[APPROVED]` customer-facing claim with a named approver and register row (none exist).

## Relationship to existing artifacts

The repository already holds a large, controlled commercial package. This playbook does not replace it. It is the single entry point that says what to read, which source wins when two disagree, and what the founder's brief requires that no existing document contains.

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`docs/INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md) | Institutional sales stages, gates, buying committee, "never said in a sale" | One page per system (marketing, student adoption, CS, finance, KPI) wrapped around it; the launch wedge name; the two-engine model | It is institution-only and describes `stages.ts`; it has no marketing, student or finance system |
| [`docs/gtm/EXECUTION-PLAN.md`](../../gtm/EXECUTION-PLAN.md) | Which GTM rules are code (`campaign.ts`, `messaging.ts`, `utm.ts`, `kpi.ts`, `pilot.ts`, `sponsor.ts`), tables, backlog | Pointers only; the code-enforced rules are cited, not restated | It is a status page for an outside plan, not an operating playbook |
| [`docs/gtm/GROWTH-OPERATING-PLAN.md`](../../gtm/GROWTH-OPERATING-PLAN.md) and [`BRAND-AND-MARKETING-STRATEGY.md`](../../gtm/BRAND-AND-MARKETING-STRATEGY.md) | Funnel, activation, lifecycle, notification policy, ambassadors, experiments, dashboards, brand, website IA, 12-week calendar, claims table (M-01..M-36) | Channel-by-channel plan keyed to the user's brief (LinkedIn/YouTube/Instagram/TikTok/Facebook/webinar/SEO), paid-media validation gates, section-E calendar with owner and KPI per week | Those are controlled, long and student/brand centred; the brief asks for one institutional-and-student plan with explicit validation gates |
| [`docs/commercial/`](../../commercial/README.md) (ICP, segmentation, personas, motions, positioning, competitive, sales playbook, scoring, funnel, launch campaign, content, partner, claims library, student onboarding, analytics dictionary, RevOps dashboard, collateral/handoff, health score, renewal, pilot offer/scorecard) | The controlled hypotheses for every section below | A reading order, the conflict list, and the delta per section | They are 30-120 line single-topic controls; none ties the topics into one motion with owners and gates |
| [`docs/market-readiness/`](../../market-readiness/90-DAY-MARKET-READINESS-PLAN.md) (90-day plan, first-10 targeting, first-1,000 students, content/channel, ambassador, campus kit, email lifecycle, advertising policy, metric dictionary) | The 13-week plan, targeting filters, student adoption gates, policies | Reconciliation (section J) and the paid-media gates | `docs/commercial/` is canonical over same-named `market-readiness` files (D-1160); this links, not copies |
| [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md), [`30-60-90-DAY-EXECUTION-PLAN.md`](../../../30-60-90-DAY-EXECUTION-PLAN.md), [`docs/90-DAY-LAUNCH-PROGRAM.md`](../../90-DAY-LAUNCH-PROGRAM.md) | The gate boundary; the evidence-gated 30-60-90; 24 coded launch tasks | A commercial 30/60/90 that sits *inside* the go/no-go boundary ([`SEMESTER_90_DAY_GTM_PLAN.md`](SEMESTER_90_DAY_GTM_PLAN.md)) | The three plans disagree on when a pilot is signed; see J.4 |
| [`docs/finance/`](../../finance/README.md) | 36-month workbook, scenarios, gates, hiring | Formulas and the GTM-to-model driver list only; no model output | Finance is canonical for numbers; this playbook must not fork them |
| [`app/src/lib/gtm/*.ts`](../../../app/src/lib/gtm/stages.ts) | Stage ids, exit gates, KPI formulas, pilot rules, social pillars, consent decisions | Exact ids reused; deltas stated in I and in the KPI tree | Code is the highest authority; documents follow it |
| Existing vs missing | [`docs/business/INVENTORY.md`](../INVENTORY.md) (written by the lead) | Pointer in "Existing vs missing" below | One inventory, not one per author |

Authority order used whenever sources disagree: code and tests (`app/src/lib/gtm/*.ts`, `app/src/lib/governance/*`, `app/src/lib/ops/claims.ts`) > [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) and [`EVIDENCE-REGISTER.md`](../../../EVIDENCE-REGISTER.md) > `GO-NO-GO-DECISION.md` > `docs/commercial/` > `docs/finance/` > `docs/market-readiness/` > the founder's brief and uploaded planning PDFs (planning input, not evidence). [VERIFIED] [`docs/commercial/README.md`](../../commercial/README.md) and D-1160 record the commercial-over-market-readiness rule.

## Gate

The authoritative gate statement is the box in A.0. Everything in this playbook is sequenced inside it: sections that describe a price quote, order form, invoice, payment, live data, tenant activation, annual conversion, case study, reference or logo describe a **held** step, not a current one.

---

## A. Executive summary [DRAFT] [INTERNAL]

### A.0 WHAT THE GO/NO-GO ALLOWS TODAY [VERIFIED] `GO-NO-GO-DECISION.md` (2026-10-03)

> **WHAT THE GO/NO-GO ALLOWS TODAY**
>
> | Motion | Decision | May do now | Must not do |
> | --- | --- | --- | --- |
> | Individual student acquisition | **CONDITIONAL GO / YELLOW** | Prepare invitation-only, **unpaid** validation; activate a bounded cohort only after every applicable gate is evidenced | Broad or paid promotion, unsupported outcome claims, treating repository flows as a staffed service |
> | Design-partner institutional pilot | **GO / GREEN for non-activation engagement only** | Discovery, **synthetic** demos, evidence exchange, fit/limitation review, conditional scoping | Live customer data, tenant activation, customer/logo claims, production integrations, a launch promise |
> | **Paid institutional pilot** | **NO-GO / RED** | Remediation and procurement preparation | **Accepting payment**, an unconditional launch obligation, activating live data |
> | Broad institutional enterprise sale | **NO-GO / RED** | Long-range qualification and learning, limitations disclosed | GA / enterprise / system-replacement positioning, scale or assurance claims, broad contracting |
>
> Held until a named gate flips: price quote, order form, invoice, payment, live data, activation, annual conversion, case study, reference, logo. Ten blocking items (independent security assessment, accessibility review, counsel-approved paper, entity/tax/insurance authority, staffed support, restore/rollback exercises, named customer scope, baselines, repeatability, immutable candidate) are listed in `GO-NO-GO-DECISION.md`; the nine that block a paid pilot are carried into the 90-day plan as the P0 list. Conditions are gates, not a schedule promise; a conflict resolves to the more conservative boundary.

### A.1 Commercial thesis [DRAFT]

Semester is a student-controlled academic planning and action layer (public descriptor "student action platform", D-1148; not "Student OS", which implies replacement and is blocked by CLM-006). The commercial thesis has two parts:

1. **Institutions buy a narrow, measurable outcome, not a platform.** A bounded cohort, one milestone (registration readiness / term start), named owners, written success criteria and a written decision date lets a sponsor make a defensible purchase. A pilot that ends in a signed decision, not an indefinite trial, is the unit of sale. [VERIFIED] `PilotPlan` and `pilotVerdict` in [`app/src/lib/gtm/pilot.ts`](../../../app/src/lib/gtm/pilot.ts).
2. **Students decide whether the institution's purchase works.** Usage that comes from immediate usefulness (activation, a first meaningful action, repeat weekly use) is the evidence that justifies renewal. Student value without an institutional sponsor is a validation channel, not a profit engine. [ASSUMPTION] the Finance model treats institutions as the revenue carrier and student acquisition as an adoption channel; see H.

Core company viability must not depend on advertising or marketplace revenue (H.5; [`ADVERTISING-AND-MONETIZATION-POLICY.md`](../../market-readiness/ADVERTISING-AND-MONETIZATION-POLICY.md)).

### A.2 Initial launch wedge: "Semester Registration Readiness Pilot" [DRAFT]

Working name in the repository is "Semester Student Success and Registration Readiness Pilot" ([`PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md)); this playbook shortens it to the founder's name, "Semester Registration Readiness Pilot". The offer remains a **conditional design-partner concept** until the paid-pilot gate flips.

| Element | Content | Label |
| --- | --- | --- |
| Buyers | Student Success, Advising, Registrar, Student Affairs, academic department leadership, a program or cohort owner | [DRAFT] |
| Core problem (institution) | Staff work across fragmented systems, manual reminders and spreadsheets, with little visibility into where students are blocked | [DRAFT] hypothesis, not yet confirmed in a named discovery call |
| Core problem (student) | Students lack clarity about requirements, deadlines, planning, registration actions, support options and next steps | [DRAFT] hypothesis; consistent with CLM-001 product description |
| Scope | One cohort, one workflow, manual or approved read-only inputs, limited integrations, named executive sponsor and operational champion, written success criteria, written annual conversion decision date | [VERIFIED] `pilotReadiness` in `pilot.ts`; [`PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) |
| Cohort | 50-200 target; hard bounds 10-200 | [VERIFIED] `docs/PAID-PILOT-FRAMEWORK.md`; [ASSUMPTION] 50-200 as target |
| Duration | **OPEN DECISION.** Code enforces `PILOT_WEEKS = 26` (D-134); the founder's planning assumption is one term or 8-12 weeks. See A.7 and open decisions | [VERIFIED] 26 in `pilot.ts`; [ASSUMPTION] 8-12 weeks |
| Primary pilot metrics | activation; first meaningful action; workflow completion; weekly active use; staff time / support-friction reduction; student confidence / satisfaction; support issue reduction; pilot-to-annual conversion readiness | [DRAFT]; definitions in the KPI tree. Staff-time and satisfaction are self-reported and non-causal |
| Not in scope | System-of-record replacement; official registration decisions; individual risk scoring; SIS/LMS write; health, disability, conduct, aid, counseling, immigration data | [VERIFIED] [`IDEAL-CUSTOMER-PROFILE.md`](../../commercial/IDEAL-CUSTOMER-PROFILE.md), CLM-006 |
| Delta vs `PILOT-OFFER.md` | Adds the founder's staff-time and satisfaction metrics and the named conversion-readiness metric; keeps all exclusions | [DRAFT] |

### A.3 Customer segments [DRAFT]

Ranked by [`MARKET-SEGMENTATION.md`](../../commercial/MARKET-SEGMENTATION.md) (a hypothesis, not a measured order): (1) private/regional four-year program or student-success unit; (2) honors, learning community, first-year/transfer or advising-priority program; (3) college/department advising unit; (4) individual students (invitation beta); defer broad institution/enterprise and K-12 beyond discovery (`mayTakeDistrictData()` is false in `app/src/lib/k12/edition.ts`). Detail in section B.

### A.4 The two-engine model [DRAFT]

| | Engine 1: Institutional B2B | Engine 2: Student adoption |
| --- | --- | --- |
| Motion | narrow measurable paid pilot (held; today design-partner engagement) -> annual agreement -> expansion | immediate utility -> activation -> first meaningful action -> workflow completion -> weekly use -> satisfaction -> retention |
| Buyer / decider | sponsor + committee | the student |
| Output | signed decision; annual scope | measured outcomes that become proof for renewal |
| Entry gate today | non-activation discovery, synthetic demo, conditional scoping | invitation-only, unpaid validation (conditional) |
| Failure to avoid | selling a "platform" or a replacement of the SIS/LMS/registrar | optimizing time-in-app, streaks, sign-ups |
| System of record | `gtm_*` tables (D-1154 item 6: the one CRM) [VERIFIED] `docs/decisions/D-1154.md` | activity marks per [`ANALYTICS.md`](../../../ANALYTICS.md); proposed events per [`GROWTH-FUNNEL-SPEC.md`](../../commercial/GROWTH-FUNNEL-SPEC.md) |

The engines connect at one point: cohort-level, privacy-thresholded student outcomes (n >= 10) are the evidence in the institution's weekly report, midpoint review and annual-conversion decision. Student-level data never enters a pipeline table ([`INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md)). Semester is **not** sold as a total replacement of every university system.

### A.5 Why paid pilots lead to annual contracts [ASSUMPTION] [REVIEW: counsel] [REVIEW: tax]

1. A paid pilot forces a named sponsor, budget line and written decision date, which a free trial does not; a pilot with no price is the failure `pilotReadiness` refuses (`annualPriceAgreed`).
2. The pilot's cost is pre-agreed as creditable or not toward the annual term (a pilot credit, if approved, defines eligible software fees and expires on the decision date; [`PRICING-AND-PACKAGING.md`](../../commercial/PRICING-AND-PACKAGING.md)).
3. The conversion decision is dated before launch, so the final report and the midpoint review are inputs to a decision that already has an owner ([`RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md), [`docs/PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md)).
4. Pilot-to-annual conversion rate is assumed at a Finance-model input, not an observed rate. Do not quote it. **Today no pilot, paid or unpaid, has run**, so this is an untested thesis.

### A.6 Major commercial risks and mitigations [INTERNAL] [DRAFT]

| # | Risk | Mitigation | Owner |
| --- | --- | --- | --- |
| R1 | Paid pilot blocked by go/no-go items 1-9 (security assessment, accessibility, counsel paper, entity/tax/insurance, staffing, restore/rollback, named scope, baselines) | Treat as P0 in the 90-day plan; sell only design-partner discovery now; no payment accepted | Harrison Rubin |
| R2 | Single point of failure: founder is owner of sales, product, support, security, privacy, claims, finance | Backup seats named before any activation (go/no-go priority 6); [`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../../OWNER-AND-ACCOUNTABILITY-MATRIX.md) | Harrison Rubin |
| R3 | Overclaiming (compliance, outcomes, logos, integrations) in a market where buyers have seen five vendors overclaim | Every public sentence maps to a CLM row; default is do not publish; takedown owner ([`CLAIM-WITHDRAWAL-RUNBOOK.md`](../../CLAIM-WITHDRAWAL-RUNBOOK.md)) | Claims owner (founder, interim) |
| R4 | Pilot length, student price and institutional pricing unit unresolved | Open-decision table; quotes carry `[PRICE TO BE CONFIRMED]` | Founder |
| R5 | No baseline, no measured outcome: renewal evidence cannot be produced | Baseline frozen before launch (priority 9); metrics in the pilot scorecard | Product / Success |
| R6 | Student acquisition becomes the business (CAC exceeds LTV in the Finance model's student rows) | Student channel capped and treated as adoption; no paid scale until gates in E.9 | Founder / Finance |
| R7 | Long institutional procurement outlasts runway | Finance scenarios and gates; sales-cycle measured as first-order KPI | Founder |
| R8 | Support or implementation capacity exceeded by first pilot | Cohort cap 200; capacity cap of three active pursuits ([`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)) | Founder |
| R9 | Student data enters a sales/marketing system | `gtm_*` rule: contacts hold role and work address only; suppression below ten | Privacy owner (unassigned) |
| R10 | Competitor or platform vendor ships equivalent planning | Differentiate on source labels, student agency, manual path, evidence-bounded proof; refresh [`COMPETITIVE-POSITIONING.md`](../../commercial/COMPETITIVE-POSITIONING.md) dated sources | Founder |

### A.7 Pilot-length conflict [VERIFIED] flagged open decision

| Source | Value |
| --- | --- |
| `PILOT_WEEKS = 26`, `pilotReadiness` flags `duration` unless the days equal 182 | [VERIFIED] [`app/src/lib/gtm/pilot.ts`](../../../app/src/lib/gtm/pilot.ts), D-134, [`docs/PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md) |
| Deal desk outer limit 6 months | [VERIFIED] `governance/deal-desk.ts`, [`PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md) |
| Founder planning assumption: one academic term or 8-12 weeks | [ASSUMPTION] |

Treatment in this playbook: the 8-12 week figure is used as the planning assumption for the sales motion and model timing; the 26-week figure is the code-enforced rule and the only value `pilotReadiness` accepts. An 8-12 week pilot would be reported as a `duration` problem today. The founder decides; the decision is recorded as `docs/decisions/D-<pull request number>.md` per `CLAUDE.md` (opened by the lead). Until decided, proposals state "[PILOT LENGTH TO BE CONFIRMED]".

---

## B. ICP and segmentation [DRAFT] [INTERNAL]

Canonical: [`IDEAL-CUSTOMER-PROFILE.md`](../../commercial/IDEAL-CUSTOMER-PROFILE.md), [`MARKET-SEGMENTATION.md`](../../commercial/MARKET-SEGMENTATION.md), [`BUYER-PERSONAS.md`](../../commercial/BUYER-PERSONAS.md), [`USER-PERSONAS.md`](../../commercial/USER-PERSONAS.md), [`SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md`](../../commercial/SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md). No institution is named in this document; none may be named without its permission (CLM-013). `[VERIFIED]` that the ICP is a **controlled hypothesis, not validated by a named customer** (`IDEAL-CUSTOMER-PROFILE.md` status line).

### B.1 Institutional ICP

| | Primary ICP | Secondary ICP |
| --- | --- | --- |
| Who | Private or regional four-year institution, school, program or student-success unit able to isolate one 50-200 cohort around a registration, orientation, transfer, first-term or advising milestone | Honors / learning community / first-year or transfer program; college or department advising unit |
| Must have | concrete planning/readiness problem; empowered sponsor and operational champion; named IT/security/privacy/accessibility contacts; manual or read-only scope; minimum-necessary low-risk data; 3-5 leading indicators and guardrails; weekly review and a decision date; clean offboarding | same, with lighter integration expectations |
| Disqualify | immediate SIS/LMS replacement; official writeback; authoritative degree audit; institution-wide entry launch; unsupported certification/SLA; 24/7 support; causal outcome guarantee; individual risk scoring; health/disability/conduct/counseling/immigration/aid/discipline data | same |
| Label | [VERIFIED] `IDEAL-CUSTOMER-PROFILE.md` | [VERIFIED] `MARKET-SEGMENTATION.md` priorities 2-3 |

Delta: the founder's wedge lists "academic department leadership" as a buyer; the repository ranks the department-led motion second ([`SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md`](../../commercial/SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md)) and requires the same data-flow, privacy, accessibility and procurement review at any price. [DRAFT]

### B.2 Student and user segments [DRAFT]

| Segment | Core job | Entry | Boundary |
| --- | --- | --- | --- |
| New student (first-year, first-term) | turn limited course context into one trustworthy next action | orientation, advisor, QR | no fabricated institutional record |
| Continuing / transfer student | organize deadlines, workload, registration prep | advisor, use-case page | no eligibility or degree-audit authority claim |
| Student using assistive technology | complete every critical task with equivalent access | accessible quick-start | automated checks are not proof (CLM-008) |
| Advisor / program operator | review student-approved context, run a cohort | workshop | no risk ranking, no private-note overreach |
| Faculty / course owner | approve limited course/source context | peer demo | no universal workflow claim |
| Guardian | none marketed | only on a student-initiated invite | no guardian acquisition funnel |
| Ambassador | credible bounded campus role | application | no peer-data access |

Segment by problem, milestone, cohort, authority, data risk, integration requirement, buying path and ability to run a reversible proof, never by inferred vulnerability, protected class or academic risk. [VERIFIED] `MARKET-SEGMENTATION.md`.

### B.3 Buyer, champion, technical, procurement and end-user maps [DRAFT]

| Role in committee | Typical title (confirm in discovery) | Decides / does | Evidence they ask for | Source |
| --- | --- | --- | --- | --- |
| Economic buyer / executive sponsor | provost office, VP Student Success/Affairs, dean | authorizes bounded outcome, budget, stop/expand | charter, scorecard, cost, decision date | [`BUYER-PERSONAS.md`](../../commercial/BUYER-PERSONAS.md) |
| Champion | student-success/advising leader, registrar-adjacent lead | runs the workflow, owns weekly review | journey UAT, first-win evidence, support and guardrails | `BUYER-PERSONAS.md` |
| Operational champion (pilot) | program coordinator | setup, training, support, offboarding | runbooks, escalation | `BUYER-PERSONAS.md` |
| Technical buyer | CIO / IT / identity | architecture, identity, integration | data-flow, roles/isolation, monitoring, recovery | `BUYER-PERSONAS.md` |
| Security / privacy | CISO, privacy officer, registrar (FERPA) | purpose, access, retention, incident, rights | target tests, subprocessors, lifecycle, incident evidence | [`docs/trust/`](../../trust/README.md) |
| Accessibility | disability services / accessibility lead | accessibility review | testing evidence and limits, no conformance claim | CLM-007, CLM-008 |
| Procurement / legal | purchasing, counsel | paper, DPA, insurance, service terms | counsel-approved terms and attachments | [`BUDGET-AND-PURCHASING-PATH.md`](../../commercial/BUDGET-AND-PURCHASING-PATH.md) |
| End users | students, advisors | use it | usability, agency, privacy | [`USER-PERSONAS.md`](../../commercial/USER-PERSONAS.md) |
| Administrator | institution admin | tenant, roles, policy | least privilege, readback, audit | `USER-PERSONAS.md` |
| AI policy owner | where the pilot uses AI features | AI use approval | CLM-011 evidence | [`INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md) |

Map all of these before `outcome_workshop` (`SALES_EXIT.outcome_workshop` requires IT, privacy, accessibility and academic sponsor). Record actual person, authority, objection, evidence request and decision process; personas are interview hypotheses, never demographic stereotypes.

### B.4 Account scoring model [ASSUMPTION] [VERIFIED structure] 

Canonical: [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md). Two 0-20 scores, ten 0-2 criteria each, therefore **equal weight (max 2 points per criterion)**; bands, the 90-day staleness window and the two-business-day inbound response target are explicitly **proposed and uncalibrated**.

| Score | Question | Criteria (0-2 each) | When |
| --- | --- | --- | --- |
| Target score | Which accounts do we approach first? | urgent milestone; 50-200 cohort fit; champion access; economic buyer; procurement feasibility; manual/read-only fit; timing; evidence value; implementation capacity; reference potential | at `target_account` |
| Qualification score | Real enough to spend delivery effort on? | urgent milestone; defined cohort; empowered champion; economic buyer; security/privacy/accessibility contacts; budget/procurement path; 30-60 day implementation feasibility; manual/read-only fit; measurable baseline/outcome; conversion decision date | from `discovery`, to enter `qualified` |

| Band [ASSUMPTION] | Target score action | Qualification score action |
| --- | --- | --- |
| 16-20 (Tier A) | pursue, within capacity cap of three active pursuits | qualified, subject to red flags |
| 11-15 (Tier B) | discovery only if capacity; record the gap | hold or nurture |
| 0-10 (Tier C) | hold; record reason and future-contact rule | disqualify or revisit |

Automatic disqualifiers override any total: prohibited high-impact AI; surveillance or individual risk scoring; unsupported compliance/certification requirement; required SIS/LMS write before approval; no lawful data authority; no champion; demand to waive P0/P1; economics below delivery and support cost. Every point cites a dated observation; never infer from institution type, size or prestige. "Reference potential" orders who to approach and never appears in a customer-facing document (CLM-013). [VERIFIED] `ACCOUNT-SCORING-AND-FORECAST.md`.

---

## C. Positioning and messaging [DRAFT] [INTERNAL]

Canonical: [`POSITIONING-AND-MESSAGING.md`](../../commercial/POSITIONING-AND-MESSAGING.md), [`PRODUCT-MARKETING-CLAIMS-LIBRARY.md`](../../commercial/PRODUCT-MARKETING-CLAIMS-LIBRARY.md), [`BRAND-AND-MARKETING-STRATEGY.md`](../../gtm/BRAND-AND-MARKETING-STRATEGY.md) sections 1-2 and 8, [`COMPETITIVE-POSITIONING.md`](../../commercial/COMPETITIVE-POSITIONING.md), [`MARKET-POSITION.md`](../../../MARKET-POSITION.md), [`COMPETITION.md`](../../../COMPETITION.md) (the last two are code-checked reviews of outside documents; use them for competitor context only after re-verifying dated facts).

### C.1 Category and positioning [DRAFT]

- **Category.** "Student action platform" (D-1148, [VERIFIED] `docs/decisions/D-1148.md`). Not an approved claim; each exact use still needs a register row.
- **Positioning statement (internal).** For a student holding a term together across a syllabus PDF, a portal, a calendar, an inbox and an advisor, Semester is the student-held place where those become one plan and one next step. For an institution, the initial design-partner concept is one bounded registration-readiness or term-start workflow beside existing systems, not a replacement for the SIS, LMS, advising judgment or official record. [VERIFIED] `POSITIONING-AND-MESSAGING.md`, `BRAND-AND-MARKETING-STRATEGY.md` 1.1.

### C.2 Messaging architecture [DRAFT]

| Layer | Message | Proof allowed today | Never |
| --- | --- | --- | --- |
| Umbrella | A clear next step for the semester, with the source shown | CLM-001, CLM-018 (scoped) | outcome promises, "replaces", "only", "best" |
| Institution wedge | One bounded cohort, manual or approved read-only data, named owners, a decision date, a clean exit | CLM-004 (conditional), pilot rules in code | "paid pilot" in public copy; retention/GPA claims (CLM-014) |
| Trust | Show the work, name the gaps | CLM-009 (repository-tested), the "Not yet in place" list | "secure", "compliant", "certified", "FERPA compliant" (CLM-010) |
| Student | Upload your syllabus, check the dates, keep what is right, see what is due next | CLM-001, CLM-003 | "free forever", "unlimited AI", streak or fear copy |

### C.3 Persona messages [DRAFT]

| Persona | Message | Claim ids | Channel |
| --- | --- | --- | --- |
| Executive sponsor | A bounded outcome with a decision date and a way out | CLM-004 | discovery conversation, written scope |
| Student-success / advising leader | Less manual reminding, more visibility into where students are blocked, without student surveillance | CLM-004 | discovery, demo |
| Registrar / registrar-adjacent | Sits beside your systems; source and freshness are labelled; official system remains the record | CLM-004, CLM-006 (do not say replaces), CLM-018 | discovery, demo |
| IT / security / privacy | Additive, least-privilege, tenant-scoped, honest about what is not yet independently assured | CLM-009 | trust room under NDA |
| Procurement / legal | Drafts and issue lists exist for counsel; none is executed | CLM-009, CLM-015 (no price) | trust room |
| Student | One place for your semester and a clear next step | CLM-001, CLM-003 | invitation only |
| Advisor / faculty | Students arrive with a clearer plan and better questions; you stay the authority | CLM-001 | peer demo, synthetic |

### C.4 Value proposition matrix [DRAFT] (hypotheses to test; none measured)

| Stakeholder | Pain | Capability (exercised in repository) | Value hypothesis | Measure in pilot | Proof required before claiming |
| --- | --- | --- | --- | --- | --- |
| Student | fragmented sources; unclear next step | Today / This Week, syllabus check-before-keep, source labels, export/delete | clearer next step, less setup friction | activation, first meaningful action, weekly use | frozen-denominator cohort data (CLM-014 gate) |
| Advisor / student-success staff | manual reminders; no view of where students are blocked | cohort aggregate review (n >= 10), readiness checklist (non-authoritative) | less manual follow-up; earlier visibility of aggregate blockers | staff time estimate; support-issue count | baseline and complete denominators |
| Registrar | repeated how-do-I questions | registration checklist, official-system handoff | fewer repeat questions | support issue count by category | support system with staffed hours |
| Sponsor | no defensible measure | pilot scorecard, midpoint review, final report | decision made on evidence | conversion readiness | signed baseline and decision record |
| IT / security | new vendor risk | RLS counts, control facts, subprocessor register | reviewable evidence | review cycle time | target-environment evidence (priority 2, 7) |

### C.5 Differentiators [DRAFT]

Source and freshness shown on a fact (CLM-018, scoped); one planning/action loop; manual and non-AI paths; student agency and export/delete; refusal to create individual risk scores; evidence-bounded institutional proof. Compare workflows and boundaries, not feature counts; no superiority or price comparisons ([`COMPETITIVE-POSITIONING.md`](../../commercial/COMPETITIVE-POSITIONING.md) prohibited claims).

### C.6 Proof requirements [DRAFT]

| Proof | Required before | Where it lives | Status |
| --- | --- | --- | --- |
| Synthetic demo recording with captions | any demo-request path | demo scripts ([`DEMO-SCRIPT-EXECUTIVE.md`](../../commercial/DEMO-SCRIPT-EXECUTIVE.md), [`DEMO-SCRIPT-OPERATIONAL.md`](../../commercial/DEMO-SCRIPT-OPERATIONAL.md), [`DEMO-SCRIPT-TECHNICAL.md`](../../commercial/DEMO-SCRIPT-TECHNICAL.md)) | scripts exist; recording absent |
| Independent security assessment | paid / broad | priority 2 | absent |
| Accessibility review and ACR position | any public conformance language | priority 3 | absent |
| Counsel-approved pilot paper | any order form | priority 4 | drafts only ([`docs/legal-drafts/`](../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md)) |
| Signed baseline and measured pilot | any outcome claim | priority 9 | absent |
| Written customer permission | any logo, quote, case study | CLM-013 | absent |

### C.7 Objection themes [DRAFT]

Themes: "Is this replacing our SIS/LMS?" (no; beside, CLM-004/006); "Is it secure / FERPA compliant / SOC 2?" (no independent assurance exists; show repository-tested controls and the gap list; CLM-010); "Will it surveil students?" (no individual risk score; aggregate n >= 10); "What about accessibility?" (automated guards and a manual test plan; no conformance claim; CLM-007/008); "What does it cost / what is the ROI?" (no approved price; no ROI; CLM-014/015); "Who else uses it?" (no customers or logos; CLM-013); "Does it integrate with Banner/Workday/Canvas?" (no live integration; CLM-005); "Is the AI safe?" (feature-scoped, disclosed, human or non-AI path; CLM-011/012); "What if you disappear / one-person company?" (offboarding, export, backup owners as launch gates). Full scripted responses: [`docs/business/sales/OBJECTION_HANDLING_LIBRARY.md`](../sales/OBJECTION_HANDLING_LIBRARY.md) (written in parallel by a colleague; linked by path). Earlier posture: [`docs/market-readiness/OBJECTION-HANDLING.md`](../../market-readiness/OBJECTION-HANDLING.md).

### C.8 Claims substantiation register [VERIFIED] classifications from `PUBLIC-CLAIMS-APPROVAL-REGISTER.md`

Approval state for every row: **no named approver recorded; not approved for any channel**. "Allowed channel" below means the channel the register's own wording permits *if and when* the required reviewers approve; today only internal and controlled-demo use applies.

| Claim (condensed) | CLM id | Register classification | Evidence | Allowed channel (when approved) | Status |
| --- | --- | --- | --- | --- | --- |
| Academic planning and productivity experience | CLM-001 | VERIFIED - REPOSITORY | local product paths, golden journey | controlled demo, internal | [DRAFT] no named approver |
| Local-first with optional account sync | CLM-002 | CONDITIONAL | device persistence/export; sync not rerun against target | target-qualified discovery | [DRAFT] |
| Private / invitation-based validation | CLM-003 | VERIFIED - STATUS | `GO-NO-GO-DECISION.md` | invitation materials after audience approval | [DRAFT] |
| Works alongside existing systems in a bounded pilot | CLM-004 | CONDITIONAL / PROPOSED OFFER | pilot templates; no customer | non-activation scoping with prominent conditions | [DRAFT] |
| SSO/SCIM/LTI/OneRoster/SIS availability | CLM-005 | CONDITIONAL; PROHIBITED as availability | no live connector | none | prohibited |
| Replaces LMS/SIS/registrar | CLM-006 | PROHIBITED | n/a | none | prohibited |
| Automated accessibility guards and selected browser checks | CLM-007 | VERIFIED - REPOSITORY | six-route local scope | technical statement after Accessibility approval | [DRAFT] |
| WCAG / VPAT / ACR / universal accessibility | CLM-008 | PROHIBITED | no qualified assessment | none | prohibited |
| Repository-tested security, privacy, authorization, lifecycle controls | CLM-009 | VERIFIED - REPOSITORY | [`CONTROL-FACTS.md`](../../trust/CONTROL-FACTS.md), [`EVIDENCE-REGISTER.md`](../../../EVIDENCE-REGISTER.md) | exact technical audience; trust room | [DRAFT] |
| Secure / compliant / pen-tested / SOC 2 / FERPA / HECVAT approved | CLM-010 | PROHIBITED | none exists | none | prohibited |
| Assistive AI with human review and bounded controls | CLM-011 | CONDITIONAL | code/policy/kill-switch evidence | feature-specific after review | [DRAFT] |
| AI always accurate / private / non-training | CLM-012 | PROHIBITED | none | none | prohibited |
| Named institution, logo, quote, pilot, case study | CLM-013 | PROHIBITED TODAY | none | none | prohibited |
| GPA, retention, time-saved, ROI outcomes | CLM-014 | PROHIBITED TODAY | no baseline or result | none | prohibited |
| Price, discount, savings, paid-plan availability | CLM-015 | PROHIBITED / `[PRICE TO BE CONFIRMED]` | no approved price book | none; placeholders only | prohibited |
| Uptime, RTO/RPO, 24/7 support, SLA | CLM-016 | PROHIBITED TODAY | none | none | prohibited |
| Roadmap capability or date | CLM-017 | ROADMAP | hypothesis | non-binding, no dates | [DRAFT] |
| Source label says where a fact came from (scoped wording) | CLM-018 | VERIFIED - REPOSITORY (scoped); PROPOSED | [`docs/CLM-018-SOURCE-LABEL-EVIDENCE.md`](../../CLM-018-SOURCE-LABEL-EVIDENCE.md) | scoped wording only | [DRAFT] unscoped wording unsupported |

Rule: "approved" in this playbook means a named approver is recorded in the register. If a sentence is not in this table, it is not publishable. The customer-safe derivative uses only rows CLM-001..004, 007, 009, 011, 017, 018 and only with conditional wording.

---

## D. Sales system [DRAFT] [INTERNAL]

Canonical: [`SALES-PLAYBOOK.md`](../../commercial/SALES-PLAYBOOK.md), [`SALES-PIPELINE-DEFINITIONS.md`](../../commercial/SALES-PIPELINE-DEFINITIONS.md), [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md), [`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md), [`CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md), [`app/src/lib/gtm/stages.ts`](../../../app/src/lib/gtm/stages.ts).

**Gate.** Now: discovery, synthetic demos, evidence exchange, non-binding scoping. **Held** until the named gate flips: price quote, order form, invoice, payment, live data, activation, annual conversion, case study, reference, logo.

### D.1 Target-account strategy [DRAFT]

Build the list only from real warm paths or explicit observed needs; never fabricate a relationship ([`FIRST-10-INSTITUTIONS-TARGETING-PLAN.md`](../../market-readiness/FIRST-10-INSTITUTIONS-TARGETING-PLAN.md)). First ten across: first-year/transfer success, advising/programs, registration/enrollment, honors/learning communities, regional/private institutions with shorter paths. Pursue the top three target scores at a time until delivery capacity is measured on a real pilot. A student introduction opens a `target_account` with source = introduction; Semester never prospects an institution from its students' account data. [VERIFIED] `SEGMENT-MOTIONS-AND-BUYING-COMMITTEES.md`.

### D.2 100-account list [DRAFT]

The template, columns and dedupe rules live in [`docs/business/sales/CRM_PIPELINE_DEFINITION.md`](../sales/CRM_PIPELINE_DEFINITION.md) (colleague-owned; not duplicated here). This playbook's rules for the list: ten Tier-A candidates first, hundred-account list built over days 1-30 from warm path or public-need evidence only, no personal data beyond role and work address, `gtm_accounts` is the system of record (D-1154 item 6).

### D.3 Account scoring [VERIFIED] see B.4.

### D.4 Discovery script [DRAFT]

Full script: [`docs/business/sales/DISCOVERY_CALL_SCRIPT.md`](../sales/DISCOVERY_CALL_SCRIPT.md). Existing: [`DISCOVERY-CALL-SCRIPT.md`](../../commercial/DISCOVERY-CALL-SCRIPT.md), [`docs/market-readiness/DISCOVERY-CALL-PLAYBOOK.md`](../../market-readiness/DISCOVERY-CALL-PLAYBOOK.md). Summary: (1) the problem in their words and the milestone date; (2) the cohort and current workflow; (3) data and integration needs; (4) buying committee and procurement path; (5) disqualifier check; (6) agree a dated next step. Record the problem verbatim; exit requires an authorized stakeholder and a computed qualification score. Gate statement is read aloud at the start: "This conversation is exploratory and non-binding. We are not offering live data handling, activation or a price today."

### D.5 Qualification rubric [VERIFIED]

The ten-criterion 0-20 qualification score and disqualifiers in B.4. Enter `qualified` only with: a named champion, a stated problem in their words, a budget cycle and a decision process (`SALES_EXIT.qualified`).

### D.6 Demo script [DRAFT]

Existing: [`DEMO-SCRIPT-EXECUTIVE.md`](../../commercial/DEMO-SCRIPT-EXECUTIVE.md), [`DEMO-SCRIPT-OPERATIONAL.md`](../../commercial/DEMO-SCRIPT-OPERATIONAL.md), [`DEMO-SCRIPT-TECHNICAL.md`](../../commercial/DEMO-SCRIPT-TECHNICAL.md), [`docs/market-readiness/DEMO-PLAYBOOK.md`](../../market-readiness/DEMO-PLAYBOOK.md). Run of show (30 min) [ASSUMPTION]:

| Min | Segment | Rule |
| --- | --- | --- |
| 0-3 | Gate statement and what is on screen: synthetic data only, labelled available / pilot-dependent / planned | no real student data; no school named |
| 3-10 | Student journey: syllabus check, Today, source label, next action | show CLM-001/018 behavior, not outcomes |
| 10-16 | Staff view: aggregate cohort readiness (n >= 10), readiness checklist as non-authoritative | no individual risk score |
| 16-21 | Boundaries: official-system handoff, export/delete, accessibility approach (no conformance claim) | CLM-006/008 language |
| 21-27 | Each stakeholder's top objection and evidence request logged live | into `gtm_decision_log` |
| 27-30 | Dated next step: pilot design session or evidence exchange | no price, no launch date |

### D.7 Pilot design-session agenda [DRAFT]

(90 min, after `outcome_workshop`.) [ASSUMPTION] timings.

| Min | Item | Output |
| --- | --- | --- |
| 0-10 | Gate restatement; what this session can and cannot decide | shared understanding |
| 10-25 | Workflow and milestone selection (one) | named workflow |
| 25-40 | Cohort definition, eligibility, size, exclusions | cohort rule (10-200) |
| 40-55 | Success measures, baseline source, guardrails and stop conditions | draft scorecard ([`PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md)) |
| 55-65 | Data and integration scope: manual or approved read-only | data plan (minimum-necessary, source-labelled) |
| 65-75 | Roles: executive sponsor, operational champion, IT, privacy, accessibility, procurement | committee map |
| 75-85 | Timeline: pilot length (open decision), midpoint review, decision date | dated conversion decision |
| 85-90 | Recap, owners, next steps | Mutual Action Plan draft |

### D.8 Pilot proposal template [DRAFT] [REVIEW: counsel]

Template: [`docs/business/sales/PILOT_PROPOSAL_TEMPLATE.md`](../sales/PILOT_PROPOSAL_TEMPLATE.md). Existing basis: [`PILOT-PROPOSAL-TEMPLATE.md`](../../commercial/PILOT-PROPOSAL-TEMPLATE.md), [`INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md`](../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md). Under the current gate any proposal is **non-binding and conditional**: price `[PRICE TO BE CONFIRMED]`, dates `[PLACEHOLDER]`, terms "non-binding drafts pending counsel review".

### D.9 Mutual Action Plan [DRAFT]

Template: [`docs/business/sales/MUTUAL_ACTION_PLAN_TEMPLATE.md`](../sales/MUTUAL_ACTION_PLAN_TEMPLATE.md). Used from `outcome_workshop` on; lists dated owner actions for both parties through the decision date; never lists activation as a given.

### D.10 Procurement and security response process [DRAFT] [REVIEW: procurement] [REVIEW: security]

Link: `docs/business/compliance/` ([`../compliance/`](../compliance/), colleague-owned). Existing: [`RFP library`](../../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) (answers are code-bound: `rfp.test.ts` refuses an answer stronger than the claims register), [`HECVAT-EVIDENCE-MATRIX.md`](../../market-readiness/HECVAT-EVIDENCE-MATRIX.md), [`docs/trust/HECVAT-READINESS-MATRIX.md`](../../trust/HECVAT-READINESS-MATRIX.md), [`VENDOR-SECURITY-REVIEW-PROGRAM.md`](../../trust/VENDOR-SECURITY-REVIEW-PROGRAM.md), trust room (NDA first; expiring links; every open logged; [`docs/gtm/EXECUTION-PLAN.md`](../../gtm/EXECUTION-PLAN.md) "procurement room"). Process: intake in `gtm_decision_log` (category security/privacy/accessibility/legal) -> answer only from the RFP library with a label (implemented, pilot-scoped, planned, not applicable, customer responsibility, gap) -> owner and date for each exception -> record any SOC 2 / VPAT / pen-test requirement as accepted prerequisite or disqualifier. Never answer from memory. Security owner is unassigned (open decision).

### D.11 CRM pipeline [VERIFIED]

CRM = `gtm_*` tables (D-1154 item 6). Definition: [`docs/business/sales/CRM_PIPELINE_DEFINITION.md`](../sales/CRM_PIPELINE_DEFINITION.md), [`CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md), [`SALES-PIPELINE-DEFINITIONS.md`](../../commercial/SALES-PIPELINE-DEFINITIONS.md).

### D.12 Sales stages and exit criteria [VERIFIED] exact ids from `app/src/lib/gtm/stages.ts`

Account status mapping: `ACCOUNT_STATUS_OF`. Coded gate = `SALES_EXIT` (seven stages); the other nine are checklist-gated by [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md). Moves are forward-only; `closed_lost` reachable from anywhere and reopens only as a new `target_account`.

| # | Stage id | Account status | Exit evidence (coded `SALES_EXIT` text in quotes; else checklist) | Gate today |
| ---: | --- | --- | --- | --- |
| 1 | `target_account` | target | target score recorded with cited observations; no disqualifier; real warm path; owner | allowed |
| 2 | `discovery` | engaged | authorized stakeholder met; problem, milestone, cohort, data need, procurement path recorded; qualification score; dated next step | allowed |
| 3 | `qualified` | engaged | "A named champion, a stated problem in their words, a budget cycle and a decision process." | allowed |
| 4 | `multi_stakeholder_demo` | engaged | synthetic-only demo; attendee roles; top objection and evidence request logged | allowed |
| 5 | `outcome_workshop` | engaged | "The buying committee is mapped, including IT, privacy, accessibility and the academic sponsor." | allowed |
| 6 | `technical_review` | engaged | architecture questions answered from RFP library; integration stated manual/read-only | allowed (evidence exchange) |
| 7 | `security_privacy_accessibility_review` | engaged | questionnaire answered from RFP library and HECVAT matrix with labels; exceptions owned | allowed (evidence exchange) |
| 8 | `proposal` | engaged | "Security, privacy and accessibility review has started, answered from the RFP library, never from memory." | conditional, non-binding only |
| 9 | `pilot_or_implementation_SOW` | engaged | "A pilot plan with no readiness problems (pilotReadiness in #817)." | **held**: depends on pilot length decision; no signature |
| 10 | `procurement_legal` | engaged | proposal in formal review; redline register; deal-desk review no refusals | **held** (paid) |
| 11 | `contracted` | pilot | "Procurement and legal have signed; the deal desk review has no refusals." | **held** |
| 12 | `implementation` | pilot | handoff accepted; `pilotReadiness` clean; tenant in sandbox data mode | **held** |
| 13 | `live` | customer | "The launch council returned go for the first cohort." | **held** (activation) |
| 14 | `renewal` | customer | "The pilot has a signed, final verdict (pilotVerdict in #817) with outcomes measured." | **held** |
| 15 | `expansion` | customer | separately authorized scope; adjacent cohort has its own readiness and launch-council go | **held** |
| 16 | `closed_lost` | closed_lost | reason code, learning, future-contact rule | allowed |

### D.13 Forecasting method [VERIFIED method; no values]

From [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md): categories are defined by evidence (Commit = `procurement_legal` or later with a named signer; Best case = `proposal` or `pilot_or_implementation_SOW` with sponsor and budget cycle; Pipeline = `qualified` through `security_privacy_accessibility_review`; Omitted = `target_account`, `discovery`, stale). **Every stage probability is not approved and weighted pipeline is 0**; report counts and unweighted amounts. Report new, renewal, expansion and services separately; never double-count a pilot and its hypothetical annual conversion. No pipeline value, win rate or forecast is asserted anywhere in this playbook.

### D.14 Weekly pipeline review [DRAFT]

Weekly, 45 minutes, owner = founder: every commit/best-case opportunity against evidence; stale next actions; expired proposals; missing approvers; overdue decision-log items (`overdue()` in `pilot.ts`, highest risk first); new scores; capacity check (three active pursuits). Monthly: re-score tiers, review loss reasons. Output: updated `gtm_accounts` and a one-paragraph note. Agenda detail in the KPI tree meeting table.

### D.15 Pilot-to-annual conversion process [DRAFT] [REVIEW: counsel] [REVIEW: tax]

Canonical: [`docs/PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md), [`RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md). Steps: (1) the decision date is written into the scope before launch; (2) weekly report from week 1; (3) midpoint executive review; (4) pre-decision reconciliation (contract notice dates, decision authority, evidence, capacity, approved price method); (5) final value report with missingness and caveats; (6) signed verdict (`pilotVerdict`: convert, expand, pause, stop; an extension is not a verdict); (7) annual paper only through counsel-approved terms and the deal desk. A pilot is **not complete** until activation, workflow completion, outcome measurement, executive review and conversion decision are all recorded.

### D.16 Expansion and reference process [DRAFT]

Expansion is adjacent: another cohort, program or approved read-only source, each with its own readiness check and launch-council go; it enters the forecast only after a signed convert/expand verdict. Reference: considered only after accepted scope, no unresolved P0/P1 and a signed permission record ([`CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md)); participation is separate from price, support and renewal; a discount never buys a statement. No reference exists (CLM-013).

---

## E. Marketing system [DRAFT] [INTERNAL]

Canonical: [`BRAND-AND-MARKETING-STRATEGY.md`](../../gtm/BRAND-AND-MARKETING-STRATEGY.md) (sections 4, 5), [`GROWTH-OPERATING-PLAN.md`](../../gtm/GROWTH-OPERATING-PLAN.md), [`CONTENT-AND-COMMUNITY-PLAN.md`](../../commercial/CONTENT-AND-COMMUNITY-PLAN.md), [`LAUNCH-CAMPAIGN-PLAN.md`](../../commercial/LAUNCH-CAMPAIGN-PLAN.md), [`app/src/lib/gtm/social.ts`](../../../app/src/lib/gtm/social.ts) (ten pillars, seven platforms, three funnels held to routes that exist), `campaign.ts` (activation gate), `messaging.ts` (consent), `utm.ts`.

**Gate.** Allowed: preparation, closed rehearsal on synthetic data, bounded non-activation discovery content. Held: broad or paid launch, any customer/outcome/price claim. All content stays inside the claims register (section C.8); `campaign.ts` `activationGate` refuses a campaign without consent requirements, owner != approver, privacy/accessibility/brand reviews, frequency cap, tested opt-out and substantiated claims.

### E.1 Website strategy [DRAFT]

Do not rebuild the site (116 sitemap URLs reviewed at 320px and 1440px per the brand strategy). Work is audience routing and truth at the point of claim. Route by audience (student / institution / reviewer); primary navigation never contains a capability whose register word is "Planned"; every page states who it is for, what is built, what is not, and the next action. Page briefs: [`BRAND-AND-MARKETING-STRATEGY.md` 4.3](../../gtm/BRAND-AND-MARKETING-STRATEGY.md).

### E.2 Homepage requirements [DRAFT]

Orient in five seconds; two routes (student: request an invite; institution: start a discovery conversation); one-line descriptor "student action platform" (D-1148, pending claim review); no counts, logos, ratings, outcome numbers, "paid pilot", price; link to Trust Center and Availability. Claims M-01, M-12, M-22 of the brand register, each requiring its CLM row.

### E.3 Use-case pages [DRAFT]

Registration readiness; first-week-of-term planning; deadlines and workload; advisor-meeting prep; each ends in a free tool then an invite request, with no outcome promise or urgency. Two useful pages per month ([`CONTENT-AND-CHANNEL-PLAN.md`](../../market-readiness/CONTENT-AND-CHANNEL-PLAN.md)).

### E.4 Pilot page, demo-request path, Trust Center path [DRAFT]

| Path | Content | Gate |
| --- | --- | --- |
| Pilot page (`/start/`) | what the design-partner pilot is, what it is not, the gates; no price, no dates, no "paid pilot" | `social.ts` funnel `institutions` step |
| Demo-request path | `/institutions/` -> `/demo/` (synthetic, captioned) -> `/contact/` -> discovery | synthetic only; scorecard on first call |
| Trust Center | public tier (capability status words, known limitations, AI disclosure, data ethics, accessibility roadmap not conformance); NDA tier via trust room; "Not yet in place" section; never a badge wall | [`TRUST-CENTER-CONTENT.md`](../../market-readiness/TRUST-CENTER-CONTENT.md); trust room tables |

### E.5 SEO plan: topic and keyword map [ASSUMPTION] [DRAFT]

Search volumes and difficulty are **not measured**; the map is a hypothesis to validate with a keyword tool before investment. Phrases are illustrative clusters, not volume claims. Two useful pages per month; success is activated starts and qualified conversations, never traffic alone.

| Cluster | Example phrases | Intent | Page / asset | Audience | Claims | CTA |
| --- | --- | --- | --- | --- | --- | --- |
| Registration prep | how to prepare for course registration; registration checklist; backup schedule | student, informational | registration checklist tool + use-case page | student | CLM-001 | download tool -> invite |
| First week | syllabus week checklist; first week of college plan | student, informational | syllabus-week page | student | CLM-001 | invite |
| Workload / deadlines | how to track deadlines across classes; semester planner | student, informational | deadlines use-case page | student | CLM-001, CLM-018 | invite |
| Advisor meeting | questions to ask your advisor; advising meeting prep | student/advisor | "Bring a Path Snapshot" guide | student, advisor | CLM-001 | invite |
| Institutional readiness | student registration readiness; reduce registration holds / advising backlog | institution, problem-aware | essay + pilot overview | sponsor, advisor lead | CLM-004 | discovery |
| Evidence and trust | student planning tool privacy; source labels vs black box AI | reviewer | trust and limitations pages | IT, privacy | CLM-009, CLM-018 | trust room |
| Brand / category | "student action platform" | all | home, availability | all | D-1148 | route by audience |

### E.6 Content calendar, 12 weeks [DRAFT]

Starts 2026-10-05 (aligned to [`BRAND-AND-MARKETING-STRATEGY.md` 5.4](../../gtm/BRAND-AND-MARKETING-STRATEGY.md)); anchors are generic academic moments, never one school's dates; publishing is manual (no direct platform publishing, per [`EXECUTION-PLAN.md`](../../gtm/EXECUTION-PLAN.md)). Delta vs the brand calendar: adds channel assignment and a weekly leading KPI. Every asset needs a register row, captions, alt text, owner and expiry before publish. Owner for all rows: founder (interim) until a content owner is named.

| Wk | Starts | Student theme | LinkedIn (institution) | YouTube | Instagram / TikTok | Facebook | Email / webinar | Weekly leading KPI (diagnostic) |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Oct 5 | Midterms: what is due | "The semester arrives in pieces" | - | 1 short demo script | - | list hygiene, consent text to counsel | qualified invite requests |
| 2 | Oct 12 | Check before you keep | trust "Not yet in place" draft | captioned syllabus-check demo | demo clip | - | - | demo views to invite (diagnostic) |
| 3 | Oct 19 | Registration prep | pilot overview review | - | carousel: registration checklist | - | email 1 of lifecycle (opted-in only, if G1 open) | checklist -> invite rate |
| 4 | Oct 26 | Where did this come from? | essay: source labels | source-label explainer + transcript | clip | - | webinar topic set | trust-page -> request rate |
| 5 | Nov 2 | Study plan for finals | accessibility roadmap page (no conformance) | - | study-plan template post | - | - | template -> start rate |
| 6 | Nov 9 | Advisor meeting prep | advisor one-pager (synthetic) | - | advisor-prep tip | advisor/office post (permitted orgs) | advisor webinar (synthetic demo) | webinar attendees qualified |
| 7 | Nov 16 | Take it with you | essay: what we measure and refuse to | export/delete walkthrough | clip | - | - | export-page visits (diagnostic) |
| 8 | Nov 23 | Break-week reset | quiet week; claim register QA | - | one optional post | - | - | claims corrected count |
| 9 | Nov 30 | Finals runway | founder's letter review | exam-runway demo | demo clip | - | - | activation (cohort) |
| 10 | Dec 7 | When you are behind | counsel questions list | recovery-plan demo | clip | - | - | first-win rate (cohort) |
| 11 | Dec 14 | Term wrap | year-end trust review | - | founder post only; story only if permissioned | - | - | week-4 retention (cohort) |
| 12 | Dec 21 | Spring syllabus week prep | G1 readiness review | - | syllabus-week checklist | - | - | gate review |

### E.7 LinkedIn plan (institutional buyers) [DRAFT]

Role per `social.ts`: institutions, advisors, partners, product strategy. Pillars: institutional insight, responsible technology, product building. Cadence weekly or biweekly (hypothesis). Content: essays on fragmentation, source labels, accessibility, AI boundaries; a "what Semester is not" page that pre-qualifies out SIS-write, certificate and risk-scoring buyers. Warm paths only for the first ten accounts; no cold bulk email; institution-provided contact details are not marketing permission. KPI: qualified conversations (score >= 11 with stated reason). Impressions and followers are diagnostic only.

### E.8 YouTube, Instagram/TikTok, Facebook, webinar, email, case studies, partner marketing [DRAFT]

| Channel | Job | Plan | Guardrail |
| --- | --- | --- | --- |
| YouTube | product proof + education | monthly: captioned walkthroughs (syllabus check, source labels, export/delete); advisor training; webinar recordings; synthetic data only | captions and transcript required; no real student screens |
| Instagram / TikTok | student adoption | 2-3 short demos a week only during approved campaigns; one reversible planning action each; ambassador content under conduct rules | no streak or fear copy; no private data; impressions diagnostic |
| Facebook | parents, alumni, community, retargeting | community announcements and campus-group posts; parents reached **only** via a student-initiated invite (no guardian acquisition funnel); retargeting prohibited from using education records or private data | contextual only; separate sponsored content ([`ADVERTISING-AND-MONETIZATION-POLICY.md`](../../market-readiness/ADVERTISING-AND-MONETIZATION-POLICY.md)) |
| Webinars | institutional and advisor education | monthly when capacity permits; "registration readiness without surveillance" and "advisor meeting prep"; synthetic demo; recorded with captions | registration requires consent text; no outcome claims |
| Email nurture | owned audience | lifecycle per [`EMAIL-LIFECYCLE.md`](../../market-readiness/EMAIL-LIFECYCLE.md) (transactional separate from marketing; separate opt-in; one-click unsubscribe; cap proposal <= 1 a week); institutional nurture sequences: [`docs/business/sales/`](../sales/) (email sequence set, colleague-owned) | `messaging.ts` `decideSend`; opt-out alert above 0.1% with 1,000+ delivered |
| Case-study system | permission-first | **none exist.** Template [`CASE-STUDY-TEMPLATE.md`](../../market-readiness/CASE-STUDY-TEMPLATE.md); workflow: accepted scope -> no P0/P1 -> signed claim-specific permission -> counsel -> publish with expiry | CLM-013 prohibits until permission exists |
| Partner marketing | qualified introductions | [`PARTNER-AND-CHANNEL-STRATEGY.md`](../../commercial/PARTNER-AND-CHANNEL-STRATEGY.md): six hypotheses, none approved; no partner named, no listing claimed | no partnership/endorsement claim |

### E.9 Paid media rules and validation gates [ASSUMPTION] [REVIEW: counsel] [REVIEW: privacy]

**Do not scale paid ads until the offer and conversion path are validated.** Today this is doubly true: broad or paid individual acquisition is NO-GO/RED (checkout hold), and `ADVERTISING-AND-MONETIZATION-POLICY.md` bars behavioral targeting on education records, grades, schedules, tasks, private conversations, AI prompts, health/disability/counseling/conduct/immigration data, location history, support cases and institutional data. Sponsorship stays off (`sponsor.ts`).

| Gate | Condition before any paid spend beyond a rehearsal | Label |
| --- | --- | --- |
| P-1 Authorization | go/no-go flips for the motion; separate broad-rollout decision accepted by founder, counsel, product, security, privacy, accessibility, support, operations | [VERIFIED] `GO-NO-GO-DECISION.md` |
| P-2 Claims | each ad variant has a register row and a named approver; takedown owner named | [VERIFIED] approval record required by the register |
| P-3 Offer validated (institution) | >= 10 qualified discovery conversations recording the problem in the buyer's words, >= 3 reaching `technical_review` | [ASSUMPTION] numbers |
| P-4 Offer validated (student) | first-win rate and week-4 retention measured on >= 100 activated students across >= 2 cohorts with frozen denominators; support contacts per activated student within capacity | [ASSUMPTION] numbers; thresholds set from the previous block per `GROWTH-OPERATING-PLAN.md` |
| P-5 Conversion path | landing page, consent, tested opt-out, UTM convention, conversion instrumentation, accessibility review, all passing `activationGate` | [VERIFIED] `campaign.ts` |
| P-6 Economics | payback and cap set by Finance from measured CAC (E-denominator: fully loaded channel cost / activated students); cap per Finance model tab, Base scenario | [ASSUMPTION]; see H |
| P-7 Stop rule | any guardrail breach (complaints, opt-out/deletion, accessibility barrier, P0/P1, claim error) pauses the channel even if sign-ups grow | [VERIFIED] first-1,000 plan |

---

## F. Student adoption system [DRAFT] [INTERNAL]

Canonical: [`STUDENT-ONBOARDING-PLAYBOOK.md`](../../commercial/STUDENT-ONBOARDING-PLAYBOOK.md), [`FIRST-1,000-STUDENTS-ADOPTION-PLAN.md`](../../market-readiness/FIRST-1,000-STUDENTS-ADOPTION-PLAN.md), [`CAMPUS-LAUNCH-KIT.md`](../../market-readiness/CAMPUS-LAUNCH-KIT.md), [`STUDENT-AMBASSADOR-PLAYBOOK.md`](../../market-readiness/STUDENT-AMBASSADOR-PLAYBOOK.md), [`INDIVIDUAL-GROWTH-STRATEGY.md`](../../market-readiness/INDIVIDUAL-GROWTH-STRATEGY.md), [`REFERRAL-AND-SHARING-SAFETY.md`](../../market-readiness/REFERRAL-AND-SHARING-SAFETY.md), [`EMAIL-LIFECYCLE.md`](../../market-readiness/EMAIL-LIFECYCLE.md), [`docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md).

**Gate.** Individual acquisition is CONDITIONAL GO / YELLOW: invitation-only, unpaid validation after every applicable gate; no broad or paid promotion.

### F.1 Onboarding [VERIFIED structure] 

Eight-step flow in `STUDENT-ONBOARDING-PLAYBOOK.md`: welcome, choice (local or account), context, just-in-time permission, manual setup first, plan, act, control. The playbook's 10-minute and 80%-unaided figures are **unapproved targets**, not results; do not publish them.

### F.2 Definitions [VERIFIED] `docs/market-readiness/METRIC-DICTIONARY.md`

| Term | Definition | Not counted |
| --- | --- | --- |
| Activated student | eligible student completing consent/notice and approved minimum setup | invitation, open, login only |
| **First meaningful action (first win)** | setup-activated student reaches Today, understands one relevant prioritized reversible action and its source/limitations, knows the help route, then intentionally completes, schedules, snoozes or defers it | demo/sample data, staff-assisted test accounts; a full first-week plan is not an extra gate |
| Workflow completion | completed workflows / users who began the defined workflow | passive page views |
| Weekly active use | activated student with at least one meaningful engagement in the week | raw logins, support/staff/test activity |
| Weekly Prepared Action Rate (proposed north star) | eligible activated participants completing a weekly plan and >= 1 self-selected relevant action / eligible activated participants in week | privacy-safe source not yet implemented |

### F.3 Campus launch kit, ambassadors, enablement [DRAFT]

- **Campus launch kit** ([`CAMPUS-LAUNCH-KIT.md`](../../market-readiness/CAMPUS-LAUNCH-KIT.md)): approved one-sentence description, synthetic screenshots, QR with campaign source, quick-start, accessibility and privacy summary, official-record disclaimer, support contacts, advisor referral copy, event checklist, conduct, known limitations, withdrawal/export/delete paths. Orientation activation: a 10-minute "plan your first week" manual-setup session; staff never ask students to display grades, schedules or private tasks.
- **Ambassador program** ([`STUDENT-AMBASSADOR-PLAYBOOK.md`](../../market-readiness/STUDENT-AMBASSADOR-PLAYBOOK.md)): transparent application and conflict disclosure; training on limits, privacy, accessibility, referral safety, escalation; compensation for time not sign-ups or testimonials; separate written permission for quotes or images; no peer-data access; weekly material review. Disclosure text and compensation need counsel (open item in `GROWTH-OPERATING-PLAN.md` section 13). Not started until counsel clears it.
- **Advisor / faculty enablement:** peer demo on synthetic data, quick-start by role, office-hour format, advisor-referred demos, "Bring a Path Snapshot" guide; no student-level reports to faculty beyond policy.
- **Student communications:** service/transactional messages kept separate from marketing; marketing needs separate opt-in and one-click unsubscribe; consent never pre-ticked; no grades, task titles or health information in subjects; quiet hours and frequency caps enforced by `messaging.ts`.
- **Referral / advocacy:** at G1 no reward (brand strategy D5); a referral counts only when the referred person activates and remains; no incentive tied to student data; guardians reached only via student-initiated shares.
- **Retention / re-engagement:** meaningful retention (approved useful action in a later window), not logins; inactivity notice before any retention action; win-back at most one per term; 90-day sunset (proposal pending decision); never streaks, shame notifications, fear urgency or leaderboards (`engagement.test.ts` structural test, per the ethical-engagement doc).

### F.4 Student adoption KPIs [DRAFT]

Activation rate, first-win rate, time to first value (with censored attempts), Day 7 / Day 30 meaningful retention, workflow completion, weekly prepared action rate, support contacts per activated student, opt-out/deletion rate, accessibility blockers, notification disablement. Definitions in the KPI tree. Stage gate per 100-250 students: activation and week-4 retention at target, support within capacity, no P0/P1, guardrails acceptable; pause the failing channel. Success is 1,000 students who reach activation with sustainable retention and trust, not 1,000 accounts.

---

## G. Customer success system [DRAFT] [INTERNAL]

Canonical: [`CUSTOMER-SUCCESS-PLAYBOOK.md`](../../commercial/CUSTOMER-SUCCESS-PLAYBOOK.md), [`CUSTOMER-ONBOARDING-PLAYBOOK.md`](../../commercial/CUSTOMER-ONBOARDING-PLAYBOOK.md), [`INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md`](../../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md), [`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md), [`SUPPORT-OPERATIONS.md`](../../commercial/SUPPORT-OPERATIONS.md), [`CUSTOMER-HEALTH-SCORE.md`](../../commercial/CUSTOMER-HEALTH-SCORE.md), [`CHURN-AND-RISK-PLAYBOOK.md`](../../commercial/CHURN-AND-RISK-PLAYBOOK.md), [`RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md), [`docs/institutional-implementation/`](../../institutional-implementation/README.md). Colleague-written: [`docs/business/customer-success/`](../customer-success/) and [`docs/business/templates/`](../templates/) (linked by path; templates include the weekly pilot report, midpoint review and final value report).

**Gate.** No customer exists. Everything here is rehearsal design until a signed order, accepted handoff and launch-council GO exist. A signed order is not launch GO.

### G.1 Lifecycle table [DRAFT]

| Step | Owner | Input | Output / acceptance | System | Doc |
| --- | --- | --- | --- | --- | --- |
| Sales-to-CS handoff | seller -> CS (founder interim) | legal customer, order, scope/exclusions, owners/backups, decision dates, data authority, price status, success plan, support, risks, offboarding | accepted handoff or rejected incomplete handoff | `gtm_*` | [`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md) |
| Welcome / kickoff | CS | accepted handoff | sponsor, champion, technical, trust, accessibility, support contacts confirmed; cohort/workflow; change control; stop conditions | tenant (sandbox data mode) | [`CUSTOMER-ONBOARDING-PLAYBOOK.md`](../../commercial/CUSTOMER-ONBOARDING-PLAYBOOK.md) |
| Implementation | implementation | kickoff | `pilotReadiness` clean; UAT; restore/rollback evidence for target | tenant, runbooks | [`INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md`](../../commercial/INSTITUTIONAL-IMPLEMENTATION-PLAYBOOK.md) |
| Training | CS | roles | each role completes first-day checklist and live session | [`docs/pilot/FIRST-DAY-CHECKLIST.md`](../../pilot/FIRST-DAY-CHECKLIST.md) | `TRAINING-PLAN-AND-ACADEMY.md` |
| Support | support (founder interim; backups required) | tickets | acknowledged and resolved within **published** hours only | support system (absent) | [`SUPPORT-OPERATIONS.md`](../../commercial/SUPPORT-OPERATIONS.md) |
| Launch / hypercare | CS + engineering | launch-council GO | two weeks daily log | issue log | `HYPERCARE-AND-HANDOFF.md` |
| Weekly pilot report | CS | frozen-denominator metrics | one page: activation, first win, weekly use, support, guardrails, decisions, next owners | scorecard | `docs/business/templates/` |
| Midpoint executive review | founder + sponsor | trajectory, guardrails | continue, correct, pause or stop | decision log | [`PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md) |
| Final value report | CS | whole-pilot evidence | observed results with missingness and caveats; signed verdict | `gtm_pilot_outcomes` | `docs/business/templates/` |
| QBR / EBR | CS | quarter evidence | decisions, risks | [`EXECUTIVE-BUSINESS-REVIEW.md`](../../institutional-implementation/EXECUTIVE-BUSINESS-REVIEW.md) | |
| Renewal / expansion | founder | final verdict | renew, expand, narrow, stop or offboard | renewal opportunity (120 days before term end) | [`RENEWAL-AND-EXPANSION-PLAYBOOK.md`](../../commercial/RENEWAL-AND-EXPANSION-PLAYBOOK.md) |
| Churn-risk | CS | health review | respectful named action: investigate data quality, ask customer, remediate, rescope, pause, prepare offboarding | [`CHURN-AND-RISK-PLAYBOOK.md`](../../commercial/CHURN-AND-RISK-PLAYBOOK.md) | |
| Case-study / reference | CS + counsel | accepted scope, no P0/P1 | claim-specific written permission | register row | [`CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md) |

### G.2 Health score: two candidate models, one canonical [ASSUMPTION] [REVIEW: privacy]

| Dimension | Founder's planning weights | `CUSTOMER-HEALTH-SCORE.md` (controlled, proposed) |
| --- | ---: | ---: |
| Admin engagement | 15 | - (inside sponsor/champion) |
| User activation | 20 | - (inside meaningful adoption) |
| First meaningful action | 15 | 15 (meaningful adoption / first win) |
| Core workflow completion | 20 | - (inside outcome trajectory / adoption) |
| Weekly active use | 10 | - (inside meaningful adoption) |
| Support sentiment | 5 | 10 (support burden/resolution) |
| Executive engagement | 5 | 10 (sponsor/champion engagement) |
| Outcome trend | 10 | 25 (agreed outcome trajectory) |
| Implementation / readiness | - | 20 |
| Reliability / recovery | - | 15 |
| Trust / customer gates | - | 5 |
| **Total** | **100** | **100** |

**Canonical: [`CUSTOMER-HEALTH-SCORE.md`](../../commercial/CUSTOMER-HEALTH-SCORE.md).** Reasons: it is a controlled repository document with human-review rules, overrides (a P0/P1 security, privacy, accessibility, safety, legal/rights, tenant-isolation or integrity issue overrides any score) and an explicit finding that the existing nightly `compute_account_health()` is **not** an implementation of it and must be treated as unavailable/unreviewed; it also forbids scoring individuals and inferring hidden intent. The founder's weights are kept as a **planning alternative** for a shadow comparison once any customer data exists. Gaps in the founder's model to resolve before use: no reliability or implementation dimension (a P0 can hide inside a high score); "support sentiment" must be a staff-recorded categorical value, never inferred from message content; "admin engagement" must be a factual action record, not subjective. Neither model produces a score today; show "unavailable" when evidence is absent, never neutral. No student is ever scored.

### G.3 Support, escalation, health actions [DRAFT]

Support scope is pilot-scoped and published; no 24/7 promise; severity scale and incident runbook exist ([`docs/trust/APM-RUNBOOK.md`](../../trust/APM-RUNBOOK.md), [`INCIDENT-RESPONSE-PLAN.md`](../../trust/INCIDENT-RESPONSE-PLAN.md)). Staffed queue, hours and backup rota are go/no-go priority 6 and do not exist. A guardrail breach pauses the affected scope regardless of adoption.

---

## H. Financial and operating system [DRAFT] [INTERNAL] [REVIEW: accounting] [REVIEW: tax]

Canonical for numbers: [`docs/finance/`](../../finance/README.md) (workbook `semester-financial-model.xlsx`, scenarios, gates, hiring), [`docs/business/finance/FINANCIAL_MODEL_SPEC.md`](../finance/FINANCIAL_MODEL_SPEC.md), [`docs/business/finance/UNIT_ECONOMICS.md`](../finance/UNIT_ECONOMICS.md), [`docs/business/finance/PRICING_AND_PACKAGING.md`](../finance/PRICING_AND_PACKAGING.md) (the lead writes these; linked by path), [`PRICING-AND-PACKAGING.md`](../../commercial/PRICING-AND-PACKAGING.md), [`PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md), [`REVENUE-OPERATIONS-ARCHITECTURE.md`](../../commercial/REVENUE-OPERATIONS-ARCHITECTURE.md).

**This document contains no numeric model output.** For every figure (revenue, CAC value, payback value, margin, runway, break-even month) see "the Finance model tab, Base scenario" in the workbook. The prices below are **inputs the founder supplied as planning assumptions**, not quotes, prices or public commitments, and none is an approved price book (CLM-015 prohibited).

### H.1 Revenue streams and planning assumptions [ASSUMPTION] [INTERNAL]

| Stream | Founder planning assumption | Existing record / conflict | Status |
| --- | --- | --- | --- |
| Student Premium | $8.99/month or $69/year | **D-134: $7.99/month, $59/year; D-1154 (2026-10-04): $15/month, yearly unstated** | three conflicting figures; open decision; nothing is charged (billing hold) |
| Institutional platform | $18 per enrolled student per year, $30,000 annual minimum | D-1154 item 2: match Blackboard/Canvas-class prices; unit unstated | unit and number open |
| Institutional AI allowance | 2,400 pooled governed requests per enrolled student per year (= 200 per month planning average) | AI cost controls in `docs/operating-model/COMMERCIAL-GOVERNANCE.md` | assumption |
| AI overage | $30 per 1,000 requests | none | assumption |
| Implementation | $35,000-$150,000 one-time | pilot offer: 30-60 day implementation | assumption |
| Premium support | 15% of annual platform fee, $15,000 minimum | no staffed support exists | assumption; support not yet staffed |
| Optional partner / marketplace commission | 12%, modelled separately | marketplace not built; CLM-013 | assumption; core must be viable without it |

### H.2 Formulas (verbatim from the founder's brief) [VERIFIED] matches `kpi.ts` for CAC and CAC payback

- **CAC** = sales and marketing spend / new customers acquired
- **CAC payback months** = CAC / monthly gross profit per customer
- **LTV** = annual recurring revenue x gross margin / annual logo churn
- **MRR** = annual recurring revenue / 12 + recurring monthly student revenue
- **Break-even** = first month where cumulative gross profit covers cumulative operating expenses and required cash obligations

Delta vs repository: `kpi.ts` defines `customer_acquisition_cost` and `cac_payback_months` with the same shape; LTV, MRR and break-even are not defined in code or in [`ANALYTICS-AND-METRICS-DICTIONARY.md`](../../commercial/ANALYTICS-AND-METRICS-DICTIONARY.md), which marks ARR/MRR/bookings/billings/cash/revenue and CAC/LTV/gross margin/payback "FINANCE/ACCOUNTING DEFINITIONS AND SOURCES REQUIRED". These formulas are therefore [ASSUMPTION] definitions until Finance and the accountant approve a cost, customer, revenue and cohort policy.

### H.3 Model drivers, cost structure and unit economics [DRAFT]

| Block | Drivers (names only; values in the Finance model) | Link |
| --- | --- | --- |
| Funnel (36-month) | qualified accounts per month, discovery-to-qualified, qualified-to-pilot, pilot-to-annual conversion, sales-cycle length, cohort size, enrolled students per institution | [`11-PILOT-EVIDENCE-PLAN.md`](../../finance/11-PILOT-EVIDENCE-PLAN.md) |
| Revenue | platform fee, minimum, AI allowance and overage, implementation, support attach, student subscription conversion, price realization, discount | [`02-PRICING-PACKAGING-ENTITLEMENTS.md`](../../finance/02-PRICING-PACKAGING-ENTITLEMENTS.md) |
| Cost of revenue | hosting, AI inference per task, support, implementation labour, payment fees | [`03-COST-MODEL.md`](../../finance/03-COST-MODEL.md) |
| Operating cost | headcount (gated), sales and marketing, tools, legal, insurance, assessments | [`12-GATED-HIRING-SCHEDULE.md`](../../finance/12-GATED-HIRING-SCHEDULE.md) |
| Unit economics | CAC, CAC payback, LTV and LTV:CAC, gross margin, NRR (kpi.ts `netRevenueRetention` = (start + expansion - contraction - churn) / start), burn multiple | [`04-UNIT-ECONOMICS.md`](../../finance/04-UNIT-ECONOMICS.md) |
| Scenarios | conservative, base, aggressive, enterprise-delayed, high-AI-cost, incident-cost, gated plan, go/no-go gated | [`07-SCENARIOS-AND-SENSITIVITY.md`](../../finance/07-SCENARIOS-AND-SENSITIVITY.md), [`10-GO-NO-GO-GATES.md`](../../finance/10-GO-NO-GO-GATES.md) |

CAC payback guardrail and the student-acquisition cap are defined in the Finance documents; this playbook only requires that GTM report fully loaded CAC and that paid student acquisition remain an adoption channel until Finance releases a cap (E.9 P-6). Runway, break-even, hiring capacity and scenario planning: read from the Finance model tab, Base scenario, and `10-GO-NO-GO-GATES.md` for the gated view. Note the Finance model's Base scenario books revenue the go/no-go does not yet authorize; use the go/no-go-gated scenarios for any decision that depends on timing.

### H.4 Operating controls [DRAFT] [REVIEW: accounting] [REVIEW: tax] [REVIEW: insurance]

Accountant of record is Harrison Rubin (D-1154 item 5), which does not satisfy the revenue-recognition, tax, invoice or close gates (no independent qualified review; the owner is also the seller). Second deal-desk approver is named (D-1154 item 4); approval thresholds and discount bands are not set. Qualified accountant, tax adviser, counsel and broker are unassigned. Finance controls and close calendar: [`08-FINANCE-CONTROLS-AND-OPERATIONS.md`](../../finance/08-FINANCE-CONTROLS-AND-OPERATIONS.md).

### H.5 Core viability rule [VERIFIED policy]

The core company must be viable without advertising or marketplace revenue. Advertising and sponsorship are disabled by default (`sponsor.ts`; policy doc), and the 12% commission is modelled separately. Any scenario where break-even depends on those lines is rejected.

---

## I. KPI tree and cadence (summary) [DRAFT] [INTERNAL]

Detail: [`SEMESTER_GTM_KPI_TREE.md`](SEMESTER_GTM_KPI_TREE.md). Targets are `[ASSUMPTION]` or "none until baseline". Actual vs forecast vs assumption are labelled separately; views, downloads, followers and impressions are diagnostic only, never proof.

| Domain | North-star KPI | Source system | Owner |
| --- | --- | --- | --- |
| Revenue | ARR and MRR (finance-approved definitions) | finance records, signed orders | Founder / accountant |
| Pipeline | qualified pipeline coverage by evidence category | `gtm_accounts` | Founder |
| Activation | activation rate; first-win rate | validated events (proposed) | Product |
| Retention | meaningful retention; logo retention | events; contracts | Product / CS |
| Customer health | human-reviewed health narrative | CS records | CS |
| Product adoption | weekly active use; workflow completion | events | Product |
| Support | support burden per activated user; resolution age | support system (absent) | Support |
| Security | open P0/P1; evidence age; review cycle time | incident log; evidence register | Security (unassigned) |
| Cash / runway | months of runway at current net burn | finance records | Founder |
| Delivery capacity | active pilots vs cap; implementation hours | CS records | Founder |

Cadence: weekly revenue, product/engineering, CS, growth meetings; monthly finance and security/risk reviews; quarterly strategy/OKR (aligned with [`03-okrs-planning-metrics.md`](../../company/leadership-system/03-okrs-planning-metrics.md), which sets no targets: a target is a recorded founder decision). With one person holding every seat, meetings are merged into one weekly operating review until seats are filled; the KPI tree specifies each meeting's agenda, inputs, owner and outputs.

---

## J. 30/60/90 summary [DRAFT] [INTERNAL]

Detail with IDs, acceptance criteria and evidence of done: [`SEMESTER_90_DAY_GTM_PLAN.md`](SEMESTER_90_DAY_GTM_PLAN.md). Day 1 begins when the founder accepts the plan and confirms authority; customer-dependent work begins only when a willing customer exists.

### J.1 Summary [ASSUMPTION] dates and counts

| Window | Theme | P0 | P1 | P2 | Key dependency | Exit |
| --- | --- | --- | --- | --- | --- | --- |
| Days 1-30 | Become sellable | launch wedge, ICP, claims map, synthetic demo, 100-account list, contract/trust inventory, security owner named | pricing assumptions, financial model hookup, website paths | content calendar weeks 1-4 | founder decisions (pilot length, student price) | day-30 decision: continue only if candidate identity, owner coverage, external-review scopes and legal/company-fact paths are credible |
| Days 31-60 | Become pilot-ready | pilot agreement through counsel, HECVAT Lite evidence plan, support/onboarding workflow | ambassador kit, first webinars, outbound sequences | partner mapping | counsel engaged, assessors scoped | pilot proposals issued **non-binding** |
| Days 61-90 | Become repeatable | design-partner engagement scoped (conditional on gates), KPI/board rhythm | value-report template, annual conversion process, case-study process | expansion plan | named design partner willing | one bounded design-partner engagement scoped or a dated NO-GO |

### J.2 Review cadence

Weekly operating review; day-30, day-60 and day-90 gate reviews (go/no-go reissued when scope, evidence, ownership or risk changes, per `GO-NO-GO-DECISION.md`).

### J.3 Principal risks [INTERNAL]

Founder capacity (one person, all seats); external lead times (counsel, assessors); a prospect that wants a paid pilot before the gate flips; pilot-length conflict blocking the proposal; claims drift in marketing.

### J.4 Which plan is authoritative for what [DRAFT]

| Plan | Authoritative for | Conflict with this plan |
| --- | --- | --- |
| [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) | what may be done now and what is held | none; this plan is sequenced inside it |
| [`30-60-90-DAY-EXECUTION-PLAN.md`](../../../30-60-90-DAY-EXECUTION-PLAN.md) | evidence and operating-authority workstreams and day-30/60/90 decisions | it frames days 61-90 as "run or decline one bounded pilot" |
| [`docs/90-DAY-LAUNCH-PROGRAM.md`](../../90-DAY-LAUNCH-PROGRAM.md) (`ninety-day.ts`) | task ids, owners as roles, dependency order (test-enforced) | it signs the pilot agreement in days 31-60 (`sign-pilot`), which conflicts with the paid-pilot NO-GO; read it as a design-partner agreement under non-activation boundary only |
| [`docs/market-readiness/90-DAY-MARKET-READINESS-PLAN.md`](../../market-readiness/90-DAY-MARKET-READINESS-PLAN.md) | 13-week weekly objectives | signs agreement in week 6 and launches in week 9; treat as the best-case path if every gate flips |
| [`docs/gtm/EXECUTION-PLAN.md`](../../gtm/EXECUTION-PLAN.md) | which GTM rules are code; build backlog | no dates |
| [`docs/gtm/GROWTH-OPERATING-PLAN.md`](../../gtm/GROWTH-OPERATING-PLAN.md) section 12.3 | growth/lifecycle 30/60/90 (G0-G2 messaging gates) | none |
| **`SEMESTER_90_DAY_GTM_PLAN.md`** | commercial go-to-market sequencing and owners, the P0 blocker list, weekly activity targets | subordinate to all rows above on gates |

---

## Existing vs missing [DRAFT]

The lead maintains [`docs/business/INVENTORY.md`](../INVENTORY.md): for each deliverable in the founder's brief it lists the existing artifact, the new `docs/business/` document and what remains missing. Do not maintain a second inventory here. Known gaps from this author's reading, for the inventory: no named customer, logo, case study or measured outcome; no HECVAT completion, pen-test, SOC 2, ACR/VPAT; no support system or staffed hours; no production telemetry for activation or retention; no approved price book; no qualified accountant, tax adviser, counsel or broker; no recorded demo; no keyword research; email sequence content and objection library are sibling documents.

## Open decisions [INTERNAL]

| # | Decision | Options on record | Needs | Blocks |
| ---: | --- | --- | --- | --- |
| 1 | Pilot length | 26 weeks (code, D-134) vs 8-12 weeks / one term (founder assumption) | founder decision recorded as `D-<PR number>`; code change in `pilot.ts` if 8-12 | proposals, MAP, model timing |
| 2 | Student price | $7.99/mo or $59/yr (D-134); $15/mo, yearly unstated (D-1154); $8.99/mo or $69/yr (founder planning assumption) | founder decision; finance, tax, counsel; also which plan carries it | CLM-015, pricing page, model |
| 3 | Institutional price and unit | D-1154: match LMS-class vendors, unit open; planning assumption $18 per enrolled student, $30,000 minimum | sourced quotes or public price lists; floors from `PRICING-UNIT-ECONOMICS-ARCHITECTURE.md` | any quote |
| 4 | Paid-pilot gate | NO-GO until go/no-go priorities 1-9 are evidenced and a bounded design-partner engagement has an approved activation and measured closeout | executed evidence per `release-profiles.ts` | paid proposal, invoice |
| 5 | Security owner | unassigned (founder is interim) | named person; independent assessor for priority 2 | HECVAT, assessments |
| 6 | Privacy and accessibility owners | unassigned | named people | consent texts, campaigns |
| 7 | Counsel, CPA / tax adviser, insurance broker | unassigned; accountant of record is the founder (D-1154), not independent | engagement | paper, order form, billing, insurance |
| 8 | Backup owners and second approver beyond the named deal-desk second | second approver Bramm Rubin (D-1154); no authority matrix or thresholds | authority matrix | deal-desk approvals |
| 9 | Targets for first-year measures | none set (`COMPANY-FIRST-YEAR-MEASURES.md`; a target is a recorded founder decision) | founder decision | KPI targets |
| 10 | Health-score model | founder weights vs `CUSTOMER-HEALTH-SCORE.md` | shadow comparison once data exists | CS reporting |

## Evidence state

**Repository evidence.** Controlled commercial, trust, finance and market-readiness documents; GTM rules in code with tests; go/no-go decision and claims register at the cited revision.

**Operational evidence.** None of: a named prospect, discovery call, demo recording, pilot, customer, logo, price approval, measured activation, retention, outcome, support operation or financial actual. All metrics are definitions, all targets assumptions.

**Missing proof.** Run structured discovery with multiple qualified prospects; qualify one design partner; close go/no-go priorities 1-9 with evidence; approve claims with a named approver; instrument and validate events; select and approve prices.

## Claim ceiling

Semester may use this playbook internally to organize non-activation discovery, synthetic demos, evidence exchange and conditional scoping, and to prepare (not publish) campaigns and customer-success materials. The customer-safe derivative may be shared only after the claims owner records approval.

## Prohibited claims

Do not state or imply: customers, logos, pilots, case studies, measured outcomes, SOC 2, FERPA/COPPA/GDPR compliance, HECVAT completion, penetration testing, uptime/RTO/RPO/SLA, WCAG/VPAT/ACR conformance, SSO/SCIM/LTI/SIS availability, system replacement, enterprise readiness, any price, savings or ROI, or that a paid pilot is available.

## Professional review required

[REVIEW: counsel] pilot paper, DPA, claims wording, ambassador disclosure, consent texts, price publication. [REVIEW: tax] [REVIEW: accounting] pricing model, revenue recognition, invoicing, sales-tax treatment. [REVIEW: insurance] coverage before any contracted risk. [REVIEW: privacy] event definitions, thresholds, aggregate reporting, health-score signals. [REVIEW: security] independent assessment, HECVAT answers, trust-room contents. [REVIEW: accessibility] qualified assessment before any conformance language. [REVIEW: procurement] questionnaire process and procurement path.
