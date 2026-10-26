# Discovery Call Script, Qualification Rubric, Demo Script and Pilot Design-Session Agenda

| Control | Value |
| --- | --- |
| Status | **[DRAFT] OPERATING SCRIPT - NOT APPROVED. AUTHORIZED USE: NON-ACTIVATION DISCOVERY, SYNTHETIC DEMO, EVIDENCE EXCHANGE, CONDITIONAL SCOPING ONLY** |
| Owner | Harrison Rubin (interim, single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: security] [REVIEW: accessibility] |
| Audience | **[INTERNAL]** (the seller's script and CRM notes). Questions may be read aloud; the scoring rubric, thresholds and notes are never sent to a prospect |

> Operating document, not legal, tax, accounting, insurance, privacy, security or accessibility advice. Nothing here is a price, offer or commitment.

Label legend: **[VERIFIED]** proved by a repository path or evidence id; **[ASSUMPTION]** planning number or timing; **[DRAFT]** new, needs review; **[APPROVED]** customer-facing wording with a named approver (none exist in this document); **[INTERNAL]** never sent as-is.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`../../commercial/DISCOVERY-CALL-SCRIPT.md`](../../commercial/DISCOVERY-CALL-SCRIPT.md) | Controlled opening, the list of things to ask, authority probes, the close, claim ceiling | Word-for-word question bank grouped by problem / stakeholder / commercial, the exact close sentence, pre-call research, a 0-3 scorecard, call-note template, post-call CRM update and follow-up | The controlled script is a one-page brief; a seller needs usable wording and records. This file links to it for the controlled boundary and does not replace it |
| [`../../market-readiness/DISCOVERY-CALL-PLAYBOOK.md`](../../market-readiness/DISCOVERY-CALL-PLAYBOOK.md) | Disqualify/defer conditions; "never end with an unowned send information" | Those conditions become the disqualifier list and next-step rule below | Same |
| [`../../commercial/ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md) and [`../../market-readiness/SALES-QUALIFICATION-SCORECARD.md`](../../market-readiness/SALES-QUALIFICATION-SCORECARD.md) | The controlled ten-criterion 0-2 qualification score (0-20) with bands 16-20 / 11-15 / 0-10 and the automatic disqualifiers | A call-level 0-3 version of the same ten criteria so a seller can record nuance. **The controlled 0-20 score still governs stage entry** (see "Reconciling the two scores") | Different granularity and purpose; reconciliation is an open decision |
| [`../../commercial/DEMO-SCRIPT-EXECUTIVE.md`](../../commercial/DEMO-SCRIPT-EXECUTIVE.md), [`-OPERATIONAL`](../../commercial/DEMO-SCRIPT-OPERATIONAL.md), [`-TECHNICAL`](../../commercial/DEMO-SCRIPT-TECHNICAL.md) | Full timed demo flows, synthetic/non-activation rules | Only a role-to-demo selector, gate and honest-answer table. Flows are cited, not duplicated | The demo scripts are authoritative |
| [`../../commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md), [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md), [`../../commercial/PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md) | The pilot's shape, lifecycle and metric definitions | A 90-minute design-session agenda and baseline-capture sheet that feeds those documents | None of them has a facilitation agenda |
| [`PILOT_SALES_EMAIL_SEQUENCES.md`](PILOT_SALES_EMAIL_SEQUENCES.md) | Outbound and follow-up email sequences | This file's post-call step points to its sequence #5 | Keeps one home for email copy |
| [`../../../app/src/lib/gtm/stages.ts`](../../../app/src/lib/gtm/stages.ts) | Stage identifiers and `SALES_EXIT` gates | CRM stage names below use those identifiers exactly | Code is authoritative |

## Gate (what is allowed now versus held)

Source: [`../../../GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) (2026-10-03). **[VERIFIED]**

| Allowed now (design-partner institutional pilot = GO/GREEN, non-activation only) | HELD until the named gate flips |
| --- | --- |
| Discovery calls, synthetic demos, evidence exchange, fit/limitation review, conditional non-binding scoping, design-session workshops | Price quote, order form, invoice, payment (paid institutional pilot = NO-GO/RED) |
| Collecting the prospect's own baseline *definitions* and aggregate counts they volunteer | Live customer or student data, tenant activation, launch date commitment |
| Describing the pilot as a proposed offer with explicit conditions | Annual conversion terms, case study, reference, logo, customer name in any collateral (CLM-013) |

