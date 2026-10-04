"""A tiny expression DSL: one definition of each model row, two evaluators.

Every row of the financial model is written once as an expression tree. It is
evaluated in Python (the reference run) and emitted as an Excel formula (the
workbook). verify.py recalculates the workbook in LibreOffice and compares the
two cell by cell, so a formula-generation or reference error shows up as a
difference. It does NOT prove the business logic is right; the invariant checks
in verify.py do that separately.
"""
from __future__ import annotations
from openpyxl.utils import get_column_letter

FIRST_COL = 3          # month 1 sits in column C of a scenario sheet
HDR_T, HDR_YR, HDR_MOY = 18, 20, 21   # header rows on a scenario sheet


def col(t: int) -> str:
    return get_column_letter(FIRST_COL + t - 1)


def wrap(x):
    return x if isinstance(x, Node) else Num(x)


class Node:
    def __add__(s, o): return Bin('+', s, wrap(o))
    def __radd__(s, o): return Bin('+', wrap(o), s)
    def __sub__(s, o): return Bin('-', s, wrap(o))
    def __rsub__(s, o): return Bin('-', wrap(o), s)
    def __mul__(s, o): return Bin('*', s, wrap(o))
    def __rmul__(s, o): return Bin('*', wrap(o), s)
    def __truediv__(s, o): return Bin('/', s, wrap(o))
    def __rtruediv__(s, o): return Bin('/', wrap(o), s)
    def __ge__(s, o): return Cmp('>=', s, wrap(o))
    def __le__(s, o): return Cmp('<=', s, wrap(o))
    def __gt__(s, o): return Cmp('>', s, wrap(o))
    def __lt__(s, o): return Cmp('<', s, wrap(o))
    def __neg__(s): return Bin('-', Num(0), s)
    def eq(s, o): return Cmp('=', s, wrap(o))


class Num(Node):
    def __init__(s, v): s.v = v


class P(Node):          # scalar assumption
    def __init__(s, k): s.k = k


class PY(Node):         # per-year assumption (Y1, Y2, Y3)
    def __init__(s, k): s.k = k


class S(Node):          # scenario parameter
    def __init__(s, k): s.k = k


class Row(Node):        # another row, at t+off
    def __init__(s, n, off=0): s.n, s.off = n, off


class SumRow(Node):
    def __init__(s, n, a, b): s.n, s.a, s.b = n, a, b


class T(Node): pass
class YR(Node): pass
class MOY(Node): pass


class Seas(Node):       # seasonality index for the month of year
    pass


class Sched(Node):      # schedule value; gated schedules start at month `gate` and slip with the scenario delay
    def __init__(s, n, gate=None): s.n, s.gate = n, gate


class HC(Node):         # headcount queries: kind in pay|fte|hires
    def __init__(s, kind, fn=None): s.kind, s.fn = kind, fn


class Ann(Node):        # annual aggregate of a row for year (y + off); flow rows sum, stock rows take the year end
    def __init__(s, n, off=0): s.n, s.off = n, off


class IfErr(Node):      # IFERROR(a, b)
    def __init__(s, a, b): s.a, s.b = wrap(a), wrap(b)


class Bin(Node):
    def __init__(s, op, a, b): s.op, s.a, s.b = op, a, b


class Cmp(Node):
    def __init__(s, op, a, b): s.op, s.a, s.b = op, a, b


class And(Node):
    def __init__(s, *a): s.a = a


class If(Node):
    def __init__(s, c, a, b): s.c, s.a, s.b = c, wrap(a), wrap(b)


class Max(Node):
    def __init__(s, *a): s.a = [wrap(x) for x in a]


class Min(Node):
    def __init__(s, *a): s.a = [wrap(x) for x in a]


# ---------------------------------------------------------------- python eval
class Ctx:
    def __init__(s, A, SC, rows, headcount, schedules, season):
        s.A, s.SC, s.rows, s.hc, s.sched, s.season = A, SC, rows, headcount, schedules, season
        s.memo = {}

    def row(s, name, t):
        if t < 1:
            return 0.0
        k = (name, t)
        if k not in s.memo:
            s.memo[k] = ev(s.rows[name].expr, s, t)
        return s.memo[k]


