#!/usr/bin/env python3
"""Semester unit-economics sensitivity model. Standard library only.

    python3 docs/commercial/unit-economics-model.py          # prints every table
    python3 docs/commercial/unit-economics-model.py --check  # asserts invariants

Every figure in docs/commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md comes
from this file, so a changed assumption is one edit here and a re-run, not a
hunt through prose.

STATUS: ASSUMPTIONS, NOT MEASUREMENTS. The repository has no observed
delivery-cost baseline (docs/commercial/PRICING-AND-PACKAGING.md says so), so
each input below is a labelled assumption with a lean / base / heavy range.
Provider token prices are the first-party list prices cached in the claude-api
reference on 2026-09-25 and must be re-read from the provider's price page
before anyone relies on them. Payment-processor and app-store rates are public
list rates quoted from memory and must be confirmed with the processor and
with the accountant. Nothing here is a price book.
"""
import sys

# ── 1. Provider token prices, USD per million tokens (input, output) ────────
MODELS = {
    "haiku-4.5":  (1.00, 5.00),
    "sonnet-5.5": (2.00, 10.00),   # same list price as sonnet-5
    "opus-5":     (5.00, 25.00),
    "opus-5.5":   (4.00, 20.00),
    "fable-5.1":  (10.00, 50.00),
}
CACHE_READ_FRACTION = 0.10   # cache reads bill at ~10% of the input price
BATCH_FRACTION = 0.50        # Message Batches bill at 50%

# ── 2. What one call looks like (tokens). ASSUMPTIONS. Output includes thinking.
PROFILES = {
    "light    (note -> cards)":         dict(i=4_000,  o=1_000,  model="haiku-4.5"),
    "standard (tutor answer)":          dict(i=10_000, o=2_000,  model="sonnet-5.5"),
    "heavy    (syllabus import)":       dict(i=30_000, o=4_000,  model="sonnet-5.5"),
    "premium  (long essay feedback)":   dict(i=15_000, o=4_000,  model="opus-5.5"),
    "app default model (opus-5)":       dict(i=10_000, o=3_000,  model="opus-5"),
    "worst the clamp allows (fable)":   dict(i=30_000, o=16_000, model="fable-5.1"),
}
# Usage mix a routed gateway would aim for (share of calls). ASSUMPTION.
ROUTED_MIX = {"light    (note -> cards)": 0.55, "standard (tutor answer)": 0.30,
              "heavy    (syllabus import)": 0.12, "premium  (long essay feedback)": 0.03}


def call_cost(p, cache_hit=0.0, batch=False):
    pin, pout = MODELS[p["model"]]
    inp = p["i"] / 1e6 * pin * ((1 - cache_hit) + cache_hit * CACHE_READ_FRACTION)
    out = p["o"] / 1e6 * pout
    c = inp + out
    return c * (BATCH_FRACTION if batch else 1.0)


def blended_call(cache_hit=0.0):
    return sum(call_cost(PROFILES[k], cache_hit) * w for k, w in ROUTED_MIX.items())


# ── 3. Individual plans. ASSUMPTIONS unless noted. ──────────────────────────
PLUS = dict(monthly=7.99, yearly=59.00)           # D-134, in plans.ts (not an approved price book)
PRO = dict(monthly=14.99, yearly=99.00)           # plans.ts "planned"; no price row in the DB catalog
CARD_PCT, CARD_FIXED = 0.029, 0.30                # Stripe US card list rate; CONFIRM
TAX_PCT = 0.005                                   # Stripe Tax per-transaction; CONFIRM; 0 if not used
STORE_PCT = {"web": 0.0, "store_15": 0.15, "store_30": 0.30}  # app-store commission; CONFIRM with counsel
INDIV_COST = {   # per active paying student per month: lean / base / heavy
    "storage_egress": (0.02, 0.05, 0.15),
    "support":        (0.10, 0.25, 0.60),         # tickets/100/mo x $/ticket, spread
    "infra_share":    (0.05, 0.12, 0.30),
}


def fee(price, interval):
    return price * (CARD_PCT + TAX_PCT) + CARD_FIXED


def individual_margin(price, interval, calls_per_month, per_call, store="web", case=1):
    months = 1 if interval == "monthly" else 12
    revenue_pm = price / months
    pay_pm = fee(price, interval) / months
    store_pm = revenue_pm * STORE_PCT[store]
    # a store sale replaces card processing
    pay_pm = store_pm if store != "web" else pay_pm
    ai_pm = calls_per_month * per_call
    other_pm = sum(v[case] for v in INDIV_COST.values())
    cost = pay_pm + ai_pm + other_pm
    return revenue_pm, cost, revenue_pm - cost, (revenue_pm - cost) / revenue_pm


