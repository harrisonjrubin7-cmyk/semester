# Pricing and Packaging (model inputs, not a price book)

| Control | Value |
| --- | --- |
| Status | **DRAFT MODEL-INPUT DOCUMENT - PLANNING ASSUMPTIONS ONLY - NOT APPROVED PRICES - NOT A QUOTE** |
| Owner | Harrison Rubin (interim; backup unassigned). Finance approver, tax adviser, accountant, counsel: unassigned |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [DECISION OPEN] [REVIEW: tax] [REVIEW: accounting] [REVIEW: counsel] [REVIEW: procurement] |
| Audience | Internal. Do not send any number in this file to a prospect or publish it. |

> **PLANNING ASSUMPTIONS ONLY. NOT APPROVED PRICES.** Every figure below is a model input supplied by the founder's brief or taken from a repository draft. Price, discount, savings, paid-plan availability and refund/renewal terms are claim **CLM-015: PROHIBITED / `[PRICE TO BE CONFIRMED]`** in [`../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md). No price book exists. [VERIFIED]

> This is an operating document, not legal, tax, accounting or insurance advice.

**Label legend.** [VERIFIED] proven by a repository path. [ASSUMPTION] planning number. [DRAFT] needs review. [INTERNAL] not for customers. [DECISION OPEN] the founder decides and records `D-<pull request number>`. [APPROVED] count: zero. Examples with enrolments are ILLUSTRATIVE and are not real institutions or forecasts.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document |
| --- | --- | --- | --- |
| [`../../commercial/PRICING-AND-PACKAGING.md`](../../commercial/PRICING-AND-PACKAGING.md) | Controlled price status table (all placeholders), packaging logic, quote and discount controls, claim ceiling | The user's planning assumptions as labelled inputs; conflict tables; formulas and worked examples; intake checklist; model mapping | Controlled doc intentionally holds no numbers; it is not edited |
| [`../../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md`](../../commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md) (700 lines) | Nine-buyer SKU catalog, package ladder (Start/Operate/Replace), AI as dollar-weighted allowance, cost floors per tier, discount and contracting rules, owner decisions | Used as the cost cross-check (section 4.3) and as the source of the ladder; not restated | Architecture and floors already there |
| [`../../finance/02-PRICING-PACKAGING-ENTITLEMENTS.md`](../../finance/02-PRICING-PACKAGING-ENTITLEMENTS.md), [`../../finance/assumption-register.md`](../../finance/assumption-register.md) | Proposed prices used by the xlsx model (Pilot $12,000 + $15,000; Department; Institution; AI credit packs; marketplace 15%) | Reconciliation of the user's inputs against them (section 3) | Model rows differ from the user's set |
| `docs/DECISION-LOG.md` D-134, [`../../decisions/D-1154.md`](../../decisions/D-1154.md) | Plus $7.99/$59 and 26-week pilots; then $15/month, institution prices "match LMS vendors", no number | Conflict table | Decisions conflict; none supersedes cleanly |
| [`../../../app/src/lib/governance/deal-desk.ts`](../../../app/src/lib/governance/deal-desk.ts), [`../../operating-model/COMMERCIAL-GOVERNANCE.md`](../../operating-model/COMMERCIAL-GOVERNANCE.md) | Discount ladder, tier minimum ACVs, pilot credit cap, implementation fee floor | Checks of the user's `$30,000` minimum against `DEAL_POLICY` | Code is authority |
| [`../../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`](../../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md), [`../../commercial/ORDERING-AND-BILLING-OPERATIONS.md`](../../commercial/ORDERING-AND-BILLING-OPERATIONS.md) | Accounting fact checklist; quote-to-cash | Review items specific to these assumptions | Linked |

## Gate (what is allowed now versus held)

Source: [`../../../GO-NO-GO-DECISION.md`](../../../GO-NO-GO-DECISION.md). [VERIFIED]

| Allowed NOW | HELD until the named gate flips |
| --- | --- |
| Use these inputs inside the internal finance model and sensitivity work; discuss packaging hypotheses with design-partner prospects without numbers; prepare quote shells with `[PLACEHOLDER]` | Quoting, order form, invoice, payment, publishing any price; the paid institutional pilot (NO-GO/RED); individual paid acquisition (billing is closed by a code-level hold; D-1154); selling premium support (staffed support not evidenced, GO-NO-GO priority 6); marketplace commission (gated) |

