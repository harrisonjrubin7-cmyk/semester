# CRM Pipeline Definition (funnel, stages, forecast and hygiene)

| Control | Value |
| --- | --- |
| Status | **[DRAFT] - NOT APPROVED. Maps the founder's twelve-step funnel plus Closed-lost and Dormant onto the implemented sixteen-stage vocabulary; no probability, amount or forecast is approved or asserted** |
| Owner | Harrison Rubin (interim, single point of failure; backup seller, finance reviewer and deal desk unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: privacy] [REVIEW: counsel] [REVIEW: accounting] |
| Audience | Internal |

> Operating document, not legal, tax, accounting, insurance, privacy, security or accessibility advice.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`stages.ts`](../../../app/src/lib/gtm/stages.ts) | `SALES_STAGES` (16), `ACCOUNT_STATUS_OF`, `SALES_EXIT` (7 gated stages), `salesMoveProblems` | A crosswalk from the founder's funnel names to those identifiers, with every mismatch flagged as a GAP; no identifier is invented | Code is the authority; this document only maps to it |
| [`SALES-PIPELINE-DEFINITIONS.md`](../../commercial/SALES-PIPELINE-DEFINITIONS.md) | Required evidence per stage; vocabulary crosswalk; forecast and hygiene paragraph | Per-stage entry, exit, fields, owner, ageing and gate-held status in one place keyed to the funnel the founder uses | That document keys on code identifiers, not the funnel names used in outreach and reporting; it must stay the controlled definition |
| [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md) | Target score and qualification score (0-20 each), tiers A/B/C, exit checklists for the nine ungated stages, forecast categories, "no stage probability approved" | Reused unchanged. Adds a gate-state override for forecast categories and a delta of fields (section "Account scoring: reuse and delta") | Scoring is the source; the delta is proposed for its owner |
| [`CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md) | Entities, minimum fields, exclusions, privacy boundary | The 100-account list template and the per-stage required fields | The model is entity-level; the list template and stage-level fields are new |
| [`SALES-PLAYBOOK.md`](../../commercial/SALES-PLAYBOOK.md), [`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md) | Process; collateral by stage; sales-to-implementation handoff checklist | Linked from stage owner and evidence rows; not repeated | -- |
| [`REVENUE-OPERATIONS-DASHBOARD-SPEC.md`](../../commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md) | Eight dashboard views and the data-quality rule | A concrete report list for the sales pipeline (section "Reports and dashboards") | The spec is finance-wide; this is the weekly sales view |
| [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md), [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts) | Four decision paths; `pilotVerdict` (signed decision) | The five-record pilot-complete stage-exit check (section "The pilot-complete rule") | The code enforces one of the five records; the other four are new |
| [`PILOT_SALES_EMAIL_SEQUENCES.md`](PILOT_SALES_EMAIL_SEQUENCES.md), [`OBJECTION_HANDLING_LIBRARY.md`](OBJECTION_HANDLING_LIBRARY.md) | (siblings) Emails and objections | Their CRM write-backs use the names in this document | -- |

## Gate (what is allowed now versus held) [VERIFIED]

Per [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) (2026-10-03): design-partner institutional work is GO for **non-activation** engagement only (discovery, synthetic demo, evidence exchange, conditional scoping). Paid institutional pilot is NO-GO / RED: no payment, no unconditional launch obligation, no live data, no tenant activation. Broad enterprise sale is NO-GO / RED.

| Pipeline zone | Funnel stages | Code stages | State today |
| --- | --- | --- | --- |
| Allowed now | Target accounts, Contacted, Discovery, Demo, Pilot design, Security/procurement review, and Pilot proposal **as a non-binding scoping summary only** | `target_account`, `discovery`, `qualified`, `multi_stakeholder_demo`, `outcome_workshop`, `technical_review`, `security_privacy_accessibility_review`, `proposal` (non-binding) | **OPEN** |
| Held (paid pilot onward) | Pilot SOW with price, Contracting, Activated pilot, Success achieved, Annual conversion, Expansion/Renewal | `pilot_or_implementation_SOW`, `procurement_legal`, `contracted`, `implementation`, `live`, `renewal`, `expansion` | **HELD**: a record may not be moved into these stages until the paid-pilot gate flips (condition below). They may be rehearsed on synthetic records only |
| Always available | Closed-lost, Dormant | `closed_lost`, account status `paused` | OPEN |

**Gate-flip condition** [VERIFIED then HELD]: blocking priorities 1-9 in `GO-NO-GO-DECISION.md` closed with retained evidence; a bounded design-partner engagement with an approved activation record and measured closeout; the `paid-institutional-manual-pilot` profile in [`release-profiles.ts`](../../../app/src/lib/governance/release-profiles.ts) passing for the named target; and a dated decision superseding the 2026-10-03 one. Activation of **any** pilot, paid or unpaid, with live data additionally requires priorities 1-8 and a launch-council go (`live` gate in `SALES_EXIT`).

## Open decisions this document cannot settle [INTERNAL]

| # | Conflict or gap | Treatment here | Owner |
| --- | --- | --- | --- |
| D1 | Pilot length: `PILOT_WEEKS = 26` (`pilot.ts`, D-134) versus the founder's "one academic term or 8-12 weeks" | 8-12 weeks is a planning assumption for the sales motion; 26 weeks is the code rule: `pilotReadiness` returns `duration` unless the plan is exactly 26 weeks. SLA rows for `implementation` and `live` use "per pilot plan" rather than a number | Founder; record as D-<PR number> |
| D2 | No code stage for "Contacted", "Success achieved", "Annual conversion" or "Dormant" | Flagged as GAPs in the crosswalk; no identifier invented | Founder, engineering |
| D3 | `ACCOUNT_STATUS_OF` maps `live` to `customer`, even for a design-partner pilot | Internal status only; never an external "customer" claim (CLM-013) | Founder |
| D4 | Prices conflict (D-134, D-1154, planning assumptions); no approved price book | Amount fields hold `[PRICE TO BE CONFIRMED]` or stay blank | Founder, Finance |

## 1. Funnel-to-code crosswalk [VERIFIED against `stages.ts`; mapping judgments are [DRAFT]]

