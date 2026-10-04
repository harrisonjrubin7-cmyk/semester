"""README (00), 07 budget governance, 08 contracts / tax / advisors, 09 controls."""
import engine, spec, analysis
from results import *
from render_a import CLAIM, A

DOC_LIST = [
 ('01-ASSUMPTIONS-AND-EVIDENCE.md', 'Every model input, tagged fact / policy / decide / hypothesis / vendor / professional; the ten to test first'),
 ('02-REVENUE-STREAMS-AND-PRICING.md', 'Seven revenue streams, packages and proposed prices, entitlements, discount and approval ladder, billing, collections, revenue-recognition questions'),
 ('03-COST-MODEL.md', 'Every cost line with driver and owner, per-user cost build-up, headcount plan, vendor prices to verify'),
 ('04-THREE-YEAR-MODEL.md', 'Gates, annual P&L, ARR build, cash, tranches (Base scenario)'),
 ('05-UNIT-ECONOMICS-DASHBOARD.md', 'CAC, payback, margins, churn, NRR, burn, implementation margin, AI unit cost, with guardrails'),
 ('06-SCENARIOS-AND-SENSITIVITIES.md', 'Seven scenarios, triggers and pre-agreed responses, sensitivities, levers'),
 ('07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md', 'Gate-contingent budget, spending approval matrix, hiring and signing authority, tranche release'),
 ('08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md', 'Contract financial requirements, invoice flow, tax and marketplace questions, advisor engagement map, open-items register'),
 ('09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md', 'Control matrix, close calendar, reconciliations, systems, finance operating calendar, model governance'),
 ('10-BOARD-REPORTING-PACKAGE.md', 'Founder weekly flash, monthly pack, quarterly board package, rules for what may appear'),
]


def doc00():
    o, k = run(1)
    res = [run(i) for i in range(len(spec.SCENARIOS))]
    tr = analysis.tranches()
    _b, _items = analysis.tornado()
    _tor = {i['label']: (i['peak_lo'], i['peak_hi']) for i in _items}
    _gm = (peak(res[7][0]) - peak(o)) / (abs(_tor['Paid-pilot gate opens (months)'][0]) / 3)
    t = banner('Semester finance: operating model, pricing, controls and reporting', 'PLANNING MODEL: NOT AN APPROVED BUDGET, PRICE BOOK, FORECAST OR ACCOUNTING RECORD')
    t += f"""
{CLAIM}

## What this is

A bottom-up, three-year, monthly financial model for Semester (January 2027 to December 2029), and the operating system around it: pricing and entitlements, a cost model, unit economics, scenarios, a gate-tied budget and approval matrix, contract and tax routing to qualified advisers, financial controls, and a board reporting package. It is written for the CFO seat in the audit's executive-team prompt ("Chief Financial Officer; SaaS Pricing and Unit-Economics Architect; Revenue Operations and Finance Operations Architect"), and obeys the audit's rule that *qualified human counsel must approve legal conclusions and contracts*. **It states no legal, tax or accounting conclusion.** Each one is a question for a named adviser in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).

The model is `semester-financial-model.xlsx` (live formulas, eight scenario sheets, a dashboard, a comparison sheet and integrity checks). The pages in this folder are rendered from the same model.

## What the model says (Base scenario, and what it does not)

1. **The controlling go/no-go decision shapes everything.** Paid individual acquisition, paid institutional pilots and enterprise sale are NO-GO today (`GO-NO-GO-DECISION.md`). The Base plan therefore has **no revenue before month {next(i + 1 for i, v in enumerate(o['rev_total']) if v > 0)}** and treats the gate months as founder decisions.
2. **Capital need is set by the team, not the market.** Peak funding need through month 36 is **{fm(peak(o))}** in Base ({fm(peak(res[0][0]))} Conservative, {fm(peak(res[2][0]))} Aggressive, {fm(peak(res[7][0]))} with the CTO pack's full-scope staffing). Payroll is about two-thirds of cost. A 30% change in pilot and direct-deal volume moves the need by about {fm(abs(_tor['Pilot and direct-deal volume'][0]))}; moving the paid-pilot gate by six months moves it by about {fm(abs(_tor['Paid-pilot gate opens (months)'][1]))}.
3. **Revenue is institutional.** About {pc((ys(o,'pilot_rev',2)+ys(o,'core_rev',2)+ys(o,'svc_rev',2))/ys(o,'rev_total',2),0)} of Year 3 revenue is platform, pilot and implementation; implementation services alone are {pc(ys(o,'svc_rev',2)/ys(o,'rev_total',2),0)} and are not ARR. Month-36 ARR is {fm(k['k_arr'][2])}.
4. **Plus is a good product per paying user and a poor acquisition engine.** A paying subscriber's own margin is {pc(k['k_paid_gm'][2],0)}, but at Base conversion the free tier costs {k['k_free_ratio'][2]:.1f}x the revenue paying students bring and LTV/CAC is {k['k_ltv_cac'][2]:.2f}. The paid acquisition line is a test budget, released only on measured evidence.
5. **Implementation is the margin to watch.** Priced to roughly a third margin at standard cost per account (30-35% by tier), it lands near {pc(k['k_gm_svc'][2],0)} once the team is staffed to demand, and goes negative whenever a gate slips and the team waits ({pc(res[3][1]['k_gm_svc'][2],0)} in the Enterprise-delayed scenario). Hiring follows the gates.
6. **AI is {pc(k['k_ai_pct'][2],0)} of Year 3 revenue in Base and {pc(res[4][1]['k_ai_pct'][2],0)} if unit cost and usage rise 2.5x and 1.5x.** It is controllable (per-tenant budgets and a kill switch exist) but unpriced; finance needs usage joined to price before any AI price is set.
7. **Capital should be released in three gated tranches** ({fm(tr[0]['need'])}, {fm(tr[1]['need'])}, {fm(tr[2]['need'])}), each with a six-month cushion, rather than raised as one number ([07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md)).
8. **The CTO pack's full-scope staffing plan costs {fm(peak(res[7][0]) - peak(o))} more than the gated plan** for the same revenue (peak need {fm(peak(res[7][0]))}, {res[7][1]['k_fte'][2]:.0f} FTE at month 36). The gates are inputs, so the extra engineering cannot move them; to pay for itself through timing alone it would have to bring the paid-pilot gate forward by about {_gm:.0f} months.
9. **A materially smaller number needs a smaller scope sequence than the audit's six increments.** Hiring discipline, and with it a smaller early engineering team, takes {fm(-analysis.levers()[1][-2]['d_peak'])} to {fm(-analysis.levers()[1][-1]['d_peak'])} off the need. The scope decision is the funding decision.

Nothing above is observed. Of the model's inputs, only a handful are facts; the rest are hypotheses to be replaced by the first design-partner pilot and the invitation-only cohort ([01](01-ASSUMPTIONS-AND-EVIDENCE.md)).

## Documents

""" + table(['Page', 'Contents'], [[f'[{n}]({n})', d] for n, d in DOC_LIST], ['l', 'l']) + f"""

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
"""
    return t


