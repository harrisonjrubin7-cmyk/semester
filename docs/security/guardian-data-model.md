# Guardian and family data model

Status: target projection model informed by existing family UI, server contracts, guardian migrations and check suites. It is not a claim of production guardian operation.

`Relationship` proves how two people relate. `Consent` records the student's scoped authorization. `Policy` determines what the institution permits. `Projection` is the minimized data a guardian may read. None substitutes for another.

| Record | Minimum fields | Rule |
| --- | --- | --- |
| Invitation | tenant, student, recipient, nonce hash, expiry, status | Rate-limited; no record disclosure before verification |
| Relationship evidence | tenant, student, guardian, type, verifier, method, verified/expiry times | Relationship alone grants no data |
| Consent grant | subject, recipient, purpose, categories/fields, policy version, start/expiry, status | Explicit, time-bound, evidence-backed |
| Restriction | tenant/link, category/field, allow/deny, reason/policy version | Deny wins |
| Projection | tenant, grant/version, category, minimized payload, source/freshness, expiry | Separate service/table; no raw-record passthrough |
| Access decision | request/correlation, actor, tenant, purpose, grant/policy versions, allow/deny, time | Audit sensitive allows and denies |
| Revocation | grant, actor, reason, time, invalidation result | Immediate server denial; invalidate projections, sessions and caches |

Guardians never receive grants on raw grades, enrollment, transcript, submission, degree-audit, aid, wellness, accessibility, conduct or support-case tables. A server decision resolves verified identity, relationship, active consent, purpose, institution policy and requested fields, then returns only the approved projection.

The repository has guardian-link/restriction/history schema, private helper logic, RLS policies, family service tests and local sharing flows. It does not prove production relationship authority, universal minimized projections, immediate multi-cache revocation, institution approval, support operations or independent privacy review.

Required negative evidence: raw-table denial; relationship-without-consent denial; wrong tenant/purpose/field denial; next-request revocation; non-leaking errors; and proof support access cannot create or widen guardian consent.
