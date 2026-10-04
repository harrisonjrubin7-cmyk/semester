"""One-time port of the GO-NO-GO gates into semester-financial-model.xlsx.

Why a script: the workbook is a binary file, so this records exactly what changed.
Run once on the pre-port workbook; it refuses to run twice.

What it does (nothing about scenarios 1-7 changes: the new switch is 0 for them):
  1. Moves the ACTIVE scenario column from K to M (every Scenario_Control!$K$n reference follows).
  2. Adds scenario 8 (Base economics + go/no-go gates) and scenario 9 (the same + flexible hires
     released nine months late, as in scenario 7) in columns K and L.
  3. Adds drivers S-19 (apply gates, 0/1) and S-20 (gate slip, months) to Scenario_Control.
  4. Adds the gate months to Assumptions (section 13).
  5. Gates the Revenue rows: paid student-acquisition spend (11), new paid subscribers (15),
     pilot signings (41), Department signings (47), Institution signings (53).
  6. Adds two integrity checks (no gated revenue activity before its gate).
The scenario snapshot rows for 8 and 9 are written by fill_snapshot.py after a recalculation.
"""
import copy, re, sys
from openpyxl import load_workbook
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as L

PATH = sys.argv[1]
wb = load_workbook(PATH)
sc = wb['Scenario_Control']
if sc['K6'].value != 'ACTIVE':
    sys.exit('already ported (K6 is not ACTIVE)')


def clone(src, dst):
    dst.value = src.value
    dst._style = copy.copy(src._style)


# 1. formulas that read the ACTIVE column
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and c.value.startswith('=') and 'Scenario_Control!$K$' in c.value:
                c.value = c.value.replace('Scenario_Control!$K$', 'Scenario_Control!$M$')

# 2-3. Scenario_Control: ACTIVE K -> M; scenarios 8 and 9 in K and L; two new driver rows
sc.column_dimensions['K'].width = sc.column_dimensions['J'].width
sc.column_dimensions['L'].width = sc.column_dimensions['J'].width
sc.column_dimensions['M'].width = 13
for r in range(1, 25):
    clone(sc.cell(r, 11), sc.cell(r, 13))          # ACTIVE -> M
    for col in (11, 12):
        clone(sc.cell(r, 10), sc.cell(r, col))      # scenario columns take scenario 7's style
last = 24
sc['K6'], sc['L6'] = 'Go/no-go gates (Base economics)', 'Go/no-go gates + gated hiring'
sc['K5'], sc['L5'] = 8, 9
sc['M6'] = 'ACTIVE'
for r in range(7, 25):
    base = sc.cell(r, 5).value                      # Base column
    sc.cell(r, 11).value = base
    sc.cell(r, 12).value = base
    sc.cell(r, 13).value = f'=INDEX(D{r}:L{r},1,$D$3)'
sc['L19'] = 9                                         # S-13: flexible hires nine months late (as scenario 7)
new_rows = [
    (25, 'S-19', 'Apply the go/no-go gates (1 = yes; gate months are in Assumptions section 13)', 'flag', [0] * 7 + [1, 1]),
    (26, 'S-20', 'Slip added to every gate month', 'months', [0] * 9),
]
for r, sid, label, unit, vals in new_rows:
    for col in range(1, 14):
        clone(sc.cell(24, col), sc.cell(r, col))
    sc.cell(r, 1).value, sc.cell(r, 2).value, sc.cell(r, 3).value = sid, label, unit
    for i, v in enumerate(vals):
        sc.cell(r, 4 + i).value = v
    sc.cell(r, 13).value = f'=INDEX(D{r}:L{r},1,$D$3)'
sc['E3'] = '=INDEX($D$6:$L$6,1,$D$3)'
sc['A3'] = 'Active scenario (enter 1–9)'
for dv in sc.data_validations.dataValidation:
    if 'D3' in str(dv.sqref):
        dv.formula2 = '9'

# 4. Assumptions: gate months (Semester model month 1 = Nov 2026; gates carry the GO-NO-GO-DECISION.md motions)
a = wb['Assumptions']
r0 = 228
for col in range(1, 9):
    clone(a.cell(194, col), a.cell(r0, col))
