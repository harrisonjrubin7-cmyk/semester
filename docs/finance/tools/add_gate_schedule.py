"""One-time edit: tie every flexible hire to a named release gate and add the Gate_Schedule sheet.

Why a script: the workbook is a binary file, so this records exactly what changed.
Run once on the pre-edit workbook; it refuses to run twice.

What it does (no existing number changes; it only adds columns and a sheet):
  1. Headcount: adds AV "Gate" (G1..G10, or "-" for a core role) and AW "Effective start month"
     (= base start + flex flag x the active scenario's hire delay).
  2. Adds the Gate_Schedule sheet before Checks: per gate, the roles, evidence, authority, linked
     go/no-go gate, FTE, base and active-scenario release month, run-rate cost and 36-month cost
     (live), plus pasted columns comparing scenario 8 (hiring unchanged) with scenario 9
     (flexible hires nine months late) and a live reconciliation to Headcount.
The pasted columns are written by this script after recalculating scenarios 8 and 9; if you change the
hiring plan, rerun that part (see tools/README.md).
"""
import copy, os, shutil, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter as L
from recalc import recalc

PATH = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'semester-financial-model.xlsx')

# gate -> (name, roles, evidence required, release authority, linked go/no-go item)
GATES = {
 'G1': ('Platform maturity and accessibility', ['Mobile and offline engineers', 'Accessibility and design-systems lead', 'QA / SDET'],
        'Authorized candidate frozen and the hosted release matrix green; web core passes the critical-journey tests.', 'CEO + CTO', 'Go/no-go priorities 1 and 3'),
 'G2': ('Integration capacity', ['Integration engineers', 'Solutions engineer #1'],
        'A design partner has approved a connector scope in non-activation discovery; the connector framework passes sandbox tests.', 'CEO + CRO', 'Go/no-go priority 8'),
 'G3': ('Trust and compliance operations', ['Privacy and compliance operations lead', 'Security / GRC engineer'],
        'Counsel engaged; independent security assessment and qualified accessibility review scheduled.', 'CEO + CFO', 'Go/no-go priorities 2 to 4'),
 'G4': ('Product depth and measurement', ['Backend / frontend engineer (wave 2)', 'Learning scientist / academic integrity', 'AI / ML evaluation engineer', 'Data / analytics engineer'],
        'Seed closed, and the invitation-only validation closeout meets its agreed continue criteria (activation, return rate, task success).', 'CEO + CTO + CFO', 'A-160 evidence'),
 'G5': ('Sales capacity for paid pilots', ['Account executive #2', 'Account executive #3', 'SDR #1', 'Solutions engineer #2'],
        'First paid institutional pilot signed (A-162) and pipeline coverage of at least 3x the next two quarters of new-ACV plan.', 'CRO + CFO', 'A-162'),
 'G6': ('Customer-success capacity', ['Customer success manager #2', 'Customer success manager #3'],
        'At least two institutions live and ARR per CSM above $1.0M, or implementation backlog above 4 projects per implementer.', 'COO/CS lead + CFO', 'A-162 and A-163'),
 'G7': ('Community, marketplace and employer', ['Lifecycle and content marketer', 'Community and ambassador manager', 'Partnerships manager (employers, marketplace)', 'Marketplace and employer sales', 'Trust and safety analyst'],
        'Launch gates for those products signed off by counsel and the tax adviser, and the broad-rollout decision for student-facing growth.', 'CEO + Legal', 'A-160'),
 'G8': ('Scale organization', ['Engineering manager', 'Engineers (wave 3)', 'Controller (full-time)', 'People and recruiting operations'],
        'Series A closed.', 'Board', 'Financing'),
 'G9': ('Seed-stage platform and finance', ['Head of Marketing and Growth', 'Head of Finance and RevOps', 'Data / AI platform engineer', 'SRE / DevOps', 'Security engineer'],
        'Seed closed and a design-partner discovery programme under way (the only motion authorized today).', 'CEO + CFO', 'Financing'),
 'G10': ('Enterprise sales', ['Account executive #4', 'SDR #2'],
         'Broad-enterprise sale decision taken after repeated customer deployments.', 'CEO + CRO + Board', 'A-164'),
}

wb = load_workbook(PATH)
if 'Gate_Schedule' in wb.sheetnames:
    sys.exit('already applied (Gate_Schedule exists)')
H = wb['Headcount']
sc = wb['Scenario_Control']
A = wb['Assumptions']


