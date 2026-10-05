# Research Studio

**Flag:** `VITE_TOOLKIT_RESEARCH`. **Code:** `app/src/lib/toolkit/research.ts`,
`app/src/components/toolkit/ResearchPanel.tsx`.

| Step (brief) | Built |
| --- | --- |
| 1. Scope question | Question field |
| 2. Build search plan | Concepts, synonyms → Boolean string (`searchString`); databases; date range; include / exclude rules |
| 3. Find and screen sources | Keep / maybe / exclude; **exclude requires a reason** |
| 4. Extract evidence | Full evidence-matrix entry per source |
| 5. Map themes and disagreement | — not built (no theme map yet) |
| 6. Assess study quality | `cautions()`: preprint, not primary research, small sample (n < 30), declared conflict, no limitations recorded, observational design |
| 7. Build synthesis | Claims, each linked to evidence |
| 8. Draft with citations | References in APA / MLA / Chicago; drafting itself happens in Write |
| 9. Verify every claim | `audit()` per claim |
| 10. Disclose AI use | Toolkit → AI-use policy → declaration |

## Claim audit states

| State | Meaning |
| --- | --- |
| Verified | At least one linked, non-excluded source is verified |
| Not verified | Sources linked, none verified against the original |
| Insufficient evidence | Nothing linked |
| Check wording | Causal wording ("causes", "leads to", "the effect of"…) and no verified source is an experiment |

Hedged wording ("is associated with", "correlates", "predicts") passes even with a
causal verb inside it. The check catches the common case; it cannot see a causal
claim phrased some other way, and the UI calls it a prompt to reread, not a rule.

## Not built

Database connectors (brief: "Do not claim integration with a licensed external tool
until approved connector and license/terms validation exist"), a paper reader that
extracts from a PDF, the citation/theme map.
