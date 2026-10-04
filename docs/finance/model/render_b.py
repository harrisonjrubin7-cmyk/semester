"""Documents 01 (assumptions), 02 (revenue streams and pricing), 03 (cost model), 10 (board package)."""
import engine, spec, analysis
from results import *
from render_a import CLAIM, A

TAGNAME = {'FACT': 'In the repository today', 'POLICY': 'Proposed default already in the repository (deal-desk.ts), not approved', 'HYP': 'Hypothesis: no evidence yet',
           'VENDOR': 'Vendor price or rate: verify the vendor\'s current terms', 'PRO': 'Needs a qualified professional (accountant, tax adviser, counsel, broker)',
           'ILLUS': 'Illustrative placeholder', 'DECIDE': 'A founder or authorized-reviewer decision not yet made'}


def fmtv(v, unit):
    if isinstance(v, (tuple, list)):
        return ' / '.join(fmtv(x, unit) for x in v)
    if unit in ('%', '%/mo'):
        return pc(v, 2 if 0 < v < 0.01 else 1)
    if isinstance(v, float) and v < 100:
        return f'{v:,.3f}'.rstrip('0').rstrip('.') if v < 1 else f'{v:,.2f}'
    return f'{v:,.0f}'


def doc01():
    t = banner('01. Assumptions register and evidence plan', 'PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST')
    counts = {}
    n = 0
    for k, label, unit, v, tag, note in spec.ASSUMPTIONS:
        if label: counts[tag] = counts.get(tag, 0) + 1; n += 1
    for key, label, unit, vals, tag, note in spec.TIER_ASSUMPTIONS:
        counts[tag] = counts.get(tag, 0) + 3; n += 3
    for k, label, unit, vals, tag, note in spec.ANNUAL:
        if label: counts[tag] = counts.get(tag, 0) + 3; n += 3
    t += f"""
{CLAIM}

This is the rule the model is held to, taken from the master prompt's decision discipline: *state assumptions explicitly, and label facts, design decisions, hypotheses and legal-review items differently.* Every input of the workbook carries one tag. Of the {n} input values in the workbook, the mix is:

""" + table(['Tag', 'Meaning', 'Inputs'], [[f'`{k}`', TAGNAME[k], counts.get(k, 0)] for k in ['FACT', 'POLICY', 'DECIDE', 'HYP', 'VENDOR', 'PRO', 'ILLUS']], ['l', 'l', 'r'])
    t += """

The honest reading is that almost nothing in the model is observed. The company has no paying customer, no paid pilot, no measured delivery cost and no price book (`docs/commercial/PRICING-AND-PACKAGING.md`: *no approved current price book, validated willingness-to-pay, observed delivery-cost baseline, margin floor, tax posture, payment authority or paying-customer result is evidenced*). The model is therefore a way to **rank what to measure first**, not a prediction.

## What is a fact

Only these come from the repository as it stands:

* **Plus is $7.99 a month or $59 a year** (D-134; the catalog charges it; `plans.test.ts` holds the page to it). New individual checkout is held by `INDIVIDUAL_PAID_ACQUISITION_ENABLED = false`.
* **Pilots run 26 weeks** (D-134, `PILOT_WEEKS`).
* **Anthropic list prices** for Haiku 4.5, Sonnet 5.5 and Opus 5.5 (API reference, cached 2026-09-25).
* **Stripe is wired, not connected;** consumer dunning has a 14-day grace; export and deletion survive every plan state (`docs/COMMERCIAL-CORE.md`).
* **The deal-desk policy numbers** are *proposed defaults* in `app/src/lib/governance/deal-desk.ts` (minimum ACV $15k pilot / $25k department / $75k campus / $200k system; discount ladder; 50% maximum pilot credit; $10k implementation-fee floor). They are tagged `POLICY`, not fact.
* **The gates:** paid individual acquisition, paid institutional pilots and broad enterprise sale are NO-GO (`GO-NO-GO-DECISION.md`, 3 Oct 2026).

## The ten assumptions to test first

Ranked by how far each moves the funding need or the month-36 ARR (sensitivity table in [06](06-SCENARIOS-AND-SENSITIVITIES.md)), then by how cheaply it can be measured.

| # | Assumption | Why it matters | How to get evidence | Earliest source |
| ---: | --- | --- | --- | --- |
| 1 | Gate timing (G1 to G5) | Moves peak funding by about $1M per 3-6 months | Close GO priorities 1-9 and date each; the evaluator in `release-profiles.ts` records authority | Founder, counsel, assessors |
| 2 | Paid-pilot and direct-deal volume | Largest revenue-side driver | Qualified pipeline log from discovery calls; signed orders only count | CRM (`docs/commercial/CRM-DATA-MODEL.md`) |
| 3 | Institutional price acceptance (ACV, pilot fee, implementation fee) | Sets revenue per account and the services margin | Quote 5 prospects at the proposed numbers; record accept / counter / refuse | Deal desk |
| 4 | Implementation hours per account | Decides services margin; the team is the biggest COGS line | Time-track the first design-partner pilot by task | Implementation lead |
| 5 | Pilot-to-annual conversion | Drives logos and ARR | Pilot scorecard at the 26-week closeout | `PILOT-SCORECARD.md` |
| 6 | Loaded cost of people | About two-thirds of all cost | Written offers, PEO or payroll quote for burden | Finance |
| 7 | AI cost per request and requests per user | 7-22% of revenue depending on the scenario | Join `private.ai_usage_month` tokens to model price monthly | Engineering, finance |
| 8 | Free-to-paid conversion, free-tier AI use, paying churn | Decides whether Plus pays its way | Invitation-only cohort, then G3 | Product analytics (D-005 for any new mark) |
| 9 | Vendor, audit, insurance and counsel quotes | About $0.3M to $0.7M a year of program cost | Three quotes each: pen test, SOC 2, cyber/E&O, counsel retainer | Finance |
| 10 | Support contact rate and cost per ticket | Sets support headcount | Ticket log from the cohort | Support |

## Register

Every input follows. Month 1 is January 2027; money is USD. `Source / note` says where the number comes from or what would change it. Scenario multipliers are on the `Scenarios` sheet and defined in [06](06-SCENARIOS-AND-SENSITIVITIES.md). Headcount is on [03](03-COST-MODEL.md); pipeline schedules are on the workbook's `Schedules` sheet.

"""
    rows, grp = [], None
    def flush():
        nonlocal rows, grp
        if rows:
            return f'### {grp}\n\n' + table(['Input', 'Value', 'Unit', 'Tag', 'Source / note'], rows, ['l', 'r', 'l', 'l', 'l']) + '\n\n'
        return ''
    out = ''
    for k, label, unit, v, tag, note in spec.ASSUMPTIONS:
        if label is None:
            out += flush(); rows = []; grp = k.replace('## ', ''); continue
        rows.append([f'{label} (`{k}`)', fmtv(v, unit), unit, tag, note])
    out += flush()
    out += '### Institutional tiers (Department / Campus / System)\n\n' + table(
        ['Input', 'Department / Campus / System', 'Unit', 'Tag', 'Source / note'],
        [[f'{label} (`{key}`)', fmtv(vals, unit), unit, tag, note] for key, label, unit, vals, tag, note in spec.TIER_ASSUMPTIONS], ['l', 'r', 'l', 'l', 'l']) + '\n\n'
    rows, grp = [], None
    for k, label, unit, vals, tag, note in spec.ANNUAL:
        if label is None:
            out += flush(); rows = []; grp = 'Year-dependent: ' + k.replace('## ', ''); continue
        rows.append([f'{label} (`{k}`)', fmtv(vals, unit), unit, tag, note])
    out += flush()
    out += '### Derived (formulas)\n\n' + table(['Input', 'Meaning'], [[f'`{k}`', f'{label} ({unit}). {note}'] for k, label, unit, expr, note in spec.DERIVED], ['l', 'l']) + '\n'
    return t + out