def doc07():
    o, k = run(1)
    burd = A['burden']
    byid = {r[0]: r for r in spec.HEADCOUNT}
    def ann(ids):
        return sum(byid[i][3] * byid[i][5] * (1 + burd) for i in ids)
    held = [
     ('G1 Design-partner pilot activated', 'Implementation engineer #1 (month 5); named-customer scoping time', ['IM-1'], 'Priorities 1-8 closed and a dated activation record'),
     ('G2 Paid institutional pilot', 'Account executive #1, sales engineer, implementation engineers #2-#3; paid-pilot collateral and contracts', ['SA-1', 'SA-2', 'IM-2', 'IM-3'], 'Design-partner closeout measured; priorities 1-9; entity, price, tax/accounting, payment and insurance authority in writing'),
     ('G3 Broad / paid individual acquisition', 'Paid acquisition test budget; checkout for new subscribers; campus program scale-up', [], 'Invitation-validation closeout plus a separate broad-rollout decision'),
     ('G4 Direct annual sales', 'Account executive #2, implementation engineers #4-#5, customer success manager #1', ['SA-3', 'IM-4', 'IM-5', 'CS-1'], 'First pilot-to-annual conversions evidenced; renewal terms approved'),
     ('G5 System tier / broad enterprise', 'Partnerships manager, implementation engineers #6-#8, customer success manager #2, trust & safety hire', ['SA-4', 'IM-6', 'IM-7', 'IM-8', 'CS-2', 'TS-1'], 'Repeated successful deployments; independent assurance; separate broad-enterprise decision'),
    ]
    t = banner('07. Budget governance and spending approval matrix', 'PROPOSED CONTROL FRAMEWORK: NOT ADOPTED. NO APPROVER OTHER THAN THE FOUNDER IS ASSIGNED TODAY')
    t += f"""
{CLAIM}

The repository's own constraint governs this page: the owner-and-accountability matrix names Harrison Rubin for almost every seat and leaves finance operator, signing authority, accountant, tax reviewer and backup **unassigned**. A matrix of approvers who do not exist is a fiction, so the matrix below runs in two modes: *single-person mode* (today) with compensating controls, and *full mode* once a second approver exists. A person who cannot approve their own spend is the control; where there is only one person, the control is a cap, a record, an outside reviewer and the board.

## 1. Principles

1. **Spend follows evidence.** Budget lines that depend on a gate are *held* until the gate is recorded as open. Hiring ahead of a gate is an exception, logged and ratified.
2. **One owner per line.** Every budget line has a named owner who can explain it; the owner proposes, finance records, an approver above the owner releases.
3. **No commitment without a budget line and a record.** A purchase order, vendor contract, offer letter or customer discount that exceeds the owner's limit is not valid until approved and logged.
4. **Reforecast quarterly; re-baseline annually; model version printed on every pack.**
5. **Never economize on the controls the gates require** (security, privacy, accessibility, legal, insurance, restore drills). The model halves them only to size them ([06](06-SCENARIOS-AND-SENSITIVITIES.md)).

## 2. Gate-contingent budget (Base)

Budget held until the gate opens. Annualized cost is salary x (1 + {pc(burd,0)} burden); program lines are the model's amounts.

"""
    rows = []
    for g, what, ids, ev in held:
        rows.append([g, what, f'${ann(ids):,.0f}' if ids else f"${A['paid_budget'][1]:,.0f}/month test budget", ev])
    t += table(['Gate', 'Spend held until it opens', 'Annualized loaded cost', 'Evidence that releases it'], rows, ['l', 'l', 'r', 'l'])
    t += f"""

Everything else in the plan (engineering, product, security, compliance, finance, support, marketing) is the **core team**, released by tranche, not by gate. Total payroll in Base is {fk(payroll_total(o,0))} / {fk(payroll_total(o,1))} / {fk(payroll_total(o,2))} thousand dollars in Years 1-3, including the gated roles above.

## 3. Capital tranches and release conditions

"""
    tr = analysis.tranches()
    rows = []
    for x, cond in zip(tr, [
        'Entity, bank, books and signing authority in place; an accountant and counsel engaged; insurance bound; GO priorities 1-8 on a dated plan; budget and approval matrix adopted',
        'G2 open: design-partner closeout measured and a paid-pilot decision recorded; first paid pilot order signed; pilot-to-annual evidence plan agreed; quarterly forecast within 15% of plan',
        'G4 evidence: pilot-to-annual conversions recorded; implementation margin and utilization inside guardrails; enterprise gate decision date set']):
        rows.append([x['name'], f"{fm(x['need'])} (+ {fm(x['cushion'])} cushion)", cond])
    t += table(['Tranche', 'Amount', 'Release condition'], rows, ['l', 'r', 'l'])
    t += """

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
"""
    return t


