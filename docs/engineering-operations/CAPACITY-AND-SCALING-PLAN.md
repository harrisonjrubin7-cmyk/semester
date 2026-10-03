# Capacity and Scaling Plan

| Control | Value |
| --- | --- |
| Status | **CONTROLLED PLAN — LOCAL DATABASE LOAD GUARDS PRESENT; PRODUCTION CAPACITY UNPROVEN** |
| Owner | Harrison Rubin — engineering capacity and cost primary; backup operator, finance and customer technical approver unassigned |
| Evidence date | 2026-10-03 at repository revision `62d37c2f` |

## Capacity units

Plan by active cohort and concurrency, not total accounts alone: browser bundle/cache; authentication/session; PostgREST/API requests; database connections/query/locks/storage/WAL; edge/gateway concurrency; provider/API rate and cost; uploads/media; events/audit/log retention; background jobs/queues; support tickets/incidents; exports/deletions/offboarding and recovery time.

## Staged proof

| Stage | Required proof |
| --- | --- |
| invitation beta | 10–30-person bounded flow, public smoke, core browser journey, support capacity and no paid/official-write dependency |
| design partner | named cohort/workflow, expected peak, target configuration, alert/support/recovery and load profile with headroom |
| paid pilot | full-stack representative load, isolation/invariants, provider quotas/cost, failure/degraded exercise and capacity owner approval |
| enterprise | multiple customer profiles, regional/provider constraints, repeated peaks, staffing/implementation/support capacity and tested scale/recovery |

For each profile record workload/data distribution, concurrency/ramp/duration, environment parity, thresholds, error/latency/saturation, data invariants, recovery, cost and safety stop. Test steady, peak, spike, soak and dependency degradation. Never load-test production without explicit approval and safeguards.

## Evidence state

**Code/config evidence.** Local disposable-database registration-week/everyday-sync load scenarios test latency budgets, concurrency and invariants; bundle budgets control client growth.

**Operational evidence.** No full-stack staging profile covers Auth/PostgREST/edge/gateway/providers, realistic data volume/network, production quotas/cost or institutional peak. No repeatable multi-customer evidence exists.

**Missing test/proof.** Approve target profiles, build representative staging data, run full-stack peak/soak/degraded tests, validate invariants/alerts/recovery/cost, remediate bottlenecks and obtain operational/customer acceptance.

## Claim ceiling

Semester may cite exact local database load scenarios and bundle limits with their environment.

## Prohibited claims

Do not claim production scale, enterprise capacity, a supported user count, elastic operation, provider headroom or cost predictability from local database tests.
