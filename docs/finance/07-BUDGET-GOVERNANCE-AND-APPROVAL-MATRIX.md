<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# 07. Budget governance and spending approval matrix

| Control | Value |
| --- | --- |
| Status | **PROPOSED CONTROL FRAMEWORK: NOT ADOPTED. NO APPROVER OTHER THAN THE FOUNDER IS ASSIGNED TODAY** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

The repository's own constraint governs this page: the owner-and-accountability matrix names Harrison Rubin for almost every seat and leaves finance operator, signing authority, accountant, tax reviewer and backup **unassigned**. A matrix of approvers who do not exist is a fiction, so the matrix below runs in two modes: *single-person mode* (today) with compensating controls, and *full mode* once a second approver exists. A person who cannot approve their own spend is the control; where there is only one person, the control is a cap, a record, an outside reviewer and the board.

## 1. Principles

1. **Spend follows evidence.** Budget lines that depend on a gate are *held* until the gate is recorded as open. Hiring ahead of a gate is an exception, logged and ratified.
2. **One owner per line.** Every budget line has a named owner who can explain it; the owner proposes, finance records, an approver above the owner releases.
3. **No commitment without a budget line and a record.** A purchase order, vendor contract, offer letter or customer discount that exceeds the owner's limit is not valid until approved and logged.
4. **Reforecast quarterly; re-baseline annually; model version printed on every pack.**
5. **Never economize on the controls the gates require** (security, privacy, accessibility, legal, insurance, restore drills). The model halves them only to size them ([06](06-SCENARIOS-AND-SENSITIVITIES.md)).

## 2. Gate-contingent budget (Base)

Budget held until the gate opens. Annualized cost is salary x (1 + 22% burden); program lines are the model's amounts.

| Gate | Spend held until it opens | Annualized loaded cost | Evidence that releases it |
| --- | --- | ---: | --- |
| G1 Design-partner pilot activated | Implementation engineer #1 (month 5); named-customer scoping time | $122,000 | Priorities 1-8 closed and a dated activation record |
| G2 Paid institutional pilot | Account executive #1, sales engineer, implementation engineers #2-#3; paid-pilot collateral and contracts | $536,800 | Design-partner closeout measured; priorities 1-9; entity, price, tax/accounting, payment and insurance authority in writing |
| G3 Broad / paid individual acquisition | Paid acquisition test budget; checkout for new subscribers; campus program scale-up | $3,000/month test budget | Invitation-validation closeout plus a separate broad-rollout decision |
| G4 Direct annual sales | Account executive #2, implementation engineers #4-#5, customer success manager #1 | $500,200 | First pilot-to-annual conversions evidenced; renewal terms approved |
| G5 System tier / broad enterprise | Partnerships manager, implementation engineers #6-#8, customer success manager #2, trust & safety hire | $707,600 | Repeated successful deployments; independent assurance; separate broad-enterprise decision |

Everything else in the plan (engineering, product, security, compliance, finance, support, marketing) is the **core team**, released by tranche, not by gate. Total payroll in Base is 1,647 / 3,802 / 5,187 thousand dollars in Years 1-3, including the gated roles above.

## 3. Capital tranches and release conditions

| Tranche | Amount | Release condition |
| --- | ---: | --- |
| Tranche 1 | $2.46M (+ $1.57M cushion) | Entity, bank, books and signing authority in place; an accountant and counsel engaged; insurance bound; GO priorities 1-8 on a dated plan; budget and approval matrix adopted |
| Tranche 2 | $4.78M (+ $2.57M cushion) | G2 open: design-partner closeout measured and a paid-pilot decision recorded; first paid pilot order signed; pilot-to-annual evidence plan agreed; quarterly forecast within 15% of plan |
| Tranche 3 | $5.49M (+ $2.66M cushion) | G4 evidence: pilot-to-annual conversions recorded; implementation margin and utilization inside guardrails; enterprise gate decision date set |

The cushion exists so a tranche is never spent to zero waiting for a decision. If a gate is late, the response is the pre-agreed trigger table in [06](06-SCENARIOS-AND-SENSITIVITIES.md): freeze gated hires first, then reforecast, then re-time the raise. **How capital is actually raised (instrument, investors, terms, securities-law compliance) is a question for corporate counsel and is out of scope.**

## 4. Spending approval matrix (proposed)

Amount = total committed cost of the purchase over its term (annual contract value for subscriptions; first-year value for multi-year). "Finance" = the finance operator or fractional CFO; until one exists, the outside accountant reviews monthly and the founder is limited to the single-person caps in the right-hand column.

