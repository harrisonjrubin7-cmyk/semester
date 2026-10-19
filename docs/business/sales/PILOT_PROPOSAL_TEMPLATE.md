# Pilot Proposal Template - Registration Readiness Pilot

> **NON-BINDING DISCUSSION DRAFT - NOT AN OFFER - requires counsel review. Paid acceptance is HELD under [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) (paid institutional pilot = NO-GO/RED).**

| Control | Value |
| --- | --- |
| Status | **[DRAFT] TEMPLATE - NOT APPROVED, NOT AN OFFER. Sections 1-16 are customer-facing once filled and approved; the appendix is [INTERNAL - do not send] and must be removed before sharing** |
| Owner | Harrison Rubin (interim; backup unassigned). Counsel, finance, tax, signing authority: unassigned |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: tax] [REVIEW: procurement] [REVIEW: security] [REVIEW: privacy] [REVIEW: accessibility] |
| Audience | Customer-safe **only after** every `[PLACEHOLDER]` is filled, counsel has reviewed and the appendix is removed. Until then [INTERNAL] |

> Operating template, not legal, tax, accounting, insurance, privacy, security or accessibility advice. It is not an agreement, invoice, launch approval or promise of availability, price, outcome, integration or support level.

Label legend: **[VERIFIED]** proved by repository path or evidence id; **[ASSUMPTION]** planning number; **[DRAFT]** needs review; **[APPROVED]** customer-facing wording with named approver (none in this file); **[INTERNAL]** never sent as-is.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document |
| --- | --- | --- | --- |
| [`../../commercial/PILOT-PROPOSAL-TEMPLATE.md`](../../commercial/PILOT-PROPOSAL-TEMPLATE.md) (controlled) | Seven-section skeleton: identity, scope/responsibilities, delivery/acceptance, data, measures, commercials, risks/exit | A fill-in proposal a seller can complete: executive summary, workflow, population bounds, the **26-week versus 8-12-week open decision field**, per-metric definition table (numerator, denominator, source, baseline, target, suppression), pricing block, pricing assumptions appendix, decision-maker/sponsor/champion fields, MAP reference | The controlled template is attachments-and-rules; this is the document. It does not replace it: the controlled rules still govern |
| [`../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md`](../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md) | Counsel-facing plain-language summary, exclusions, responsibility schedule, blockers | The business-readable version with metrics and timeline; links its exclusions rather than rewriting them | Different audience (counsel review vs customer reading) |
| [`../../commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md), [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md) | Offer shape; 26-week rule; lifecycle; 10-200 cohort checklist | Surfaces the length conflict and metric-count constraint as explicit fields | They state rules, not a proposal |
| [`../../commercial/PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md), [`../../commercial/PILOT-SCORECARD.md`](../../commercial/PILOT-SCORECARD.md) | Metric definitions, blank scorecard | Eight requested metrics each mapped with numerator/denominator/source/baseline/target | The scorecard has no numerator/denominator columns |
| [`../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md`](../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md) | Work plan stages and exit evidence | Referenced for delivery; not repeated | n/a |
| [`MUTUAL_ACTION_PLAN_TEMPLATE.md`](MUTUAL_ACTION_PLAN_TEMPLATE.md) | (new) | Section 15 points to it | n/a |

## Gate (what is allowed now versus held)

| Allowed now | HELD |
| --- | --- |
| Share this draft for discussion and scoping with a qualified prospect (stage `proposal` entry needs `SALES_EXIT.proposal`: security/privacy/accessibility review started, answered from the RFP library) | Quoting or committing any fee, issuing an order form or invoice, accepting payment, loading live data, activating a tenant, committing a launch date, annual conversion terms, any customer reference or logo |

`pilotReadiness` in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts) **[VERIFIED]** returns `no_price` until the annual price is agreed, so a proposal built from this template cannot be "ready to kick off" while prices are `[PRICE TO BE CONFIRMED]`. That is intended.

---

# Proposal body (customer-facing once approved)

**Prepared for:** [Institution], [Sponsor name and title] **Date:** [DATE] **Valid until:** [DATE] **Version:** 0.1 draft

## 1. Executive summary **[DRAFT]**