## 1. Planning assumptions supplied by the founder [ASSUMPTION]

All rows are **[ASSUMPTION]** and **[DECISION OPEN]**. Source column: "brief" is the user's planning input (not evidence).

| # | Input | Planning value | Unit | Source | Notes |
| --- | --- | --- | --- | --- | --- |
| P1 | Student Premium, monthly | $8.99 | per month | brief | Conflicts with D-134 and D-1154 (section 3.1) |
| P2 | Student Premium, annual | $69 | per year | brief | Equivalent to $5.75 per month |
| P3 | Institutional platform fee | $18 | per enrolled student per year | brief | Unit is **enrolled**; the finance model prices per **active** student |
| P4 | Annual platform minimum | $30,000 | per institution per year | brief | |
| P5 | Institutional AI included pool | 2,400 | governed requests per enrolled student per year | brief | = 200 per month planning average; pooled across the institution |
| P6 | AI overage | $30 | per 1,000 requests beyond the pool | brief | = $0.03 per request |
| P7 | Implementation fee | $35,000 to $150,000 | one-time | brief | Driven by integrations, migration, security review, tenant configuration, training, onboarding, rollout, support complexity |
| P8 | Premium support | 15% of annual platform fee, minimum $15,000 | per year | brief | Not sellable until staffed support is evidenced |
| P9 | Partner / marketplace commission | 12% | of partner order value (basis undefined) | brief | Modelled separately; the core business must be viable without it |

Definitions needed before any use [DECISION OPEN]: "enrolled student" (headcount at census date? FTE?); "governed request" (one model call? a dollar-weighted unit? see 4.3); "pooled" (unused capacity does not carry over?); true-up and audit rights for enrolment counts.

## 2. Status of price facts in the repository [VERIFIED]

- No approved price book exists. `docs/commercial/PRICING-AND-PACKAGING.md`: "Any price embedded in code, tests, a mock page, historic decision or planning document is not the approved current price book."
- `DEAL_POLICY` numbers are "proposed defaults, not a price book" (header of `deal-desk.ts`).
- Billing is closed by a code-level hold; nothing is charged at any price (D-1154 item 1).

## 3. Conflict tables [DECISION OPEN]

### 3.1 Individual student price

| Source | Monthly | Yearly | Status of the source |
| --- | --- | --- | --- |
| D-134 (`docs/DECISION-LOG.md`, 2026-09-29) and migration `supabase/migrations/20260929131000_plus_price.sql` | $7.99 (Plus) | $59 | Owner decision; catalog and pricing page still print it; billing held [VERIFIED] |
| D-1154 (2026-10-04) | $15 | not stated | Owner decision replacing D-134; catalog, pricing page and `plans.test.ts` not yet changed; which plan carries $15 undecided [VERIFIED] |
| Code and catalog (`app/src/lib/membership.ts`, `app/src/lib/billing/*`, `commercial_prices`) | $7.99 | $59 | Implementation state, not an approved price [VERIFIED by grep of D-134 strings in `app/src`] |
| `docs/commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md` | Plus $7.99; Pro $14.99 (proposed) | Plus $59; Pro $99 | Proposal; owner question 1 asks whether these are the price book |
| `docs/finance/02-PRICING-PACKAGING-ENTITLEMENTS.md`, `assumption-register.md` A-011/A-012 | $7.99 | $59 | Model input labelled FACT (before D-1154) |
| User's brief | $8.99 | $69 | Planning assumption |
| **Authoritative today** | **None approved.** | **None approved.** | CLM-015 PROHIBITED |

**Decision needed:** founder selects the individual price book (monthly, yearly, which plan), supersedes D-134 or D-1154 explicitly, and the lead reconciles catalog, pricing page and tests in one change. Until then the finance model carries all four as scenarios.

### 3.2 Pilot length

