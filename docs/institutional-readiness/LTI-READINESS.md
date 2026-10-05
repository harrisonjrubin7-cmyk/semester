# LTI Readiness

| Control | Value |
| --- | --- |
| Status | **CORE LTI 1.3, DEEP LINKING AND AGS REPOSITORY-TESTED — NO REAL LMS ACCEPTANCE** |
| Owner | Harrison Rubin — company-side LTI owner; customer LMS administrator, academic owner and backup operator unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../LTI-1.3-LAUNCH-RUNBOOK.md`](../LTI-1.3-LAUNCH-RUNBOOK.md), [`../LMS-INTEROPERABILITY-MATRIX.md`](../LMS-INTEROPERABILITY-MATRIX.md), and [`../INTEGRATION-TEST-PLAN.md`](../INTEGRATION-TEST-PLAN.md) |

## Capability boundary

| Capability | Repository state | Activation rule / gap |
| --- | --- | --- |
| OIDC login initiation and LTI 1.3 resource-link launch | tested with issuer, audience, client, deployment, state, nonce, time, target, role and signature checks | bind a unique registration to the named tenant/connection and pass real-LMS sandbox tests |
| course/resource context | tested from signed launch claims | accept the customer's exact context/role release and demonstrate tenant/course isolation |
| account and membership handling | opaque issuer/subject identity; no email auto-link; linked campus membership can scope/refuse access | unlinked and unbound paths require explicit risk disposition before institutional use |
| Deep Linking | repository implementation exists | customer placement/configuration, signing key, faculty-role and return-flow UAT absent |
| AGS score passback | repository implementation exists behind scopes, flags, approved connection/scope and kill switches for bound registrations | initial wedge keeps it off unless preview, authority, idempotency, reconciliation, exception and rollback tests pass |
| NRPS names and roles | not implemented or requested | unavailable; roster use needs a separately approved implementation |
| launch audit | reasoned logs exist | durable accepted audit/monitoring and retention evidence incomplete |
| key rotation | a tool key is used for callback signing | overlapping rotation, expiry alerting and target exercise incomplete |
| certification | none | certification must be independently awarded; automated tests are not certification |

## Required registration record

For every installation record tenant, LMS/environment, issuer, client ID, deployment ID, login URL, JWKS URL, token URL when needed, approved target/redirect origin, enabled message types/services/scopes, released claims, connection and tenant binding, key owner/rotation method, administrator/academic/support owners, fallback, last validation, feature/kill state, and acceptance/expiry.

Never infer services from the LMS brand. Read service endpoints and scopes only from verified claims, request the minimum scope, and validate each tenant separately.

## Sandbox acceptance

1. Register a synthetic target with tenant-specific identifiers and approved frame origin.
2. Validate success plus every relevant refusal: wrong issuer/audience/client/deployment/target, expired/future token, replayed state/nonce, bad signature, absent role and cross-tenant context.
3. Exercise learner and instructor launches; confirm institutional roles come from active membership and unauthorized placement is refused.
4. Exercise unlinked, no-membership, suspended, deprovisioned and unavailable dependency behavior without exposing sensitive details.
5. If Deep Linking is in scope, validate placement, signed response, return and accessible manual fallback.
6. If AGS is in scope, require preview/confirmation, exact course/line-item binding, least scope, idempotent retry, reconciliation, exception handling, audit and kill/rollback.
7. Rotate keys, simulate LMS/JWKS/token outages, verify alerts/runbook/support and obtain customer acceptance.

Unbound registrations currently allow a legacy `allowed-unbound` passback path. Institutional activation must bind the registration and prove gates, or disable the relevant launch/write path; it must not treat this behavior as accepted.

## Evidence state

**Repository evidence.** Core validation, replay resistance, tenant registration fields, membership decisions, Deep Linking and gated AGS logic have automated evidence.

**Operational evidence.** No named LMS launch, customer-issued registration, production signing-key lifecycle, accepted claims/services, operated monitoring, reconciled grade write or institutional UAT is evidenced.

**Missing test/proof.** Perform target-specific sandbox acceptance, close/disposition the unbound path, exercise rotation/outage/rollback and obtain technical, academic, privacy/security and customer approval for the exact enabled capabilities.

## Claim ceiling

Semester may state that specific LTI 1.3 launch, Deep Linking and gated AGS paths are repository-tested. It must state that NRPS is unavailable and that no live LMS acceptance is established.

## Prohibited claims

Do not claim LTI Advantage certification, universal LMS compatibility, production readiness, live integration, roster support, safe/automatic grade passback, customer acceptance or institution activation from repository tests or synthetic launches.
