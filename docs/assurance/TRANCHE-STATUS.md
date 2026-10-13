# Continue-7 build tranche: status

Source: the "continue" brief (assurance and operating-evidence layer, nine-step tranche).
Status vocabulary: **implemented** (code + tests), **specified** (contract or template, not wired),
**not run** (requires an environment this repo cannot reach). Nothing here is marked verified in staging or production.

| # | Tranche item | Status | Evidence | Remaining |
| --- | --- | --- | --- | --- |
| 1 | Assurance model, SLOs, health-event schema, pilot dashboards | Partly implemented | `docs/assurance/assurance-model.yaml`, `docs/operations/service-objectives.yaml`, `app/src/lib/assurance/health-event.ts` (+ test) | Dashboards and operator UI not built; SLO measurement not wired to telemetry |
| 2 | Reconciliation case service | Partly implemented | `docs/operations/reconciliation.yaml`, `app/src/lib/reconciliation/case.ts` (+ test) | No persistence, API or screen; case records are not stored |
| 3 | Projection metadata and read-model guards | Partly implemented | `docs/architecture/read-model-integrity.yaml`, `app/src/lib/readmodel/integrity.ts` (+ test) | Guard not yet called by any projection or screen |
| 4 | Nine operational drills before activation | Not run | `docs/drills/DRILL-REGISTER-2026-10.yaml` (all nine `not_run`) | Needs a staging environment and an evidence bundle per drill |
| 5 | Pilot instrumentation (understanding, next action, source integrity, staff queue, trust) | Specified | `docs/pilot/measurement-plan.yaml` | No event instrumentation in the product |
| 6 | Outcome taxonomy across surfaces | Specified | `registry/outcomes/readiness.yaml` | Surfaces not audited for adoption |
| 7 | Hypercare cadence | Specified | `docs/pilot/hypercare.yaml` | Needs an agreed institution window and named owners |
| 8 | Material-change revalidation | Specified | `docs/releases/change-control.yaml` | Not enforced by CI |
| 9 | Pilot closeout and renewal package | Templates only | `docs/pilot/closeout/` (00–10) | Content depends on a completed observation window |

## Named owners and institution facts

`registry/tenants/named-institution/customer-success.yaml` leaves every stakeholder as `pending`. No owner, institution, or pilot date has been assumed.

## Next executable steps

1. Wire `missingProjectionMetadata` and `canUseProjectionForOutcome` into the first readiness projection read path (item 3).
2. Persist reconciliation cases and expose `moveCase` through one service boundary (item 2).
3. Schedule drill DRILL-REVOCATION-001 and DRILL-TENANT-ISOLATION-001 first, as they are launch-critical (item 4).