If a prospect asks to start, pay or load data: say what is held and why (section "Honest answers"), record the request, and keep the account at a pre-contract stage.

## Part 1. Pre-call research checklist **[DRAFT]**

Complete 20-30 minutes before the call; record each item with source and date in the CRM (role and work address only for contacts; no personal data beyond that, per [`../../INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md)).

- [ ] Institution type, headcount band and first-year/transfer/advising structure, from public sources only.
- [ ] Next registration or term-start milestone and its public dates.
- [ ] Named sponsor candidate and operational champion candidate (role, public page); who introduced the contact (referral source).
- [ ] Current public tools in the workflow (LMS, advising platform, degree audit) as the institution describes them. Do not guess private contracts.
- [ ] Public accessibility statement, privacy policy, procurement page, or vendor-security page (what they will ask for).
- [ ] Any public RFP or fiscal-year calendar hint (budget cycle).
- [ ] Conflict check: is this the founder's own institution? If yes stop and route to counsel first (strategy risk SR-007 in [`../../strategy/RISK-REGISTER.md`](../../strategy/RISK-REGISTER.md)).
- [ ] Target score already recorded (see [`../../commercial/ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)); account is at `target_account` or `discovery`.
- [ ] Re-read the Gate table above and [`../../commercial/DISCOVERY-CALL-SCRIPT.md`](../../commercial/DISCOVERY-CALL-SCRIPT.md).
- [ ] Note template (Part 5) open, and a scribe or consent to take notes agreed.

## Part 2. The call **[DRAFT]**

Target 45 minutes: opening 5, problem 15, stakeholders 10, commercial/timeline 8, close 5, buffer 2. Never collect student records or sensitive case examples; if offered, decline and ask for the aggregate pattern.

### 2.1 Opening (5 min)

> "Thank you for the time. I would like to understand the student workflow and the decision you need to make before I show you anything. Semester is in a design-partner phase: I can talk, demo on synthetic data and scope something with you, but I cannot turn on live data or take payment yet, and I will be specific about what is available now, what would need a bounded pilot, and what does not exist. Is it all right if I take notes, and what would make this a useful 45 minutes for you?"

Confirm: the person's role and their own words for their remit; who else should have been on the call.

### 2.2 Problem questions (15 min)

| # | Ask (verbatim) | Listen for / record |
| --- | --- | --- |
| P1 | "Walk me through how a student gets from [milestone, e.g. admitted to first registration] today, step by step. Who touches it?" | Steps, handoffs, systems, dates |
| P2 | "Where do students lose time, and where do your staff lose time?" | Two lists, separately; quantities in the interviewee's units |
| P3 | "What breaks most often, and when in the term?" | Failure mode, peak weeks, volume (aggregate, e.g. contacts per week) |
| P4 | "What tools or processes are you using for this already?" | Incumbent tool, contract end date if volunteered, what they like |
| P5 | "When it fails, what happens? What does a student or a staff member do next?" | Consequence, fallback, escalation route |
| P6 | "How do you measure whether this is working today? Is there a number someone reports?" | Existing baseline, owner, system of record, frequency; "no number" is a valid, important answer |
| P7 | "What happens if you do nothing for the next two terms?" | Cost of inaction, urgency, who cares |
| P8 | "If we picked one cohort or program to start with, which would it be and about how many students?" | Cohort candidate; compare to bounds 10-200 (see Part 4) |

### 2.3 Stakeholder questions (10 min)

