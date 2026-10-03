# Technical-readiness audit

**Current status: YELLOW foundation / RED paid-pilot activation.** The repository contains substantial architecture, automated testing, tenant controls, policies, migrations, recovery patterns, and documentation. Target production operation is not evidenced.

## Architecture summary

- React/TypeScript application with strict build configurations and a separate university gateway check.
- Supabase/PostgreSQL data layer with migrations, row-level policies, edge/runtime code, and database-policy tests.
- Tenant/role/capability and feature-control structures, including fail-closed institutional activation patterns.
- Local/manual fallbacks and degraded/read-only designs reduce integration dependency for the first pilot.
- Company site, authenticated app, institutional controls, and operating documentation remain separate deployable concerns requiring release coordination.

## Priority remediation

| Priority | Required remediation | Evidence to close |
| --- | --- | --- |
| P0 | prove target tenant isolation, authorization, session/revocation, minimum-necessary data flow, and privileged audit export | signed cross-tenant/role/security acceptance |
| P0 | establish staffed production monitoring, incident response, backup/restore, rollback, export/deletion, and emergency communication | dated drills with measured results and owners |
| P0 | close every current critical/high security finding and perform a current scoped penetration review | report and remediation verification |
| P1 | validate idempotency/duplicate prevention and recovery for core mutations | targeted tests and UAT |
| P1 | accept core paths under mobile, keyboard, slow/failed network, and provider outage conditions | device/network matrix and issues closed |
| P1 | freeze feature flags, kill switches, provider configuration, and deployment approvals for the pilot | signed configuration and release packet |
| P2 | establish measured performance budgets, capacity assumptions, alert tuning, and support trends from the first pilot | operating dashboard and review minutes |
| P3 | expand approved identity/integration adapters and automate repeatable tenant provisioning only after pilot evidence | design and acceptance records |

## Claim boundary

Passing repository checks demonstrates code health at a revision. It does not demonstrate production availability, institutional approval, scale, disaster recovery, or contractual service levels. See [architecture](../ARCHITECTURE.md), [engineering audit](../../ENGINEERING-AUDIT.md), [security control matrix](SECURITY-CONTROL-MATRIX.md), and [operational reality register](../OPERATIONAL-REALITY-REGISTER.md).
