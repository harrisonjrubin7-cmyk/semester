"""Documents 04 (three-year model), 05 (unit economics) and 06 (scenarios)."""
import engine, spec, analysis
from results import *

A = engine.build_A()
CLAIM = ("**Claim ceiling.** Semester may say it has built an internal, assumption-labelled planning model. "
         "**Prohibited claims.** Do not publish, quote or give an investor, customer or the press any figure from this page as revenue, ARR/MRR, margin, "
         "runway, a forecast, a price or a commitment. No accounting, tax or legal conclusion is stated here; items for qualified professionals are listed in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md).")


def doc04():
    o, k = run(1)
    gp, gd, ge, gpl = A['gate_pilot'], A['gate_direct'], A['gate_ent'], A['gate_plus']
    first_rev = next(i + 1 for i, v in enumerate(o['rev_total']) if v > 0)
    t = banner('04. Three-year financial model (Base scenario)', 'PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST')
    t += f"""
{CLAIM}

Month 1 is January 2027. Everything below is the **Base** scenario of [`semester-financial-model.xlsx`](semester-financial-model.xlsx); the other seven scenarios are in [06](06-SCENARIOS-AND-SENSITIVITIES.md). The workbook recalculates; this page does not.

## The shape of the plan is set by the gates, not by the sales plan

[`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md) (3 Oct 2026) holds three revenue motions at NO-GO today: paid or broad individual acquisition, paid institutional pilots, and broad enterprise sale. Only invitation-only unpaid validation and non-activation design-partner work are authorized. A model that books Plus sales or paid pilots from month 2 would contradict the repository's own controlling decision, so every revenue line here sits behind a gate, and the gate month is an input (tagged `DECIDE`) that the founder, not the model, owns.

| Gate | What it unlocks | Base month | Evidence the repository requires first |
| --- | --- | ---: | --- |
| G0 Invitation-only unpaid validation | Free signups at {pc(A['pre_gate_share'], 0)} of trend, one named cohort | 1 | Conditional GO (priorities 1, 3, 4; 6-7 before supported activation) |
| G1 Design-partner pilot activated (unpaid) | First live tenant, no fee, 26 weeks | 5 and 8 | Priorities 1-8 closed: immutable candidate, DAST, accessibility review, counsel, entity/tax/insurance, support rota, restore drills, named customer scope |
| G2 Paid institutional pilot | Pilot fees, implementation fees, pilot-to-annual conversion | {gp} | G1 pilot has an approved activation record and a measured closeout; priorities 1-9 |
| G3 Broad / paid individual acquisition | Plus checkout for new subscribers, paid acquisition test budget | {gpl} | Every invitation-validation gate plus a separate broad-rollout decision by founder, counsel, product, security, privacy, accessibility, support, operations |
| G4 Direct annual sales (no pilot first) | Direct department / campus contracts | {gd} | First pilot-to-annual conversions evidenced |
| G5 System tier / broad enterprise | System-tier pilots and contracts | {ge} | Repeated successful deployments and independent assurance |

First revenue of any kind in Base: **month {first_rev}**. Year 1 is a pre-revenue build-and-prove year by construction.

## Annual profit and loss ($ thousands)

"""
    rows = []
    def r3(label, f, bold=False):
        vals = [fk(f(y)) for y in range(3)]
        rows.append([f'**{label}**' if bold else label] + [f'**{v}**' if bold else v for v in vals])
    r3('Student subscriptions', lambda y: ys(o, 'stud_rev', y))
    r3('Pilot software (paid)', lambda y: ys(o, 'pilot_rev', y))
    r3('Institutional platform subscriptions', lambda y: ys(o, 'core_rev', y))
    r3('Implementation services', lambda y: ys(o, 'svc_rev', y))
    r3('AI capacity add-on', lambda y: ys(o, 'ai_rev', y))
    r3('Alumni module', lambda y: ys(o, 'alumni_rev', y))
    r3('Career / employer', lambda y: ys(o, 'career_rev', y))
    r3('Marketplace (net take rate)', lambda y: ys(o, 'mk_rev', y))
    r3('Total revenue', lambda y: ys(o, 'rev_total', y), True)
    r3('Cost of revenue: student subscriptions (variable)', lambda y: ys(o, 'cogs_consumer', y))
    r3('Cost of revenue: institutional platform (variable cost, integrations, customer success)', lambda y: ys(o, 'cogs_inst', y))
    r3('Cost of revenue: platform infrastructure, AI evaluation, support team (fixed)', lambda y: ys(o, 'cogs_shared', y))
    r3('Cost of revenue: implementation team', lambda y: ys(o, 'cogs_svc', y))
    r3('Cost of revenue: marketplace', lambda y: ys(o, 'cogs_mk', y))
    r3('Gross profit', lambda y: ys(o, 'gross_profit', y), True)
    r3('Engineering and product', lambda y: ys(o, 'opex_eng', y))
    r3('Security and privacy', lambda y: ys(o, 'opex_sec', y))
    r3('Sales and partnerships', lambda y: ys(o, 'opex_sales', y))
    r3('Marketing', lambda y: ys(o, 'opex_mkt', y))
    r3('Legal', lambda y: ys(o, 'opex_legal', y))
    r3('Insurance', lambda y: ys(o, 'opex_ins', y))
    r3('G&A (leadership, finance, people, tools, contingency)', lambda y: ys(o, 'opex_ga', y))
    r3('Total operating expenses', lambda y: ys(o, 'opex', y), True)
    r3('Operating result (EBITDA)', lambda y: ys(o, 'ebitda', y), True)
    t += table(['$k', 'Year 1 (2027)', 'Year 2 (2028)', 'Year 3 (2029)'], rows)
    t += f"""

Gross margin: {' / '.join(pc(k['k_gm'][y]) if ys(o,'rev_total',y) > 5000 else 'n/m' for y in range(3))}. Gross margin is low early because the support, implementation and fixed-infrastructure costs exist before the revenue does; "n/m" means revenue is too small for the ratio to mean anything. No income tax, depreciation, capitalized software or financing cost is modeled (questions for the CPA and tax adviser are in [08](08-CONTRACTS-INVOICING-TAX-AND-ADVISOR-ROUTING.md)).

## Where the money goes

"""
    pay = [payroll_total(o, y) for y in range(3)]
    tot = [ys(o, 'cogs', y) + ys(o, 'opex', y) for y in range(3)]
    rows = [['Total payroll (all functions, burdened)'] + [fk(x) for x in pay],
            ['Total cost (cost of revenue + operating expenses)'] + [fk(x) for x in tot],
            ['Payroll as a share of total cost'] + [pc(pay[y] / tot[y], 0) for y in range(3)],
            ['Headcount at year end (FTE)'] + [f"{ye(o, 'fte_total', y):,.1f}" for y in range(3)],
            ['AI inference + evaluation'] + [fk(ys(o, 'c_ai', y)) for y in range(3)],
            ['Infrastructure (variable + fixed)'] + [fk(sum(ys(o, n, y) for n in ['c_compute', 'c_storage', 'c_bandwidth', 'c_search', 'c_notif', 'c_obs', 'c_infra_fixed'])) for y in range(3)],
            ['Security, legal, insurance, accounting programs'] + [fk(ys(o, 'sec_programs', y) + ys(o, 'legal', y) + ys(o, 'insurance', y) + ys(o, 'fin_admin', y)) for y in range(3)]]
    t += table(['$k', 'Year 1', 'Year 2', 'Year 3'], rows)
    t += """

Payroll is about two-thirds of all cost in every year, so the funding need follows the hiring plan more closely than it follows any single revenue assumption other than the timing of the gates (sensitivities in [06](06-SCENARIOS-AND-SENSITIVITIES.md)). That is why the budget is governed by gates in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md).

## ARR, customers, cash, quarter by quarter

"""
    rows = []
    for q in range(12):
        m = q * 3 + 2
        rows.append([f"Q{q % 4 + 1} {2027 + q // 4}", fk(o['arr_student'][m]), fk(o['arr_inst'][m]), fk(o['arr'][m]), f"{o['logos'][m]:.1f}",
                     f"{o['pilots_active'][m]:.1f}", f"{o['paid_total'][m]:,.0f}", f"{o['free'][m]:,.0f}", f"{o['IA'][m]:,.0f}",
                     f"{o['fte_total'][m]:.1f}", fk(-o['cum_cash'][m])])
    t += table(['Quarter end', 'ARR student $k', 'ARR institutional $k', 'ARR total $k', 'Annual logos', 'Pilots running', 'Paying students', 'Free active', 'Sponsored students', 'FTE', 'Cumulative burn $k'], rows)
    t += """

Counts of institutions are expected values (fractions appear because pipeline volumes are multiplied by scenario factors). "Sponsored students" are active users whose access an institution pays for; they carry cost but no consumer revenue.

## Cash, receivables and deferred revenue

"""
    rows = [['Cash collected'] + [fk(ys(o, 'collections', y)) for y in range(3)],
            ['Operating cash flow'] + [fk(ys(o, 'op_cash', y)) for y in range(3)],
            ['Net burn'] + [fk(-ys(o, 'op_cash', y)) for y in range(3)],
            ['Cumulative cash need at year end'] + [fk(-ye(o, 'cum_cash', y)) for y in range(3)],
            ['Deferred revenue at year end (billed, not yet recognized)'] + [fk(ye(o, 'deferred', y)) for y in range(3)],
            ['Receivables at year end (net of reserve)'] + [fk(ye(o, 'ar', y)) for y in range(3)]]
    t += table(['$k', 'Year 1', 'Year 2', 'Year 3'], rows)
    tr = analysis.tranches()
    t += f"""

**Peak funding need, months 1-36: {fm(peak(o))}.** The model deliberately has no funding round in it: the honest number is the deepest cumulative cash trough, and the opening-capital cell in the workbook is an illustrative placeholder used only to show a cash-out month.

## Capital in tranches, released by gate

| Tranche | Funds | Cash needed in the period | Cumulative |
| --- | --- | ---: | ---: |
"""
    for x in tr:
        t += f"| {x['name']} | {x['what']} | {fm(x['need'])} | {fm(x['cum'])} |\n"
    cush = tr[-1]['cushion']
    t += f"""
Add a cushion of six months of the then-current burn at each close (about {fm(tr[0]['cushion'])} after Tranche 1, {fm(tr[1]['cushion'])} after Tranche 2, {fm(tr[2]['cushion'])} after Tranche 3), so that no tranche is spent to zero before the next gate has been decided. The release conditions are in [07](07-BUDGET-GOVERNANCE-AND-APPROVAL-MATRIX.md).

## Known limits of the model

* **Pipeline is not capacity-linked.** Pilot and direct-deal volumes are inputs, not a function of the number of account executives. Deferring sales hires therefore saves cost without reducing modeled revenue; treat those savings as an upper bound and read the utilization and "starts per sales FTE" ratios before relying on them.
* **Expected values, not distributions.** Institutional counts are fractional expectations; the scenarios bracket the range but there is no probability weighting.
* **Revenue recognition is a planning proxy** (ratable subscriptions, pilots and add-ons; services over three months). The accountant decides the real policy; billed, collected, entitled, delivered and recognized amounts are kept apart in the workbook (Billings, Cash collected, Deferred revenue) for that reason.
* **Linear infrastructure costs.** Per-user costs scale linearly; real vendor plans step. Fixed platform cost is a flat allowance by year.
* **Collection lag is fixed at two months**; bad debt is a flat share of invoiced billings.
* **No inflation, price escalators, multi-currency, income tax, depreciation, capitalized software, equity or financing costs.**
* **Marketplace revenue is shown net (take rate);** gross-versus-net presentation is an accountant determination.
* **One cost of capital is not assumed;** the opening-capital cell is illustrative.

## How to check this page

* `python3 docs/finance/model/verify.py` recalculates the workbook in LibreOffice and compares about 55,000 model cells in all eight scenarios with an independent Python run; it must report zero mismatches and every in-workbook check OK.
* `python3 docs/finance/model/independent_check.py` re-derives the student funnel and the Department tier with plain loops (no shared code with the model rows) and asserts they agree, including that no revenue is booked before the first gate.
* Both checks were run against a deliberately corrupted workbook / an off-by-one lag and failed, as a guard must.
"""
    return t


