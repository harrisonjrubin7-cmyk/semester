"""Derived analyses used by the document renderer (all computed from the same engine)."""
import copy
import engine, spec
from results import run, peak, ys, ye

BASE = 1


def metrics(o, k):
    return dict(peak=peak(o), arr=o['arr'][-1], rev3=sum(o['rev_total'][24:]), ltvcac=k['k_ltv_cac'][2], gm3=k['k_gm'][2],
                burn3=k['k_burn'][2])


def variant(mod_A=None, mod_sc=None, mod_hc=None, idx=BASE):
    A = engine.build_A()
    sc = {}
    hc = [dict(r) for r in engine.headcount_rows()]
    if mod_A: mod_A(A)
    if mod_sc: mod_sc(sc)
    if mod_hc: mod_hc(hc)
    return engine.run(idx, A=A, hc=hc, sc=sc)


def tornado():
    b = metrics(*run(BASE))
    items = []

    def add(label, lo, hi, lo_lbl, hi_lbl):
        ml, mh = metrics(*lo), metrics(*hi)
        items.append(dict(label=label, lo=lo_lbl, hi=hi_lbl,
                          peak_lo=ml['peak'] - b['peak'], peak_hi=mh['peak'] - b['peak'],
                          arr_lo=ml['arr'] - b['arr'], arr_hi=mh['arr'] - b['arr']))

    def tiers(f):
        def m(A):
            for t in 'DCY': A[f'acv_{t}'] *= f
        return m

    def rho(d):
        def m(A):
            for t in 'DCY': A[f'rho_{t}'] = min(1.0, max(0.0, A[f'rho_{t}'] + d))
        return m

    def eng(f):
        def m(hc):
            for r in hc:
                if r['fn'] in ('ENG', 'PROD', 'SEC'): r['salary'] *= f
        return m

    add('Paid-pilot gate opens (months)', variant(mod_sc=lambda s: s.update(delay=-3)), variant(mod_sc=lambda s: s.update(delay=6)), '3 months earlier', '6 months later')
    add('Pilot and direct-deal volume', variant(mod_sc=lambda s: s.update(inst=1.3)), variant(mod_sc=lambda s: s.update(inst=0.7)), 'x1.3', 'x0.7')
    add('Institutional price realization / ACV', variant(tiers(1.2)), variant(tiers(0.8)), '+20%', '-20%')
    add('Pilot-to-annual conversion', variant(rho(0.15)), variant(rho(-0.15)), '+15 pts', '-15 pts')
    add('Engineering, product, security salaries', variant(mod_hc=eng(0.85)), variant(mod_hc=eng(1.15)), '-15%', '+15%')
    add('Payroll burden', variant(lambda A: A.update(burden=0.18)), variant(lambda A: A.update(burden=0.30)), '18%', '30%')
    add('AI unit cost', variant(mod_sc=lambda s: s.update(ai_unit=0.5)), variant(mod_sc=lambda s: s.update(ai_unit=2.0)), 'x0.5', 'x2')
    add('Gross logo renewal rate', variant(lambda A: A.update(rr_i=0.94)), variant(lambda A: A.update(rr_i=0.80)), '94%', '80%')
    add('Free-to-paid conversion (Plus)', variant(lambda A: A.update(conv=A['conv'] * 2)), variant(lambda A: A.update(conv=A['conv'] * 0.5)), 'x2', 'x0.5')
    add('Organic student signups', variant(lambda A: A.update(organic_start=A['organic_start'] * 2)), variant(lambda A: A.update(organic_start=A['organic_start'] * 0.5)), 'x2', 'x0.5')
    items.sort(key=lambda d: -max(abs(d['peak_lo']), abs(d['peak_hi'])))
    return b, items


def levers():
    """Actions that reduce peak funding need, each measured against Base."""
    b = metrics(*run(BASE))
    out = []

    def defer(months, after):
        def m(hc):
            for r in hc:
                if r['start'] > after: r['start'] += months
        return m

    def hold_eng(cap_start):
        def m(hc):
            for r in hc:
                if r['fn'] in ('ENG', 'PROD') and r['start'] > cap_start: r['start'] += 36
        return m

    def no_amb(A):
        for k in ('mk_amb', 'mk_pr'): A[k] = tuple(v * 0.5 for v in A[k])

    cands = [
     ('Defer every hire that starts after month 18 by six months', variant(mod_hc=defer(6, 18))),
     ('Hold engineering and product at the month-13 team (no later engineering hires)', variant(mod_hc=hold_eng(13))),
     ('Gate the sales, implementation, CS and partnership hires six months behind the evidence gates', variant(mod_sc=lambda s: s.update(hire_delay=6))),
     ('Keep the paid student-acquisition budget at zero until measured LTV/CAC clears 3', variant(lambda A: A.update(paid_budget=(0, 0, 0)))),
     ('Cap free-tier AI at 4 requests a month (from 10)', variant(lambda A: A.update(req_free=4))),
     ('Halve security / legal / insurance program lines (NOT recommended: shown to size what they cost)', variant(lambda A: [A.update({k: tuple(v * 0.5 for v in A[k])}) for k in ('sec_pentest', 'sec_soc2', 'sec_a11y', 'sec_grc', 'sec_privacy', 'legal_retainer', 'ins_cyber', 'ins_do')])),
    ]
    def combined(hc):
        defer(6, 18)(hc)
        hold_eng(13)(hc)
    cands.append(('Combined: defer late hires, hold engineering at the month-13 team, gate go-to-market hires', variant(mod_hc=combined, mod_sc=lambda s: s.update(hire_delay=6))))
    cands.append(('Combined plus: cut the month-13 engineering and product team from 10 to 8 FTE', variant(mod_hc=lambda hc: (defer(6, 18)(hc), hold_eng(13)(hc), [r.update(fte=r['fte'] * 0.8) if r['fn'] in ('ENG', 'PROD') and r['start'] <= 13 else None for r in hc]), mod_sc=lambda s: s.update(hire_delay=6))))
    for lab, (o, k) in cands:
        m = metrics(o, k)
        out.append(dict(label=lab, peak=m['peak'], d_peak=m['peak'] - b['peak'], arr=m['arr'], d_arr=m['arr'] - b['arr']))
    return b, out


