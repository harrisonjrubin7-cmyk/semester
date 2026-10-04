# Finance workbook tools

| File | Role |
| --- | --- |
| `verify_scenarios.py` | **The guard.** Recalculates the workbook in LibreOffice once per scenario (1 to 9); fails if a pasted `Scenario_Results` row has drifted from the live model, any integrity or gate check fails, or gated activity precedes its gate. Run it after any edit to the workbook. |
| `fill_snapshot.py` | Rewrites the pasted rows for scenarios 8 and 9 (and the comparison block) from a fresh recalculation. |
| `recalc.py`, `snapshot.py` | Shared helpers: recalculate for a chosen scenario; which cells feed which snapshot column. |
| `port_gates.py` | The record of the one-time edit that added the go/no-go gates (scenario columns K and L, drivers S-19 and S-20, Assumptions section 13, five gated Revenue rows, two checks). Refuses to run twice. |
| `add_gate_schedule.py` | The record of the one-time edit that added the `Gate_Schedule` sheet and the gate and effective-start columns on `Headcount`, and pasted the scenario 8 and 9 cost columns. Refuses to run twice. |
| `build_dashboard.py`, `dashboard_template.html` | Recalculates every scenario, runs four one-input sensitivities on scenario 8, and writes `../dashboard.html` from the template. Reads the workbook; never edits it. |

Requires Python 3 with `openpyxl` and LibreOffice Calc (`soffice`).

Controls run when the gates were added: scenarios 1 to 7 reproduce the snapshot already in the workbook exactly (0 differences); removing the gate from the pilot-signings row made the gate check fail (3.8 pilots signed before the gate), and restoring it made it pass.
