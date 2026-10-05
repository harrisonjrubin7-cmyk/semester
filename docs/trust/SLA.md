# Uptime SLA: formula, tables, and a starting schedule

**Status: `NOT_STARTED` as a commitment. The framework is drafted.** Semester
cannot offer a contractual uptime number yet. There is an hourly production
probe (`.github/workflows/production-smoke.yml`), but no retained availability
history, no alert proven to reach an accountable person, and no agreed error
budget. `docs/market-readiness/PROCUREMENT_CHECKLIST.md` says the same thing.
This document is what the SLA will be built from once those exist. Counsel
finalizes the contract language.

Every figure in the tables below is computed by `app/src/lib/sla.ts` and
checked by `app/src/lib/sla.test.ts`. If you edit a number by hand and the
code disagrees, the suite fails.

## The formula

For a monthly measurement period:

```
Monthly availability % = (M − D) / M × 100
Allowed downtime       = M × (1 − target / 100)
```

- **M** is the total minutes in the period (43,200 for a 30-day month).
- **D** is qualifying unplanned downtime. It excludes only what the executed
  SLA explicitly excludes.

Worked example: 37 minutes of qualifying downtime in a 30-day month.

```
(43,200 − 37) / 43,200 × 100 = 99.914%
```

That meets a 99.9% SLA and misses a 99.95% SLA.

Periods are compared in minutes, not percentages. Exactly 4.32 minutes down in
a 30-day month is exactly 99.99%, but the floating-point percentage comes out
as 99.98999999999998, which reads as a breach of a month that met the SLA. It
happens at 99.99% in every month length and at 99.5% in a 29-day February.
`meets()` in `app/src/lib/sla.ts` compares minutes for that reason, and the test pins the
boundary.

## Allowed downtime

<!-- sla:downtime -->
| Target | 28-day month | 30-day month | 31-day month | 365-day year |
| --- | --- | --- | --- | --- |
| 99.0% | 6h 43m 12s | 7h 12m | 7h 26m 24s | 3d 15h 36m |
| 99.5% | 3h 21m 36s | 3h 36m | 3h 43m 12s | 1d 19h 48m |
| 99.9% | 40m 19s | 43m 12s | 44m 38s | 8h 45m 36s |
| 99.95% | 20m 10s | 21m 36s | 22m 19s | 4h 22m 48s |
| 99.99% | 4m 2s | 4m 19s | 4m 28s | 52m 34s |

What each target is suitable for:

| Target | Suitable for |
| --- | --- |
| 99.0% | Not appropriate for a core learning workflow |
| 99.5% | A low-criticality module |
| 99.9% | The initial enterprise platform baseline |
| 99.95% | A mature core workflow |
| 99.99% | Only after the architecture and operations have proven it |

## Recommended pilot SLA, once it can be offered

| Service | External SLA | Internal operating target | Measurement |
| --- | --- | --- | --- |
| Core platform | 99.9% monthly | 99.95% | Synthetic monitoring plus incident log |
| Authentication and SSO | 99.9% monthly, excluding institution IdP failure | 99.99% | Synthetic login and provider health |
| Course read workflows | 99.9% monthly | 99.95% | User/API availability |
| Assignment save and submit | 99.95% in committed critical windows | 99.99% | Save/submit synthetic journey |
| Gradebook | 99.9% monthly | 99.95% | API/UI success and write queue |
| LMS/SIS freshness | Connector-specific | Alert before breach | Last successful authoritative sync |
| AI assistant | Best-effort unless separately contracted | Fallback to non-AI workflows | Provider/API health |
| Scheduled maintenance | Defined exclusion with advance notice | Avoid academic critical windows | Change calendar |

What exists today toward each measurement column is listed in
[`APM-RUNBOOK.md`](APM-RUNBOOK.md). Most of it does not exist yet.

## Service credits

<!-- sla:credits -->
| Measured availability, at least | Credit against the affected monthly fee |
| --- | --- |
| 99.9% | 0% |
| 99.0% | 10% |
| 95.0% | 25% |
| 0% | 50% |

Repeated material breach leads to a termination right or other remedy under
the contract, which counsel drafts.

The schedule is written as lower bounds on purpose. The version this came from
was written as ranges ("99.0%–99.89%", "≥ 99.9%"), which leaves availability
between 99.89% and 99.9% in no band at all. A gap in a credit schedule is
where a dispute starts. With thresholds, every month falls in exactly one
band, and `credit()` in `app/src/lib/sla.ts` is the reference.

## Exclusions to draft precisely

- Scheduled maintenance performed within the stated notice window.
- Emergency maintenance required to protect security or data integrity.
- An outage of the institution's own identity provider, network, LMS, SIS or API.
- Customer misconfiguration, unauthorized use, or not following a documented requirement.
- A third-party service issue the contract expressly carves out.
- Force majeure, as the MSA defines it.
- Beta, preview, or explicitly non-production features.

**Exclusions must not empty the SLA.** A student's submission failing because
of Semester's own queue, database, authorization layer or deployment is
Semester downtime, even when it surfaces through a third-party-connected
workflow.

## What moves this to an offerable number

1. Retain the hourly smoke results as an availability history. A workflow run
   log that expires is not a history.
2. Prove that a failed probe reaches a named person, and record the proof.
3. Agree an SLO and error budget internally, and operate against it for at
   least one full term before offering it externally.
4. Have counsel turn the tables above into schedule language.
