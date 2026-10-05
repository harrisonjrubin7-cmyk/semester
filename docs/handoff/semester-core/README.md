# semester-core — the workflows and algorithms, as code

Pure TypeScript, no dependencies, no I/O. Each module is the decision logic behind a Semester workflow the design system renders; the app supplies data and persistence. Every module has a vitest file proving its rules.

| Module | Workflow | Used by |
| --- | --- | --- |
| `provenance.ts` | Rank sources; resolve conflicting facts; freshness label | SourceBadge, ProvenanceChips, Today |
| `nextaction.ts` | Score and order a student's next actions | Today, NextSteps, Runway |
| `access.ts` | Role × screen access, share expiry, break-glass | Role lens, every route guard |
| `freshness.ts` | Projection lag → UI policy (display / safe / destructive) | Read models, Lag simulator |
| `consequence.ts` | Classify an action → undo / preview / two-person | Dialog, ActionPreview, Approvals |
| `aigateway.ts` | Scope + policy check before any model call | Ask Semester, AIResponse |
| `approvals.ts` | Two-person duty state machine | Console approvals, Finance holds |
| `scoring.ts` | Weighted 0–5 grading with overrides | Workflow lab benchmark |
| `pilot.ts` | Launch readiness from the tracker | Business gap analysis |

Files carry a `.txt` suffix so this design project does not bundle them; drop it when copying (`for f in *.txt; do mv "$f" "${f%.txt}"; done`). Install into `app/src/lib/core/` (or a workspace package). Run `npx vitest run src/lib/core`. These are reference implementations reconciled with the design system — check names against `lib/source.ts`, `lib/status.ts` and `lib/navareas.ts` before replacing anything that already exists.
