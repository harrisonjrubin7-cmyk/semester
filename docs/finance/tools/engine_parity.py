"""Prove engine.js reproduces the workbook: for each scenario 1-9, recalculate in LibreOffice and compare every cell
the engine evaluates against it.  Usage: python3 engine_parity.py [workbook]   Exit 1 on any difference.
Control: break one function in engine.js (for example make SUMIF always return 0) and this fails with many cells.
"""
import json, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from recalc import recalc
from export_model import export, SHEETS

HERE = os.path.dirname(os.path.abspath(__file__))
P = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'semester-financial-model.xlsx')
data = export(P)
expected = {}
for k in range(1, 10):
    wb = recalc(P, k)
    expected[k] = {s: {a: wb[s][a].value for a, raw in data[s].items() if isinstance(raw, str) and raw.startswith('=')} for s in SHEETS}
    print(f'scenario {k} recalculated', file=sys.stderr)
# The same comparison with inputs changed the way the dashboard's controls change them (an Assumptions input, a year
# value, a scenario driver, a hire's start month and pay), in scenarios 2, 8 and 9.
EDITS = [('Assumptions', 'D7', 5000000), ('Assumptions', 'D40', 0.25), ('Assumptions', 'D158', 3000000), ('Assumptions', 'D159', 3),
         ('Assumptions', 'D229', 18), ('Assumptions', 'E12', 120000), ('Scenario_Control', 'K10', 0.7), ('Headcount', 'AP12', 6), ('Headcount', 'AS10', 150000)]
from openpyxl import load_workbook
w = load_workbook(P)
for sh, a, v in EDITS:
    w[sh][a] = v
edited_path = os.path.join(tempfile.mkdtemp(), 'edited.xlsx'); w.save(edited_path)
edited = {}
for k in (2, 8, 9):
    wb = recalc(edited_path, k)
    edited[k] = {s: {a: wb[s][a].value for a, raw in data[s].items() if isinstance(raw, str) and raw.startswith('=')} for s in SHEETS}
    print(f'edited scenario {k} recalculated', file=sys.stderr)
with tempfile.TemporaryDirectory() as t:
    json.dump({'data': data, 'expected': expected, 'edited': edited, 'edits': EDITS}, open(os.path.join(t, 'in.json'), 'w'), default=str)
    r = subprocess.run(['node', os.path.join(HERE, 'engine_parity.js'), os.path.join(t, 'in.json')])
sys.exit(r.returncode)