| Source | Value |
| --- | --- |
| `PILOT_WEEKS = 26` (`app/src/lib/gtm/pilot.ts`); D-134; `docs/PAID-PILOT-FRAMEWORK.md`; finance A-025 | 26 weeks, exactly 182 days; `pilotReadiness` fails other lengths [VERIFIED] |
| `DEAL_POLICY.maxPilotMonths` | 6 months maximum [VERIFIED] |
| User's brief | One academic term or 8-12 weeks [ASSUMPTION] |
| **Authoritative today** | **26 weeks (code-enforced); the 8-12 week reading is unadopted.** Decision needed: keep 26, change `PILOT_WEEKS` by dated decision, or define a shorter sprint. See [`../customer-success/ONBOARDING_WORKFLOW.md`](../customer-success/ONBOARDING_WORKFLOW.md) section 1.2. |

### 3.3 Institutional price and structure

| Item | Repository (source) | User's brief | Authoritative today |
| --- | --- | --- | --- |
| Number and unit | D-1154 item 2: match Blackboard, Canvas and comparable systems; "No number is set"; unit (enrolled, active, sponsored seat, platform fee) "stays open" | $18 per enrolled student per year | None |
| Pilot | finance 02/A-026/A-028: $12,000 software + $15,000 implementation, 125 students (PROPOSED) | n/a (pilot fee not specified) | None |
| Department | finance A-034/A-036/A-037: $35,000 + $10 per **active** student + $40,000 implementation (PROPOSED) | n/a | None |
| Institution | finance A-044/A-046/A-047: $90,000 + $11 per **active** student + $120,000 implementation (PROPOSED) | $18 per **enrolled**, $30,000 minimum | None |
| Minimum ACV | `DEAL_POLICY.minimumAcvCents`: pilot $15,000; department $25,000; campus $75,000; system $200,000 (proposed defaults) | $30,000 | None |
| Implementation | finance $15,000 / $40,000 / $120,000; `implementationFeeFloorCents` $10,000; architecture doc: replace floor with per-tier floor from measured hours | $35,000-$150,000 | None |
| AI included | finance A-078: 12 AI tasks per active student per month (144 per year) | 2,400 requests per enrolled student per year (200 per month) | None; the brief's pool is about 16.7 times the model's |
| AI overage | Open (architecture doc owner question 6) | $30 per 1,000 | None |
| Premium support | "premium support option" named in the Institution package; no percentage | 15%, minimum $15,000 | None |
| Marketplace / partner commission | finance A-097: 15% take rate; gated | 12% | None |
| Cost floors | Architecture doc 5.3: e.g. campus, 10,000 enrolled, 40% active, 60% target gross margin: base-case floor about $286,570 | $180,000 platform fee at 10,000 enrolled | See 4.3 |

**Decisions needed:** the unit (enrolled versus active); the platform fee and minimum; whether the `$30,000` minimum reconciles with the tier minimums in `DEAL_POLICY` (it sits above pilot and department, below campus and system); AI pool definition and overage; implementation bands; the premium-support percentage; the commission rate. Each becomes `D-<pull request number>`.

## 4. Pricing calculations [ILLUSTRATIVE]

### 4.1 Formulas

Let E = enrolled students. All amounts in US dollars per year unless stated.

1. Platform fee = max($30,000, $18 x E)
2. Included AI pool (requests per year) = 2,400 x E (planning average 200 per month per enrolled student)
3. Overage fee = $30 x (max(0, requests used - pool) / 1,000)
4. Premium support = max($15,000, 15% x platform fee) (optional; not sellable until staffed support is evidenced)
5. Implementation = one-time $35,000 to $150,000 (a range, not computed from E)
6. Partner commission (modelled separately) = 12% x partner order value (basis undefined)
7. Recurring subtotal (year one, excluding implementation and commission) = platform fee + premium support + overage

Thresholds: the platform minimum binds while E is below $30,000 / $18 = 1,666.7 (so up to 1,666 enrolled). The support minimum binds while the platform fee is below $15,000 / 15% = $100,000, i.e. E up to 5,555 when the platform fee is $18 x E.

### 4.2 Three worked examples (enrolments and usage are invented)

