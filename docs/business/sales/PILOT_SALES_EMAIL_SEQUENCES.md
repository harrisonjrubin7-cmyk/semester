# Pilot Sales Email Sequences (account-based institutional outreach)

| Control | Value |
| --- | --- |
| Status | **[DRAFT] - NOT APPROVED FOR SENDING. Fifteen sequences; sequences 1-7 and the non-binding variants of 8-10 are permitted now, everything that carries price, payment, live data, activation, conversion, renewal, case study or reference is HELD** |
| Owner | Harrison Rubin (interim, single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: procurement] [REVIEW: security] [REVIEW: accessibility] |
| Audience | Internal. The `Body` blocks are customer-facing **drafts** and become sendable only through the send-approval checklist in section A. Count of `[APPROVED]` customer-facing items in this document: **0** (no named approver is recorded for any customer-facing wording) |

> Operating document, not legal, tax, accounting, insurance, privacy, security or accessibility advice. Nothing here states what any email law requires; every jurisdictional point is flagged `[REVIEW: counsel]`.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`EMAIL-LIFECYCLE.md`](../../market-readiness/EMAIL-LIFECYCLE.md) | Transactional and lifecycle email for individual users; rule that marketing needs separate lawful consent and one-click unsubscribe; no sensitive data in subject lines | Institutional, account-based, one-to-one outbound across fifteen sequences. It is a different audience (staff at a prospect, not a student user) and a different send basis | The lifecycle doc is seven lines about product messages; editing it would mix two audiences and two consent regimes |
| [`SALES-PLAYBOOK.md`](../../commercial/SALES-PLAYBOOK.md) | The seven-step controlled sales process and the required CRM record | Email scripts for each step, with per-email CRM activity, stop condition and gate | The playbook is process; it holds no wording |
| [`DISCOVERY-CALL-SCRIPT.md`](../../commercial/DISCOVERY-CALL-SCRIPT.md), [`DEMO-PLAYBOOK.md`](../../market-readiness/DEMO-PLAYBOOK.md) | What is said on the call and in the demo | The emails before and after those events | Calls are covered; the written follow-through is not |
| [`PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) | The conditional offer, its terms and its gates | How the offer is introduced and delivered by email without crossing a gate | The offer doc must stay the single statement of terms |
| [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md), [`PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md) | Four decision paths (convert, extend, pause, stop) and closeout checklist | HELD email templates for results, conversion and renewal that cannot contradict those paths | Those docs define the decision; they do not draft the correspondence |
| [`MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md`](../../legal-drafts/MARKETING-COMMUNICATIONS-CONSENT-DRAFT.md) | Draft consent template; "institution-provided contact information is not marketing permission"; campaign sender prohibited until vendor, consent and suppression operate | Applies that boundary to account-based sends (sections A, B and C) | Consent draft is legal-facing; this is the operating procedure |
| [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md), [`CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md), [`../../../app/src/lib/gtm/stages.ts`](../../../app/src/lib/gtm/stages.ts) | Stage vocabulary, tiers, activity/stakeholder fields | Per-email CRM write-back using exactly those names | Reused, not redefined; see [`CRM_PIPELINE_DEFINITION.md`](CRM_PIPELINE_DEFINITION.md) |
| [`OBJECTION_HANDLING_LIBRARY.md`](OBJECTION_HANDLING_LIBRARY.md) | (sibling) Objection scripts | Reply-handling section C links to it | -- |

## Gate (what is allowed now versus held) [VERIFIED]

Source: [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) (2026-10-03). Design-partner institutional work is **GO / GREEN for non-activation engagement only**: discovery, synthetic demos, evidence exchange, fit and limitation review, conditional scoping. The **paid institutional pilot is NO-GO / RED**: no payment, no unconditional launch obligation, no live data, no tenant activation. Broad enterprise sale is NO-GO / RED. Conversion rule: any conflict resolves to the more conservative boundary.

| Sequence | Name | Gate | Allowed now? |
| --- | --- | --- | --- |
| 1 | Cold outreach: problem-led introduction | Design-partner discovery (GREEN, non-activation) | **YES** |
| 2 | Follow-up: scoped, low-risk pilot explanation | Design-partner discovery | **YES** (scoping conversation only; "pilot" means design-partner scoping) |
| 3 | Follow-up: security and procurement readiness | Evidence exchange (GREEN) | **YES** (status stated honestly: drafts, gaps visible) |
| 4 | Breakup and referral request | Design-partner discovery | **YES** |
| 5 | Post-discovery follow-up | Discovery (GREEN) | **YES** |
| 6 | Post-demo follow-up | Synthetic demo (GREEN) | **YES** (synthetic data only) |
| 7 | Pilot-design-session invitation | Conditional scoping (GREEN) | **YES** (no live data, no commitment) |
| 8A | Scoping summary delivery (non-binding) | Conditional scoping | **YES** (no price, no order form, no launch date) |
| 8B | Pilot proposal delivery with price | **HELD**: paid pilot NO-GO | **NO** (template only) |
| 9A | Security and procurement evidence follow-up | Evidence exchange | **YES** |
| 9B | Order form, DPA execution, vendor onboarding, invoicing | **HELD**: paid pilot NO-GO; counsel-approved paper absent | **NO** |
| 10A | Executive sponsor follow-up (non-binding) | Conditional scoping | **YES** |
| 10B | Sponsor sign-off on price, launch or contract | **HELD** | **NO** |
| 11 | Mid-pilot executive update | **HELD**: no pilot can be activated | **NO** (design-partner scoping-status variant 11-DP allowed) |
| 12 | Pilot results and annual conversion | **HELD**: no pilot, no outcomes, no annual price | **NO** (non-activation scoping-results review 12-DP allowed) |
| 13 | Renewal and expansion | **HELD**: no customer, contract or term | **NO** (no variant is sensible; use sequence 15) |
| 14 | Case-study and reference request | **HELD**: CLM-013 PROHIBITED TODAY | **NO** (feedback-and-corrections variant 14-DP is not a reference request) |
| 15 | Re-engagement of dormant opportunities | Design-partner discovery | **YES** (no price, no pilot offer beyond scoping) |

**Exact gate condition for every HELD row** [VERIFIED, then HELD]: the paid-pilot motion returns to GO only when [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md) blocking priorities 1-9 are closed with retained evidence, a bounded design-partner engagement has an approved activation record and a measured closeout, the release profile `paid-institutional-manual-pilot` in [`release-profiles.ts`](../../../app/src/lib/governance/release-profiles.ts) passes for the named target (contract: [`PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md`](../../PILOT-AND-INDIVIDUAL-RELEASE-PROFILES.md)), and a dated decision supersedes the 2026-10-03 one. Additional unlocks: price wording needs CLM-015 approval (Founder, Finance, Tax, Legal); results or conversion wording needs CLM-014; any named customer, logo, quote or case study needs CLM-013 plus the customer's claim-specific written permission. A template marked HOLD is never sent, forwarded, attached or paraphrased in another email.

## Open decisions this document cannot settle [INTERNAL]

| # | Conflict or gap | What this document does | Decision owner |
| --- | --- | --- | --- |
| D1 | Pilot length: `PILOT_WEEKS = 26` in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts) (D-134, [`PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md)) versus the founder's "one academic term or 8-12 weeks" | Treats 8-12 weeks as a **planning assumption** for the sales motion and 26 weeks as the code-enforced rule for `pilotReadiness`. No email states a duration: it uses `[PILOT WINDOW - TO BE CONFIRMED]` | Founder; record as a D-<PR number> decision |
| D2 | Prices: D-134 Plus $7.99/mo or $59/yr; D-1154 $15/mo; planning assumption $8.99/mo or $69/yr; institutional planning assumptions in the finance documents | No email states any price. The only permitted token is `[PRICE TO BE CONFIRMED]`, inside HOLD templates | Founder, Finance; CLM-015 |
| D3 | Email 1 uses the founder's default cold email verbatim, which says "Registration Readiness Pilot" | Marked as a design-partner scoping conversation under the current gate (Sequence 1, Email 1.1) | Founder |
| D4 | The legal sending entity, postal address and sender identity are not established (entity, tax and insurance authority is blocking item 5 in the go/no-go) | The send-approval checklist treats a blank postal address as a **hard block** | Founder, counsel |
| D5 | Email 1 says "We are speaking with [role/team] leaders". That sentence must be true on the send date | Pre-send truthfulness check in section A, item 8 | Founder |

## 1. Operating rules [DRAFT]

### 1.1 Account-based, not spam: the reason-for-outreach test (RFO test)

