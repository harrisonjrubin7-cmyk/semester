# Operations readiness evidence register

<!-- Rendered from app/src/lib/ops/readiness.ts by readiness.test.ts. Edit the data, then run `npm run registers` from app/. -->

Readiness is five separate evidence layers. Each layer must have current evidence in order;
repository verification cannot stand in for configuration, deployment, activation, or observed operation.

**Foundation state as of 2026-10-03:** achieved repository; ready: no.

## Evidence contract

| Layer | Expected source | Owner | Freshness | Blocking scope | Limitation |
| --- | --- | --- | --- | --- | --- |
| Repository | Commit-bound repository verification | Engineering | 30 days | Release candidate | Proves source and automated checks only; it does not prove configuration, deployment, approval, or use. |
| Configuration | Tenant and provider configuration evidence | Implementation | 30 days | Named tenant | Configured values do not prove that the release is deployed, approved, or operating. |
| Deployment | Commit-bound deployment receipt and smoke check | Engineering | 7 days | Environment | A reachable deployment does not prove institutional approval or successful operation. |
| Activation / approval | Named approval and activation record | Accountable approver | 90 days | Named tenant and capability | Approval permits bounded use; it does not prove the system operated successfully. |
| Observed operation | Dated production observation with accountable owner | Operations | 30 days | Operational claim | One observation is point-in-time evidence, not a guarantee of future reliability. |

## Current foundation evidence

| Layer | State | Observed source | Observed | Expires |
| --- | --- | --- | --- | --- |
| Repository | current | repo:app/src/lib/ops/readiness.test.ts#five-layer-readiness | 2026-10-03 | 2026-11-02 |
| Configuration | missing | Missing | — | — |
| Deployment | missing | Missing | — | — |
| Activation / approval | missing | Missing | — | — |
| Observed operation | missing | Missing | — | — |

Missing, stale, failed, revoked, future-dated, or wrong-subject evidence is blocking. Later-layer evidence never skips an earlier gate.