a.cell(r0, 1).value = '13. Go / no-go gates (controlling document: GO-NO-GO-DECISION.md, 3 Oct 2026; used only where Scenario_Control S-19 = 1)'
rows = [
    ('A-160', 'First month broad / paid individual acquisition may begin (Plus checkout for new subscribers, paid acquisition)', 'month #', 15,
     'Today NO-GO (INDIVIDUAL_PAID_ACQUISITION_ENABLED = false). Needs the invitation-only closeout and a separate broad-rollout decision.'),
    ('A-161', 'Share of registrations and acquisition spend allowed before that gate (invitation-only, unpaid validation)', '%', 0.25,
     'Conditional GO covers invitation-only, unpaid validation cohorts only.'),
    ('A-162', 'First month a PAID institutional pilot may be signed (it goes live two months later)', 'month #', 12,
     'Today NO-GO. Reconsidered only after a design-partner pilot has an approved activation record and a measured 26-week closeout.'),
    ('A-163', 'First month direct Department annual sales may begin', 'month #', 24,
     'After the first pilot-to-annual conversions are evidenced.'),
    ('A-164', 'First month direct Institution-segment sales may begin (broad enterprise sale)', 'month #', 28,
     'Last motion to reconsider: repeated deployments and independent assurance first.'),
]
ref = {}
for i, (aid, label, unit, val, note) in enumerate(rows):
    r = r0 + 1 + i
    for col in range(1, 9):
        clone(a.cell(7, col), a.cell(r, col))
    a.cell(r, 1).value, a.cell(r, 2).value, a.cell(r, 3).value, a.cell(r, 4).value = aid, label, unit, val
    for col in range(5, 9):
        a.cell(r, col).value = None
    a.cell(r, 5).value = 'PROPOSED'
    a.cell(r, 8).value = note
    ref[aid] = f'Assumptions!$D${r}'

# 5. Revenue gating
rv = wb['Revenue']
FLAG, SLIP = 'Scenario_Control!$M$25', 'Scenario_Control!$M$26'


def gate(col, aid, closed):
    return f'IF(OR({FLAG}=0,{col}$3>={ref[aid]}+{SLIP}),1,{closed})'


patches = {11: ('A-160', ref['A-161'], ' (gated: invitation-only before A-160)'),
           15: ('A-160', '0', ' (gated: none before A-160)'),
           41: ('A-162', '0', ' (gated: none before A-162)'),
           47: ('A-163', '0', ' (gated: none before A-163)'),
           53: ('A-164', '0', ' (gated: none before A-164)')}
for row, (aid, closed, suffix) in patches.items():
    for ci in range(4, 40):
        c = rv.cell(row, ci)
        col = L(ci)
        assert isinstance(c.value, str) and c.value.startswith('='), (row, col, c.value)
        c.value = f'=({c.value[1:]})*{gate(col, aid, closed)}'
    rv.cell(row, 1).value = str(rv.cell(row, 1).value) + suffix

# 6. Checks
ck = wb['Checks']
for r in (29, 30):
    for col in range(1, 5):
        clone(ck.cell(24, col), ck.cell(r, col))
ck['A4'] = 'Scenario selector is 1–9'
ck['C4'] = '=IF(AND(B4>=1,B4<=9,B4=INT(B4)),"PASS","FAIL")'
ck['A29'] = 'Gates: new paid subscribers before the broad/paid-individual gate (must be 0 when gates are on)'
ck['B29'] = (f'=IF({FLAG}=1,SUMPRODUCT((Revenue!$D$3:$AM$3<{ref["A-160"]}+{SLIP})*Revenue!$D$15:$AM$15),0)')
ck['C29'] = '=IF(ABS(B29)<0.000001,"PASS","FAIL")'
ck['D29'] = 'Plus is not sold before its gate (GO-NO-GO-DECISION.md)'
ck['A30'] = 'Gates: paid pilots and direct sales signed before their gates (must be 0 when gates are on)'
ck['B30'] = (f'=IF({FLAG}=1,SUMPRODUCT((Revenue!$D$3:$AM$3<{ref["A-162"]}+{SLIP})*Revenue!$D$41:$AM$41)'
             f'+SUMPRODUCT((Revenue!$D$3:$AM$3<{ref["A-163"]}+{SLIP})*Revenue!$D$47:$AM$47)'
             f'+SUMPRODUCT((Revenue!$D$3:$AM$3<{ref["A-164"]}+{SLIP})*Revenue!$D$53:$AM$53),0)')
ck['C30'] = '=IF(ABS(B30)<0.000001,"PASS","FAIL")'
ck['D30'] = 'Paid pilots, Department and Institution sales do not precede their gates'
ck['A26'] = 'Integrity status (first 21 checks plus the two gate checks; the funding rows are warnings)'
ck['C26'] = '=IF(COUNTIF(C4:C22,"FAIL")+COUNTIF(C29:C30,"FAIL")=0,"ALL PASS",COUNTIF(C4:C22,"FAIL")+COUNTIF(C29:C30,"FAIL")&" FAIL")'

wb.save(PATH)
print('ported', PATH)