| Line | Case 1: 1,000 enrolled | Case 2: 5,000 enrolled | Case 3: 20,000 enrolled |
| --- | ---: | ---: | ---: |
| $18 x E | $18,000 | $90,000 | $360,000 |
| Platform fee = max($30,000, $18 x E) | **$30,000** (minimum binds) | **$90,000** (no) | **$360,000** (no) |
| Effective price per enrolled student | $30.00 | $18.00 | $18.00 |
| Included AI pool = 2,400 x E | 2,400,000 | 12,000,000 | 48,000,000 |
| Illustrative usage per student per year | 2,000 | 2,700 | 2,640 |
| Illustrative requests used | 2,000,000 | 13,500,000 | 52,800,000 |
| Requests beyond the pool | 0 | 1,500,000 | 4,800,000 |
| Overage = $30 x (excess / 1,000) | $0 | $45,000 | $144,000 |
| 15% x platform fee | $4,500 | $13,500 | $54,000 |
| Premium support = max($15,000, 15% x fee) | **$15,000** (minimum binds) | **$15,000** (minimum binds; 15% would be $13,500) | **$54,000** (no) |
| Recurring subtotal (platform + support + overage) | $45,000 | $150,000 | $558,000 |
| Implementation (one-time range) | $35,000-$150,000 | $35,000-$150,000 | $35,000-$150,000 |
| Which minimums bind | Platform minimum and support minimum | Support minimum only | Neither |

Arithmetic check: 1,000 x 18 = 18,000 < 30,000; 5,000 x 18 = 90,000; 20,000 x 18 = 360,000. Support: 15% x 30,000 = 4,500; 15% x 90,000 = 13,500; 15% x 360,000 = 54,000. Pools: 2,400 x 1,000 = 2,400,000; 2,400 x 5,000 = 12,000,000; 2,400 x 20,000 = 48,000,000. Overage case 2: (13,500,000 - 12,000,000) / 1,000 = 1,500; 1,500 x 30 = 45,000. Case 3: 52,800,000 - 48,000,000 = 4,800,000; 4,800 x 30 = 144,000. Sums: 30,000 + 15,000 + 0 = 45,000; 90,000 + 15,000 + 45,000 = 150,000; 360,000 + 54,000 + 144,000 = 558,000.

Note: the brief's own check figures list $13,500 for case 2 support; that is the 15% amount before the $15,000 minimum applies. Under the stated rule the charge is $15,000.

### 4.3 Cross-checks against existing repository numbers [DRAFT] [REVIEW: accounting]

| Check | Result | Consequence |
| --- | --- | --- |
| `DEAL_POLICY` minimum ACV by tier | $30,000 passes pilot ($15,000) and department ($25,000); fails campus ($75,000) and system ($200,000). Case 2 ($90,000 platform) passes campus; case 3 ($360,000) passes system | A 1,000-student institution can only be a pilot or department tier deal under current defaults |
| AI cost at the architecture doc's blended routed-call cost ($0.033 per call at list, `PRICING-UNIT-ECONOMICS-ARCHITECTURE.md` section 5) | If every pooled request were a routed call: 2,400 x $0.033 = **$79.20 per enrolled student per year at full use**, versus an $18 platform fee. The overage price ($0.03 per request) is **below** that blended cost | Pool and overage price may be loss-making at high utilisation. "Request" is not the architecture doc's unit (dollar-weighted AI units, 1 cent each); definition and metering must be settled before the pool is a model input |
| Finance model A-078 | 12 tasks per active student per month included; the brief's 200 per month is about 16.7 times larger | Model rows need updating or the pool needs a reduced planning average |
| Cost floors (architecture doc 5.3) | Base-case floors per tier are several times the platform fee at the brief's rate (campus 10,000 enrolled: floor about $286,570 versus $180,000) | Gross margin target not evidenced at $18 per enrolled |
| Enrolled versus active | Price per enrolled with 40% active implies $45 per active student; the finance model uses $10-$11 per active plus a platform fee | Different structures; reconcile in the lead's model |

## 5. Packaging ladder hypotheses [DRAFT]