def doc05():
    o, k = run(1)
    ai = analysis.ai_buildup()
    tiers, infra_mau, sup_mau = analysis.tier_economics()
    be = analysis.breakeven_conv()
    life = A['conv'] / (A['free_churn'] + A['conv'])
    marg = (A['cps'] / A['activation']) / life
    ltv = k['k_ltv_stud'][2]
    t = banner('05. Unit-economics dashboard', 'PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST')
    t += f"""
{CLAIM}

The dashboard below is the Base scenario. Every metric exists as a live row in the workbook (`Dashboard` sheet, scenario selector in B3) with the same definition. "Guardrail" columns are **proposed** thresholds for the board to adopt or change; none is a decision. `docs/COMPANY-FIRST-YEAR-MEASURES.md` lists each of these measures as *defined* with no reading; this page gives them a model reading and a formula, not an observed one.

## The dashboard

"""
    def g(name, y): return k[name][y]
    def f1(name, fmtf): return [fmtf(g(name, y)) for y in range(3)]
    na = lambda f: (lambda x: 'n/a' if x == 0 else f(x))
    dollars = lambda x: f'${x:,.0f}'
    usd2 = lambda x: f'${x:,.2f}'
    pct = lambda x: pc(x)
    dollars_na, usd2_na, pct_na = na(dollars), na(usd2), na(pct)
    mult = lambda x: f'{x:,.1f}x'
    yrs = lambda y: ys(o, 'rev_total', y) > 5000
    rows = [
     ['CAC, student (fully loaded)', 'paid test budget + half of marketing + free-tier serving cost, over new paying subscribers', *f1('k_cac_stud', dollars_na), 'LTV/CAC >= 3'],
     ['LTV, student', 'ARPU x margin on paying subscribers / monthly churn', *f1('k_ltv_stud', dollars_na), ''],
     ['LTV / CAC, student', '', *f1('k_ltv_cac', na(lambda x: f'{x:,.2f}x')), '>= 3.0x'],
     ['Student CAC payback', 'CAC / (ARPU x margin on paying subscribers), months', *f1('k_payback_stud', na(lambda x: f'{x:,.0f} mo')), '<= 12 mo'],
     ['Student ARPU (monthly)', 'revenue / 12 / average subscribers', *f1('k_arpu', usd2_na), ''],
     ['Margin on paying subscribers', 'their own variable cost only (infra, AI, support, payment/app-store fees)', *f1('k_paid_gm', pct_na), '>= 70%'],
     ['Monthly churn, paying students', 'lost / opening subscribers, incl. non-renewals', *f1('k_churn_stud', pct_na), '<= 4%'],
     ['Free-user serving cost', 'variable cost of all free active users, per year', *f1('k_free_cost', dollars), ''],
     ['Free-user cost / student revenue', '', *f1('k_free_ratio', na(lambda x: f'{x:,.1f}x')), '<= 0.5x'],
     ['Paying share of consumer users', 'paying / (paying + free active), year end', *f1('k_paid_share', pct_na), ''],
     ['CAC, institution (per new annual contract)', 'sales + commissions + half of non-student marketing, over new annual contracts', *f1('k_cac_inst', dollars_na), ''],
     ['CAC, institution (per new institution started)', 'same cost over paid pilots + direct starts', *f1('k_cac_inst_start', dollars_na), ''],
     ['Gross margin, total', '(revenue - cost of revenue) / revenue', *[pc(g('k_gm', y)) if yrs(y) else 'n/m' for y in range(3)], '>= 65% at scale'],
     ['Gross margin, institutional', 'platform, pilots, add-ons less variable cost, integrations and customer success', *[pc(g('k_gm_inst', y)) if ys(o, 'pilot_rev', y) + ys(o, 'core_rev', y) > 20000 else 'n/m' for y in range(3)], '>= 70% at scale'],
     ['Variable margin, all consumer users', 'includes free-user cost', *[pc(g('k_gm_cons', y)) if ys(o, 'stud_rev', y) > 2000 else 'n/m' for y in range(3)], '> 0%'],
     ['Contribution margin', 'gross profit less paid acquisition and commissions', *[pc(g('k_cm', y)) if yrs(y) else 'n/m' for y in range(3)], ''],
     ['Implementation margin, actual', '(services revenue - implementation team cost) / services revenue', *[pc(g('k_gm_svc', y)) if ys(o, 'svc_rev', y) > 5000 else 'n/m' for y in range(3)], '>= 25%'],
     ['Implementation margin at standard cost', 'fees vs hours x loaded rate: the pricing check', *[pc(g('k_gm_svc_std', y)) if ys(o, 'svc_rev', y) > 5000 else 'n/m' for y in range(3)], '>= 30%'],
     ['Implementation utilization', 'hours demanded / hours the team can deliver', *f1('k_util', pct_na), '80-110%'],
     ['Net revenue retention (core, by construction)', 'logo renewal x (1 + expansion)', *f1('k_nrr', pct), '>= 100%'],
     ['Gross logo retention', '', *f1('k_grr', pct), '>= 90%'],
     ['AI cost per active user per month', '', *f1('k_ai_mau', usd2), ''],
     ['AI cost / revenue', '', *[pc(g('k_ai_pct', y)) if yrs(y) else 'n/m' for y in range(3)], '<= 12%'],
     ['Net burn', '-(operating cash flow)', *f1('k_burn', dollars), ''],
     ['Burn multiple', 'net burn / net new ARR', *[f'{g("k_burn_mult", y):,.1f}x' if g('k_new_arr', y) > 50000 else 'n/m' for y in range(3)], '<= 3.0x'],
     ['ARR at year end', 'recurring revenue x 12', *f1('k_arr', dollars), ''],
     ['ARR per FTE', '', *f1('k_rev_fte', dollars), ''],
     ['Cumulative cash need', '', *f1('k_cum', lambda x: dollars(-x)), ''],
    ]
    t += table(['Metric', 'Definition', 'Year 1', 'Year 2', 'Year 3', 'Proposed guardrail'], rows, ['l', 'l', 'r', 'r', 'r', 'l'])
    t += f"""

Runway is not in the table because it needs the real cash balance. In the workbook: `Compare` row "Month cash runs out on the illustrative opening capital"; in operation, runway is cash divided by the trailing three-month average net burn and is a monthly line in the board package ([10](10-BOARD-REPORTING-PACKAGE.md)).

## Reading the student numbers: Plus does not fund its own acquisition

Under the Base assumptions the student subscription is a margin-positive product per paying subscriber (margin on paying subscribers {pc(g('k_paid_gm', 2))}, LTV about {dollars(ltv)}) and a loss-making funnel. Two causes, both visible in the table:

1. **The free tier is a cost, not a funnel stage.** At Year 3 the model serves about {o['free'][-1]:,.0f} free active students at roughly {usd2(analysis.ai_buildup()['free'] + infra_mau)} per user per month ({usd2(ai['free'])} of it AI), which is {g('k_free_ratio', 2):,.1f}x the revenue paying students bring in.
2. **Conversion is low and churn is normal for students.** A free user converts at {pc(A['conv'], 2)} a month and leaves at {pc(A['free_churn'], 0)}, so only {pc(life, 1)} of active free users ever pay. A marginal paid signup at {usd2(A['cps'])} (activation {pc(A['activation'], 0)}) therefore costs about {dollars(marg)} per paying subscriber **before** any free-tier or payroll allocation, against an LTV of about {dollars(ltv)}.

What would have to be true: with all other inputs held, Year 3 LTV/CAC reaches 1.0x only if monthly conversion is about {pc(be[1.0][1], 2)} ({be[1.0][0]:.1f}x the assumption) and reaches 3.0x only at about {pc(be[3.0][1], 2)} ({be[3.0][0]:.0f}x), which would mean about {pc(be[3.0][2], 0)} of active consumer users paying. Neither is a reasonable thing to plan on. The conclusion the model supports, as a hypothesis to test with the invitation-only cohort, is:

* Treat Plus as a retention and ARPU product delivered through institutions and organic use. Keep the paid acquisition line a **test budget** (it is $1,000 to $5,000 a month in the model and zero before G3), released in tranches only when a measured marginal cost per paying subscriber is under a third of measured LTV.
* Cap free-tier AI by policy, not by surprise: a free-tier cap of 4 requests a month instead of 10 cuts free-user serving cost by roughly {pc(1 - (infra_mau + ai['tot'] * 4) / (infra_mau + ai['free']), 0)}. This is a product decision with an accessibility and fairness side; it belongs to the AI governance board, not to finance alone.
* Re-run this section on the first real cohort. The three numbers to measure first are free-to-paid conversion, free-user AI requests per month, and paying-subscriber churn.

## Reading the institutional numbers

Per fully rolled-out account, at list less the {pc(A['inst_disc'], 0)} realized discount (variable cost uses the same unit costs as the model):

"""
    rows = []
    names = {'D': 'Department', 'C': 'Campus', 'Y': 'System'}
    for tkey in 'DCY':
        e = tiers[tkey]
        rows.append([names[tkey], f"${e['list']:,.0f}", f"${e['net']:,.0f}", f"{e['students']:,}", f"${e['per_student']:,.2f}", f"${e['var_yr']:,.0f}", pc(e['gm'], 0),
                     f"${e['impl_fee']:,.0f}", f"{e['hours']}", pc(e['std_margin'], 0), f"${e['ltv']:,.0f}"])
    t += table(['Tier', 'List ACV', 'Net ACV', 'Active students', 'Net ACV per active student', 'Variable cost / yr', 'Variable margin', 'Implementation fee', 'Std hours', 'Impl. margin at std cost', 'Account LTV (margin / (1 - renewal))'], rows)
    t += f"""

Reading across: variable margin per account is healthy ({pc(min(e['gm'] for e in tiers.values()), 0)} to {pc(max(e['gm'] for e in tiers.values()), 0)}) once an account is live. The economics are won or lost on three things the table does not show: whether the implementation team is staffed to the demand (the utilization row above), how many months pass between an account's first cost and its first dollar (design-partner and pilot months carry cost and little revenue), and whether the account renews. The **price corridor** check from [02](02-REVENUE-STREAMS-AND-PRICING.md) applies: net price per active student must not exceed the consumer annual list ($59) and should sit well above variable cost; Department is closest to the ceiling.

## AI unit economics

Cost per request, built up from the Anthropic list prices in the API reference (Haiku 4.5 $1/$5, Sonnet 5.5 $2/$10, Opus 5.5 $4/$20 per million tokens, cache read about 10% of input):

| Step | Value |
| --- | ---: |
| Blended input price at the routing mix {pc(A['mix_h'], 0)} / {pc(A['mix_s'], 0)} / {pc(A['mix_o'], 0)} | ${ai['p_in']:.2f} per M tokens |
| Blended output price | ${ai['p_out']:.2f} per M tokens |
| Input tokens per request / output tokens | {A['tok_in']:,} / {A['tok_out']:,} |
| Effective input factor after prompt caching ({pc(A['cache_share'], 0)} cacheable, {pc(A['cache_hit'], 0)} hit rate) | {ai['eff_in']:.3f} |
| Input cost | ${ai['c_in']:.5f} |
| Output cost (x{A['think_mult']} for reasoning tokens) | ${ai['c_out']:.5f} |
| Embeddings / retrieval / moderation overhead | +{pc(A['ai_overhead'], 0)} |
| **Cost per request** | **${ai['tot']:.4f}** |
| Per free user per month ({A['req_free']} requests) | ${ai['free']:.2f} |
| Per paying user per month ({A['req_paid']} requests) | ${ai['paid']:.2f} |
| Per sponsored user per month ({A['req_inst']} requests) | ${ai['inst']:.2f} |

AI is {pc(g('k_ai_pct', 2))} of Year 3 revenue in Base and {pc(run(4)[1]['k_ai_pct'][2])} in the High-AI-cost scenario (unit cost x2.5, usage x1.5, no repricing). The existing controls (`private.reserve_ai_budget` per-tenant monthly budget, `kill.ai_generation`, the T3 classification gate) cap the exposure; the missing pieces are the ones `docs/operating-model/COMMERCIAL-GOVERNANCE.md` already lists as designed-only: user fair-use limits, cost alerts and per-outcome cost. Finance needs `private.ai_usage_month` tokens joined to price by model and tenant, monthly, before any AI price is set.

**Pricing rule proposed:** AI is sold as an *allowance included in a plan* with a transparent cap, and as an institution-managed capacity add-on; never as an open-ended consumer meter (the audit's "no surprise student bills" rule, and the AI-allowance row of the launch-completeness pricing principles).
"""
    return t


