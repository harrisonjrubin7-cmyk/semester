"""Independent re-implementation (plain loops, no DSL) of the student funnel and the Department tier,
compared with the model's Base scenario. Catches mistakes in how the rows were transcribed
(offsets, windows, lags) that a formula-vs-formula comparison cannot.
"""
import engine, spec

A = engine.build_A()
out, kp = engine.run(1)   # Base
N = 36
season = spec.SEASON

# ---------- student funnel
org = []; free = [0.0] * (N + 1); pm = [0.0] * (N + 1); S = [0.0] * (N + 1); paid_a = [0.0] * (N + 1)
rev = []; bill = []
o = None
for t in range(1, N + 1):
    y = (t - 1) // 12
    o = A['organic_start'] if t == 1 else o * (1 + A['g'][y])
    gated = t >= A['gate_plus']
    sig = o * season[(t - 1) % 12] * (1 if gated else A['pre_gate_share']) + (A['paid_budget'][y] / A['cps'] if gated else 0.0)
    new_active = sig * A['activation']
    conv = A['conv'] * free[t - 1] if gated else 0.0
    free[t] = max(0.0, free[t - 1] * (1 - A['free_churn']) + new_active - conv)
    new_m, new_a = conv * (1 - A['annual_mix']), conv * A['annual_mix']
    pm[t] = pm[t - 1] * (1 - A['churn_m']) + new_m
    ren = A['renew_a'] * (S[t - 12] if t > 12 else 0.0)
    S[t] = new_a + ren
    paid_a[t] = sum(S[max(1, t - 11):t + 1])
    d = 1 - A['stud_disc']
    rev.append((A['price_m'] * d * pm[t] + A['price_a'] * d / 12 * paid_a[t]) * (1 - A['refund']))
    bill.append((A['price_m'] * d * pm[t] + A['price_a'] * d * S[t]) * (1 - A['refund']))
for t in range(N):
    assert abs(rev[t] - out['stud_rev'][t]) < 1e-6 * max(1, rev[t]), ('stud_rev', t + 1, rev[t], out['stud_rev'][t])
    assert abs(bill[t] - out['stud_bill'][t]) < 1e-6 * max(1, bill[t]), ('stud_bill', t + 1)
    assert abs(free[t + 1] - out['free'][t]) < 1e-6 * max(1, free[t + 1]), ('free', t + 1)
    assert abs(pm[t + 1] + paid_a[t + 1] - out['paid_total'][t]) < 1e-6 * max(1, out['paid_total'][t]), ('paid_total', t + 1)

# ---------- Department tier (gated paid pilots, unpaid design partners, direct annual)
sch = dict((k, v) for k, l, v, n in spec.SCHEDULES)
gate_p, gate_d = A['gate_pilot'], A['gate_direct']
def at(sched, t, gate=None):
    i = t if gate is None else t - (gate - 1)          # base scenario: delay 0
    return sched[i - 1] if 1 <= i <= 36 else 0.0
paid = [0.0] * (N + 8); dp = [0.0] * (N + 8)
for t in range(1, N + 1):
    paid[t] = at(sch['pilot_D'], t, gate_p)
    dp[t] = at(sch['dp_D'], t)
starts = [0.0] * (N + 1); SV = [0.0] * (N + 1); cred = [0.0] * (N + 1)
acv = A['acv_D'] * (1 - A['inst_disc'])
logos = []; core_rev = []; pil_rev = []
for t in range(1, N + 1):
    conv_paid = A['rho_D'] * (paid[t - 7] if t - 7 >= 1 else 0.0)
    if t == gate_p:
        conv_dp = A['dp_rho'] * sum(dp[1:max(1, t - 7) + 1]) if t - 7 >= 1 else 0.0
    elif t > gate_p:
        conv_dp = A['dp_rho'] * (dp[t - 7] if t - 7 >= 1 else 0.0)
    else:
        conv_dp = 0.0
    n = conv_paid + conv_dp + at(sch['direct_D'], t, gate_d)
    starts[t] = n + A['rr_i'] * (starts[t - 12] if t > 12 else 0.0)
    SV[t] = n * acv + A['rr_i'] * (1 + A['expansion']) * (SV[t - 12] if t > 12 else 0.0)
    cred[t] = A['credit_D'] * conv_paid
    logos.append(sum(starts[max(1, t - 11):t + 1]))
    core_rev.append((sum(SV[max(1, t - 11):t + 1]) - sum(cred[max(1, t - 11):t + 1])) / 12)
    pil_rev.append(A['pilotfee_D'] / 6 * sum(paid[max(1, t - 5):t + 1]))
for t in range(N):
    assert abs(logos[t] - out['L_D'][t]) < 1e-9, ('L_D', t + 1, logos[t], out['L_D'][t])
    assert abs(core_rev[t] - out['core_rev_D'][t]) < 1e-6 * max(1, core_rev[t]), ('core_rev_D', t + 1)
    assert abs(pil_rev[t] - out['pilot_rev_D'][t]) < 1e-6 * max(1, pil_rev[t]), ('pilot_rev_D', t + 1)
assert out['rev_total'][gate_p - 2] == 0.0 or True
# no revenue of any kind before the first gate opens (student gate is later; services/pilot start at gate_pilot)
assert all(v == 0 for v in out['rev_total'][:gate_p - 1]), 'revenue booked before the paid-pilot gate'

# ---------- hand-computed spot values (month 1)
assert abs(out['signups_org'][0] - 1200 * 1.3 * 0.25) < 1e-9     # month 1: invitation-only share
assert abs(out['free'][0] - 1200 * 1.3 * 0.25 * 0.6) < 1e-9
assert out['signups_paid'][0] == 0.0 and out['conv_new'][0] == 0.0

# ---------- accounting identities across all scenarios
for i in range(len(spec.SCENARIOS)):
    o2, k2 = engine.run(i)
    for t in range(N):
        assert abs(o2['cogs_check'][t]) < 1e-6
        assert o2['deferred'][t] > -1e-6, ('deferred<0', i, t + 1)
    tot_bill = sum(o2['bill_total']); tot_rev = sum(o2['rev_total'])
    assert abs(tot_bill - tot_rev - o2['deferred'][-1]) < 1e-3
print('independent check passed: student funnel, Department tier, spot values, identities in all scenarios')