def doc08():
    t = banner('08. Contracts, invoicing, tax and marketplace: financial requirements and advisor routing', 'ROUTING DOCUMENT: NO LEGAL, TAX OR ACCOUNTING CONCLUSION IS STATED')
    t += """
**Rule for this page.** Everything phrased as a question is a question for the named professional. Where the page says "proposal", it is an input to that professional's review, not a position. This follows the audit's rule that *qualified human counsel must approve legal conclusions and contracts*, and `LEGAL-REVIEW-QUEUE.md`, `COUNSEL-BRIEF.md` and `docs/commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`, which are the existing queues. Nothing here is a legal, tax or accounting conclusion, and nothing here authorizes a signature, an invoice or a charge.

## 1. What finance needs in every customer contract

For counsel to draft and approve; finance's list of what must be *in* the paper so the money can be billed, collected and recognized.

| Area | Finance needs the contract to state | Why finance cares |
| --- | --- | --- |
| Parties | Exact legal names of both entities, authorized signers, bill-to and ship-to contacts, tax ID where required | Wrong entity means an invoice that cannot be paid or an unenforceable debt |
| Order form | Package, tier or band, active-student definition and count method, term, start date, renewal mechanics, cohorts and environments, modules, integrations in scope | The unit of billing must be countable from data Semester holds |
| Price | Fixed fees, currency, band thresholds and what happens when a band is exceeded, price on renewal (cap or index), AI allowance and overage rates | Prevents an uncollectable true-up and unpriced usage |
| Billing schedule | Invoice dates, amounts, milestones tied to named acceptance evidence, who receives invoices, PO number, vendor-portal registration | The invoice calendar drives cash and deferred revenue |
| Payment terms | Days, method, bank details, late-payment consequence, dispute window, set-off | Collections and DSO |
| Taxes | Price exclusive of tax; exemption certificate; who files; withholding for foreign payers | Prevents absorbing tax by accident (tax adviser) |
| Credits and refunds | Pilot credit definition (eligible fees, expiry, what it cannot offset), SLA credits (cap, sole remedy), refund triggers | Credits are contra-revenue and must be bounded |
| Termination | Convenience, cause, **non-appropriation** (public institutions), effect on prepaid fees, wind-down and export period, offboarding fee if any | Determines what is billable, refundable and recognizable (CPA) |
| Acceptance | Objective acceptance criteria for implementation and pilot closeout, deemed-acceptance clock | Recognition and collection both depend on it |
| Liability and insurance | Cap relative to fees, super-cap for data events, required insurance limits and certificates | Drives the insurance program and its cost (broker, counsel) |
| Data and offboarding | Retention, export, deletion and the cost and timing of each; no suspension of export or deletion for non-payment | Rights that cannot be monetized or withheld |
| Assignment, change of control, MFN, exclusivity, audit rights | Prohibit or escalate | Each can break a financing or an acquisition |
| Reference and publicity | Permission, scope and expiry; claim-specific | Claims register |
| Service levels | Only commitments backed by staffed coverage and measured history | A 24x7 promise without a rota is a liability |

Contract stop conditions (from the repository): no revenue is recorded from an unsigned or non-enforceable proposal, an unapproved price, unperformed delivery or missing acceptance where required.

## 2. Public-sector buying realities to verify (hypotheses, not facts)

Institutions often buy from fixed budget cycles, require purchase orders and vendor registration, take 30 to 90 days to pay, ask for accessibility reports and security questionnaires before a PO, and have rules on non-appropriation, indemnity and governing law. Each of these affects when cash arrives (the model collects after two months and bills annual in advance as a conservative proxy). **Verify with each prospect's procurement office and with counsel; do not generalize from this paragraph.**

## 3. Invoice flow

| # | Step | System of record | Control | Owner | Evidence |
| ---: | --- | --- | --- | --- | --- |
| 1 | Qualify: legal customer, signer, scope, budget path, tax and exemption needs, PO need | CRM | Customer legal entity verified against a source document | Sales | Qualification record |
| 2 | Quote from the **approved** price book; discounts by ladder | Quote tool / CRM | Approver recorded; floor and margin check | Sales; deal desk | Quote version, approval |
| 3 | Review and contract | Contract repository | Counsel for non-standard paper; security/privacy/accessibility for scope | Counsel; founder | Reviewed paper |
| 4 | Sign; create order | Contract repository -> `contracts`, `quotes` tables | Immutable order version; seller is not the sole approver where staffing allows | Founder; finance | Executed order |
| 5 | Invoice | Approved accounting/billing system | Unique numbering; duplicate prevention; invoice matches order lines and dates; tax per adviser's rules | Finance | Invoice, order link |
| 6 | Deliver and obtain acceptance | Implementation project | Acceptance criteria met and recorded | Implementation | Acceptance record |
| 7 | Collect | Bank, billing system | Cash applied to invoice; unapplied cash investigated | Finance | Remittance |
| 8 | Dunning and escalation | Billing system, CRM | Schedule in section 5 of [02](02-REVENUE-STREAMS-AND-PRICING.md); never suspend export or deletion | Finance; account owner | Contact log |
| 9 | Reconcile | Ledger | Bank, billing system and ledger agree monthly ([09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md)) | Finance | Reconciliation |
| 10 | Revenue review | Ledger | Accountant's policy applied; billed, collected, entitled, delivered and recognized kept separate | CPA; finance | Contract memo, schedules |
| 11 | Entitle and activate | Platform | A signed order is not a launch GO; activation needs release evidence | Implementation; founder | Release record |
| 12 | Renew, change or close | CRM, contracts | Notice dates tracked (renewal review opens 120 days before term end); credits and refunds approved | Account owner; finance | Renewal record |

Semester's own customer billing is **separate** from any institutional student-account feature of the product and must not use it as its ledger (`ORDERING-AND-BILLING-OPERATIONS.md`).

## 4. Tax and marketplace questions, by topic

Each row is a **question to be answered in writing by the named professional** before the related activity starts. Status for every row: *not concluded*.

| ID | Topic | Why it arises for Semester | Question for the professional | Adviser | Needed before |
| --- | --- | --- | --- | --- | --- |
| T-01 | Sales and use tax on software, SaaS and digital subscriptions | Plus sold to students in many states; institutional contracts | Which jurisdictions tax which products; when does Semester have nexus; registration, collection and filing; exemptions for public institutions | Tax adviser | Any charge |
| T-02 | Marketplace facilitator rules | Semester would take payment for third-party services | In which states is Semester a marketplace facilitator and what must it collect and remit | Tax adviser; counsel | Marketplace open (m31) |
| T-03 | Provider tax forms and reporting | Providers are paid by or through Semester | W-9 / W-8 collection, 1099-K / 1099-NEC / 1099-MISC responsibility between Semester and any payments processor | Tax adviser; processor | First payout |
| T-04 | Money flow and licensing | Collecting from buyers and paying providers | Does the chosen funds flow (processor-managed accounts versus Semester holding funds) trigger money-transmission or similar licensing | Counsel | Marketplace design |
| T-05 | Auto-renewal and subscription law | Plus renews automatically | State and federal requirements for disclosure, consent, cancellation, reminders and refunds; interaction with existing consent text | Counsel | Plus checkout re-enabled (G3) |
| T-06 | App-store distribution | Native iOS/Android apps may sell digital subscriptions | Which purchases must use store billing, what exceptions exist, how store tax and commission are treated | Counsel; platform policy | Native app release |
| T-07 | Consumers who are minors | Students under 18 may sign up or pay | Age gating, parental consent for purchase, COPPA and state laws | Counsel | G3 |
| T-08 | Student workers, ambassadors and stipends | Campus ambassador program | Employee versus contractor versus volunteer classification; payroll tax; school-policy interactions | Counsel; tax adviser; PEO | Program launch |
| T-09 | Payroll taxes and state registration | Remote hires in several states | Registrations, withholding, unemployment, local taxes, workers' compensation | PEO; tax adviser | First out-of-state hire |
| T-10 | Research and development costs | Significant engineering spend | Current-law tax treatment of domestic software development costs and any credits | Tax adviser | First tax year |
| T-11 | Income tax posture and entity | Losses, possible equity compensation | Entity type, state filings, loss carryforwards, equity grants and valuation | Tax adviser; counsel | Entity formation |
| T-12 | International students and payers | Students outside the US; foreign institutions | VAT/GST, withholding, sanctions screening, data transfer | Tax adviser; counsel | First non-US payer |
| T-13 | Unclaimed property and credit balances | Prepaid balances, refunds, credits | Treatment and holding periods | Tax adviser | Credits issued |
| T-14 | Payment card scope | Card data passes through the processor | Confirm the hosted-checkout approach keeps Semester out of card-data scope and which attestation applies | Security assessor; processor | First charge |
| T-15 | Gross versus net presentation and recognition | Marketplace and app-store sales | Principal or agent; timing | CPA | First marketplace order |
| T-16 | Financial-aid and student-account adjacency | Product shows bills and aid for students | Confirm the product's boundary (no payment execution, no eligibility determination) is consistent with the relevant rules | Counsel | Any billing feature release |
| T-17 | Gift, discount and promotion rules | Student promos, referral credits, scholarships | Advertising claims, sweepstakes and promotion law, tax on in-kind benefits | Counsel | Any promo |
| T-18 | Insurance requirements in customer contracts | Customers will require certificates | Required coverages and limits; fit with the cyber and E&O policy | Broker; counsel | First paid pilot |

## 5. Who to engage, in what order

Order follows `GO-NO-GO-DECISION.md` priority 5 ("entity, signing, price, tax/accounting, payment and insurance authority") and the cost lines already in the model.

| Order | Adviser | Engage by | Scope | Deliverable the founder needs | Model cost line |
| ---: | --- | --- | --- | --- | --- |
| 1 | Corporate and commercial counsel (education and student-privacy experience) | Month 1 | Entity and authority, customer paper, DPA, privacy notices, minors, terms, public claims | Executed authority matrix; approved templates; completed rows of the legal queue | Legal retainer |
| 2 | CPA / outside accountant | Month 1 | Accrual books, chart of accounts, monthly close, revenue-recognition policy, tax preparation | Policy memo; monthly close; financial statements | Accounting |
| 3 | Insurance broker | Month 3 | Cyber, tech E&O, GL, D&O; contract certificate requirements | Bound program; certificates | Insurance |
| 4 | Fractional CFO / controller | Month 1 | Model ownership, budget, board package, controls | Board package; approval matrix operating | Fractional CFO (0.4 FTE) |
| 5 | Tax adviser | Before the first charge | Rows T-01 to T-14 | Written advice per row | Accounting / legal |
| 6 | Banker / processor | Before the first charge | Operating accounts, processor account, payout and reserve terms | Accounts; signer matrix | Fees |
| 7 | Payroll / PEO | Before the first hire beyond the founder | Payroll, benefits, burden, state registrations | Quote and burden rate | Payroll burden |
| 8 | Independent security assessor and accessibility assessor | Per GO priorities 2-3 | Pen test, DAST, SOC 2 readiness, accessibility review | Reports; ACR | Security programs |
| 9 | Auditor or reviewer | When an institution or investor requires | Financial statement review or audit | Report | Audit line |

## 6. Open-items register for finance

Not a replacement for `LEGAL-REVIEW-QUEUE.md`; these are the finance-origin rows that should be mirrored there when the founder agrees.

| ID | Item | Owner | Blocks | Status |
| --- | --- | --- | --- | --- |
| F-01 | Approve or replace the proposed institutional price points and pilot terms | Founder; deal desk | Any quote | Not decided |
| F-02 | Revenue recognition policy memo (questions in [02](02-REVENUE-STREAMS-AND-PRICING.md) section 6) | CPA | First invoice | Not started |
| F-03 | Tax rows T-01 to T-18 | Tax adviser; counsel | See table | Not concluded |
| F-04 | Insurance program and required limits | Broker | First paid pilot | Not started |
| F-05 | Entity, bank, signer authority and board resolution | Counsel; CPA | Any contract | Not evidenced |
| F-06 | Refund, credit and dunning policy approval | Founder; counsel | Plus checkout (G3) | Not decided |
| F-07 | Auto-renewal and cancellation terms for Plus | Counsel | G3 | Not decided |
| F-08 | Payment processor account in production, test-to-live drill | Finance; engineering | First charge | Stripe wired, not connected |
| F-09 | Financial controls operating (close, reconciliations, approvals) | Finance | Audit, diligence | Designed ([09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md)) |
| F-10 | Vendor price verification (section 4 of [03](03-COST-MODEL.md)) | Finance | Model reliance | Not started |
| F-11 | Commission plan design and accounting | CPA; counsel | First sales hire | Not designed |
| F-12 | Marketplace funds flow, terms and tax design | Counsel; tax adviser | Marketplace (m31) | Not started |
"""
    return t