def find(ws, text, col):
    for r in range(1, ws.max_row + 1):
        v = ws.cell(r, col).value
        if isinstance(v, str) and v.startswith(text):
            return r
    raise KeyError(text)


delay_row = find(sc, 'Delay for flexible hires', 2)
burden_row = find(A, 'Employer burden', 2)
role_of = {}
for g, (_, roles, *_rest) in GATES.items():
    for r_ in roles:
        assert r_ not in role_of, r_
        role_of[r_] = g

# ---- 1. Headcount: gate and effective start columns
first = 9
last = find(H, 'People cost by P&L function', 1) - 2        # last role row
while H.cell(last, 1).value is None:
    last -= 1
hdr_style = H['AU8']._style
for col, text in (('AV', 'Gate'), ('AW', 'Effective start month')):
    H[f'{col}8'].value = text
    H[f'{col}8']._style = copy.copy(hdr_style)
    H.column_dimensions[col].width = 14
mapped, flex_roles = set(), []
for r in range(first, last + 1):
    name, flex = H.cell(r, 1).value, H[f'AQ{r}'].value
    g = role_of.get(name)
    if flex == 1:
        flex_roles.append(name)
        assert g, f'flexible role without a gate: {name}'
        mapped.add(name)
    else:
        assert g is None, f'core role given a gate: {name}'
    H[f'AV{r}'].value = g or '-'
    H[f'AW{r}'].value = f'=AP{r}+AQ{r}*Scenario_Control!$M${delay_row}'
    for col in ('AV', 'AW'):
        H[f'{col}{r}']._style = copy.copy(H[f'AU{r}']._style)
assert mapped == set(role_of), set(role_of) - mapped
RA, RB = first, last

# ---- 2. Gate_Schedule sheet
ws = wb.create_sheet('Gate_Schedule', wb.sheetnames.index('Checks'))
F_T = Font(name='Arial', size=14, bold=True, color='1F3A5F'); F_B = Font(name='Arial', size=10, bold=True); F_N = Font(name='Arial', size=10)
F_H = Font(name='Arial', size=10, bold=True, color='FFFFFF'); F_I = Font(name='Arial', size=9, italic=True, color='595959')
FILL = PatternFill('solid', fgColor='1F3A5F'); FILL_T = PatternFill('solid', fgColor='F2F2F2')
USD = '$#,##0;($#,##0);"-"'
ws['A1'] = 'Hiring gates: release schedule and cash effect'; ws['A1'].font = F_T
ws['A2'] = 'Scenario:'; ws['A2'].font = F_B; ws['B2'] = '=Scenario_Control!$E$3'; ws['B2'].font = F_B
ws['A3'] = ('Every flexible role belongs to one gate. Columns F to J are live for the active scenario; columns K to N are pasted values comparing scenario 8 (go/no-go gates, hiring unchanged) '
            'with scenario 9 (the same, flexible hires released nine months late). A gate month is a model assumption, not a prediction of when the evidence will exist.')
ws['A3'].font = F_I; ws['A3'].alignment = Alignment(wrap_text=True, vertical='top'); ws.merge_cells('A3:N3'); ws.row_dimensions[3].height = 40
heads = ['Gate', 'Name', 'Roles released', 'Evidence required before release', 'Release authority', 'FTE', 'Base release month (earliest)',
         'Release month, active scenario (earliest)', 'Annual run-rate people cost (year-1 pay, loaded)', '36-month people cost, active scenario',
         'Linked go/no-go item', '36-month cost, scenario 8 (pasted)', '36-month cost, scenario 9 (pasted)', 'Cash saved by gating (pasted)']
# column order: A gate, B name, C roles, D evidence, E authority, F FTE, G base, H active, I run-rate, J 36mo live, K linked, L s8, M s9, N saved
for j, h in enumerate(heads):
    c = ws.cell(5, 1 + j, h); c.font = F_H; c.fill = FILL; c.alignment = Alignment(wrap_text=True, vertical='center', horizontal='center')
