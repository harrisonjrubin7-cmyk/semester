# Product & Platform Operations Console

## Operating principles

Read-only by default; tenant and environment always visible; least privilege; purpose-scoped access; fresh MFA for sensitive work; two-person approval where risk requires it; immutable audit; safe prepare/confirm/commit; no plaintext secrets; no ordinary direct-SQL workflow.

## Modules and minimum read models

| Module | Minimum read model | Controlled actions |
|---|---|---|
| Command Center | incidents, SLOs, releases, errors, sync/queue health, security alerts, urgent support, tenant rollup | acknowledge, link runbook, open incident |
| Tenants | profile, lifecycle, domains, plan/entitlement, contacts, implementation, health, renewal context | prepare suspend/reactivate; update approved config |
| Users & Identity | account state, memberships, roles, sessions/devices, SSO/SCIM, access review | recovery, revoke session, request JIT access |
| Capabilities | definition, maturity, evidence, dependencies, entitlement, cohorts, history | staged rollout, canary, rollback; never self-attest live |
| Integrations | connection scope, owner, health, last success/failure, freshness, credential metadata | retry/reconcile, disconnect, rotation workflow |
| Data Quality | contract/version, mappings, exceptions, duplicates, mismatches, staleness | authorized correction with before/after audit |
| Support | cases, customer timeline, safe notes, access grants, SLA/CSAT, escalation, incident links | assign, respond, escalate, grant request |
| Trust | audit, denied access, consent/revocation, rights requests, holds, alerts, risk | investigate, approve workflow, export controlled evidence |
| Release & Reliability | deployments, checks, canaries, rollbacks, budgets, synthetics, backup/restore, on-call | promote/rollback through release gate |
| AI Operations | provider health, model/config, tenant policy, cost/usage, quality/safety | stage provider/policy change with two-person approval |
| Marketplace & Community | verification, agreements, listings, moderation, delivery, consent, fraud, retention | approve/reject/escalate under policy |

## Current status

The repository has a guarded console shell, command center, approvals, break-glass, audit, customer, figure, evidence, support, and saved-view components; extensive operational policy/data scaffolding; and many SQL checks. It does not yet provide complete authoritative feeds for the table above. “Present in console code” must therefore remain separate from “connected to live operations.”

## Initial SLO display

Show target, measurement source, window, current value, error budget, last refresh, owner, and limitations. Unknown values render unknown—not zero or green. An SLO is active only after the signal, alert route, responder, and review cadence are verified.

## Runbook linkage

Every exception links to a versioned runbook, evidence source, owner, escalation, customer communication decision, and recovery verification. Closing an incident without a verification result leaves it in follow-up state.

