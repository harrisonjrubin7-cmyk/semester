"""Guard for the finance workbook: recalculates it in LibreOffice once per scenario and checks that

  1. every pasted row of Scenario_Results (all nine scenarios) still equals the live model,
  2. every integrity check and both go/no-go gate checks pass in every scenario,
  3. where gates are on, no gated revenue activity precedes its gate (read from the monthly Revenue rows),
  4. where gates are off, nothing is gated (scenarios 1-7 are untouched by the gate switch).

Usage: python3 verify_scenarios.py [workbook]      Exit 1 on any failure.
The control for (3): remove the gate from Revenue row 41 and scenario 8 fails check C30; see docs/finance/tools/README.md.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from openpyxl import load_workbook
from recalc import recalc
from snapshot import read, FIELDS

P = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'semester-financial-model.xlsx')
snap = load_workbook(P)['Scenario_Results']
fails = []
for k in range(1, 10):
    wb = recalc(P, k)
    vals = read(wb)
    old = [snap.cell(4 + k, c).value for c in range(3, 19)]
    for (name, _, _), a, b in zip(FIELDS, vals, old):
        ok = (isinstance(b, (int, float)) and a is not None and abs(a - b) <= 1e-6 * max(1, abs(b))) or str(a) == str(b)
        if not ok:
            fails.append(f'scenario {k}: {name} live {a} vs pasted {b}')
    ck = wb['Checks']
    for r in list(range(4, 23)) + [29, 30]:
        if ck.cell(r, 3).value != 'PASS':
            fails.append(f'scenario {k}: check row {r} = {ck.cell(r, 3).value} ({ck.cell(r, 1).value})')
    rv, a = wb['Revenue'], wb['Assumptions']
    gates_on = wb['Scenario_Control']['M25'].value == 1
    months = [rv.cell(3, c).value for c in range(4, 40)]
    def total_before(row, gate_cell):
        g = a[gate_cell].value + (wb['Scenario_Control']['M26'].value or 0)
        return sum(rv.cell(row, 4 + i).value for i, m in enumerate(months) if m < g)
    pre = {row: total_before(row, cell) for row, cell in ((15, 'D229'), (41, 'D231'), (47, 'D232'), (53, 'D233'))}
    if gates_on and any(abs(v) > 1e-9 for v in pre.values()):
        fails.append(f'scenario {k}: gated activity before its gate {pre}')
    if not gates_on and k <= 7 and pre[41] == 0 and pre[47] == 0 and pre[53] == 0 and pre[15] == 0:
        fails.append(f'scenario {k}: nothing at all before the gate months with gates off (gates look always-on)')
    print(f'scenario {k}: Y1-Y3 revenue {[round(x) for x in vals[:3]]}, peak need {round(vals[9]):,}, gates {"on" if gates_on else "off"}')
print('FAILURES:' if fails else 'all scenarios reproduce their pasted rows; all checks pass; gates hold')
for f in fails:
    print('  ', f)
sys.exit(1 if fails else 0)
