# Model source

One definition of every model row, two evaluators, and independent checks.

| File | Role |
| --- | --- |
| `spec.py` | **Assumptions, scenarios, headcount, pipeline schedules and every row of the model.** Edit here. |
| `dsl.py` | Expression tree: each row is evaluated in Python and emitted as an Excel formula from the same definition |
| `engine.py` | Reference run in Python |
| `build_workbook.py` | Writes `../semester-financial-model.xlsx` (live formulas, 7 scenario sheets, Dashboard, Compare, Checks) |
| `verify.py` | Recalculates the workbook in LibreOffice and compares every model cell with the Python run; `--publish` stores the recalculated copy (cached values) |
| `independent_check.py` | Re-derives the student funnel and the Department tier with plain loops, and asserts the accounting identities and that no revenue precedes the first gate |
| `analysis.py` | Sensitivities, levers, break-evens, tranches, per-tier unit economics |
| `results.py`, `render_a.py`, `render_b.py`, `render_c.py`, `render_docs.py` | Render the pages in `../` from the model; `render_docs.py --check` fails if a page is stale or a link is broken |
| `layout.json` | Row map written by the builder, read by the verifier |

## Workflow

```bash
cd docs/finance/model
python3 build_workbook.py ../semester-financial-model.xlsx
python3 verify.py ../semester-financial-model.xlsx --publish
python3 independent_check.py
python3 render_docs.py
python3 render_docs.py --check
```

Needs `openpyxl` and LibreOffice Calc (`soffice`). The verifier is a guard only if it can fail, so it was run against a deliberately corrupted workbook (one changed formula produced 99 downstream mismatches) and the independent check against an off-by-one pilot lag (it failed on the first affected logo count). If you change the verifier or the checks, repeat that control.

## What verification proves and does not

It proves the workbook computes what `spec.py` says (about 55,000 cells across seven scenarios), that the student funnel and one institutional tier follow an independent derivation, and that the cost, cash and deferred-revenue identities hold. It does **not** prove that any assumption is true. Of the inputs, almost none is observed; see `../01-ASSUMPTIONS-AND-EVIDENCE.md`.