| # | Ask | Record |
| --- | --- | --- |
| S1 | "Who feels this pain most day to day?" | Pain owner (champion candidate) |
| S2 | "Who owns the budget this would come from?" | Economic buyer, or "unknown" |
| S3 | "Who would assess security for a tool like this? Privacy? Accessibility? Procurement? Legal?" | One row per function (map to `COMMITTEE_ROLES` in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts): executive_sponsor, operational_owner, cio, ciso_privacy, accessibility, registrar_data_governance, procurement, legal, finance, champion) |
| S4 | "Who would have to approve a pilot, and who signs?" | Approver, signatory, delegation limits |
| S5 | "Who could block this, and what would their first concern be?" | Blocker, objection, evidence they would ask for |
| S6 | "Have you run a pilot with an outside vendor before? How long did approval take?" | Path, precedent, calendar |

### 2.4 Commercial and timeline questions (8 min)

| # | Ask | Record |
| --- | --- | --- |
| C1 | "Where would money for something like this come from, if it were approved: an existing line, a grant, a pilot fund?" | Budget source, fiscal-year timing. **Do not state any price on this call (CLM-015)** |
| C2 | "When does a decision need to be made for it to matter for [milestone]?" | Decision deadline, working backwards from the milestone |
| C3 | "What would make a pilot too risky for you to approve?" | Disqualifiers, hard requirements (SSO, SOC 2, VPAT, SIS writeback) |
| C4 | "What proof would justify moving from a pilot to an annual agreement?" | Conversion evidence, threshold, who decides |
| C5 | "How long is your usual path from a yes in principle to a signed agreement?" | Procurement cycle estimate (feeds timeline conflict, see [`PILOT_PROPOSAL_TEMPLATE.md`](PILOT_PROPOSAL_TEMPLATE.md)) |

### 2.5 The close (5 min) **[DRAFT]**

Restate in their words: problem, cohort, scope, exclusions, how they measure it, data/authority, stakeholders, open evidence. Then use this sentence exactly, filling the brackets only with what the prospect has agreed on the call:

> "If Semester could improve **[agreed outcome]** for **[defined population]** by **[metric]** within **[pilot timeframe]**, would you be open to a scoped pilot proposal with explicit success criteria and a conversion decision?"

If yes: agree owner, artifact, date and decision (never "I will send some information"). Offer one of: synthetic demo for the named roles, evidence exchange, or the design session (Part 4). If no or unsure: record the reason code and offer a documented no-fit. Do not promise capability, price, launch date, compliance or outcome. **Note:** a claim that Semester "could improve" an outcome is a hypothesis stated to test interest, not a statement of results; no outcome has been measured (CLM-014).

## Part 3. Honest answers where a capability is not available **[VERIFIED] / [DRAFT]**

