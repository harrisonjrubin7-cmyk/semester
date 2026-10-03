# Feature Flag and Kill Switch Standard

| Control | Value |
| --- | --- |
| Status | **CONTROLLED STANDARD — FAIL-CLOSED EVALUATION TESTED; TARGET DRILLS PARTIAL** |
| Owner | Harrison Rubin — flag, activation and incident-control primary; backup incident responder and customer approver unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |
| Canonical registry | [`../FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md) |

Every flag requires key, type, purpose, owner/backup, default, environments, tenant/cohort/role scope, data/authority impact, prerequisites, expiry/review, success/guardrail measures, audit fields, activation approval, rollback and kill switch. Unknown, misspelled, expired or insufficiently scoped values resolve off.

Build flags decide what code ships; they do not authorize a tenant. Tenant policy, capabilities, connection/provider scopes, role, data classification, course rules and user eligibility must all pass server-side where risk requires it. Sensitive institutional, AI, upload, sharing, community, writeback and code-execution functions default off.

Kill switches evaluate before entitlement. Engage the narrowest effective scope, provide a reason, verify through authoritative readback and user behavior, communicate impact, preserve audit evidence and reconcile uncertain actions. Release only after remediation/retest; connections return through validation rather than directly to healthy. Read-only mode protects broad database recovery separately from feature-specific kills.

## Evidence state

**Code/config evidence.** Registry/evaluator tests, tenant policy, audited kill-switch rows, build flags and client/gateway read-only guards establish fail-closed mechanics.

**Operational evidence.** No complete target inventory/readback proves current effective values. Production kill switches and read-only mode have not been fully exercised with alert/support/customer operation.

**Missing test/proof.** Reconcile effective target flags, assign backup authority, exercise each launch-critical kill/read-only path, verify audit/alert/user message and recovery, and obtain customer approval for tenant activation.

## Claim ceiling

Semester may say sensitive capabilities default off and that repository tests enforce ordered fail-closed evaluation.

## Prohibited claims

Do not claim a flag authorizes launch, production kill switches are proven, all paths are server-enforced or customer activation is approved without target evidence.
