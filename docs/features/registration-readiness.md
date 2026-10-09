# Registration readiness feature completion

<!-- Rendered from app/src/lib/featurecompletion.ts by featurecompletion.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** not complete · 14 met · 3 partial · 1 missing · 0 not applicable

This page is repository evidence, not a deployment, institution approval, live
integration, production activation or general-availability claim.

## Objective

- Problem: Students need a source-aware, reversible way to prepare for registration without mistaking Semester for the registrar.
- Primary actor: Student preparing for an institution registration window
- Owner: Product and registration operations
- Declared complete: no

## Truth boundary

A repository persistence adapter does not prove a deployed database migration, live SIS data, an official registration write, institutional approval or student UAT.

## Eighteen-point gate

| Gate | Requirement | Status | Repository evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| FC-01 | Problem and primary actor defined | met | `docs/learning-university-systems/REGISTRATION-READINESS-SPEC.md` — The student problem, inputs, output and non-authoritative boundary. | None. |
| FC-02 | Capability registry entry exists | met | `app/src/lib/rollout-capabilities.ts` — CAP-050 Registration, its owner, dependencies, acceptance contract and external gate. | None. |
| FC-03 | System passport updated | met | `app/src/lib/systempassports.ts` — The Registration passport with authority, records, commands, events, dependencies and activation gates. | None. |
| FC-04 | Authority and system of record explicit | met | `packages/institution/src/readiness.ts` — The source-aware projection keeps SIS facts authoritative and student choices non-authoritative. | None. |
| FC-05 | Data classification explicit | met | `docs/reference/schemas/events/registration.schema.json` — The registration event payload contract and education-record classification boundary. | None. |
| FC-06 | Schema and migration exist | met | `supabase/migrations/20261009160000_registration_readiness_store.sql` — The readiness aggregate, receipts, reconciliation work, audit evidence and outbox rows have a durable Postgres schema and save RPC.<br>`app/server/institution/readiness-repository.ts` — The server-only repository binds workflow results to the transactional store. | None. |
| FC-07 | API contract exists | met | `app/server/institution/registration.ts` — The server registration command and receipt contract.<br>`packages/institution/src/readiness-workflow.ts` — The readiness transition and idempotency contract. | None. |
| FC-08 | Policy decision exists | met | `packages/institution/src/policy.ts` — Relationship- and capability-scoped registration-readiness policy decisions. | None. |
| FC-09 | Tenant and RLS coverage exists | met | `supabase/registration-readiness-store.check.sql` — The readiness store has tenant, authorization, RLS and cross-tenant negative checks. | None. |
| FC-10 | Source and freshness metadata renders | met | `app/src/components/RegistrationReadiness.tsx` — The student view renders status, source-aware next steps and non-authoritative language. | None. |
| FC-11 | Workflow and outbox behavior exists where needed | met | `supabase/migrations/20261009160000_registration_readiness_store.sql` — One save RPC atomically commits aggregate, receipt, reconciliation work, audit evidence and outbox rows.<br>`app/server/institution/readiness-repository.test.ts` — Repository tests cover save, compare-and-swap, replay, tenant binding and fail-closed behavior. | None. |
| FC-12 | Audit events exist | met | `supabase/migrations/20261009160000_registration_readiness_store.sql` — The transactional readiness save persists minimal audit evidence for every accepted transition. | None. |
| FC-13 | Integration boundary documented | met | `docs/reference/registration-readiness-workflow.md` — The boundary between readiness projection, the service-only Postgres adapter, future callers and SIS authority. | None. |
| FC-14 | Complete state matrix exists | partial | `app/src/screens/registration.test.tsx` — Registration route states and recovery behavior under test. | The design archive still lacks one end-to-end proof covering every ready, loading, empty, error, forbidden, offline and stale state. |
| FC-15 | Keyboard, mobile and accessibility behavior passes | partial | `app/src/components/RegistrationReadiness.test.tsx` — Component interaction and accessible text coverage. | No representative student keyboard, mobile and assistive-technology UAT has been recorded. |
| FC-16 | Unit and integration tests pass | met | `packages/institution/src/readiness-workflow.test.ts` — Workflow state, retry, concurrency, receipt and event tests.<br>`app/server/institution/registration.test.ts` — Server registration transaction tests. | None. |
| FC-17 | End-to-end flow passes with seeded data | missing | None. | No seeded end-to-end run proves the complete student-to-authoritative-handoff flow. |
| FC-18 | Runbook, metrics, owner and feature flag exist | partial | `app/src/lib/institution-ops.ts` — The registration_ready metric and registrar owner.<br>`app/src/lib/systempassports.ts` — The operational owner, alerts, rollback boundary and disabled-by-default system flag contract. | A feature-specific runbook, named pilot owner and verified tenant flag configuration are not present. |

## Blocking gates

- FC-14: Complete state matrix exists
- FC-15: Keyboard, mobile and accessibility behavior passes
- FC-17: End-to-end flow passes with seeded data
- FC-18: Runbook, metrics, owner and feature flag exist
