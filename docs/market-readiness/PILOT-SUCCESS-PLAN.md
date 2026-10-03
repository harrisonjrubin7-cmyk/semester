# Pilot success plan

## Decision design

Before launch, the sponsor and Semester must record a baseline, target, owner, source of truth, reporting cadence, privacy threshold, interpretation caveat, qualitative method, conversion criteria, and decision date for every measure. No launch occurs without an agreed offboarding alternative.

## Recommended scorecard

| Measure | Definition | Source | Owner | Cadence | Caveat |
| --- | --- | --- | --- | --- | --- |
| Eligible cohort activated | consented participants who complete required setup / eligible invited cohort | approved roster + activation event | customer champion | weekly | distinguish invitation delivery from product activation |
| First win | participants who complete approved minimum setup, reach Today, understand one relevant prioritized reversible action and its source/limitations, know the relevant help route, and intentionally complete, schedule, snooze or defer it | proposed `student_first_win` event + UAT sample | product owner | weekly | no full-plan gate; denominator is setup-only activation; outcomes and coarse comprehension/help checks remain separate; event requires target-environment validation before use |
| Weekly planning engagement | activated students completing a meaningful planning action in the week | privacy-reviewed aggregate event | product + privacy | weekly | raw logins do not count |
| Registration/readiness checklist progress | completion of approved, non-authoritative readiness steps | checklist aggregate | customer champion | weekly | not proof of official registration or eligibility |
| Time to first value | elapsed time from consented start to first win | event timestamps | product owner | weekly | exclude support/testing accounts |
| Support burden | tickets, severity, time to first response during published hours, unresolved age | support system | support owner | weekly | targets are operating goals until contractually approved |
| Reliability | successful core workflow attempts and user-safe recovery outcomes | privacy-reviewed telemetry | engineering owner | weekly | no uptime claim without production measurement |
| Student/staff feedback | structured clarity, usefulness, trust, and friction prompts | approved survey/interviews | customer success | midpoint/final | qualitative and self-reported, not causal outcome evidence |

## Checkpoints

- **Pre-launch:** baseline, scope, privacy review, UAT, support and rollback acceptance.
- **Weekly:** activation, first win, engagement, reliability, support, risks, decisions, and scope changes.
- **Midpoint:** outcome trajectory, accessibility/support burden, data minimization, and continue/correct/stop decision.
- **Final:** agreed results with caveats, incident/rights summary, sponsor decision, annual-scope feasibility, reference permission, and conversion or offboarding.

## Guardrails

- Aggregate reporting cells must meet the approved privacy threshold; the current proposal is at least 10 students.
- Do not expose individual “risk,” health, disability, counseling, conduct, aid, immigration, or discipline signals.
- Do not use raw logins as the primary success measure or claim causal retention/GPA/graduation impact.

Use [the detailed scorecard](PILOT-SUCCESS-SCORECARD.md) and [metric plan](METRICS-AND-ANALYTICS-PLAN.md).
