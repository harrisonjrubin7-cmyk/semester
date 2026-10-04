"""Build semester-financial-model.xlsx from spec.py (live formulas, no pasted results).

Usage: python3 build_workbook.py [out.xlsx]
Then: python3 verify.py   (recalculates in LibreOffice and compares with the Python run)
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.chart import LineChart, Reference
import spec
from dsl import XL, xl, col, FIRST_COL, HDR_T, HDR_YR, HDR_MOY

OUT = sys.argv[1] if len(sys.argv) > 1 else 'semester-financial-model.xlsx'
SHEETS = ['Cons', 'Base', 'Aggr', 'EntDelay', 'HiAI', 'Incident', 'EntGated', 'FullScope']
assert len(SHEETS) == len(spec.SCENARIOS)

NAVY, GREY, PALE = '1F3A5F', 'F2F4F7', 'EAF1FB'
TAGFILL = {'FACT': 'D9EAD3', 'POLICY': 'E4DFEC', 'HYP': 'FFF2CC', 'VENDOR': 'FCE5CD', 'PRO': 'F4CCCC', 'ILLUS': 'D9D9D9', 'DECIDE': 'CFE2F3'}
NUMFMT = {'n0': '#,##0;(#,##0);"-"', 'n1': '#,##0.0;(#,##0.0);"-"', 'n2': '#,##0.00;(#,##0.00);"-"', 'p1': '0.0%;(0.0%);"-"'}
thin = Side(style='thin', color='D0D5DD')


def hdr(ws, r, c1, c2, fill=NAVY):
    for c in range(c1, c2 + 1):
        cell = ws.cell(r, c)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor=fill)
        cell.alignment = Alignment(wrap_text=True, vertical='center')


wb = Workbook()

# ------------------------------------------------------------------ README
ws = wb.active
ws.title = 'README'
lines = [
 ('Semester financial operating model: three-year, driver-based, monthly', True),
 ('STATUS: PLANNING MODEL. Not an approved budget, price book, forecast or accounting record. No figure here is a legal, tax or accounting conclusion.', True),
 ('', False),
 ('How to read it', True),
 ('1. Assumptions holds every input, tagged: FACT (in the repository), POLICY (proposed default already in deal-desk.ts), HYP (hypothesis, no evidence yet), VENDOR (verify the vendor price), PRO (needs a qualified professional), ILLUS (placeholder), DECIDE (a founder / authorized-reviewer decision not yet made, mainly gate timing).', False),
 ('2. Scenarios holds the seven scenario columns. Each scenario has its own calculation sheet (Cons, Base, Aggr, EntDelay, HiAI, Incident, EntGated, FullScope) built from identical formulas.', False),
 ('3. Headcount and Schedules hold the hiring plan and the institutional pipeline schedule. Change them there, not in formulas.', False),
 ('4. Dashboard shows one scenario (pick 1-8 in B3). Compare shows all seven side by side. Checks must all read OK.', False),
 ('5. Blue cells are inputs. Black cells are formulas. Nothing is pasted from a calculation.', False),
 ('', False),
 ('Conventions', True),
 ('Month 1 = January 2027. USD. Revenue is recognized as a PLANNING PROXY (ratable for subscriptions, pilots and add-ons; services over 3 months). The real policy is an accountant determination.', False),
 ('Institutional counts are expected values, so fractions of an account appear. Collection lag on invoiced billings is fixed at 2 months. No income tax, D&A, capitalized software or financing costs are modeled.', False),
 ('Opening capital is ILLUSTRATIVE and only drives the cash-out month. The honest funding number is "peak cumulative burn" on the Compare sheet.', False),
 ('', False),
 ('Regenerate: python3 docs/finance/model/build_workbook.py, then python3 docs/finance/model/verify.py (recalculates in LibreOffice and compares with the Python reference run).', False),
]
for i, (t, b) in enumerate(lines, 1):
    c = ws.cell(i, 1, t)
    c.font = Font(bold=b, size=13 if i == 1 else 11, color=NAVY if b else '000000')
    c.alignment = Alignment(wrap_text=True, vertical='top')
ws.column_dimensions['A'].width = 140

# ------------------------------------------------------------------ Scenarios
wsS = wb.create_sheet('Scenarios')
wsS['A1'] = 'Scenario parameters'
wsS['A1'].font = Font(bold=True, size=13, color=NAVY)
wsS['A3'], wsS['B3'] = 'Parameter', 'Unit'
for j, (k, lab) in enumerate(spec.SCENARIOS):
    wsS.cell(3, 3 + j, lab)
wsS.cell(3, 3 + len(spec.SCENARIOS), 'Note')
hdr(wsS, 3, 1, 3 + len(spec.SCENARIOS))
SC_ROW = {}
for i, (k, lab, unit, vals, note) in enumerate(spec.SCEN_PARAMS):
    r = 4 + i
    SC_ROW[k] = r
    wsS.cell(r, 1, lab)
    wsS.cell(r, 2, unit)
    for j, v in enumerate(vals):
        c = wsS.cell(r, 3 + j, v)
        c.font = Font(color='0000FF')
        c.fill = PatternFill('solid', fgColor='FFF9E5')
    wsS.cell(r, 3 + len(vals), note)
wsS.column_dimensions['A'].width = 52
wsS.column_dimensions['B'].width = 9
for j in range(len(spec.SCENARIOS)):
    wsS.column_dimensions[L(3 + j)].width = 17
wsS.column_dimensions[L(3 + len(spec.SCENARIOS))].width = 70
wsS.row_dimensions[3].height = 48
wsS.cell(6 + len(spec.SCEN_PARAMS), 1, 'Incident cost inputs live on Assumptions (group: Incident scenario). They apply only where the incident switch is 1.')

# ------------------------------------------------------------------ Assumptions
wsA = wb.create_sheet('Assumptions')
wsA['A1'] = 'Assumptions register (every number is a planning assumption unless tagged FACT)'
wsA['A1'].font = Font(bold=True, size=13, color=NAVY)
for j, h in enumerate(['ID', 'Assumption', 'Value', 'Unit', 'Tag', 'Source / what would change it']):
    wsA.cell(3, 1 + j, h)
hdr(wsA, 3, 1, 6)
assum_cell, annual_cell = {}, {}
r = 4


def tagcell(c, tag):
    c.fill = PatternFill('solid', fgColor=TAGFILL.get(tag, 'FFFFFF'))
    c.alignment = Alignment(horizontal='center')


for k, label, unit, v, tag, note in spec.ASSUMPTIONS:
    if label is None:
        wsA.cell(r, 1, k.replace('## ', '')).font = Font(bold=True, color=NAVY)
        for c in range(1, 7):
            wsA.cell(r, c).fill = PatternFill('solid', fgColor=PALE)
        r += 1
        continue
    wsA.cell(r, 1, k)
    wsA.cell(r, 2, label)
    c = wsA.cell(r, 3, v)
    c.font = Font(color='0000FF')
    if unit == '%':
        c.number_format = '0.0%' if v < 0.1 else '0.0%'
    elif isinstance(v, float) and v < 100:
        c.number_format = '#,##0.000' if v < 1 else '#,##0.00'
    else:
        c.number_format = '#,##0'
    wsA.cell(r, 4, unit)
    tagcell(wsA.cell(r, 5, tag), tag)
    wsA.cell(r, 6, note)
    assum_cell[k] = f'Assumptions!$C${r}'
    r += 1

# tier table
r += 1
wsA.cell(r, 1, 'Institutional tiers').font = Font(bold=True, color=NAVY)
r += 1
for j, h in enumerate(['ID prefix', 'Assumption', 'Department', 'Campus', 'System', 'Tag', 'Source / what would change it', 'Unit']):
    wsA.cell(r, 1 + j, h)
hdr(wsA, r, 1, 8)
r += 1
for key, label, unit, vals, tag, note in spec.TIER_ASSUMPTIONS:
    wsA.cell(r, 1, key)
    wsA.cell(r, 2, label)
    for i, t in enumerate(spec.TIERS):
        c = wsA.cell(r, 3 + i, vals[i])
        c.font = Font(color='0000FF')
        c.number_format = '0.0%' if unit == '%' else '#,##0'
        assum_cell[f'{key}_{t}'] = f'Assumptions!${L(3 + i)}${r}'
    tagcell(wsA.cell(r, 6, tag), tag)
    wsA.cell(r, 7, note)
    wsA.cell(r, 8, unit)
    r += 1

# annual table
r += 1
wsA.cell(r, 1, 'Year-dependent assumptions').font = Font(bold=True, color=NAVY)
r += 1
for j, h in enumerate(['ID', 'Assumption', 'Year 1 (2027)', 'Year 2 (2028)', 'Year 3 (2029)', 'Tag', 'Source / what would change it', 'Unit']):
    wsA.cell(r, 1 + j, h)
hdr(wsA, r, 1, 8)
r += 1
for k, label, unit, vals, tag, note in spec.ANNUAL:
    if label is None:
        wsA.cell(r, 1, k.replace('## ', '')).font = Font(bold=True, color=NAVY)
        for c in range(1, 9):
            wsA.cell(r, c).fill = PatternFill('solid', fgColor=PALE)
        r += 1
        continue
    wsA.cell(r, 1, k)
    wsA.cell(r, 2, label)
    refs = []
    for i in range(3):
        c = wsA.cell(r, 3 + i, vals[i])
        c.font = Font(color='0000FF')
        c.number_format = '0.0%' if unit == '%/mo' else '#,##0'
        refs.append(f'Assumptions!${L(3 + i)}${r}')
    annual_cell[k] = refs
    tagcell(wsA.cell(r, 6, tag), tag)
    wsA.cell(r, 7, note)
    wsA.cell(r, 8, unit)
    r += 1

# seasonality
r += 1
wsA.cell(r, 1, 'Seasonality index (academic calendar; sums to 12)').font = Font(bold=True, color=NAVY)
r += 1
season_first = r
for m, v in enumerate(spec.SEASON, 1):
    wsA.cell(r, 1, f'season_{m}')
    wsA.cell(r, 2, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1])
    c = wsA.cell(r, 3, v)
    c.font = Font(color='0000FF')
    tagcell(wsA.cell(r, 5, 'HYP'), 'HYP')
    r += 1
wsA.cell(r, 2, 'Sum (must be 12)')
wsA.cell(r, 3, f'=SUM(C{season_first}:C{r - 1})')
season_rng = f'Assumptions!$C${season_first}:$C${season_first + 11}'
season_sum_cell = f'Assumptions!$C${r}'

# derived
r += 2
wsA.cell(r, 1, 'Derived (formulas)').font = Font(bold=True, color=NAVY)
r += 1
for k, label, unit, expr, note in spec.DERIVED:
    wsA.cell(r, 1, k)
    wsA.cell(r, 2, label)
    assum_cell[k] = f'Assumptions!$C${r}'
    wsA.cell(r, 3, '=' + xl(expr, XL(assum_cell, annual_cell, {}, {}, {}, '', {}, '0', '0'), 1).replace('Assumptions!', ''))
    wsA.cell(r, 3).number_format = '#,##0.0000'
    wsA.cell(r, 4, unit)
    wsA.cell(r, 6, note)
    r += 1
wsA.column_dimensions['A'].width = 20
wsA.column_dimensions['B'].width = 62
for c in 'CDE':
    wsA.column_dimensions[c].width = 15
wsA.column_dimensions['F'].width = 10
wsA.column_dimensions['G'].width = 60
wsA.freeze_panes = 'C4'
# note: column F holds tag for scalars and tiers/annual; notes sit in F for scalars, G for tables
for rr in range(4, wsA.max_row + 1):
    if wsA.cell(rr, 5).value in TAGFILL and wsA.cell(rr, 6).value and not wsA.cell(rr, 7).value and wsA.cell(rr, 8).value is None:
        pass

# ------------------------------------------------------------------ Headcount
wsH = wb.create_sheet('Headcount')
wsH['A1'] = 'Hiring plan (gated roles shift by the scenario hiring delay)'
wsH['A1'].font = Font(bold=True, size=13, color=NAVY)
for j, h in enumerate(['ID', 'Role', 'Function', 'FTE', 'Start month', 'Base salary', 'Gated (1 = waits for evidence gate)', 'P&L placement', 'Extra (1 = only in full-scope staffing)']):
    wsH.cell(3, 1 + j, h)
hdr(wsH, 3, 1, 9)
for i, (hid, role, fn, fte, start, sal, gated, extra) in enumerate(spec.HEADCOUNT):
    r = 5 + i
    for j, v in enumerate([hid, role, fn, fte, start, sal, gated, spec.FN_LABEL[fn], extra]):
        c = wsH.cell(r, 1 + j, v)
        if j in (3, 4, 5, 6, 8):
            c.font = Font(color='0000FF')
        if j == 5:
            c.number_format = '#,##0'
HC_LAST = 90
hc_rng = dict(fn=f'Headcount!$C$5:$C${HC_LAST}', fte=f'Headcount!$D$5:$D${HC_LAST}', start=f'Headcount!$E$5:$E${HC_LAST}',
              salary=f'Headcount!$F$5:$F${HC_LAST}', gated=f'Headcount!$G$5:$G${HC_LAST}', extra=f'Headcount!$I$5:$I${HC_LAST}')
for c, w in zip('ABCDEFGHI', (8, 48, 11, 7, 12, 13, 18, 34, 20)):
    wsH.column_dimensions[c].width = w
wsH.row_dimensions[3].height = 45
wsH.freeze_panes = 'A5'

# ------------------------------------------------------------------ Schedules
wsC = wb.create_sheet('Schedules')
wsC['A1'] = 'Pipeline schedules by month (month 1 = Jan 2027). Counts are expected values.'
wsC['A1'].font = Font(bold=True, size=13, color=NAVY)
wsC.cell(3, 1, 'ID')
wsC.cell(3, 2, 'Schedule')
for t in range(1, 37):
    wsC.cell(3, 2 + t, t)
wsC.cell(3, 39, 'Total')
hdr(wsC, 3, 1, 39)
sched_row = {}
for i, (k, lab, vals, note) in enumerate(spec.SCHEDULES):
    r = 5 + i
    sched_row[k] = r
    wsC.cell(r, 1, k)
    wsC.cell(r, 2, lab)
    for t in range(1, 37):
        c = wsC.cell(r, 2 + t, vals[t - 1])
        c.font = Font(color='0000FF')
    wsC.cell(r, 39, f'=SUM(C{r}:AL{r})')
wsC.column_dimensions['A'].width = 14
wsC.column_dimensions['B'].width = 38
wsC.freeze_panes = 'C4'

# ------------------------------------------------------------------ calc sheets
row_no = {}
r = 23
for rd in spec.ROWS:
    if rd.name:
        row_no[rd.name] = r
    r += 1
kpi_first = r + 2
r = kpi_first + 1
for rd in spec.KPIS:
    row_no[rd.name] = r
    r += 1

ANN = ['AN', 'AO', 'AP']


def month_label(t):
    return f'{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][(t-1)%12]}-{27+(t-1)//12}'


for si, (sname, (skey, slabel)) in enumerate(zip(SHEETS, spec.SCENARIOS)):
    w = wb.create_sheet(sname)
    w['A1'] = f'Scenario {si+1}: {slabel}'
    w['A1'].font = Font(bold=True, size=13, color=NAVY)
    w['A2'] = 'All cells are formulas on Assumptions, Headcount, Schedules and the scenario parameters below.'
    w['A3'] = 'Scenario parameters (linked to Scenarios sheet)'
    w['A3'].font = Font(bold=True, color=NAVY)
    scen_cell = {}
    for i, (k, lab, unit, vals, note) in enumerate(spec.SCEN_PARAMS):
        rr = 4 + i
        w.cell(rr, 1, lab)
        w.cell(rr, 2, unit)
        w.cell(rr, 3, f'=Scenarios!{L(3 + si)}{SC_ROW[k]}')
        scen_cell[k] = f'$C${rr}'
    w.cell(HDR_T, 1, 'Month')
    w.cell(HDR_YR, 1, 'Year')
    w.cell(HDR_MOY, 1, 'Month of year')
    w.cell(19, 1, 'Calendar')
    for t in range(1, 37):
        c = FIRST_COL + t - 1
        w.cell(HDR_T, c, t)
        w.cell(19, c, month_label(t))
        w.cell(HDR_YR, c, f'=INT(({col(t)}{HDR_T}-1)/12)+1')
        w.cell(HDR_MOY, c, f'=MOD({col(t)}{HDR_T}-1,12)+1')
    for y in range(3):
        w.cell(HDR_T, 40 + y, f'Year {y+1}')
        w.cell(19, 40 + y, f'{2027+y}')
    hdr(w, HDR_T, 1, 42)
    xlc = XL(assum_cell, annual_cell, scen_cell, row_no, sched_row, season_rng, hc_rng, scen_cell['delay'], scen_cell['hire_delay'])
    rr = 23
    for rd in spec.ROWS:
        if rd.name is None:
            c = w.cell(rr, 1, rd.label)
            c.font = Font(bold=True, color=NAVY)
            for cc in range(1, 43):
                w.cell(rr, cc).fill = PatternFill('solid', fgColor=PALE)
            rr += 1
            continue
        w.cell(rr, 1, rd.label)
        w.cell(rr, 2, rd.unit)
        big = rd.label.startswith('TOTAL') or rd.name in ('arr', 'ebitda', 'op_cash', 'cash_bal')
        for t in range(1, 37):
            cell = w.cell(rr, FIRST_COL + t - 1, '=' + xl(rd.expr, xlc, t))
            cell.number_format = NUMFMT[rd.fmt]
            if big:
                cell.font = Font(bold=True)
        if rd.kind in ('flow', 'stock'):
            for y in range(3):
                a, b = col(12 * y + 1), col(12 * y + 12)
                f = f'=SUM({a}{rr}:{b}{rr})' if rd.kind == 'flow' else f'={b}{rr}'
                cell = w.cell(rr, 40 + y, f)
                cell.number_format = NUMFMT[rd.fmt]
                cell.font = Font(bold=True)
        if big:
            w.cell(rr, 1).font = Font(bold=True)
        rr += 1
    # KPI block
    w.cell(kpi_first, 1, 'Annual KPIs (Year 1 to Year 3 in the three right-hand columns)').font = Font(bold=True, color=NAVY)
    for cc in range(1, 43):
        w.cell(kpi_first, cc).fill = PatternFill('solid', fgColor=PALE)
    rr = kpi_first + 1
    for rd in spec.KPIS:
        w.cell(rr, 1, rd.label)
        w.cell(rr, 2, rd.unit)
        for y in range(3):
            cell = w.cell(rr, 40 + y, '=' + xl(rd.expr, xlc, 12 * (y + 1)))
            cell.number_format = NUMFMT[rd.fmt]
        rr += 1
    w.column_dimensions['A'].width = 62
    w.column_dimensions['B'].width = 9
    for t in range(1, 37):
        w.column_dimensions[col(t)].width = 11
    w.column_dimensions['AM'].width = 3
    for y in range(3):
        w.column_dimensions[L(40 + y)].width = 14
    w.freeze_panes = w.cell(HDR_T + 6, 3)

# ------------------------------------------------------------------ Dashboard
wsD = wb.create_sheet('Dashboard', 1)
wsD['A1'] = 'Dashboard: one scenario at a time'
wsD['A1'].font = Font(bold=True, size=14, color=NAVY)
wsD['A3'] = 'Scenario (1-8)'
wsD['B3'] = 2
wsD['B3'].font = Font(bold=True, color='0000FF', size=13)
wsD['B3'].fill = PatternFill('solid', fgColor='FFF9E5')
dv = DataValidation(type='whole', operator='between', formula1='1', formula2=str(len(SHEETS)), allow_blank=False)
wsD.add_data_validation(dv)
dv.add('B3')
wsD['C3'] = f'=INDEX(Scenarios!$C$3:${L(2 + len(SHEETS))}$3,B3)'
wsD['C3'].font = Font(bold=True, size=12)
wsD['A4'] = '1 Conservative, 2 Base, 3 Aggressive, 4 Enterprise-delayed, 5 High AI cost, 6 Incident, 7 Enterprise-delayed with gated hiring, 8 Full-scope staffing (CTO pack)'
wsD['A4'].font = Font(italic=True, color='667085')


def choose(r_, colname):
    return '=CHOOSE($B$3,' + ','.join(f'{s}!{colname}{r_}' for s in SHEETS) + ')'


rowd = 6
blocks = [
 ('Revenue and margin', [('stud_rev', 'Student subscriptions'), ('pilot_rev', 'Pilot software'), ('core_rev', 'Institutional platform'),
                         ('svc_rev', 'Implementation services'), ('ai_rev', 'AI capacity add-on'), ('alumni_rev', 'Alumni module'),
                         ('career_rev', 'Career / employer'), ('mk_rev', 'Marketplace (net take)'), ('rev_total', 'TOTAL REVENUE'),
                         ('cogs', 'Cost of revenue'), ('gross_profit', 'Gross profit')]),
 ('Operating expenses', [('opex_eng', 'Engineering and product'), ('opex_sec', 'Security and privacy'), ('opex_sales', 'Sales and partnerships'),
                         ('opex_mkt', 'Marketing'), ('opex_legal', 'Legal'), ('opex_ins', 'Insurance'), ('opex_ga', 'G&A'),
                         ('opex_inc', 'Incident response'), ('opex', 'TOTAL OPERATING EXPENSES'), ('ebitda', 'Operating result (EBITDA)')]),
 ('Cash', [('collections', 'Cash collected'), ('op_cash', 'Operating cash flow'), ('cum_cash', 'Cumulative operating cash flow'),
           ('cash_bal', 'Illustrative cash balance'), ('deferred', 'Deferred revenue'), ('ar', 'Receivables')]),
 ('Scale', [('arr', 'ARR'), ('arr_inst', 'ARR, institutional'), ('arr_student', 'ARR, student'), ('logos', 'Annual logos'),
            ('pilots_active', 'Pilots running'), ('paid_total', 'Paying students'), ('free', 'Active free students'), ('IA', 'Sponsored students'),
            ('mau_all', 'All monthly-active users'), ('fte_total', 'Headcount (FTE)')]),
]
for title, items in blocks:
    wsD.cell(rowd, 1, title)
    for j, h in enumerate(['Year 1 (2027)', 'Year 2 (2028)', 'Year 3 (2029)']):
        wsD.cell(rowd, 2 + j, h)
    hdr(wsD, rowd, 1, 4)
    rowd += 1
    for name, lab in items:
        wsD.cell(rowd, 1, lab)
        for y in range(3):
            c = wsD.cell(rowd, 2 + y, choose(row_no[name], ANN[y]))
            c.number_format = NUMFMT['n0']
            if lab.isupper() or lab.startswith('TOTAL') or name in ('ebitda', 'gross_profit'):
                c.font = Font(bold=True)
        if lab.startswith('TOTAL') or name in ('ebitda', 'gross_profit'):
            wsD.cell(rowd, 1).font = Font(bold=True)
        rowd += 1
    rowd += 1
wsD.cell(rowd, 1, 'Unit-economics dashboard')
for j, h in enumerate(['Year 1 (2027)', 'Year 2 (2028)', 'Year 3 (2029)']):
    wsD.cell(rowd, 2 + j, h)
hdr(wsD, rowd, 1, 4)
rowd += 1
for rd in spec.KPIS:
    wsD.cell(rowd, 1, rd.label)
    for y in range(3):
        c = wsD.cell(rowd, 2 + y, choose(row_no[rd.name], ANN[y]))
        c.number_format = NUMFMT[rd.fmt]
    rowd += 1
wsD.column_dimensions['A'].width = 88
for c in 'BCD':
    wsD.column_dimensions[c].width = 16
# monthly series for charts
ms = rowd + 2
wsD.cell(ms, 1, 'Monthly series (selected scenario)')
wsD.cell(ms, 1).font = Font(bold=True, color=NAVY)
series = [('arr', 'ARR'), ('rev_total', 'Monthly revenue'), ('op_cash', 'Operating cash flow'), ('cum_cash', 'Cumulative operating cash flow')]
wsD.cell(ms + 1, 1, 'Month')
for t in range(1, 37):
    wsD.cell(ms + 1, 1 + t, t)
for i, (name, lab) in enumerate(series):
    wsD.cell(ms + 2 + i, 1, lab)
    for t in range(1, 37):
        c = wsD.cell(ms + 2 + i, 1 + t, choose(row_no[name], col(t)))
        c.number_format = NUMFMT['n0']
for j, (row_i, ttl, anchor) in enumerate([(0, 'ARR (selected scenario)', 'F6'), (3, 'Cumulative operating cash flow (selected scenario)', 'F25')]):
    ch = LineChart()
    ch.title = ttl
    ch.height, ch.width = 8.5, 20
    ch.add_data(Reference(wsD, min_col=1, max_col=37, min_row=ms + 2 + row_i), from_rows=True, titles_from_data=True)
    ch.set_categories(Reference(wsD, min_col=2, max_col=37, min_row=ms + 1))
    ch.legend = None
    wsD.add_chart(ch, anchor)

# ------------------------------------------------------------------ Compare
wsP = wb.create_sheet('Compare', 2)
wsP['A1'] = 'Scenario comparison (live: every cell reads the scenario sheets)'
wsP['A1'].font = Font(bold=True, size=14, color=NAVY)
wsP.cell(3, 1, 'Metric')
for j, (k, lab) in enumerate(spec.SCENARIOS):
    wsP.cell(3, 2 + j, lab)
hdr(wsP, 3, 1, 1 + len(spec.SCENARIOS))
wsP.row_dimensions[3].height = 48
cmp_rows = [
 ('Revenue, Year 1', lambda s: f"={s}!AN{row_no['rev_total']}", 'n0'),
 ('Revenue, Year 2', lambda s: f"={s}!AO{row_no['rev_total']}", 'n0'),
 ('Revenue, Year 3', lambda s: f"={s}!AP{row_no['rev_total']}", 'n0'),
 ('ARR, month 12', lambda s: f"={s}!AN{row_no['arr']}", 'n0'),
 ('ARR, month 24', lambda s: f"={s}!AO{row_no['arr']}", 'n0'),
 ('ARR, month 36', lambda s: f"={s}!AP{row_no['arr']}", 'n0'),
 ('Annual logos, month 36', lambda s: f"={s}!AP{row_no['logos']}", 'n1'),
 ('Paying students, month 36', lambda s: f"={s}!AP{row_no['paid_total']}", 'n0'),
 ('Gross margin, Year 3', lambda s: f"={s}!AP{row_no['k_gm']}", 'p1'),
 ('Contribution margin, Year 3', lambda s: f"={s}!AP{row_no['k_cm']}", 'p1'),
 ('Operating result, Year 1', lambda s: f"={s}!AN{row_no['ebitda']}", 'n0'),
 ('Operating result, Year 2', lambda s: f"={s}!AO{row_no['ebitda']}", 'n0'),
 ('Operating result, Year 3', lambda s: f"={s}!AP{row_no['ebitda']}", 'n0'),
 ('Net burn, Year 1', lambda s: f"={s}!AN{row_no['k_burn']}", 'n0'),
 ('Net burn, Year 2', lambda s: f"={s}!AO{row_no['k_burn']}", 'n0'),
 ('Net burn, Year 3', lambda s: f"={s}!AP{row_no['k_burn']}", 'n0'),
 ('Cumulative cash need through month 12', lambda s: f"=-{s}!AN{row_no['cum_cash']}", 'n0'),
 ('Cumulative cash need through month 24', lambda s: f"=-{s}!AO{row_no['cum_cash']}", 'n0'),
 ('Cumulative cash need through month 36', lambda s: f"=-{s}!AP{row_no['cum_cash']}", 'n0'),
 ('PEAK FUNDING NEED (deepest cumulative cash trough, months 1-36)', lambda s: f"=-MIN({s}!C{row_no['cum_cash']}:AL{row_no['cum_cash']})", 'n0'),
 ('Month cash runs out on the illustrative opening capital (blank = not within 36 months)',
  lambda s: f"=IFERROR(MATCH(1,{s}!C{row_no['neg_flag']}:AL{row_no['neg_flag']},0),\"\")", 'n0'),
 ('Burn multiple, Year 3', lambda s: f"={s}!AP{row_no['k_burn_mult']}", 'n1'),
 ('Implementation margin, Year 3 (actual team cost)', lambda s: f"={s}!AP{row_no['k_gm_svc']}", 'p1'),
 ('Implementation utilization, Year 3', lambda s: f"={s}!AP{row_no['k_util']}", 'p1'),
 ('Student LTV / CAC, Year 3', lambda s: f"={s}!AP{row_no['k_ltv_cac']}", 'n2'),
 ('AI cost as share of revenue, Year 3', lambda s: f"={s}!AP{row_no['k_ai_pct']}", 'p1'),
 ('Headcount, month 36 (FTE)', lambda s: f"={s}!AP{row_no['fte_total']}", 'n1'),
]
CMP_ROW = {}
for i, (lab, f, fmt) in enumerate(cmp_rows):
    r_ = 4 + i
    CMP_ROW[lab] = r_
    wsP.cell(r_, 1, lab)
    for j, s in enumerate(SHEETS):
        c = wsP.cell(r_, 2 + j, f(s))
        c.number_format = NUMFMT[fmt]
    if lab.startswith('PEAK'):
        for cc in range(1, 2 + len(SHEETS)):
            wsP.cell(r_, cc).font = Font(bold=True)
            wsP.cell(r_, cc).fill = PatternFill('solid', fgColor='FFF2CC')
wsP.column_dimensions['A'].width = 78
for j in range(len(SHEETS)):
    wsP.column_dimensions[L(2 + j)].width = 17
wsP.freeze_panes = 'B4'

# ------------------------------------------------------------------ Checks
wsK = wb.create_sheet('Checks')
wsK['A1'] = 'Model integrity checks (every line must read OK)'
wsK['A1'].font = Font(bold=True, size=14, color=NAVY)
wsK.cell(3, 1, 'Check')
for j, s in enumerate(SHEETS):
    wsK.cell(3, 2 + j, s)
hdr(wsK, 3, 1, 1 + len(SHEETS))
checks = [
 ('Cost-of-revenue lines sum to the allocated total (max abs difference < $0.01)',
  lambda s: f'=IF(AND(MAX({s}!C{row_no["cogs_check"]}:AL{row_no["cogs_check"]})<0.01,MIN({s}!C{row_no["cogs_check"]}:AL{row_no["cogs_check"]})>-0.01),"OK","FAIL")'),
 ('Deferred revenue never negative',
  lambda s: f'=IF(MIN({s}!C{row_no["deferred"]}:AL{row_no["deferred"]})>-0.01,"OK","FAIL")'),
 ('Receivables never negative',
  lambda s: f'=IF(MIN({s}!C{row_no["ar"]}:AL{row_no["ar"]})>-0.01,"OK","FAIL")'),
 ('Cumulative cash equals the sum of monthly operating cash flow',
  lambda s: f'=IF(ABS(SUM({s}!C{row_no["op_cash"]}:AL{row_no["op_cash"]})-{s}!AL{row_no["cum_cash"]})<0.01,"OK","FAIL")'),
 ('Billings less revenue equals deferred revenue at month 36',
  lambda s: f'=IF(ABS(SUM({s}!C{row_no["bill_total"]}:AL{row_no["bill_total"]})-SUM({s}!C{row_no["rev_total"]}:AL{row_no["rev_total"]})-{s}!AL{row_no["deferred"]})<0.01,"OK","FAIL")'),
 ('Headcount at month 36 equals month-1 headcount plus hires from month 2',
  lambda s: f'=IF(ABS({s}!C{row_no["fte_total"]}+SUM({s}!D{row_no["hires"]}:AL{row_no["hires"]})-{s}!AL{row_no["fte_total"]})<0.001,"OK","FAIL")'),
 ('No subscriber, user or logo count below zero',
  lambda s: f'=IF(MIN({s}!C{row_no["free"]}:AL{row_no["free"]},{s}!C{row_no["paid_total"]}:AL{row_no["paid_total"]},{s}!C{row_no["logos"]}:AL{row_no["logos"]})>-0.001,"OK","FAIL")'),
]
for i, (lab, f) in enumerate(checks):
    wsK.cell(4 + i, 1, lab)
    for j, s in enumerate(SHEETS):
        wsK.cell(4 + i, 2 + j, f(s))
n = 4 + len(checks)
wsK.cell(n, 1, 'Seasonality index sums to 12')
wsK.cell(n, 2, f'=IF(ABS({season_sum_cell}-12)<0.0001,"OK","FAIL")')
wsK.cell(n + 1, 1, 'ALL CHECKS')
wsK.cell(n + 1, 2, f'=IF(COUNTIF(B4:{L(1+len(SHEETS))}{n},"FAIL")=0,"OK","FAIL")')
wsK.cell(n + 1, 1).font = Font(bold=True)
wsK.cell(n + 1, 2).font = Font(bold=True)
wsK.column_dimensions['A'].width = 80
for j in range(len(SHEETS)):
    wsK.column_dimensions[L(2 + j)].width = 12

wb.move_sheet('Checks', offset=-(len(wb.sheetnames) - 4))
wb.save(OUT)
print('wrote', OUT, 'sheets:', wb.sheetnames)
import json
json.dump({'row_no': row_no, 'sheets': SHEETS, 'cmp_row': CMP_ROW}, open('layout.json', 'w'))