def doc02():
    o, k = run(1)
    tiers, infra_mau, sup_mau = analysis.tier_economics()
    t = banner('02. Revenue streams, pricing and packaging architecture', 'PLANNING MODEL: NO CURRENT PRICE BOOK OR SELLING AUTHORITY',
               [('Boundary', 'Proposes numbers for approval. Does not publish, quote or charge anything. Conflicts with the approved price book, once one exists, resolve to the approved price book.')])
    t += f"""
{CLAIM}

Everything marked **PROPOSED** below is an input to the deal desk and to the approvers in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md). `docs/commercial/PRICING-AND-PACKAGING.md` is explicit: *do not publish, quote or charge an unapproved number; do not claim affordability, savings, ROI, market validation, margin, discount availability or annual conversion economics without evidence and authority.* The only prices that are live are Plus at $7.99 a month / $59 a year (D-134).

## 1. The seven revenue streams in the model

"""
    rev = lambda n, y: ys(o, n, y)
    streams = [
     ('Student subscription (Plus)', 'The student', 'Per student per month or year', 'stud_rev', 'G3 (broad/paid individual)', 'Does not fund its own acquisition at Base conversion; free tier is a cost'),
     ('Institutional platform', 'Provost, CIO, student success, registrar, dean', 'Annual platform fee by tier (department / campus / system) plus pilot fee', None, 'G2 paid pilots, G4 direct, G5 enterprise', 'Gates, procurement time, renewal at first term'),
     ('Implementation services', 'The institution', 'Fixed-scope fee plus change orders; integration pack', 'svc_rev', 'With each billable institution', 'Hours per account; margin depends on utilization'),
     ('AI usage (capacity add-on)', 'The institution (managed capacity); student only as an included allowance', 'Annual capacity pack by tier; allowance inside plans', 'ai_rev', 'Month 20', 'Unit-cost drift; open-ended student metering is excluded'),
     ('Marketplace', 'Student pays provider; Semester takes a commission', 'Take rate on GMV (net presentation)', 'mk_rev', 'Month 31', 'Consumer protection, provider governance, tax, refunds, disputes must mature first'),
     ('Career / employer', 'Employer or career services', 'Employer account per year', 'career_rev', 'Month 25', 'Employment and anti-discrimination law; student choice and consent'),
     ('Alumni', 'Alumni or advancement office', 'Module fee by tier', 'alumni_rev', 'Month 30', 'Needs live annual customers; sells institutional value, not learner data'),
    ]
    rows = []
    for name, payer, basis, key, gate, risk in streams:
        if key is None:
            vals = [ys(o, 'pilot_rev', y) + ys(o, 'core_rev', y) for y in range(3)]
        else:
            vals = [ys(o, key, y) for y in range(3)]
        tot3 = ys(o, 'rev_total', 2)
        rows.append([name, payer, basis, *[fk(v) for v in vals], pc(vals[2] / tot3, 0), gate, risk])
    t += table(['Stream', 'Who pays', 'Pricing basis', 'Y1 $k', 'Y2 $k', 'Y3 $k', 'Share of Y3', 'Gate / earliest', 'Main risk'], rows, ['l', 'l', 'l', 'r', 'r', 'r', 'r', 'l', 'l'])
    t += f"""

Reading: about {pc(ys(o,'svc_rev',2)/ys(o,'rev_total',2), 0)} of Year 3 revenue is implementation services, which is non-recurring and is **excluded from ARR**; quality of revenue improves only as the platform's share grows. In Year 3 about {pc((ys(o,'pilot_rev',2)+ys(o,'core_rev',2)+ys(o,'svc_rev',2))/ys(o,'rev_total',2), 0)} of revenue is institutional platform, pilot and implementation. The company is an institutional business with a student product, which is also what the audit's launch strategy says ("student-led value layer" first, institutional system of engagement second). The family/guardian companion has **no standalone price** in this model; its entitlements would sit inside Plus and institutional packages. Whether to price it separately is a decision for the founder after the invitation-only cohort.

## 2. Packages and proposed prices

The catalog (`supabase/migrations/20260929070000_commercial_core.sql`) already names the packages. The model maps its three institutional tiers onto them.

| Catalog plan | Model tier | Status of price | Proposed (not approved) |
| --- | --- | --- | --- |
| `free` | Free | Live ($0) | Always includes export, deletion, saved plans, accessibility and safety features |
| `plus` | Plus | **Live: $7.99 / month, $59 / year** (new checkout held) | No change proposed; student promo discount modeled at {pc(A['stud_disc'], 0)} average, needs counsel review before it is advertised |
| `pro` | not modeled | No price | Decision needed: collapse into Plus or define a distinct entitlement set |
| `registration_pilot` | Paid pilot, 26 weeks | Quote-only; NO-GO to accept payment today | Department ${A['pilotfee_D']:,.0f}, Campus ${A['pilotfee_C']:,.0f}, System ${A['pilotfee_Y']:,.0f}, plus implementation fee; 50% credit toward year one on conversion |
| `department_launch` | Department | Quote-only | List ${A['acv_D']:,.0f} a year |
| `semester_access`, `native_lms` | Campus | Quote-only | List ${A['acv_C']:,.0f} a year |
| `university_os` | System | Quote-only; enterprise NO-GO | List ${A['acv_Y']:,.0f} a year |
| `implementation` | Services | Quote-only | Department ${A['impl_D']:,.0f}, Campus ${A['impl_C']:,.0f}, System ${A['impl_Y']:,.0f}; integration pack ${A['int_fee']:,.0f} |
| (new) AI capacity add-on | Add-on | none | Department ${A['ai_price_D']:,.0f}, Campus ${A['ai_price_C']:,.0f}, System ${A['ai_price_Y']:,.0f} a year |
| (new) Alumni module | Add-on | none | Campus ${spec.ALUMNI_PRICE['C']:,.0f}, System ${spec.ALUMNI_PRICE['Y']:,.0f} a year |
| (new) Employer account | Add-on | none | ${A['career_acv']:,.0f} a year |
| (new) Marketplace | Commission | none | {pc(A['mk_take'], 0)} of GMV |

**Corridor checks the proposed numbers must keep passing** (the table is computed from the model's inputs; the numbered items are rules):

""" + table(['Tier', 'Net ACV per active student per year', 'Variable cost per active student per year', 'Plus annual list', 'Check'],
            [[spec.TIER_NAMES[x], f"${tiers[x]['per_student']:.2f}", f"${(tiers[x]['var_yr'] / tiers[x]['students']):.2f}", '$59', 'below the consumer ceiling' if tiers[x]['per_student'] <= 59 else 'ABOVE the consumer ceiling'] for x in 'DCY'], ['l', 'r', 'r', 'r', 'l']) + f"""

1. **Consumer ceiling.** An institution should not pay more per active student than a student would pay for Plus, or the buyer's first question has a free answer. Department is closest ({tiers['D']['per_student']:.0f} against 59).
2. **Cost floor.** Net price per active student stays above at least four times its variable cost (the model has about ${tiers['Y']['var_yr'] / tiers['Y']['students']:.0f} to ${tiers['D']['var_yr'] / tiers['D']['students']:.0f} a year).
3. **Deal-desk floor.** Department list stays at or above the $25k minimum, Campus above $75k, System above $200k, pilot at or above $15k, implementation fee at or above $10k (all `DEAL_POLICY` defaults).
4. **Bands, not seats.** The audit prices on active-user or enrolled-student bands; the deal desk today has tier minimums only. A band table (active students to price) is an open item for the deal desk, and Department-versus-Campus boundaries should be tested against real rosters.
5. **Total cost of ownership.** The business case calculator (D-1042) takes Semester's price from the school's own quote and counts a system as removed only when its contract has ended and the replacement exists. No published price may be used to make that calculator look better.

## 3. Entitlement architecture

*A subscription grants entitlements and never authorization* (`COMMERCIAL-CORE.md`): no policy on student data reads a commercial table. Entitlements are rows in `plan_entitlements`; the keys that exist today are `plan.multiple`, `calendar.sync`, `export.formats`, `reminders.expanded`, `tenant.sso`, `tenant.cohorts` and `support.tier`.

| Capability | Free | Plus | Department | Campus | System | Notes |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| Export all data, delete account, keep saved plans | yes | yes | yes | yes | yes | Never paywalled, never suspended for non-payment |
| Accessibility features and safety/crisis resources | yes | yes | yes | yes | yes | Never gated |
| Core planning, Today, courses, study tools | yes | yes | yes | yes | yes | Free tier is a safe useful core |
| Multiple term plans, calendar sync, extra export formats, expanded reminders | no | yes | via institution | via institution | via institution | Existing keys |
| AI assistant allowance | capped | higher | institution-set | institution-set | institution-set | Proposed key `ai.allowance`; cap is a product decision |
| Institution AI capacity pool | no | no | add-on | add-on | add-on | Proposed key `ai.capacity_pool` |
| SSO / SCIM | no | no | optional | yes | yes | `tenant.sso` |
| Cohorts | no | no | 1 | many | many | `tenant.cohorts` |
| Connectors (SIS / LMS) | no | no | pack | pack | included scope | Priced separately; proposed key `tenant.integrations` |
| Support tier | community | standard | standard | extended | critical 24x7 | `support.tier`; 24x7 is a contract promise and must match staffed coverage |
| Alumni, employer, marketplace modules | no | no | add-on | add-on | add-on | Proposed keys, each behind its own gate |

Rules finance needs engineering to keep true: (a) every entitlement a plan grants has a named cost driver in the model, (b) a plan downgrade or lapse removes entitlements, never data, (c) a tenant's plan changes only through a signed order form (the existing trigger), (d) usage entitlements (AI) have a counted unit that matches the invoice, and (e) a support tier is sold only if staffed coverage exists (`GO-NO-GO-DECISION.md` priority 6).

## 4. Discounts, approvals and what can never be discounted

Source: `app/src/lib/governance/deal-desk.ts`, `DEAL_POLICY`. These are **proposed defaults**; finance sets the real figures with its sign-off in the commit.

| Rule | Proposed default | Approver |
| --- | --- | --- |
| Discount up to 10% | allowed | Sales lead |
| Discount over 10% up to 20% | allowed | Sales lead + finance |
| Discount over 20% up to 30% | allowed | Sales lead + finance + CEO |
| Discount over 30% up to 40% | allowed | Sales lead + finance + CEO + board |
| Discount over 40% | refused | none |
| Multi-year | 3% per year beyond the first, capped at 9% | within ladder |
| Pilot credit | at most 50% of first-year value; defined eligible software fees only | finance |
| Pilot length | exactly 26 weeks (D-134), then convert or end | deal desk |
| Implementation fee | floor $10k; waivable only as capped pilot credit | finance |
| AI / compute overage | must be written into every order | deal desk |
| Scholarship, low-income, nonprofit or system pricing | an approved programme; finance approves; counts against the ladder | finance |
| Custom work | product approval and a scorecard first | product |
| "Free forever" enterprise commitments | refused | none |

The model's realized discount is {pc(A['inst_disc'], 0)} (inside the finance tier). Every discount buys something: a longer term, prepayment, reference rights (with counsel-approved wording), reduced scope or a faster decision. **Never discount away** security, privacy, accessibility, support or clean-exit (offboarding) work. Student promotional pricing needs its own approval and a claims check (`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`).

## 5. Billing and collections

**Consumer (live in code, off in operation).** Stripe Checkout with recorded consent, signed webhook, idempotent event application, cancel at period end, hourly dunning (reminder after three quiet days, final notice naming the restriction date, 14-day grace, then paid entitlements removed; data, export and deletion untouched). Missing tax address is a separate state and does not open dunning. See `COMMERCIAL-CORE.md`. What is *not* in place and gates any real charge: merchant account and bank, tax registration and rates, refund and chargeback operation, payment-fee reconciliation, the app-store question ({pc(A['iap_share'], 0)} of student billings are assumed to flow through app stores at {pc(A['iap_fee'], 0)}, **a platform-policy and counsel question**).

**Institutional (process only).** `ORDERING-AND-BILLING-OPERATIONS.md` is the controlling process: qualify, quote from the approved price book, review and contract, create the order after signature, invoice through the approved system with unique numbering, collect and reconcile, entitle and activate (a signed order is not a launch GO), close. Proposed commercial terms for counsel and the CPA to confirm (none is decided):

| Term | Proposal for review |
| --- | --- |
| Billing frequency | Annual in advance for platform; pilot fee at start; implementation fee 50% at signature and 50% at go-live (the model bills 100% at start, which is the simpler and more conservative cash view) |
| Payment terms | Net 30; the model collects after two months on invoiced items, which is deliberately slower |
| Purchase orders and vendor forms | Required before activation for any customer that needs them; W-9 and vendor registration at signature |
| Late payment | Reminder at due date, then days 15, 30 and 45 with named escalation; interest or fees only if counsel approves the clause |
| Suspension for non-payment | Never of export, deletion or other non-waivable data-rights handling; any other restriction needs customer notice per contract |
| Refunds and credits | Only under the written policy; service credits are contra-revenue and need approval |
| Taxes | Quoted exclusive of tax; exemption certificates collected; sales-tax treatment of software and services by state is a tax adviser question |
| Renewals | No auto-renewal assumed in the model; renewal terms are counsel's call; notice dates tracked (renewal opportunity opens 120 days before term end) |

## 6. Revenue recognition: questions for the accountant

`docs/commercial/REVENUE-RECOGNITION-REVIEW-CHECKLIST.md` is the fact-gathering template. These are the questions this model raises. **None is answered here, and the model's treatment is a planning proxy only.**

1. Which accounting framework and entity structure apply, and when does revenue first become recognizable at all (the model books none before a signed, enforceable order)?
2. Is the 26-week pilot software fee recognized over the pilot term, and is a no-fee design-partner term or a pilot credit a modification, a discount or a material right?
3. Are the platform subscription, implementation, integration pack and support distinct performance obligations, and how is the transaction price allocated? Is implementation a customer deliverable or only set-up that enables the service?
4. When a pilot converts to an annual contract with a credit, is that a contract modification or a new contract?
5. Treatment of usage-based AI capacity, overage, and service credits as variable consideration.
6. Marketplace: principal or agent, gross or net, and timing of recognition against payouts and refunds.
7. Commissions and incremental costs of obtaining a contract: capitalize or expense, and over what period.
8. Deferred revenue and contract-asset presentation for annual prepaid and milestone-billed items.
9. Consumer subscriptions sold through app stores: gross or net of the store's commission.
10. Refund and chargeback reserves; bad-debt (expected credit loss) method for institutional receivables.
11. Cut-off and period controls for the monthly close, and what evidence the auditor will want for usage-based revenue.
12. Software development costs: capitalization versus expense (the model expenses everything).
13. Sales tax / VAT collected as a liability, not revenue; nexus triggers by state and country (tax adviser).
14. Whether stock or deferred-compensation arrangements for founders or advisers affect payroll cost (not modeled).

## 7. Price-book change control

A price enters customer view only through this path: proposal here, deal-desk review, authorized approval recorded as `docs/decisions/D-<pull request number>.md`, catalog migration, `plans.test.ts` and `commercial-automation.check.sql` green (they already hold Plus to $7.99 and $59), then the public claims register. A price found in code, a test, a mock page or a planning document is not an approved price. Price reviews are quarterly, or on any vendor cost move over 20%.
"""
    return t