# ── 4. Institutional tenant cost to serve, USD per year. ASSUMPTIONS. ───────
LOADED = dict(csm=140_000, support=90_000, eng=200_000)
FIXED = {   # (lean, base, heavy): FTE share or dollars
    "csm_fte_share":       (0.10, 0.20, 0.35),
    "support_fte_share":   (0.05, 0.10, 0.20),
    "eng_integration_fte": (0.05, 0.10, 0.20),
    "security_compliance": (5_000, 10_000, 20_000),
    "infra_baseline":      (3_000, 6_000, 12_000),
}
VARIABLE = {   # per ACTIVE student-year, (lean, base, heavy)
    "ai_calls_per_month": (8, 15, 30),
    "tickets_per_100_per_month": (2, 4, 8),
    "cost_per_ticket": (5, 8, 15),
    "storage_egress_per_month": (0.02, 0.05, 0.15),
}


TIER_FIXED_SCALE = {"pilot": 0.4, "department": 0.5, "campus": 1.0, "system": 2.5}   # ASSUMPTION


def tenant_fixed(case, tier="campus"):
    f = {k: v[case] for k, v in FIXED.items()}
    base = (f["csm_fte_share"] * LOADED["csm"] + f["support_fte_share"] * LOADED["support"]
            + f["eng_integration_fte"] * LOADED["eng"] + f["security_compliance"] + f["infra_baseline"])
    return base * TIER_FIXED_SCALE[tier]


def variable_per_active_year(case, cache_hit=0.0, per_call=None, **over):
    v = {k: x[case] for k, x in VARIABLE.items()}
    v.update(over)
    pc = blended_call(cache_hit) if per_call is None else per_call
    ai = v["ai_calls_per_month"] * 12 * pc
    sup = v["tickets_per_100_per_month"] / 100 * 12 * v["cost_per_ticket"]
    sto = v["storage_egress_per_month"] * 12
    return ai + sup + sto, ai


IMPL_HOURS = {"pilot": 120, "department": 200, "campus": 600, "system": 1500}   # ASSUMPTION
IMPL_RATE = 110                                                                   # loaded $/h ASSUMPTION
ACTIVE_ASSUMED = {"pilot": 500, "department": 750, "campus": 4_000, "system": 24_000}      # ASSUMPTION
DEAL_MIN_ACV = {"pilot": 15_000, "department": 25_000, "campus": 75_000, "system": 200_000}  # deal-desk.ts (proposed)
IMPL_FEE_FLOOR = 10_000                                                           # deal-desk.ts (proposed)

# ── 5. Marketplace. ASSUMPTIONS. ────────────────────────────────────────────
MKT = dict(order=50.0, dispute_rate=0.005, dispute_fee=15.0, support_per_order=1.50,
           moderation_per_order=0.40, refund_rate=0.04)


def md(rows, head):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join(["---"] * len(head)) + "|"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def usd(x, d=3):
    return f"${x:,.{d}f}"


def pct(x):
    return f"{x * 100:.0f}%"


