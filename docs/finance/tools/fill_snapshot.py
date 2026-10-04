"""Write the Scenario_Results snapshot rows for scenarios 8 and 9 from a recalculation of each.

Usage: python3 fill_snapshot.py <workbook>
Also checks that scenarios 1-7 still reproduce their pasted rows (the regression guard).
"""
import copy, datetime, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from openpyxl import load_workbook
from recalc import recalc
from snapshot import read, FIELDS

PATH = sys.argv[1]
wb = load_workbook(PATH)
sr = wb['Scenario_Results']


def clone(src, dst):
    dst.value = src.value
    dst._style = copy.copy(src._style)


names = {8: 'Go/no-go gates (Base economics)', 9: 'Go/no-go gates + gated hiring'}
rows = {k: 4 + k for k in range(1, 10)}
for k in (8, 9):
    r = rows[k]
    for col in range(1, 19):
        clone(sr.cell(11, col), sr.cell(r, col))
    sr.cell(r, 1).value, sr.cell(r, 2).value = k, names[k]
    vals = read(recalc(PATH, k))
    for i, v in enumerate(vals):
        sr.cell(r, 3 + i).value = v
    # change-from-base block
    rr = 15 + k
    for col in range(1, 19):
        clone(sr.cell(22, col), sr.cell(rr, col))
    sr.cell(rr, 1).value, sr.cell(rr, 2).value = k, names[k]
    for col in range(3, 19):
        cl = sr.cell(4, col).column_letter
        sr.cell(rr, col).value = f'=IF(ISNUMBER({cl}{r}),{cl}{r}-{cl}$6,"n/a")'
sr['A1'] = 'Scenario comparison (pasted snapshot of all nine scenarios)'
sr['C25'] = '=Summary!E16-INDEX($E$5:$E$13,Scenario_Control!$D$3)'
sr['A2'] = ('Values below were produced by recalculating the model once per scenario and pasting the results. They do not update by '
            'themselves; change an assumption, then re-run tools/fill_snapshot.py. Row 25 checks that the active scenario still matches its pasted row.')

# descriptions: rows 35-36 take scenarios 8 and 9; the snapshot note moves down
note = sr['A36'].value
for r, k, text in ((35, 8, 'Base economics with every revenue motion behind its go/no-go gate (Assumptions section 13, from GO-NO-GO-DECISION.md): registrations and acquisition spend at 25% and no Plus sales before month 15; no paid pilot signed before month 12; no direct Department sale before month 24; no direct Institution sale before month 28. Hiring is unchanged, so this isolates what the gates do to revenue and cash.'),
                   (36, 9, 'Scenario 8 plus every flexible role released nine months late, as in scenario 7: what it is worth to tie the sales, implementation and success hires to the gates rather than to the calendar.')):
    for col in range(1, 4):
        clone(sr.cell(34, col), sr.cell(r, col))
    sr.cell(r, 1).value, sr.cell(r, 2).value, sr.cell(r, 3).value = k, names[k], text
clone(sr.cell(34, 3), sr.cell(38, 1))
sr['A38'] = f'Snapshot produced {datetime.date.today().isoformat()} by recalculating all nine scenarios on this workbook\'s formulas.'
sr['A38']._style = copy.copy(wb['Scenario_Results']['A37']._style) if sr['A37'].value else sr['A38']._style

ck = wb['Checks']
ck['A26'] = 'Integrity status (first 19 checks plus the two gate checks; the funding rows are warnings)'
wb.save(PATH)
print('snapshot rows 8 and 9 written to', PATH)