[Institution] has told us that [problem in their words, with the milestone and date]. Semester proposes a bounded pilot of its Registration Readiness workflow with one cohort, [cohort], over [PILOT LENGTH, see section 5], to test whether [agreed outcome] changes for [defined population] by [metric] against a baseline captured before launch. The pilot ends in a written convert, expand, pause or stop decision on [CONVERSION DECISION DATE]. Nothing in this document commits either party; Semester has no live customers and is in a design-partner phase, and several prerequisites (listed in section 12) must close before any live use.

## 2. Current-state problem **[DRAFT]**

Workflow today: [steps and owners]. Where students lose time: [..]. Where staff lose time: [..]. What breaks most and when: [..]. Existing tools: [..]. How it is measured today: [..]. Cost of doing nothing, as stated by [name/role]: [..]. (Use their wording; no benchmarks, no figures from other institutions.)

## 3. Proposed workflow: Registration Readiness Pilot (default wedge) **[DRAFT]**

Students voluntarily use Semester beside existing systems to prepare for [registration / term start]: set up minimum context manually, see Today/This Week, receive one prioritized, source-labelled, reversible action (complete, schedule, snooze or defer), know where to get help, and track a non-authoritative readiness checklist. Official records, registration, grades, aid and advising decisions stay in the institution's systems. Details: [`../../commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md).

## 4. Target users and departments

| Group | Role in the pilot | Name / unit |
| --- | --- | --- |
| Students | Voluntary users | [cohort] |
| Advisors / student-success staff | Operators of the weekly review, support route | [unit] |
| IT / security / privacy / accessibility | Reviewers and approvers | [names] |
| Sponsor / champion | Decision maker / day-to-day owner | [names] |

## 5. Scope, non-goals, population and timeline

**Included:** [workflow items from the scope schedule]. **Non-goals (excluded unless separately approved and proven):** official-record writes; live SSO/SIS/LMS/LTI integration; admissions, aid, disability, health, counseling, immigration, discipline or emergency data; individual risk scoring; authoritative advising; automated registration; grade prediction; surveillance; system-of-record replacement. Full list: [`../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md`](../../legal-drafts/INSTITUTIONAL-PILOT-PROPOSAL-TEMPLATE-DRAFT.md).

**Population (one cohort, department or program):** [PLACEHOLDER: cohort], expected size [N]. Bounds: at least 10 and at most 200 students (the cohort checklist in [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md); under 10 cannot be reported without identifying people, over 200 cannot be supported by hand). The preferred target is 50-200. **[VERIFIED]** that `pilotReadiness` does **not** currently enforce cohort size in code; the bound is a checklist item for the reviewer.

**Timeline - [DECISION OPEN]** (founder decision; to be recorded as a `D-<pull request number>` decision):