def doc06():
    t = banner('06. Scenarios and sensitivities', 'PLANNING MODEL: NOT AN APPROVED BUDGET OR FORECAST')
    res = [run(i) for i in range(len(spec.SCENARIOS))]
    t += f"""
{CLAIM}

Eight scenarios share one set of formulas; they differ only in the parameter column on the workbook's `Scenarios` sheet. The mitigation column is not a forecast of what will happen: it shows what the pre-agreed response to a trigger is worth. The full-scope column is not a risk case at all: it prices a staffing proposal made by another part of the executive team.

## Definitions

"""
    rows = []
    for j, (key, lab, unit, vals, note) in enumerate(spec.SCEN_PARAMS):
        rows.append([lab] + [str(v) for v in vals])
    t += table(['Parameter'] + [n.replace('Enterprise-delayed, gated hiring (mitigation)', 'Ent.-delayed + gated hiring').replace('Incident (SEV-0, month 14)', 'Incident').replace('Full-scope staffing (CTO pack S1-S4), Base revenue', 'Full-scope staffing') for n in NAMES], rows)
    t += """

The Incident scenario also loads the cost inputs in the `Incident scenario` group of the Assumptions sheet: forensics, counsel, notification, regulatory response, emergency engineering (about $0.7M in total before service credits), a one-month service credit of 5% of core ARR, a six-point jump in paid-student churn for three months, a 15-point cut to renewal rates for the next twelve months and a 60% cut to new starts for six months. **Insurance recovery is counted as zero** until the broker confirms the policy, retention and exclusions.

## Results

"""
    def line(label, f, fmtf=lambda x: fm(x)):
        return [label] + [fmtf(f(o, k)) for o, k in res]
    rows = [
     line('Revenue, Year 1', lambda o, k: k['k_rev'][0]), line('Revenue, Year 2', lambda o, k: k['k_rev'][1]), line('Revenue, Year 3', lambda o, k: k['k_rev'][2]),
     line('ARR, month 24', lambda o, k: k['k_arr'][1]), line('ARR, month 36', lambda o, k: k['k_arr'][2]),
     line('Annual logos, month 36', lambda o, k: k['k_logos'][2], lambda x: f'{x:.1f}'),
     line('Gross margin, Year 3', lambda o, k: k['k_gm'][2], lambda x: pc(x, 0)),
     line('Operating result, Year 3', lambda o, k: k['k_ebitda'][2]),
     line('Net burn, Year 3', lambda o, k: k['k_burn'][2]),
     line('Burn multiple, Year 3', lambda o, k: k['k_burn_mult'][2], lambda x: f'{x:.1f}x'),
     line('**Peak funding need (months 1-36)**', lambda o, k: peak(o)),
     line('Change in peak funding vs Base', lambda o, k: peak(o) - peak(res[1][0])),
     line('Month cash runs out on the illustrative $3M', lambda o, k: first_neg(o, A['capital_available']) or 0, lambda x: str(int(x)) if x else '>36'),
     line('Implementation margin, Year 3', lambda o, k: k['k_gm_svc'][2], lambda x: pc(x, 0)),
     line('Implementation utilization, Year 3', lambda o, k: k['k_util'][2], lambda x: pc(x, 0)),
     line('AI cost / revenue, Year 3', lambda o, k: k['k_ai_pct'][2], lambda x: pc(x, 0)),
    ]
    short = [n.replace('Enterprise-delayed, gated hiring (mitigation)', 'Ent.-delayed + gated').replace('Incident (SEV-0, month 14)', 'Incident').replace('Enterprise-delayed', 'Ent.-delayed').replace('Full-scope staffing (CTO pack S1-S4), Base revenue', 'Full-scope staffing') for n in NAMES]
    t += table(['Metric'] + short, rows)
    b = res[1]
    _bt, _it = analysis.tornado()
    per_month = abs([i for i in _it if i['label'].startswith('Paid-pilot gate')][0]['peak_lo']) / 3
    gate_months = (peak(res[7][0]) - peak(b[0])) / per_month
    t += f"""

## What each scenario is for

* **Conservative** (acquisition x0.6, conversion x0.8, churn x1.25, pilot volume x0.6, gates two months late): the case the funding plan must survive. Peak need {fm(peak(res[0][0]))}; Year 3 revenue {fm(res[0][1]['k_rev'][2])}. The company reaches month 36 with {res[0][1]['k_logos'][2]:.0f} annual logos and a burn multiple of {res[0][1]['k_burn_mult'][2]:.0f}x, i.e. spending that the revenue does not justify. It is the argument for gating hires, not for a bigger raise.
* **Base:** peak need {fm(peak(b[0]))}, month-36 ARR {fm(b[1]['k_arr'][2])}, burn multiple {b[1]['k_burn_mult'][2]:.1f}x in Year 3.
* **Aggressive** (gates two months early, volume x1.4, conversion x1.2): peak need {fm(peak(res[2][0]))}; month-36 ARR {fm(res[2][1]['k_arr'][2])}. More revenue lowers the funding need by only {fm(peak(b[0]) - peak(res[2][0]))} because most cost is fixed headcount; the success case still needs the full capital plan, and its implementation team is at {pc(res[2][1]['k_util'][2], 0)} utilization, meaning it must hire faster than the plan.
* **Enterprise-delayed** (every institutional gate slips six months, pilot conversion x0.9, hiring unchanged): peak need {fm(peak(res[3][0]))}, {fm(peak(res[3][0]) - peak(b[0]))} more than Base, and Year 3 implementation margin {pc(res[3][1]['k_gm_svc'][2], 0)} because the implementation team is paid while idle ({pc(res[3][1]['k_util'][2], 0)} utilization).
* **High AI cost** (unit cost x2.5, usage x1.5, no repricing): peak need {fm(peak(res[4][0]))} ({fm(peak(res[4][0]) - peak(b[0]))} more); AI rises to {pc(res[4][1]['k_ai_pct'][2], 0)} of Year 3 revenue and Year 3 gross margin falls to {pc(res[4][1]['k_gm'][2], 0)}. Smaller than the headline risk in absolute dollars because the user base is small by Year 3; it scales with sponsored students, so it matters more in Year 4 and beyond than the three-year cash view shows.
* **Incident** (SEV-0 in month 14): peak need {fm(peak(res[5][0]))} ({fm(peak(res[5][0]) - peak(b[0]))} more than Base). The direct response cost is about $0.7M; the rest is lost and delayed revenue. The cheaper protection is the control set in [09](09-FINANCIAL-CONTROLS-AND-FINANCE-OPERATIONS.md) and [`CRISIS-RESPONSE-RUNBOOK.md`](../CRISIS-RESPONSE-RUNBOOK.md), plus a cyber policy whose limits and exclusions finance has read.
* **Full-scope staffing** (Base revenue and Base gates; the CTO target-architecture pack's staffing plan, stages S1 to S4, costed in addition to the Base roles): peak need {fm(peak(res[7][0]))}, {fm(peak(res[7][0]) - peak(b[0]))} more than Base, headcount {res[7][1]['k_fte'][2]:.0f} FTE at month 36 against {b[1]['k_fte'][2]:.0f}, and a burn multiple of {res[7][1]['k_burn_mult'][2]:.1f}x because revenue does not change. That pack deliberately leaves compensation and budget to the CFO (`docs/target-architecture/08-ORGANIZATION-AND-MILESTONES.md`: *no compensation or budget figures are asserted*). This is the figure. In the model the gates are inputs, so extra engineering cannot move them; and each month the paid-pilot gate opens earlier is worth only about {fm(per_month)} of funding need, so the extra team would have to bring that gate forward by about {gate_months:.0f} months to pay for itself through timing alone. Gate timing is not purely an engineering function (counsel, assessors and the customer set it too), which is why the sequence is worth adopting and the count is worth releasing by tranche.
* **Enterprise-delayed with gated hiring** (same slip, go-to-market and implementation hires wait six months): peak need {fm(peak(res[6][0]))}, {fm(peak(res[3][0]) - peak(res[6][0]))} less than the unmitigated delay, and implementation margin recovers to {pc(res[6][1]['k_gm_svc'][2], 0)}. That is the value of tying those hires to the evidence gates rather than to the calendar.

## Triggers and pre-agreed responses

| Trigger (measured, monthly) | Threshold | Pre-agreed response | Owner |
| --- | --- | --- | --- |
| First paid-pilot gate not open by its planned month | +2 months | Freeze all gated hires; board review of Tranche 2 timing | Founder; board |
| Pilot-to-annual conversion (rolling, 4+ pilots) | below 0.7 x model | Stop new implementation hires; review package and price; extend design-partner learning | Founder; finance |
| Implementation utilization | below 60% for 2 months, or above 120% for 2 months | Re-time implementation hires; fix scope or price | COO / CS lead; finance |
| AI cost / revenue | above 12% for a quarter | Tighten routing and caching; review included allowance; do not reprice mid-term without notice | AI governance board; finance |
| Free-user serving cost / student revenue | above 1.0x | Cut free-tier AI cap; hold paid acquisition at zero | Product; finance |
| Gross logo retention at first renewals | below 85% | Customer-success review of every non-renewal; pause expansion selling | CS lead |
| Cumulative cash need | within 6 months of the funded tranche | Start the next raise only if its gate has opened; otherwise cut to the gated plan | Founder; board |
| SEV-0 / SEV-1 security incident | any | Invoke crisis runbook; legal and insurer notification per policy; hold public claims | Incident commander; counsel |
| Vendor price change | model input moves more than 20% | Re-run the model; decide pass-through or substitute | Finance |

## Sensitivities: what moves the funding need

One variable at a time, Base scenario. Funding need is the deepest cumulative cash trough; negative = less cash needed.

"""
    base, items = analysis.tornado()
    rows = [[i['label'], f"{i['lo']} ({i['peak_lo'] / 1e6:+.2f}M)", f"{i['hi']} ({i['peak_hi'] / 1e6:+.2f}M)", f"{i['arr_lo'] / 1e6:+.2f}M / {i['arr_hi'] / 1e6:+.2f}M"] for i in items]
    t += table(['Variable', 'Input at its upside value: change in peak need', 'Input at its downside value: change in peak need', 'Change in month-36 ARR (upside / downside)'], rows, ['l', 'r', 'r', 'r'])
    rev_side = ('Pilot and direct-deal volume', 'Institutional price realization / ACV', 'Pilot-to-annual conversion', 'Free-to-paid conversion (Plus)', 'Organic student signups', 'Gross logo renewal rate')
    t += f"""

Three things stand out. The timing of the gates, the engineering salaries and the payroll burden dominate. The student-side variables barely register in a three-year cash view. And no single revenue-side assumption moves the funding need by more than about {fm(max(max(abs(i['peak_lo']), abs(i['peak_hi'])) for i in items if i['label'] in rev_side))}. One result is counter-intuitive and worth keeping: **doubling organic signups raises the funding need**, because at the Base conversion rate each additional free student costs more to serve than the share who convert returns (see [05](05-UNIT-ECONOMICS-DASHBOARD.md)).

## Levers that reduce the funding need

Each applied alone to Base (the last two combine them):

"""
    b2, lv = analysis.levers()
    rows = [[l['label'], fm(l['peak']), f"{l['d_peak'] / 1e6:+.2f}M", f"{l['d_arr'] / 1e6:+.2f}M"] for l in lv]
    t += table(['Lever', 'Peak need', 'Change vs Base', 'Change in month-36 ARR'], rows, ['l', 'r', 'r', 'r'])
    t += f"""

No one lever is large. The combined set takes roughly {fm(-lv[-2]['d_peak'])} to {fm(-lv[-1]['d_peak'])} off the {fm(peak(b[0]))}. The remaining cost is the core engineering, product, security and compliance team, which is the price of the audit's thesis ("every capability native and governed from day one"); a materially smaller number requires a smaller scope sequence than the audit's six increments, which is a product decision, not a finance one. The model's job is to show that the scope decision is the funding decision.
"""
    return t