Answer from [`../../commercial/DISCOVERY-CALL-SCRIPT.md`](../../commercial/DISCOVERY-CALL-SCRIPT.md), [`../../institutional-readiness/INSTITUTIONAL-KNOWN-LIMITATIONS.md`](../../institutional-readiness/INSTITUTIONAL-KNOWN-LIMITATIONS.md) and [`../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md); do not improvise.

| They ask | Say (plain and honest) | Claim ref |
| --- | --- | --- |
| "Do you have SSO / SCIM / LTI / SIS integration?" | "Not available today. It is planned and would be scoped and proven with your IT in a pilot. We start with manual or approved read-only inputs." | CLM-005 |
| "Are you SOC 2 / FERPA compliant / HECVAT complete / pen-tested?" | "No certification or independent assessment exists yet. I can share what is documented, labelled by what is implemented in code versus independently verified, and the independent security assessment is a gate we have not passed." | CLM-010; evidence in [`../../trust/EVIDENCE-REGISTER.md`](../../trust/EVIDENCE-REGISTER.md) |
| "Is it WCAG / do you have a VPAT?" | "There are automated accessibility checks on selected routes. No qualified manual review or VPAT exists yet." | CLM-007, CLM-008 |
| "Who else uses it? Can we talk to a customer?" | "There are no customers or pilots yet. You would be among the first, which is why I propose tight scope, baselines and an exit." | CLM-013 |
| "What does it cost?" | "I am not able to quote today; pricing is not approved. I can tell you how we would structure the conversation once it is." | CLM-015 |
| "What is your uptime / support SLA / RTO?" | "No measured targets or contractual SLAs exist; a pilot would carry best-effort support defined in writing." | CLM-016 |
| "What outcomes have you seen / how much time does it save?" | "None measured yet. The pilot is designed to measure it against your baseline." | CLM-014 |
| "Can we start next month and load our roster?" | "Not yet: live data and activation are held until security, accessibility, legal and support gates close. I can do discovery, a synthetic demo and a scoping design session now." | GO-NO-GO |
| "Does it replace our LMS/SIS?" | "No. It sits beside your systems; official records stay where they are." | CLM-006 |

## Part 4. Qualification rubric and scorecard **[DRAFT] / [ASSUMPTION]**

### 4.1 Score each criterion 0-3 (call-level, from evidence stated on the call)

| # | Criterion (same ten as the controlled scorecard) | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- | --- |
| 1 | Urgent milestone | none named | named, no date | dated, within 2 terms | dated, with a consequence if missed |
| 2 | Defined cohort (10-200 bound; target 50-200) | none | vague group | one group, size unknown or outside 10-200 | one group, size inside 10-200, identifiable |
| 3 | Empowered champion | none | interested, no authority | owns the workflow | owns the workflow and will run the weekly review |
| 4 | Economic buyer | unknown | named, no access | access via champion | met or confirmed willing |
| 5 | Security/privacy/accessibility contacts | unknown | named functions | named people | named people, engaged, requirements stated |
| 6 | Budget / procurement path | none | guessed | described by prospect | described with owner and calendar |
| 7 | Implementation feasibility in a short window (30-60 days to launch is the offer's assumption) | needs integration/writes | needs approvals of unknown length | feasible with identified approvals | feasible, approvals scheduled |
| 8 | Manual / read-only fit | requires SIS/LMS write or live roster | prefers integration | accepts manual start | prefers manual start, no writeback |
| 9 | Measurable baseline and outcome | no baseline | baseline unknown | baseline exists, not shared | baseline owner named and will share |
| 10 | Conversion decision date and criteria | none | "maybe later" | date | date, owner, evidence threshold |

Maximum 30. Record the evidence quote beside every score.

### 4.2 Bands **[ASSUMPTION]** (uncalibrated; no closed deal exists to calibrate against)

| Total | Meaning | Action |
| --- | --- | --- |
| 24-30 | Qualified, subject to disqualifiers | Propose demo for named roles and design session |
| 15-23 | Nurture / resolve named gaps | Record the lowest-scoring criteria; one follow-up; re-score |
| 0-14 | Disqualify or revisit later | Close with reason code and future-contact rule |

### 4.3 Automatic disqualifiers (any one overrides the total) **[VERIFIED]** from [`../../market-readiness/SALES-QUALIFICATION-SCORECARD.md`](../../market-readiness/SALES-QUALIFICATION-SCORECARD.md) and the discovery playbook

Prohibited high-impact AI use; surveillance or individual risk scoring; a required unsupported compliance or certification (record it as an accepted prerequisite or a disqualifier); a required SIS/LMS write before approval; no lawful data authority; no champion; a demand to waive a P0/P1; economics below delivery and support cost; cohort under 10 or over 200 without a separate capacity review; expectation of 24x7 service; a schedule that bypasses trust review or UAT.

### 4.4 Reconciling the two scores **[DECISION OPEN]**

The controlled gate for `qualified` is the 0-20 score in [`../../commercial/ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md) plus the `SALES_EXIT.qualified` rule in `stages.ts` ("a named champion, a stated problem in their words, a budget cycle and a decision process"). Until the founder decides how 0-3 maps to 0-2, **record both**: the 0-3 score here for nuance and the controlled 0-20 score for the stage gate. Do not publish or forecast from the 0-3 total.

## Part 5. Call note template **[DRAFT] / [INTERNAL]**