`SALES_STAGES`, in order: `target_account`, `discovery`, `qualified`, `multi_stakeholder_demo`, `outcome_workshop`, `technical_review`, `security_privacy_accessibility_review`, `proposal`, `pilot_or_implementation_SOW`, `procurement_legal`, `contracted`, `implementation`, `live`, `renewal`, `expansion`, `closed_lost`. `ACCOUNT_STATUSES`: `target`, `engaged`, `pilot`, `customer`, `paused`, `closed_lost`.

| # | Funnel stage (founder) | Code stage identifier(s) | `ACCOUNT_STATUS_OF` | Match | Held now? |
| --- | --- | --- | --- | --- | --- |
| 1 | Target accounts | `target_account` | `target` | exact | no |
| 2 | Contacted | **none** | `target` (unchanged) | **GAP**: no code stage; evidenced by the first `email_sent` activity while the opportunity stays `target_account` | no |
| 3 | Discovery | `discovery` | `engaged` | exact | no |
| -- | (not in the funnel) | `qualified` | `engaged` | **code stage with no funnel stage**: a gated step between Discovery and Demo | no |
| 4 | Demo | `multi_stakeholder_demo` | `engaged` | exact (synthetic data only) | no |
| 5 | Pilot design | `outcome_workshop` | `engaged` | partial: `outcome_workshop` is "buying committee mapped", measures and baselines agreed. The pilot **plan** itself is the `pilot_or_implementation_SOW` gate | no |
| 6 | Security/procurement | `technical_review`, `security_privacy_accessibility_review` | `engaged` | partial: formal procurement and legal review is `procurement_legal`, which in code comes **after** the proposal and SOW; in the funnel it is mentioned earlier | no |
| 7 | Pilot proposal | `proposal`, `pilot_or_implementation_SOW` | `engaged` | exact for `proposal`; `pilot_or_implementation_SOW` requires "a pilot plan with no readiness problems" | `proposal` open as non-binding scoping only; `pilot_or_implementation_SOW` **HELD** |
| 8 | Contracting | `procurement_legal`, `contracted` | `engaged`, `pilot` | exact (two code stages) | **HELD** |
| 9 | Activated pilot | `implementation`, `live` | `pilot`, `customer` | `implementation` is configure and train in sandbox data mode; `live` is activation (launch council go) | **HELD** |
| 10 | Success achieved | **none** | `customer` (while in `live`) | **GAP**: no stage. It is an evidence state inside `live`, governed by the pilot-complete rule below | **HELD** |
| 11 | Annual conversion | **none as a stage**; `renewal` is entered by a signed final pilot verdict | `customer` | **GAP / partial**: the annual order is a new transaction (convert is a new proposal and review); the code has no separate stage for negotiating it. Treat as a new opportunity record, not a move | **HELD** |
| 12 | Expansion / Renewal | `expansion`, `renewal` | `customer` | exact (two code stages; renewal of an annual contract is its own opportunity 120 days before term end, per `SALES-PIPELINE-DEFINITIONS.md`) | **HELD** |
| 13 | Closed-lost | `closed_lost` | `closed_lost` | exact; reachable from anywhere; reopens only as a new `target_account` | no |
| 14 | Dormant | **none**; account status `paused` | `paused` | **GAP**: `paused` is an account status entered from any stage and left back to the stage it was in; it is not a stage | no |

### GAP register (no code stage; nothing invented)

| GAP | What exists instead | Proposed handling now | What a code change would need (engineering, not done here) |
| --- | --- | --- | --- |
| G1 Contacted | first `email_sent` activity | Report "Contacted" as a view: `target_account` opportunities with at least one `email_sent` activity | A stage or a derived flag; `stages.test.ts` fails if a stage disappears from documents, so any new stage needs documentation in `SALES-PIPELINE-DEFINITIONS.md` and `ACCOUNT-SCORING-AND-FORECAST.md` |
| G2 `qualified` absent from the funnel | `SALES_EXIT.qualified` | Keep it as a hidden gate; the funnel's "Discovery to Demo" move requires its evidence (`salesMoveProblems` flags a skip) | None |
| G3 Success achieved | `pilotVerdict` signed decision and the measured outcomes | Evidence state on a `live` opportunity, enforced by the pilot-complete check | A computed state or checklist in the pipeline tables |
| G4 Annual conversion | `renewal` entered by a signed final verdict | A new opportunity record of motion "new/annual", never a move of the pilot record, never counted twice | A motion field and a link from pilot to annual opportunity |
| G5 Dormant | account status `paused` | Use `paused` with `future_contact_rule`; the stage the opportunity was in is retained | None (status exists) |
| G6 Funnel order of procurement vs proposal | code order | Follow the code: security and technical review, then proposal and SOW, then `procurement_legal` | None |
| G7 Pilot design vs pilot plan | `outcome_workshop` vs `pilot_or_implementation_SOW` | Keep both; pilot design session output is the draft plan | None |

Move rules, enforced by `salesMoveProblems(from, to, met)`: forward only; a gated stage cannot be skipped; entering a gated stage needs its `SALES_EXIT` evidence in `met`; `closed_lost` from anywhere; a lost deal reopens only as a new `target_account` with fresh discovery. A regression (evidence later found false) pauses the account and blocks forward movement; it never moves backward.

## 2. Stage definitions [DRAFT]

Conventions. **Exit criteria** quote `SALES_EXIT` for the seven gated stages and the checklist in [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md) for the others. **SLA / ageing** values are `[ASSUMPTION]`, in business days unless stated; an opportunity is *stale* when its `next_action_due` has passed or when it has stayed longer than the ageing threshold. **Next-action rule**: every open opportunity has a `next_action` with an owner and a `next_action_due` no more than 14 days out [ASSUMPTION]; none means stale. **Forecast probability**: the scoring document states "the approved probability for every stage is **not approved**"; until a stage has an approved minimum sample its weight in any weighted figure is **0** and no number is shown. This document invents none. **Owner**: Harrison Rubin (interim; backup unassigned) for every stage; named professionals are unassigned.

