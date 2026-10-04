# Pricing, packaging, entitlements, billing and collections

| Control | Value |
| --- | --- |
| Status | **DRAFT PLANNING MODEL OF HYPOTHESES FOR FOUNDER DECISION — NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR TARGET** |
| Owner | Harrison Rubin — finance owner; qualified accountant, tax adviser and counsel unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` |
| Source | Extends [`../commercial/PRICING-AND-PACKAGING.md`](../commercial/PRICING-AND-PACKAGING.md) and [`../COMMERCIAL-CORE.md`](../COMMERCIAL-CORE.md); numbers from [`semester-financial-model.xlsx`](semester-financial-model.xlsx) |
| Price status | **Only two prices are facts (Plus $7.99 a month, $59 a year; D-134). Every other price below is PROPOSED for founder approval. No price book is approved and none may be quoted.** |

> This document organizes planning assumptions and questions for the founder and for qualified professionals. It is not accounting, tax, legal, insurance or investment advice, and it states no legal, tax or accounting conclusion. Every item marked **[REQUIRES QUALIFIED REVIEW]** needs the named professional before anyone relies on it.

## 1. Package ladder

One platform, packaged for each buyer. Every price except Plus is a proposal that the model uses for planning; the existing pricing document keeps its placeholders until the founder approves a price book by dated decision.

| Package | Buyer | Price (proposed) | What it includes | Metered on | Entitlement key | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **Free** | Student | $0 | Core planning (Today, calendar, tasks, notes), limited AI, offline basics. **Accessibility, safety, data export and deletion are never gated.** | AI: 8 tasks a month, soft cap | `plan.free` | A free package exists in the pricing document with price and limits still to be approved; the limits shown are PROPOSED |
| **Plus** | Student | $7.99 a month or $59 a year | Full productivity suite, offline editing, higher AI allowance (40 tasks a month, hard cap) | AI tasks, storage | `plan.plus` | **Fact (D-134)** |
| **Plus AI add-on** | Student | +$4.99 a month | 150 AI tasks a month, hard cap, no overage billing | AI tasks | `addon.ai_plus` | PROPOSED |
| **Family companion** | Guardian | [TO BE APPROVED] | Consented, age-aware visibility and billing access for a guardian seat | Guardian seats | `addon.family` | Not modeled; needs counsel on minors and consent (Q-25) |
| **Pilot** | Institution | $12,000 for 26 weeks + $15,000 implementation | One cohort of about 125 students, one workflow, weekly reporting, offboarding | Active students, connectors | `tenant.pilot` | 26 weeks is fact (D-134); price PROPOSED. A no-fee design-partner option stays available by CEO and CFO decision |
| **Department / program** | Dean, department head, student-success lead | $35,000 platform + $10 per active student a year (about $50,000 at 1,500 students) + $40,000 implementation | Native student OS for the department; SSO; standard connectors; support tier 2 | Active-student band, AI allowance, connectors, sandbox | `tenant.dept` | PROPOSED |
| **Institution** | CIO, provost, registrar | $90,000 platform + $11 per active student a year (about $145,000 at 5,000 students) + $120,000 implementation | Institution-wide tenant, SCIM, policy engine, configuration studio, reporting, premium support option | Active-student band, AI allowance, connectors, sandboxes, data region | `tenant.institution` | PROPOSED |
| **AI credit packs** | Institution | $2.50 per attaching student a year (modeled) | Higher monthly AI allowance for opted-in students | AI tasks per tenant, budget cap | `addon.ai_credits` | PROPOSED |
| **Alumni module** | Alumni and advancement | $15,000 a year per institution | Lifelong profile, network, mentoring, opportunities; institution-sponsored | Alumni profiles | `addon.alumni` | PROPOSED; no sale of alumni personal data |
| **Employer partner** | Employer | $3,600 a year | Verified employer profile, postings, consented candidate access | Postings, candidate views | `partner.employer` | PROPOSED; counsel on discrimination and consent (Q-29) |
| **Marketplace** | Provider | 15% take rate on orders | Listing, checkout, entitlement, dispute workflow | GMV, disputes | `partner.provider` | PROPOSED; launch is gated (Q-26, Q-28) |

Entitlement keys are proposed names, to be reconciled with the existing `plan_entitlements` vocabulary before use. Implementation, integration, training and migration are priced as fixed-scope packages plus change orders, never as open-ended hours, and each is described in an order form before work begins.

## 2. Value metrics considered

| Metric | Strength | Risk | Decision |
| --- | --- | --- | --- |
| Platform fee per tenant | Predictable; funds fixed customer-success and integration cost | Hard for a small department to justify | Used, as the base of every tier |
| Per active student per year | Scales with value and with cost to serve; aligns with how institutions budget (per FTE) | 'Active' must be defined, measured and disputed-proof | Used, with bands set at signing and a true-up at renewal |
| Per enrolled student | Easy to count | Charges for students who never use it; invites price pushback | Rejected as the primary metric |
| Per module | Lets departments buy what they need | Fragments the product the audit says must work as one | Used only for add-ons (alumni, AI credits) |
| Usage (AI tasks) | Passes cost through | Bill shock; erodes trust | Used as an allowance and a cap, never as surprise billing |
| Outcome-based | Attractive to buyers | Cannot be measured or attributed yet; claims need evidence | Not used; revisit after pilot evidence |

'Active student' for pricing means a student with at least one meaningful action in the term. The definition goes in the order form, is computed from the same events as the activation measure in the metrics dictionary, and is reviewed with the customer at renewal.

## 3. Entitlement architecture

The commercial core already separates four ideas: plan, subscription, entitlement and authorization. A subscription grants entitlements and never grants authorization; no policy on student data reads a commercial table. The packages above map onto that model without changing it:

| Layer | Existing structure | What the SKUs add |
| --- | --- | --- |
| Plan and price | `commercial_plans`, `commercial_prices` | One row per package and interval; Plus rows already carry $7.99 and $59 |
| Plan entitlements | `plan_entitlements` | Keys in section 1, plus meter caps (below) |
| Subscription entitlements | `subscription_entitlements`, `my_entitlements()` | Set when the provider confirms payment or when an order is closed-won |
| Tenant entitlements | Institution orders create subscriptions on the institution's billing account, so the same two tables carry them. The audit's proposed tenant `feature_entitlements` field is not in the current schema | Set when an institutional order is provisioned; add a tenant-level field only if tenant overrides are needed; changes need the approval case in the audit's authorization model |
| Authorization | RLS and capability checks | Unchanged: an entitlement never widens access to data |

### Meters and caps

| Meter | Unit | Student behavior at the cap | Institution behavior at the cap | Cost it protects |
| --- | --- | --- | --- | --- |
| AI tasks | tasks per user per month | Hard cap; clear message; queue or fallback to a smaller model; never a bill | Alert at 80% of the tenant allowance; hard cap at 100%; extra capacity only by an approved credit pack | AI inference ($0.0146 per task at list prices) |
| Storage | GB per user | Warn at 80%; block new uploads at 100%; existing files and export stay available | Pooled per tenant; alert; add storage by order | Object storage and backups |
| Messages (SMS) | messages per month | Email and push first; SMS only for safety and security | Tenant budget; alert | Per-message carrier cost |
| Active students | students per term | n/a | Band set at signing; true-up at renewal; no mid-term overage | Revenue leakage |
| Connectors and sandboxes | count | n/a | Included count by tier; extras by order | Connector run cost and support |
| Data region | region | n/a | Set at provisioning; changes are a project | Duplicate infrastructure |

### Entitlement states

```
provisioned ──► active ──► grace (payment late or term ended; paid features keep working 14 days)
                              └──► restricted (paid features off; free core, export, deletion, safety and accessibility stay on)
                                       └──► ended (data retained per policy; reactivation restores)