```text
Account: [Institution]          Stage on entry: [stage id]         Date: [YYYY-MM-DD]
Attendees (role, authority): [Role - decision / influence / none] ...
Referral / source: [..]         Conflict check done: [Y/N]
Problem in their words (verbatim, with the milestone date): "[..]"
Workflow today (steps, tools, handoffs): [..]
Time/friction by group (students | staff): [units as they state them]
Existing measure / baseline owner / system: [..]
Cohort candidate and size: [..]  (inside 10-200? Y/N)
Data & integration need they stated: [manual | read-only | integration | writeback]
Committee map: sponsor [..] champion [..] CIO [..] security/privacy [..] accessibility [..] registrar [..] procurement [..] legal [..] finance [..]
Budget source / fiscal timing: [..]    Decision deadline: [..]
What would make a pilot too risky: [..]
Proof for annual adoption: [..]
Disqualifiers observed: [none | list]
Honest answers given (claim refs): [..]
Score 0-3 per criterion + evidence: [1..10]   Total: [..]/30   Controlled 0-20 score: [..]
Close sentence used verbatim? [Y/N]  Response: [yes | unsure | no - reason code]
Next step: owner [..] artifact [..] date [..] decision [..]
Corrections they asked for: [..]
```

## Part 6. After the call **[DRAFT]**