Required fields use the entity names in [`CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md) (prose names, not yet columns: no data dictionary exists [GAP]) and the opportunity fields in the scoring document: `stage`, `stage_entered_at`, `next_action`, `next_action_due`, `target_score`, `qualification_score`, `tier`, `forecast_category`, `probability` (blank), `probability_source` (blank), `probability_approved_by` (blank), `loss_reason`, `future_contact_rule`.

### 2.1 Target accounts: `target_account` (status `target`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | An institution or unit fits the ICP hypothesis ([`IDEAL-CUSTOMER-PROFILE.md`](../../commercial/IDEAL-CUSTOMER-PROFILE.md)); a source is recorded (warm path or an observed need, never a fabricated relationship); an owner is assigned. Inbound institutional inquiry enters here, scored within two business days [ASSUMPTION, from the scoring document] |
| Exit criteria | Target score recorded with dated cited observations; no automatic disqualifier; owner assigned; a reason-for-outreach recorded and passing the RFO test in the email document; a contact exists with a work address from a public source. (Scoring doc: "target score recorded with cited observations; no automatic disqualifier; source is a real warm path or an observed need; owner assigned") |
| Required fields | account (stable ID, display name, `segment` from `gtm_accounts`: research, regional, community_college, liberal_arts, system, online, other), `tier`, `target_score`, source, owner, `rfo_type` and `rfo_source` (proposed, section 4), suppression state |
| Required evidence | Cited observations with dates (public URL, introduction); no student data, no inferred sensitive trait |
| Owner / SLA | Harrison Rubin; score within 2 days of creation; stale if untouched 90 days [ASSUMPTION; scoring doc treats a score as stale after 90 days] |
| Next-action rule | Tier A: begin Sequence 1 within the weekly volume cap; Tier B: discovery only if capacity allows and record the gap that would raise it; Tier C: hold with reason and future-contact rule |
| Forecast | `forecast_category` omitted; probability not approved (0) |
| Gate | Open |

### 2.2 Contacted: GAP (no code stage; opportunity stays `target_account`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | First outreach activity recorded (`email_sent`, call or introduction), after the send-approval checklist |
| Exit criteria | A reply that agrees to a discovery conversation (then `discovery` when it is held) or a recorded close (opt-out, `paused`, `closed_lost`) |
| Required fields | `email_sent` activity with sequence, touch, reason type, A/B arm; stakeholder `consent/contact basis` and `preference/suppression`; `last/next interaction` |
| Required evidence | The send record and RFO source; suppression check |
| Owner / SLA | Harrison Rubin; the four-touch cold run is about 16 business days [ASSUMPTION]; silent after touch 4 means `paused` |
| Next-action rule | The next touch of the active sequence, or a reply within 1 business day [ASSUMPTION] |
| Forecast | omitted; probability not approved (0) |
| Gate | Open |

### 2.3 Discovery: `discovery` (status `engaged`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | An authorized stakeholder agrees to a discovery conversation; meeting held |
| Exit criteria | An authorized stakeholder met; the problem in their words, the milestone date, the cohort size, the data and integration need and the procurement path recorded ([`DISCOVERY-CALL-SCRIPT.md`](../../commercial/DISCOVERY-CALL-SCRIPT.md)); qualification score computed; next step owned and dated |
| Required fields | stakeholder `committee_role`, problem in their words, milestone and date, cohort estimate, current systems, integration need, procurement path, `qualification_score` |
| Required evidence | Meeting record (`meeting_held`), recap sent (email 5.1); no student records or sensitive cases collected |
| Owner / SLA | Harrison Rubin; recap within 1 business day; stale after 30 days without a held next step [ASSUMPTION] |
| Next-action rule | Confirm recap; move to the `qualified` gate or record a disqualifier |
| Forecast | omitted; probability not approved (0) |
| Gate | Open |

### 2.4 Qualified gate: `qualified` (no funnel stage; status `engaged`)

| Attribute | Definition |
| --- | --- |
| Entry criteria (`SALES_EXIT`) | "A named champion, a stated problem in their words, a budget cycle and a decision process." |
| Exit criteria | Qualification score at least 16 and no red flag for "qualified"; 11-15 hold or nurture; 0-10 disqualify or revisit (bands are proposed and uncalibrated) |
| Required fields | `champion` stakeholder, `qualification_score`, budget cycle date, decision process |
| Required evidence | Each point cites a dated observation; automatic disqualifiers checked (prohibited high-impact AI; individual risk scoring; unsupported certification requirement; required SIS/LMS write before approval; no lawful data authority; no champion; demand to waive P0/P1; economics below cost) |
| Owner / SLA | Harrison Rubin; decide within 5 business days of the discovery recap [ASSUMPTION] |
| Next-action rule | Qualified: schedule the demonstration. Otherwise `paused` or `closed_lost` with `loss_reason` |
| Forecast | category **pipeline** (coverage only) once qualified; probability not approved (0) |
| Gate | Open |

### 2.5 Demo: `multi_stakeholder_demo` (status `engaged`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | Demonstration scope agreed with the right stakeholders; synthetic or non-activation data only |
| Exit criteria | Demo run from [`DEMO-PLAYBOOK.md`](../../market-readiness/DEMO-PLAYBOOK.md) on synthetic data only; attendee roles recorded; each stakeholder's top objection and evidence request logged; no statement outside the claims register; next step dated |
| Required fields | attendee roles, objections (tags `obj:*`), evidence requests (`gtm_decision_log`) |
| Required evidence | Demo record; recap (email 6.1); labels "available / pilot-dependent / planned" used |
| Owner / SLA | Harrison Rubin; recap within 1 business day; stale after 21 days [ASSUMPTION] |
| Next-action rule | Propose the pilot design session (email 7.1) or record the blocker |
| Forecast | pipeline; probability not approved (0) |
| Gate | Open (synthetic data only) |

### 2.6 Pilot design: `outcome_workshop` (status `engaged`)

| Attribute | Definition |
| --- | --- |
| Entry criteria (`SALES_EXIT`) | "The buying committee is mapped, including IT, privacy, accessibility and the academic sponsor." |
| Exit criteria | Measures agreed (three to five) with candidate baselines; committee mapped against `COMMITTEE_ROLES` (`unmappedRoles` empty or each gap owned); sponsor identified; draft scope written as a non-binding summary |
| Required fields | stakeholder per committee role (`executive_sponsor`, `operational_owner`, `cio`, `ciso_privacy`, `accessibility`, `registrar_data_governance`, `procurement`, `legal`, `finance`, `champion`), measures with baselines and sources, cohort, workflow |
| Required evidence | Working-session record; draft scope version link; baselines described, not collected as student data |
| Owner / SLA | Harrison Rubin; stale after 30 days [ASSUMPTION] |
| Next-action rule | Deliver the non-binding scoping summary (email 8A.1); start technical and security review |
| Forecast | pipeline; probability not approved (0) |
| Gate | Open (no live data, no commitment) |

### 2.7 Security / procurement review: `technical_review`, `security_privacy_accessibility_review` (status `engaged`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | A reviewer asked for architecture, data-flow, integration, security, privacy or accessibility evidence |
| Exit criteria | `technical_review`: architecture and integration questions answered from the RFP library, integration stated as manual or read-only, no adapter promised that is not installed, every open question owned and dated. `security_privacy_accessibility_review`: questionnaire answered from the RFP library and HECVAT evidence matrix, each answer labelled (implemented, pilot-scoped, planned, not applicable, customer responsibility, gap); exceptions owned; reviewer's acceptable prerequisites written; a SOC 2, VPAT or penetration-test requirement recorded as an accepted prerequisite **or a disqualifier** |
| Required fields | `gtm_decision_log` entries: `committee_role`, `question`, `category` (security, privacy, accessibility, legal, integration, budget, procurement, implementation), `status` (open, in_review, blocked, approved, declined), `owner`, `requested_date`, `target_date`, `resolution_date`, `evidence_links`, `risk_level` |
| Required evidence | RFP library rows and HECVAT register rows cited per answer; an `approved` entry needs evidence links (`entryProblems`); a resolved entry needs a resolution date |
| Owner / SLA | Harrison Rubin answers; reviewers (unassigned) approve; overdue entries per `overdue()` appear in the weekly review; stale after 30 days [ASSUMPTION] |
| Next-action rule | Answer within 2 business days of a request [ASSUMPTION]; escalate any item with `risk_level` high |
| Forecast | pipeline; probability not approved (0) |
| Gate | Open (evidence exchange; gaps stay visible) |

### 2.8 Pilot proposal: `proposal` and `pilot_or_implementation_SOW` (status `engaged`)

| Attribute | Definition |
| --- | --- |
| Entry criteria (`proposal`, `SALES_EXIT`) | "Security, privacy and accessibility review has started, answered from the RFP library, never from memory." |
| Exit criteria (`pilot_or_implementation_SOW`, `SALES_EXIT`) | "A pilot plan with no readiness problems (pilotReadiness in #817)." `pilotReadiness` returns problems for: `duration` (not 26 weeks), `no_workflow`, `no_cohort`, `no_baseline`, `no_sponsor`, `no_champion`, `data_plan`, `metric_count` (not 3-5), `metric_baseline`, `no_conversion_date`, `conversion_outside_window`, `no_price` (annual price not agreed), `no_midpoint` |
| Required fields | plan fields as in `PilotPlan` (`startDate`, `endDate`, `workflow`, `cohort`, `baseline`, `executiveSponsor`, `operationalChampion`, `dataPlan`, `metrics`, `conversionDate`, `annualPriceAgreed`, `midpointReviewDate`, `productionDataApproved`); immutable proposal version link; amount fields `[PRICE TO BE CONFIRMED]` |
| Required evidence | Dated conditional proposal authorized for delivery; cohort within the hard bounds 10-200 (target 50-200) |
| Owner / SLA | Harrison Rubin; proposal stale after 30 days; expired proposals reported weekly [ASSUMPTION] |
| Next-action rule | Allowed now: non-binding scoping summary (email 8A) with **no price, no start date, no launch promise**; `pilot_or_implementation_SOW` cannot be satisfied today (no price can be agreed, `no_price`) |
| Forecast | `proposal`: pipeline (non-binding scope, no amount); **`pilot_or_implementation_SOW`: HELD, not forecast as revenue**; probability not approved (0) |
| Gate | `proposal` open as non-binding only; `pilot_or_implementation_SOW` **HELD** |

### 2.9 Contracting: `procurement_legal`, `contracted` (statuses `engaged`, `pilot`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | Proposal accepted into formal review |
| Exit criteria (`contracted`, `SALES_EXIT`) | "Procurement and legal have signed; the deal desk review has no refusals." `procurement_legal` checklist: proposal accepted into formal review; redline register opened; deal-desk review run with no refusals (`governance/deal-desk.ts`); approvers named for each deviation |
| Required fields | redline register, deviation approvers, signer, signature state, effective and end dates; immutable order version; billing contact (finance roles only) |
| Required evidence | Counsel-approved paper executed; deal-desk review record; entity, tax, payment and insurance authority (go/no-go priority 5) |
| Owner / SLA | Harrison Rubin; counsel and finance unassigned; stale after 45 days [ASSUMPTION] |
| Next-action rule | Weekly redline and approval status |
| Forecast | `procurement_legal`: commit only when the gate is open and every commit condition in section 6 holds; **today none can be commit**. `contracted` is a decision state, not a probability |
| Gate | **HELD** |

### 2.10 Activated pilot: `implementation`, `live` (statuses `pilot`, `customer`)

| Attribute | Definition |
| --- | --- |
| Entry criteria (`implementation`) | Handoff accepted per [`STAGE-COLLATERAL-AND-HANDOFF.md`](../../commercial/STAGE-COLLATERAL-AND-HANDOFF.md) (12-item checklist; refused if item 8 lists a promise outside the claims register, any item is blank, or `pilotReadiness` returns a problem); owners and backups named; tenant created in sandbox data mode (`pilotDataMode`) |
| Exit criteria (`live`, `SALES_EXIT`) | "The launch council returned go for the first cohort." (Lifecycle: configure, train, launch, hypercare of at least two weeks, learn, decide: [`PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md)) |
| Required fields | tenant and cohort, owners and backups, `productionDataApproved` and data mode, `startDate`, `endDate`, `midpointReviewDate`, measures with baselines |
| Required evidence | Launch-council go for this cohort; support routing live; baseline measured; training done; named staffed roles; recovery and offboarding paths exercised (go/no-go priorities 1-8) |
| Owner / SLA | Harrison Rubin; "per pilot plan" (duration open decision D1); `live` account status `customer` is internal only (D3) |
| Next-action rule | Weekly review during the pilot; midpoint review by `midpointReviewDate` |
| Forecast | not applicable: "a signed or delivered state is not a probability" (scoring doc) |
| Gate | **HELD** (activation of any pilot with live data) |

