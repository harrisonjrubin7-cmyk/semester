# 08 · Marketplace, partner, trust and safety, and fulfillment and dispute operations

| Control | Value |
| --- | --- |
| Status | **PROPOSED OPERATING DESIGN — NO MARKETPLACE EXISTS; NO PARTNER IS APPROVED; MODERATION CAPABILITIES ARE BUILT BUT SWITCHED OFF** |
| Owner seat | `trust` for trust and safety, provider approval and moderation (vacant; the Founder is acting); `finance` for money and disputes; `founder` for partner agreements and phase promotion |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Builds on | [`PARTNER-AND-CHANNEL-STRATEGY`](../../commercial/PARTNER-AND-CHANNEL-STRATEGY.md), [`PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS`](../../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md), [`CAMPUS-MODERATION-SOP`](../../CAMPUS-MODERATION-SOP.md), [`VOLUNTEER-MODERATOR-PROGRAM`](../../VOLUNTEER-MODERATOR-PROGRAM.md), [`COMMUNITY-MEDIA-SAFETY`](../../COMMUNITY-MEDIA-SAFETY.md), [`CRISIS-RESPONSE-RUNBOOK`](../../CRISIS-RESPONSE-RUNBOOK.md), [`ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT`](../../legal/ADVERTISING-AND-SPONSORSHIP-POLICY-DRAFT.md), [`COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT`](../../legal/COPYRIGHT-AND-TAKEDOWN-POLICY-DRAFT.md), the decision log's D-146 |
| Claim ceiling | Semester may describe these as operating designs for capabilities that are gated. It may not claim a marketplace, an approved partner, a certification, staffed moderation, or any provider relationship, listing or payout. |

## Where each area stands

| Area | In the repository today | Operating reality | Consequence |
| --- | --- | --- | --- |
| **Marketplace** | Constitution rates the education-workflow marketplace *absent* (priority P5). A sponsorship gate exists in code behind a high-risk flag that is off. Commission and payout reconciliation appear as governance lines | No provider, listing, order or payout exists | Design the operations *before* any phase opens; build nothing that moves money |
| **Partners** | Strategy and evaluation criteria; a provider-maturity registry design | No approved partner, channel or reseller | One bounded partner pilot before any programme |
| **Trust and safety** | Moderation workflow, volunteer program, report forms and crisis notice built; volunteer moderation behind a flag that is off and refuses production | No staffed moderator, no live community at scale | Community and marketplace surfaces stay off until reviewable inside the targets |
| **Fulfillment and disputes** | The student-account ledger and Plus subscription billing exist; a hosted payment provider handles money | Plus disputes follow the support taxonomy; marketplace disputes do not exist | Marketplace disputes are designed here and dormant |

## Principles

1. **The student's interests come first.** Choice is preserved, nothing is pay-to-rank, and sponsorship is separate and labelled.
2. **No student-level data reaches a provider, sponsor or partner without explicit, revocable consent and a stated purpose.** Aggregates only otherwise, with cells under ten suppressed.
3. **No money moves through Semester** ([D-146](../../DECISION-LOG.md)): Semester keeps accounts and controls; the school's or provider's hosted payment provider moves money. This holds until the owner decides otherwise in a pull request.
4. **Every claim a provider makes about itself is substantiated or removed.** "Certified" and "partner" appear only with an evidence row whose verifier is a person ([`PROVIDER-MATURITY`](../../PROVIDER-MATURITY-CERTIFICATION-PARTNERSHIPS.md)).
5. **Reversible protection first.** Take the least severe action that stops harm, then review.
6. **A human decides consequential outcomes, and a different human decides appeals.**
7. **Capacity gates exposure.** A surface opens only when the queue it creates can be reviewed inside its targets.

## The three marketplace phases