| Within | Action | Where |
| --- | --- | --- |
| 2 hours | Complete the note; confirm no student or sensitive data was captured | CRM note (role and work address only for contacts) |
| 4 hours | Update the CRM: stage per `stages.ts` (`discovery` stays `discovery` until `SALES_EXIT.qualified` is met; then `qualified`), both scores, buying-committee roles mapped, decision-log entries opened for each open question (category, owner, target date, per `DecisionLogEntry` in `pilot.ts`), next action and due date, forecast category = Omitted until `qualified` | `gtm_*` tables / CRM per [`../../commercial/CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md) |
| 1 business day | Send the follow-up from [`PILOT_SALES_EMAIL_SEQUENCES.md`](PILOT_SALES_EMAIL_SEQUENCES.md), **sequence #5** (post-discovery follow-up and recap). Recap in their words; no price, date or capability promise | Email; log the activity |
| 2 business days | If proceeding: open a [`MUTUAL_ACTION_PLAN_TEMPLATE.md`](MUTUAL_ACTION_PLAN_TEMPLATE.md) in draft; if not: record `closed_lost` or nurture with a reason code and future-contact rule | CRM |
| Weekly | Item appears in the [`../templates/WEEKLY_REVENUE_REVIEW.md`](../templates/WEEKLY_REVENUE_REVIEW.md) | Review |

## Part 7. Demo script **[DRAFT]** (selector only; flows are in the controlled scripts)

**Gate (read before every demo).** Synthetic data only. No live data, no student record, no real roster, no customer logo, no customer name on screen or in the invitation. Environment is labelled demo/beta. Every surface is labelled "available in demonstrated scope", "pilot-dependent" or "planned/unavailable". If the prospect pastes real data, stop and say so. **[VERIFIED]** from [`../../commercial/DEMO-SCRIPT-OPERATIONAL.md`](../../commercial/DEMO-SCRIPT-OPERATIONAL.md).

| Role in the room | Use | Length | Show (synthetic) | Do not show or say |
| --- | --- | --- | --- | --- |
| Executive sponsor / provost office | [`DEMO-SCRIPT-EXECUTIVE.md`](../../commercial/DEMO-SCRIPT-EXECUTIVE.md) | 10-15 min | Student first win, aggregate evidence view labelled synthetic, scope and decision date, open gates | Outcomes, ROI, other institutions |
| Student-success / advising / registrar operations | [`DEMO-SCRIPT-OPERATIONAL.md`](../../commercial/DEMO-SCRIPT-OPERATIONAL.md) | 30 min | Cohort setup (manual), Today/This Week, source and freshness labels, correction/defer/help, support intake concept | Official registration status, individual risk views |
| CIO / IT / security / privacy | [`DEMO-SCRIPT-TECHNICAL.md`](../../commercial/DEMO-SCRIPT-TECHNICAL.md) | 45-60 min | Architecture and data flow, roles/tenancy concepts, lifecycle (export/deletion), integration states as labelled | "Secure", "compliant", SSO/LTI as available; exploit detail |
| Accessibility / disability services | Operational demo plus [`../../institutional-readiness/INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md`](../../institutional-readiness/INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md) | 20 min | Keyboard path, zoom, plain-language controls; state no VPAT/manual audit exists | WCAG conformance |
| Procurement / finance / legal | No demo; evidence exchange (security overview, draft DPA, limitations) | 30 min | Documents labelled draft | Price, terms, "standard contract" |
| Student representative | Operational demo, student segment only | 15 min | First-win flow; what stays local; how to say no | Any hint of monitoring |

Close every demo with the same decision question as the call close and a dated next step. Log: attendees' roles, top objection per stakeholder, evidence requested, no statement outside the claims register (exit of `multi_stakeholder_demo` per ACCOUNT-SCORING).

## Part 8. Pilot design-session agenda **[DRAFT]**

Purpose: leave with the decisions that let a proposal be written. Held after `qualified`, within `outcome_workshop` (buying committee mapped). 90 minutes; attendees: sponsor, champion, one IT/security or privacy representative, optionally a student rep. Non-binding, no live data; baselines are definitions and aggregate counts the customer volunteers.

| Time | Item | Output |
| --- | --- | --- |
| 0-10 | Frame: what this session decides, what is held (Gate table), non-binding | Shared understanding |
| 10-25 | The workflow and milestone: pick one workflow (default wedge: Registration Readiness) and the dates | Named workflow, milestone date |
| 25-40 | Cohort: one program/department, size, how invited, voluntary participation, minors check | Cohort definition, size within 10-200, who invites |
| 40-60 | **Baseline capture** (below): for each candidate metric, the definition, system, owner and whether a baseline exists | Baseline sheet filled |
| 60-72 | Data and integration: manual/read-only first, what data is *not* used, who approves | Data plan draft, owners |
| 72-82 | Governance and timeline: weekly review, midpoint, final; **pilot length decision** (26-week code rule versus 8-12 week assumption, see [`PILOT_PROPOSAL_TEMPLATE.md`](PILOT_PROPOSAL_TEMPLATE.md)) | Dates proposed; conflict recorded |
| 82-90 | Decisions and owners; next artifact and date | Decision list |

**Decisions to leave with:** (1) one workflow and cohort; (2) sponsor, champion and decision maker named; (3) approver list for security, privacy, accessibility, procurement, legal; (4) what evidence each approver needs; (5) draft metric set (3-5 primary, per `pilotReadiness` metric_count) with owners; (6) conversion decision date and the evidence that would justify annual adoption; (7) stop conditions; (8) open items and who owns them.

**Baseline-capture sheet** (one row per candidate metric; a metric without a baseline owner is dropped or flagged, since `pilotReadiness` refuses a metric with no baseline):

| Metric | Definition (their words) | System / owner | Baseline value or "to be captured by [date]" | Period | Aggregate only? (suppress < 10) | Label |
| --- | --- | --- | --- | --- | --- | --- |
| [e.g. contacts about registration steps per 100 students in the milestone window] | [..] | [..] | [..] | [..] | Yes | [ASSUMPTION] until the customer confirms |

## Evidence state

**Repository evidence. [VERIFIED]** Controlled scripts, scorecard, stage vocabulary, gate decision and claims register exist at the paths cited.

**Operational evidence.** No discovery call, qualified opportunity, demo or design session has been run with a named prospect; the 0-3 bands are untested.

**Missing proof.** Run and file at least three discovery calls, compare 0-3 and 0-20 outcomes, then decide the mapping.

## Claim ceiling

Semester may say it is in a design-partner phase, offers discovery, synthetic demos and conditional scoping, and proposes a bounded pilot with explicit success criteria and a conversion decision.

## Prohibited claims

Do not state or imply customers, pilots, case studies, measured outcomes, SOC 2, FERPA/COPPA/GDPR compliance, HECVAT completion, penetration testing, uptime/RTO/RPO, WCAG/VPAT conformance, SSO/SCIM/LTI availability, a price, or that live data or payment is accepted.

## Professional review required

Call-recording or note-taking consent and whether discovery interviews need consent or institutional review: **[REVIEW: counsel]** (open per [`../../finance/11-PILOT-EVIDENCE-PLAN.md`](../../finance/11-PILOT-EVIDENCE-PLAN.md)). Demo claims about security, privacy and accessibility: **[REVIEW: security]**, **[REVIEW: privacy]**, **[REVIEW: accessibility]**.
