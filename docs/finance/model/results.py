"""Shared result access for the document renderer."""
import copy
import engine, spec

NAMES = [n for k, n in spec.SCENARIOS]
KEYS = [k for k, n in spec.SCENARIOS]
_cache = {}


def run(i, **kw):
    if kw:
        return engine.run(i, **kw)
    if i not in _cache:
        _cache[i] = engine.run(i)
    return _cache[i]


def ys(o, name, y):          # annual flow sum, y = 0..2
    return sum(o[name][12 * y:12 * y + 12])


def ye(o, name, y):          # year-end stock
    return o[name][12 * y + 11]


def peak(o):
    return -min(o['cum_cash'])


def first_neg(o, capital):
    for t, v in enumerate(o['cum_cash'], 1):
        if capital + v < 0:
            return t
    return None


def fm(x, d=2):
    s = abs(x)
    if s >= 1e6: t = f'${s / 1e6:,.{d}f}M'
    elif s >= 1e3: t = f'${s / 1e3:,.0f}k'
    else: t = f'${s:,.0f}'
    return f'-{t}' if x < -0.5 else t


def fk(x):
    """thousands, parentheses for negatives"""
    v = round(x / 1000)
    return f'({abs(v):,})' if v < 0 else f'{v:,}'


def pc(x, d=1):
    return f'{x * 100:,.{d}f}%'


def table(headers, rows, align=None):
    align = align or ['l'] + ['r'] * (len(headers) - 1)
    sep = ['---' if a == 'l' else '---:' for a in align]
    out = ['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join(sep) + ' |']
    out += ['| ' + ' | '.join(str(c) for c in r) + ' |' for r in rows]
    return '\n'.join(out)


def banner(title, status, extra=None):
    rows = [('Status', f'**{status}**'),
            ('Owner', 'Harrison Rubin: commercial proposal owner; finance operator, CPA, tax adviser, counsel and signing authority unassigned'),
            ('Evidence date', '2026-10-04 at repository revision `7287ddc` (origin/main)'),
            ('Source', 'Rendered from `docs/finance/model/` (the workbook and its Python reference run). Edit the model, not this page.')]
    if extra:
        rows += extra
    return f'# {title}\n\n| Control | Value |\n| --- | --- |\n' + '\n'.join(f'| {a} | {b} |' for a, b in rows) + '\n'


def payroll_total(o, y):
    return sum(ys(o, f'pay_{f}', y) for f in ['ENG', 'PROD', 'SEC', 'SUPPORT', 'IMPL', 'CS', 'TS', 'SALES', 'MKT', 'GA'])
