# Semester logging, monitoring, and alerting standard — controlled draft

- **Status:** `PARTIAL / NOT FULLY STAFFED OR OPERATED`
- **Owner:** Harrison Rubin, Operations/Security primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Scope:** application, identity, database, integrations, AI, security, privacy, availability, backups, releases, and customer-impact signals

## P05 repository validation — 2026-10-03

At repository revision `d246a348`, the focused operational-control run passed **22 files and 311 tests** covering AI kill-switch contracts and drill safety, deploy rollback preconditions, restore-rehearsal CI wiring, error budgets, incident communications, war-room logic, status history/notices/pages, support tickets and their panel, help/status routing, browser/draft/academic/plan/incident recovery, institutional flight-plan recovery, audit regressions and sync status.

The target-dependent exercises were also invoked and failed closed before changing or contacting a configured target:

- `supabase/restore.sh` exited 2 because this host has no PostgreSQL 17 server; no restore cluster was initialized.
- `pnpm run drill:killswitch` exited 2 because `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SEMESTER_SESSION` are absent; no switch or deployed function was touched.
- `pnpm run smoke:production` exited 2 because the explicit production app and gateway HTTPS origins are absent; no production probe ran.

This pass supports repository contracts and safe refusal behavior only. It does not prove production log completeness, alert delivery or acknowledgement, staffed escalation, current deployed health, target rollback, provider-backup restore, measured RTO/RPO, deployed kill-switch operation, support response, incident exercise, customer communication or institutional acceptance.

## Standard

Collect the minimum events needed to detect security, reliability, privacy, safety, cost, and integration failures without logging secrets, tokens, full request bodies, unnecessary student content, or sensitive attributes. Events must carry time, environment, service, correlation ID, outcome/reason, authorized account/tenant/resource identifiers where necessary, source/status, and version while enforcing access, retention, export, deletion, hold, integrity, and incident-preservation rules.

Alerts require a defined condition, severity, owner/backup, route, acknowledgement/escalation, runbook, suppression/tuning rule, test cadence, customer impact rule, and closure evidence. A dashboard or provider log that nobody is assigned to review is not an operated alert.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| public availability | hourly public app/database smoke workflow and browser status page | workflow exists; sustained performance and alert receipt not established here | `PARTIAL` | Operations | target route, escalation, and response evidence |
| gateway/integration telemetry | correlation IDs, structured refusal codes, status/readiness and audit hooks | production sink, retention, query, and alert routing incomplete | `PARTIAL` | Engineering/Operations | target event-to-alert-to-runbook exercise |
| identity/database/function signals | provider dashboards, auth/function logs, health queries | mostly manual review; no complete automated routing | **MANUAL / PARTIAL** | Security/Operations | tested thresholds, delivery, backup, and escalation |
| security/privacy audit | selected access, provisioning, action, and policy records | coverage, immutability, access review, retention, and export not accepted | `PARTIAL` | Security/Privacy | negative/positive event matrix and review evidence |
| client/performance/freshness | target set described in [`APM-RUNBOOK.md`](APM-RUNBOOK.md) | browser errors, web vitals, latency, queues, and source freshness largely absent | `NOT READY` | Engineering/Operations | instrumentation, baselines, alerts, and privacy review |
| backup/release/cost | manual provider checks and selected budget/release sources | backup alerting and complete cost/release anomaly routing absent | `PARTIAL` | Operations/Finance | target alert tests and response records |

The current operating boundary is documented in [`MONITORING.md`](../../MONITORING.md): no 24/7 coverage is claimed, many signals require a person to inspect provider dashboards, and alert ownership is a single-person risk.

## Required signal record

`[SIGNAL/ALERT]`, purpose/risk, event/source, fields/prohibited fields, classification, tenant/account boundary, trigger/window/baseline, warning/critical thresholds, severity, owner/backup/route, acknowledgement/escalation, runbook, access/retention/region, suppression, validation/last test, evidence, customer communication, exception and review date.

## Claim ceiling and activation blockers

Permitted: “Semester has hourly public smoke checks plus selected structured telemetry, audit, health, and manual monitoring paths.” Prohibited: 24/7 monitoring, complete observability, real-time security detection, guaranteed alert response, complete audit logging, published uptime, or institution-accepted operations. Blocks: signal/data inventory, privacy review, production sinks, retention/access, baselines, alert wiring, named rota/backups, delivery/escalation tests, core-workflow probes, audit export, status communication drill, metrics and signed target acceptance.
