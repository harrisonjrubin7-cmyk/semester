# 03 · Observability

> Part of the [SRE pack](README.md). Status: **proposed**; what exists is stated exactly in §1. Existing prose: [OBSERVABILITY-PLAN.md](../engineering-operations/OBSERVABILITY-PLAN.md), [MONITORING.md](../../MONITORING.md), [ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md](../ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md), ADR 0010 (correlation ids and the error envelope). Alerts: [generated/ALERTS.md](generated/ALERTS.md).

Monitor the outcome a student has, not only the health of a process. A dashboard without a staffed recipient is not an operated alert.

## 1. What exists today, and what does not

| Signal | State |
| --- | --- |
| Gateway request event (`institution.request`: request id, correlation id, method, normalised route, status, duration, error class) | **In code**, `console.info` JSON |
| `X-Request-Id` and `X-Correlation-Id` response headers; client sends `X-Correlation-Id`; error envelope carries `correlation_id` | **In code** for the gateway and some clients |
| Hourly synthetic probes: app, sign-in, sync, AI (function answers, no model call), checkout (answers, no payment) | **In code and running** (`production-smoke.yml`, `status-record.mjs` → `status-data` branch) |
| Public status page, reading probes from the visitor's browser | **In code** (`app/public/status.html`) |
| Local diagnostics (`lib/timing.ts`, `lib/diagnose.ts`) | In code; **explicitly not telemetry** — nothing leaves the device |
| Edge function logs | `console.error` only; read by a person in the dashboard once a week |
| Database health | Seven manual SQL blocks (`supabase/health.sql`); `gateway_journal_health`, `console_audit_status()` |
| Web vitals, client errors, traces, metrics store, log search, paging | **None.** No Sentry, OpenTelemetry, web-vitals or analytics SDK; the privacy position is no third-party analytics |

So: one correlated server event, one hourly robot and a person with a weekly checklist. The rest of this document is the design for the day that stops being enough, and every item below is a proposal.

## 2. One event schema

Every service emits one JSON line per significant event with these fields and no others without review:

```ts
interface OpsEvent {
  ts: string;               // ISO 8601 UTC
  level: 'info' | 'warn' | 'error';
  event: string;            // dotted, e.g. 'institution.request', 'fn.push.sent', 'job.run'
  component: string;        // a catalog id: 'fn:push', 'job:push', 'supabase-db'
  env: 'production' | 'staging' | 'preview' | 'local';
  revision: string;         // commit or deploy id
  request_id: string;       // this hop
  correlation_id: string;   // the whole journey, across hops
  tenant?: string;          // only where needed to operate (hashed in logs)
  outcome: 'ok' | 'refused' | 'failed' | 'degraded';
  reason?: string;          // a stable code, never prose from a user
  duration_ms?: number;
  journey?: string;         // an error-budgets id, when the event is an SLI event
  eligible?: true;          // SLI events only: this attempt counts
}
```

**What is never logged:** prompts and completions, note or assignment text, grades, file contents, tokens, keys, email bodies, accommodation or health data, or any free text typed by a student. Identifiers appear only when needed to operate, and are hashed in anything that leaves the primary store. A test in the logging helper (to be written with it) refuses a field outside the schema.

`component` is a catalog id so an event, an alert, a runbook and a scorecard row all join on the same key.

## 3. Correlation across every hop

The gateway already generates `X-Request-Id` and honours `X-Correlation-Id`. Extend the same two rules everywhere:

1. **The client** creates a `correlation_id` per user action (not per request) and sends it on every call, including sync pushes. The failure reference a student can quote is derived from it.
2. **Edge functions** read it, or create one if absent, log it on every event and return it in the response and in the error envelope.
3. **Cron callers** create one named for the job: `job:push:2026-10-04T10:15Z`. A function called by the scheduler logs it, so "which run sent this reminder" has an answer.
4. **Database writes** that matter record it in the audit or journal row, so a postmortem can walk from a student's reference to the row.
5. **Queues** carry it in the row; a retry keeps it and increments an attempt counter, so retries do not look like new work.
6. **Traces:** propagate the W3C `traceparent` header alongside `X-Correlation-Id` from day one, even before a tracing backend exists, so adopting one later is a configuration change and not a rewrite. The backend is a decision for the architecture review, not this pack.

