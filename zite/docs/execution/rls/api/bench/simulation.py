# Reproduce: 60 s, token bucket (cap 100, 20/s, starts full) vs sliding-window log (100 per 5 s).
import bisect
def traffic(rate, bursts):
    t = [i / rate for i in range(int(60 * rate))]
    if bursts: t += [b for b in range(0, 60, 10) for _ in range(300)]
    return sorted(t)
def bucket(ts, cap=100, r=20):
    tok, last, ok = cap, 0.0, 0
    for t in ts:
        tok = min(cap, tok + (t - last) * r); last = t
        if tok >= 1 - 1e-9: tok -= 1; ok += 1
    return ok
def window(ts, n=100, w=5.0):
    acc, ok = [], 0
    for t in ts:
        lo = bisect.bisect_right(acc, t - w)
        if len(acc) - lo < n: acc.append(t); ok += 1
    return ok
for name, rate, b in [("steady", 20, False), ("bursty", 20, True), ("overload", 80, True)]:
    ts = traffic(rate, b); print(f"{name:9} offered={len(ts):5} bucket={bucket(ts):5} window={window(ts):5}")
