# 01 · Service catalog and ownership

> Part of the [SRE pack](README.md). Status: **proposed**. Data: `app/src/lib/sre/catalog.ts`. Full table: [generated/SERVICE-CATALOG.md](generated/SERVICE-CATALOG.md).

"Treat every production service, connector, queue, job, database, AI route and user-critical workflow as an operable system" is checkable only if *every* is a list. The catalog is that list, and it is held to the repository: a test reads `supabase/functions/`, `supabase/scheduler.sql` and `.github/workflows/` and fails on a missing or extra row.

## What is in it

| Kind | Count | Examples |
| --- | ---: | --- |
| Edge functions (including the AI route) | 16 | `fn:claude`, `fn:billing-webhook`, `fn:push`, `fn:delete-account` |
| Scheduled jobs (`pg_cron`) | 21 | `job:push`, `job:console-audit-integrity`, `job:commercial-dunning` — two are parked until their functions exist |
| Queues and outboxes | 4 | `queue:push_queue`, `queue:support_notification_outbox` |
| Pipelines and monitors | 11 | `pipeline:ci`, `pipeline:schema-deploy`, `pipeline:production-smoke`, `pipeline:drift`, `pipeline:infra-apply` |
| Platform and external dependencies | 10 | `supabase-auth`, `supabase-db`, `stripe`, `anthropic`, `github-pages` |
| Student-facing surfaces | 3 | `web-app`, `status-page`, `institution-gateway` |

Not in it, deliberately: the connectors for SIS, LMS, SAML and OIDC. **No adapter is registered in production** — both registries are empty on purpose and a test fails if that changes silently — so there is nothing to operate yet. The gateway, `fn:integration-tick` and `fn:lti` are in the catalog, with a runbook ([RB-14](runbooks/RB-14-connector-failing.md)) written ahead of the first school. When a real adapter registers, it gets a row, an alert and an experiment before it takes traffic.

## Criticality is about the student

| Class | Question it answers | Examples |
| --- | --- | --- |
| **C0** | Does an hour down lose or expose a student's data, or cut them off in an emergency? | `supabase-db`, `supabase-auth`, `supabase-edge-runtime`, `fn:delete-account` |
| **C1** | Is it a core daily journey, or the only way we would know? | `web-app`, `fn:push`, `fn:billing-webhook`, retention and integrity jobs, the hourly probe |
| **C2** | Can it wait hours? | the AI route, calendar, LTI, dunning |
| **C3** | Is it internal, batch or deferrable? | lead intake, tombstone sweep, contrast sweep |

A component may not be less critical than something that depends on it. That is a test (`inversions()`), and a control proves it can fail. The reason is practical: a C1 queue behind a C3 database is a C3 queue, whatever the label says.

Classes carry **proposed** recovery targets (RTO/RPO in [07](07-RESILIENCE-BACKUP-DR-AND-CHAOS.md)) and a drill cadence. The measured column is `unmeasured` until a drill fills it.

## Ownership

Ownership is a **role**, and a role is held by a person or by nobody. Seven roles — platform, data, security, billing, ai, integrations, support — each have a row in `ROLE_HOLDERS`:

| Role | Primary | Backup |
| --- | --- | --- |
| all seven | Harrison Rubin | **none** |

This is not a criticism; it is the state [`DEGRADED-MODE-MAP.md`](../DEGRADED-MODE-MAP.md) and [`ON-CALL-AND-ESCALATION-POLICY.md`](../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md) already record. What the catalog adds is that it is *counted per component*, so a second person is not a sentence to agree with but 65 cells to turn green.

Every row also carries:

- **Journeys** it can break (ids from `error-budgets.ts`), so an outcome's reliability can be read as the product of the components behind it.
- **Degraded mode** — what the student sees and what still works, in their words. The product is device-first, so most outages degrade *sharing and sign-in*, not a student's own week; the catalog says which.
- **Kill switch** — only the seven real `feature_kill_switch` keys, plus the two read-only deploy flags. A test checks every named switch exists.
- **Runbook** — an id that resolves to a file.

## Rules for adding a component

1. Add the row in `catalog.ts`; the repository test tells you if you forgot.
2. Choose its class by the student, then check `inversions()` is still empty.
3. Name its runbook; if it is a new failure mode, write the runbook first.
4. Name its alert, even if the state is `defined`. A component with no alert is visible in the scorecard as an open cell, not hidden.
5. For a new AI route or cost driver, add the guardrail that stops spend ([08](08-COST-AND-RESOURCE-GOVERNANCE.md)).
