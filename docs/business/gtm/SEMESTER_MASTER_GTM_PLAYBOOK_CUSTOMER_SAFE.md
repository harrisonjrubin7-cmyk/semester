> **DRAFT - not approved for external distribution until the claims owner records approval**

# Semester: Registration Readiness Pilot Overview (Customer-Safe Source Version)

| Control | Value |
| --- | --- |
| Status | **DRAFT - NOT APPROVED. No named approver is recorded in `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` for any wording below** |
| Owner | Harrison Rubin (interim claims owner; backup and counsel unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] (with an evidence pointer) and conditional wording quoted from the register (marked `CONDITIONAL`, with its `CLM` id). `[APPROVED]` count: **0** |
| Audience | Customer-safe **Markdown source version**, for use only after approval. Internal playbook: [`SEMESTER_MASTER_GTM_PLAYBOOK.md`](SEMESTER_MASTER_GTM_PLAYBOOK.md) |

> This overview is a business description, not legal, security, privacy, accessibility, tax or insurance advice, and not an offer. Nothing here is a contract term or a commitment to launch, price or deliver.

Label legend. `[VERIFIED: path]` the cited repository path or evidence id supports the statement as worded. `CONDITIONAL (CLM-0xx)` the statement uses the exact conditional wording of that register row and must carry its qualifiers. A tag is not an approval: use of any statement in a channel requires the approval record below.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document is needed rather than an edit |
| --- | --- | --- | --- |
| [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) | Classification and approval state for each claim | A readable overview assembled only from register rows that permit conditional use | The register is a control table, not a readable document |
| [`docs/commercial/PRODUCT-MARKETING-CLAIMS-LIBRARY.md`](../../commercial/PRODUCT-MARKETING-CLAIMS-LIBRARY.md), [`POSITIONING-AND-MESSAGING.md`](../../commercial/POSITIONING-AND-MESSAGING.md) | Internal claim ceilings and position | A customer-readable ordering with evidence pointers | Those are internal ceilings, not publication approval |
| [`docs/market-readiness/TRUST-CENTER-CONTENT.md`](../../market-readiness/TRUST-CENTER-CONTENT.md), [`docs/pilot/KNOWN-LIMITATIONS.md`](../../pilot/KNOWN-LIMITATIONS.md) | Trust posture and known limits | A single page that puts limits beside capabilities | Reader convenience |
| [`SEMESTER_MASTER_GTM_PLAYBOOK.md`](SEMESTER_MASTER_GTM_PLAYBOOK.md) | Internal go-to-market system | This is the derivative that omits internal pricing assumptions, risks, targets and unapproved claims | Separation of internal and customer-facing content |

## Approval record (to be completed before any use) 

