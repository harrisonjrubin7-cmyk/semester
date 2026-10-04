<!-- Rendered by docs/finance/model/render_docs.py from the model. Edit the model (spec.py) or the renderer, then re-run it. -->

# Semester finance: operating model, pricing, controls and reporting

| Control | Value |
| --- | --- |
| Status | **PLANNING MODEL: NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR ACCOUNTING RECORD** |
| Owner | Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned |
| Evidence date | 2026-10-04 at repository revision `7287ddc` (origin/main) |
| Source | Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page. |

**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. **Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

## What this is

A bottom-up, three-year, monthly financial model for Semester (January 2027 to December 2029), and the operating system around it: pricing and entitlements, a cost model, unit economics, scenarios, a gate-tied budget and approval matrix, contract and tax routing to qualified advisers, financial controls, and a board reporting package. It is written for the CFO seat in the audit's executive-team prompt ("Chief Financial Officer; SaaS Pricing and Unit-Economics Architect; Revenue Operations and Finance Operations Architect"), and obeys the audit's rule that *qualified human counsel must approve legal conclusions and contracts*. **It states no legal, tax or accounting conclusion.** Each one is a question for a named adviser in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

The model is `semester-financial-model.xlsx` (live formulas, eight scenario sheets, a dashboard, a comparison sheet and integrity checks). The pages in this folder are rendered from the same model.

## What the model says (Base scenario, and what it does not)

