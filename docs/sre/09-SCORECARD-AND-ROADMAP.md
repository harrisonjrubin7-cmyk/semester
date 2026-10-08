# 09 · Reliability scorecard and roadmap

> Part of the [SRE pack](README.md). Status: **proposed.** Code: `app/src/lib/sre/scorecard.ts`. Baseline: [generated/SCORECARD.md](generated/SCORECARD.md).

## 1. The scorecard

Computed from the registers, never typed. Satisfied of applicable, per criticality class:

| Dimension | Applies to | Satisfied when |
| --- | --- | --- |
| owner | all | the role has a primary |
| backup | all | the role has a trained second person |
| runbook | all | the named runbook is in the index |
| alert | C0–C2 | at least one alert is `wired` or better |
| measured | journey-bearing | the journey has an accepted SLI event stream |
| drilled | C0–C1 | an experiment against it has been executed |

`delivery_tested` is reported separately, as the top of the alert ladder, because it is the one thing that separates "a check runs" from "a person would have been woken".

**Baseline, 2026-10-04 (after rebasing onto `d63f9ef`, which added four infrastructure workflows):**

| Class | Components | owner | backup | runbook | alert | measured | drilled |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| C0 | 4 | 4/4 | 0/4 | 4/4 | 0/4 | 0/3 | 1/4 |
| C1 | 18 | 18/18 | 0/18 | 18/18 | 2/18 | 0/2 | 0/18 |
| C2 | 29 | 29/29 | 0/29 | 29/29 | 2/29 | 0/4 | — |
| C3 | 14 | 14/14 | 0/14 | 14/14 | — | — | — |

142 open cells. Ownership and runbooks are done — those were writing. Everything else that is open needs a **person, a measurement or a drill**, which is the honest shape of the gap: the paper is complete and the practice is not.

The scorecard can move, and tests prove it: giving one role a second person turns that role's components green; a promoted alert needs evidence that exists; a journey cannot be marked measured without its id being added to a list a test pins.

## 2. The order, and why

Sorted by what hurts a student most per unit of effort. Each item names what it needs that is not engineering.

| # | Work | Closes | Needs |
| ---: | --- | --- | --- |
| 1 | **Set the AI provider's spend cap and a usage alert at half of it; record the three caps in order** | `ai:spend-half-cap`; `aiCapOrder` → `ordered` | ten minutes in a dashboard |
| 2 | **Verify provider backup and PITR state; run CX-03, the timed isolated restore** | the unknowns behind every C0 RTO and RPO; `recovery:restore-overdue` | a scratch project; ideally a witness |
| 3 | **A second trained operator** with least-privilege access to RB-01 to RB-05 | 65 `backup` cells; the largest row in DEGRADED-MODE-MAP.md | **a person and a funding decision (Q3)** |
| 4 | **A paging route and delivery tests of `probe:public-failed` and `ai:spend-half-cap`** | `delivery_tested` goes from 0; on-call step 1 | a device that makes noise; an agreed coverage window |
| 5 | **Watch the schema deploy**: a machine reads the branch record, or compares `ledger.snapshot` with the live ledger | `deploy:schema-failed` from `manual` to `wired`; the 18 September failure | provider API access |
| 6 | **Structured events and SLI events for sign-in and plan save** | `measured` for two journeys; first real burn alerts | a privacy review of the event definitions |
| 7 | **Freeze calendar and the change gate in CI** | `no_calendar` stops refusing; change classes enforced | **an owner decision** and the academic calendar |
| 8 | **Time each rollback rung in staging** | the ladder's blank times | staging |
| 9 | **CX-11 provider-degraded run in CI** | the native-first rule becomes a build failure | the adapter registry stub |
| 10 | **A back-up for the gateway journal** | gap G5 | design |
| 11 | **An emergency notification path** ([RB-11](runbooks/RB-11-emergency-notification.md)) | `queue:emergency-lag`; CX-12 | **institution agreement on who owns the alert** |
| 12 | **Verify every limit in `LIMITS` and set every cost budget** | `unknown_limit` → a verdict; `budgetMonthly: null` | provider dashboards; the owner |

Items 1, 2 and 4 are the first-month core. Item 3 is the one that matters most and is not a task.

## 3. 30, 60, 90 days

**Days 1–30 — make the existing watchers speak.** Items 1, 2, 4, 5. Exit: the AI cap is set and ordered; one timed provider restore is filed under `docs/evidence/restore/` and the class targets are filled from it; both page alerts are delivery-tested with a recorded acknowledgement time; the schema deploy is no longer visible only to a person who remembers to look. `delivery_tested` is 2, not 0.

**Days 31–60 — measure.** Items 6, 7, 8. Exit: two journeys with an accepted event stream and a real burn state; a freeze calendar approved and the gate required on high-risk changes; each rollback rung timed. `MEASURED_JOURNEYS` has two ids and a reviewable edit says why.

**Days 61–90 — practise.** Items 9, 10, a first game day, and the start of 3 if a person is named. Exit: the provider-degraded run is a required check; the gateway journal has a backup and a restore test; a second person has executed RB-01 to RB-05 unaided on staging; the first monthly reliability review has happened with real numbers.

The pack is deliberately not scheduled past 90 days: after the first review the *measured* gaps, not this table, decide the next quarter.

## 4. Decisions needed from a person

| # | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| D1 | Who is the second operator, and from when? | CEO and CFO | items 3, 4, on-call step 2 |
| D2 | Coverage window, and what is explicitly not covered outside it | CEO | on-call step 1; any customer-facing statement |
| D3 | The freeze calendar | CEO and product | item 7 |
| D4 | Provider spend cap, and the first budgets for the ten cost drivers | CEO and CFO | items 1, 12 |
| D5 | Cloud, region and residency posture (CTO pack P-12, Q2) | CEO and counsel | the regional-failure rung in [07](07-RESILIENCE-BACKUP-DR-AND-CHAOS.md) §5 |
| D6 | Who owns the emergency alert, and is Semester a relay at all? | institution and counsel | item 11 |
| D7 | Accept this pack's class targets as the *proposal* to measure against | architecture review | filling any number in `CLASS_TARGETS` |

Legal conclusions stay with qualified counsel via `LEGAL-REVIEW-QUEUE.md`: notification duties after an incident, FERPA and minors implications of logs and context bundles, accessibility conformance claims, and any wording about availability in a contract.

## 5. What would make this pack wrong

- If the first provider restore takes much longer than 60 minutes, the C0 RTO target is fiction; the roadmap would move a warm standby up, not the target down.
- If the event floor is never met by real traffic, burn alerts are decoration; the probe becomes the monitor and the SLOs stay targets.
- If the second operator never arrives, the scorecard's `backup` column stays zero and no other number in this pack should be believed as "operated".
- If a runbook is wrong when first used by someone else, the runbook count was a vanity metric; the first postmortem should say which.

Each is a reason to keep the claim ceilings where they are.