An approval for one audience, channel or date does not authorize another ([`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)).

| Field | Value |
| --- | --- |
| Claims owner who approves | `[NAME - NOT RECORDED]` |
| Specialist and legal reviewers (as the register's rows require) | `[NOT RECORDED]` |
| Approved audience, channel, jurisdiction | `[NOT RECORDED]` |
| Approval date and expiry | `[NOT RECORDED]` |
| Withdrawal owner and monitoring location | `[NOT RECORDED]` |
| Variant approved (this exact text, version) | `[NOT RECORDED]` |

Until every field is filled, this document is internal. The default when evidence or authority is unclear is: do not publish.

## 1. What Semester is

1. "Semester is an academic planning and productivity experience that helps students organize academic context, tasks, deadlines and plans." [VERIFIED: `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` row CLM-001; local product paths and golden journey]. This describes the exercised experience only; it does not describe outcomes or an official record.
2. "Semester is local-first, with optional account synchronization." CONDITIONAL (CLM-002). Qualifier: device persistence and export exist; account synchronization must be qualified for the intended target and version before it is described to a specific audience.
3. "Semester is in private or invitation-based validation." [VERIFIED: [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md), 2026-10-03; CLM-003]. Individual use is limited to invitation-only, unpaid validation.
4. "Where Semester shows a source label beside a fact, the label says where the fact came from (institution verified, imported, student entered, estimated, AI-assisted or needs review) and, where known, when it was last updated." [VERIFIED: [`docs/CLM-018-SOURCE-LABEL-EVIDENCE.md`](../../CLM-018-SOURCE-LABEL-EVIDENCE.md); CLM-018, scoped wording only]. Do not generalize this to "every fact says where it came from"; the register states that wording is not supported.

## 2. How Semester relates to your existing systems

1. "Semester can work alongside existing university systems in a bounded pilot." CONDITIONAL (CLM-004). Qualifier: this is a proposed offer; it may be said only in a non-activation scoping conversation with its conditions stated prominently, and it requires product, security, privacy, legal and customer approval before any activation.
2. Semester sits beside your systems of record. Your institution's own systems remain the official record for registration, grades and eligibility. [VERIFIED: [`docs/pilot/KNOWN-LIMITATIONS.md`](../../pilot/KNOWN-LIMITATIONS.md): "Register, drop, pay and submit in your university's own systems"].
3. No registrar, student-information or learning-system connection is live for any institution at this time. [VERIFIED: [`docs/pilot/KNOWN-LIMITATIONS.md`](../../pilot/KNOWN-LIMITATIONS.md); `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` CLM-005]. Early scope uses manual or student-controlled inputs, or approved read-only sources where an institution approves them.

## 3. The proposed pilot concept

The Registration Readiness Pilot is a **proposed concept for discovery and scoping**. It is not an available service, and nothing in this section is a quote or a commitment. CONDITIONAL (CLM-004).

| Element | Description | Evidence pointer |
| --- | --- | --- |
| Focus | one registration-readiness or term-start workflow | [VERIFIED: [`docs/commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) (controlled conditional offer)] |
| Participants | one defined cohort | [VERIFIED: `PilotPlan` and `pilotReadiness` in [`app/src/lib/gtm/pilot.ts`](../../../app/src/lib/gtm/pilot.ts)] |
| Inputs | manual or student-controlled; approved read-only sources only if your institution approves them | [VERIFIED: `PilotPlan.dataPlan` in `pilot.ts`: minimum necessary, read-only first, source labelled] |
| People | a named executive sponsor and a named operational champion on your side | [VERIFIED: `pilot.ts` readiness checks] |
| Success criteria | written before the pilot starts, with a baseline for each measure | [VERIFIED: `pilot.ts` readiness checks] |
| Decision | a written decision date and a midpoint review; the pilot is not complete until a signed decision is recorded | [VERIFIED: `pilot.ts` (`pilotVerdict`)] |
| Duration | `[PILOT LENGTH TO BE CONFIRMED]` | n/a |
| Price and terms | `[PRICE TO BE CONFIRMED]`; terms are non-binding drafts pending counsel review | register row CLM-015 |
| Exit | offboarding is part of the plan | [VERIFIED: [`docs/commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md)] |

What a pilot would measure (definitions, not results): activation, first meaningful action, workflow completion, weekly use, staff time and support friction, student confidence and satisfaction (self-reported), support issues, and readiness for an annual decision. [VERIFIED: definitions only in [`docs/market-readiness/METRIC-DICTIONARY.md`](../../market-readiness/METRIC-DICTIONARY.md); no values exist].

What the pilot is not: it is not a replacement for any official system, not an automated advising or eligibility decision, and not an individual risk-scoring tool. [VERIFIED: [`docs/commercial/IDEAL-CUSTOMER-PROFILE.md`](../../commercial/IDEAL-CUSTOMER-PROFILE.md); CLM-006 classification: replacement claims are prohibited].

## 4. What an engagement can include today

[VERIFIED: [`GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md), 2026-10-03.] Today, engagement is limited to:

- discovery conversations;
- demonstrations using **synthetic** data;
- evidence exchange, including a fit and limitations review; and
- conditional, non-binding scoping.

In this phase Semester is not accepting live customer data, activating a tenant for a customer, accepting payment, or committing to a launch date. These steps are held until the applicable review and approval conditions are met and recorded for the exact scope.

## 5. Student experience principles