| Field | Value |
| --- | --- |
| Code-enforced rule | `PILOT_WEEKS = 26` (182 days) in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts) (D-134): `pilotReadiness` returns `duration` unless end minus start is exactly 26 weeks. **[VERIFIED]** |
| Planning assumption (user's brief) | One academic term or 8-12 weeks **[ASSUMPTION]** |
| Which applies to this proposal | **[DECISION OPEN: 26 weeks / 8-12 weeks / 26-week pilot with an 8-12-week measured core window]** |
| If 8-12 weeks is chosen | The code rule must change (with a decision record and test) before a plan can pass `pilotReadiness`; until then a shorter plan is "not ready to kick off" |
| If 26 weeks is chosen | A single registration cycle may fall inside a shorter measurement window; state the *measurement window* separately from the pilot term |
| Proposed start / end / midpoint / conversion decision | [DATE] / [DATE] / [DATE] / [DATE]. Code rule: conversion decision falls from 14 days before to 30 days after the end date; midpoint date must exist |
| Implementation window before launch | [30-60 days **[ASSUMPTION]**] |

Do not send this proposal to a customer with the field unresolved without telling them the length is under review.

## 6. Data and integration assumptions

Manual or student-controlled input first; explicitly approved read-only sources only after review; no writes to institutional systems; minimum necessary data; every source labelled; sandbox data until production approval (`pilotDataMode`). Not in scope without separate approval: live roster, SSO, SIS/LMS/LTI. Data map attachment: [PLACEHOLDER: approved data-flow map]. See [`../../institutional-readiness/DATA-MAPPING-TEMPLATE.md`](../../institutional-readiness/DATA-MAPPING-TEMPLATE.md).

## 7. Responsibilities

| Area | Semester | [Institution] |
| --- | --- | --- |
| Scope, cohort and communications | Draft scope and student-facing wording | Confirm cohort, approve communications, invite students |
| Configuration | Configure only approved scope | Validate sources, approve configuration |
| Training and support | Provide training materials and a documented support route (hours and channel to be stated in writing; none promised here) | Name operators and a campus support contact |
| Security, privacy, accessibility | Provide evidence labelled by status; answer from the RFP library | Perform reviews; name approvers; accept or reject |
| Measurement | Supply definitions and aggregate reporting | Provide baseline data and a named analyst |
| Decision | Prepare the final value report | Decide convert / expand / pause / stop in writing |

Named owners with backups: [PLACEHOLDER RACI]. A role without a named person is an open gate.

## 8. Training and support plan **[DRAFT]**

Training: [session count, audience, format; accessible materials]. Support: [channel and hours **to be confirmed in writing**; best-effort for the pilot]. Escalation and incident route: [named contacts]. No uptime, response-time or 24x7 commitment is made (CLM-016).

## 9. Security, privacy and accessibility scope

Only verified items, each with evidence. Pull from [`../../trust/CONTROL-FACTS.md`](../../trust/CONTROL-FACTS.md) (generated), [`../../trust/EVIDENCE-REGISTER.md`](../../trust/EVIDENCE-REGISTER.md) and [`../../trust/HECVAT-READINESS-MATRIX.md`](../../trust/HECVAT-READINESS-MATRIX.md).

| Statement | Label | Evidence |
| --- | --- | --- |
| Row-level security is enabled on every table created in migrations; this is a count of migration text and does not show the control operates in production | [VERIFIED] | `docs/trust/CONTROL-FACTS.md` |
| Automated accessibility checks run on selected routes; no qualified manual review, no VPAT/ACR | [VERIFIED] (CLM-007); WCAG conformance **not claimed** (CLM-008) | [`../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| Independent security assessment, penetration test, SOC 2, HECVAT completion | **Not evidenced** - say so | GO-NO-GO blocking item 2 |
| Data processing agreement | Draft under counsel review, not executed [REVIEW: counsel] | [`../../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md`](../../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md) |

Reviews required before activation: [REVIEW: security] [REVIEW: privacy] [REVIEW: accessibility] [REVIEW: procurement].

## 10. Success metrics and baseline

**Constraint:** `pilotReadiness` requires **3 to 5** metrics, each with a baseline (`metric_count`, `metric_baseline`). Of the eight below, choose at most five as **primary** (decision metrics) in the signed plan; the rest are reported as diagnostic. Cohort cells with fewer than **10** people are suppressed (aggregation floor, [`../../INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md)); report "suppressed", never zero. Definitions are frozen and versioned before launch. All targets are **[ASSUMPTION]** until the customer approves them. Frozen-definition detail: [`../../commercial/PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md).

| # | Metric | Definition | Numerator / denominator | Source | Baseline | Target | Primary? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | Activation | Eligible student completes approved minimum setup | Students completing setup / eligible invited students | Validated product event, approved roster | [captured by DATE] | [X%] [ASSUMPTION] | [Y/N] |
| M2 | First meaningful action | Student reaches Today and intentionally completes, schedules, snoozes or defers one prioritized action | Students with first win within [N] days of setup / activated students (incomplete attempts reported as censored) | Validated event + sample QA | [..] | [..] [ASSUMPTION] | [Y/N] |
| M3 | Workflow completion | Approved readiness checklist items completed (non-authoritative) | Completed items / assigned items, per student then aggregated | Checklist aggregate | [..] | [..] [ASSUMPTION] | [Y/N] |
| M4 | Weekly active use | Student completes a meaningful planning action in the week (raw logins excluded) | Students with a planning action in week / activated students | Privacy-reviewed aggregate | [..] | [..] [ASSUMPTION] | [Y/N] |
| M5 | Staff time / support-friction reduction | Change in staff time on agreed repetitive questions per 100 students | (baseline minus pilot-period contacts in agreed category) / baseline, per 100 students | Customer's helpdesk/case system; minutes from sampled timing | [..] | [..] [ASSUMPTION] | [Y/N] |
| M6 | Student confidence / satisfaction | Self-reported clarity and confidence about registration steps | Respondents agreeing / respondents (report response rate) | Approved survey at midpoint and final | [pre-pilot pulse] | [..] [ASSUMPTION] | [Y/N] |
| M7 | Support issue reduction | Change in volume of agreed issue category | Pilot-period issues per 100 students / baseline per 100 | Customer's support system and Semester's staffed queue | [..] | [..] [ASSUMPTION] | [Y/N] |
| M8 | Conversion readiness | Share of the conversion-readiness checklist (final value report) met by the decision date | Items met / items required | Final value report checklist | n/a | all required met | Decision input |

Self-reported and usage measures are non-causal. No GPA, retention, graduation or wellbeing claims; nothing is promised (section 14).

## 11. Cadence, midpoint and final review

Weekly pilot report ([`../templates/WEEKLY_PILOT_REPORT.md`](../templates/WEEKLY_PILOT_REPORT.md)) and review; midpoint executive review on [DATE] ([`../templates/MIDPOINT_EXECUTIVE_REVIEW.md`](../templates/MIDPOINT_EXECUTIVE_REVIEW.md)); final value review ([`../templates/FINAL_VALUE_REPORT.md`](../templates/FINAL_VALUE_REPORT.md)) before the conversion decision.

## 12. Risks and dependencies

| Item | Owner | Date |
| --- | --- | --- |
| Security, privacy, accessibility review completed and accepted by the customer | [name] | [DATE] |
| Counsel-approved paper, signing authority on both sides | [name] | [DATE] |
| Named staffed support and monitoring on Semester's side | Harrison Rubin (interim) | [DATE] |
| Baseline captured and frozen | [customer analyst] | [DATE] |
| Cohort and data map approved | [name] | [DATE] |
| Any of the above fails: scope reduces, the date moves, or the result is "no fit" | | |

Semester-side gates that must close before launch: see GO-NO-GO blocking items 1-10 in [`../../../GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md). State to the customer which are open.