| Spend type | Up to $1,000 | $1,001 to $10,000 | $10,001 to $50,000 | Over $50,000 or any multi-year | Single-person mode (founder only) |
| --- | --- | --- | --- | --- | --- |
| Budgeted operating spend (tools, travel, marketing, program lines) | Budget owner | Owner + finance | Founder + finance | Founder + board | Founder up to $10k per item and $25k per month; above that, board observer or adviser sign-off in writing |
| Unbudgeted spend | Founder | Founder + finance | Founder + board observer | Board | Not permitted above $5k without outside review |
| New vendor that touches student or customer data | Security/privacy review first, at any amount | same | same | same | Review recorded before signature; counsel for the data terms |
| Software and cloud subscriptions (recurring) | Owner | Owner + finance | Founder + finance | Founder + board | Annual commitment cap $25k |
| Hires, contractors, ambassador stipends | Approved plan only; offers by founder with finance review; classification question to counsel/CPA before any non-employee payment program | | | | Any hire outside the plan needs board approval |
| Customer discounts and terms | Deal-desk ladder ([02](02-REVENUE-STREAMS-AND-PRICING.md)) | | | | Founder is sales lead and approver: over 10% needs written outside finance review |
| Refunds and credits | Policy amount, support lead | Up to $1,000: finance | Over $1,000: founder + finance | Over $10,000: board | Cap $1,000 without outside review |
| Legal spend and settlements | Founder with counsel | same | Founder + board observer | Board | |
| Insurance binding, limits and changes | Broker recommendation, founder + finance | | | Board for limits change | Annual review with broker |
| Payments to related parties, founder compensation, equity | Board only | | | | |
| Emergency spend (security incident or outage) | Incident commander up to $50,000 to contain, ratified within 3 business days | | | Board informed within 24 hours | Same |

**Always escalate regardless of amount:** anything involving a related party; a payment to a new bank account or a change to a vendor's bank details (call-back verification first); a contract with auto-renewal, unlimited liability, exclusivity or most-favored-customer terms; anything touching legal holds or data-retention exceptions; and any spend the budget owner approves for their own benefit.

## 5. Contract signing authority

| Document | Signatory | Required review |
| --- | --- | --- |
| Customer order forms within the deal-desk ladder | Founder (until an authorized officer is appointed by board resolution) | Counsel-approved template; finance for any discount over 10% |
| Customer MSA, DPA, SLA, pilot paper, anything non-standard | Founder | Counsel before signature, always |
| Vendor contracts under $25,000 and 12 months | Founder | Security/privacy if data is shared |
| Vendor contracts over $25,000 or 12 months, or with auto-renewal | Founder | Counsel review; board informed |
| Loans, guarantees, leases, equity instruments | Board | Counsel |
| Bank account opening and signers | Board resolution | CPA/bank |

A signed order is **not** a launch GO: activation needs the separate release evidence (`ORDERING-AND-BILLING-OPERATIONS.md`).

## 6. Hiring governance

Each hire needs: an approved role in the headcount plan or a logged exception; the gate state if the role is gated; a compensation band approved by founder and finance; a start date that does not precede the budget being released; employment-law and classification review by counsel for any non-standard arrangement; background-check and access provisioning per the security program. Contractor spend counts toward the same lines. Headcount and payroll are reported against plan in every monthly pack.

## 7. Variance and freeze rules

| Condition | Rule |
| --- | --- |
| A budget line is 10% and $5,000 over plan for the month | Owner explains in the monthly pack |
| A function is 10% over plan for the quarter | Reforecast and written plan to the founder; board informed |
| Runway under 12 months with the next gate not yet open | Freeze gated hiring and unbudgeted spend |
| Runway under 9 months | Cut to the gated plan; start the raise only against an open gate or an agreed bridge |
| Runway under 6 months | Board decision on scope; no new commitments beyond 30 days |
| Vendor price moves more than 20% | Re-run the model; decide pass-through or substitution |
| An AI tenant budget is 80% consumed | Alert to the tenant admin and finance; do not lift the cap without approval |

## 8. Expense and card policy (proposed)

Company cards only for company spend, one per budget owner, monthly limit set by the matrix; receipts within seven days; personal expenses reimbursed through payroll only with a receipt and a category; no cash advances; travel at economy rates; conference spend pre-approved against the events line; ambassador and student stipends only through the approved program and documented classification; gifts to customers or officials follow counsel's policy.

## 9. Responsibility (R accountable, C consulted, I informed)

Aligned to the repository RACI (pricing and package: CEO accountable, CRO responsible):

| Decision | CEO | Finance operator / fractional CFO | Counsel | CPA / tax | Board |
| --- | :-: | :-: | :-: | :-: | :-: |
| Annual budget and tranche request | A | R | C | C | approve |
| Price book and discount authority | A | R | C | C | I |
| Customer contract acceptance | A | C | R | C | I |
| Revenue recognition policy | I | C | C | R | I |
| Tax filings and registrations | I | R | C | A | I |
| Insurance program | A | R | C | I | I |
| Hiring plan and compensation bands | A | R | C | C | approve |
| Month-end close and reconciliations | I | A/R | I | C | I |
| Incident spend | A | R | C | I | I |

Until a finance operator exists the CEO is both A and R on rows where that is unavoidable, and the compensating control is the outside accountant's monthly review plus the board observer's quarterly one. That limitation is itself an item for the board package.