def doc09():
    t = banner('09. Financial controls and finance operations', 'DESIGNED CONTROLS: NONE OPERATING; NO COMPLIANCE OR AUDIT CLAIM IS MADE')
    t += """
**Claim ceiling.** Semester may say it has designed financial controls and a finance operating calendar. **Prohibited claims.** Do not claim that financial controls are operating, independently staffed, tested or audited, that payments are live, that invoices are issued, or that revenue is collected or reconciled (`ORDERING-AND-BILLING-OPERATIONS.md`). Nothing here is an assessment against any control framework.

## 1. Objectives and constraints

Objectives: every dollar in is billed on a signed order and applied to an invoice; every dollar out is budgeted, approved and recorded; the books agree with the bank and the billing system every month; the numbers in the board package can be reproduced; and nothing depends on one person's memory.

The binding constraint is the same as in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md): there is one decision-maker. Segregation of duties is therefore built from **people outside the company** (accountant, fractional CFO, board observer), **system controls** (permissions, dual approval in tools, immutable records) and **hard caps**. Where a control cannot be separated, the page says so rather than pretending.

## 2. Structure

| Element | Proposal |
| --- | --- |
| Accounting basis | Accrual; policies per the accountant |
| Chart of accounts | Revenue by stream (student, platform, pilot, implementation, AI add-on, alumni, career, marketplace); deferred revenue; receivables; cost of revenue lines matching the model's buckets (infrastructure, AI, integrations, support, implementation, customer success, payments, marketplace); operating expense by function (engineering and product, security, sales, marketing, legal, insurance, G&A) |
| Dimensions | Segment (student, institution, marketplace), tenant, project, gate, scenario tag, funding tranche |
| Bank | Operating account, payroll account, tax-reserve account, processor payout account; two authorized signers on any account once a second officer exists; dual approval on wires above the matrix threshold |
| Processor | Hosted checkout so Semester never handles card numbers; payout reconciliation to the ledger by transaction |
| Billing | Stripe for consumer subscriptions; an invoicing tool with unique numbering for institutions; both reconciled to the ledger |
| Spend | Company cards per owner with limits; AP in the accounting system; approvals per [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md) |
| Payroll | PEO or payroll provider; payroll register reconciled to the ledger |
| FP&A | `semester-financial-model.xlsx` under version control, with verification output |
| Documents | Access-controlled repository; board data room; signed-contract register tied to the CRM |

## 3. Control matrix

All status "designed, not operating". Test = how the control is checked.

| ID | Risk | Control | Frequency | Owner | Evidence | Test |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | Invoice issued without a signed order | Invoice requires an order record with price-book version and approver | Each invoice | Finance | Order link on invoice | Sample 100% of invoices against orders monthly |
| C-02 | Duplicate or skipped invoice numbers | System-generated sequence; gaps explained | Monthly | Finance | Number sequence report | Reviewer scans for gaps |
| C-03 | Unapproved discount | Deal-desk ladder enforced in quote tool; exceptions logged | Each quote | Deal desk | Approval record | Compare list to net price on all quotes |
| C-04 | Cash not applied or misapplied | Cash application within 2 business days; unapplied cash report | Weekly | Finance | Unapplied cash list | Reviewer ages the report |
| C-05 | Billing system and ledger disagree | Reconcile subscriptions, invoices and processor payouts to the ledger | Monthly | Finance; CPA | Signed reconciliation | CPA re-performs one month a quarter |
| C-06 | Duplicate webhook or event changes balances | Idempotent event application (exists in code: `apply_payment_event`) | Continuous | Engineering | Check tests (`commercial-automation.check.sql`) | Run in CI; replay test |
| C-07 | Refund or credit abuse | Amount thresholds in the matrix; reason code; second approval over threshold | Each | Finance | Approval record | Monthly refund report review |
| C-08 | Payment to a fraudulent vendor | New-vendor onboarding (W-9, security review if data); bank-detail change call-back to a known number | Each | Finance | Vendor file | Quarterly sample |
| C-09 | Unauthorized payment | Payment approval per matrix; bank dual control when available; card limits | Each | Finance | Approval trail | Monthly review of payments over $5,000 |
| C-10 | Unbudgeted commitment | Contract signing authority table; PO or approval before signature | Each | Founder; finance | Approval record | Monthly commitments report vs budget |
| C-11 | Payroll error or ghost employee | Payroll provider runs; register reconciled to HR roster and ledger; new-hire form approved | Each run | Finance | Register, roster | CPA reviews quarterly |
| C-12 | Revenue recorded before it is earned | Accountant's policy applied; no recognition from unsigned, unapproved-price, unaccepted or unverifiable items | Monthly | CPA | Contract memos, schedules | CPA review; auditor later |
| C-13 | Cut-off errors | Close calendar; accrual checklist; subsequent-payments review | Monthly | Finance | Close checklist | Reviewer sign-off |
| C-14 | Deferred revenue and receivables misstated | Roll-forward schedules tied to billing system | Monthly | Finance | Schedules | CPA recompute |
| C-15 | AI vendor invoice does not match usage | Reconcile provider invoices to `private.ai_usage_month` by tenant and model | Monthly | Finance; engineering | Reconciliation | Variance over 5% investigated |
| C-16 | AI spend overrun for a tenant | Per-tenant monthly budget (`private.reserve_ai_budget`); alert at 80% | Continuous | Engineering | Budget table, alerts | Quarterly test of the cap and kill switch |
| C-17 | Tax filing missed | Tax calendar from the adviser; registrations tracker; reminders to two people | Monthly | Finance; tax adviser | Calendar, filings | CPA confirms filed |
| C-18 | Model error reaches the board | Version-controlled model; verification run printed on the pack; reviewer opens changed assumptions | Each pack | Finance | `verify.py` and `independent_check.py` output | Reviewer reperforms headline numbers |
| C-19 | Unauthorized access to finance systems | Least privilege; MFA; quarterly access review; role changes revoke access | Quarterly | Founder | Access review record | Compare users to roster |
| C-20 | Student data in finance reports | Aggregate-only reporting; small-cell suppression; no student identifiers in the ledger or board data room | Each pack | Finance; privacy | Pack checklist | Reviewer scan |
| C-21 | Insurance lapses or is inadequate | Renewal calendar; contract requirements checked at each signature | Quarterly | Finance; broker | Policies, certificates | Broker confirms |
| C-22 | Cash falls below minimum | 13-week forecast; runway triggers in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md) | Weekly | Finance | Forecast | Board sees it quarterly |
| C-23 | Related-party or conflicted spend | Disclosure; board approval | Each | Founder; board | Register | Annual attestation |
| C-24 | Records lost or destroyed early | Retention schedule from counsel and the CPA; legal holds override | Annual | Finance; counsel | Schedule | Spot check |

## 4. Segregation of duties

| Function | Initiate | Approve | Execute | Record | Reconcile | Today's compensating control |
| --- | --- | --- | --- | --- | --- | --- |
| Customer invoice | Finance | Founder | Finance | Finance | CPA | CPA samples all invoices monthly |
| Vendor payment | Budget owner | Per matrix | Finance | Finance | CPA | Call-back for new bank details; cap |
| Payroll | Finance | Founder | PEO | PEO | CPA | Provider-run payroll |
| Refund or credit | Support | Finance | Finance | Finance | CPA | Cap and monthly report |
| Journal entry | Finance | Reviewer (CPA/fractional CFO) | | | | No manual entry without reviewer |
| Bank account changes | Founder | Board resolution | Bank | | | Dual notification |

## 5. Month-end close calendar (target business days)

| Day | Task | Owner |
| --- | --- | --- |
| BD-1 | Freeze: all invoices dated in the month issued; cut-off reminders to owners | Finance |
| BD+1 | Bank and processor statements pulled; cash application finished | Finance |
| BD+2 | Reconcile bank, processor payouts, billing system to ledger | Finance |
| BD+3 | AR aging and collections review; unapplied cash cleared; AI vendor invoice reconciliation | Finance |
| BD+4 | Payroll register reconciled; accruals (unbilled, bonuses, vendors) | Finance |
| BD+5 | Deferred revenue and receivables roll-forwards; revenue schedule per accountant's policy | Finance; CPA |
| BD+6 | Expense review; budget-versus-actual and variance notes from owners | Finance; owners |
| BD+7 | Close the books; reviewer sign-off | CPA / fractional CFO |
| BD+8 | Management pack; model actuals loaded; forecast refreshed | Finance |
| BD+10 | Pack to founder and board observers | Finance |

## 6. Calendar

| Frequency | Activity |
| --- | --- |
| Daily | Processor and bank alerts; disputes and failed payments queue |
| Weekly | Cash and 13-week forecast; invoices due; approvals pending; operating flash |
| Monthly | Close; reconciliations; AR collections; AI usage reconciliation; pack |
| Quarterly | Board package; reforecast; access review; sales-tax and estimated-tax checks; vendor and insurance review; refund and discount review; price review; control testing sample |
| Annual | Budget and tranche request; tax filings; financial statement review or audit; policy refresh; records retention review; insurance renewal; model re-baseline |

## 7. Systems

Selection criteria, not endorsements: accrual ledger with audit trail and role-based access, integration with the bank and processor, usage-based invoicing capability, revenue schedule support, document attachment per transaction, approval workflows, SOC reports from the vendor, export on exit. Candidates are evaluated with the accountant, because the accountant must be able to work in the ledger. The billing and subscription system of record for consumer plans is the existing `subscriptions` / `invoices` / `dunning_cases` data, with Stripe as processor; it is not the ledger.

## 8. Data lineage for the numbers

| Metric | Source | Owner | Refresh |
| --- | --- | --- | --- |
| Paying subscribers, plan mix, churn | `subscriptions`, processor | Finance | Daily |
| Billings, collections | Invoicing tool, bank, processor | Finance | Daily |
| Recognized revenue, deferred revenue | Ledger under the accountant's policy | CPA / finance | Monthly |
| Active users (free, paying, sponsored) | Analytics marks defined in `ANALYTICS.md`; new marks only through D-005 | Product | Weekly |
| AI tokens and cost | `private.ai_usage_month`, provider invoices | Engineering; finance | Monthly |
| Pipeline and bookings | CRM; signed orders only | Sales | Weekly |
| Implementation hours | Time tracking on projects | Implementation | Weekly |
| Support tickets | Support queue | Support | Weekly |
| Headcount and payroll | HR roster, payroll provider | Finance | Monthly |

## 9. Model governance

The workbook is source-controlled with its generator. A change to an assumption is a commit that states the evidence; `verify.py` must report zero mismatches and `independent_check.py` must pass before a pack is issued; the reviewer opens the Assumptions diff. Actuals replace plan values only when they are real readings; a plan value is never silently overwritten by an estimate. Scenarios are not forecasts and carry that label in the pack.
"""
    return t