## 13. Pricing - **[PRICE TO BE CONFIRMED]** **[REVIEW: counsel] [REVIEW: tax]**

No price is approved (CLM-015 PROHIBITED; [`../../commercial/PRICING-AND-PACKAGING.md`](../../commercial/PRICING-AND-PACKAGING.md)).

| Item | Amount | Basis | Terms |
| --- | --- | --- | --- |
| Pilot fee | **[PRICE TO BE CONFIRMED]** (or "no-fee design-partner term" if approved by authorized paper) | [..] | [..] |
| Implementation fee | **[PRICE TO BE CONFIRMED]** | [..] | [..] |
| Annual conversion price | **[PRICE TO BE CONFIRMED]** | [..] | Any pilot credit: [none / PLACEHOLDER] |
| Taxes, expenses, payment schedule, PO requirements | [to be set by authorized paper] | | |

Acceptance of any paid term is **held** (paid pilot NO-GO/RED).

## 14. Non-guarantee language **[REVIEW: counsel]**

This pilot is a structured evaluation. Semester does not guarantee any outcome, including usage, time or cost savings, retention, graduation, GPA or wellbeing effects. Results depend on the cohort, the baseline and many factors outside Semester's control, and will be reported with their limitations. Conversion is a separate decision for [Institution] and a new transaction; it is never automatic. Either party may decide to stop. Dates and capabilities are plans until both parties accept them in signed paper.

## 15. Decision, people and next steps

| Field | Entry |
| --- | --- |
| Conversion decision date | [PLACEHOLDER] (within -14 / +30 days of end date per `pilotReadiness`) |
| Named decision maker | [PLACEHOLDER: name, title, authority] |
| Named executive sponsor | [PLACEHOLDER] |
| Named champion | [PLACEHOLDER] |
| Semester owner | Harrison Rubin (interim) |
| Mutual action plan | See [`MUTUAL_ACTION_PLAN_TEMPLATE.md`](MUTUAL_ACTION_PLAN_TEMPLATE.md); version [..] attached |