1. **The controlling go/no-go decision shapes everything.** Paid individual acquisition, paid institutional pilots and enterprise sale are NO-GO today (`GO-NO-GO-DECISION.md`). The Base plan therefore has **no revenue before month 12** and treats the gate months as founder decisions.
2. **Capital need is set by the team, not the market.** Peak funding need through month 36 is **$12.73M** in Base ($13.73M Conservative, $10.69M Aggressive, $22.12M with the CTO pack's full-scope staffing). Payroll is about two-thirds of cost. A 30% change in pilot and direct-deal volume moves the need by about $617k; moving the paid-pilot gate by six months moves it by about $994k.
3. **Revenue is institutional.** About 91% of Year 3 revenue is platform, pilot and implementation; implementation services alone are 49% and are not ARR. Month-36 ARR is $1.53M.
4. **Plus is a good product per paying user and a poor acquisition engine.** A paying subscriber's own margin is 77%, but at Base conversion the free tier costs 2.3x the revenue paying students bring and LTV/CAC is 0.20. The paid acquisition line is a test budget, released only on measured evidence.
5. **Implementation is the margin to watch.** Priced to roughly a third margin at standard cost per account (30-35% by tier), it lands near 21% once the team is staffed to demand, and goes negative whenever a gate slips and the team waits (-42% in the Enterprise-delayed scenario). Hiring follows the gates.
6. **AI is 8% of Year 3 revenue in Base and 22% if unit cost and usage rise 2.5x and 1.5x.** It is controllable (per-tenant budgets and a kill switch exist) but unpriced; finance needs usage joined to price before any AI price is set.
7. **Capital should be released in three gated tranches** ($2.46M, $4.78M, $5.49M), each with a six-month cushion, rather than raised as one number ([07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md)).
8. **The CTO pack's full-scope staffing plan costs $9.39M more than the gated plan** for the same revenue (peak need $22.12M, 70 FTE at month 36). The gates are inputs, so the extra engineering cannot move them; to pay for itself through timing alone it would have to bring the paid-pilot gate forward by about 24 months.
9. **A materially smaller number needs a smaller scope sequence than the audit's six increments.** Hiring discipline, and with it a smaller early engineering team, takes $2.41M to $3.38M off the need. The scope decision is the funding decision.

Nothing above is observed. Of the model's inputs, only a handful are facts; the rest are hypotheses to be replaced by the first design-partner pilot and the invitation-only cohort ([01](01-ASSUMPTIONS-AND-EVIDENCE.md)).

## Documents

| Page | Contents |
| --- | --- |
| [01-ASSUMPTIONS-AND-EVIDENCE.md](01-ASSUMPTIONS-AND-EVIDENCE.md) | Every model input, tagged fact / policy / decide / hypothesis / vendor / professional; the ten to test first |
| [02-REVENUE-STREAMS-AND-PRICING.md](02-REVENUE-STREAMS-AND-PRICING.md) | Seven revenue streams, packages and proposed prices, entitlements, discount and approval ladder, billing, collections, revenue-recognition questions |
| [03-COST-MODEL.md](03-COST-MODEL.md) | Every cost line with driver and owner, per-user cost build-up, headcount plan, vendor prices to verify |
| [04-THREE-YEAR-MODEL.md](04-THREE-YEAR-MODEL.md) | Gates, annual P&L, ARR build, cash, tranches (Base scenario) |
| [05-UNIT-ECONOMICS-DASHBOARD.md](05-UNIT-ECONOMICS-DASHBOARD.md) | CAC, payback, margins, churn, NRR, burn, implementation margin, AI unit cost, with guardrails |
| [06-SCENARIOS-AND-SENSITIVITIES.md](06-SCENARIOS-AND-SENSITIVITIES.md) | Seven scenarios, triggers and pre-agreed responses, sensitivities, levers |
| [07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md) | Gate-contingent budget, spending approval matrix, hiring and signing authority, tranche release |
| [08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md) | Contract financial requirements, invoice flow, tax and marketplace questions, advisor engagement map, open-items register |
| [09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md) | Control matrix, close calendar, reconciliations, systems, finance operating calendar, model governance |
| [10-BOARD-REPORTING-PACKAGE.md](10-BOARD-REPORTING-PACKAGE.md) | Founder weekly flash, monthly pack, quarterly board package, rules for what may appear |

Other files: [`semester-financial-model.xlsx`](semester-financial-model.xlsx) (the model), [`model/`](model/) (source: assumptions and rows in `spec.py`, builder, verifier, independent check, renderer).

## How this relates to what the repository already has

| Existing | What it already does | What this adds |
| --- | --- | --- |
| `docs/commercial/PRICING-AND-PACKAGING.md`, `docs/market-readiness/PRICING-AND-PACKAGING.md` | Pricing *logic*; says no approved price book | Proposed numbers with corridor checks, as inputs for approval |
| `app/src/lib/governance/deal-desk.ts`, `docs/operating-model/COMMERCIAL-GOVERNANCE.md` | Proposed discount ladder, minimum ACVs, AI cost controls | Used unchanged as the model's `POLICY` inputs; links them to cash |
| `docs/commercial/ORDERING-AND-BILLING-OPERATIONS.md`, `REVENUE-RECOGNITION-REVIEW-CHECKLIST.md` | Controlled order-to-cash process and fact-gathering template | The invoice flow with controls, and the questions for the accountant |
| `docs/COMPANY-FIRST-YEAR-MEASURES.md` | Defines ARR/MRR, margin, CAC payback, runway as measures with no reading | Formulas, model readings and proposed guardrails (targets stay the founder's decision, recorded in `docs/decisions/`) |
| `docs/FINANCIAL-READINESS-WORKSPACE.md` | A *student* financial-readiness feature | Unrelated; this is Semester's own finance |
| `GO-NO-GO-DECISION.md`, `LAUNCH-RISK-REGISTER.md` | Gates and risks | Turned into dated gate inputs and a tranche plan |
| `docs/target-architecture/` (CTO pack, D-1144) | Proposed architecture and a staffing plan with no compensation or budget | The staffing plan costed as scenario 8; infrastructure cost cross-check in [03](03-COST-MODEL.md) |
| `supabase/migrations/…commercial_core.sql`, `app/src/lib/billing/` | Catalog, entitlements, checkout, webhook, dunning | Cost drivers for each entitlement; billing controls to operate it |

No existing file was changed. No decision file is added: these are proposals, and `CLAUDE.md` makes a decision take its pull request's number once the founder decides ([`docs/decisions/README.md`](../decisions/README.md)).

## Decisions this pack asks of the founder

1. Gate months (inputs `gate_plus`, `gate_pilot`, `gate_direct`, `gate_ent`) and the evidence owner for each.
2. Whether the proposed institutional list prices, pilot fees and implementation fees go to the deal desk for approval, and who sits there while the company has one decision-maker.
3. Whether to adopt the three-tranche capital plan and the spending approval matrix, and who the first board observer or financial adviser is.
4. Whether the `pro` plan is collapsed into Plus.
5. The AI included-allowance policy for the free tier (cap per month).
6. Which advisers to engage first (order proposed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md)).
7. Whether the CTO pack's staffing plan is adopted as a ceiling released by tranche (this pack's recommendation) or as a calendar plan (scenario 8, which needs the larger raise).

## Regenerate and verify

```bash
python3 docs/finance/model/build_workbook.py docs/finance/semester-financial-model.xlsx
python3 docs/finance/model/verify.py docs/finance/semester-financial-model.xlsx --publish   # LibreOffice recalculation vs Python run
python3 docs/finance/model/independent_check.py                                             # plain-loop re-derivation + identities
python3 docs/finance/model/render_docs.py                                                   # rewrite these pages from the model
```

Requires Python 3 with `openpyxl` and LibreOffice (Calc) for the verification step. These commands are separate from the `app/` gates in the repository `CLAUDE.md`; the app's gates do not read this folder.