```

Rules: entitlements are provisioned only from a closed order or a confirmed payment event; every change writes an audit event; the nightly reconciliation (document 08) compares entitlements to paid orders and usage to caps, and any difference opens a leakage case.

## 4. Discounts, floors and approvals

Discount authority is only safe if it stops at a floor Finance can compute. The floor below keeps deal-level subscription gross margin at or above 55% after variable cost to serve, connector run cost and customer-success cost (one CSM per $1M of ARR is 13.8% of price).

Variable cost to serve one active institutional student is about **$0.45 a month ($5.46 a year)**: platform $0.21, AI allowance 12 tasks × $0.0146, support $0.068.

| Tier | List ACV at land | Active students | Annual variable and connector cost | Price floor | Maximum discount at the floor |
| --- | ---: | ---: | ---: | ---: | ---: |
| Department | $50,000 | 1,500 | $12,386 | $39,700 | 21% |
| Institution | $145,000 | 5,000 | $31,488 | $100,924 | 30% |

Authority (full matrix in document 05): account executive up to 10%; Head of Sales up to 20% provided Finance confirms the floor; CEO and CFO up to 30%; anything beyond 30%, below the floor, or a multi-year price lock also needs the board. The floors show why those limits are where they are: past roughly 20% on a Department deal, and 30% on an Institution deal, the deal stops covering its own cost to serve.

Implementation floors (20% margin, delivered hours at $89 each):

| Implementation | Proposed fee | Delivery cost | Margin at list | Floor |
| --- | ---: | ---: | ---: | ---: |
| Pilot | $15,000 | $10,629 | 29% | $13,286 |
| Department | $40,000 | $26,571 | 34% | $33,214 |
| Institution | $120,000 | $75,286 | 37% | $94,107 |

A pilot is priced at $27,000 in total against about $13,070 of delivery and run cost, a 52% margin before sales, support and trust-review cost, which the model books elsewhere; it is not a profit centre. A no-fee design partner is a CEO and CFO decision with a named strategic reason, a cap on how many are open at once, and a conversion plan; it is never a default.

Rules that never bend: never discount away security, privacy, accessibility, rights, support or clean-exit work; every discount has a recorded reason, an expiry and something in return (term, reference, case study with consent, volume); discounts are visible in the CRM and reported monthly.

## 5. Free tier, trials, sponsorship and pricing experiments

- **Free is real.** It is the first-use path and the adoption channel; it carries cost (about $0.42 per active user per month in the model), so its AI allowance is the lever, not its existence.
- **Institution-sponsored seats.** The institution pays; the student sees Plus features while sponsored; when sponsorship ends the student keeps their data and drops to Free with notice. The student is never billed by surprise.
- **Trials.** Any trial states the price, the renewal date and the cancellation path before payment details are taken, with consent recorded. Whether the proposed 14-day refund window and trial design satisfy auto-renewal and consumer rules is a counsel question (Q-24).
- **Price experiments.** Only on new cohorts, disclosed in terms, with a hypothesis, a guardrail (no price that varies by a sensitive attribute or by inferred financial stress), a stop condition, and CEO and CFO approval. No dark patterns.

## 6. Billing and collections design

| Item | Design | Control |
| --- | --- | --- |
| Student subscriptions | Web checkout through the payment processor; app-store billing where the platform requires it; monthly and annual | Consent text and version stored; renewal reminder before annual renewal; cancel in the product |
| Pilot | Software fee invoiced at go-live; implementation 50% at signing, 50% at go-live | Order form and PO matched to invoice |
| Department / Institution | Annual in advance, invoiced at go-live and on each anniversary; implementation as above | Renewal order, not silent auto-renewal, for public customers |
| AI credit packs, alumni, employer | Prepaid annually; employer by card or ACH | Credits expire only as the order says; breakage question is for the accountant (Q-05) |
| Payment terms | Net 45 default; net 60 with CFO approval | Collections profile in the model: 5% / 25% / 40% / 25% / 5% over months 0-4 |
| Collections cadence | Day 0 invoice; day 30 reminder; day 45 call to accounts payable; day 60 executive sponsor; day 75 pause new work if the contract allows; day 90 escalation to the CFO | Aging report in the monthly pack; DSO tracked quarterly |
| Credits and refunds | Credit memo with reason code; approval per the matrix; student refunds follow the stated policy and store rules | Refund register reconciled monthly |
| Usage true-up | Active students counted at term end; band steps at renewal | Count approved by the customer sponsor |
| Dunning (students) | Existing flow: past-due, notice, retries, 14-day grace, paid features keep working | Defined in the commercial core; export and deletion never blocked |

Revenue recognition, tax treatment of each line, marketplace gross-versus-net presentation and consumer auto-renewal compliance are all **[REQUIRES QUALIFIED REVIEW]**; document 06 lists the 40 questions with the facts to bring and the right professional for each.

## 7. Entitlement and billing leakage detection

| Leak | Detection | Frequency | Owner |
| --- | --- | --- | --- |
| Entitlement without a paid order | Join active entitlements to open orders and subscriptions | Nightly; weekly review | Finance + RevOps |
| Paid order without entitlement | Join paid invoices to entitlements | Nightly | RevOps |
| Usage above cap or band | Meter vs entitlement | Daily; monthly report | CS + Finance |
| Expired credits still honored | Credit ledger vs entitlement | Monthly | Finance |
| Sponsored seats after sponsorship ends | Sponsorship end dates vs seat state | Weekly | RevOps |
| Duplicate or shared accounts, coupon abuse | Device and code analytics under privacy rules | Monthly | Trust and safety |
| Discounts beyond authority | Quote approval trail vs signed order | Monthly | Finance |

## Cannot be completed from source code

Price approval, willingness-to-pay evidence, payment-processor and app-store configuration, tax settings and counsel-approved terms require the founder, customers and qualified professionals.
