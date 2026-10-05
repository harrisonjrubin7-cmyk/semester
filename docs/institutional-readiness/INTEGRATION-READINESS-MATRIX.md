# Integration Readiness Matrix

| Control | Value |
| --- | --- |
| Status | **CONTROLLED READINESS REGISTER — REPOSITORY EVIDENCE VARIES; NO NAMED INSTITUTIONAL CONNECTION ACCEPTED** |
| Owner | Harrison Rubin — company-side integration owner; named customer system owners and backup operators unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../market-readiness/INTEGRATION-READINESS.md`](../market-readiness/INTEGRATION-READINESS.md), [`../INTEGRATION-DATA-PIPELINE-AUDIT.md`](../INTEGRATION-DATA-PIPELINE-AUDIT.md), and [`../INTEGRATION-TEST-PLAN.md`](../INTEGRATION-TEST-PLAN.md) |

## Status vocabulary

- **Repository-tested** means implementation and automated checks exist in this checkout.
- **Designed** means a documented contract or control exists without an executable provider implementation.
- **Not implemented** means the requested exchange is absent.
- **Target-validated** requires the named provider sandbox, approved fields/scopes, credentials, negative tests, reconciliation, recovery and customer witness.
- **Activated** requires contractual/data authority, accepted target validation, production change authority, monitoring/support ownership and a recorded go-live decision.

Repository-tested is not target-validated or activated.

## Readiness matrix

| Path | Current repository state | Direction / authority | First-pilot posture | Missing evidence before activation |
| --- | --- | --- | --- | --- |
| manual/synthetic setup | workflow available; not an institutional connector | authorized operator input; institution remains authoritative | preferred low-risk path after privacy, UAT, support and recovery acceptance | approved data set, operator, reconciliation, deletion and customer acceptance |
| personal calendar | import/subscription controls exist | user-authorized read; source remains calendar provider | optional and individually revocable | scope/consent/disconnect, freshness, duplicate and failure tests |
| SAML SSO | repository implementation and membership binding controls exist | IdP authenticates; approved membership/roles authorize | off until named IdP configuration and acceptance | provider metadata, claims, cert lifecycle, two-role/negative UAT, rollback and owner |
| SCIM | repository-tested Users/Groups gateway exists and is off by default | IdP supplies lifecycle; approved group mappings grant roles | preview/sandbox only after credential and mapping approval | real IdP tests, credential custody/rotation, deprovision evidence and acceptance |
| institutional OIDC | not implemented | none | unavailable | implementation, threat review, provider tests and acceptance |
| LTI 1.3 launch | core launch, Deep Linking and AGS paths are repository-tested | LMS supplies signed context; membership/feature/connection gates limit use | sandbox only; bind every registration | real LMS launch, tenant binding, keys/rotation, logs, role/context and failure tests |
| LTI NRPS | not implemented/requested | none | unavailable | approved use case, minimized roster scope, implementation and reconciliation |
| LTI AGS grade passback | repository path exists behind gates; unbound legacy behavior remains a blocker | explicit authorized write to LMS | off for initial wedge unless separately approved | eliminate/contain unbound behavior, preview/idempotency/reconciliation, customer UAT and rollback |
| OneRoster 1.2 | designed only; no connector code | proposed authorized SIS/LMS feed | unavailable; use approved bounded alternative | version/profile choice, connector, conformance tests, target feed, reconciliation and certification decision |
| SIS / degree audit | mock read-only adapters and contracts; production registry has no adapter | institutional source remains authoritative | manual or separately approved read-only exchange | real provider adapter, exact fields/scopes, security, target tests, freshness and support |
| LMS API sync | mock pipeline/contracts; production adapter registry empty | LMS remains authoritative | LTI sandbox or manual fallback only | real adapter, tenant scopes, rate-limit discovery, drift/reconciliation and provider acceptance |
| writeback other than separately gated AGS | architecture requires write flags; no general provider proof | source system accepts only approved, explicit writes | prohibited | business authority, preview, approval separation, idempotency, reconciliation, rollback and acceptance |

## Per-connection activation record

Every connection must record the tenant and environment; named business, technical, security and support owners; source of truth; purpose and minimum fields; classification and lawful/contractual authority; direction; endpoints/version; authentication and credential reference; scopes and role mapping; rate limits; cadence/freshness; feature and kill switches; validation/reconciliation; degraded mode; logging/alerts; retention/deletion; rollback; test evidence; approvals; and expiry/review date.

The initial institutional wedge should avoid official-record writes and use synthetic, manual or approved read-only inputs until the relevant row reaches target-validated and the customer accepts the operating plan.

## Evidence state

**Repository evidence.** Identity, LTI, gateway, pipeline, permission, freshness, reconciliation and kill-switch controls have uneven but identifiable repository evidence. Mock adapters do not establish provider compatibility.

**Operational evidence.** No named institution, production credentials, provider acceptance, live synchronization, measured freshness, operated reconciliation, staffed support or customer sign-off is evidenced here.

**Missing test/proof.** Complete one target-specific connection record; run provider sandbox happy/negative/degraded/replay/rollback tests; reconcile an approved synthetic data set; exercise monitoring and support; obtain security/privacy/system-owner acceptance; then record production authorization separately.

## Claim ceiling

Semester may describe the exact dated repository state and a proposed, gated integration method. It may not represent any listed integration as available to, connected for or accepted by an institution unless the target-specific evidence record says so.

## Prohibited claims

Do not claim plug-and-play, production-ready, universally compatible, live-connected, real-time, certified, institution-approved, write-safe, provider-partnered, fully interoperable or activated from repository code, mocks, documentation or an unaccepted sandbox exercise.