| Phase | What is live | What is not | Entry gate (all required) | Exit or rollback |
| --- | --- | --- | --- | --- |
| **0 · Directory** | Curated listings of resources and opportunities; disclosure labels; no transactions; no student data to providers; the sponsorship gate stays separate | Payments, orders, ratings that affect ranking | Listing and provider policy approved; provider verification process exercised on two providers; report-and-takedown path working; T&S queue read daily at SL1; counsel reviewed terms and disclosures | Remove any listing in one business day; kill switch for the directory |
| **1 · Provider-fulfilled commerce, provider-hosted payment** | Order intent recorded; the provider's hosted checkout takes the money; the provider fulfils; Semester records the entitlement and mediates disputes | Semester holding funds, issuing payouts, acting as merchant | Everything in phase 0 at SL2; consumer-protection, refund, terms, tax and insurance review by qualified counsel and advisors; dispute process exercised on two mock disputes; fraud controls defined; staffed dispute and T&S capacity at Stage 2 | Suspend a provider or the phase in one business day; refund paths remain with the provider and payment provider |
| **2 · Semester-facilitated payments** | Only after a *new owner decision* superseding D-146 for this purpose | Not before Stage 3 | Counsel analysis of payment-facilitation, money-transmission, consumer, tax and sanctions obligations; a payment partner that carries the regulated functions; the account-ledger controls extended and reconciled monthly; chargeback process exercised; insurance; board or advisor review | Return to phase 1 by decision; funds held are returned per counsel |

