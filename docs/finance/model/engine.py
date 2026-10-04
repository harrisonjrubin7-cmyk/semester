"""Reference run of the model in Python (same expressions the workbook is built from)."""
import sys
sys.setrecursionlimit(20000)
from dsl import Ctx, ev
import spec


def build_A():
    A = {}
    for k, label, unit, v, tag, note in spec.ASSUMPTIONS:
        if label is None: continue
        A[k] = v
    for key, label, unit, vals, tag, note in spec.TIER_ASSUMPTIONS:
        for i, t in enumerate(spec.TIERS):
            A[f'{key}_{t}'] = vals[i]
    for k, label, unit, vals, tag, note in spec.ANNUAL:
        if label is None: continue
        A[k] = vals
    for k, label, unit, expr, note in spec.DERIVED:
        A[k] = expr
    return A


def scenario_values(idx):
    return {k: vals[idx] for k, label, unit, vals, note in spec.SCEN_PARAMS}


def headcount_rows():
    return [dict(id=h[0], role=h[1], fn=h[2], fte=h[3], start=h[4], salary=h[5], gated=h[6], extra=h[7] if len(h) > 7 else 0) for h in spec.HEADCOUNT]


def run(idx, A=None, hc=None, sc=None):
    A = A or build_A()
    scv = scenario_values(idx)
    scv.update(sc or {})
    ctx = Ctx(A, scv, {r.name: r for r in spec.ROWS if r.name},
              hc or headcount_rows(), {k: v for k, l, v, n in spec.SCHEDULES}, spec.SEASON)
    out = {}
    for r in spec.ROWS:
        if r.name:
            out[r.name] = [ctx.row(r.name, t) for t in range(1, 37)]
    ctx.rows.update({r.name: r for r in spec.KPIS})
    kp = {}
    for r in spec.KPIS:
        kp[r.name] = [ev(r.expr, ctx, 12 * y) for y in (1, 2, 3)]
    return out, kp


if __name__ == '__main__':
    names = [s[1] for s in spec.SCENARIOS]
    for i, nm in enumerate(names):
        out, kp = run(i)
        print(f"\n== {nm}")
        for k in ['k_rev', 'k_arr', 'k_gm', 'k_ebitda', 'k_burn', 'k_cum', 'k_logos', 'k_paid', 'k_fte', 'k_burn_mult']:
            print(f"{k:14s}", [round(x, 3) if abs(x) < 10 else round(x) for x in kp[k]])