ws.row_dimensions[5].height = 62
rng = lambda col: f'Headcount!${col}${RA}:${col}${RB}'
r0 = 6
for i, (g, (name, roles, ev, auth, link)) in enumerate(GATES.items()):
    r = r0 + i
    vals = {1: g, 2: name, 3: '; '.join(roles), 4: ev, 5: auth, 11: link}
    for c_, v in vals.items():
        cell = ws.cell(r, c_, v); cell.font = F_B if c_ == 1 else F_N; cell.alignment = Alignment(wrap_text=True, vertical='top')
    ws.cell(r, 6, f'=SUMIF({rng("AV")},$A{r},{rng("AO")})').number_format = '0.0'
    ws.cell(r, 7, f'=_xlfn.MINIFS({rng("AP")},{rng("AV")},$A{r})')
    ws.cell(r, 8, f'=_xlfn.MINIFS({rng("AW")},{rng("AV")},$A{r})')
    ws.cell(r, 9, f'=SUMPRODUCT(({rng("AV")}=$A{r})*{rng("AO")}*{rng("AS")})*(1+Assumptions!$D${burden_row})').number_format = USD
    ws.cell(r, 10, f'=SUMIF({rng("AV")},$A{r},Headcount!$C${RA}:$C${RB})').number_format = USD
    for c_ in (6, 7, 8, 9, 10): ws.cell(r, c_).font = F_N
    ws.row_dimensions[r].height = 64
rl = r0 + len(GATES) - 1
rt = rl + 1
ws.cell(rt, 1, 'Flexible roles'); ws.cell(rt, 6, f'=SUM(F{r0}:F{rl})').number_format = '0.0'
ws.cell(rt, 9, f'=SUM(I{r0}:I{rl})').number_format = USD
ws.cell(rt, 10, f'=SUM(J{r0}:J{rl})').number_format = USD
for c_ in (12, 13, 14): ws.cell(rt, c_, f'=SUM({L(c_)}{r0}:{L(c_)}{rl})').number_format = USD
rc = rt + 1
ws.cell(rc, 1, 'Core roles (no gate)')
ws.cell(rc, 6, f'=SUMIF({rng("AV")},"-",{rng("AO")})').number_format = '0.0'
ws.cell(rc, 10, f'=SUMIF({rng("AV")},"-",Headcount!$C${RA}:$C${RB})').number_format = USD
ws.cell(rc + 1, 1, 'Total people cost, Headcount sheet')
tot_row = find(H, 'Total people cost', 1)
ws.cell(rc + 1, 10, f'=Headcount!$C${tot_row}').number_format = USD
ws.cell(rc + 2, 1, 'Reconciliation: gates + core = Headcount total (must be PASS)')
ws.cell(rc + 2, 10, f'=IF(ABS(J{rt}+J{rc}-J{rc+1})<1,"PASS","FAIL")')
for rr in range(rt, rc + 3):
    for c_ in range(1, 15):
        ws.cell(rr, c_).font = F_B; ws.cell(rr, c_).fill = FILL_T
ws.cell(rc + 4, 1, 'Reading the pasted columns: the cash saved by gating is the 36-month people cost avoided by releasing each gate\'s roles nine months later; a role released after month 36 costs nothing inside the horizon. Delaying one gate by one month saves about its run-rate cost divided by 12.').font = F_I
for col, w in zip('ABCDEFGHIJKLMN', (7, 26, 40, 52, 18, 7, 13, 15, 17, 17, 18, 17, 17, 16)):
    ws.column_dimensions[col].width = w
ws.freeze_panes = 'C6'
ws.sheet_view.showGridLines = False
GS_ROWS = (r0, rl, rt)
wb.save(PATH)

# ---- 3. pasted comparison: recalc scenarios 8 and 9 and read the live column
vals = {}
for scn in (8, 9):
    v = recalc(PATH, scn)['Gate_Schedule']
    vals[scn] = [v.cell(r, 10).value for r in range(r0, rl + 1)]
wb = load_workbook(PATH)
ws = wb['Gate_Schedule']
for i in range(len(GATES)):
    r = r0 + i
    ws.cell(r, 12, vals[8][i]).number_format = USD
    ws.cell(r, 13, vals[9][i]).number_format = USD
    ws.cell(r, 14, f'=L{r}-M{r}').number_format = USD
    for c_ in (12, 13, 14): ws.cell(r, c_).font = F_N
wb.save(PATH)
# cache values (LibreOffice recalculation, same as the other tools)
tmp = tempfile.mkdtemp()
subprocess.run(['soffice', '--headless', '--calc', '--convert-to', 'xlsx', '--outdir', tmp, PATH], check=True, capture_output=True)
shutil.copy(os.path.join(tmp, os.path.basename(PATH)), PATH)
print('gate schedule added;', len(GATES), 'gates;', len(flex_roles), 'flexible roles mapped')
