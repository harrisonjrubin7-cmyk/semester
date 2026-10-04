"""Build docs/finance/dashboard.html from the finance workbook.

Recalculates the workbook in LibreOffice once for each of the nine scenarios, reads the quarterly, annual and
snapshot figures, runs seven one-input sensitivities on the go/no-go plan (scenario 8), reads the hiring-gate
schedule, and injects it all as JSON into dashboard_template.html.

Usage: python3 build_dashboard.py [--fragment PATH]
  Writes ../dashboard.html (a standalone page). With --fragment, also writes the template with the data filled in,
  without the page wrapper, which is what gets published as an artifact.
Nothing here edits the workbook.
"""
import datetime, json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from openpyxl import load_workbook
from recalc import recalc

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, '..', 'semester-financial-model.xlsx')
TEMPLATE = os.path.join(HERE, 'dashboard_template.html')
OUT = os.path.join(HERE, '..', 'dashboard.html')

NAMES = ['Conservative', 'Base', 'Aggressive', 'Enterprise-delayed', 'High AI cost', 'Incident cost',
         'Gated plan', 'Go/no-go gates', 'Gates + gated hiring']
DESC = [
    'Fewer students, slower conversion, 40% fewer institutional logos at 85% of price, slower go-live, more churn.',
    'The staged plan of record: every driver at its planning value, no gates, hires on their base months.',
    'More registrations and conversion, 40% more logos at 110% of price, lower churn. An upside, not a target.',
    'Base economics with institutional signing six months later and go-live three months later than planned.',
    'Base with AI token usage 20% higher and vendor prices 15% higher: tests the allowance and gross margin.',
    'Base with a security incident: response cost, service credits and lost sales across the horizon.',
    'CFO-recommended staging of Base: flexible hires held until their gates, so burn follows evidence.',
    'Base economics with every revenue line held until its go/no-go gate month. No paid pilot before Year 2.',
    'Go/no-go gates and flexible hires released nine months after their base month. The lowest peak need.',
]
SENS = [  # (label, kind, key, lo value, hi value, lo label, hi label)
    ('Pilot-to-annual conversion', 'A', 'Pilot → annual agreement conversion', 0.0, 0.75, '0% convert (plan 50%)', '75% convert'),
    ('Institutional logo volume', 'S', 'Institutional new-logo volume multiplier', 0.6, 1.4, '60% of planned logos', '140% of planned logos'),
    ('Enterprise signing delay', 'S', 'Enterprise signing delay', 6, None, '6 months later', None),
    ('Gate slip, all gates', 'S', 'Slip added to every gate month', 12, None, '12 months later', None),
]


def label_row(ws, label, col=2):
    for r in range(1, ws.max_row + 1):
        v = ws.cell(r, col).value
        if isinstance(v, str) and v.startswith(label):
            return r
    raise KeyError(label)


def quarterly(wb, label):
    ws = wb['Board_Pack']
    r = next(i for i in range(7, 30) if str(ws.cell(i, 1).value).startswith(label))
    return [ws.cell(r, c).value for c in range(3, 15)]


def read_scenario(wb):
    s, u, ck = wb['Summary'], wb['Unit_Economics'], wb['Checks']
    other = lambda c: sum(s.cell(r, c).value or 0 for r in (11, 14))
    streams = {'Student subscription': [s.cell(8, c).value for c in (3, 4, 5)],
               'Institutional platform': [(s.cell(9, c).value or 0) + (s.cell(15, c).value or 0) for c in (3, 4, 5)],
               'Implementation': [s.cell(10, c).value for c in (3, 4, 5)],
               'Marketplace': [s.cell(12, c).value for c in (3, 4, 5)],
               'Career / employer': [s.cell(13, c).value for c in (3, 4, 5)],
               'AI usage and alumni': [other(c) for c in (3, 4, 5)]}
    assert abs(sum(v[2] for v in streams.values()) - s['E16'].value) < 1, 'streams do not sum to total revenue'
    return dict(rev=[s.cell(16, c).value for c in (3, 4, 5)], arr3=s['E40'].value, gm3=s['E23'].value,
                ebitda=[s.cell(29, c).value for c in (3, 4, 5)], peak=u['E64'].value, mincash=ck['B23'].value,
                lowmonths=ck['B24'].value, heads3=s['E44'].value, bm3=u['E61'].value, streams=streams,
                q=dict(rev=quarterly(wb, 'Revenue'), arr=quarterly(wb, 'ARR, end'), cash=quarterly(wb, 'Cash, end'),
                       ebitda=quarterly(wb, 'EBITDA'), heads=quarterly(wb, 'Headcount')))


def sens_run(edits):
    wb = load_workbook(MODEL)
    for kind, key, val in edits:
        if kind == 'A':
            a = wb['Assumptions']; a.cell(label_row(a, key), 4).value = val
        else:
            sc = wb['Scenario_Control']; sc.cell(label_row(sc, key), 3 + 8).value = val
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as t:
        path = t.name
    wb.save(path)
    try:
        return recalc(path, 8)['Summary']['E40'].value
    finally:
        os.unlink(path)


def main():
    scen = []
    for k in range(1, 10):
        scen.append(read_scenario(recalc(MODEL, k)))
        print(f'scenario {k} read', file=sys.stderr)
    base8 = scen[7]['arr3']
    assert abs(sens_run([]) - base8) < 1, 'unedited sensitivity run does not reproduce scenario 8'
    sens = []
    for label, kind, key, lo, hi, lol, hil in SENS:
        row = dict(label=label, lo=sens_run([(kind, key, lo)]) - base8, loLabel=lol, hi=None, hiLabel=hil)
        if hi is not None:
            row['hi'] = sens_run([(kind, key, hi)]) - base8
        sens.append(row)
        print('sensitivity', label, file=sys.stderr)
    wb = load_workbook(MODEL, data_only=True)
    g = wb['Gate_Schedule']
    gates = [dict(id=g.cell(r, 1).value, name=g.cell(r, 2).value, fte=g.cell(r, 6).value, base=g.cell(r, 7).value,
                  saved=g.cell(r, 14).value) for r in range(6, 16)]
    gates.sort(key=lambda x: -x['saved'])
    rev = subprocess.run(['git', '-C', HERE, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip()
    data = dict(names=NAMES, desc=DESC, scen=scen, sens=sens, gates=gates,
                streamNames=list(scen[0]['streams']),
                quarters=[wb['Board_Pack'].cell(6, c).value.split(' ')[0] + ' ' + wb['Board_Pack'].cell(6, c).value.split(' ')[1]
                          for c in range(3, 15)],
                stamp=f'{datetime.date.today().isoformat()} (model at {rev})')
    body = open(TEMPLATE).read().replace('/*DATA*/', json.dumps(data, separators=(',', ':')))
    if '--fragment' in sys.argv:
        frag = sys.argv[sys.argv.index('--fragment') + 1]
        open(frag, 'w').write(body)
    title = body.split('<title>')[1].split('</title>')[0]
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
            '</head><body>' + body + '</body></html>')
    open(OUT, 'w').write(page)
    print('wrote', os.path.normpath(OUT), len(page), 'bytes;', title, file=sys.stderr)


if __name__ == '__main__':
    main()