A student's "reference" and a responder's log search are then the same string.

## 4. Metrics

Per component, the minimum set (RED for services, USE for resources), derived from the events above before any metrics store is bought:

| Component kind | Metrics |
| --- | --- |
| Edge functions, gateway | request rate; error rate by `reason`; latency p50/p95/p99; refusals by kill switch |
| Queues | depth; **oldest age**; attempts histogram; dead-letter count |
| Jobs | last start, last success, duration, rows affected; **absence** (no run in 2× period) |
| Database | connections vs ceiling; slow statements; lock waits; replication lag when it exists; storage and WAL |
| Providers | success rate; latency; rate-limit responses; cost per unit |
| Client | LCP, INP, CLS, JS-error-free sessions, offline-queue depth — **aggregated and privacy-reviewed, or not collected at all** |
| AI | calls, tokens, refusals, kill-switch state, cost per successful outcome, fallback rate |

## 5. Dashboards

One per question someone actually asks, each owned by a role.

| Dashboard | Answers | Source today |
| --- | --- | --- |
| Journeys | Is each of the eight outcomes within budget, and how fast is it burning? | none; needs the SLI stream ([02](02-SLOS-SLIS-AND-ERROR-BUDGETS.md) §7) |
| Probes and status | Is the product up *right now*, from a student's seat? | `status.html`, `status-history.json` |
| Data plane | Writes, connections, locks, policies, migrations | `supabase/health.sql` |
| Queues and jobs | Backlog age, dead letters, job absence | tables and `cron.job_run_details` |
| Providers and AI | Provider health, spend vs caps, kill-switch state | provider dashboards; `usage` table |
| Delivery | CI state, deploy state, schema record, snapshots vs reality | Actions, Supabase dashboard |
| Capacity | Demand vs verified ceilings for the next peak | [04](04-CAPACITY-PLANNING.md) |
| Cost | Each driver vs its budget and trailing mean | [08](08-COST-AND-RESOURCE-GOVERNANCE.md) |
| Scorecard | Coverage per class | [generated/SCORECARD.md](generated/SCORECARD.md) |

Each dashboard has the same header: owner role, the alert ids it feeds, the runbook for its worst state, and *when it was last looked at by a human*.

## 6. Alert policy

- **Page** only for a symptom that burns budget fast, or for data integrity, security or money. Everything else is a ticket.
- Every alert has the fields in `alerts.ts`: condition, source, route, component, runbook, state. A test refuses a missing runbook.
- **State is a ladder, not a checkbox:** `defined` → `manual` → `wired` → `delivery_tested`. Today: 21 defined, 5 manual, 6 wired, 0 delivery-tested. Only the last means a person would have been woken.
- **Page budget:** more than two pages per person per week is a defect in the alerts, not in the person; the fix is tuning or automation, recorded in the postmortem.
- **Suppress deliberately.** A suppression has an owner and an end date. Flapping alerts are fixed or deleted, never muted indefinitely.
- **Inhibit by dependency.** When `supabase-db` is paging, alerts on components whose `dependsOn` includes it are grouped under it, using the catalog edges. One cause should be one page.

## 7. Retention and access

Operational events: 30 days hot, 13 months aggregated. Security and audit events follow their own retention rules and legal holds (`RETENTION.md`, `DATA-RETENTION-EXPORT-DELETION.md`); nothing in operational logs may outlive the data it describes. Access to logs is least-privilege, itself audited, and never includes student content because none is logged.

## 8. Order of work

1. Structured events in the edge functions (starting with `claude`, `billing-webhook`, `push`), using the schema above.
2. SLI events for **sign-in** and **plan save**.
3. A paging route, a named second recipient, and a delivery test of `probe:public-failed` and `ai:spend-half-cap` ([06](06-INCIDENTS-AND-ON-CALL.md) §5).
4. Queue-age and job-absence checks as scheduled queries.
5. Everything else, in scorecard order.
