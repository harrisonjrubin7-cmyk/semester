# Integration Architecture

| Control | Value |
| --- | --- |
| Status | **CONTROLLED INTEGRATION MODEL — ADAPTER/CONTRACT EVIDENCE PARTIAL; NAMED PROVIDER ACTIVATION ABSENT** |
| Owner | Harrison Rubin — company-side integration architecture and activation control; backup engineer and customer/provider authorities unassigned |
| Evidence date | 2026-10-03 at repository revision `fb6adc7a` |
| Canonical source | [`../institutional-rollout/generated/publication/integration-architecture.md`](../institutional-rollout/generated/publication/integration-architecture.md) |

## Pattern

An integration moves through discovery, sandbox/fixture, approved target configuration, limited read or prepare-only operation, authoritative readback, monitored production and offboarding. No earlier stage may be described as a later one.

```text
Approved user or scheduled trigger
  -> gateway/function authentication
  -> tenant, role, capability and policy decision
  -> validated canonical request + idempotency key
  -> provider adapter with timeout/retry/circuit/kill switch
  -> normalized result, source and freshness
  -> authoritative readback for consequential writes
  -> privacy-safe audit/metrics and reconciliation
```

## Required adapter contract

Each adapter names provider and environment, data classes and purpose, tenant scope, authentication owner, permissions, endpoint allowlist, request/response schema, provenance/freshness, idempotency and replay, rate/timeout/retry policy, error taxonomy, degraded/manual fallback, audit fields, privacy/retention, accessibility of the fallback, support/escalation, kill switch, rollback/offboarding and acceptance evidence.

Credentials stay server-side. Redirect, webhook and signature handling must be provider-specific and verified. Network access must reject private/loopback/link-local targets and unsafe redirects; DNS resolution/use gaps require pinned or equivalently protected egress where applicable. A displayed success for a consequential write requires provider or official-system readback.

## Activation stages

| Stage | Permitted evidence claim |
| --- | --- |
| designed | contract/runbook only |
| repository-tested | deterministic unit/contract checks with fixtures |
| sandbox-validated | approved provider sandbox and dated readback |
| target-configured | named tenant/provider, credentials, scopes and owners reconciled |
| limited production | bounded cohort/roles, monitoring/support and rollback accepted |
| production-accepted | customer/provider acceptance plus operated evidence for the exact scope |

## Evidence state

**Code/config evidence.** Gateway interfaces, provider-specific functions, capability/policy contracts, source/freshness models, event/audit structures and integration tests provide a substantial preparation layer.

**Operational evidence.** No universal adapter inventory proves current credentials, scopes, regions, provider terms, target telemetry, authoritative readback, support ownership or offboarding. No named institution has accepted production integration here.

**Missing test/proof.** Reconcile the adapter registry and credential owners; approve data/permission scopes; run target authentication, authorization, cross-tenant, replay, failure, alert, kill-switch and offboarding tests; capture authoritative readback; obtain customer/provider acceptance.

## Claim ceiling

Semester may say it has a governed integration architecture and repository-tested contracts for named routes where evidence exists. Sandbox or fixture results must be labeled as such.

## Prohibited claims

Do not claim a live SIS/LMS/SSO/LTI/provider integration, official write, production sync, universal security, guaranteed freshness or institution approval without current named-target evidence.