### 2.11 Success achieved: GAP (evidence state inside `live`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | Hypercare complete, learn phase running |
| Exit criteria | All five records of the pilot-complete rule (section 7) present |
| Required fields | outcome measures with baseline, target, result, source, cohort-level only and suppressed below ten participants; support volume; accessibility reports and handling; cost to serve; known limitations |
| Required evidence | Outcome review record; no causal claim without an approved design; CLM-014 stays prohibited for external use |
| Owner / SLA | Harrison Rubin; customer sponsor signs the decision; decision meeting within the window `conversionDate` allows (14 days before to 30 days after `endDate`) |
| Next-action rule | Decision meeting ([`PILOT-EXECUTIVE-OUTCOME-REVIEW.md`](../../institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md)) |
| Forecast | not applicable |
| Gate | **HELD** |

### 2.12 Annual conversion: GAP as a stage; `renewal` entered by a signed final verdict

| Attribute | Definition |
| --- | --- |
| Entry criteria (`renewal`, `SALES_EXIT`) | "The pilot has a signed, final verdict (pilotVerdict in #817) with outcomes measured." `pilotVerdict` is final only with a decision (`convert`, `expand`, `pause`, `stop`), `signedBy`, `signedAt`; `convert` and `expand` are refused while a high-severity issue is open |
| Exit criteria | The annual agreement is a new transaction: authorized scope and price, deal-desk review, procurement, legal, production readiness, separate activation. Closeout path chosen per the conversion plan (convert conditionally, extend, pause, stop) |
| Required fields | decision record (pilot, decision date and attendees, evidence package version, decision, scope and limits, open items, signatures); link from the pilot opportunity to a **new** annual opportunity |
| Required evidence | Executed documents; billing, cash and revenue remain separate facts |
| Owner / SLA | Harrison Rubin; annual proposal within the conversion window [ASSUMPTION] |
| Next-action rule | Create the annual opportunity; never double-count pilot and annual value |
| Forecast | reported separately from new business; probability not approved (0) |
| Gate | **HELD** |

