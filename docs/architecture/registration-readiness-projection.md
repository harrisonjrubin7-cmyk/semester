# Registration-readiness projection contract

Status: repository implementation evidence. This contract does not activate an SIS connection, authorize official registration writes, or prove an institution deployment.

## Purpose

`packages/institution/src/readiness.ts` defines the source-aware read model shared by a student, their assigned advisor and an authorized tenant registrar. It is a read contract only. Registration commands continue through the institution gateway's review/execute/receipt boundary.

The projection binds one tenant, student and term to:

- a derived readiness state;
- source authority, observation time and version;
- freshness;
- blockers, holds and prerequisites;
- the student's planned courses and computed conflicts;
- the registration window;
- a projection version and as-of time.

Every fact must cite a source carried by the projection. The builder refuses missing or unknown source references rather than returning an untraceable answer.

## Conservative state derivation

Callers do not supply `status`. `buildRegistrationReadinessProjection` derives it with this precedence:

1. stale source → `stale`;
2. updating/reconciling source → `reconciling`;
3. blocked/degraded source → `unknown`;
4. blocker, conflict, blocking hold, unmet prerequisite or closed window → `blocked`;
5. a fact requiring a person to decide → `needs_review`;
6. missing/unknown fact or no planned course → `unknown`;
7. only then → `ready`.

`ready` therefore describes the known preparation facts. It never means enrolled, approved or guaranteed a seat.

## Authorization and field minimization

`viewRegistrationReadiness` accepts the structural subset of the canonical `@semester/platform` `RequestContext`. It constructs the existing `registration.readiness.view` policy request and applies the returned field obligations before serialization.

| Relationship | Permitted detail |
| --- | --- |
| Student themself | Status, sources/freshness, blockers, holds, prerequisites, plan and window |
| Assigned advisor | Status, sources/freshness, blockers, prerequisites, plan and window; hold details are omitted |
| Tenant registrar | Status, sources/freshness, blockers, holds, prerequisites, plan and window |
| Any other relationship or tenant | Denied; no projection returned |

The tenant/student/term/version envelope remains present after field limiting so cache keys, audit rows and UI identity cannot detach from the governed record. Audit and citation obligations remain in the result for the server enforcement point to fulfil; this pure contract does not pretend it emitted an audit row.

## Held by tests

`packages/institution/src/readiness.test.ts` verifies:

- readiness is derived rather than caller-asserted;
- stale, reconciling and degraded sources fail safely;
- blockers, unknown facts and human review stay distinct;
- every fact cites a known source;
- the student and registrar receive permitted hold details;
- an assigned advisor does not receive hold details;
- cross-tenant and unrelated-staff reads return no projection;
- audit and citation obligations survive the read contract.

## Remaining implementation

The contract is the first P0 seam. A complete workflow still needs an institution adapter/read repository, persistence for evaluation/workflow/receipt state where current tables are insufficient, transactional audit/outbox emission, reconciliation tasks, the existing student UI's feature-gated adoption, advisor/registrar queues, and target-specific UAT. A live connector remains blocked on approval, credentials, mappings, support and rollback evidence.