An email is sent only to a named person at an account that scored on the target score ([`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)) and only when the sender can pass **all seven** checks below and has recorded the result **before** sending. **No reason, no send.** Volume, list size, enrichment or a template deadline are never a reason.

| # | Check | Pass condition | Fail example |
| --- | --- | --- | --- |
| R1 | Specific | Names one concrete thing: an initiative, page, announcement, appointment, launch, posted process, or introduction | "Your institution is a leader in student success" |
| R2 | Verifiable | The recipient could confirm it from a public URL, a published document, or a named referrer who agreed to be named; the source is recorded | "I heard students are frustrated" |
| R3 | Recent | Observed within 12 months; a leadership change within 6 months [ASSUMPTION; owner may tighten] | A five-year-old strategic plan |
| R4 | Relevant | There is a one-sentence link from the reason to student planning, registration readiness, or advising workflow | A new stadium |
| R5 | Role-fit | The recipient's role plausibly owns or influences that process (persona in 1.2) | A registrar emailed about a research-compute grant |
| R6 | Fair | States what the source says, without inventing a failure, praising emptily, or implying inside knowledge | "I noticed your registration is broken" |
| R7 | Clean source | Comes from institution-owned or public documents, public news or a consenting referrer. Never from a student's personal post, a private forum, scraped personal profiles, or student records; never names or quotes a student | A screenshot of a student's social post |

Accepted reason types (record one in the `rfo_type` field of the personalization record, section B.1): `public_initiative` (strategic plan, program launch, term-start change), `leadership_change`, `public_process_page` (an institution-published registration or advising page, or a public report, accreditation self-study or student-government document describing a registration-process difficulty), `program_launch`, `published_rfp_or_notice`, `speaker_or_publication` (the recipient's own public talk or article), `referral` (with the referrer's permission to name them), `inbound_request` (they contacted Semester). A reason is single-use per account run: do not recycle one reason across touches as if it were new; later touches reference the earlier reason or add genuinely new information.

### 1.2 Personas (aligned with `COMMITTEE_ROLES` in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts))

| Code | Persona | `committee_role` | Typical title |
| --- | --- | --- | --- |
| P1 | Registrar / enrollment services | `registrar_data_governance` or `operational_owner` | University Registrar, Director of Enrollment Services |
| P2 | Student success / advising leader | `operational_owner` or `champion` | Dean or Director of Student Success, Advising Director |
| P3 | Academic executive sponsor | `executive_sponsor` | Provost, Vice Provost, Vice President for Student Affairs |
| P4 | CIO / IT / identity | `cio` | CIO, Director of Enterprise Systems |
| P5 | Security and privacy | `ciso_privacy` | CISO, Privacy Officer |
| P6 | Accessibility | `accessibility` | Director of Accessibility or Disability Services |
| P7 | Procurement and legal | `procurement`, `legal` | Purchasing Director, Associate General Counsel |
| P8 | Finance | `finance` | Budget Director |

### 1.3 Claims lexicon (applies to every body)

Allowed vocabulary: planning and readiness layer beside existing systems (CLM-004 CONDITIONAL, permitted in qualified non-activation scoping with prominent conditions); manual or read-only first; synthetic demonstration data; non-binding scoping; "available", "pilot-dependent" and "planned" labels; "draft" for every evidence document; "not yet" for anything absent; aggregate cohort measures agreed jointly before any launch.

Never state or imply (CLM-005, 006, 008, 010, 012, 013, 014, 015, 016): that customers, pilots or reference institutions exist; outcomes, retention, time saved, savings or ROI; SOC 2, ISO, FERPA, COPPA or GDPR "compliance", HECVAT completion, penetration testing, WCAG or VPAT conformance; SSO, SCIM, LTI, SIS or LMS integration being available; uptime, recovery objectives or 24/7 support; that AI is accurate, private, non-training or institution-approved; any price or discount; a launch date. Words to avoid entirely: "compliant", "certified", "secure" (as a conclusion), "guaranteed", "proven", "enterprise-ready", "trusted by", "leading", "revolutionary", "transform", "AI-powered insights".

### 1.4 Footers (used in every body) [REVIEW: counsel]

- **F1 (every send, including replies that restart a sequence):** `Semester | [LEGAL SENDER NAME - UNASSIGNED] | [POSTAL ADDRESS - REQUIRED BEFORE FIRST SEND]` then `If you would rather I not contact you about this, reply "no thanks" and I will not write again.`
- **F2 (short, for replies inside an open thread the recipient started):** `Reply "no thanks" at any time and I will stop.`
- Sender identity in the From line is the real sender. Subject lines never mislead about the content, never contain a student's information, grades, health or any sensitive data (consistent with [`EMAIL-LIFECYCLE.md`](../../market-readiness/EMAIL-LIFECYCLE.md)). Nothing is added to hide that the message is a business solicitation.
- This document does not decide which email laws apply to a given recipient (federal, state, Canadian, UK, EU or other). Counsel decides the jurisdictional rules, whether a one-to-one business email to a staff work address needs any additional notice, and the exact footer wording. `[REVIEW: counsel]`

### 1.5 CRM vocabulary used in every "CRM activity" row [VERIFIED]

Stage and status names are the identifiers in [`stages.ts`](../../../app/src/lib/gtm/stages.ts): `target_account`, `discovery`, `qualified`, `multi_stakeholder_demo`, `outcome_workshop`, `technical_review`, `security_privacy_accessibility_review`, `proposal`, `pilot_or_implementation_SOW`, `procurement_legal`, `contracted`, `implementation`, `live`, `renewal`, `expansion`, `closed_lost`. Account statuses: `target`, `engaged`, `pilot`, `customer`, `paused`, `closed_lost`.

Field names are those of [`CRM-DATA-MODEL.md`](../../commercial/CRM-DATA-MODEL.md) and [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md): activity (`actor`, `timestamp`, `type`, `factual summary`, `outcome`, `next action`, `evidence link`); stakeholder (`consent/contact basis`, `preference/suppression`, `last/next interaction`, `committee_role`); opportunity (stage, `stage_entered_at`, `next_action`, `next_action_due`, `target_score`, `qualification_score`, `tier`, `forecast_category`, `loss_reason`, `future_contact_rule`). Several names are prose in the data model and are not yet columns [GAP: no data dictionary]. Activity `type` values used here (`email_sent`, `email_reply`, `meeting_held`, `opt_out`, `bounce`) are labels for the activity log, not new stages. The funnel step "Contacted" has no stage identifier in `stages.ts`; it is evidenced by the first `email_sent` activity while the opportunity stays `target_account` (see [`CRM_PIPELINE_DEFINITION.md`](CRM_PIPELINE_DEFINITION.md), GAP table).

### 1.6 A/B rule [ASSUMPTION]

Test one variable at a time; the metric is **positive reply rate** or **meeting-booked rate**, never opens (open tracking is not used: it is unreliable and is not a success metric). At the proposed volume cap (section B.2) a statistically meaningful comparison is unlikely for the first quarter. Therefore treat every A/B as **directional**: send variant A and B alternately to similar-tier accounts, record the variable in the activity `factual summary`, and draw no conclusion before roughly 40 sends per arm [ASSUMPTION]. Never test a claim, never test the footer, never test anything that changes what is promised.

## 2. Cadence overview [ASSUMPTION: all intervals are business days and may be changed by the owner]

| Seq | Touch | Day | Stage at send | Stops when |
| --- | --- | --- | --- | --- |
| 1 | 1.1 cold introduction | 0 | `target_account` (`target`) | reply, opt-out, bounce |
| 2 | 2.1 scoped, low-risk explanation | +4 | `target_account` | same |
| 3 | 3.1 security and procurement readiness | +9 | `target_account` | same |
| 4 | 4.1 breakup and referral | +16 | `target_account` then `paused` if silent | same |
| 5 | 5.1 recap; 5.2 evidence and stakeholder follow-up | +1 and +5 after the discovery meeting | `discovery` | reply or next step booked |
| 6 | 6.1 recap; 6.2 evidence answers and next step | +1 and +5 after the demo | `multi_stakeholder_demo` | same |
| 7 | 7.1 invitation; 7.2 reminder | on request; +3 | `multi_stakeholder_demo` to `outcome_workshop` | session booked or declined |
| 8A | 8A.1 scoping summary; 8A.2 follow-up | on session close; +5 | `outcome_workshop` | decision or silence |
| 8B | HOLD proposal delivery | -- | `proposal` | not sendable |
| 9A | 9A.1 evidence status; 9A.2 prerequisites check | on request; +5 | `technical_review`, `security_privacy_accessibility_review` | prerequisites recorded |
| 9B | HOLD paper and billing | -- | `procurement_legal` | not sendable |
| 10A | 10A.1 sponsor brief; 10A.2 nudge | after champion agrees; +5 | `outcome_workshop` onward | sponsor call booked or declined |
| 10B | HOLD sponsor sign-off | -- | -- | not sendable |
| 11, 12, 13, 14 | HOLD templates (and 11-DP, 12-DP, 14-DP variants) | -- | `live`, `renewal`, `expansion` | not sendable |
| 15 | 15.1, 15.2, 15.3 re-engagement | 0, +7, +14 | `paused` account | reply, opt-out, third touch sent |

An account runs **one sequence at a time**. Sequences 1-4 are one cold run of four touches over about 16 business days; touches 2-4 are separate sections because each has its own purpose, subject lines and stop test. A reply from any contact at the account pauses every other contact's run until the reply is handled (section C).

The shared procedures follow Sequence 15: **A** send-approval checklist, **B** personalization record, deliverability hygiene and volume cap, **C** reply handling and suppression, **D** metrics.

## Sequence 1: Cold outreach, problem-led introduction [DRAFT] [Gate: allowed now]

### Email 1.1 (touch 1, day 0)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Reducing registration friction for [Institution]` (the founder's default; control); (b) `[Institution]: a scoped conversation on registration readiness`; (c) `A question about [short reason] and registration at [Institution]` |
| Target persona | P2 or P1 first; P3 only when the reason is an executive initiative. One person per account per week (section B.2) |
| Personalization placeholder and required reason | `[specific institutional trigger, initiative, public challenge, program, leadership change, or strategic priority]` (the founder's placeholder, kept verbatim). **A real, specific, verifiable reason is REQUIRED.** The RFO test (1.1, R1-R7) is passed and recorded in the personalization record before this email is sent. No reason, do not send |
| Trigger | Account is Tier A (target score 16-20, no automatic disqualifier) at `target_account`; owner assigned; RFO test recorded; suppression check done; inside the volume cap |
| Desired action | Reply, or accept a 20-minute conversation. Success is a positive reply or a booked meeting, not an open |
| A/B variant | Variable: **the closing ask only**. A = the verbatim 20-minute conversation question (control). B = "Would a one-page written outline of the pilot scope be more useful than a call?" Everything else identical. Metric: positive reply rate and meeting-booked rate |
| CRM activity to record | `activity`: `type=email_sent`, `actor=Harrison Rubin`, `timestamp`, `factual summary` = sequence id 1, touch 1.1, `rfo_type`, subject variant, A/B arm, `evidence link` = RFO source URL; stakeholder `consent/contact basis` = one-to-one business contact at work address, address source recorded; stakeholder `last/next interaction`; opportunity stays `target_account` (account status `target`), `next_action` = send 2.1, `next_action_due` = +4 business days |
| Follow-up timing | 2.1 after 4 business days with no reply |
| Stop condition | Any reply, opt-out, hard bounce, automatic reply indicating the person has left, a role change found, or an RFO that has become stale or wrong. Any one of these stops all touches to this person |
| Compliance note | Footer F1 with postal and sender identification filled in or **do not send** `[REVIEW: counsel]`. Opt-outs honored per section C.1. No claim outside the lexicon (1.3). The word "pilot" below means a **design-partner scoping conversation** under the current go/no-go; nothing is activated, no live data moves. If the recipient asks, say so plainly (reply template R-P in section C.3) |

**Body (the founder's default, verbatim; do not weaken it).**

```
Subject: Reducing registration friction for [Institution]

Hi [First Name],

I'm Harrison, building Semester - a student operating system designed to help institutions turn fragmented student planning and support workflows into clear, trackable actions.

I reached out because [specific institutional trigger, initiative, public challenge, program, leadership change, or strategic priority].

We are speaking with [role/team] leaders about a narrowly scoped Registration Readiness Pilot. The goal is not to replace existing systems. It is to help a defined student cohort understand next steps, complete priority actions, and give staff a clearer view of where students are getting stuck.

For a pilot, we would jointly measure: student activation / first meaningful action / readiness/workflow completion / support or advising friction / student confidence and satisfaction.

Would a 20-minute conversation next week be useful to compare your current process and see whether this is relevant for [Institution]?

Best,
Harrison Rubin
Founder, Semester
[Website]
[Calendar link]
```

**Added line (the only addition): opt-out and identification footer.**

```
Semester | [LEGAL SENDER NAME] | [POSTAL ADDRESS]
If you would rather I not contact you about this, reply "no thanks" and I will not write again.
```

Internal annotations (not sent):

- "Registration Readiness Pilot" means a design-partner scoping conversation under the current gate: discovery, synthetic demonstration, evidence exchange and conditional scoping. It does not mean live-data activation. The list of measures is the founder's; "jointly measure" is true only as a scoping topic, because no pilot is active and no result exists.
- `[Website]` and `[Calendar link]` are real, working links before sending. `[role/team]` is the persona's real team name, not a generic phrase.
- "We are speaking with [role/team] leaders" must be true on the send date (open decision D5). If it is not, use the variant "I am looking to speak with [role/team] leaders" and record the deviation; this is a truthfulness correction, not a rewrite of the offer. [REVIEW: counsel]
- Success measures named in the email are not outcome claims: do not describe any of them as achieved, improved or expected.

## Sequence 2: Follow-up, scoped and low-risk pilot explanation [DRAFT] [Gate: allowed now]

### Email 2.1 (touch 2, +4 business days)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Re: Reducing registration friction for [Institution]`; (b) `How narrow the first step would be`; (c) `One cohort, one workflow, no student data: [Institution]` |
| Target persona | Same person as 1.1 (P1 or P2) |
| Personalization placeholder and required reason | `[REASON_SHORT]` = the same RFO recorded for 1.1, restated in at most ten words, **plus** one new relevant fact if one exists (e.g., a newly published page). The RFO must still pass R3 (recent) and R6 (fair). No reason, do not send |
| Trigger | No reply to 1.1 after 4 business days; no opt-out, bounce or auto-reply of departure |
| Desired action | Reply with interest or a time for a 20-minute conversation |
| A/B variant | Variable: **the first sentence** (A: references the earlier note; B: opens with the narrow-scope statement). Metric: positive reply rate |
| CRM activity to record | `email_sent`, sequence 2, touch 2.1, A/B arm; opportunity `target_account`; `next_action` = send 3.1; `next_action_due` = +5 business days |
| Follow-up timing | 3.1 after 5 more business days |
| Stop condition | As 1.1 |
| Compliance note | F1. Describes the scoping conversation, not an activated pilot; no outcome language; no integration implied. `[REVIEW: counsel]` for footer and jurisdictional rules |

**Body**

```
Hi [First Name],

Following up on my note about [REASON_SHORT].

In case it helps to know how small the first step would be: the conversation I'm suggesting is a scoping discussion. It involves no student data, no integration and no access to any of your systems.

If it turned out to be worth pursuing, the idea is one student cohort and one registration-readiness workflow, set up beside your existing systems rather than in place of them, using manual or synthetic data first. Nothing would start without your privacy, security and accessibility reviewers' written agreement, and a written decision point and exit would be agreed up front, including the option to stop.

I'd like to learn whether the problem is real enough at [Institution] to be worth scoping. Would 20 minutes on [Date option 1] or [Date option 2] work?

Best,
Harrison
[F1 footer]
```

## Sequence 3: Follow-up, security and procurement readiness [DRAFT] [Gate: allowed now; evidence exchange]

### Email 3.1 (touch 3, +9 business days)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Security and procurement questions, answered honestly`; (b) `What [Institution]'s reviewers would see from us today`; (c) `Before you spend time on this: where our evidence stands` |
| Target persona | P4, P5 or P7 when a name is known from the RFO source; otherwise the same person as 1.1 (P1 or P2) with a request to forward |
| Personalization placeholder and required reason | `[REASON_SHORT]` plus, when the reviewer is a new contact, `[REFERRER OR PUBLIC SOURCE]`. A **new** contact needs its **own** passed RFO test; a forwarded note does not. No reason, do not send to the new contact |
| Trigger | No reply after touch 2; or a reply asked about security; or the RFO source is itself a procurement or security notice |
| Desired action | Reply naming the reviewer or any prerequisite (such as a SOC 2 report, VPAT, penetration test or HECVAT) so both sides know early whether this can fit |
| A/B variant | Variable: **subject line** (a vs b). Metric: positive reply rate (a reply naming a prerequisite counts as positive: it is real information) |
| CRM activity to record | `email_sent`, sequence 3; if a reviewer is named: new stakeholder with `committee_role` (`ciso_privacy`, `cio`, `procurement` or `legal`), `consent/contact basis`; if a prerequisite is named: `gtm_decision_log` entry (category `security`, `privacy`, `accessibility` or `procurement`, status `open`, owner, requested date, target date); opportunity `target_account`; `next_action` = send 4.1 |
| Follow-up timing | 4.1 after 7 more business days |
| Stop condition | As 1.1; also stop on a reply naming a prerequisite we cannot meet (record it as an accepted prerequisite or a disqualifier per [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md), and do not argue) |
| Compliance note | F1. Every status sentence below is a [VERIFIED] fact from the RFP library rows SEC-4, SEC-5, AX-2, PF-1, PF-4 and TA-2 and [`CONTROL-FACTS.md`](../../trust/CONTROL-FACTS.md); do not soften or upgrade it. No assurance language |

**Body**

```
Hi [First Name],

Many reviewers ask about security, privacy and accessibility before anything else, so here is an honest status rather than a pitch.

What exists: written drafts of a data-flow description, a security and privacy overview, an accessibility overview, an AI governance overview and a HECVAT readiness register that shows which items are supported by evidence and which are not. They are drafts and have not been through an independent review.

What does not exist yet: a SOC 2 report, an accessibility conformance report (VPAT), an independent penetration test, a signed data processing agreement, and a published subprocessor list. We do not claim any of them. If one is a prerequisite at [Institution], it is much better for both of us to know now.

Could you tell me who would review this on your side, and whether any of those is a firm prerequisite? I can then send the right draft materials, with their gaps visible.

Best,
Harrison
[F1 footer]
```

## Sequence 4: Breakup and referral request [DRAFT] [Gate: allowed now]

### Email 4.1 (touch 4, +16 business days)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Closing the loop on registration readiness at [Institution]`; (b) `Is there someone better placed than you for this?`; (c) `Last note from me on [short reason]` |
| Target persona | Same as touch 1; the referral ask targets whoever owns registration readiness or student success |
| Personalization placeholder and required reason | `[REASON_SHORT]` (unchanged RFO). If the RFO is now more than 12 months old, do not send. A referral named in a reply becomes a **new** RFO type `referral` for the referred person |
| Trigger | No reply after touches 1-3 |
| Desired action | Either "not now" (clean close) or a name or role who owns this. A referral is a positive outcome; so is a clear no |
| A/B variant | Variable: **the referral ask** (A: asks for a name; B: asks for a role or office only, lower friction). Metric: referral rate |
| CRM activity to record | `email_sent`, sequence 4; opportunity `next_action` = none within the sequence; set account status `paused` with `future_contact_rule` = no cold contact for 180 days [ASSUMPTION], `loss_reason` left blank (silence is not a rejection; do not use `closed_lost`); a referral reply creates a stakeholder with `consent/contact basis` = referral, source = referrer, and an RFO of type `referral` |
| Follow-up timing | None. Sequence 15 may run after 180 days only if a new RFO passes |
| Stop condition | Send once. Stop all contact on any reply, and honor an opt-out immediately |
| Compliance note | F1. Do not name the referrer to the referred person unless the referrer said that is fine. Do not imply the recipient agreed to anything. `[REVIEW: counsel]` |

**Body**

```
Hi [First Name],

I'll stop here, since I have not heard back, and I would rather not add to your inbox. If registration readiness is not a priority at [Institution] right now, no reply is needed.

If someone else owns this, for example [ROLE OR OFFICE], I would be grateful for a pointer. I would only mention your name if you tell me that is fine.

If the timing is simply wrong, reply "not now" and I will not follow up.

Best,
Harrison
[F1 footer]
```

## Sequence 5: Post-discovery follow-up [DRAFT] [Gate: allowed now]

Sent after a discovery conversation actually happened (`meeting_held` recorded). Purpose: restate the problem in the champion's words so it can be corrected, because the `qualified` exit in [`SALES_EXIT`](../../../app/src/lib/gtm/stages.ts) needs "a named champion, a stated problem in their words, a budget cycle and a decision process".

### Email 5.1 (day +1 after the discovery meeting)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `What I heard, for you to correct`; (b) `Notes from today: [Institution] registration readiness`; (c) `Thank you, and three things to confirm` |
| Target persona | The person met (P1, P2 or P3); copy only people who attended |
| Personalization placeholder and required reason | `[PROBLEM IN THEIR WORDS]`, `[MILESTONE AND DATE]`, `[COHORT SIZE]`, `[PROCUREMENT PATH]` taken from the call notes. The reason for the email is the meeting itself: it passes the RFO test only if a meeting is recorded. No meeting recorded, do not send |
| Trigger | Discovery meeting held; notes entered the same day |
| Desired action | Correct the recap, confirm champion, budget cycle and decision process, and agree the next step |
| A/B variant | Variable: **recap format** (A: three-bullet recap; B: five-line table). Metric: reply rate with corrections or confirmation (a substantive reply, not a thank-you) |
| CRM activity to record | `email_sent` sequence 5; `meeting_held` already logged; opportunity `discovery` (account status `engaged`), `stage_entered_at`; stakeholder `committee_role`; `qualification_score` computed from the call (scorecard unchanged); `next_action` = confirm next step; `next_action_due` = +5 business days |
| Follow-up timing | 5.2 after 4 more business days |
| Stop condition | Reply received; or the prospect says it is not a fit (record `loss_reason` and `future_contact_rule` and move to `closed_lost` only when the rejection or disqualifier is explicit); opt-out |
| Compliance note | F2. Recap only what the prospect said; add no commitment, price, date or claim; do not include student cases or sensitive examples from the call (never collected). `[REVIEW: counsel]` |

**Body**

```
Hi [First Name],

Thank you for the time today. Here is what I heard, so you can correct it:

- The problem, in your words: [PROBLEM IN THEIR WORDS]
- The milestone and date it matters: [MILESTONE AND DATE]
- The group that would be involved: [COHORT DESCRIPTION AND APPROXIMATE SIZE]
- How a decision like this is made at [Institution], and the budget cycle: [DECISION PROCESS AND BUDGET CYCLE, OR "not yet clear to me"]

Could you tell me what I have wrong or missing, and who you would want involved next (for example IT, privacy, accessibility and an academic sponsor)?

Next step I would suggest: [A SYNTHETIC-DATA DEMONSTRATION FOR THE PEOPLE YOU NAME / A SECOND CONVERSATION]. Nothing in it uses student data, and no commitment follows from it.

Best,
Harrison
[F2 footer]
```

### Email 5.2 (+4 business days after 5.1, no reply)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `One thing that would help: who else should see this?`; (b) `Re: What I heard, for you to correct`; (c) `Still useful for [Institution]? A quick yes or no` |
| Target persona | Same as 5.1 |
| Personalization placeholder and required reason | `[ONE ITEM FROM THE CALL THAT STILL NEEDS AN ANSWER]` (e.g., an evidence request logged during the call). Reason = the recorded open item. No recorded open item, do not send |
| Trigger | No reply to 5.1 |
| Desired action | Name the missing stakeholder or confirm the next step; or say "not a fit" |
| A/B variant | Variable: **the ask** (A: name a stakeholder; B: offer two dates for the demonstration). Metric: meeting-booked rate |
| CRM activity to record | `email_sent` sequence 5, touch 5.2; opportunity stays `discovery`; if a stakeholder is named, add one with `committee_role`; `next_action_due` updated |
| Follow-up timing | None automatic. After 10 business days of silence, set `next_action` = decide: pause (account status `paused`) or keep |
| Stop condition | Reply, opt-out, or the second touch sent |
| Compliance note | F2. Honest about scope. No pressure language ("last chance", "limited availability", scarcity: CLM-015 prohibits scarcity claims) |

**Body**

```
Hi [First Name],

One item from our conversation is still open: [OPEN ITEM, e.g., "you asked what we can say about accessibility testing"].

Short answer for now: [VERIFIED, STATUS-ACCURATE ANSWER FROM THE RFP LIBRARY, e.g., "automated accessibility audits run on the critical journeys; there is no completed formal accessibility conformance report yet, and we do not claim conformance"].

If it would help to include [ROLE] before going further, tell me who and I will keep the next step small. If this is not a fit, a one-line "not now" is just as useful.

Best,
Harrison
[F2 footer]
```

## Sequence 6: Post-demo follow-up [DRAFT] [Gate: allowed now; synthetic data only]

### Email 6.1 (day +1 after the demonstration)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Demo recap and open questions: [Institution]`; (b) `What you saw today, and what is not available yet`; (c) `Thank you; your reviewers' questions, logged` |
| Target persona | Every attendee, individually addressed if their roles differ; P1/P2 lead, P4-P6 on technical items |
| Personalization placeholder and required reason | `[ATTENDEE ROLES]`, `[EACH STAKEHOLDER'S TOP QUESTION]` from the demo log. Reason = the demonstration they attended. No attendance record, do not send |
| Trigger | Demonstration run from the [`DEMO-PLAYBOOK.md`](../../market-readiness/DEMO-PLAYBOOK.md) on synthetic data; attendee roles and each stakeholder's top objection and evidence request logged |
| Desired action | Confirm the questions list and accept a pilot-design session (sequence 7) or say what blocks it |
| A/B variant | Variable: **whether the evidence-request list is inline or in an attachment**. Metric: reply rate with any answer |
| CRM activity to record | `email_sent` sequence 6; `meeting_held` (demo) already logged with attendee roles; opportunity `multi_stakeholder_demo` (account `engaged`) once the demo exit evidence in the scoring doc is complete; `gtm_decision_log` entries for each question; `next_action` = propose design session |
| Follow-up timing | 6.2 after 4 more business days |
| Stop condition | Reply with a next step; "not a fit"; opt-out |
| Compliance note | F2. Use the three labels (**available**, **pilot-dependent**, **planned/unavailable**) exactly as in [`SALES-PLAYBOOK.md`](../../commercial/SALES-PLAYBOOK.md). State that everything shown used synthetic data. No claim outside [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |

**Body**

```
Hi [First Name],

Thank you for joining. Everything you saw used synthetic data; no [Institution] information was involved.

Where each thing stands today:
- Available now (demonstrated): [ITEMS, e.g., "planning view, readiness checklist, aggregate cohort view on synthetic data"].
- Would depend on a bounded configuration agreed with you: [ITEMS].
- Planned, not available: [ITEMS, e.g., "single sign-on, learning-system launch, any connection to your student information system"].

Questions your colleagues raised, and where each stands:
1. [ROLE]: [QUESTION] - [STATUS: answered / draft evidence available / open, owner Harrison, by DATE]
2. [ROLE]: [QUESTION] - [STATUS]

Please correct anything I recorded wrongly. If it is useful, the next step I would suggest is a working session to decide whether a narrow scope is worth writing down (cohort, workflow, three to five measures, data authority, decision date). It would still involve no live data and no commitment.

Best,
Harrison
[F2 footer]
```

### Email 6.2 (+4 business days, no reply)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Answers to your reviewers' questions`; (b) `Re: Demo recap: next step?`; (c) `Would a working session make sense?` |
| Target persona | The champion (P2 or P1) |
| Personalization placeholder and required reason | `[ANSWERS OR STATUS UPDATES FOR LOGGED QUESTIONS]`: the reason is genuinely new information (an answer that did not exist at 6.1). No new information, send nothing and wait |
| Trigger | No reply to 6.1; at least one logged question has a new status |
| Desired action | Book the design session (sequence 7) or name the blocker |
| A/B variant | Variable: **two proposed times vs a scheduling link**. Metric: meeting-booked rate |
| CRM activity to record | `email_sent` sequence 6, touch 6.2; `gtm_decision_log` statuses updated (`open`, `in_review`, `blocked`, `approved` or `declined`; an `approved` entry needs evidence links per `entryProblems`); opportunity stays `multi_stakeholder_demo`; `next_action_due` |
| Follow-up timing | None automatic; at +10 business days decide to pause or keep |
| Stop condition | Reply, opt-out, `closed_lost` on explicit rejection |
| Compliance note | F2. Answers come from the RFP library, never from memory; a gap is stated as a gap. Do not answer a certification question with anything but the status |

**Body**

```
Hi [First Name],

Updates on the questions from the demonstration:
- [QUESTION]: [ANSWER OR STATUS, taken from the RFP library row; if absent, "not available yet, and we do not claim it"].
- [QUESTION]: [ANSWER OR STATUS].

Would [Date option 1] or [Date option 2] suit for a 60-minute working session on whether a narrow scope is worth writing down? If a different next step suits you better, tell me and I will follow it.

Best,
Harrison
[F2 footer]
```

## Sequence 7: Pilot-design-session invitation [DRAFT] [Gate: allowed now; no live data, no commitment]

A design session is a working meeting, not a pilot. It moves the opportunity toward `outcome_workshop`, whose gate in `SALES_EXIT` is "The buying committee is mapped, including IT, privacy, accessibility and the academic sponsor". It never creates a launch obligation.

### Email 7.1 (on the champion's agreement, or +1 business day after 6.2 gets a yes)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `A working session to decide whether to scope a pilot`; (b) `Designing the narrow scope together: [Institution]`; (c) `60 minutes to define cohort, measures and decision date` |
| Target persona | P2 or P1 (champion) and, by invitation, P3, P4, P5, P6 |
| Personalization placeholder and required reason | `[PROBLEM IN THEIR WORDS]` and `[MILESTONE]` from discovery; the reason is the champion's own agreement to a next step. Not recorded, do not send |
| Trigger | Discovery recap confirmed (5.1) and demonstration done (6.1), or the champion asked for it |
| Desired action | Agree a date and name the attendees for each committee role |
| A/B variant | Variable: **session length (60 vs 90 minutes)**. Metric: meeting-booked rate |
| CRM activity to record | `email_sent` sequence 7; stakeholders created for each named person with `committee_role`; `unmappedRoles` check against `COMMITTEE_ROLES` (`executive_sponsor`, `operational_owner`, `cio`, `ciso_privacy`, `accessibility`, `registrar_data_governance`, `procurement`, `legal`, `finance`, `champion`); opportunity stays `multi_stakeholder_demo` until the committee is mapped; then `outcome_workshop`; `qualification_score` confirmed to enter `qualified` if not yet |
| Follow-up timing | 7.2 after 3 business days |
| Stop condition | Session booked (stop), declined (record `loss_reason`/pause), opt-out |
| Compliance note | F2. State plainly: no live data, no payment, no commitment, and measures are agreed as scoping topics. Do not mention a start date. `[PILOT WINDOW - TO BE CONFIRMED]` is the only duration token and appears only inside the attached agenda, never as a promise |

**Body**

```
Hi [First Name],

Based on what you told me about [PROBLEM IN THEIR WORDS] and the date that matters, [MILESTONE AND DATE], I would like to propose a working session to decide whether a narrow scope is worth writing down.

What we would do together, in [60 / 90] minutes:
1. Name one cohort and one workflow, and what is explicitly out of scope.
2. Agree three to five measures and what baseline exists today for each (we would not start anything without a baseline).
3. Agree what data, if any, would be needed, using the minimum necessary, and keeping manual or read-only sources first.
4. List who needs to review: IT, privacy, security, accessibility, procurement, and the academic sponsor, and what each of them would need to see.
5. Set a decision date, including the option to stop.

It involves no live data, no payment and no commitment from either side. If it shows the fit is not there, that is a good outcome too.

Could you suggest a date, and tell me who from those groups should join?

Best,
Harrison
[F2 footer]
```

### Email 7.2 (+3 business days, reminder)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Agenda for the working session`; (b) `Re: A working session to decide whether to scope a pilot`; (c) `What to bring (nothing confidential)` |
| Target persona | Same as 7.1 |
| Personalization placeholder and required reason | `[AGENDA ITEMS]` and a "what to bring" list. Reason: new information (the agenda attachment). No agenda, do not send |
| Trigger | No answer to 7.1 |
| Desired action | Confirm a date and attendees |
| A/B variant | Variable: **agenda inline vs attached**. Metric: meeting-booked rate |
| CRM activity to record | `email_sent` sequence 7, touch 7.2; opportunity unchanged; `next_action_due` |
| Follow-up timing | None; at +10 business days decide pause or keep |
| Stop condition | Booked, declined, opt-out |
| Compliance note | F2. "What to bring": counts and descriptions only, never student records or personal data |

**Body**

```
Hi [First Name],

Attaching a one-page agenda for the working session. To keep it low-effort, please bring only descriptions and counts: the term-start or registration steps students go through today, roughly how many students are in the group you have in mind, and what you already track about where they get stuck. No student records or personal information, please.

Would [Date option 1] or [Date option 2] work?

Best,
Harrison
[F2 footer]
```

## Sequence 8: Pilot proposal delivery [DRAFT]

### 8A. Scoping summary delivery (non-binding) [Gate: allowed now]

Allowed because it is a conditional scoping document with no price, no order form, no start date and no obligation, under [`PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) ("discovery, demo, evidence exchange and conditional scoping are permitted now"). It may use [`PILOT-PROPOSAL-TEMPLATE.md`](../../commercial/PILOT-PROPOSAL-TEMPLATE.md) only with the price, dates and signature sections removed or left as `[PRICE TO BE CONFIRMED]` and `[DATE]` placeholders.

### Email 8A.1 (within 2 business days of the design session)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Non-binding scoping summary for [Institution]`; (b) `What we agreed in the working session, in writing`; (c) `Draft scope: [COHORT] and [WORKFLOW]` |
| Target persona | P2 or P1; P3 copied if the champion agrees |
| Personalization placeholder and required reason | `[COHORT]`, `[WORKFLOW]`, `[MEASURES AND BASELINES AS AGREED]`, `[OPEN ITEMS WITH OWNERS]`. Reason = the working session. Session not recorded, do not send |
| Trigger | Design session held; committee mapped; qualification score entered; proposal exit evidence in progress (security, privacy and accessibility review started and answered from the RFP library) |
| Desired action | Review and correct the draft scope; confirm which reviewers should see it; agree a decision conversation date |
| A/B variant | Variable: **summary length (one page vs three)**. Metric: reply rate with specific corrections |
| CRM activity to record | `email_sent` sequence 8A; document version link as `evidence link`; opportunity `outcome_workshop` (gate met); if proposal exit evidence is complete, `proposal` for a **non-binding** scope with `forecast_category` = pipeline and `probability` blank (none is approved); `next_action` = decision conversation; every amount field empty or `[PRICE TO BE CONFIRMED]` |
| Follow-up timing | 8A.2 after 5 business days |
| Stop condition | Reply with decision, "not now", opt-out |
| Compliance note | F2. Attachment is labeled "DRAFT: non-binding scoping summary, not an offer, not a quotation". No price, no start date, no commitment to launch, no integration, no outcome. `[REVIEW: counsel]` before any attached scope document is released |

**Body**

```
Hi [First Name],

Thank you for the working session. Attached is a short, non-binding scoping summary of what we discussed. It is a draft for you to correct, not an offer or a quotation.

In brief:
- Group and workflow: [COHORT] and [WORKFLOW].
- What would be measured, and the baseline for each: [MEASURES AND BASELINES, or "baseline not yet available: to be agreed before anything starts"].
- Data: [MINIMUM NECESSARY, MANUAL OR READ-ONLY FIRST, OR NONE].
- Out of scope: replacing any official system, any official registration, grade, aid or advising decision, individual risk scoring, and any connection not separately approved.
- What would have to be true before anything could start: written approvals from your privacy, security, accessibility and procurement reviewers, an agreed decision date, and conditions on our side that are still being completed. Commercial terms are not included and are not available yet.
- Open items and owners: [LIST].

What I would find most useful: corrections to anything that is wrong, and who should see it next. Would [Date] work for a short conversation about it?

Best,
Harrison
[F2 footer]
```

### Email 8A.2 (+5 business days)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Re: Non-binding scoping summary`; (b) `Any corrections to the draft scope?`; (c) `Is this still the right shape for [Institution]?` |
| Target persona | Same as 8A.1 |
| Personalization placeholder and required reason | `[ONE SPECIFIC OPEN ITEM]`; reason = the open item recorded in 8A.1. None, do not send |
| Trigger | No reply to 8A.1 |
| Desired action | Corrections, a decision conversation date, or "not now" |
| A/B variant | Variable: **ask for corrections vs ask for a yes/no on whether to continue**. Metric: positive reply rate |
| CRM activity to record | `email_sent` sequence 8A, touch 8A.2; stage unchanged; `next_action_due` |
| Follow-up timing | None; at +10 business days decide pause (account status `paused`) or keep |
| Stop condition | Reply, opt-out |
| Compliance note | F2; no pressure or scarcity language |

**Body**

```
Hi [First Name],

I wanted to check whether the draft scope is close to right. The item I am least sure about is [OPEN ITEM]. If the shape is wrong, or the priority has moved, please tell me; a clear "not now" is useful and I will not follow up.

Best,
Harrison
[F2 footer]
```

### 8B. Pilot proposal delivery with price (**HOLD: do not send**) [Gate: paid-pilot NO-GO]

| Field | Value |
| --- | --- |
| Hold condition | The exact gate condition above (paid pilot returns to GO) **and** CLM-015 approval for price wording **and** counsel-approved paper **and** a named signer and pilot plan with no `pilotReadiness` problems |
| Subject-line options | (a) `Pilot proposal for [Institution]: for your review`; (b) `Proposed [COHORT] pilot: scope, measures, [PRICE TO BE CONFIRMED]`; (c) `Proposal and next steps` |
| Target persona | P3 and P2; P7 and P8 copied after the champion agrees |
| Personalization placeholder and required reason | `[SIGNED DESIGN SESSION OUTCOMES]`, `[APPROVED PLAN LINK]`; reason = the agreed scope and a satisfied hold condition |
| Trigger | Opportunity at `proposal` after the proposal exit (security, privacy and accessibility review started, answered from the RFP library); `pilotReadiness` returns no problems for `pilot_or_implementation_SOW` |
| Desired action | Review, route to procurement and legal |
| A/B variant | None. A proposal is never A/B tested |
| CRM activity to record | `email_sent`; `proposal` or `pilot_or_implementation_SOW`; immutable proposal version link; amount/currency/evidence state with `probability_source`; deal-desk review reference; `forecast_category` per rules |
| Follow-up timing | check-in 5 business days later; escalation per owner |
| Stop condition | decision, procurement acceptance, rejection |
| Compliance note | `[REVIEW: counsel]`, `[REVIEW: tax]`, `[REVIEW: procurement]`; terms are non-binding drafts until counsel-approved paper is executed |

**Body [HOLD TEMPLATE]**

```
Hi [First Name],

As discussed, attached is the proposed pilot scope for [Institution]: [COHORT], [WORKFLOW], measures and baselines, data plan, responsibilities, support scope, decision date and offboarding.

Commercial terms: [PRICE TO BE CONFIRMED]. Taxes, payment terms and termination terms are [PLACEHOLDER] and are subject to counsel-approved paper. This email and the attachment are not binding until executed paper is signed by authorized signers on both sides.

Pilot window: [PILOT WINDOW - TO BE CONFIRMED]. Start date: [DATE - SUBJECT TO WRITTEN GO ON BOTH SIDES].

Could you tell me who in procurement and legal should receive this, and what your review steps and timing are?

Best,
Harrison
[F1 footer]
```

## Sequence 9: Procurement and security follow-up [DRAFT]

### 9A. Evidence-status follow-up [Gate: allowed now]

Purpose: answer questionnaire items honestly using the labels in [`HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) and the HECVAT register in [`HECVAT-READINESS-MATRIX.md`](../../trust/HECVAT-READINESS-MATRIX.md). Each answer carries one label: implemented, pilot-scoped, planned, not applicable, customer responsibility, or gap ([`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)).

### Email 9A.1 (within 2 business days of a reviewer's request)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Your security and privacy questions: status and gaps`; (b) `Evidence for [REVIEWER ROLE] at [Institution]: what exists and what does not`; (c) `Questionnaire answers, labeled honestly` |
| Target persona | P5, P4, P6, P7 (the reviewer who asked), champion copied |
| Personalization placeholder and required reason | `[REVIEWER'S QUESTIONS, VERBATIM]`; reason = a documented request. No request, do not send |
| Trigger | A reviewer asked a question or sent a questionnaire |
| Desired action | Tell us which gaps are acceptable prerequisites and which are disqualifiers; name a review owner and date |
| A/B variant | None. Security answers are not tested |
| CRM activity to record | `email_sent`; one `gtm_decision_log` entry per question: `committee_role`, `category`, `status` (`open` or `in_review`), `owner`, `requested_date`, `target_date`, `evidence_links`, `risk_level`; opportunity `technical_review` or `security_privacy_accessibility_review`; `next_action` |
| Follow-up timing | 9A.2 after 5 business days |
| Stop condition | Prerequisite recorded as accepted or disqualifying; opt-out |
| Compliance note | F2. Every answer is the RFP library text or a plain "not available yet"; no paraphrase that upgrades a status; attached materials are labeled draft. `[REVIEW: security]` `[REVIEW: privacy]` `[REVIEW: accessibility]` |

**Body**

```
Hi [First Name],

Here are answers to your questions, each labeled with where it actually stands.

1. [QUESTION]: [LABEL: implemented / pilot-scoped / planned / not applicable / customer responsibility / gap]. [ANSWER AS WRITTEN IN THE RFP LIBRARY, e.g., "No independent penetration test has been performed; one is planned."] Evidence: [PATH OR "none yet"].
2. [QUESTION]: [LABEL]. [ANSWER].

For several items the honest answer is that the evidence does not exist yet. I would rather you see that now. Could you tell me which of these are acceptable prerequisites for a scoping stage, and which would end the conversation? I will record both.

Who owns the review on your side, and by when would you like a next update?

Best,
Harrison
[F2 footer]
```

### Email 9A.2 (+5 business days)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Acceptable prerequisites: your view`; (b) `Re: Your security and privacy questions`; (c) `Anything blocking on the security side?` |
| Target persona | Same reviewer |
| Personalization placeholder and required reason | `[OPEN QUESTION COUNT AND DATES]`; reason = log items still open. None open, do not send |
| Trigger | No reply to 9A.1 |
| Desired action | Confirm prerequisites or request specific artifacts |
| A/B variant | None |
| CRM activity to record | `email_sent`; log statuses; if a required prerequisite is unmet and unacceptable, record disqualifier; `closed_lost` with `loss_reason` and `future_contact_rule` if the prospect withdraws |
| Follow-up timing | none automatic |
| Stop condition | Reply, opt-out |
| Compliance note | F2; no argument against a disqualifier |

**Body**

```
Hi [First Name],

Checking whether anything on the security, privacy or accessibility side would stop this from going further. Open items from my side: [COUNT] question(s), owner Harrison, targets [DATES]. If one of the gaps I listed is a firm requirement, please say so; I will record it and we can both decide whether this fits now or later.

Best,
Harrison
[F2 footer]
```

### 9B. Order form, DPA execution, vendor onboarding, invoicing (**HOLD: do not send**)

| Field | Value |
| --- | --- |
| Hold condition | Paid-pilot gate; counsel-approved paper ([`ORDER-FORM-TEMPLATE-DRAFT.md`](../../legal-drafts/ORDER-FORM-TEMPLATE-DRAFT.md), [`DATA-PROCESSING-ADDENDUM-DRAFT.md`](../../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md) are drafts); entity, tax, payment and insurance authority (go/no-go item 5) |
| Subject-line options | (a) `Order form and DPA for [Institution]: for procurement review`; (b) `Vendor onboarding documents`; (c) `Next steps in procurement` |
| Target persona | P7, P8, P5 |
| Personalization placeholder and required reason | `[PROCUREMENT CONTACT AND PROCESS]`; reason = accepted proposal and a procurement request |
| Trigger | `proposal` accepted into formal review (`procurement_legal`) |
| Desired action | Begin redline review |
| A/B variant | None |
| CRM activity to record | `procurement_legal`: redline register opened, deal-desk review with no refusals, approvers named per deviation |
| Follow-up timing | weekly status |
| Stop condition | signature, rejection |
| Compliance note | `[REVIEW: counsel]`, `[REVIEW: procurement]`, `[REVIEW: tax]`; documents are not terms until counsel-approved and executed |

**Body [HOLD TEMPLATE]**

```
Hi [First Name],

Attached for [Institution]'s procurement and legal review: [ORDER FORM - DRAFT], [DATA PROCESSING ADDENDUM - DRAFT], [PILOT AGREEMENT - DRAFT]. Price: [PRICE TO BE CONFIRMED]. These are drafts for review and are not binding until executed. Please send your standard vendor onboarding requirements and your review steps and timing.

Best,
Harrison
[F1 footer]
```

## Sequence 10: Executive sponsor follow-up [DRAFT]

### 10A. Sponsor brief (non-binding) [Gate: allowed now]

### Email 10A.1 (after the champion agrees to involve the sponsor)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `[CHAMPION NAME] asked me to share a short brief on registration readiness`; (b) `A decision for [Institution]: whether to scope a narrow registration-readiness effort`; (c) `One page for [SPONSOR TITLE]: scope, measures, and exit` |
| Target persona | P3 (`executive_sponsor`) |
| Personalization placeholder and required reason | `[CHAMPION NAME AND PERMISSION TO NAME THEM]`, `[MILESTONE]`, `[PROBLEM IN THE CHAMPION'S WORDS]`. The reason is a referral from the champion, who must have agreed to be named. No permission, do not send |
| Trigger | Champion (P2 or P1) agreed to bring the sponsor in; scoping summary 8A.1 exists |
| Desired action | A 20-minute sponsor conversation about the decision to make, not a pitch |
| A/B variant | Variable: **lead sentence** (A: the champion's problem; B: the decision requested). Metric: meeting-booked rate |
| CRM activity to record | `email_sent`; stakeholder `executive_sponsor` created with `consent/contact basis` = champion referral; `next_action` = sponsor call; stage unchanged (`outcome_workshop` requires the sponsor mapped) |
| Follow-up timing | 10A.2 after 5 business days |
| Stop condition | Call booked, declined, opt-out; never contact the sponsor if the champion withdraws permission |
| Compliance note | F1 (first contact with this person). No price, no start date, no outcome language. Do not imply the champion has committed the institution |

**Body**

```
Hi [Sponsor First Name],

[CHAMPION NAME] suggested I send you a short brief. They described [PROBLEM IN THE CHAMPION'S WORDS] ahead of [MILESTONE].

The decision on the table is small: whether to write down a narrow, non-binding scope for one student cohort and one registration-readiness workflow, with measures and a baseline agreed first, a written decision date, and the option to stop. Semester would sit beside your existing systems. No student data is involved at this stage, nothing is activated, and there is no commitment.

I would value 20 minutes to hear what would make that worth doing, or not, from your seat. A one-page brief is attached.

Best,
Harrison
Founder, Semester
[F1 footer]
```

### Email 10A.2 (+5 business days)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Re: A decision for [Institution]`; (b) `Would [CHAMPION NAME] be the better person to ask?`; (c) `A short question on priorities for [TERM]` |
| Target persona | P3; an alternative route through the champion |
| Personalization placeholder and required reason | `[MILESTONE]`; reason = same referral; if the champion's permission has lapsed, do not send |
| Trigger | No reply to 10A.1 |
| Desired action | Brief reply on priority, or redirect to a delegate |
| A/B variant | None |
| CRM activity to record | `email_sent`; `next_action` |
| Follow-up timing | none; the champion decides |
| Stop condition | Reply, opt-out, champion asks us to stop |
| Compliance note | F2 |

**Body**

```
Hi [Sponsor First Name],

A brief follow-up. If this is not a priority for [TERM], a one-line "not now" is all I need, and I will not follow up. If a colleague is better placed, please point me to them.

Best,
Harrison
[F2 footer]
```

### 10B. Sponsor sign-off on price, launch or contract (**HOLD: do not send**)

| Field | Value |
| --- | --- |
| Hold condition | Paid-pilot gate; counsel-approved paper; a launch-council GO for the named cohort (`live` gate) |
| Subject-line options | (a) `Decision requested: [Institution] pilot agreement`; (b) `For your signature, pending procurement and legal`; (c) `Sponsor review: scope, measures, and terms` |
| Target persona | P3, P8 |
| Personalization placeholder and required reason | `[APPROVED SCOPE]`, `[SIGNER]`; reason = a procurement-approved package |
| Trigger | `procurement_legal` complete with no deal-desk refusals |
| Desired action | Sign |
| A/B variant | None |
| CRM activity to record | `contracted` only after procurement and legal have signed and the deal desk has no refusals |
| Follow-up timing | per contract calendar |
| Stop condition | Signature or refusal |
| Compliance note | `[REVIEW: counsel]` `[REVIEW: tax]`. Not sendable until the gate flips |

**Body [HOLD TEMPLATE]**

```
Hi [Sponsor First Name],

Procurement and legal have completed their review of the [Institution] pilot agreement. The decision for you is whether to approve and sign: scope [SCOPE LINK], measures and decision date [DATES], terms [PRICE TO BE CONFIRMED]. Nothing is activated until the agreed readiness approvals on both sides are recorded.

Best,
Harrison
[F1 footer]
```

## Sequence 11: Mid-pilot executive update [HOLD] [Gate: no pilot can run]

### Email 11 (**HOLD: do not send**)

| Field | Value |
| --- | --- |
| Hold condition | Requires an activated pilot (`live`) with a launch-council GO. Held by the paid/activation gate: go/no-go priorities 1-8 for any live data or tenant activation; priorities 1-9 for a paid pilot |
| Subject-line options | (a) `[Institution] pilot: midpoint update, [DATE]`; (b) `Midpoint review: measures, issues, and decisions needed`; (c) `Where the pilot stands, and what I need from you` |
| Target persona | P3 (sponsor), P2 (champion); P5 and P6 copied on issues in their area |
| Personalization placeholder and required reason | `[MIDPOINT REVIEW DATE]` from the pilot plan (`midpointReviewDate`); reason = the agreed midpoint review |
| Trigger | The midpoint date in the plan; at least two weeks of hypercare completed |
| Desired action | Confirm decisions needed and attend the midpoint review |
| A/B variant | None |
| CRM activity to record | `email_sent`; opportunity `live` (account status `customer`); cohort-aggregate metrics only (suppressed below ten); `gtm_decision_log` entries for open issues; `next_action` = midpoint meeting |
| Follow-up timing | weekly status; midpoint meeting within a week |
| Stop condition | Midpoint held; any P0/P1 triggers incident and customer communication paths instead |
| Compliance note | No individual student data or outcomes in the email; aggregates only, below ten suppressed; no causal language `[REVIEW: privacy]` |

**Body [HOLD TEMPLATE]**

```
Hi [Sponsor First Name],

Midpoint update for [Institution]'s pilot, as of [DATE].

Measures against their agreed baselines (cohort level only): [MEASURE]: baseline [X], current [Y], target [Z], source [SOURCE]. Measures with fewer than ten participants are not shown.
Support volume and accessibility reports, and what was done: [SUMMARY].
Known limitations affecting the result: [PLAIN STATEMENT].
Decisions needed from you before the midpoint review on [DATE]: [LIST].

Best,
Harrison
```

### Email 11-DP (design-partner scoping-status update) [Gate: allowed now]

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Status of the scoping work for [Institution]`; (b) `Scoping update: open items and owners`; (c) `Where we are, and what is blocking` |
| Target persona | P3 and P2 |
| Personalization placeholder and required reason | `[OPEN ITEMS AND DATES]` from the decision log; reason = a scoping workstream in progress |
| Trigger | A scoping engagement has run for more than 30 days [ASSUMPTION] or on a milestone |
| Desired action | Resolve blockers; confirm whether to continue scoping |
| A/B variant | None |
| CRM activity to record | `email_sent`; `gtm_decision_log` updates; stage unchanged; `next_action` |
| Follow-up timing | at the next milestone |
| Stop condition | Decision to continue, pause or stop; opt-out |
| Compliance note | F2. No activation, price, or outcome language; reports only the status of paper and review items |

**Body**

```
Hi [First Name],

A status note on the scoping work.
Done: [ITEMS, e.g., "scope draft reviewed by you", "reviewer questions answered"].
Open: [ITEM, OWNER, DATE] ...
Blocked: [ITEM AND WHAT UNBLOCKS IT].
Not yet in place on our side (and required before anything could start): [GAPS STATED PLAINLY, e.g., "independent security assessment, qualified accessibility review, counsel-approved paper"].

Do you want to continue scoping, pause, or stop? Any of the three is a fine answer.

Best,
Harrison
[F2 footer]
```

## Sequence 12: Pilot results and annual conversion [HOLD] [Gate: no pilot, no outcomes]

### Email 12 (**HOLD: do not send**)

| Field | Value |
| --- | --- |
| Hold condition | A completed pilot with all five pilot-complete records (activation, workflow completion, outcome measurement, executive review, conversion decision); CLM-014 approval for any outcome wording; CLM-015 approval for price; counsel-approved paper; a signed `pilotVerdict` |
| Subject-line options | (a) `[Institution] pilot results and decision options`; (b) `Pilot outcome review: for the decision meeting on [DATE]`; (c) `Results against your baselines, and a recommendation` |
| Target persona | P3, P2, P8 |
| Personalization placeholder and required reason | `[DECISION MEETING DATE]`, `[RESULTS PACKAGE LINK]` from the closeout plan; reason = the agreed decision meeting |
| Trigger | Executive outcome review scheduled per [`PILOT-EXECUTIVE-OUTCOME-REVIEW.md`](../../institutional-readiness/PILOT-EXECUTIVE-OUTCOME-REVIEW.md) |
| Desired action | Attend the decision meeting; sign a written decision (convert, extend, pause or stop) |
| A/B variant | None |
| CRM activity to record | `email_sent`; decision record per the closeout plan; on a signed final `convert` or `expand`: opportunity `renewal` (entered by a signed final verdict with outcomes measured); `forecast_category` rules in [`CRM_PIPELINE_DEFINITION.md`](CRM_PIPELINE_DEFINITION.md) |
| Follow-up timing | decision meeting; 5 business days after |
| Stop condition | signed decision of any of the four kinds |
| Compliance note | A favorable result remains **conditional** until a new agreement and readiness gates close. No recommendation is automatic: stop is a legitimate recommendation. `[REVIEW: counsel]` |

**Body [HOLD TEMPLATE]**

```
Hi [Sponsor First Name],

For the decision meeting on [DATE], attached is the results package: each agreed measure with its baseline, target and result and source, at cohort level only; support and accessibility reports; cost to serve; known limitations; and our recommendation, which may be to stop.

The decision for you is one of: convert (on terms to be agreed in a separate proposal and review), extend, pause, or stop. A favorable result does not by itself create an annual agreement; that is a new transaction with its own review. Annual terms: [PRICE TO BE CONFIRMED].

Best,
Harrison
```

### Email 12-DP (non-activation scoping-results review) [Gate: allowed now]

| Field | Value |
| --- | --- |
| Subject-line options | (a) `What the scoping work showed, and your options`; (b) `Scoping review for [Institution]: decision on next step`; (c) `Fit, gaps and a recommendation` |
| Target persona | P3, P2 |
| Personalization placeholder and required reason | `[SCOPING FINDINGS]`, `[DECISION DATE]`; reason = a scheduled scoping review. This is a review of **scoping findings** (fit, gaps, open items), never of outcomes |
| Trigger | Scoping engagement reached its planned decision date |
| Desired action | Choose: continue scoping, pause, or stop (a non-activation analogue of the four verdicts); if "continue", wait for the gate |
| A/B variant | None |
| CRM activity to record | `email_sent`; decision logged; stage unchanged or `closed_lost` / `paused` with `loss_reason`, `future_contact_rule` |
| Follow-up timing | 5 business days |
| Stop condition | decision recorded |
| Compliance note | F2. States plainly that no pilot has run and no result exists. No outcomes, savings, retention, ROI |

**Body**

```
Hi [First Name],

For our review on [DATE]: a summary of what the scoping work established. No pilot has run and there are no results to report.

Fit: [WHAT FITS, per your own words].
Gaps and prerequisites: [LIST, mine and yours].
What would have to be true before any activation: [GATES STATED PLAINLY].

Options: continue scoping while those gaps close, pause, or stop. I will give my honest view on which makes sense.

Best,
Harrison
[F2 footer]
```

## Sequence 13: Renewal and expansion [HOLD] [Gate: no customer, contract or term]

### Email 13 (**HOLD: do not send**; no design-partner variant is sensible, use sequence 15 for a lapsed scoping conversation)

| Field | Value |
| --- | --- |
| Hold condition | An executed annual agreement exists; renewal opportunity opened 120 days before term end by the commercial trigger ([`COMMERCIAL-CORE.md`](../../COMMERCIAL-CORE.md)); a QBR record; CLM-014 and CLM-015 approvals for any outcome or price wording |
| Subject-line options | (a) `[Institution]: renewal planning for [TERM]`; (b) `Review of the past term, and options for the next`; (c) `Renewal and scope for next year` |
| Target persona | P3, P2, P8 |
| Personalization placeholder and required reason | `[TERM END DATE]`, `[QBR SUMMARY LINK]`; reason = contractual renewal calendar. Expansion requires `[NEW COHORT]` with its own readiness check and its own launch-council go |
| Trigger | 120 days before term end; or an expansion request from the sponsor |
| Desired action | Schedule renewal review |
| A/B variant | None |
| CRM activity to record | `renewal` (renewal motion reported separately) or `expansion` (separately authorized scope); never counted as new business, and a pilot is never double-counted with its hypothetical annual conversion |
| Follow-up timing | by contract calendar |
| Stop condition | signed renewal, non-renewal |
| Compliance note | `[REVIEW: counsel]`, `[REVIEW: tax]`. No automatic renewal language without counsel-approved terms |

**Body [HOLD TEMPLATE]**

```
Hi [Sponsor First Name],

Your agreement runs to [TERM END DATE]. For the review, I have prepared: adoption and support information for the term by cohort, accessibility and incident records, and the options for next term. Any expansion to another cohort would need its own readiness check and written approvals. Terms: [PRICE TO BE CONFIRMED]. Could we set a review for [DATE RANGE]?

Best,
Harrison
```

## Sequence 14: Case-study and reference request [HOLD] [Gate: CLM-013 PROHIBITED TODAY]

### Email 14 (**HOLD: do not send**)

| Field | Value |
| --- | --- |
| Hold condition | A completed, substantiated pilot or deployment; a signed final verdict; claim-specific written permission from the rights-holder for the exact wording, channel and term (CLM-013); Legal, Privacy and Communications approval; withdrawal path per [`CLAIM-WITHDRAWAL-RUNBOOK.md`](../../CLAIM-WITHDRAWAL-RUNBOOK.md) |
| Subject-line options | (a) `May we describe [Institution]'s experience? Your approval needed for every word`; (b) `Reference and case-study request: no obligation`; (c) `Would you be willing to share your experience, in your own words?` |
| Target persona | P3 and P2 (permission holders); communications office copied |
| Personalization placeholder and required reason | `[SPECIFIC RESULT THE PILOT ESTABLISHED]` from the signed outcome review; reason = a substantiated result |
| Trigger | Signed decision and outcome review; customer relationship health confirmed |
| Desired action | Consider a specific, revocable, reviewable permission |
| A/B variant | None |
| CRM activity to record | `email_sent`; reference status field per [`CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md); no use before signed permission |
| Follow-up timing | one reminder after 10 business days |
| Stop condition | decline (record and never ask again without a new reason), signature |
| Compliance note | Reference, logo, quote and case-study permissions are separate, specific, revocable approvals. No student outcomes below the reporting threshold. `[REVIEW: counsel]` `[REVIEW: privacy]` |

**Body [HOLD TEMPLATE]**

```
Hi [First Name],

Thank you for the decision meeting. If, and only if, you are comfortable, we would value a conversation about whether [Institution] would consider a reference or case study. Nothing is assumed. Every word, name, logo and quote would be yours to approve for a specific use and period, and you could withdraw it. You can decline without explanation and it will not affect the work.

Best,
Harrison
```

### Email 14-DP (feedback and corrections; NOT a reference request) [Gate: allowed now]

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Could you correct our notes on [Institution]'s scoping?`; (b) `Feedback on the draft materials, for our eyes only`; (c) `What would you change in our draft scope?` |
| Target persona | P2 (champion) |
| Personalization placeholder and required reason | `[DRAFT MATERIAL YOU REVIEWED]`; reason = they received the material. None, do not send |
| Trigger | Scoping ended or paused; the material was shared |
| Desired action | Private feedback on materials; explicit non-use |
| A/B variant | None |
| CRM activity to record | `email_sent`; `evidence link` to the feedback received; no reference flag set |
| Follow-up timing | none |
| Stop condition | reply, opt-out |
| Compliance note | F2. Say explicitly that this is not a reference, quote, logo or endorsement request and that nothing will be published or attributed. A reference request is not made until CLM-013 conditions are met |

**Body**

```
Hi [First Name],

Thank you for your time on the scoping work. This is not a reference or testimonial request, and I will not use your name, institution or words anywhere. I would simply value your private view on the draft materials you saw: what was unclear, what was missing, and what you would change. Two or three lines are plenty.

Best,
Harrison
[F2 footer]
```

## Sequence 15: Re-engagement of dormant opportunities [DRAFT] [Gate: allowed now]

A dormant opportunity is an account with account status `paused` (no stage of its own in `stages.ts`; the opportunity keeps the stage it paused in) with no activity for 90 days [ASSUMPTION: the scoring document treats a score as stale after 90 days]. Re-engagement requires: the `future_contact_rule` has expired; no opt-out; and a **new** reason that passes the RFO test (a leadership change, a new initiative, a new published process page, a term-start change, or a referral). The old reason does not count.

### Email 15.1 (day 0)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Revisiting registration readiness at [Institution]: [NEW REASON SHORT]`; (b) `A change at [Institution] made me think of our earlier conversation`; (c) `Is the timing different now?` |
| Target persona | The previous contact, or the new role-holder when the role changed (new person needs a fresh RFO) |
| Personalization placeholder and required reason | `[NEW REASON]` (new, verifiable, recent), `[WHAT WE DISCUSSED BEFORE, ONE LINE]`. No new reason, do not send |
| Trigger | Dormant per above; new reason recorded |
| Desired action | Reply, or a 20-minute catch-up |
| A/B variant | Variable: **reason-first vs history-first opening**. Metric: positive reply rate |
| CRM activity to record | `email_sent` sequence 15, touch 15.1; account status stays `paused` until a reply; on a positive reply account returns to the stage it left (`paused` is left back to the previous stage); `next_action`, `next_action_due` |
| Follow-up timing | 15.2 after 7 business days |
| Stop condition | reply, opt-out, `future_contact_rule` conflict, third touch sent |
| Compliance note | F1 (new run). Honor earlier opt-outs; check suppression; no reference to anything unsaid before; no price, no activation, no outcome |

**Body**

```
Hi [First Name],

It has been a while since we spoke about [WHAT WE DISCUSSED, ONE LINE]. I noticed [NEW REASON, WITH SOURCE], which made me wonder whether the timing looks different now.

Still scoping only: nothing involves student data, access to your systems or a commitment. Would a 20-minute catch-up be useful, or is it better left alone for now?

Best,
Harrison
[F1 footer]
```

### Email 15.2 (+7 business days)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Re: Revisiting registration readiness`; (b) `One thing that may have changed on our side`; (c) `A short, useful update, no ask` |
| Target persona | Same as 15.1 |
| Personalization placeholder and required reason | `[GENUINELY NEW FACT, e.g., a draft evidence item that now exists]`; reason = a real update. None, skip to 15.3 |
| Trigger | No reply to 15.1 |
| Desired action | Reply or acknowledge |
| A/B variant | None |
| CRM activity to record | `email_sent`; `next_action_due` |
| Follow-up timing | 15.3 after 7 business days |
| Stop condition | reply, opt-out |
| Compliance note | F2; any update statement is [VERIFIED] with a repo path or "not yet" |

**Body**

```
Hi [First Name],

A short update with no ask: [ONE FACT, e.g., "the accessibility overview and the HECVAT readiness register have been updated; both are still drafts, and there is still no independent assessment or conformance report"].

If it would be useful to see them, tell me; otherwise I will leave it there.

Best,
Harrison
[F2 footer]
```

### Email 15.3 (+7 business days, final)

| Field | Value |
| --- | --- |
| Subject-line options | (a) `Closing this out for now`; (b) `Should I check back later, or not at all?`; (c) `Last note on registration readiness` |
| Target persona | Same |
| Personalization placeholder and required reason | None new; this is the closing note of a run that already passed the RFO test. Do not send if 15.1 was not sent |
| Trigger | No reply to 15.1 or 15.2 |
| Desired action | "Later" or "not at all" |
| A/B variant | None |
| CRM activity to record | `email_sent`; account `paused`; `future_contact_rule` = no contact for 180 days [ASSUMPTION], or `closed_lost` with `loss_reason` if "not at all" was received |
| Follow-up timing | none |
| Stop condition | sent once; reply; opt-out |
| Compliance note | F2; honor "not at all" as an opt-out |

**Body**

```
Hi [First Name],

I will close this out so I do not keep writing. If it would help to hear from me again later, say "later" and I will check in after [TERM]. If not, say "not at all" and I will not write again.

Best,
Harrison
[F2 footer]
```

## A. Send-approval checklist (applies to every email before it is sent) [DRAFT]

A person ticks every item; any blank item means do not send. Record the tick in the personalization record.

1. Reason-for-outreach test R1-R7 passed and the source URL or referrer is recorded.
2. Recipient is a named person with a business role at an account on the target list; the work address came from a public staff page, the institution's own directory, or a referral; no purchased, rented, scraped or guessed address (guessing a pattern is not allowed).
3. Suppression check done today against the master suppression list and the domain-level do-not-contact list (section C.1). Hit means do not send.
4. Account is not already in another active sequence; no other contact at the account replied in the last 5 business days [ASSUMPTION].
5. Gate check: this sequence's row in the gate table is YES for this variant. Any HOLD template content (price, payment, invoice, order form, live data, activation, annual conversion, renewal, case study, reference, logo, outcomes) is absent.
6. Claims check: every sentence conforms to the lexicon in 1.3 and each factual statement maps to a claim id, RFP library row or repository path.
7. Footer F1 (or F2 inside a thread) present with the real legal sender name and a real postal address (open decision D4). **Blocked until entity facts are resolved.** `[REVIEW: counsel]`
8. Truthfulness: "we are speaking with" and similar statements are true today; no fabricated familiarity, no implied relationship, no urgency or scarcity language.
9. Subject line has no sensitive data, no deceptive "Re:" or "Fwd:" on a first touch, and matches the content.
10. Links work; calendar link shows the sender's real availability; no tracking pixel or open tracking.
11. Volume cap (section B.2) respected.
12. Approver recorded: the founder is the only approver today (backup unassigned). Counsel has not approved any body text; the status of every body remains `[DRAFT]`.

## B. Personalization record, deliverability hygiene and volume cap [DRAFT]

### B.1 Per-account personalization record (one per account; store in the CRM account record, minimum data)

| Field | Content |
| --- | --- |
| `account_id` / institution / segment | stable ID, display name, segment from the CRM |
| `tier`, `target_score` and the dated observations behind it | from [`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md) |
| Contact | name, role, persona code, `committee_role`, work address, address source URL, date found |
| `rfo_type` | one of the accepted types in 1.1 |
| RFO statement | one sentence, as it would appear in the email |
| RFO source | URL or named referrer and permission to name them; date observed; date retrieved |
| R1-R7 result | pass/fail per check and the sentence linking the reason to registration readiness |
| Sequence and run | sequence id, run id, touch number, subject variant, A/B arm and variable |
| Claims check | claim ids and RFP library rows relied upon |
| Suppression check | date and result |
| Approver and date | founder (interim) |
| Outcome | reply class (section C.2), meeting, referral, opt-out, bounce |
| Retention note | delete the record when the account is closed or the contact asks; keep only what the contact-data minimization rule allows |

### B.2 Deliverability and sender hygiene

- No purchased, rented, scraped or appended lists. Contacts are individually researched; the list is the 100-account list in [`CRM_PIPELINE_DEFINITION.md`](CRM_PIPELINE_DEFINITION.md).
- One account per sequence run; one active sequence per account; at most two contacts per account in any 30 days, in different roles, never with identical text and never on the same day [ASSUMPTION].
- Send one-to-one from the founder's own business mailbox on a domain the company controls; **no bulk-send or campaign tool is approved** (the consent draft prohibits a campaign sender until vendor, consent and suppression operate). Sequences are operated manually.
- Authenticate the sending domain (SPF, DKIM, DMARC) before the first send and keep it separate from product transactional mail so that outreach complaints cannot affect student-facing email `[REVIEW: security]`.
- Plain text or minimal formatting, no attachments on first touch, no tracking pixels, no URL shorteners, one link at most plus the calendar link.
- **Volume cap [ASSUMPTION]:** at most 10 new accounts begin Sequence 1 per week and at most 25 outbound business emails per day in total. The pursuit cap in the scoring document (the top three target scores at a time until delivery capacity is measured) governs how many accounts proceed past discovery.
- Pause rule [ASSUMPTION]: stop all cold sending for a week if any spam complaint arrives, or if the hard-bounce rate exceeds 2% of the last 50 sends, then review the list source.
- Remove a hard-bounced address at once; never retry a different guessed pattern.

## C. Reply handling, suppression and opt-out [DRAFT]

### C.1 Suppression and opt-out list

- The master suppression list lives on the stakeholder record (`preference/suppression`) and a separate domain-level `do_not_contact` flag on the account for "stop contacting my institution".
- Any signal counts as an opt-out: "no thanks", "unsubscribe", "remove me", "stop", a complaint, or a request to stop in any words. Record `type=opt_out` the same business day [ASSUMPTION: internal target; the statutory period, if any, is a matter for counsel `[REVIEW: counsel]`]. The next scheduled touch is cancelled before anything else.
- Confirm once, briefly, without a pitch (template R-O in C.3). Never ask them to justify it. Never re-add the address through a later import, referral or enrichment.
- Retain only what is needed to honor the opt-out: the address (or a hash) and the date. Do not keep the full profile. `[REVIEW: privacy]`
- An opt-out from one person stops that person only, unless the person asks to stop the institution; ask nothing, apply the broader flag when stated.
- Suppression is checked at touch approval (section A, item 3) and before every send, not once per run.

### C.2 Reply classes

| Class | Examples | Action within 1 business day [ASSUMPTION] | CRM |
| --- | --- | --- | --- |
| Positive | wants a call, asks for details, forwards internally | Reply with two time options and the F2 footer; send nothing beyond what was asked; do not send HOLD material | `email_reply`; stage per evidence (`discovery` after the meeting is held); cancel remaining touches |
| Neutral | "send information", "not my area", "maybe later" | Offer a short written outline built only from approved or draft-labeled material; ask for the right person; set a 30-day check | `email_reply`; `next_action` and `next_action_due`; account stays `target_account` |
| Negative | "not interested", "we have a solution" | Thank them once. See objection library for one factual, non-pushy line only when they ask a question | `loss_reason` and `future_contact_rule` recorded; `closed_lost` only on explicit institutional rejection or disqualifier; else `paused` |
| Unsubscribe / complaint | any stop signal | Template R-O; escalate any complaint, legal or regulatory language to the founder and counsel at once | `opt_out`; suppress; no further sequence |
| Referral | gives a name, role or office | Thank them; ask permission to name them; new contact needs its own RFO (type `referral`) and its own personalization record; the referrer is not sequenced further | new stakeholder with `consent/contact basis` = referral and the referral source |
| Out of office / left institution | automatic reply | Pause that contact; for a departure, find the successor through a public page; do not guess | `last/next interaction` |
| Asks for price, contract, live pilot, reference, customers | any HOLD topic | Say plainly that it is not available yet and why (template R-H); never improvise | `email_reply`; log the request as a `gtm_decision_log` entry (category `budget` or `procurement`) so demand is visible |

### C.3 Reply templates

- **R-P (what "pilot" means):** "Fair question. At this stage I mean a scoping conversation: we would talk through your process and decide together whether a narrow, non-binding scope is worth writing down. No student data and no access to your systems is involved, and nothing is activated. Whether and when an actual pilot could run is a separate decision that depends on written approvals on both sides."
- **R-O (opt-out confirmation):** "Understood, I have removed you and will not write again. Apologies for the interruption."
- **R-H (a held topic):** "I do not have that available yet, and I would rather say so than guess. [One factual sentence, e.g., 'There is no approved price, order form or live deployment at this stage.'] What I can do now is [scoping conversation / evidence exchange / a written outline of scope]."

## D. Metrics [DRAFT] [ASSUMPTION: no benchmark is asserted]

Opens, clicks and impressions are **not** success metrics and are not tracked. No target values are set until the first 30 sends exist; the weekly review in [`CRM_PIPELINE_DEFINITION.md`](CRM_PIPELINE_DEFINITION.md) sets them. External benchmarks are not used (the directional figures in `kpi.ts` are not sales benchmarks, as the scoring document records).

| Metric | Definition | Denominator | Why it matters | Guardrail |
| --- | --- | --- | --- | --- |
| Positive reply rate | replies expressing interest, asking a question, or naming a referral or prerequisite | emails delivered in the sequence | primary quality signal | do not count auto-replies or opt-outs |
| Meeting-booked rate | discovery meetings held (not just booked) | accounts that received touch 1 | funnel conversion to `discovery` | count held meetings |
| Referral rate | referral replies | accounts that received touch 1 | measures breakup email quality | referrals still need their own RFO |
| Opt-out rate | opt-out signals | emails delivered | list and message quality | any rise triggers a review of the RFO standard |
| Bounce rate | hard bounces | emails sent | list hygiene | pause rule in B.2 |
| Complaint count | spam or legal complaints | all sends | trust | any complaint is escalated |
| RFO pass rate | accounts approved with a recorded reason / accounts considered | accounts considered | shows discipline: a low pass rate is correct behaviour, not a problem | never raised by loosening the test |
| Time to reply handling | hours from reply to answer | replies | responsiveness | target 1 business day |

A/B results are reported as counts with the number of sends per arm, never as a percentage alone.

## Evidence state

- [VERIFIED] The gate, stage vocabulary, pilot rules, claim classifications and RFP answers cited above exist in `GO-NO-GO-DECISION.md`, `app/src/lib/gtm/stages.ts`, `app/src/lib/gtm/pilot.ts`, `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` and `docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md` at revision `5eba494`.
- [DRAFT] No email in this document has been sent, reviewed by counsel, or approved by a named approver. No sender entity, postal address, sending domain authentication, suppression list implementation or consent record is evidenced. The marketing communications consent draft lists the campaign sender as prohibited until vendor, consent and suppression operate.
- [ASSUMPTION] Every interval, cap, threshold and reply-time target.
- No reply rate, meeting rate, referral rate or sequence performance exists.

## Claim ceiling

Semester may use these sequences to run non-activation, account-based discovery, demonstration, evidence-exchange and conditional-scoping correspondence with a named reason for every send, using the bodies as drafts after the send-approval checklist is complete. HOLD templates may be reviewed but not sent.

## Prohibited claims

Do not state or imply in any email: that customers, pilots, references or case studies exist; any outcome, savings or ROI; any certification, compliance or assurance report (SOC 2, ISO, FERPA, COPPA, GDPR, HECVAT, penetration test, WCAG/VPAT); that any integration, SSO, SCIM or LTI is available; any uptime, recovery or support-hour commitment; any price other than the token `[PRICE TO BE CONFIRMED]` in a HOLD template; any launch date; that AI is accurate, private, non-training or institution-approved. Never send to a suppressed address, to an unreasoned recipient, or from a list that was bought or scraped.

## Professional review required

| Area | Reviewer | Why |
| --- | --- | --- |
| Footer, sender identification, postal address, opt-out mechanics, email and marketing-communications rules in each recipient's jurisdiction | counsel (unassigned) `[REVIEW: counsel]` | Not decided here; the consent draft requires qualified privacy/marketing counsel |
| Contact-data handling, suppression retention, referral data | privacy owner (unassigned) `[REVIEW: privacy]` | Minimization and retention |
| Sending domain authentication and mailbox security | security owner (unassigned) `[REVIEW: security]` | Sender reputation and mailbox compromise risk |
| Evidence statements in 3.1, 9A, 15.2 | security, privacy, accessibility reviewers (unassigned) | Statements must track the evidence register |
| Any price, order form, DPA or proposal wording | counsel, tax advisor, procurement `[REVIEW: counsel]` `[REVIEW: tax]` `[REVIEW: procurement]` | HOLD templates only |
