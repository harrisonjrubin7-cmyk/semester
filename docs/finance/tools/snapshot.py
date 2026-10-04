"""Read the Scenario_Results columns for the active scenario from a recalculated (values-only) workbook."""
FIELDS = [  # (column in Scenario_Results, sheet, cell or expression)
    ('Revenue Y1', 'Summary', 'C16'), ('Revenue Y2', 'Summary', 'D16'), ('Revenue Y3', 'Summary', 'E16'),
    ('ARR end Y3', 'Summary', 'E40'), ('Gross margin Y3', 'Summary', 'E23'), ('Subscription GM Y3', 'Summary', 'E52'),
    ('EBITDA Y1', 'Summary', 'C29'), ('EBITDA Y2', 'Summary', 'D29'), ('EBITDA Y3', 'Summary', 'E29'),
    ('Peak funding need', 'Unit_Economics', 'E64'), ('Lowest month-end cash', 'Checks', 'B23'),
    ('Months below policy', 'Checks', 'B24'), ('Cash end Y3', 'Summary', 'E35'), ('Headcount end Y3', 'Summary', 'E44'),
    ('Burn multiple Y3', 'Unit_Economics', 'E61'), ('Inst. NRR Y3', 'Unit_Economics', 'E53'),
]


def read(wb):
    return [wb[s][c].value for _, s, c in FIELDS]
