# Next-action ranking

_Semester design, intelligence, workflow and data system · 2026-10-05 · Source: uploads/expand further on brand identy algorthims workflow.pdf, reconciled with this design system (readme.md, tokens/, components/). Where they differ, this design system wins and the difference is listed._

> Semester should make an institutionally complex world feel personally clear.

**Purpose:** show the student the most useful next action without overwhelming them.

**Inputs:** official deadlines, assignments, registration windows, holds, academic plan, task commitments, student goals, support requests, course schedule, institution notices, preferences.

**Formula (semester-core/nextaction.ts):** score = urgency × consequence × confidence − effort penalty, then an overload limit (top 5; snoozed and done items removed).

| Factor | Values |
| --- | --- |
| Urgency | 1 at ≥14 days → 1.5 → 3 (≤7 d) → 6 (≤3 d) → 10 (<24 h); overdue 12 |
| Consequence | 1–4 by grade weight; 5 if it blocks registration or similar |
| Confidence | Official 1.0 down to stale 0.6; AI/estimated never outrank official at equal urgency |
| Effort penalty | min(1.5, minutes ÷ 120) |
| Overload | Show at most 5; Semester does not maximize notifications |

**Explainability UI:** "Recommended: Review your registration hold. Why: your window opens in 3 days; this hold may prevent enrollment; Student Accounts owns it. Source: official record, updated 2 hours ago. Next step: view details or contact Student Accounts."
