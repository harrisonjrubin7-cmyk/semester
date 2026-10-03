# Feature Flag and Kill Switch Standard

| Control | Value |
| --- | --- |
| Status | **CONTROLLED STANDARD — FAIL-CLOSED MODEL IMPLEMENTED; TARGET EXERCISE PARTIAL** |
| Owner | Harrison Rubin — flag governance and incident authority; backup operator and customer approver unassigned |
| Evidence date | 2026-10-03 at repository revision `ccc254d4` |
| Canonical registry | [`../FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md) and `app/src/lib/flags.ts` |

## Standard

Every runtime flag needs a unique key, type, owner, default, environment/tenant/role scope, risk, creation/review/expiry date, prerequisites, success/abort signals and rollback path. Unknown, malformed or expired temporary values fail closed. Build switches control shipped UI; they do not grant server authority. Server policy, capability, provider scope, data-classification and consent gates remain authoritative.

High-risk capabilities default off and require explicit target/customer approval before production scope. Prefer the narrowest stop: connection, feature, tenant, writeback, provider or cohort before a global switch. A kill switch stops new affected work; it must not silently delete data or claim to undo completed external actions.

## Change and incident procedure

1. Verify identity, scope, current state and authoritative readback; record reason, incident/change link and approver.
2. Engage the narrow control. For database-backed switches, require a non-empty reason and audited write; for build-time flags, deploy the immutable candidate.
3. Confirm through independent readback and a refused/allowed request at the correct boundary. UI absence alone is insufficient.
4. Communicate scope, retained data, user-visible behavior and fallback. Preserve access/audit records without sensitive content.
5. Release only after remediation, validation and approval. Resume connections through their safe lifecycle rather than directly declaring them healthy.
6. At review/expiry, remove stale code, configuration, policy rows, tests and documentation together. Exceptions need owner, reason, compensating control and expiry.

The general write-stop path uses `VITE_READ_ONLY=true` for the app and `SEMESTER_READ_ONLY=on` for the gateway; both must be set and independently verified for their respective surfaces. The named kill-switch inventory and evaluation order remain in the canonical registry.

## Evidence state

**Code/config evidence.** Registry/evaluator tests, tenant policy rows, audited kill switches, server-side safety gates, build flags and app/gateway read-only controls exist.

**Operational evidence.** Repository tests cover important decisions, but production engagement/release, alert-to-operator delivery, all side effects and institutional acceptance are not comprehensively exercised.

**Missing test/proof.** Inventory every shipped/runtime flag against the registry; exercise each high-risk switch in a production-like target; verify in-flight/retry behavior and downstream providers; test access, audit, communication and safe re-enable; assign a backup operator.

## Claim ceiling

Semester may say high-risk institutional flags are designed fail-closed and that repository-tested kill/read-only controls exist.

## Prohibited claims

Do not claim instant global containment, complete side-effect reversal, production-tested kill switches, customer-approved enablement or safe reactivation without target exercises and authoritative readback.