`pilotReadiness` also requires an executive sponsor, an operational champion, a data plan (minimum necessary, read-only first, source labelled), a midpoint date and an agreed annual price before kickoff.

## 16. Signature

Not signable. A separate counsel-approved pilot agreement ([business outline](../templates/PILOT_AGREEMENT_BUSINESS_OUTLINE.md)) is required.

---

# Appendix A. Pricing assumptions **[INTERNAL - do not send]** **[ASSUMPTION]**

Remove this appendix before the document leaves Semester. These are the founder's planning assumptions as of 2026-10-05, **not** a price book, quote or public commitment (CLM-015). Provenance: user's planning brief.

| Item | Planning assumption | Label |
| --- | --- | --- |
| Institutional platform | $18 per enrolled student per year; **$30,000 annual minimum** | [ASSUMPTION] |
| Institutional AI | 2,400 pooled governed requests per enrolled student per year (200 per month planning average) | [ASSUMPTION] |
| AI overage | $30 per 1,000 requests beyond the pool | [ASSUMPTION] |
| Implementation | $35,000 to $150,000 one-time | [ASSUMPTION] |
| Premium support | 15% of annual platform fee, **$15,000 minimum** | [ASSUMPTION] |
| Partner/marketplace commission | 12%, modelled separately; the core must be viable without it | [ASSUMPTION] |
| Student Premium (individual, not part of this proposal) | $8.99/month or $69/year (user's assumption) | [ASSUMPTION] |

**Conflicts on record for the individual price:** D-134 set Plus at $7.99/month or $59/year; D-1154 (2026-10-04) replaced it with $15/month with the yearly price unstated ([`../../decisions/D-1154.md`](../../decisions/D-1154.md)); the user's assumption is $8.99/$69. None is an approved price book. The institutional prices above appear in no decision record; D-1154 says only "institution prices matched to LMS vendors", unspecified.

**Arithmetic a seller must understand (not to be quoted):**

| Observation | Working |
| --- | --- |
| The $30,000 minimum binds below 1,667 enrolled students | $30,000 / $18 = 1,666.7 |
| A pilot cohort of 10-200 students at $18 is $180-$3,600 per year if prorated, far below the minimum; the pilot fee therefore cannot be derived from the annual unit price | 200 x $18 = $3,600 |
| Premium support minimum binds below $100,000 of platform fee | $15,000 / 0.15 = $100,000 |
| Pooled AI for 1,667 students | 1,667 x 2,400 = about 4.0M requests/yr (333k/month) |

A pilot price, implementation fee and any pilot credit are **[DECISION OPEN]** for the founder with finance, tax and counsel (D-<pull request number> to be recorded). Cost-side detail: [`../../finance/03-COST-MODEL.md`](../../finance/03-COST-MODEL.md), [`../../finance/02-PRICING-PACKAGING-ENTITLEMENTS.md`](../../finance/02-PRICING-PACKAGING-ENTITLEMENTS.md).

## Evidence state

**Repository evidence. [VERIFIED]** Controlled templates, `pilotReadiness`, stage gates, claims register exist.

**Operational evidence.** No customer, scope, price, signed order, staffed support or launch authorization exists.

**Missing proof.** Complete every field; resolve the pilot-length decision and prices; counsel, finance, security, privacy, accessibility and customer review; executed paper; named-tenant UAT; launch GO.

## Claim ceiling

Semester may present a clearly non-binding, conditional proposal to a qualified prospect for discussion.

## Prohibited claims

Do not describe an incomplete or unsigned proposal as contracted revenue, a customer, an approved deployment, a committed date or final price. Do not state customers, measured outcomes, certifications, conformance, uptime, or SSO/SCIM/LTI availability.

## Professional review required

[REVIEW: counsel] whole document and section 14; [REVIEW: tax] and [REVIEW: accounting] pricing and billing; [REVIEW: procurement] on the customer side; [REVIEW: security] [REVIEW: privacy] [REVIEW: accessibility] section 9.
