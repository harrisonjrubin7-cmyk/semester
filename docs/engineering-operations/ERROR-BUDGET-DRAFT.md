# Error Budget Draft

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DRAFT — CALCULATION/RELEASE RULES DEFINED; OPERATING DATA ABSENT** |
| Owner | Harrison Rubin — reliability budget and release authority; backup approver unassigned |
| Evidence date | 2026-10-03 at repository revision `11cf0b9f` |

For an approved SLO, allowed bad events equal eligible events multiplied by the permitted failure rate. Use integer-safe units, preserve event-quality gaps and never round a small budget away. Provider-caused and retry-masked failures remain bad when the person did not receive the intended safe outcome.

| State | Remaining budget | Release posture |
| --- | ---: | --- |
| healthy | >50% | normal risk-reviewed releases |
| watch | 25–50% | limit risk to affected journey; schedule reliability work |
| at risk | 10–25% | freeze nonessential affected-flow changes; mitigation and leadership review |
| exhausted | <10% | freeze noncritical affected-service releases |
| breached | objective missed | incident/postmortem, corrective action and required communication |

Burn of 10x or more in an approved short window triggers urgent incident review. No-data, incomplete telemetry or an invalid denominator cannot be labeled healthy. Security, privacy, safety, accessibility, data-integrity and P0/P1 failures override the numeric budget and block release.

## Evidence state

**Code/config evidence.** Error-budget/burn calculation and governance tests exist.

**Operational evidence.** No accepted SLI stream currently supplies complete eligible and bad-event counts; therefore no real budget state is asserted.

**Missing test/proof.** Approve SLIs/windows, validate telemetry, backtest event quality, route budget alerts, exercise a release freeze/resume decision and obtain target/customer acceptance where contractual.

## Claim ceiling

Semester may describe the proposed budget method and tested release-state logic.

## Prohibited claims

Do not claim a healthy budget, remaining percentage, achieved SLO, contractual service credit or safe release solely from this draft or synthetic checks.