def tables():
    t = {}
    # A. per-call cost
    rows = []
    for k, p in PROFILES.items():
        rows.append([k, p["model"], f'{p["i"]:,}', f'{p["o"]:,}', usd(call_cost(p)),
                     usd(call_cost(p, 0.5)), usd(call_cost(p, 0, True))])
    t["A"] = md(rows, ["Call profile", "Model", "In tok", "Out tok", "List", "50% cached input", "Batch"])
    # B. per-account monthly exposure under the 60-call cap
    cap = 60
    scen = [
        ("Median free user: 12 calls, routed mix", 12 * blended_call()),
        ("Heavy free user: 45 calls, routed mix", 45 * blended_call()),
        ("At the cap, routed mix (60)", cap * blended_call()),
        ("At the cap on the app default model, opus-5 (60)", cap * call_cost(PROFILES["app default model (opus-5)"])),
        ("At the cap, worst the clamp allows, fable-5.1 (60)", cap * call_cost(PROFILES["worst the clamp allows (fable)"])),
    ]
    t["B"] = md([[a, usd(b, 2), usd(b * 12, 0)] for a, b in scen], ["Scenario (shared key, per account)", "Per month", "Per year"])
    t["B_vals"] = scen
    # C. individual plan margin
    rows = []
    for name, price, interval in [("Plus monthly", PLUS["monthly"], "monthly"), ("Plus yearly", PLUS["yearly"], "yearly"),
                                  ("Pro monthly", PRO["monthly"], "monthly"), ("Pro yearly", PRO["yearly"], "yearly")]:
        for label, calls, pc in [("12 calls routed", 12, blended_call()), ("60 calls routed", 60, blended_call()),
                                 ("60 calls opus-5", 60, call_cost(PROFILES["app default model (opus-5)"]))]:
            rev, cost, cm, m = individual_margin(price, interval, calls, pc)
            rows.append([name, label, usd(rev, 2), usd(cost, 2), usd(cm, 2), pct(m)])
    t["C"] = md(rows, ["Plan", "AI usage", "Revenue/mo", "Cost/mo", "Contribution/mo", "Margin"])
    rows = []
    for store in ["web", "store_15", "store_30"]:
        rev, cost, cm, m = individual_margin(PLUS["yearly"], "yearly", 12, blended_call(), store)
        rows.append([store, usd(rev, 2), usd(cost, 2), pct(m)])
    t["C_store"] = md(rows, ["Channel (Plus yearly, 12 calls routed)", "Revenue/mo", "Cost/mo", "Margin"])
    # D. free-tier funding: how many free actives does one payer carry
    rows = []
    for u, label in [(0.2, "20% of cap"), (0.5, "50% of cap"), (1.0, "100% of cap")]:
        free_cost = u * cap * blended_call() + sum(v[1] for v in INDIV_COST.values())
        rev, cost, cm, m = individual_margin(PLUS["yearly"], "yearly", 12, blended_call())
        rows.append([label, usd(free_cost, 2), usd(cm, 2), f"{cm / free_cost:,.1f}"])
    t["D"] = md(rows, ["Free-user AI use", "Cost per free active/mo (routed)", "Plus-yearly contribution/mo", "Free actives one payer funds"])
    # E. institutional cost to serve and floors
    rows = []
    for name, c in [("lean", 0), ("base", 1), ("heavy", 2)]:
        rows.append([name, usd(tenant_fixed(c), 0)])
    t["E_fixed"] = md(rows, ["Case", "Fixed cost to serve one tenant per year"])
    rows = []
    for name, c in [("lean", 0), ("base", 1), ("heavy", 2)]:
        v, ai = variable_per_active_year(c)
        rows.append([name, usd(v, 2), usd(ai, 2)])
    t["E_var"] = md(rows, ["Case", "Variable cost per active student-year", "of which AI"])
    rows = []
    for tier, n_enrolled, act in [("department", 1_500, 0.5), ("campus", 10_000, 0.4), ("campus", 10_000, 0.7), ("system", 60_000, 0.4)]:
        n_act = int(n_enrolled * act)
        for gm in (0.60, 0.75):
            r = [tier, f"{n_enrolled:,}", pct(act), f"{n_act:,}", pct(gm)]
            for c in (0, 1, 2):
                v, _ = variable_per_active_year(c)
                cost = tenant_fixed(c, tier) + n_act * v
                floor = cost / (1 - gm)
                r.append(f"{usd(floor, 0)} ({usd(floor / n_act, 2)}/active)")
            rows.append(r)
    t["E_floor"] = md(rows, ["Tier", "Enrolled", "Active", "Active n", "Target GM", "Floor ACV lean", "base", "heavy"])
    rows = []
    for tier in DEAL_MIN_ACV:
        acv = DEAL_MIN_ACV[tier]
        n_act = ACTIVE_ASSUMED[tier]
        r = [tier, usd(acv, 0), f"{n_act:,}"]
        for c in (0, 1, 2):
            v, _ = variable_per_active_year(c)
            cost = tenant_fixed(c, tier) + n_act * v
            r.append(pct((acv - cost) / acv))
        rows.append(r)
    t["E_min"] = md(rows, ["Tier", "Deal-desk minimum ACV (proposed)", "Active n (assumed)", "GM lean", "GM base", "GM heavy"])
    # E2. what each proposed minimum ACV can fund
    rows = []
    for tier in DEAL_MIN_ACV:
        acv = DEAL_MIN_ACV[tier]
        n_act = ACTIVE_ASSUMED[tier]
        for gm in (0.60, 0.75):
            budget = acv * (1 - gm)
            r = [tier, usd(acv, 0), pct(gm), usd(budget, 0)]
            for c in (0, 1):
                v, _ = variable_per_active_year(c)
                left = budget - n_act * v
                r.append(f"{usd(left, 0)} ({left / 120_000:.2f} FTE)")
            rows.append(r)
    t["E_budget"] = md(rows, ["Tier", "Minimum ACV (proposed)", "Target GM", "Total cost it can carry",
                              "Left for fixed cost, lean variable", "Left for fixed cost, base variable"])
    # F. tornado at a reference deal
    n_act = ACTIVE_ASSUMED["campus"]
    ref_rev = (tenant_fixed(1) + n_act * variable_per_active_year(1)[0]) / (1 - 0.60)   # priced for 60% GM at base cost
    def gm(case_fixed, **kw):
        c_fixed = tenant_fixed(case_fixed)
        v, _ = variable_per_active_year(1, **kw)
        return (ref_rev - c_fixed - n_act * v) / ref_rev
    base = gm(1)
    rows = []
    levers = [
        ("AI calls per active per month (8 / 15 / 30)", lambda i: gm(1, ai_calls_per_month=VARIABLE["ai_calls_per_month"][i])),
        ("AI model mix: all-haiku / routed / all-opus-5.5", None),
        ("Prompt-cache hit on input (50% vs 0%)", lambda i: gm(1, cache_hit=(0.5, 0.0, 0.0)[i])),
        ("Support tickets/100/mo (2 / 4 / 8)", lambda i: gm(1, tickets_per_100_per_month=VARIABLE["tickets_per_100_per_month"][i])),
        ("Cost per ticket ($5 / $8 / $15)", lambda i: gm(1, cost_per_ticket=VARIABLE["cost_per_ticket"][i])),
        ("Storage + egress per active/mo ($0.02 / 0.05 / 0.15)", lambda i: gm(1, storage_egress_per_month=VARIABLE["storage_egress_per_month"][i])),
        ("Fixed cost to serve (lean / base / heavy)", lambda i: gm(i)),
    ]
    for name, fn in levers:
        if fn is None:
            lo = gm(1, per_call=call_cost(PROFILES["light    (note -> cards)"]))
            hi = gm(1, per_call=call_cost(PROFILES["premium  (long essay feedback)"]))
        else:
            lo, hi = fn(0), fn(2)
        rows.append([name, pct(lo), pct(base), pct(hi), f"{abs(lo - hi) * 100:.1f} pts"])
    rows.sort(key=lambda r: -float(r[-1].split()[0]))
    t["F"] = md(rows, ["Driver (lean-side / base / heavy-side)", "GM lean-side", "GM base", "GM heavy-side", "Swing"])
    t["F_ref"] = (ref_rev, n_act, base)
    # G. implementation
    rows = []
    for tier, h in IMPL_HOURS.items():
        cost = h * IMPL_RATE
        fee_ = max(IMPL_FEE_FLOOR, cost / 0.5)
        rows.append([tier, h, usd(cost, 0), usd(IMPL_FEE_FLOOR, 0), pct((IMPL_FEE_FLOOR - cost) / IMPL_FEE_FLOOR) if IMPL_FEE_FLOOR else "-",
                     usd(fee_, 0)])
    t["G"] = md(rows, ["Tier", "Hours (assumed)", "Delivery cost", "Deal-desk fee floor", "Margin at the floor", "Fee for a 50% margin"])
    # H. marketplace
    rows = []
    o = MKT["order"]
    pay = o * CARD_PCT + CARD_FIXED
    dispute = MKT["dispute_rate"] * (o + MKT["dispute_fee"])
    refund_fee = MKT["refund_rate"] * pay      # processor fee not returned on refund
    support = MKT["support_per_order"] + MKT["moderation_per_order"]
    cost = pay + dispute + refund_fee + support
    be = cost / o
    for take in (0.05, 0.10, 0.15, 0.20):
        rows.append([pct(take), usd(o * take, 2), usd(o * take - cost, 2), pct((o * take - cost) / (o * take))])
    t["H"] = md(rows, ["Take rate", "Gross take on a $50 order", "Contribution after costs", "Margin on take"])
    t["H_be"] = (be, pay, dispute, refund_fee, support)
    return t