1. Student agency: students choose what to set up, can use a manual path, and can export or delete their data. [VERIFIED: [`docs/market-readiness/TRUST-CENTER-CONTENT.md`](../../market-readiness/TRUST-CENTER-CONTENT.md) (privacy section: export, correction, deletion paths, subject to identity verification, institutional record duties, legal holds and backup expiry)].
2. No individual risk scoring and no sale of student data. [VERIFIED: [`docs/market-readiness/ADVERTISING-AND-MONETIZATION-POLICY.md`](../../market-readiness/ADVERTISING-AND-MONETIZATION-POLICY.md): "Semester does not sell student or institutional data"; [`docs/commercial/CUSTOMER-HEALTH-SCORE.md`](../../commercial/CUSTOMER-HEALTH-SCORE.md): "Never penalize students"].
3. Engagement without pressure: no streaks, leaderboards, shame notifications or fear-based urgency. [VERIFIED: [`docs/ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md`](../../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md) hard boundaries, held by a structural test].
4. Reported results are cohort aggregates, suppressed when a group is small. [VERIFIED: the n >= 10 floor in [`docs/PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md) and [`docs/commercial/GROWTH-FUNNEL-SPEC.md`](../../commercial/GROWTH-FUNNEL-SPEC.md) (proposed threshold)].

## 6. Security, privacy, accessibility and AI: process, not certification

1. "Semester maintains repository-tested security, privacy, authorization and lifecycle controls for defined paths." [VERIFIED: [`docs/trust/CONTROL-FACTS.md`](../../trust/CONTROL-FACTS.md) (generated from the repository); CLM-009]. Qualifier: cite the exact control and revision; this does not describe an independent assessment or a production target.
2. "Semester includes automated accessibility guards and selected browser accessibility checks." [VERIFIED: CLM-007; scope is the six-route local checks]. This is not a conformance conclusion.
3. "Semester offers assistive AI features with human review and bounded controls." CONDITIONAL (CLM-011). Qualifier: state the exact feature, provider and data path and the limitations; review by AI, privacy, security, product and legal is open.
4. Materials under non-disclosure (security control matrix, data-flow map, evidence index, draft pilot paper) are shared through a controlled trust room, not through marketing copy. [VERIFIED: [`docs/market-readiness/TRUST-CENTER-CONTENT.md`](../../market-readiness/TRUST-CENTER-CONTENT.md); trust-room controls in [`docs/gtm/EXECUTION-PLAN.md`](../../gtm/EXECUTION-PLAN.md)].

## 7. Current limitations (stated plainly)

Each item is a limitation stated by the repository's own trust documents. [VERIFIED: [`docs/market-readiness/TRUST-CENTER-CONTENT.md`](../../market-readiness/TRUST-CENTER-CONTENT.md) and [`docs/pilot/KNOWN-LIMITATIONS.md`](../../pilot/KNOWN-LIMITATIONS.md) unless another path is given).

| Area | Current state |
| --- | --- |
| Independent security assessment | A penetration test is at plan stage only; none is completed |
| Accessibility | Semester targets WCAG 2.2 AA as an alignment target; a formal accessibility conformance report and independent evaluation are not currently available |
| Agreements | The data-processing and pilot agreements exist as issue lists, outlines and drafts; none is executed ([`docs/trust/DPA-CHECKLIST.md`](../../trust/DPA-CHECKLIST.md), [`PILOT-AGREEMENT-OUTLINE.md`](../../trust/PILOT-AGREEMENT-OUTLINE.md)) |
| Insurance | Not evidenced |
| Integrations | No registrar, student-information or learning-system connection is live for an institution |
| Support | Pilot-scoped with agreed hours and severities; no round-the-clock support is offered |
| Status communication | A public multi-service status operation is not evidenced |
| Questionnaires | A security questionnaire response (HECVAT) is prepared as a draft and evidence index; it is not a completed or certified assessment |
| Customers and outcomes | There are no named customers, case studies or measured outcomes to report |

## 8. Roadmap

Roadmap capability is a hypothesis, not a commitment, and carries no delivery date. CONDITIONAL (CLM-017): label any roadmap statement non-binding and avoid dates.

## 9. Next step

To discuss fit, contact `[CONTACT PATH - PLACEHOLDER]`. The first conversation is exploratory and non-binding. Price: `[PRICE TO BE CONFIRMED]`. Dates: `[PLACEHOLDER]`.

## Statement register (for the approver)

| ID | Statement | Tag | Evidence / register |
| --- | --- | --- | --- |
| S1 | planning and productivity experience wording | [VERIFIED] | CLM-001; golden journey |
| S2 | local-first with optional synchronization | CONDITIONAL | CLM-002 |
| S3 | invitation-based validation | [VERIFIED] | CLM-003; `GO-NO-GO-DECISION.md` |
| S4 | source label wording (scoped) | [VERIFIED] (proposed, not approved) | CLM-018; `docs/CLM-018-SOURCE-LABEL-EVIDENCE.md` |
| S5 | works alongside existing systems in a bounded pilot | CONDITIONAL | CLM-004 |
| S6 | no live institutional connection | [VERIFIED] | `docs/pilot/KNOWN-LIMITATIONS.md`; CLM-005 |
| S7 | pilot concept structure | [VERIFIED] (rules) / CONDITIONAL (offer) | `pilot.ts`; CLM-004 |
| S8 | current engagement boundary | [VERIFIED] | `GO-NO-GO-DECISION.md` |
| S9 | export, deletion, no data sale, no streaks | [VERIFIED] | trust content; advertising policy; ethical engagement doc |
| S10 | repository-tested controls | [VERIFIED] | CLM-009; `CONTROL-FACTS.md` |
| S11 | automated accessibility checks | [VERIFIED] | CLM-007 |
| S12 | assistive AI with human review | CONDITIONAL | CLM-011 |
| S13 | limitations table | [VERIFIED] | `TRUST-CENTER-CONTENT.md`; `KNOWN-LIMITATIONS.md` |
| S14 | roadmap is non-binding | CONDITIONAL | CLM-017 |

## Evidence state

**Repository evidence.** Each statement above is traced to a repository path or a claims-register row.

**Operational evidence.** No approved wording, named approver, customer, pilot, outcome or independent assurance exists.

**Missing proof.** Complete the approval record; verify each cited evidence item is current on the day of use; obtain the specialist and legal approvals each register row requires.

## Claim ceiling

If approved, this overview may be used for evidence-bounded discovery, synthetic demonstrations, evidence exchange and conditional scoping.

## Prohibited claims

This document does not claim, and no derivative may claim: customers, logos or case studies; measured outcomes or time or cost savings; certification or compliance (SOC 2, FERPA, COPPA, GDPR, HECVAT approval); penetration-test results; uptime, recovery or support-hours guarantees; WCAG, VPAT or ACR conformance; SSO, SCIM, LTI or SIS/LMS integration availability; replacement of any official system; enterprise readiness; any price, discount or paid availability.

## Professional review required

[REVIEW: counsel] wording and approval record. [REVIEW: privacy] student-experience statements. [REVIEW: security] control statements. [REVIEW: accessibility] accessibility statement. [REVIEW: procurement] how the limitations table is presented to buyers.
