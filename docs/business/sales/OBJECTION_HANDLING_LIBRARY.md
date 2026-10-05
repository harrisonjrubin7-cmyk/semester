# Objection Handling Library (institutional sales)

| Control | Value |
| --- | --- |
| Status | **[DRAFT] - NOT APPROVED. Thirty-six objections with scripts that stay inside the claim ceiling. Count of `[APPROVED]` customer-facing scripts: 0** |
| Owner | Harrison Rubin (interim, single point of failure; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: counsel] [REVIEW: security] [REVIEW: privacy] [REVIEW: accessibility] [REVIEW: procurement] |
| Audience | Internal. The `Say` lines are drafts for the seller to use on a call or in a reply after the reply is checked against section "How to use" |

> Operating document, not legal, tax, accounting, insurance, privacy, security or accessibility advice. Where an objection turns on a legal or assurance question, the answer is a factual status plus a referral to the professional, never a conclusion.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [`OBJECTION-HANDLING.md`](../../market-readiness/OBJECTION-HANDLING.md) | Five rules of thumb (SOC 2/ISO/VPAT; SIS write; individual risk alerts; free pilot; faster launch) and the rule "acknowledge the actual limitation, provide evidence, offer the lowest-risk path, never convert an objection into an unsupported claim" | Thirty-six objections each with persona, real meaning, script, proof, evidence gap, owner, CRM tag; five places where the old text says more than the register allows (section "Where existing sources say more") | The old file is nine lines; the structure needed (per-objection evidence gap, owner and CRM tag) does not fit it, and it must stay the short version |
| [`MESSAGING-HOUSE.md`](../../market-readiness/MESSAGING-HOUSE.md) | Six one-line objection responses and the safe/prohibited claim lists | Longer scripts that cite claim ids | The messaging house is the positioning source; this is the call-time script |
| [`HIGHER-ED-RFP-RESPONSE-LIBRARY.md`](../../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) (data: `app/src/lib/gtm/rfp.ts`) | Standard answers with status and evidence for ~40 procurement questions | Not rewritten. Scripts cite row ids (SEC-5, AX-2, ...) and copy their status; where a row is stronger than the claims register allows, section "Where existing sources say more" flags it | The RFP library is test-enforced data; edit it only through its own test |
| [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) | Claim ids CLM-001 to CLM-018 with classification and approval state | Used as the ceiling for every script | -- |
| [`DISCOVERY-CALL-SCRIPT.md`](../../commercial/DISCOVERY-CALL-SCRIPT.md), [`SALES-PLAYBOOK.md`](../../commercial/SALES-PLAYBOOK.md), [`BUYER-PERSONAS.md`](../../commercial/BUYER-PERSONAS.md) | The call, the process, the personas | Objection scripts that plug into them | -- |
| [`PILOT_SALES_EMAIL_SEQUENCES.md`](PILOT_SALES_EMAIL_SEQUENCES.md), [`CRM_PIPELINE_DEFINITION.md`](CRM_PIPELINE_DEFINITION.md) | (siblings) Emails and CRM | Reply handling in the emails links here; the CRM tag column feeds the decision log | -- |

## Gate (what may be said now) [VERIFIED]

Per [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md): design-partner work is GO for non-activation discovery, synthetic demonstration, evidence exchange and conditional scoping; paid pilot and enterprise sale are NO-GO. Therefore every script below (a) answers from current evidence, (b) states a gap as a gap, (c) offers only a non-binding scoping step, and (d) never offers a price, a launch date, live data, a reference or an outcome.

## How to use this library [DRAFT]