def ev(n, c: Ctx, t):
    if isinstance(n, Num): return n.v
    if isinstance(n, P):
        v = c.A[n.k]
        return v if not isinstance(v, Node) else ev(v, c, t)
    if isinstance(n, PY): return c.A[n.k][(t - 1) // 12]
    if isinstance(n, S): return c.SC[n.k]
    if isinstance(n, Row): return c.row(n.n, t + n.off)
    if isinstance(n, SumRow): return sum(c.row(n.n, i) for i in range(max(1, t + n.a), t + n.b + 1))
    if isinstance(n, T): return t
    if isinstance(n, YR): return (t - 1) // 12 + 1
    if isinstance(n, MOY): return (t - 1) % 12 + 1
    if isinstance(n, Seas): return c.season[(t - 1) % 12]
    if isinstance(n, Sched):
        i = t if n.gate is None else t - (c.A[n.gate] - 1) - c.SC['delay']
        return 0.0 if i < 1 or i > 36 else c.sched[n.n][int(i) - 1]
    if isinstance(n, HC):
        hd = c.SC['hire_delay']
        tot = 0.0
        for r in c.hc:
            if r.get('extra', 0) and not c.SC['fullscope']:
                continue
            start = r['start'] + r['gated'] * hd
            if n.kind == 'pay':
                if r['fn'] == n.fn and t >= start:
                    tot += r['fte'] * r['salary'] / 12 * (1 + c.A['burden'])
            elif n.kind == 'fte':
                if (n.fn is None or r['fn'] == n.fn) and t >= start:
                    tot += r['fte']
            elif n.kind == 'hires':
                if t >= 2 and start == t:
                    tot += r['fte']
        return tot
    if isinstance(n, Ann):
        y = (t - 1) // 12 + n.off
        if y < 0: return 0.0
        r = c.rows[n.n]
        months = range(12 * y + 1, 12 * y + 13)
        vals = [c.row(n.n, m) for m in months]
        return vals[-1] if r.kind == 'stock' else sum(vals)
    if isinstance(n, IfErr):
        try:
            return ev(n.a, c, t)
        except ZeroDivisionError:
            return ev(n.b, c, t)
    if isinstance(n, Bin):
        a, b = ev(n.a, c, t), ev(n.b, c, t)
        if n.op == '+': return a + b
        if n.op == '-': return a - b
        if n.op == '*': return a * b
        return a / b
    if isinstance(n, Cmp):
        a, b = ev(n.a, c, t), ev(n.b, c, t)
        return {'>=': a >= b, '<=': a <= b, '>': a > b, '<': a < b, '=': abs(a - b) < 1e-9}[n.op]
    if isinstance(n, And): return all(ev(x, c, t) for x in n.a)
    if isinstance(n, If): return ev(n.a, c, t) if ev(n.c, c, t) else ev(n.b, c, t)
    if isinstance(n, Max): return max(ev(x, c, t) for x in n.a)
    if isinstance(n, Min): return min(ev(x, c, t) for x in n.a)
    raise TypeError(n)


# ---------------------------------------------------------------- excel emit
class XL:
    """Cell-address maps the emitter needs."""
    def __init__(s, assum_cell, annual_cell, scen_cell, row_no, sched_row, season_rng, hc_rng, delay_cell, hd_cell):
        s.assum_cell, s.annual_cell, s.scen_cell = assum_cell, annual_cell, scen_cell
        s.row_no, s.sched_row, s.season_rng, s.hc_rng = row_no, sched_row, season_rng, hc_rng
        s.delay_cell, s.hd_cell = delay_cell, hd_cell
        s.ann_col = ['AN', 'AO', 'AP']


def xl(n, x: XL, t: int) -> str:
    c = col(t)
    if isinstance(n, Num):
        return repr(float(n.v)) if isinstance(n.v, float) else str(n.v)
    if isinstance(n, P): return x.assum_cell[n.k]
    if isinstance(n, PY): return x.annual_cell[n.k][(t - 1) // 12]
    if isinstance(n, S): return x.scen_cell[n.k]
    if isinstance(n, Row):
        i = t + n.off
        return '0' if i < 1 else f'{col(i)}{x.row_no[n.n]}'
    if isinstance(n, SumRow):
        lo, hi = max(1, t + n.a), t + n.b
        if hi < lo: return '0'
        r = x.row_no[n.n]
        return f'SUM({col(lo)}{r}:{col(hi)}{r})' if hi > lo else f'{col(lo)}{r}'
    if isinstance(n, T): return f'{c}${HDR_T}'
    if isinstance(n, YR): return f'{c}${HDR_YR}'
    if isinstance(n, MOY): return f'{c}${HDR_MOY}'
    if isinstance(n, Seas): return f'INDEX({x.season_rng},{c}${HDR_MOY})'
    if isinstance(n, Sched):
        r = x.sched_row[n.n]
        rng = f'Schedules!$C${r}:$AL${r}'
        if n.gate is None: return f'INDEX({rng},{c}${HDR_T})'
        idx = f'({c}${HDR_T}-({x.assum_cell[n.gate]}-1)-{x.delay_cell})'
        return f'IF(OR({idx}<1,{idx}>36),0,INDEX({rng},{idx}))'
    if isinstance(n, HC):
        R = x.hc_rng
        eff = f'({R["start"]}+{R["gated"]}*{x.hd_cell})'
        scope = f'(({R["extra"]}=0)+({R["extra"]}=1)*{x.scen_cell["fullscope"]})'
        tt = f'{c}${HDR_T}'
        if n.kind == 'pay':
            return f'SUMPRODUCT(({R["fn"]}="{n.fn}")*{R["fte"]}*{R["salary"]}*{scope}*({tt}>={eff}))/12*(1+{x.assum_cell["burden"]})'
        if n.kind == 'fte':
            sel = f'*({R["fn"]}="{n.fn}")' if n.fn else ''
            return f'SUMPRODUCT({R["fte"]}{sel}*{scope}*({tt}>={eff}))'
        return f'IF({tt}>=2,SUMPRODUCT({R["fte"]}*{scope}*({eff}={tt})),0)'
    if isinstance(n, Ann):
        y = (t - 1) // 12 + n.off
        return '0' if y < 0 else f'{x.ann_col[y]}{x.row_no[n.n]}'
    if isinstance(n, IfErr): return f'IFERROR({xl(n.a, x, t)},{xl(n.b, x, t)})'
    if isinstance(n, Bin): return f'({xl(n.a, x, t)}{n.op}{xl(n.b, x, t)})'
    if isinstance(n, Cmp):
        op = {'>=': '>=', '<=': '<=', '>': '>', '<': '<', '=': '='}[n.op]
        return f'({xl(n.a, x, t)}{op}{xl(n.b, x, t)})'
    if isinstance(n, And): return 'AND(' + ','.join(xl(a, x, t) for a in n.a) + ')'
    if isinstance(n, If): return f'IF({xl(n.c, x, t)},{xl(n.a, x, t)},{xl(n.b, x, t)})'
    if isinstance(n, Max): return 'MAX(' + ','.join(xl(a, x, t) for a in n.a) + ')'
    if isinstance(n, Min): return 'MIN(' + ','.join(xl(a, x, t) for a in n.a) + ')'
    raise TypeError(n)