def doc03():
    o, k = run(1)
    t = banner('03. Cost model', 'PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST')
    t += f"""
{CLAIM}

Every cost line has a driver, an owner and a way to be verified. Vendor prices are allowances, tagged `VENDOR`; **no vendor price here is quoted from a contract.** The workbook computes each line monthly; the table gives the Base scenario by year.

## 1. Cost lines, drivers and amounts ($ thousands, Base)

"""
    lines = [
     ('Engineering, product and design payroll', 'opex_eng', 'Headcount plan (section 3)', 'CTO'),
     ('Security and privacy (payroll + programs)', 'opex_sec', 'Pen test, SOC 2, accessibility audit, GRC, privacy assessments, bug bounty, security engineer', 'CISO (acting: founder)'),
     ('Infrastructure: database, compute, functions', 'c_compute', f"{A['infra_compute']:.3f} $/MAU/mo", 'CTO'),
     ('Infrastructure: storage incl. backups and DR', 'c_storage', f"{A['gb_per_mau']} GB x ${A['storage_price']}/GB x {A['repl_factor']}", 'CTO'),
     ('Infrastructure: bandwidth / egress', 'c_bandwidth', f"{A['egress_gb']} GB x ${A['egress_price']}/GB, {pc(A['cdn_offload'],0)} cached", 'CTO'),
     ('Infrastructure: search and vector index', 'c_search', f"{A['search_per_mau']:.3f} $/MAU/mo", 'CTO'),
     ('Infrastructure: notifications', 'c_notif', f"{A['notif_per_mau']:.3f} $/MAU/mo", 'CTO'),
     ('Infrastructure: observability', 'c_obs', f"{A['obs_per_mau']:.3f} $/MAU/mo", 'CTO'),
     ('Infrastructure: fixed platform (prod, staging, DR, tooling)', 'c_infra_fixed', 'Flat by year', 'CTO'),
     ('AI inference (variable)', 'c_ai_var', 'Requests x cost per request x scenario multipliers', 'AI governance board / finance'),
     ('AI evaluation, red-team, monitoring (fixed)', 'c_ai_fixed', 'Flat by year', 'AI governance board'),
     ('Integrations: connectors and SSO/SCIM', 'c_integ', f"${A['conn_cost']:.0f} x {pc(A['conn_attach'],0)} + ${A['sso_cost']:.0f} per institution per month", 'Integration lead'),
     ('Support payroll', 'pay_SUPPORT', 'Headcount plan', 'Support lead'),
     ('Support overflow (outsourced tier 1)', 'c_support_var', f"tickets x {pc(A['overflow_share'],0)} x ${A['overflow_cost']:.0f}", 'Support lead'),
     ('Implementation payroll', 'pay_IMPL', 'Headcount plan, paced to demanded hours', 'Implementation lead'),
     ('Customer success payroll', 'pay_CS', 'Headcount plan', 'CS lead'),
     ('Trust and safety payroll', 'pay_TS', 'Headcount plan (marketplace)', 'Trust & safety lead'),
     ('Payment processing and app-store fees (student)', 'c_payments', f"{pc(A['stripe_pct'],1)} + ${A['stripe_fix']:.2f}; {pc(A['iap_share'],0)} via app stores at {pc(A['iap_fee'],0)}", 'Finance'),
     ('Marketplace payments, disputes, moderation', 'c_mk', 'GMV and orders', 'Marketplace owner'),
     ('Sales payroll', 'pay_SALES', 'Headcount plan, gated', 'CRO (acting: founder)'),
     ('Sales commissions', 'commissions', f"{pc(A['comm_rate'],0)} of new-logo bookings", 'CRO / finance'),
     ('Sales tools, events, travel, RFP support', 'sales_other', 'Flat by year', 'CRO'),
     ('Marketing payroll', 'pay_MKT', 'Headcount plan', 'CMO (acting: founder)'),
     ('Paid student acquisition (test budget)', 'paid_ua', 'Zero before gate G3', 'Growth lead'),
     ('Brand, ambassadors, PR, user research', 'mkt_other', 'Flat by year', 'CMO'),
     ('Legal', 'legal', 'Counsel retainer, IP, contract playbook', 'Founder + counsel'),
     ('Insurance', 'insurance', 'Cyber + tech E&O, GL, D&O', 'Finance + broker'),
     ('Accounting, audit, finance systems', 'fin_admin', 'Outsourced accounting, review/audit, billing and FP&A tools', 'Finance'),
     ('G&A payroll (leadership, finance, compliance, ops)', 'pay_GA', 'Headcount plan', 'Founder'),
     ('Software, workspace, training per FTE', 'tools_etc', f"${A['sw_per_fte'] + A['rent_per_fte'] + A['train_per_fte']:.0f} per FTE per month", 'Finance'),
     ('Internal travel and offsites', 'travel_int', 'Flat by year', 'Finance'),
     ('Recruiting and equipment', 'recruit', f"${A['recruit_per_hire']:,.0f} + ${A['equip_per_hire']:,.0f} per hire from month 2", 'Finance'),
     ('Contingency', 'contingency', f"{pc(A['contingency'],0)} on non-payroll program lines", 'Finance'),
     ('Bad debt', 'bad_debt', f"{pc(A['bad_debt'],0)} of invoiced billings", 'Finance'),
    ]
    rows = [[n, d, *[fk(ys(o, key, y)) for y in range(3)], own] for n, key, d, own in lines]
    tot = ['**Total cost (cost of revenue + operating expenses)**', '', *[f'**{fk(ys(o, "cogs", y) + ys(o, "opex", y))}**' for y in range(3)], '']
    rows.append(tot)
    for y in range(3):   # the lines must add up to the total, or a cost is missing or counted twice
        s = sum(ys(o, key, y) for n, key, d, own in lines)
        assert abs(s - (ys(o, 'cogs', y) + ys(o, 'opex', y))) < 1.0, ('cost lines do not sum to total', y, s)
    t += table(['Cost line', 'Driver', 'Y1', 'Y2', 'Y3', 'Owner'], rows, ['l', 'l', 'r', 'r', 'r', 'l'])
    t += """

The incident-response line is zero in Base and is loaded only in the Incident scenario ([06](06-SCENARIOS-AND-SENSITIVITIES.md)).

## 2. Variable cost per active user per month

| Component | Per MAU per month | Basis |
| --- | ---: | --- |
"""
    inf = [('Database, compute, functions', A['infra_compute']), ('Storage with backups and DR', A['gb_per_mau'] * A['storage_price'] * A['repl_factor']),
           ('Bandwidth after CDN', A['egress_gb'] * A['egress_price'] * (1 - A['cdn_offload'])), ('Search and vector', A['search_per_mau']),
           ('Notifications', A['notif_per_mau']), ('Observability', A['obs_per_mau'])]
    for n, v in inf:
        t += f'| {n} | ${v:.4f} | planning allowance (`VENDOR`) |\n'
    tot_inf = sum(v for n, v in inf)
    ai = analysis.ai_buildup()
    t += f"| **Infrastructure subtotal** | **${tot_inf:.4f}** | |\n| AI, free user ({A['req_free']} requests) | ${ai['free']:.4f} | [05](05-UNIT-ECONOMICS-DASHBOARD.md) |\n| AI, paying user ({A['req_paid']} requests) | ${ai['paid']:.4f} | |\n| AI, sponsored user ({A['req_inst']} requests) | ${ai['inst']:.4f} | |\n"
    t += f"""
Total variable cost: about ${tot_inf + ai['free']:.2f} for a free user, ${tot_inf + ai['paid']:.2f} for a paying user, ${tot_inf + ai['inst']:.2f} for a sponsored user, per month. Plus brings in $4.92 to $7.99 a month before fees.

## 3. Headcount plan (the largest cost)

Roles are **capacity placeholders, not offers**: no one is hired, and every start month is a proposal. "Gated" roles are the ones the Enterprise-delayed-with-gated-hiring scenario shifts six months; in the Base plan their start months already sit at their gates, so the rule is *they are released by the gate, not by the calendar*. Salaries are `HYP` pending offers and a PEO or payroll quote; burden is {pc(A['burden'], 0)} (`PRO`).

"""
    rows = []
    for fn in ['GA', 'ENG', 'PROD', 'SEC', 'SUPPORT', 'IMPL', 'CS', 'TS', 'SALES', 'MKT']:
        rs = [r for r in spec.HEADCOUNT if r[2] == fn and r[7] == 0]
        fte = lambda m: sum(r[3] for r in rs if r[4] <= m)
        rows.append([spec.FN_LABEL[fn], f'{fte(12):.1f}', f'{fte(24):.1f}', f'{fte(36):.1f}', *[fk(ys(o, f'pay_{fn}', y)) for y in range(3)], 'yes' if rs[0][6] else 'no'])
    rows.append(['**Total**', f"**{ye(o,'fte_total',0):.1f}**", f"**{ye(o,'fte_total',1):.1f}**", f"**{ye(o,'fte_total',2):.1f}**", *[f'**{fk(payroll_total(o, y))}**' for y in range(3)], ''])
    t += table(['Function', 'FTE m12', 'FTE m24', 'FTE m36', 'Payroll Y1 $k', 'Y2 $k', 'Y3 $k', 'Gated'], rows, ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'l'])
    t += "\n\nRole detail (start month, base salary): " + '; '.join(f"{r[1]} x{r[3]:g} (m{r[4]}, ${r[5]/1000:.0f}k{', gated' if r[6] else ''})" for r in spec.HEADCOUNT if r[7] == 0) + '.\n'
    _o8, _k8 = run(7)
    n_extra = len([h for h in spec.HEADCOUNT if h[7] == 1])
    full_fte, base_fte = ye(_o8, 'fte_total', 2), ye(o, 'fte_total', 2)
    full_peak, base_peak = fm(peak(_o8)), fm(peak(o))
    t += f"""

**Make versus buy.** Fractional CFO (0.4 FTE), outsourced accounting and tax, a PEO or payroll provider, outsourced tier-1 support overflow, and contract pen-testing and audit are bought, not hired. Implementation is hired because it is the product's repeatability evidence (`GO-NO-GO-DECISION.md` priority 10); a partner-delivered model is an option once the methodology is documented and is a pricing decision (partner margin) as much as a cost one.

## 3a. Alignment with the CTO target-architecture pack

`docs/target-architecture/` (merged as D-1144, a proposal) was written without compensation or budget figures and says so. This model supplies them for its staffing hypothesis (`08-ORGANIZATION-AND-MILESTONES.md`, stages S1 to S4: 5 technical staff by about month 3, 12 by month 9, 27 by month 18, 35 to 45 by month 30). Costed as scenario 8 ("Full-scope staffing", {n_extra} additional roles on top of the Base plan, all with Base revenue), it reaches about {full_fte:.0f} FTE at month 36 against {base_fte:.0f} and raises the peak funding need from {base_peak} to {full_peak}. Where the two plans differ the CFO view is: take the CTO pack's *sequence* (second operator and security lead first, bus factor before surface area, vertical slices) and release its *count* by tranche and gate rather than by calendar. The infrastructure lines here assume the current Supabase/Vercel posture; the pack's target (one container-hosted `core` plus `ai-gateway`, `integration-hub` and `sync-gateway` from day one, with the cloud and region posture P-12 undecided) will raise the fixed-platform allowance, so **re-quote the fixed infrastructure line when P-12 is decided**. The pack's 20% debt-and-reliability capacity reservation is a cost the model carries inside the engineering headcount, not as a separate line.

## 4. Vendor prices to verify before the model is relied on

Quotes or current price pages, dated and filed with the finance records: Supabase (database, auth, storage, functions, point-in-time recovery), Vercel (hosting, bandwidth), Stripe (processing, billing, tax, Radar), Anthropic and OpenAI (API; zero-retention terms), identity/SSO vendor (per-connection price), search/vector service, email/SMS/push, error monitoring, CRM, billing/AR tooling, GRC/compliance platform, SOC 2 auditor, penetration-test firm, accessibility auditor (VPAT/ACR), cyber / tech E&O / D&O insurer through a broker, outside counsel, accounting firm. Each becomes a row in the vendor register (`docs/trust/VENDOR-RISK-REGISTER.md`, `VENDOR-SECURITY-REVIEW-PROGRAM.md`) with a renewal date and an owner.

## 5. What is not in the cost model

Capitalized software development; depreciation; income taxes; stock-based compensation; interest and financing fees; foreign payroll and currency; multi-region data residency (a possible tenant requirement that would add infrastructure and legal cost); accessibility remediation beyond the audit line; a dedicated 24x7 on-call program (the plan has support specialists and an on-call stipend inside payroll and contingency, not a follow-the-sun desk; promising `critical_24x7` support in a contract needs this costed first).
"""
    return t