| Rung | Hypothesis | Existing docs | Gate today |
| --- | --- | --- | --- |
| Design partner | No-fee or low-fee, non-activation engagement; scoped evidence exchange | [`../../market-readiness/PRIMARY-PILOT-OFFER.md`](../../market-readiness/PRIMARY-PILOT-OFFER.md), [`../../commercial/PILOT-OFFER.md`](../../commercial/PILOT-OFFER.md) | GREEN for non-activation engagement only; no live data, no customer claims |
| Pilot | Fixed cohort fee plus implementation; 26 weeks; converts or ends | [`../../PAID-PILOT-FRAMEWORK.md`](../../PAID-PILOT-FRAMEWORK.md), `registration_pilot` | **Paid pilot NO-GO/RED** |
| Annual platform | Platform fee (P3/P4) per enrolled student | Architecture doc section 3.2 (Start / Operate / Replace) | HELD: needs delivery, support, security and acceptance; enterprise NO-GO |
| Premium support | 15% of platform fee, minimum (P8) | [`../../commercial/SUPPORT-OPERATIONS.md`](../../commercial/SUPPORT-OPERATIONS.md) | Not sellable: staffed support not evidenced (priority 6) |
| Implementation | Fixed-scope package plus change orders (P7) | [`../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md`](../../commercial/IMPLEMENTATION-PLAN-TEMPLATE.md) | HELD with the order |
| AI add-on / pool and overage | Pooled governed requests with overage (P5/P6) | Architecture doc section 3.4 | Definition and cost check open (4.3) |
| Marketplace / partner | 12% commission, modelled separately (P9) | [`../../commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md`](../../commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md) | Gated by consumer, tax, refund and payout controls; core must be viable without it |

Rule: a plan with no entitlement rows or no capability backing is not sellable (architecture doc 3.1).

## 6. Discount and quote controls [DRAFT]

Source: `review()` and `DEAL_POLICY` in [`../../../app/src/lib/governance/deal-desk.ts`](../../../app/src/lib/governance/deal-desk.ts); policy text in [`../../operating-model/COMMERCIAL-GOVERNANCE.md`](../../operating-model/COMMERCIAL-GOVERNANCE.md). The values are proposed defaults. [VERIFIED]

| Control | Proposed default |
| --- | --- |
| Discount to 10% | sales lead |
| to 20% | sales lead and finance |
| to 30% | plus CEO |
| to 40% | plus board; above 40% refused |
| Multi-year | 3% per year after the first, capped at 9% |
| Pilot credit | at most 50% of first-year value; no "free forever" |
| Pilot length | at most 6 months |
| Implementation floor | $10,000 unless waived by a capped pilot credit |
| AI overage | Order must state the overage policy (refused otherwise) |
| Always added | implementation approver; product if custom work; legal if non-standard terms; security/privacy if data scope changes |

Second approver: D-1154 names one but sets no thresholds; the owner is also seller and accountant of record, so **no independent review exists**. [VERIFIED: `../../decisions/D-1154.md`]

**Never discount away** security, privacy, accessibility, rights, support or clean-exit work. [VERIFIED rule: `../../commercial/PRICING-AND-PACKAGING.md`] A discount needs authority, recorded reason, floor and margin check, expiry and reciprocal value.

## 7. Quote and order-form intake checklist [DRAFT] [REVIEW: counsel] [REVIEW: procurement]

Complete before any quote exists; all is HELD while price and paid pilot are NO-GO. Items follow the quote contents in the controlled pricing document.

| # | Item | Done |
| --- | --- | --- |
| 1 | Legal customer name, signing authority, purchasing path (RFP, quote threshold, consortium) | [ ] |
| 2 | Currency, package, term, cohort, workflow, environment | [ ] |
| 3 | Enrolled-student definition, census date, true-up and audit terms | [ ] |
| 4 | Services, data and integrations in scope; exclusions | [ ] |
| 5 | AI pool definition, overage policy, caps and alert thresholds | [ ] |
| 6 | Support scope, hours and severity handling matched to what is staffed | [ ] |
| 7 | Implementation fee basis (fixed scope; change orders), payment milestones | [ ] |
| 8 | Taxes, exemption certificates, payment terms, late fees | [ ] |
| 9 | Validity period, renewal, cancellation, refund, notice dates | [ ] |
| 10 | Pilot credit and conversion credit terms (capped), offboarding and export | [ ] |
| 11 | Discount approvals recorded; deal-desk `review()` has no refusals | [ ] |
| 12 | Claims check: no promise outside the claims register; no logo or reference without permission | [ ] |
| 13 | Counsel-approved paper; DPA status; security, privacy, accessibility review status | [ ] |
| 14 | Entity, tax and insurance authority confirmed (GO-NO-GO blocking items) | [ ] |

