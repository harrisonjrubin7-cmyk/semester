# Data & Analysis Studio

**Flags:** `VITE_TOOLKIT_DATA` (the studio), `VITE_TOOLKIT_DATA_UPLOAD` (import).
**Code:** `app/src/lib/toolkit/data.ts`, `app/src/components/toolkit/DataPanel.tsx`.
Every statistic comes from `app/src/lib/stats.ts`, the tested arithmetic behind the
Analyse screen. Nothing asks a model for a number.

| Step | Built |
| --- | --- |
| 1. Import | CSV file or pasted CSV, **after** choosing a data class. Unclassified → refused. T4–T6 → refused with the route to follow. 2 MB cap. |
| 2. Understand | Suggested dictionary (number / category / text / date), unit, valid values, **confirmed** per variable. Unconfirmed variables block export. |
| 3. Clean | Drop missing, drop duplicates, trim, recode, exclude variable. **Each step needs a reason.** Raw data is never modified: the working table is the raw table with the log replayed, so the log *is* the cleaning and undo is deleting a step. |
| 3. Analyze | Describe a variable: n, missing, mean, sd, min, quartiles, max, or category counts. Charting and regression hand off to *Analyse data*. |
| Method guide | `methodsFor(outcome, comparison, paired)` — always ≥ 2 candidates, each with assumptions and a fallback if they fail. Never a single "best test". |
| 4. Explain | The brief's five-part template. Export is blocked until uncertainty and *what we cannot conclude* are written, and a causal conclusion is flagged unless the data is marked as from a randomized experiment. |
| 5. Export | Methods-and-results text (row counts before/after, every cleaning step with its reason, the five parts); cleaned CSV. |

## Accessible output

Every described variable gets alt text written from the computed numbers ("Distribution
of score: 3 values (2 missing), from 9 to 12, median 10…") and a captioned table of the
same numbers — the data-table alternative to any chart.

## Data safety

- The classification gate runs before import (see
  [DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md](DATA-CLASSIFICATION-AND-TOOL-GOVERNANCE.md)).
- Stored data that claims a T4+ class is refused on read.
- Nothing is sent anywhere, and nothing trains on it.

## Not built

Qualitative coding, mixed methods, notebooks, regression studio, experiment
analyzer.
