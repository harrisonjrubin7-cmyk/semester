# Finance workbook tools

| File | Role |
| --- | --- |
| `verify_scenarios.py` | **The guard.** Recalculates the workbook in LibreOffice once per scenario (1 to 9); fails if a pasted `Scenario_Results` row has drifted from the live model, any integrity or gate check fails, or gated activity precedes its gate. Run it after any edit to the workbook. |
| `fill_snapshot.py` | Rewrites the pasted rows for scenarios 8 and 9 (and the comparison block) from a fresh recalculation. |
| `recalc.py`, `snapshot.py` | Shared helpers: recalculate for a chosen scenario; which cells feed which snapshot column. |
| `port_gates.py` | The record of the one-time edit that added the go/no-go gates (scenario columns K and L, drivers S-19 and S-20, Assumptions section 13, five gated Revenue rows, two checks). Refuses to run twice. |
| `add_gate_schedule.py` | The record of the one-time edit that added the `Gate_Schedule` sheet and the gate and effective-start columns on `Headcount`, and pasted the scenario 8 and 9 cost columns. Refuses to run twice. |
| `build_dashboard.py`, `dashboard_template.html` | Builds `../dashboard.html`: embeds the workbook's formulas and `engine.js`, a catalogue of every changeable input (generated from the Assumptions sheet, the scenario drivers and the hiring plan), and the published results per scenario. Checks that the cells the page reads still hold what it expects. Never edits the workbook. |
| `engine.js`, `export_model.py` | A small spreadsheet engine (the 21 functions the workbook uses) and the export of the workbook's cells for it. The dashboard's controls run the real formulas through it. |
| `engine_parity.py`, `engine_parity.js` | **The engine's guard.** Recalculates the workbook in LibreOffice and compares every formula cell with the engine's value: all nine scenarios, then scenarios 2, 8 and 9 again with nine inputs changed. Fails on any difference. Run it after any change to `engine.js` or to the workbook's formulas. The Checks row that reads the pasted snapshot is skipped, because the engine does not carry the snapshot. |

Requires Python 3 with `openpyxl` and LibreOffice Calc (`soffice`).

Controls run when the gates were added: scenarios 1 to 7 reproduce the snapshot already in the workbook exactly (0 differences); removing the gate from the pilot-signings row made the gate check fail (3.8 pilots signed before the gate), and restoring it made it pass.