## 8. Tax, accounting and revenue-recognition review items [DRAFT]

Link: [`../../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`](../../commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md). These are questions for qualified professionals, not conclusions. The accountant of record is the founder (D-1154 item 5), who is also the seller: independent review does not exist.

| # | Item | Flag |
| --- | --- | --- |
| 1 | Sales and use tax treatment of institutional SaaS, implementation and support; exemption certificates for public and non-profit institutions | [REVIEW: tax] |
| 2 | Student subscription tax and app-store versus web checkout treatment | [REVIEW: tax] |
| 3 | Separate performance obligations: platform, implementation, premium support, AI pool | [REVIEW: accounting] |
| 4 | Pooled AI capacity: unused pool (breakage), overage as variable consideration, timing of recognition | [REVIEW: accounting] |
| 5 | Annual minimum commitment and enrolment true-up recognition | [REVIEW: accounting] |
| 6 | Pilot fee, pilot credit and conversion credit accounting; refund and chargeback treatment | [REVIEW: accounting] |
| 7 | 12% commission: principal versus agent, gross versus net presentation | [REVIEW: accounting] [REVIEW: tax] |
| 8 | Contract terms for refunds, renewals, auto-renewal and consumer rules | [REVIEW: counsel] |
| 9 | Invoice numbering, credit balances, month-end close controls | [REVIEW: accounting] |

## 9. Where each assumption lives in the models [DRAFT]

The in-app Finance model is being built by the lead under `app/src/finance/` (path only; not yet present in this revision). The workbook and dashboard are [`../../finance/semester-financial-model.xlsx`](../../finance/semester-financial-model.xlsx) and [`../../finance/dashboard.html`](../../finance/dashboard.html); the register is [`../../finance/assumption-register.md`](../../finance/assumption-register.md).

| Input | Existing row in the xlsx register | In-app model (`app/src/finance/`) | Action |
| --- | --- | --- | --- |
| P1/P2 Student Premium | A-011, A-012 hold $7.99 and $59 | Lead to map as price scenarios | Add the user's and D-1154 values as scenarios; no overwrite |
| P3 platform per enrolled | None (rows are per active: A-036, A-046) | New input and unit | New rows needed |
| P4 $30,000 minimum | None (A-034 $35,000 platform for department) | New input | New row |
| P5 AI pool | A-078 (12 tasks per active per month) | New input, plus cost per request | Reconcile; see 4.3 |
| P6 overage | None | New input | New row |
| P7 implementation | A-028, A-037, A-047 | Map as a range | Add range scenario |
| P8 premium support | None | New input | New row; gated on staffed support |
| P9 commission 12% | A-097 holds 15% | Separate module | Add as a scenario |
| Pilot length | A-025, A-030 (26 weeks, 2 months to go-live) | Pilot length input | Keep 26 until decided |

All entries remain labelled planning assumptions inside the model; outputs must carry "illustrative, not a forecast".

## Evidence state

**Repository evidence.** [VERIFIED] price conflicts, `DEAL_POLICY`, controlled pricing logic and the finance model exist.
**Operational evidence.** None: no validated willingness to pay, observed delivery cost, margin floor, tax posture, payment authority or paying customer.
**Missing proof.** Approved price book by dated decision; cost measurement; counsel, tax and accountant review; quote-to-cash rehearsal.

## Claim ceiling

Semester may discuss packaging hypotheses and prepare internal quotes with explicit placeholders.

## Prohibited claims

Do not publish, quote or charge an unapproved number; do not claim affordability, savings, ROI, margin, discount availability, market validation or annual conversion economics (CLM-015, CLM-014).

## Professional review required

[REVIEW: tax] [REVIEW: accounting] [REVIEW: counsel] [REVIEW: procurement] before any number leaves the company.