1. Listen for what the objection really means (column "What it really means") before answering. Most are a request for evidence, a request for safety, or a polite no.
2. Answer in this order: acknowledge the real limitation; give the status in plain words; name the evidence path or claim id; offer the lowest-risk next step (a scoping conversation, a draft document, or "we may not fit").
3. If the honest answer is "not yet evidenced", say exactly that. A buyer who hears "we cannot show that yet" and stays is a better lead than one who was reassured and later finds out.
4. Never say a prohibited claim even to be agreeable: customers, outcomes, savings, SOC 2, FERPA/COPPA/GDPR compliance, HECVAT completion, penetration test, WCAG or VPAT conformance, SSO/SCIM/LTI availability, uptime or recovery objectives, price, or roadmap dates (CLM-005, 006, 008, 010, 012, 013, 014, 015, 016, 017).
5. Do not answer from memory when a registered answer exists: use the RFP library text and attach the HECVAT readiness row ([`HECVAT-READINESS-MATRIX.md`](../../trust/HECVAT-READINESS-MATRIX.md)) rather than paraphrasing.
6. Record the objection on the account the same day: a `gtm_decision_log` entry (category per the table; `status`, `owner`, `requested_date`, `target_date`, `evidence_links`, `risk_level`) and the **CRM tag** below on the activity. An objection that is a disqualifier is recorded as such ([`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)); do not argue with a disqualifier.
7. Escalation owner: Harrison Rubin is the only named owner today. Where the owner column says "professional (unassigned)", the seller states that the question needs that professional and does not answer past the evidence. No security owner, privacy owner, counsel, accessibility reviewer, CPA or broker is assigned.

Persona codes (aligned to `COMMITTEE_ROLES` in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts)): **P1** registrar or enrollment services; **P2** student success or advising leader; **P3** academic executive sponsor; **P4** CIO or IT; **P5** security and privacy; **P6** accessibility; **P7** procurement and legal; **P8** finance; **P9** faculty or faculty-senate representative (not a committee role in code; recorded as a stakeholder note).

CRM tags are proposed activity labels of the form `obj:<slug>`; they are not stage identifiers. `decision_log` categories are the code's: `security`, `privacy`, `accessibility`, `legal`, `integration`, `budget`, `procurement`, `implementation`.

## Index

| ID | Objection | Persona | Decision-log category | CRM tag |
| --- | --- | --- | --- | --- |
| O-01 | We already have an LMS and SIS | P2, P4, P1 | integration | `obj:existing_lms_sis` |
| O-02 | We already have an advising or early-alert platform | P2 | implementation | `obj:existing_advising` |
| O-03 | We have no budget | P3, P8 | budget | `obj:no_budget` |
| O-04 | Can we have a free pilot? | P3, P2 | budget | `obj:free_pilot` |
| O-05 | How is student data protected? | P5, P4 | security | `obj:data_protection` |
| O-06 | Are you FERPA compliant? | P5, P1, P7 | privacy | `obj:ferpa` |
| O-07 | Where does student data go; who are the subprocessors? | P5, P7 | privacy | `obj:subprocessors` |
| O-08 | Do you have a HECVAT? | P5, P4 | security | `obj:hecvat` |
| O-09 | Do you have SOC 2? | P5, P7 | security | `obj:soc2` |
| O-10 | Has it been penetration tested? | P5, P4 | security | `obj:pentest` |
| O-11 | Do you have a VPAT or accessibility conformance report? | P6 | accessibility | `obj:vpat` |
| O-12 | Has it been tested with screen readers and assistive technology? | P6 | accessibility | `obj:screen_reader` |
| O-13 | AI concerns and academic integrity | P3, P9, P2 | privacy | `obj:ai_integrity` |
| O-14 | Is our data used to train AI models? | P5, P7 | privacy | `obj:ai_training` |
| O-15 | Do you support SSO, SCIM or LTI? | P4 | integration | `obj:sso_lti` |
| O-16 | Can it write back to our SIS or read from it? | P4, P1 | integration | `obj:sis_write` |
| O-17 | The pilot is too long | P3, P2 | implementation | `obj:pilot_too_long` |
| O-18 | The pilot is too short | P2, P3 | implementation | `obj:pilot_too_short` |
| O-19 | Who else uses it? Can we speak to references? | P3, P7 | procurement | `obj:references` |
| O-20 | What does it cost? | P8, P7, P3 | budget | `obj:pricing` |
| O-21 | Our procurement takes a long time | P7, P3 | procurement | `obj:procurement_timeline` |
| O-22 | You are a startup: what if you disappear? | P7, P4, P3 | legal | `obj:startup_continuity` |
| O-23 | Will students actually use it? | P2, P3 | implementation | `obj:student_adoption` |
| O-24 | We do not have staff time | P1, P2 | implementation | `obj:staff_workload` |
| O-25 | Prove the ROI | P3, P8 | budget | `obj:roi_proof` |
| O-26 | Why not build this ourselves? | P4, P3 | implementation | `obj:build_vs_buy` |
| O-27 | Who owns the data; how do we exit and delete? | P5, P7 | privacy | `obj:data_exit` |
| O-28 | Faculty will resist | P9, P3, P2 | implementation | `obj:faculty_resistance` |
| O-29 | What if pilot results are ambiguous? | P3, P8 | implementation | `obj:ambiguous_results` |
| O-30 | We want individual at-risk alerts | P2, P3 | privacy | `obj:risk_alerts` |
| O-31 | We need to launch faster | P3, P2 | implementation | `obj:faster_launch` |
| O-32 | What is the uptime, support and response time? | P4, P7 | procurement | `obj:sla` |
| O-33 | Where is the data hosted; can you guarantee residency? | P5, P4 | privacy | `obj:residency` |
| O-34 | Do you have cyber and liability insurance? | P7 | legal | `obj:insurance` |
| O-35 | Will you sign our DPA and our terms? | P7 | legal | `obj:contract_paper` |
| O-36 | Is this endorsed by, or partnered with, another institution? | P3, P7 | procurement | `obj:endorsement` |

## Objections A: existing systems, budget and fit

### O-01 We already have an LMS and SIS [DRAFT]
- **Persona:** P2, P4, P1.
- **What it really means:** "Do not add another system, and do not touch our system of record." Sometimes it is a polite no.
- **Say:** "That is right, and the scope I would suggest does not replace either. Semester would sit beside them as a student planning and readiness layer for one cohort and one workflow, using manual or approved data first. The official systems stay authoritative. A short scoping conversation is only to see whether one specific gap between those systems is real at [Institution]."
- **Proof to offer:** RFP library ES-1 and FR-1 (not a system of record; no registration adapter installed); CLM-004 (CONDITIONAL: permitted in non-activation scoping with prominent conditions); CLM-006 (replacement is PROHIBITED; do not use the word "replace" except to say it does not).
- **Evidence gap:** no institution has run it beside its systems; no integration is installed (`app/server/institution/adapters.ts` is empty per the RFP library).
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:existing_lms_sis`; log the named systems in the account's stack field.

### O-02 We already have an advising or early-alert platform [DRAFT]
- **Persona:** P2.
- **What it really means:** "We have invested in one; will this compete or duplicate?" Also a test for whether Semester will profile students.
- **Say:** "I would not suggest replacing it. Semester is student-facing: it helps a cohort see next steps and finish them, and gives staff an aggregate view of where the group is stuck. It does not score individual students for risk. If your platform already covers the part you care about, we should say so and stop."
- **Proof to offer:** RFP PF-5 (no student risk scoring: considered and refused in writing); [`PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) exclusions (system-of-record replacement; high-impact individual scoring).
- **Evidence gap:** no comparison with any named platform; no evidence the aggregate view adds value; avoid competitor claims ([`COMPETITIVE-POSITIONING.md`](../../commercial/COMPETITIVE-POSITIONING.md) states the rules).
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:existing_advising`; record the named platform, and a disqualifier if the requirement is individual early alerts (see O-30).

### O-03 We have no budget [DRAFT]
- **Persona:** P3, P8.
- **What it really means:** Either this is not a priority this cycle, or there is no discretionary line, or the budget cycle has simply not been discussed.
- **Say:** "Understood. The scoping step I suggest costs nothing and needs no student data or access, so it does not need budget. What I would like to learn is when your budget cycle opens and who decides, so that if the problem is real it is not blocked by timing. There is also no approved price from us at this stage, so I cannot say what any later step would cost."
- **Proof to offer:** [`BUDGET-AND-PURCHASING-PATH.md`](../../commercial/BUDGET-AND-PURCHASING-PATH.md) (questions to ask; thresholds are discovered per account, never assumed); [`PRICING-AND-PACKAGING.md`](../../commercial/PRICING-AND-PACKAGING.md) (no approved price book).
- **Evidence gap:** no approved price or packaging; CLM-015 PROHIBITED (price, discount, savings, scarcity).
- **Escalation owner:** Harrison Rubin; Founder and Finance for pricing questions (Finance unassigned).
- **CRM tag:** `obj:no_budget`; record the budget cycle date in the opportunity (needed to enter `qualified`) or a `paused` status with a `future_contact_rule`.

### O-04 Can we have a free pilot? [DRAFT]
- **Persona:** P3, P2.
- **What it really means:** "We want to try with no risk" or "we cannot pay."
- **Say:** "At this stage I cannot start any pilot with live data, free or paid: some company and review conditions are still being completed. What I can do now is scoping and evidence exchange at no charge. Whether a later design-partnership is no-fee or paid is not decided, and any engagement would still need written scope, safety gates and a decision date."
- **Proof to offer:** `GO-NO-GO-DECISION.md` (design-partner non-activation GREEN; paid pilot NO-GO); [`PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) price line (`[APPROVED PRICE OR "NO-FEE DESIGN PARTNER" - REQUIRED BEFORE PROPOSAL]`).
- **Evidence gap:** no approved price or fee decision; no activation record.
- **Escalation owner:** Harrison Rubin (price and fee decision: Founder and Finance, unassigned).
- **CRM tag:** `obj:free_pilot`.
- **Source note:** the old file says "tie price to implementation/evidence cost". That implies a price rationale that CLM-015 does not allow us to give yet; use the script above instead.

## Objections B: security, privacy and assurance

### O-05 How is student data protected? [DRAFT]
- **Persona:** P5, P4.
- **What it really means:** "Show me controls, not adjectives."
- **Say:** "I can tell you what exists and what does not. In the repository there are tested controls for access by capability, row-level security on database tables with policy checks in CI, audit trails, export and deletion paths, and a data classification gate for AI requests. What is not in place yet: an independent security assessment, a penetration test, a SOC 2 report, and operated evidence from a named customer's environment. For a scoping stage we would use no student data, so none of that is exposed yet. I would rather you see the evidence and the gaps than a summary."
- **Proof to offer:** CLM-009 (VERIFIED - REPOSITORY, for defined paths); [`CONTROL-FACTS.md`](../../trust/CONTROL-FACTS.md) (generated counts, not proof of production operation); RFP SEC-2, SEC-3, TA-1, TA-2; [`SECURITY-WHITEPAPER.md`](../../trust/SECURITY-WHITEPAPER.md) (v0.1 draft); [`EVIDENCE-REGISTER.md`](../../trust/EVIDENCE-REGISTER.md).
- **Evidence gap:** independent assessment (go/no-go priority 2); target-environment validation; TA-2 isolation not yet claimed for every older table. Do not say "secure" (CLM-010 PROHIBITED as a conclusion).
- **Escalation owner:** security owner (unassigned): Harrison answers only from the register.
- **CRM tag:** `obj:data_protection`; `decision_log` category `security`.

### O-06 Are you FERPA compliant? [DRAFT]
- **Persona:** P5, P1, P7.
- **What it really means:** "Will our counsel be able to approve this as a school-official arrangement?"
- **Say:** "FERPA does not certify products, and we do not claim compliance on our own authority. What I can give is a description of the controls and a draft data processing addendum for your counsel to review. That addendum is a draft that our counsel has not approved, and nothing is signed. At the scoping stage there is no student record involved at all."
- **Proof to offer:** RFP PF-1 (planned; DPA draft and checklist exist, none approved or signed); CLM-010 (FERPA/COPPA/GDPR "compliance" PROHIBITED); [`DPA-CHECKLIST.md`](../../trust/DPA-CHECKLIST.md); [`DATA-PROCESSING-ADDENDUM-DRAFT.md`](../../legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md).
- **Evidence gap:** no counsel-approved DPA; no FERPA consent workflow operating with an institution ([`FERPA-CONSENT-WORKFLOW.md`](../../trust/FERPA-CONSENT-WORKFLOW.md) is a draft).
- **Escalation owner:** counsel (unassigned) `[REVIEW: counsel]`; privacy owner (unassigned) `[REVIEW: privacy]`.
- **CRM tag:** `obj:ferpa`; `decision_log` category `privacy` or `legal`.
- **Source note:** MESSAGING-HOUSE says "contract language for your counsel" - the language exists only as a draft; say "draft".

### O-07 Where does student data go, and who are the subprocessors? [DRAFT]
- **Persona:** P5, P7.
- **What it really means:** "Give me the data flow and the list of third parties."
- **Say:** "There is a draft register of every destination student data can reach, labelled as subprocessor, institution-directed or student-directed, and a test holds it to the app's content-security policy. It is a draft: counsel has not reviewed it, each provider's terms and hosting regions are not all on file, and it has not been published. At scoping, no student data is sent anywhere."
- **Proof to offer:** RFP PF-4 (planned) and TA-1; [`SUBPROCESSORS.md`](../../SUBPROCESSORS.md); [`SUBPROCESSOR-GOVERNANCE-PROGRAM.md`](../../trust/SUBPROCESSOR-GOVERNANCE-PROGRAM.md); [`PROVIDER-TERMS.md`](../../trust/PROVIDER-TERMS.md) (AI provider terms recorded; "not in force").
- **Evidence gap:** no published subprocessor list; provider terms not signed; no data-flow validation on a customer target.
- **Escalation owner:** privacy owner and counsel (unassigned).
- **CRM tag:** `obj:subprocessors`; `decision_log` category `privacy`.

### O-08 Do you have a HECVAT? [DRAFT]
- **Persona:** P5, P4.
- **What it really means:** "Our process requires one before we talk to anyone."
- **Say:** "Not a completed one. There is a written HECVAT readiness register and a draft response that mark each item as supported by evidence or not. HECVAT is an assessment questionnaire rather than a certification, and I would not call ours complete or approved. If your process needs a completed vendor-signed workbook before a scoping conversation, I would rather know now."
- **Proof to offer:** [`HECVAT-READINESS-MATRIX.md`](../../trust/HECVAT-READINESS-MATRIX.md) (status `PARTIAL / NOT A COMPLETED HECVAT`); [`HECVAT_DRAFT_RESPONSE.md`](../../market-readiness/HECVAT_DRAFT_RESPONSE.md); [`HECVAT-EVIDENCE-MATRIX.md`](../../market-readiness/HECVAT-EVIDENCE-MATRIX.md); `docs/commercial/STAGE-COLLATERAL-AND-HANDOFF.md` ("the HECVAT is written and not sent").
- **Evidence gap:** no completed or approved HECVAT; no operated evidence (CLM-010 prohibits "HECVAT approved/completed").
- **Escalation owner:** security owner (unassigned).
- **CRM tag:** `obj:hecvat`; record as accepted prerequisite or disqualifier.

### O-09 Do you have SOC 2? [DRAFT]
- **Persona:** P5, P7.
- **What it really means:** "Assurance by a third party before we can proceed" - often a hard prerequisite.
- **Say:** "No. There is no SOC 2 report and no auditor has been engaged. I do not want to talk around that. If a SOC 2 report is a firm prerequisite, Semester may not be a fit today, and I will record that honestly."
- **Proof to offer:** RFP SEC-5 (Not supported: no SOC 2 report; none planned before a first pilot); [`SOC2-READINESS.md`](../../trust/SOC2-READINESS.md) (status `IN_PROGRESS`: a gap assessment, not an audit); `HECVAT-READINESS-MATRIX.md` as the alternative.
- **Evidence gap:** no report and no timeline. The old objection file says "offer ... remediation plan", but the RFP library says SOC 2 is not planned before a first pilot: do not offer a SOC 2 remediation plan or date.
- **Escalation owner:** Harrison Rubin; security owner (unassigned).
- **CRM tag:** `obj:soc2`; record as accepted prerequisite or disqualifier (`closed_lost` with `loss_reason` if it ends the opportunity).

### O-10 Has it been penetration tested? [DRAFT]
- **Persona:** P5, P4.
- **What it really means:** "Independent validation of the attack surface."
- **Say:** "No independent penetration test has been performed. One is planned, and an independent assessment is a stated condition before any activation. When a report exists we can share it under NDA, along with the remediation record."
- **Proof to offer:** RFP SEC-4 (planned); [`PENETRATION-TEST-PLAN.md`](../../trust/PENETRATION-TEST-PLAN.md); `GO-NO-GO-DECISION.md` blocking priority 2.
- **Evidence gap:** no scan, no assessment, no report (CLM-010 prohibits "penetration tested").
- **Escalation owner:** security owner (unassigned); an independent assessor to be selected.
- **CRM tag:** `obj:pentest`.

### O-14 Is our data used to train AI models? [DRAFT]
- **Persona:** P5, P7.
- **What it really means:** "Will our students' content improve someone's model?"
- **Say:** "Our draft policy and our privacy statement say student data is not used to train models. I need to be precise: the policy is a draft that is not yet in force, I cannot give an unconditional guarantee about every provider's behavior, and the provider terms are read but not signed. For any pilot, the institution would approve which provider, which data classes and which settings, and the AI features are off unless the institution turns them on. At scoping, no data is involved."
- **Proof to offer:** [`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](../../trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) ("Not in force"; a draft); [`PROVIDER-TERMS.md`](../../trust/PROVIDER-TERMS.md); [`AI-DATA-USE-STANDARD.md`](../../trust/AI-DATA-USE-STANDARD.md); RFP AI-1; CLM-011 and CLM-012 (absolutes such as "non-training" or "zero-retention" are PROHIBITED).
- **Evidence gap:** policy not approved; provider terms unsigned; no target configuration evidence. See "Where existing sources say more": the public privacy page wording is broader than CLM-012.
- **Escalation owner:** privacy owner and counsel (unassigned) `[REVIEW: privacy]` `[REVIEW: counsel]`.
- **CRM tag:** `obj:ai_training`; `decision_log` category `privacy`.

## Objections C: accessibility

### O-11 Do you have a VPAT or accessibility conformance report? [DRAFT]
- **Persona:** P6.
- **What it really means:** "Show me a qualified third-party evaluation."
- **Say:** "No. There is no conformance report and we do not claim WCAG conformance. What exists: automated accessibility checks of selected journeys in a real browser, including a narrow-width reflow check, plus component-level tests. A formal evaluation is planned and is a condition before any activation. I can share the testing approach and its limits."
- **Proof to offer:** RFP AX-1 (testing approach) and AX-2 (no ACR; planned); CLM-007 (VERIFIED - REPOSITORY: name the six-route, local scope; no conformance conclusion) and CLM-008 (conformance PROHIBITED); [`HECVAT-VPAT-PLAN.md`](../../trust/HECVAT-VPAT-PLAN.md); [`ACCESSIBILITY-OVERVIEW.md`](../../market-readiness/ACCESSIBILITY-OVERVIEW.md).
- **Evidence gap:** no qualified manual assessment (go/no-go priority 3); no ACR.
- **Escalation owner:** accessibility reviewer (unassigned) `[REVIEW: accessibility]`.
- **CRM tag:** `obj:vpat`; `decision_log` category `accessibility`.

### O-12 Has it been tested with screen readers and assistive technology? [DRAFT]
- **Persona:** P6.
- **What it really means:** "Real users and real assistive technology, not a scan."
- **Say:** "Not yet by a recorded manual pass. NVDA and VoiceOver passes of the critical journeys are planned, with remediation and retest, and they come before any activation. Until then I would not call any journey accessible: I would call it tested by automation within a defined scope."
- **Proof to offer:** RFP AX-3 (planned); CLM-007 scope wording; [`ACCESSIBILITY-CONFORMANCE-PLAN.md`](../../market-readiness/ACCESSIBILITY-CONFORMANCE-PLAN.md).
- **Evidence gap:** no manual assistive-technology evaluation; no user testing with disabled students.
- **Escalation owner:** accessibility reviewer (unassigned).
- **CRM tag:** `obj:screen_reader`.

## Objections D: AI and academic integrity

### O-13 AI concerns and academic integrity [DRAFT]
- **Persona:** P3, P9, P2.
- **What it really means:** "Will this write students' work, give them wrong answers, or create a cheating risk? Who is accountable?"
- **Say:** "A fair concern. AI in Semester is an assist with human review and bounded controls. It is not authoritative, it is not used for high-impact decisions, and for institutional data it runs only through a provider the institution approves and can be switched off. I cannot say it is always accurate or unbiased, and no model evaluation results exist yet. If academic integrity is the concern, the first scope can exclude AI features entirely."
- **Proof to offer:** CLM-011 (CONDITIONAL: exact feature, provider and data path required); RFP AI-1 (available with tenant configuration) and AI-2 (no evaluation results; planned); [`AI-GOVERNANCE-PROGRAM.md`](../../trust/AI-GOVERNANCE-PROGRAM.md); [`AI-HUMAN-OVERSIGHT-STANDARD.md`](../../trust/AI-HUMAN-OVERSIGHT-STANDARD.md); [`AI-TRANSPARENCY-AND-USER-NOTICE.md`](../../trust/AI-TRANSPARENCY-AND-USER-NOTICE.md).
- **Evidence gap:** no evaluation of accuracy or bias; no institution-specific AI notice; CLM-012 prohibits absolutes.
- **Escalation owner:** AI governance reviewer (unassigned) `[REVIEW: privacy]`.
- **CRM tag:** `obj:ai_integrity`; `decision_log` category `privacy`; record "AI excluded from scope" if agreed.

## Objections E: integration and identity

### O-15 Do you support SSO, SCIM or LTI? [DRAFT]
- **Persona:** P4.
- **What it really means:** "Will it fit our identity and learning stack without manual accounts?"
- **Say:** "Not as an available service today. SAML single sign-on, SCIM and LTI 1.3 are built in the repository and tested against test platforms, but none is enabled for any institution and none has been tested against a real identity provider or learning system. Each would be offered only after an acceptance test with your identity team. The first scope can run without them."
- **Proof to offer:** RFP SEC-1, INT-1, INT-2 (all planned / not available); CLM-005 (PROHIBITED as current public availability); [`IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md`](../../trust/IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md).
- **Evidence gap:** no live IdP acceptance; no LTI launch from a real platform. Do not give a date (CLM-017).
- **Escalation owner:** Harrison Rubin; IAM reviewer (unassigned) `[REVIEW: security]`.
- **CRM tag:** `obj:sso_lti`; `decision_log` category `integration`; record as accepted prerequisite or disqualifier.

### O-16 Can it write back to our SIS, or read from it? [DRAFT]
- **Persona:** P4, P1.
- **What it really means:** "Will it change official records, and will it create a data load on our systems?"
- **Say:** "No write-back. Semester does not submit registrations, grades or forms, and it does not request rosters or enrollment lists. For a first scope I would use manual or student-controlled data. A read-only connection is something your team could approve later, but no connection to any SIS or LMS exists today."
- **Proof to offer:** RFP FR-1 (not supported), INT-3 (none connected), INT-4 (no rosters); `docs/market-readiness/OBJECTION-HANDLING.md` (SIS write blocked until customer approval, reconciliation and rollback evidence).
- **Evidence gap:** no installed adapter. The old text "manual/read-only validation first" can be read as read-only being available: it is not (see "Where existing sources say more").
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:sis_write`; `decision_log` category `integration`; if a write is a requirement, record as disqualifier ([`ACCOUNT-SCORING-AND-FORECAST.md`](../../commercial/ACCOUNT-SCORING-AND-FORECAST.md)).

## Objections F: pilot design, adoption and workload

### O-17 The pilot is too long [DRAFT]
- **Persona:** P3, P2.
- **What it really means:** "We cannot commit a full term or more," or "we want a quicker answer."
- **Say:** "I want to be straight about this: there are two different figures inside our own planning, and the final length is not decided. The enforced rule in our pilot-readiness check is a 26-week pilot, long enough for a registration cycle and a decision. Our sales planning assumes a shorter 8-12 week window. I will not promise either until it is resolved, and I will not shorten the evidence steps to fit. What I can do now is keep the scoping short, and agree the decision date up front."
- **Proof to offer:** `PILOT_WEEKS = 26` in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts) (D-134) and [`PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md); RFP IM-1; deal-desk outer limit of 6 months.
- **Evidence gap:** **open founder decision** (record as a D-<PR number> decision): 8-12 weeks (planning assumption) versus 26 weeks (code-enforced). Until resolved, do not state a duration in any customer-facing text; use `[PILOT WINDOW - TO BE CONFIRMED]`.
- **Escalation owner:** Harrison Rubin (Founder decision).
- **CRM tag:** `obj:pilot_too_long`.

### O-18 The pilot is too short [DRAFT]
- **Persona:** P2, P3.
- **What it really means:** "One cycle will not show whether it works."
- **Say:** "That is a fair point, and it is why measures and baselines are agreed first. The pilot ends in a written decision to convert, expand, pause or stop. An extension is a new written term, not an automatic one, and does not silently change scope. I would rather agree what a fair test looks like with you than promise more than the window can show."
- **Proof to offer:** [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md) (four paths; extend needs a versioned charter and a bounded end date); [`PILOT-TO-ANNUAL-CONVERSION.md`](../../PILOT-TO-ANNUAL-CONVERSION.md) (extension is a non-final renewal opportunity and does not lengthen the pilot).
- **Evidence gap:** same duration conflict as O-17; no pilot has run.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:pilot_too_short`.

### O-23 Will students actually use it? [DRAFT]
- **Persona:** P2, P3.
- **What it really means:** "We have launched tools nobody used."
- **Say:** "I cannot show adoption evidence from any institution yet, and I would not estimate one. What we would do together is define, before launch, what counts as activation and a first meaningful action for the cohort, and agree what level would make this not worth continuing. Participation would be voluntary and transparent, with no hidden profiling."
- **Proof to offer:** `PILOT-SCORECARD.md` (measures and guardrails); [`PILOT-SUCCESS-PLAN.md`](../../commercial/PILOT-SUCCESS-PLAN.md); CLM-014 (outcome claims PROHIBITED TODAY).
- **Evidence gap:** no adoption, activation or retention data from any cohort; no usability testing with institution students.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:student_adoption`.

### O-24 We do not have staff time [DRAFT]
- **Persona:** P1, P2.
- **What it really means:** "Our team is already stretched; this is another project."
- **Say:** "That is a real constraint and it can end this. A pilot of this kind needs a named champion, a sponsor, reviewers for privacy, security and accessibility, student communications and weekly participation. I do not have measured hours from any institution, so I will not give you a number; in scoping we would estimate it with you and you could decide whether it fits."
- **Proof to offer:** [`PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) (customer responsibilities); [`PILOT-IMPLEMENTATION-PLAYBOOK.md`](../../market-readiness/PILOT-IMPLEMENTATION-PLAYBOOK.md) (written, not run with a customer).
- **Evidence gap:** no measured staff workload; no run-through with a customer.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:staff_workload`; record "no named champion" as a disqualifier if staff capacity is absent (scoring document: no champion).

### O-28 Faculty will resist [DRAFT]
- **Persona:** P9, P3, P2.
- **What it really means:** "Another system touching our classes, our grading and our time, or an AI cheating tool."
- **Say:** "The first scope should not ask faculty to do anything or change grading. It would be about student planning and registration readiness, not instruction. If faculty concerns are about AI or monitoring, the scope can exclude AI and any individual tracking. I would value hearing what faculty would need in order to be comfortable, and I will not claim faculty support we do not have."
- **Proof to offer:** `PILOT-OFFER.md` exclusions (grades, discipline, individual scoring); RFP PF-5; O-13 for AI.
- **Evidence gap:** no faculty feedback or validation; faculty are not mapped as a committee role in code (note in the stakeholder record).
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:faculty_resistance`; add a stakeholder note for the faculty representative.

### O-29 What if pilot results are ambiguous? [DRAFT]
- **Persona:** P3, P8.
- **What it really means:** "How will we decide when the data is unclear?"
- **Say:** "That is why the decision rules are written first. We agree three to five measures with baselines and targets, a threshold under which a number is not reported, and stop conditions. If results are ambiguous, the options are to extend on a new written term, to pause with a named cause and date, or to stop. A pilot without a signed decision is not complete, and we would not call it a success. Stopping is a legitimate recommendation."
- **Proof to offer:** `pilotReadiness` and `pilotVerdict` in [`pilot.ts`](../../../app/src/lib/gtm/pilot.ts) (three to five metrics with baselines; a signed decision; high-severity open issue blocks convert and expand); [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md).
- **Evidence gap:** the rules are code and drafts; no pilot has been decided.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:ambiguous_results`.

### O-31 We need to launch faster [DRAFT]
- **Persona:** P3, P2.
- **What it really means:** "The registration date will not move."
- **Say:** "I can shorten the scope, never the review. A faster first step would be a smaller cohort, a narrower workflow and manual data. I cannot shorten security, privacy or accessibility evidence, and live activation is not available now, so I would not want to promise it for this date."
- **Proof to offer:** `docs/market-readiness/OBJECTION-HANDLING.md` ("reduce scope/integration, never security/privacy/accessibility evidence"); `GO-NO-GO-DECISION.md`.
- **Evidence gap:** no activation is available; no launch date can be promised.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:faster_launch`; record the milestone date; if the date cannot be met, `paused` with a `future_contact_rule` keyed to the next term.

## Objections G: money, references and evidence of value

### O-19 Who else uses it? Can we speak to references? [DRAFT]
- **Persona:** P3, P7.
- **What it really means:** "Is anyone else taking this risk?"
- **Say:** "No institution uses it yet. I would rather say that than imply otherwise. What I can offer is a scoping conversation and, if you are comfortable, to be an early design partner, which means helping shape what it should be before it is deployed. I do not name institutions, and I would only ever name yours with your written consent."
- **Proof to offer:** RFP RF-1 (no institutional customer yet; do not name one); CLM-013 (PROHIBITED TODAY); [`CUSTOMER-REFERENCE-PROGRAM-DRAFT.md`](../../commercial/CUSTOMER-REFERENCE-PROGRAM-DRAFT.md).
- **Evidence gap:** no customer, no pilot, no case study, no reference.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:references`; if a reference is a firm requirement, record as accepted prerequisite or disqualifier.

### O-20 What does it cost? [DRAFT]
- **Persona:** P8, P7, P3.
- **What it really means:** "Give me a number to compare and to size the budget."
- **Say:** "I cannot give a number. There is no approved price, and I do not want you to plan around a figure I may have to change. When I can quote, it will be a written quote with scope, term, taxes and conditions. For now I can tell you what we would need to know to price it: the cohort, the workflow, the data and integration scope, and the support you need."
- **Proof to offer:** CLM-015 (PROHIBITED / `[PRICE TO BE CONFIRMED]`); RFP PR-1 (company to supply); [`PRICING-AND-PACKAGING.md`](../../commercial/PRICING-AND-PACKAGING.md) (no approved price book; internal prices conflict: D-134, D-1154 and planning assumptions).
- **Evidence gap:** no approved price book; no payment authority; entity, tax and payment authority is go/no-go priority 5.
- **Escalation owner:** Founder, Finance, Tax, Legal (Finance, Tax and counsel unassigned).
- **CRM tag:** `obj:pricing`; log as a `budget` entry so demand for a quote is visible.
- **Never:** quote a range, a per-student figure, a discount, a "launch price", or "free forever".

### O-25 Prove the ROI [DRAFT]
- **Persona:** P3, P8.
- **What it really means:** "Show me a number I can take to the president or CFO."
- **Say:** "I cannot show an ROI or an outcome figure, because none exists and I would not invent one. What I can offer is a worksheet you fill with your own baseline numbers, so the case is yours. Any benefit would be measured in a pilot against a baseline agreed first, and could come out as not worth continuing."
- **Proof to offer:** [`ROI-MODEL-AND-BUSINESS-CASE.md`](../../commercial/ROI-MODEL-AND-BUSINESS-CASE.md) (worksheet; Semester supplies no benefit number); CLM-014 (PROHIBITED TODAY).
- **Evidence gap:** no baseline, no measured result, no causal design.
- **Escalation owner:** Harrison Rubin; Finance (unassigned).
- **CRM tag:** `obj:roi_proof`.

### O-21 Our procurement takes a long time [DRAFT]
- **Persona:** P7, P3.
- **What it really means:** "Do not expect a quick contract," or "we have a formal path you must follow."
- **Say:** "That is useful to know and I would start the path early. I cannot sign anything or take payment today: our paper is a set of drafts that counsel has not approved. What I can do now is start the evidence exchange and learn your steps, thresholds and calendar, so that nothing in the paper surprises you."
- **Proof to offer:** [`BUDGET-AND-PURCHASING-PATH.md`](../../commercial/BUDGET-AND-PURCHASING-PATH.md); [`PROCUREMENT_CHECKLIST.md`](../../market-readiness/PROCUREMENT_CHECKLIST.md); RFP CT-1 (company to supply: no approved terms).
- **Evidence gap:** no approved master agreement, order form, DPA or pilot agreement; entity and signing authority unresolved (go/no-go priority 5).
- **Escalation owner:** counsel (unassigned) `[REVIEW: counsel]` `[REVIEW: procurement]`.
- **CRM tag:** `obj:procurement_timeline`; record the stated steps and timing in the opportunity (needed to qualify).

### O-26 Why not build this ourselves? [DRAFT]
- **Persona:** P4, P3.
- **What it really means:** "We have developers and we control our data."
- **Say:** "You may be right to, and I would not argue with that. The question I would ask is whether a small test with a third party is cheaper than the build-and-maintain decision. If you have the capacity, we may only be useful as input to what you build. If not, the scoping conversation can help you decide. I would not claim anything we do cannot be built."
- **Proof to offer:** none to oversell; the product description in CLM-001; RFP ES-1.
- **Evidence gap:** no comparison, no cost study; do not state a unique capability or a time-to-build.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:build_vs_buy`; record as disqualifier if the decision is already to build.

## Objections H: continuity, data rights and contract

### O-22 You are a startup: what if you disappear? [DRAFT]
- **Persona:** P7, P4, P3.
- **What it really means:** "Vendor-failure risk; what happens to our students and our data?"
- **Say:** "That risk is real and I will not wave it away. Semester is an early company, not an established vendor, and I cannot show a long operating history. Practically: students can export their own data and delete their accounts; a bounded scope limits what depends on us; and we would write down an exit and offboarding plan before anything starts. We have no escrow arrangement or insured guarantee to offer today."
- **Proof to offer:** RFP PF-3 (student export and deletion), CP-1 (company information: company to supply); [`BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md`](../../trust/BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md) (status `PARTIAL / TARGET RECOVERY NOT PROVEN`); [`PILOT-OFFBOARDING-PLAYBOOK.md`](../../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md); [`INSURANCE-READINESS-CHECKLIST.md`](../../company/INSURANCE-READINESS-CHECKLIST.md).
- **Evidence gap:** single owner with no backup (internal, [INTERNAL]); no escrow; no insurance evidenced; no financial standing statement; restore and rollback exercises are go/no-go priority 7. Do not disclose internal staffing detail beyond the true statement that the company is early and small.
- **Escalation owner:** Founder; counsel and insurance broker (unassigned) `[REVIEW: counsel]` `[REVIEW: insurance]`.
- **CRM tag:** `obj:startup_continuity`; `decision_log` category `legal`.

### O-27 Who owns the data; how do we exit and delete? [DRAFT]
- **Persona:** P5, P7.
- **What it really means:** "Will we be locked in, and can we get our data out and verified deleted?"
- **Say:** "Your institution's data remains yours. For students, a portable export and account deletion exist and are tested. For an institution, an offboarding process would be written into scope: export, revocation of access and integrations, deletion and retention handling with exceptions listed, and a verification step. The binding terms are in paper that counsel has not yet approved, so I would not call it a commitment."
- **Proof to offer:** RFP PF-2 (retention schedule), PF-3 (export and deletion); [`DATA-EXPORT-STANDARD.md`](../../trust/DATA-EXPORT-STANDARD.md) (status PARTIAL); [`DATA-RETENTION-AND-DELETION-STANDARD.md`](../../trust/DATA-RETENTION-AND-DELETION-STANDARD.md); [`PILOT-OFFBOARDING-PLAYBOOK.md`](../../market-readiness/PILOT-OFFBOARDING-PLAYBOOK.md); [`PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md`](../../institutional-readiness/PILOT-CLOSEOUT-AND-CONVERSION-PLAN.md).
- **Evidence gap:** no offboarding has been executed; no signed DPA; deletion of provider and backup tails depends on terms not yet signed (go/no-go priority 7).
- **Escalation owner:** privacy owner and counsel (unassigned).
- **CRM tag:** `obj:data_exit`; `decision_log` category `privacy`.

### O-32 What is the uptime, support and response time? [DRAFT]
- **Persona:** P4, P7.
- **What it really means:** "What service level will you commit to?"
- **Say:** "None yet, and I will not invent one. There is a production monitor, but no retained availability history, no staffed support desk with response times, and no recovery objectives measured on production. A scoping stage does not depend on any of it. Before anything activates, support coverage and recovery exercises are conditions."
- **Proof to offer:** RFP SS-1 (planned), SS-2 (not supported), SEC-6 (not stated); CLM-016 (PROHIBITED TODAY); [`SLA.md`](../../trust/SLA.md) (status `NOT_STARTED` as a commitment).
- **Evidence gap:** go/no-go priorities 6 and 7 (staffed support, restore and rollback).
- **Escalation owner:** Harrison Rubin (support primary; backups required).
- **CRM tag:** `obj:sla`; `decision_log` category `procurement`.

### O-33 Where is the data hosted; can you guarantee residency? [DRAFT]
- **Persona:** P5, P4.
- **What it really means:** "Must data stay in a country or region?"
- **Say:** "I can describe the hosting setup but I cannot guarantee residency. Providers and regions are not all confirmed on file and I will not promise a location. If residency is a requirement, tell me the rule and I will check against the provider terms and give you a written answer, which may be that we cannot meet it."
- **Proof to offer:** RFP TA-1, PF-4; [`SUBPROCESSORS.md`](../../SUBPROCESSORS.md); CLM-010 (guaranteed data residency PROHIBITED).
- **Evidence gap:** hosting regions and each provider's terms are not all on file; no residency attestation.
- **Escalation owner:** security owner (unassigned); counsel `[REVIEW: security]` `[REVIEW: counsel]`.
- **CRM tag:** `obj:residency`; record as accepted prerequisite or disqualifier.

### O-34 Do you have cyber and liability insurance? [DRAFT]
- **Persona:** P7.
- **What it really means:** "Procurement requires certificates before contracting."
- **Say:** "Not yet evidenced. An insurance readiness checklist exists, and a broker decision is a condition before any paid engagement. I cannot send a certificate and I will not suggest we have coverage."
- **Proof to offer:** [`INSURANCE-READINESS-CHECKLIST.md`](../../company/INSURANCE-READINESS-CHECKLIST.md); `STAGE-COLLATERAL-AND-HANDOFF.md` (Absent list: insurance certificates not evidenced); go/no-go priority 5.
- **Evidence gap:** no coverage, no broker.
- **Escalation owner:** insurance broker (unassigned) `[REVIEW: insurance]`.
- **CRM tag:** `obj:insurance`.

### O-35 Will you sign our DPA and our terms? [DRAFT]
- **Persona:** P7.
- **What it really means:** "We use our paper; do not send yours."
- **Say:** "I can review your paper with counsel when we are at that stage. Today I cannot sign anything: our own drafts have not been approved by counsel, and our signing and entity authority is being completed. If you can share your standard terms early, I will tell you honestly where I expect gaps."
- **Proof to offer:** RFP PF-1 and CT-1; [`CONTRACT-NEGOTIATION-PLAYBOOK.md`](../../legal-drafts/CONTRACT-NEGOTIATION-PLAYBOOK.md); [`DPA-ISSUE-LIST.md`](../../market-readiness/DPA-ISSUE-LIST.md).
- **Evidence gap:** no approved paper; no signer; entity facts unresolved.
- **Escalation owner:** counsel (unassigned) `[REVIEW: counsel]`.
- **CRM tag:** `obj:contract_paper`; `decision_log` category `legal`.

### O-36 Is this endorsed by, or partnered with, another institution? [DRAFT]
- **Persona:** P3, P7.
- **What it really means:** "Is there someone I can check with, and is the claim you are making real?"
- **Say:** "No. There is no institutional endorsement, partnership or customer. If you saw or heard otherwise, please tell me where, so we can correct it."
- **Proof to offer:** CLM-013; the MESSAGING-HOUSE prohibited-claim list ("Vanderbilt-approved/partnered" is prohibited); [`CLAIM-WITHDRAWAL-RUNBOOK.md`](../../CLAIM-WITHDRAWAL-RUNBOOK.md).
- **Evidence gap:** none; do not imply association.
- **Escalation owner:** Harrison Rubin; a mistaken public claim follows the withdrawal runbook.
- **CRM tag:** `obj:endorsement`; if the prospect cites a source, file it for claim withdrawal.

### O-30 We want individual at-risk alerts [DRAFT]
- **Persona:** P2, P3.
- **What it really means:** "Show me which students to call."
- **Say:** "We do not build individual risk scores and I would not offer that in a pilot. What we can discuss is aggregate readiness for a cohort, and routing students to the people your institution already uses for support. If an individual early-alert system is the requirement, Semester is not the right tool, and I will tell you so."
- **Proof to offer:** RFP PF-5 (no student risk scoring; refused in writing); `docs/market-readiness/OBJECTION-HANDLING.md`; FR-4 (campus help request is a feature-flagged pilot; not available as a service).
- **Evidence gap:** by design, none; the human-help path is flagged, not deployed.
- **Escalation owner:** Harrison Rubin.
- **CRM tag:** `obj:risk_alerts`; record as a disqualifier (prohibited individual risk scoring is an automatic disqualifier in the scoring document).

## Where existing sources say more than the claims register allows [VERIFIED]

Authority order: code and tests, then [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md), then the go/no-go decision, then commercial and market-readiness documents. The items below are flagged, not edited: the owning documents change only through their own review (the RFP library is generated from `app/src/lib/gtm/rfp.ts` and held by `rfp.test.ts`).

| # | Source and wording | Register or evidence position | What this library does |
| --- | --- | --- | --- |
| 1 | [`OBJECTION-HANDLING.md`](../../market-readiness/OBJECTION-HANDLING.md): "Need SOC 2/ISO/VPAT: ... offer scoped evidence **and remediation plan**" | RFP SEC-5: SOC 2 not supported and not planned before a first pilot; `SOC2-READINESS.md` is an in-progress gap assessment with no auditor; ISO has no document | Offers no SOC 2 or ISO remediation plan or date; a VPAT and a penetration test are described as "planned" only (AX-2, SEC-4) |
| 2 | Same file: "Want a free pilot: **tie price to implementation/evidence cost**" | CLM-015: price, discount, savings and paid-plan availability are PROHIBITED; no approved price book; no pilot can be activated | O-04 answers with scoping at no charge and "whether a later design partnership is no-fee or paid is not decided" |
| 3 | Same file: "Need an SIS write: propose **manual/read-only validation first**" | RFP INT-3: no SIS, LMS or CRM connection exists and `adapters.ts` is empty; CLM-005 | O-16 says manual first; read-only is something the institution could approve later and nothing is installed |
| 4 | Same file: "Want individual risk alerts: ... offer aggregate cohort readiness and **official human-led support workflow**" | RFP FR-4: the campus help path is a feature-flagged pilot, not an available service | O-30 does not offer the help path as available |
| 5 | [`MESSAGING-HOUSE.md`](../../market-readiness/MESSAGING-HOUSE.md): "Is it accessible? WCAG 2.2 AA is the target; **automated/self-assessed** evidence exists" | CLM-007 supports only "automated accessibility guards and selected browser checks" with a six-route, local scope; CLM-008 prohibits conformance claims; no self-assessment record is cited | O-11 and O-12 use CLM-007 wording and avoid "self-assessed" and "AA target" as a customer-facing statement (a target is a roadmap statement under CLM-017) |
| 6 | MESSAGING-HOUSE: "FERPA ... We provide a scoped control/evidence package and **contract language** for your counsel" | CT-1 and PF-1: the drafts are not approved by counsel | O-06 says "draft" |
| 7 | RFP library PS-2: "Available now ... Yes. It is local-first" | CLM-002 is CONDITIONAL: account sync was not rerun against the intended target | Not quoted; scripts avoid this claim |
| 8 | RFP library AX-1: "Automated audits of the critical student journeys ... at the 320-pixel reflow width" | CLM-007 limits the statement to six routes and a local scope | O-11 states the scope and its limits |
| 9 | RFP library AI-1: sensitive classes "never reach a consumer model" | CLM-011 CONDITIONAL; CLM-012 PROHIBITED for absolutes ("safe", "private", "non-training") | O-13 and O-14 state "bounded controls" and make no absolute claim |
| 10 | Public privacy page and the AI training policy header: "Nothing is used to train anything" (`app/src/lib/privacy.ts`; the policy itself says "Not in force") | CLM-012 prohibits "non-training" as an absolute; provider terms are unsigned (`PROVIDER-TERMS.md`) | O-14 states the policy as a draft and gives no guarantee |
| 11 | RFP library IM-1 and `PILOT-OFFER.md`: a pilot "always runs 26 weeks" | The founder's sales assumption is 8-12 weeks (open decision) | O-17 and O-18 state the conflict and avoid a duration |

## Evidence state

- [VERIFIED] The scripts cite RFP library rows, claim ids and repository paths that exist at revision `5eba494`.
- [DRAFT] No script has been reviewed by counsel or by a security, privacy or accessibility professional; no named approver exists, so no script is `[APPROVED]`.
- No objection has ever been handled with a real prospect; no frequency, win rate or conversion by objection exists.
- Several gaps are structural (no independent assessment, no ACR, no approved paper, no price book, no named customer) and remain open until the go/no-go priorities close.

## Claim ceiling

Semester may use these scripts in non-activation discovery, demonstration, evidence exchange and conditional scoping to state current status honestly and to refer the buyer to a professional or a draft document. A script may never be used to answer a question the register prohibits.

## Prohibited claims

Do not state or imply any of: customers, pilots, references, case studies or endorsements; outcomes, ROI, savings, adoption or retention; SOC 2, ISO, FERPA, COPPA or GDPR compliance, HECVAT completion, a penetration test, WCAG conformance or a VPAT; SSO, SCIM, LTI, SIS or LMS availability; uptime, recovery, response-time or support-hour commitments; data residency guarantees; AI accuracy, safety, privacy, zero-retention or non-training guarantees; any price, discount, free-forever offer or launch date.

## Professional review required

| Area | Reviewer | Scope |
| --- | --- | --- |
| Security statements (O-05, O-08, O-09, O-10, O-33) | security owner / independent assessor (unassigned) `[REVIEW: security]` | Each status line |
| Privacy and AI statements (O-06, O-07, O-13, O-14, O-27) | privacy owner (unassigned) `[REVIEW: privacy]` | Wording of data-use and training answers |
| Accessibility statements (O-11, O-12) | accessibility reviewer (unassigned) `[REVIEW: accessibility]` | Technical statement vs CLM-007 |
| Contract, DPA, procurement and continuity statements (O-21, O-22, O-34, O-35) | counsel, insurance broker, procurement (unassigned) `[REVIEW: counsel]` `[REVIEW: insurance]` `[REVIEW: procurement]` | Whether any statement could be read as a commitment |
| Pricing and budget statements (O-03, O-04, O-20) | Founder, Finance, Tax (unassigned) `[REVIEW: tax]` | Placeholder discipline |
