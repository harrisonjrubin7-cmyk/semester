# Observability Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAN — PUBLIC SYNTHETIC CHECK PRESENT; INSTITUTIONAL/ALERT OPERATION INCOMPLETE** |
| Owner | Harrison Rubin — observability, security and operations primary; backup responder unassigned |
| Evidence date | 2026-10-03 at repository revision `11cf0b9f` |

## Outcomes and signals

Monitor user outcomes, not only process health: public load and assets; sign-in/session; Today and plan save; source freshness; export/deletion intake; gateway/integration readiness and refusal; provider failure; authorization and cross-tenant denial; database health/migrations; background jobs/queues; AI safety/budget/kill switch; release/revision/configuration; backup/restore; client errors/Web Vitals; support volume; security/privacy/audit anomalies and cost.

Events must be privacy-minimized and carry time, environment, service, revision, correlation ID, tenant/account/resource identifiers only when necessary, outcome/reason and source/status. Never collect secrets, tokens, full prompts/files, unnecessary course content or sensitive attributes for convenience.

Every actionable signal requires owner, backup, severity, threshold/window, route, acknowledgement/escalation, runbook, suppression/tuning, retention/access, test cadence, customer-communication rule and closure evidence. A dashboard without a staffed recipient is not an operated alert.

## Evidence state

**Code/config evidence.** Hourly public application/database smoke, status-history recording, optional institutional probe, structured gateway/audit hooks and selected health/readiness sources exist.

**Operational evidence.** The 2026-10-03 public smoke passed, but institutional monitoring is unconfigured; live alert delivery, retained history review, privacy-approved telemetry, baselines and staffed escalation are not accepted.

**Missing test/proof.** Inventory signals/sinks/access/retention, configure target probes, trigger warning/critical alerts, prove delivery/ack/escalation to primary and backup, exercise runbooks/status communication and obtain target approval.

## Claim ceiling

Semester may say it has hourly public synthetic checks and selected structured health/audit paths. It may cite exact dated probe results.

## Prohibited claims

Do not claim 24/7 monitoring, complete observability, real-time detection, guaranteed response, institutional telemetry or published availability from configured workflows alone.