### 2.13 Expansion / Renewal: `expansion`, `renewal` (status `customer`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | `expansion`: separately authorized scope; adjacent cohort has its own readiness check and launch-council go; first-scope outcomes measured against baseline. `renewal` of an annual contract: opened 120 days before term end by the commercial trigger ([`COMMERCIAL-CORE.md`](../../COMMERCIAL-CORE.md)) |
| Exit criteria | Signed expansion or renewal order; or a recorded non-renewal |
| Required fields | contract dates, QBR record, reviewed account-level health reasons (human reviewed, no hidden individual scoring), decision and next action |
| Required evidence | QBR record; incident, accessibility and support record |
| Owner / SLA | Harrison Rubin; renewal begins one budget cycle before term end |
| Next-action rule | Weekly review of accounts inside the 120-day window |
| Forecast | reported separately from new business; never added to commit for new business |
| Gate | **HELD** |

### 2.14 Closed-lost: `closed_lost` (status `closed_lost`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | Explicit rejection, a disqualifier, withdrawal or expiry |
| Exit criteria | `loss_reason`, learning and `future_contact_rule` recorded; suppression applied where the contact asked to stop. A lost deal reopens only as a new `target_account` with fresh discovery |
| Required fields | `loss_reason` (coded list [DRAFT]: no_champion, no_budget, no_priority, requires_soc2_or_vpat, requires_integration, requires_individual_risk_alerts, prohibited_requirement, chose_other, procurement_timing, withdrawn, unresponsive_expired), `future_contact_rule`, last objection tags |
| Required evidence | The message or meeting that recorded the reason |
| Owner / SLA | Harrison Rubin; within 2 business days of the decision [ASSUMPTION] |
| Next-action rule | None, except an allowed re-contact on the stated rule |
| Forecast | probability 0 |
| Gate | Open |

### 2.15 Dormant: GAP (account status `paused`)

| Attribute | Definition |
| --- | --- |
| Entry criteria | Cold run ended in silence, a champion left, timing is wrong, or a regression was found; no explicit rejection |
| Exit criteria | A new reason-for-outreach passing the RFO test and an expired `future_contact_rule` (re-engagement Sequence 15), after which the account leaves `paused` for the stage it was in |
| Required fields | stage at pause, pause reason, `future_contact_rule` (proposed 180 days [ASSUMPTION]) |
| Required evidence | The activity that caused the pause |
| Owner / SLA | Harrison Rubin; reviewed monthly; dormant when no activity for 90 days [ASSUMPTION] |
| Next-action rule | Monthly: re-engage only with a new reason; otherwise `closed_lost` after 12 months of silence [ASSUMPTION] |
| Forecast | omitted |
| Gate | Open |

## 3. The 100-account list [DRAFT]

One row per account; an account is added only when a target score can be cited from public, dated observations. The list is a working view of the CRM account and opportunity records, not a second source of truth. It contains **no student data**, and contact fields are limited to the minimum in section 8.

### 3.1 Column definitions

| Column | Definition | Source field or rule |
| --- | --- | --- |
| `acct_id` | Stable ID | CRM account ID |
| `institution` | Display name of the institution or unit | `gtm_accounts.name` |
| `segment` | One of research, regional, community_college, liberal_arts, system, online, other | `gtm_accounts.segment` |
| `size_band` | Enrollment band (public figure with source) | Public source, dated |
| `stack` | SIS, LMS, advising or early-alert platform, if publicly known | Public source |
| `unit` | Student success, advising, registrar, honors, transfer, or department | ICP document |
| `source` | How the account was found: warm path, public observation, inbound, referral | CRM |
| `rfo_type` and `rfo_source` | Reason-for-outreach type and URL or referrer (see the email document) | Personalization record |
| `target_score` | 0-20 | Scoring document |
| `tier` | A, B or C | Scoring document |
| `disqualifier` | Y/N and which | Scoring document |
| `stage` | A code stage identifier | `SALES_STAGES` |
| `status` | `target`, `engaged`, `pilot`, `customer`, `paused`, `closed_lost` | `ACCOUNT_STATUS_OF` |
| `committee_mapped` | Count of the ten `COMMITTEE_ROLES` with a named stakeholder (0-10) | `unmappedRoles` |
| `champion` | Y/N | Qualified gate |
| `budget_cycle` | Month or term the budget opens, as stated by the buyer | Discovery |
| `target_term` | The term of the milestone | GTM playbook field |
| `owner` | Seller | CRM |
| `next_action`, `next_action_due` | Next step and date | Scoring document |
| `last_activity` | Date of the last logged activity | CRM |
| `suppression` | none, person, institution | Suppression list |
| `forecast_category` | commit, best case, pipeline, omitted (subject to the gate override) | Section 6 |
| `held` | Y if the opportunity's next proposed step is a held stage | Section 5 |

