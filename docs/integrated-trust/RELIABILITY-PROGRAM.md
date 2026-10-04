# Reliability program

Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**Status: objectives declared, none measured; one real probe; one real alert.** The repository defines eight service-level objectives and a calculator for their error budgets, an hourly synthetic probe with five days of history on the `status-data` branch, a database load and soak harness that runs in CI, and a logical restore rehearsal that runs in CI. It has no measured availability for any objective, no alert reaching a person other than the AI-spend alert, no provider restore, no recovery time or point, and no chaos exercise. The operations seat is held by the founder, acting, and the founder is also the on-call. This document is the program that closes those gaps; it does not claim any of them closed.

## 1. Objectives

The eight objectives in `app/src/lib/governance/error-budgets.ts` are the working set. They are targets. Each names a student outcome, an eligible attempt, a good one, and which failures count even when a third party was involved.

| Journey | Target | Good event | Measured today |
| --- | ---: | --- | --- |
| `sign_in` | 99.95 % | The student reaches their own workspace | No |
| `today_load` | 99.90 % | Today renders its meaningful content | No |
| `plan_save` | 99.95 % | The plan is durably stored and retrievable by the same user | No |
| `advisor_agenda_save` | 99.95 % | The agenda is stored and retrievable | No |
| `search` | 99.90 % | Results returned for an authorized query | No |
| `ask_semester` | 99.50 % | An answer, or a stated fallback that bypasses no policy | No |
| `assignment_draft_save` | 99.99 % | The draft is durably stored | No |
| `privacy_request_intake` | 99.99 % | The request is accepted and tracked | No |

**Gaps in the set**, each an item in the [remediation sequence](REMEDIATION-SEQUENCE.md):

- *Registration, grade display, billing summary and integration freshness* have no objective, although the audit and the pilot documents treat them as the highest-stakes journeys. Add `registration_validate`, `grade_display`, `billing_summary` and, per connector, a freshness objective (RM-27).
- *The SLA and the objectives disagree.* The draft SLA states 99.9 % externally for sign-in and the core platform, 99.99 % internally for sign-in, and 99.95 % externally for assignment save; the objectives say 99.95 %, 99.9 % and 99.99 %. Nothing is committed to a customer, the SLA is `NOT_STARTED`, and it must be reconciled to a measured quarter before it is offered (RM-42).
- *Accessibility, privacy, safety, data-integrity and P0/P1 failures override the numeric budget.* `ERROR-BUDGET-DRAFT.md` says so; `error-budgets.ts` does not implement it. The calculator returns a release rule from counts alone, so a security incident in a month with a healthy budget does not freeze anything. Add the override to `review()` with a test (part of RM-27).

## 2. From a target to a number

An objective has a value only when four things exist: an event emitted at the point the student's outcome is decided, a denominator (eligible attempts), a good/bad classification, and a window. Today none exists, so the calculator returns `no_data`, and a window with no data is never reported healthy.