def breakeven_conv():
    """Conversion multiple of the Base assumption at which Y3 student LTV/CAC reaches 1 and 3."""
    res = {}
    base_conv = engine.build_A()['conv']
    for target in (1.0, 3.0):
        lo, hi = 0.5, 80.0
        for _ in range(28):
            mid = (lo + hi) / 2
            o, k = variant(lambda A, m=mid: A.update(conv=base_conv * m))
            if k['k_ltv_cac'][2] >= target: hi = mid
            else: lo = mid
        o, k = variant(lambda A, m=hi: A.update(conv=base_conv * m))
        res[target] = (hi, base_conv * hi, o['paid_total'][-1] / (o['paid_total'][-1] + o['free'][-1]), k['k_cac_stud'][2], k['k_ltv_stud'][2])
    return res


def ai_buildup():
    A = engine.build_A()
    p_in = A['mix_h'] * A['in_h'] + A['mix_s'] * A['in_s'] + A['mix_o'] * A['in_o']
    p_out = A['mix_h'] * A['out_h'] + A['mix_s'] * A['out_s'] + A['mix_o'] * A['out_o']
    eff_in = 1 - A['cache_share'] * A['cache_hit'] * (1 - A['cache_read'])
    c_in = A['tok_in'] / 1e6 * p_in * eff_in
    c_out = A['tok_out'] / 1e6 * p_out * A['think_mult']
    sub = c_in + c_out
    tot = sub * (1 + A['ai_overhead'])
    return dict(p_in=p_in, p_out=p_out, eff_in=eff_in, c_in=c_in, c_out=c_out, sub=sub, tot=tot,
                free=tot * A['req_free'], paid=tot * A['req_paid'], inst=tot * A['req_inst'])


def tier_economics():
    A = engine.build_A()
    ai = ai_buildup()
    infra_mau = (A['infra_compute'] + A['gb_per_mau'] * A['storage_price'] * A['repl_factor'] + A['egress_gb'] * A['egress_price'] * (1 - A['cdn_offload'])
                 + A['search_per_mau'] + A['notif_per_mau'] + A['obs_per_mau'])
    support_mau = A['tk_i'] / 100 * A['overflow_share'] * A['overflow_cost']
    rows = {}
    for t in 'DCY':
        acv = A[f'acv_{t}'] * (1 - A['inst_disc'])
        stu = A[f'students_{t}']
        var_mo = stu * (infra_mau + ai['inst'] + support_mau)
        integ_mo = A['conn_attach'] * A['conn_cost'] + A['sso_cost']
        var_yr = (var_mo + integ_mo) * 12
        ai_addon = A['ai_attach'] * A[f'ai_price_{t}']
        rows[t] = dict(list=A[f'acv_{t}'], net=acv, students=stu, per_student=acv / stu, var_yr=var_yr, gm=(acv - var_yr) / acv,
                       impl_fee=A[f'impl_{t}'], hours=A[f'hours_{t}'], std_cost=A[f'hours_{t}'] * A['loaded_rate'],
                       std_margin=(A[f'impl_{t}'] - A[f'hours_{t}'] * A['loaded_rate']) / A[f'impl_{t}'],
                       pilot_fee=A[f'pilotfee_{t}'], credit=A[f'credit_{t}'], rho=A[f'rho_{t}'], ai_addon=ai_addon,
                       ltv=acv * ((acv - var_yr) / acv) / (1 - A['rr_i']))
    return rows, infra_mau, support_mau


def tranches():
    o, k = run(BASE)
    gate_p = engine.build_A()['gate_pilot']
    mb = lambda a, b: sum(-x for x in o['op_cash'][a:b]) / (b - a)
    out = []
    plan = [('Tranche 1', 12, 'Through month 12: invitation-only validation, design-partner pilot activated and closed out, paid-pilot decision taken'),
            ('Tranche 2', 24, 'Through month 24: first paid pilots, first annual conversions, direct-sales gate'),
            ('Tranche 3', 36, 'Through month 36: repeated deployments; enterprise gate decision')]
    prev = 0.0
    for name, m, what in plan:
        cum = -o['cum_cash'][m - 1]
        cushion = 6 * mb(m - 6, m)
        out.append(dict(name=name, month=m, what=what, need=cum - prev, cum=cum, cushion=cushion, size=cum - prev + (cushion if m == 36 else 0)))
        prev = cum
    return out
