# Registration readiness feature completion

<!-- Rendered from app/src/lib/featurecompletion.ts by featurecompletion.test.ts. Edit the registry, then run npm run registers from app/. -->

> **Status:** not complete · 10 met · 7 partial · 1 missing · 0 not applicable

This page is repository evidence, not a deployment, institution approval, live
integration, production activation or general-availability claim.

## Objective

- Problem: Students need a source-aware, reversible way to prepare for registration without mistaking Semester for the registrar.
- Primary actor: Student preparing for an institution registration window
- Owner: Product and registration operations
- Declared complete: no

## Truth boundary

Repository evidence does not prove durable production persistence, live SIS data, an official registration write, institutional approval or student UAT.

## Eighteen-point gate

| Gate | Requirement | Status | Repository evidence | Remaining gap |
| --- | --- | --- | --- | --- |
| FC-01 | Problem and primary actor defined | met | `docs/learning-university-systems/REGISTRATION-READINESS-SPEC.md` — The student problem, inputs, output and non-authoritative boundary. | None. |
| FC-02 | Capability registry entry exists | met | `app/src/lib/rollout-capabilities.ts` — CAP-050 Registration, its owner, dependencies, acceptance contract and external gate. | None. |
| FC-03 | System passport updated | met | `app/src/lib/systempassports.ts` — The Registration passport with authority, records, commands, events, dependencies and activation gates. | None. |
| FC-04 | Authority and system of record explicit | met | `packages/institution/src/readiness.ts` — The source-aware projection keeps SIS facts authoritative and student choices non-authoritative. | None. |
| FC-05 | Data classification explicit | met | `docs/reference/schemas/events/registration.schema.json` — The registration event payload contract and education-record classification boundary. | None. |
| FC-06 | Schema and migration exist | partial | `supabase/migrations/20260929300000_registration_transaction.sql` — Durable registration request, receipt and reconciliation records. | The readiness aggregate still has no production Postgres persistence adapter or migration. |
| FC-07 | API contract exists | met | `app/server/institution/registration.ts` — The server registration command and receipt contract.<br>`packages/institution/src/readiness-workflow.ts` — The readiness transition and idempotency contract. | None. |
| FC-08 | Policy decision exists | met | `packages/institution/src/policy.ts` — Relationship- and capability-scoped registration-readiness policy decisions. | None. |
| FC-09 | Tenant and RLS coverage exists | partial | `supabase/registration_transaction.check.sql` — Tenant and authorization negatives for the durable registration transaction. | Readiness evaluations and reconciliation assignments are not yet persisted behind tenant RLS. |
| FC-10 | Source and freshness metadata renders | met | `app/src/components/RegistrationReadiness.tsx` — The student view renders status, source-aware next steps and non-authoritative language. | None. |
| FC-11 | Workflow and outbox behavior exists where needed | partial | `packages/institution/src/readiness-workflow.ts` — Idempotent transitions return minimal outbox descriptors and reconciliation work. | The aggregate, receipt, audit row and outbox row are not yet committed atomically by a production repository. |
| FC-12 | Audit events exist | partial | `docs/reference/registration-readiness-workflow.md` — Named readiness audit and event evidence requirements. | Durable audit persistence for readiness evaluation transitions is still specified rather than implemented. |
| FC-13 | Integration boundary documented | met | `docs/reference/registration-readiness-workflow.md` — The boundary between readiness projection, a future Postgres adapter and SIS authority. | None. |
| FC-14 | Complete state matrix exists | partial | `app/src/screens/registration.test.tsx` — Registration route states and recovery behavior under test. | The design archive still lacks one end-to-end proof covering every ready, loading, empty, error, forbidden, offline and stale state. |
| FC-15 | Keyboard, mobile and accessibility behavior passes | partial | `app/src/components/RegistrationReadiness.test.tsx` — Component interaction and accessible text coverage. | No representative student keyboard, mobile and assistive-technology UAT has been recorded. |
| FC-16 | Unit and integration tests pass | met | `packages/institution/src/readiness-workflow.test.ts` — Workflow state, retry, concurrency, receipt and event tests.<br>`app/server/institution/registration.test.ts` — Server registration transaction tests. | None. |
| FC-17 | End-to-end flow passes with seeded data | missing | None. | No seeded end-to-end run proves the complete student-to-authoritative-handoff flow. |
| FC-18 | Runbook, metrics, owner and feature flag exist | partial | `app/src/lib/institution-ops.ts` — The registration_ready metric and registrar owner.<br>`app/src/lib/systempassports.ts` — The operational owner, alerts, rollback boundary and disabled-by-default system flag contract. | A feature-specific runbook, named pilot owner and verified tenant flag configuration are not present. |

## Blocking gates

- FC-06: Schema and migration exist
- FC-09: Tenant and RLS coverage exists
- FC-11: Workflow and outbox behavior exists where needed
- FC-12: Audit events exist
- FC-14: Complete state matrix exists
- FC-15: Keyboard, mobile and accessibility behavior passes
- FC-17: End-to-end flow passes with seeded data
- FC-18: Runbook, metrics, owner and feature flag exist
