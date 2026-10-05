# SLO and SLI Draft

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DRAFT — TARGETS PROPOSED; ACHIEVED VALUES UNMEASURED** |
| Owner | Harrison Rubin — reliability-objective owner; backup operations owner and customer approver unassigned |
| Evidence date | 2026-10-03 at repository revision `11cf0b9f` |
| Canonical calculation source | [`../operating-model/SLOS-AND-ERROR-BUDGETS.md`](../operating-model/SLOS-AND-ERROR-BUDGETS.md) and `app/src/lib/governance/error-budgets.ts` |

| Journey | Proposed SLI | Proposed objective | Current evidence |
| --- | --- | ---: | --- |
| sign in | authorized attempts reaching the correct workspace | 99.95% | target only; no accepted field window |
| Today load | eligible loads rendering meaningful content | 99.9% | public probe is narrower than journey outcome |
| plan save | accepted saves durably retrievable by the same authorized person | 99.95% | repository tests; no field denominator |
| advisor agenda save | accepted saves durably retrievable | 99.95% | target only |
| search | valid results within approved latency | 99.9% | target only |
| AI assistance | policy-compliant answer or safe fallback | 99.5% | target only; provider/model scope unsettled |
| critical draft save | durable recovery in committed scope | 99.99% | target only |
| export/delete intake | authorized request accepted and tracked | 99.99% | target only; staffing unresolved |

Eligible/good/bad events, exclusions, window, population, environment, source, late-event handling and data-quality checks must be approved before measurement. User cancellation may be excluded; product/provider faults remain bad. A window with no eligible events is **no data**, never healthy.

## Evidence state

**Code/config evidence.** Objective definitions, integer error-budget math, burn-rate states and tests exist; public probes and selected workflow tests can seed future indicators.

**Operational evidence.** No accepted privacy-safe field event stream, denominator, complete historical window or customer-approved service scope produces achieved SLO values.

**Missing test/proof.** Approve event definitions and privacy, instrument and validate numerator/denominator, collect a representative window, reconcile gaps/late events, exercise alerts and obtain commercial/customer approval before any SLA commitment.

## Claim ceiling

Semester may say these are proposed internal reliability objectives and that calculation logic is repository-tested.

## Prohibited claims

Do not publish these targets as achieved availability, an SLA, historical uptime, response guarantee or production capacity proof.