Promotion between phases is a Class 1 decision ([M-07](03-raci-and-decision-rights.md#trust-marketplace-and-partners)). The marketplace phase is displayed on the activation register and the public claims register; nothing is advertised beyond the phase in force.

## Marketplace operations

### Provider lifecycle

```
Apply → Verify → Review → Approve → List → Monitor → (Warn | Restrict | Suspend | Remove) → Offboard
```

| Step | Work | Owner seat | Target (SL0) |
| --- | --- | --- | --- |
| **Apply** | Provider submits the application ([TPL-16](templates.md#tpl-16-provider-application-and-listing-review)): entity, owners, offering, audience, price, claims, data needs, accessibility, insurance | `trust` | n/a |
| **Verify** | Identity and business verification, sanctions and adverse-media screening through the approved route; beneficial owners; for M3 tiers, background checks as counsel permits | `trust`, `security` | Part of the 10-day decision |
| **Review** | Policy fit; substantiation of every claim; privacy and data terms; accessibility of the offering; security posture if data flows; conflicts | `trust`, `privacy`, `accessibility` | Part of the 10-day decision |
| **Approve** | Decision with conditions; listing scope; review date | `trust` (A) | 10 business days from a complete application ([SL-MKT-01](04-support-operating-model.md#delivery-success-trust-and-partners)) |
| **List** | Listing published with disclosure labels, price transparency, how to report | `trust` | Listing report reviewed within 2 business days |
| **Monitor** | Complaint rate, dispute rate, fulfilment rate, claim accuracy, accessibility reports; periodic re-verification | `trust` | M1 annually, M2 and M3 every six months |
| **Action** | Warn, restrict, suspend or remove, with a reason code and notice | `trust` | Suspension in one business day when harm is credible |
| **Offboard** | Open orders honoured or refunded; data returned or deleted; listing removed; claims withdrawn | `trust`, `operations` | Per the agreement |

### Provider risk tiers

| Tier | Test | Examples | Verification |
| --- | --- | --- | --- |
| **M1** | Informational, no student contact beyond a link | Resource directories, campus-adjacent information | Entity check, claims review, accessibility check |
| **M2** | Services to students for a fee or with data exchange | Tutoring, test preparation, career coaching, software | M1 plus identity verification, terms, privacy review, insurance where relevant |
| **M3** | Minors, safety-sensitive, health-adjacent, financial, housing, or any in-person service | Counselling-adjacent services, financial products, housing, background-checked roles | M2 plus enhanced screening, counsel review of the category, a named safety owner at the provider, a Semester-side risk acceptance by the founder and counsel advice. Some M3 categories are simply declined. |

### Listing standards

A listing states what is sold, to whom, the price and all fees, what is not guaranteed, how to get help, how to report, and any relationship between the provider and Semester or the school. It does not promise outcomes (grades, jobs, admission), use pressure or scarcity tactics, or gate access to essentials. It is accessible. Sponsored placement is labelled, comes only through the sponsorship gate, and never reads anything about a student ([ethical engagement policy](../../ETHICAL-ENGAGEMENT-AND-NOTIFICATIONS.md); [do-not-build rule 10](../../DO-NOT-BUILD.md)).

### Controls institutions and students hold

An institution can allow or deny categories or providers for its tenant. A student can hide a provider or category and sees why anything was shown. Any institution-specific list is a tenant configuration change.

## Fulfillment operations (phase 1 and later)

### Order states

```
Intent → Provider confirmed → Fulfilled → Completed
                 ↘ Cancelled     ↘ Disputed → Resolved (refund | partial | replace | no action) → Closed
```

| State | Owner | Clock |
| --- | --- | --- |
| Intent | Student | Provider confirms or declines within the listing's stated window; a silence past it cancels the intent and notifies the student |
| Provider confirmed | Provider | Provider fulfils inside the promised window; Semester monitors the non-fulfilment rate |
| Fulfilled | Provider | Student confirms, or the window closes |
| Disputed | Semester mediation | [SL-MKT-02](04-support-operating-model.md#delivery-success-trust-and-partners) |

Semester records the entitlement and the state. It does not hold funds in phases 0 and 1.

### Fulfilment models

| Model | Description | Semester's role |
| --- | --- | --- |
| A · Referral | The provider's own site does everything | Directory only |
| B · Provider-fulfilled | The provider delivers and takes payment on its hosted checkout | Records intent and entitlement; mediates |
| C · Product entitlement | A Semester product the student buys through the existing hosted checkout (for example Plus) | Semester's own commercial process; support follows the FIN taxonomy; not marketplace |

## Dispute operations

### Types and routing

| Type | Examples | Route |
| --- | --- | --- |
| Not delivered or late | No fulfilment inside the window | Dispute queue |
| Not as described | Listing claim false | Dispute queue; claims review of the provider |
| Quality | Service poor | Dispute queue |
| Safety or conduct | Harassment, unsafe behaviour, a minor involved | **Not a dispute**: trust and safety case, priority P0 or P1; the dispute waits |
| Unauthorized charge | Student did not buy | Payment provider process; support case FIN; fraud review |
| Accessibility failure | Offering inaccessible | Accessibility barrier route; provider remedy plan |
| Privacy complaint | Data misuse | PRV route; counsel |
| Provider claim against a student | Abuse, fraud | Trust and safety |

### Lifecycle and rules

```
Open → Request evidence (both sides, 3 business days) → Assess → Decide → Notify → Appeal (once) → Close
```

1. **Acknowledge** within one business day; **decide** within ten business days of complete evidence (SL0).
2. **Evidence is minimal and redacted.** No unnecessary personal data; screenshots only with consent; retention follows the privacy schedule.
3. **Decision outcomes:** full refund, partial refund, replacement or redo, no action, or a provider sanction. The money outcome is executed by the provider and its payment provider in phases 0 and 1; Semester records the decision and verifies completion.
4. **Reason codes** are recorded for every decision; guidelines are written and versioned so like cases get like outcomes.
5. **Appeal once**, decided by a different reviewer within five business days.
6. **Finance owns** non-safety outcomes ([M-03](03-raci-and-decision-rights.md#trust-marketplace-and-partners)); trust owns safety outcomes ([M-04](03-raci-and-decision-rights.md#trust-marketplace-and-partners)); a safety question always takes precedence.
7. **Fraud signals** feed provider monitoring: repeated disputes, high refund share, new-provider spike, mismatched identity.

### Provider consequences and thresholds

These are SL0 thresholds to start from and tune with measurement. Payment-network and payment-provider rules govern chargebacks and are checked with counsel and the provider.

| Signal (trailing 30 days, orders at least 20) | Action |
| --- | --- |
| Dispute rate over 2% | Review; written plan |
| Dispute rate over 5%, or any credible safety finding | Suspend pending review |
| Non-fulfilment rate over 3% | Warn; verify capacity |
| A false claim | Remove the claim; restrict until corrected |
| Evasion of a suspension or a second serious finding | Remove and bar; counsel on notice to affected students |

### Financial operations (phase 2 only)

If and when phase 2 is decided: provider onboarding with a payment partner that handles identity and payout; ledger entries for every movement; holds and reserves policy; monthly reconciliation and close with a second reviewer; refund and chargeback handling; the controls of [D-146](../../DECISION-LOG.md) extended and re-tested. This is **not designed in detail here** because it requires the new decision and counsel analysis first.

## Partner operations

### Types

| Type | Role | Tier in provider maturity |
| --- | --- | --- |
| **Integration or provider partner** | Connectors to SIS, LMS, identity, calendar, campus services | `planned · manual · read_only · incremental · event_driven · authorized_writeback`, one value per provider |
| **Implementation consultant** | Scoped configuration and customer coordination | Approved scope; least privilege; cannot enable unavailable capability |
| **Channel or referral** | Introductions | Only after the direct motion is repeatable (strategy page) |
| **Content or curriculum partner** | Licensed materials | Rights and attribution reviewed |
| **Student ambassador** | Peer demonstration | Training; conduct; non-official role; no incentive tied to data or sign-ups |
| **Association or event partner** | Education and introductions | No implied endorsement |

### Lifecycle

```
Identify → Evaluate → Approve a bounded pilot → Onboard → Operate → Review → (Expand | Hold | Exit) → Offboard
```

| Step | Work | Output |
| --- | --- | --- |
| **Evaluate** | The criteria in the strategy page: entity and owners, purpose, audience, capabilities, financial and conflict terms, data and system access, security, privacy and accessibility, sanctions and ethics, subcontractors, insurance, operational capacity, claims and brand rights, incident and support, audit, termination | Evaluation record |
| **Approve** | A limited pilot with an owner, success measures, guardrails, expiry and offboarding; counsel reviews the agreement | Agreement; pilot charter |
| **Onboard** | Scoped access; training on claims and conduct; a named technical and commercial contact at the partner | Access list; certificate |
| **Operate** | Monthly check-in; incident and support intake; claims monitoring | [TPL-19](templates.md#tpl-19-partner-scorecard) scorecard |
| **Review** | Quarterly: delivery, harm, customer feedback, compliance; decide to expand, hold or exit | Decision record |
| **Offboard** | Revoke access, assets and claims; notify affected customers; return or delete data | Offboarding record |

### Partner scorecard

| Dimension | What it measures | Green | Red |
| --- | --- | --- | --- |
| Delivery | Quality and timeliness against scope | Meets scope | Missed commitments |
| Customer outcome | Customer feedback and measured results | Positive, with evidence | Complaints or harm |
| Compliance | Contract, privacy, security, accessibility | No findings | Open material finding |
| Claims discipline | Use of Semester's name and claims | Only approved claims | Unapproved claim or implied endorsement |
| Responsiveness | Technical escalation acknowledgement ([SL-PAR-01](04-support-operating-model.md#delivery-success-trust-and-partners)) | Inside target | Repeated misses |
| Security posture | Assurance, incidents | Current and clean | Expired or breach |
| Commercial | Terms honoured; no conflict | Clean | Dispute |

Discounts and commissions never buy a customer claim, a favourable research result or a compromise on safety or accessibility. A partner cannot give consent on a person's behalf for unrelated marketing.

## Trust and safety operations

### Scope and boundary

T&S handles reports about community content and conduct, marketplace providers and listings, impersonation, minors, and misuse of AI features. It is **not** a crisis service and does not claim to be: imminent-harm reports show the crisis notice at once and route per the [crisis runbook](../../CRISIS-RESPONSE-RUNBOOK.md) and the school's verified crisis contact. Academic-integrity reports route to the institution's process. T&S does not surveil: it acts on reports and defined automated signals, not on browsing private content.

### The case workflow

The built workflow ([`CAMPUS-MODERATION-SOP`](../../CAMPUS-MODERATION-SOP.md)) is the operating backbone:

1. A report or automated signal arrives; a frozen audit event opens the case.
2. Triage sets a provisional priority from the SOP's categories (P0 doxxing and non-consensual media; P1 threats, hate, stalking; P2 harassment, impersonation, scams; P3 other, raised for self-harm or a minor).
3. The **minimum reversible protection** is applied.
4. A qualified human reviews and decides with a policy reason code.
5. The person gets a notice.
6. An appeal goes to a **different professional**.
7. The retention date is set (90 days after a no-action close; a year after enforcement or appeal) and the daily sweep deletes after it.

### Operating rules

| Rule | Detail |
| --- | --- |
| Intake | In-product report with context; support-sourced; partner-sourced; automated signals; every route opens the same case |
| Evidence | Preserved with hashes; minimum necessary; never shared outside the case roles |
| Minors | Age-aware handling; guardian involvement as policy and counsel direct; stricter defaults |
| Repeat conduct | A documented ladder: reminder, warning, restriction, suspension, removal; any step may be skipped for severity |
| Law-enforcement and legal requests | Counsel only; logged; nothing disclosed on an agent's authority |
| Takedowns | Copyright and similar notices follow the takedown policy draft; counsel owns the process |
| Transparency | Quarterly aggregate report: reports received, actions, appeals, overturn rate; cells under ten suppressed |
| Moderator wellbeing | Exposure limits, rotation, opt-out of categories, access to support; certified before queue access |
| Calibration | Blind control items mixed with real cases for volunteers; recalibration on drift; a volunteer whose quality drops is sent back to calibration |
| Quality | A sample of decisions reviewed by a second person each month; appeal-overturn rate watched (SL0 watch level: over 15% prompts guideline review) |

### Capacity gate

A community or marketplace surface opens only when its report volume can be reviewed inside [SL-TS-01 and SL-TS-02](04-support-operating-model.md#delivery-success-trust-and-partners) by trained people. At Stage 0 the answer is **report-and-refer**: reports are read, harms are referred through the school's route, and no open community scale is offered. The volunteer program stays off and refuses production until the owner switches it on with trained reviewers.

## Measures

| Measure | Definition | Watch (SL0) |
| --- | --- | --- |
| Provider decision time | Complete application to decision | 10 business days |
| Listing complaint rate | Complaints per 100 listings per month | Measured |
| Dispute rate | Disputes ÷ orders, per provider | Over 2% reviews; over 5% suspends |
| Non-fulfilment rate | Orders unfulfilled in window ÷ orders | Over 3% warns |
| Dispute decision time | Complete evidence to decision | 10 business days |
| Report time to triage | Report to provisional priority | Per [SL-TS-01](04-support-operating-model.md#delivery-success-trust-and-partners) |
| Appeal overturn rate | Appeals reversed ÷ appeals decided | Over 15% reviews guidelines |
| Partner scorecard greens | Dimensions green ÷ dimensions | Under 70% prompts review |

Dashboards: [09 D7](09-dashboards-and-indicators.md#d7-trust-marketplace-and-partners).

## Items requiring qualified human counsel review

Provider and student terms for purchases; refund and cancellation obligations; consumer-protection obligations; tax collection and reporting; payment facilitation, money transmission and sanctions screening (phase 2); background-check rules for in-person or minor-facing roles; minors, child-protection and consent; advertising and sponsorship disclosure; copyright and takedown handling; law-enforcement requests; data sharing with providers; accessibility obligations of providers; insurance and indemnity; moderator employment and wellbeing obligations. These go to the [legal review queue](../../../LEGAL-REVIEW-QUEUE.md).

## Related

[Service blueprints 5 and 6](service-blueprints.md) · [Handoffs H-10, H-16](handoffs.md) · [Templates TPL-16 to TPL-19](templates.md) · [04 Taxonomy MKT and SAF](04-support-operating-model.md#case-taxonomy)