def check():
    t = tables()
    # the finding the doc leans on: a free account at the cap on the app's default model costs
    # more per month than a Plus yearly subscriber pays (59/12)
    opus_cap = 60 * call_cost(PROFILES["app default model (opus-5)"])
    assert opus_cap > PLUS["yearly"] / 12, opus_cap
    # control: the same cap on the cheapest model is far below it, so the probe is not trivially true
    assert 60 * call_cost(PROFILES["light    (note -> cards)"]) < PLUS["yearly"] / 12 / 5
    # routed mix must sum to 1
    assert abs(sum(ROUTED_MIX.values()) - 1) < 1e-9
    # costs are monotone lean <= base <= heavy
    assert tenant_fixed(0) < tenant_fixed(1) < tenant_fixed(2)
    assert variable_per_active_year(0)[0] < variable_per_active_year(1)[0] < variable_per_active_year(2)[0]
    print("ok")


if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
        sys.exit(0)
    t = tables()
    print(f"blended routed call (no cache): {usd(blended_call(), 4)}   with 50% cached input: {usd(blended_call(0.5), 4)}\n")
    for k in ["A", "B", "C", "C_store", "D", "E_fixed", "E_var", "E_floor", "E_min", "E_budget", "F", "G", "H"]:
        print(f"### {k}\n{t[k]}\n")
    print("F reference deal (revenue, active, base GM):", t["F_ref"])
    print("H break-even take rate, parts:", t["H_be"])