1. **Emit** one structured event per eligible attempt from the Edge Function or the client at the moment of outcome, carrying: journey id, tenant, outcome (`good`, `bad`, `excluded`), reason code, correlation id, build id. No content, no identifiers beyond the opaque account and tenant. The privacy review of the event schema is a question in [RR-PRV-1](COMBINED-RISK-REVIEW.md#privacy).
2. **Store** them in a table with the retention the privacy standard sets for operational telemetry, aggregated daily into counts per journey and tenant. The aggregate is what the budget calculator reads; the raw event is deleted on the schedule.
3. **Compute** `review()` per journey per 28-day window and per tenant, and publish the result to the operations console and the status page.
4. **Act.** A `breached` or `exhausted` state freezes releases that touch the journey (a pull request check reads the state); `at_risk` requires a risk note on the release; a burn rate at or above ten opens an incident review before the window closes.

The first measured month is the prerequisite for everything in section 5.

## 3. Dashboards and alerts

**Dashboards (the operations console).** One page each:

| Page | Reads | Question it answers |
| --- | --- | --- |
| Service levels | Daily counts per journey | Is each objective met, and how much budget is left? |
| Synthetic | `status-data` history | Which components did the probe find down, and when? |
| Database health | `supabase/health.sql` blocks | Connections, locks, long queries, table growth, advisor findings |
| Edge and auth | Function logs, auth logs | Error rate by function, sign-in failures, 429 and 401 spikes |
| Integrations | Connector health states | Which connectors are healthy, delayed, degraded, failed, mismatched or disabled; last sync; discrepancy count |
| Cost | Provider usage | AI spend against the cap, storage, egress |

**Alerts.** Five, each routed to a named person, each tested by planting the failure. Anything else is a dashboard, because an alert that wakes someone for nothing is how the real one is missed.

| Alert | Fires when | Routes to | Severity |
| --- | --- | --- | --- |
| Burn | Burn rate ≥ 10 on any objective over one hour, or ≥ 2 over six | Operations, then engineering | SEV2 |
| Probe | Two consecutive hourly probes fail for the app or the database API | Operations | SEV2, SEV1 if sign-in is also down |
| Authorization | Spike in 401, 403 or row-level-security denials, or any audit-chain break | Security | SEV1 if cross-tenant is possible |
| Data | Backup or restore job failure; migration deploy failure; sweep failure | Operations | SEV2 |
| Spend | AI spend at half the cap (exists today, provider-side) | Founder | SEV3 |

Today only the last exists. Routing to "a second person" is item RM-07; routing to an on-call rota is item RM-12. **An alert that reaches only the person who is asleep is not monitoring**, which `MONITORING.md` already says; the program does not count an alert as present until its test alert has reached a person who is not the founder.

## 4. Capacity, load, chaos, recovery

### 4.1 Capacity

The model is the student calendar: registration windows, assignment deadlines, grade release and billing due dates produce peaks several times the daily level, concentrated in minutes. Capacity is stated per peak, not per day.

| Peak | Shape | What must hold |
| --- | --- | --- |
| Registration opens | A cohort signs in within minutes and validates schedules | `registration_validate` and `sign_in` objectives; the last seat is serialized |
| Deadline hour | Many save drafts and submit in the final hour | `assignment_draft_save`; a receipt only after durable storage |
| Grade release | Many open grades at once | `grade_display`; freshness label |
| Billing due date | Many open the bill and pay | `billing_summary`; payment confirmation never duplicated |
| Start of term | Many onboard and import | Import throughput; the invitation door |

One capacity reading exists: on 30 September, 5,000 students opening within ten minutes and pushing three times each (34 journeys a second, ten times the largest pilot) held at open p95 16 ms and push p95 28 ms; doubling held; four times broke. It predates the push speed-up of 2.4 times and has not been re-read. It is a database reading, not a system one.

### 4.2 Load and soak

| Exists | Missing (RM-41) |
| --- | --- |
| Seven database scenarios against p95 budgets in CI, a four-window soak with a drift rule, and planted-leak and lost-update controls | The edge script that runs the real auth, API and function stack (written, never run) |
| | A browser soak on the real front end |
| | A large-tenant case (one tenant, many courses) and a many-small-tenants case |
| | File upload and OCR load; AI cost and quota load |
| | The `plans` scenario's intermittent miss of its 60 ms budget, cause unknown |

### 4.3 Chaos and failure

Chaos here means rehearsing a named failure in a controlled window, not injecting random faults into production. The set, each an exercise in the [calendar](TABLETOP-CALENDAR.md):

| Failure | How | Expected | Calendar |
| --- | --- | --- | --- |
| Database unavailable | Read-only mode engaged; probe fails | Saved workspace usable; writes refused with the stated message | TT-05 |
| AI provider down or switch engaged | `kill.ai_generation` | 503 with the runtime's message; native features unaffected | TT-02 |
| Connector failure | Disable a connection | Native data stays; freshness label shows | TT-10 |
| Bad deploy | Roll the page back | Restored within the measured 76 to 180 seconds | TT-05 |
| Bad migration | Corrective forward migration in staging | No data loss; the failure is loud (the 18 to 21 September failure was silent) | TT-05 |
| Region or provider loss | Restore into a second project | Measured recovery time and point | TT-03 |
| Key-person absence | One named participant unavailable | The exercise completes or the gap is the finding | TT-12 |

### 4.4 Backup, restore and disaster recovery

| Today | Needed |
| --- | --- |
| A logical dump restored into a disposable database on every change, comparing fingerprints, row counts, row-level security and event triggers; 308 tables on 30 September | **A provider restore** into a second project, timed, repeated each quarter |
| Daily provider backups assumed to be kept 7 days (the plan tier's published number, not read from the dashboard) | Read the setting; decide whether to buy point-in-time recovery; record both |
| Rollback of the page measured at 76 to 180 seconds over four deploys (undated) | Date the measurements; repeat on a schedule |
| The schema is forward-only | A corrective-migration rehearsal in staging |
| The gateway journal is a single-host SQLite file with no backup | Back it up or move it to the database |
| No recovery time or point (`RECOVERY_OBJECTIVES` are `null`, "unmeasured") | Measure, then propose objectives for the institution to approve after a business-impact analysis |

Recovery objectives are not invented here. They are measured in TT-03 and then proposed to an institution; `incident-recovery.ts` says they stay unset until an institution approves them.

## 5. Gates

- **Before an institutional pilot:** a first measured month for the eight objectives (RM-27); one alert reaching a person other than the founder (RM-07, RM-28); the provider restore (RM-10); every switch engaged once in production (RM-29); the gateway deployed with its probe running (RM-19).
- **Before an institution is charged:** a measured quarter before the SLA is reconciled and offered (RM-42); the load shapes in 4.2 run (RM-41); the first four quarters of exercises held (RM-30).
- **On every release:** the error-budget state is read; a `breached` or `exhausted` journey freezes releases that touch it; an override incident freezes regardless of the number.

## 6. What may be said

Permitted: that objectives are declared as targets, that an hourly synthetic check is published with its history, and that the database harness runs on every change. Not permitted: any uptime percentage, RTO, RPO, "24/7", "no data loss", or an SLA (CLM-016). A day with no check is *no data*, never *up*, and the status page already draws it so.