def doc10():
    o, k = run(1)
    t = banner('10. Founder and board finance reporting package', 'TEMPLATE WITH PLAN COLUMNS RENDERED; ACTUALS NOT YET REPORTED')
    t += f"""
{CLAIM}

The package exists so the same numbers, defined the same way, reach the founder every week and the board every quarter, and so that a decision request always arrives with the metric that triggers it. The plan columns come from the Base scenario; the actual columns are blank because no actual exists. *The first real reading replaces the plan, it does not average with it.*

## Cadence

| Report | Audience | When | Owner | Source |
| --- | --- | --- | --- | --- |
| Weekly operating flash (one screen) | Founder, leads | Monday | Finance operator | Bank, Stripe, CRM, support queue |
| Monthly close and management pack | Founder; board observers | Business day 10 | Finance operator, reviewed by CPA | Ledger after reconciliation ([09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md)) |
| Quarterly board package | Board | 10 days before the meeting | Founder with finance | Monthly packs plus forecast refresh |
| Annual budget and tranche request | Board | Q4 | Founder | Model re-baselined with actuals |
| Ad hoc: trigger breach | Founder, board chair | Within 2 business days | Finance operator | [06](06-SCENARIOS-AND-SENSITIVITIES.md) trigger table |

## Page 1: financial snapshot (plan from Base, actual to be reported)

"""
    yr = lambda f: [f(y) for y in range(3)]
    rows = [
     ['Revenue ($k)', *yr(lambda y: fk(ys(o, 'rev_total', y))), '[not yet reported]'],
     ['ARR at year end ($k)', *yr(lambda y: fk(ye(o, 'arr', y))), '[not yet reported]'],
     ['Gross margin', *yr(lambda y: pc(k['k_gm'][y]) if ys(o, 'rev_total', y) > 5000 else 'n/m'), '[not yet reported]'],
     ['Net burn ($k)', *yr(lambda y: fk(-ys(o, 'op_cash', y))), '[not yet reported]'],
     ['Cumulative cash need ($k)', *yr(lambda y: fk(-ye(o, 'cum_cash', y))), '[not yet reported]'],
     ['Cash balance ($k)', 'n/a', 'n/a', 'n/a', '[not yet reported]'],
     ['Runway (months at trailing 3-month net burn)', 'n/a', 'n/a', 'n/a', '[not yet reported]'],
     ['Annual logos at year end', *yr(lambda y: f"{ye(o, 'logos', y):.1f}"), '[not yet reported]'],
     ['Paying students at year end', *yr(lambda y: f"{ye(o, 'paid_total', y):,.0f}"), '[not yet reported]'],
     ['Headcount (FTE)', *yr(lambda y: f"{ye(o, 'fte_total', y):.1f}"), '[not yet reported]'],
    ]
    t += table(['Metric', 'Plan Y1', 'Plan Y2', 'Plan Y3', 'Actual to date'], rows, ['l', 'r', 'r', 'r', 'l'])
    t += """

## Quarterly board package: contents

1. **Decisions requested** (first page, one line each): the decision, the metric or gate that triggers it, the amount and the owner. Examples: release the next capital tranche; open or hold a gate; approve a price book version; approve an insurance program; engage or change an adviser.
2. **Financial snapshot** (above) with plan, forecast, actual and variance for the quarter and year to date.
3. **Cash and runway**: opening and closing cash, net burn, runway, the funded tranche and distance to the next gate, 13-week cash forecast, accounts receivable aging, deferred revenue, and any covenant or investor-right dates.
4. **Pipeline and bookings**: qualified pipeline by stage and gate, signed orders (signed only; a proposal is not a booking), pilot status, conversion evidence, renewal calendar with notice dates.
5. **Unit-economics dashboard** (the [05](05-UNIT-ECONOMICS-DASHBOARD.md) table with actuals): CAC and payback by segment, gross margin, contribution margin, churn, net revenue retention, implementation margin and utilization, AI cost per active user and as a share of revenue, burn multiple.
6. **Scenario page**: the plan against Conservative and Enterprise-delayed, current trigger status, and the response pre-agreed for any trigger breached ([06](06-SCENARIOS-AND-SENSITIVITIES.md)).
7. **Budget versus actual by function** with the approved-exception log ([07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md)): who approved what above their limit.
8. **Gate status**: for each of G0 to G5, the GO-NO-GO priorities closed, open, and the evidence date; this is the page that releases or holds the gated hires.
9. **Risk and compliance finance items**: insurance status and renewals, open items routed to counsel, CPA and tax adviser ([08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md)), vendor price changes, incidents and their cost, AI spend versus tenant budgets.
10. **Appendix**: assumption register changes since last quarter (`01`), model version and verification result (`verify.py` and `independent_check.py` output), reconciliation of the management pack to the ledger.

## Founder weekly flash: one screen

Cash and 13-week forecast; net burn versus plan; invoices due and overdue; Stripe payouts and disputes; open quotes and their approval state; pilots by phase; implementation hours logged versus planned; AI spend by tenant versus budget; support tickets per 100 users and oldest open; trigger lights from the [06](06-SCENARIOS-AND-SENSITIVITIES.md) table; spend approvals pending.

## Rules for the package

* **One definition.** Metric formulas are those in [05](05-UNIT-ECONOMICS-DASHBOARD.md) and `docs/commercial/ANALYTICS-AND-METRICS-DICTIONARY.md`; a change to a definition is a dated decision with the history restated.
* **Source of truth.** Cash from the bank, billings from the billing system, revenue from the ledger after the accountant's policy, usage from the metered tables. Where two disagree the package shows both and the reconciling item.
* **Signed orders only** count as bookings; ARR and MRR are not reported externally until the accountant approves the definitions (`REVENUE-RECOGNITION-REVIEW-CHECKLIST.md`: *do not publish revenue, ARR/MRR, deferred revenue, margin or audit conclusions without approved accounting records*).
* **Nothing in the package is a public or investor claim** until it passes the claims register. Forecast and plan columns carry the label "planning model".
* **Confidentiality.** Board materials may contain customer names, contract terms and personnel data; distribute through the access-controlled data room, not email attachments; keep an access log.
* **Student data never appears.** Only aggregates; small-cell suppression applies to any cohort count under the minimum the privacy review sets.
* **The model version** (git revision, workbook hash, verification output) is printed on page 1 of every package so the numbers can be reproduced.

## What the first package should contain on the day it is first produced

The first real package will have no revenue. It should therefore show: cash and spend against the Tranche 1 plan, gate status G0 to G2 with the open GO-NO-GO priorities, the design-partner pipeline (conversations, scoped pilots, evidence exchanged), time-tracked implementation hours from any activated pilot, the first vendor and adviser quotes against the assumption register, and the decisions the board is asked to take next.
"""
    return t