### 3.2 Template (5 blank rows; no institutions are named)

| acct_id | institution | segment | size_band | stack | unit | source | rfo_type | rfo_source | target_score | tier | disqualifier | stage | status | committee_mapped | champion | budget_cycle | target_term | owner | next_action | next_action_due | last_activity | suppression | forecast_category | held |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [acct-001] |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| [acct-002] |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| [acct-003] |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| [acct-004] |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| [acct-005] |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### 3.3 List rules

1. Build to 100 accounts over time; never import a purchased list. Every account has at least one dated, public observation behind its score.
2. Tier A accounts are worked first, within the capacity cap: the top three target scores at a time until delivery capacity is measured on a real pilot (scoring document).
3. Tier B accounts are not contacted unless capacity allows; Tier C are held with a reason.
4. The target score and the qualification score are separate columns and separate questions ([`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)). Never score on student vulnerability, protected class or risk signals.
5. Mark reference potential only as an internal ordering aid; it is never a request or a promise (CLM-013).
6. The first 10 institutions are chosen from the list through [`FIRST-10-INSTITUTIONS-TARGETING-PLAN.md`](../../market-readiness/FIRST-10-INSTITUTIONS-TARGETING-PLAN.md).

## 4. Account scoring: reuse and delta [DRAFT]

Reused unchanged from [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md): target score (0-20, ten criteria from the targeting plan), qualification score (0-20, ten criteria from the qualification scorecard), shared bands (16-20, 11-15, 0-10; proposed and uncalibrated), tiers A/B/C, the automatic disqualifiers, staleness (90 days after the newest cited observation), the capacity cap, and the opportunity fields `target_score`, `qualification_score`, `tier`, `forecast_category`, `probability`, `probability_source`, `probability_approved_by`, `stage_entered_at`, `next_action`, `next_action_due`, `loss_reason`, `future_contact_rule`.

| Delta (proposed for that document's owner; not in code) | Why | Label |
| --- | --- | --- |
| `rfo_type`, `rfo_source`, `rfo_verified_on` | The email system requires a recorded reason for every send; scoring needs the same dated observation | [DRAFT] |
| `suppression` (none / person / institution) | Opt-out must block sequences at the account and person level | [DRAFT] |
| `held` flag derived from the stage or next step | Prevents a held stage from being forecast as revenue | [DRAFT] |
| `committee_mapped` (count of 10 roles) | Derived from `unmappedRoles`; supports the `outcome_workshop` gate | [DRAFT] |
| `budget_cycle`, `target_term`, `referral_source`, `stack`, `size_band` | Already listed as fields to record in [`INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md); here given a column | [DRAFT] |
| `pilot_gate_state` (allowed_now / held) | Records which zone an opportunity's next step belongs to | [DRAFT] |
| Objection tags `obj:*` | From [`OBJECTION_HANDLING_LIBRARY.md`](OBJECTION_HANDLING_LIBRARY.md) | [DRAFT] |

No new score, band or weight is introduced. Probabilities are not introduced either.

## 5. Which stages are held [VERIFIED then HELD]

| Stage | Held? | Reason | What can still happen |
| --- | --- | --- | --- |
| `target_account`, `discovery`, `qualified`, `multi_stakeholder_demo`, `outcome_workshop`, `technical_review`, `security_privacy_accessibility_review` | No | Design-partner non-activation engagement is GO | Everything in the stage definition |
| `proposal` | Partly | Only a non-binding conditional scoping summary with no price, order form or launch date | Draft scope for review |
| `pilot_or_implementation_SOW` | **HELD** | `no_price` can never clear; paid pilot NO-GO | Rehearsal on a synthetic record |
| `procurement_legal`, `contracted` | **HELD** | No counsel-approved paper; no entity, tax, payment or insurance authority | Collect the buyer's procurement steps; no signature |
| `implementation`, `live` | **HELD** | No activation, live data or launch obligation; launch council has no go | Nothing with real data |
| `renewal`, `expansion` | **HELD** | No customer, contract or pilot verdict | Nothing |
| `closed_lost`, `paused` | No | Always reachable | -- |

A record may be placed in a held stage only by a dated decision that supersedes the 2026-10-03 go/no-go for that motion. The CRM must reject the move; `salesMoveProblems` already refuses a move that skips a gated stage, and the held rule is an additional CRM validation (the code itself has no held concept [GAP]).

## 6. Forecasting method [DRAFT]

Source: [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md) and [`SALES-PIPELINE-DEFINITIONS.md`](../../commercial/SALES-PIPELINE-DEFINITIONS.md). No pipeline value, probability, close date or forecast is approved or asserted today.

### 6.1 Categories (defined by evidence, never seller confidence)

| Category | Stages and evidence | Counts toward |
| --- | --- | --- |
| Commit | `procurement_legal` or later, deal-desk review with no refusals, named signer, date inside the period | an unbooked estimate only |
| Best case | `proposal` or `pilot_or_implementation_SOW` with sponsor and budget cycle recorded and the review stages complete | upside, never added to commit |
| Pipeline | `qualified` through `security_privacy_accessibility_review` | coverage only |
| Omitted | `target_account`, `discovery`, anything past its next-action date | not forecast |

### 6.2 Method: stage-weighted, with an honest zero

Weighted pipeline = sum of amount times **approved** probability, only over stages that have an approved probability. Today none has one, so the weight is 0, and the report shows counts and unweighted amounts by category. When a stage has an approved minimum number of closed opportunities, probability becomes the measured share of opportunities that entered it and later reached `contracted`, with the sample size printed beside it and approval by finance and the owner. Nothing in this document supplies a number.

### 6.3 Rules that prevent forecasting a held stage as revenue

1. **Gate override (more conservative than the scoring document; proposed for its owner).** While the paid-pilot motion is NO-GO, the **Commit** and **Best case** categories are disabled for any opportunity whose next commercial step is a paid pilot; such an opportunity reports as Pipeline (counts) at most, and its revenue forecast is 0.
2. A held stage never carries a probability, a weighted amount, a close date or a revenue line. `contracted`, `implementation` and `live` are decision or delivery states, not probabilities.
3. An amount is only an approved quoted scope. Until a price is approved the amount field is `[PRICE TO BE CONFIRMED]` or blank. Planning assumptions, including the founder's institutional price inputs, never enter the CRM amount field and never enter a forecast.
4. A design-partner engagement without a price has amount 0 and is never booked, billed or counted as revenue.
5. A pilot and its hypothetical annual conversion are never counted twice; renewal and expansion are reported separately from new business; services motions are separate.
6. Weighted pipeline is a planning estimate, never booked, billed, collected or recognized revenue. Report "unavailable" when a source is absent, not zero.
7. A stage change made to improve a forecast is a data-hygiene violation. Movement requires exit evidence.
8. Forecast accuracy, win rate, conversion rate, cycle time and coverage are not stated until approved inputs and dated records exist; the directional figures in `kpi.ts` are not sales benchmarks and never feed this model.

## 7. The pilot-complete rule: an enforceable stage-exit check [DRAFT]

**A pilot is not complete until activation, workflow completion, outcome measurement, executive review and conversion decision are all recorded.** "Complete" means the opportunity may be moved to `renewal`, counted in a conversion report or used for any external statement. The check is a stage-exit validation, run when anyone attempts to move a `live` opportunity forward or to mark a pilot complete.

| # | Record | Pass condition | Evidence the CRM must hold | Where enforced today |
| --- | --- | --- | --- | --- |
| 1 | Activation | A launch-council go for the cohort exists and the pilot actually started: `startDate`, cohort, data mode (`pilotDataMode`), and the hypercare start | Launch-council record; tenant and cohort ID; activation date | `live` gate in `SALES_EXIT` (the council go); the activation date itself is not in code [GAP] |
| 2 | Workflow completion | The agreed workflow ran for the cohort through its end: a recorded completion measure against the plan, not just logins | Workflow-completion measure with numerator, denominator, source; no individual data; suppressed below ten | not in code [GAP] |
| 3 | Outcome measurement | Three to five metrics, each with baseline, target and result and source, at cohort level | `PilotPlan.metrics` with results; baseline present for every metric | `pilotReadiness` checks the plan (metric count, baselines); results are not in code [GAP] |
| 4 | Executive review | The decision meeting happened with the sponsor and champion, covering metrics, support volume, accessibility reports, cost to serve, known limitations and the recommendation | Meeting record with attendees and the evidence package version ([`PILOT-EXECUTIVE-OUTCOME-REVIEW.md`](../../institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md)) | not in code [GAP] |
| 5 | Conversion decision | A written, signed final decision: `convert`, `expand`, `pause` or `stop`, with `signedBy`, `signedAt`, and `unresolvedHighSeverity` equal to 0 for `convert` and `expand` | `PilotOutcome` record | `pilotVerdict` (`final` is true only with a signed decision) and `SALES_EXIT.renewal` |

**Check procedure.**

1. All five rows must show a dated record with an owner. Any blank means the check fails and the opportunity stays `live` (`pilot not complete`).
2. Only when the check passes does the CRM add `renewal` to the `met` set it passes to `salesMoveProblems`. This is the enforcement point: the code only refuses entry into `renewal` without a signed verdict, so the CRM validation supplies rows 1-4.
3. A `stop` or `pause` decision also completes a pilot (the pilot was run and decided) but does not open `renewal`; it routes to the closeout path ([`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md)).
4. A `convert` decision does not create an annual contract, invoice, entitlement, reference or revenue. It starts a new annual opportunity (GAP G4).
5. An outcome statement for any external audience additionally needs CLM-014 approval and, for naming the customer, CLM-013 and written permission; the pilot-complete check never substitutes for either.
6. Engineering follow-up (not done here): add rows 1-4 as computed checks beside `pilotVerdict` and a test that fails when a pilot reaches `renewal` without them.

## 8. Data hygiene rules [DRAFT]

1. One account record per legal institution; deduplicate deterministically; keep merges auditable, never silently delete history.
2. Every open opportunity has an owner, `stage`, `stage_entered_at`, `next_action`, `next_action_due`. A missing or past `next_action_due` is stale and appears in the weekly review.
3. No stage change without exit evidence; no backward move (pause or close instead). Stage changes are logged with reason.
4. `target_score` and `qualification_score` are stale 90 days after the newest cited observation and are rewritten when the stage changes.
5. Amount, probability and close date are blank unless approved. A value without authority is labelled `assumption` and excluded from any revenue statement.
6. Activity logs contain factual summaries, not transcripts, recordings or sensitive content by default.
7. Each answer to a diligence question is logged in `gtm_decision_log` with owner, dates and evidence links; a closed entry has a resolution date; an `approved` entry has evidence.
8. Suppression and opt-out are checked at every send and reflected within the same business day [ASSUMPTION].
9. Expired proposals, duplicate accounts, missing authority, unsupported close dates and consent state are reviewed weekly.
10. Held-stage records exist only as rehearsal records labelled synthetic.
11. A claim made in a sale is recorded against the claims register; a promise outside it is flagged (handoff item 8).

## 9. CRM privacy rules [DRAFT] [REVIEW: privacy]

Source: [`INSTITUTIONAL-GTM-PLAYBOOK.md`](../../INSTITUTIONAL-GTM-PLAYBOOK.md) ("Where GTM records live") and [`CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md).

1. **No personal data about contacts beyond a role and a work address.** The playbook says meeting notes about named people belong in a CRM, not beside student data; the same boundary means no private email, personal profile enrichment, family, health or other personal information, and no inferred sensitive trait.
2. **No student data ever joins a pipeline table.** Pilot outcomes are cohort aggregates, suppressed below ten (n >= 10). No individual participant outcomes in the CRM; never join prospect identity to individual student product behavior for sales pressure.
3. **The capability boundary is tested both ways**: a student and another school's administrator are refused, as `gtm.check.sql` does for its tables. The CRM is not a shadow student-record, support, HR, health or advising system.
4. **Contact data minimization**: collect only name, role, work address, source of the address, committee role and interaction history; record the `consent/contact basis`, not more. Institution-provided contact information is not marketing permission and an institution cannot consent for unrelated individual marketing ([`MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md`](../../legal-drafts/MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md)).
5. Least privilege: finance records only to billing contacts and finance roles; delivery records to authorized implementation roles; trust artifacts to granted versions; GTM tables at platform scope behind the `account:manage` capability held by the sales role.
6. Retention, export, correction, deletion and hold rules apply to contact data; keep only a minimal suppression record after an opt-out. Retention periods are not approved [GAP].
7. No secrets, keys or confidential artifacts in free text; evidence is linked, not pasted.
8. No automated adverse action and no hidden individual scoring of anyone.

## 10. Weekly pipeline review [DRAFT]

**Agenda (45 minutes, weekly [ASSUMPTION]; monthly addition at the end).**

| # | Item | Time | Output |
| --- | --- | --- | --- |
| 1 | Gate check: is any go/no-go decision changed or evidence expired? | 3 | Held list confirmed or changed by a dated decision |
| 2 | Stale and overdue: every missing or past `next_action_due`; every record past its ageing threshold | 8 | Each gets an action, a pause or a close |
| 3 | Decision log: overdue entries, high-risk items, evidence requests due | 7 | Owners and dates |
| 4 | Outreach: sends, reply, meeting and referral rates; opt-outs, bounces, complaints; RFO pass rate | 7 | Volume cap and quality adjustments |
| 5 | Discovery and qualification: scores, disqualifiers, committee coverage | 7 | Qualify, hold or disqualify |
| 6 | Proposals: expired, stalled, any in a held zone | 5 | Corrections |
| 7 | Forecast categories as counts and unweighted amounts; confirm no held stage carries revenue | 4 | Report |
| 8 | Objections and loss reasons: new tags, patterns | 4 | Feed the objection library |
| 9 | Monthly only: re-score tiers; review loss reasons; hygiene audit | -- | Updates |

**Checklist** (tick before the meeting ends):

- [ ] No opportunity sits in a held stage without a dated superseding decision.
- [ ] Every open opportunity has an owner, `next_action` and `next_action_due`.
- [ ] No stage moved without exit evidence; `salesMoveProblems` returned no unexplained problem.
- [ ] Scores older than 90 days are re-scored or the account is paused.
- [ ] Suppression list checked against the week's planned sends.
- [ ] Decision-log entries overdue are assigned.
- [ ] Forecast shows counts and unweighted amounts only; held stages show no revenue.
- [ ] No pilot was called complete without all five records.
- [ ] No student data entered the CRM; no contact data beyond role and work address.
- [ ] Open founder decisions (pilot length, price, funnel GAPs) reviewed.

## 11. Reports and dashboards [DRAFT]

All reports show the definition version, source, as-of time, owner, population, evidence status and any data-quality warning, as [`REVENUE-OPERATIONS-DASHBOARD-SPEC.md`](../../commercial/REVENUE-OPERATIONS-DASHBOARD-SPEC.md) requires. Empty source shows "unavailable", not zero.

| Report | Content | Rule |
| --- | --- | --- |
| Pipeline by stage | Counts by `stage` and account `status`; age; next action; source; segment | No customer, booking or revenue language |
| Funnel (founder's view) | The twelve funnel steps with GAP steps derived as in section 1 | Derived steps labelled "derived" |
| Stale and ageing | Opportunities past `next_action_due` or the ageing threshold | Drives the weekly review |
| Outreach performance | Sends, positive reply rate, meeting-booked rate, referral rate, opt-out, bounce, complaint, RFO pass rate | Opens are not a metric |
| Objection frequency | `obj:*` tags by stage and persona | Feeds the objection library |
| Decision log health | Open, overdue, blocked, high-risk items by committee role | `overdue()` ordering |
| Committee coverage | Count of the ten roles mapped per account | `unmappedRoles` |
| Held-stage register | Opportunities awaiting a gate, with the gate they await | Never forecast |
| Forecast categories | Commit, best case, pipeline, omitted as counts and unweighted amounts; probability coverage (how many stages have an approved probability: 0 today) | Gate override applies |
| Loss and pause reasons | `loss_reason` and pause reasons by stage | Monthly |
| Pilot-complete status | Per `live` pilot, which of the five records exist | Section 7 |
| Data quality | Missing owners, dates or fields; duplicates; unsupported amounts, dates or probabilities | Blocks forecast confidence where material |
| Suppression audit | Opt-outs recorded vs sends cancelled | Zero sends to suppressed contacts |

## Evidence state

- [VERIFIED] `stages.ts` (16 stages, `ACCOUNT_STATUS_OF`, seven `SALES_EXIT` gates, `salesMoveProblems`), `pilot.ts` (`pilotReadiness`, `pilotVerdict`, committee roles, decision log), the scoring, pipeline, CRM and collateral documents, and the go/no-go decision exist at revision `5eba494`.
- [DRAFT] The funnel-to-code mapping, ageing thresholds, field deltas, held-stage rules, gate override and pilot-complete check are proposals. No CRM is configured, no stage has been entered, no account has been scored, no forecast has been reviewed and no data dictionary exists.
- [ASSUMPTION] Every SLA, ageing threshold, cadence and capacity figure. No probability is approved.
- GAPs recorded: G1-G7 (section 1), the held concept absent from code, activation and workflow-completion records absent from code.

## Claim ceiling

Semester may use this definition to manage prospective, non-activation institutional work and to report counts and unweighted amounts labeled by evidence state. It may describe the pipeline as an internal planning method with every threshold a hypothesis.

## Prohibited claims

Do not state a pipeline value, win rate, conversion rate, cycle time, forecast, coverage or probability; do not call a target, lead, tier, score, proposal, weighted amount or commit a customer, booking, ARR, MRR or recognized revenue; do not describe a live design-partner pilot as a "customer" externally; do not call a pilot complete, converted or successful unless the pilot-complete check passes and the external claim is separately approved (CLM-013, CLM-014, CLM-015).

## Professional review required

| Area | Reviewer | Why |
| --- | --- | --- |
| Contact data, retention, suppression record | privacy owner (unassigned) `[REVIEW: privacy]` | Minimization and retention are not approved |
| Forecast recognition language, revenue vs bookings | accountant (unassigned) `[REVIEW: accounting]` | Revenue recognition is separate from pipeline |
| Paper and signature stages | counsel (unassigned) `[REVIEW: counsel]` | `procurement_legal` and `contracted` are held until counsel-approved paper exists |
| Any code change to `stages.ts` or the pipeline tables | Engineering with the owner | The stage vocabulary is test-held; GAPs need a documented change |
