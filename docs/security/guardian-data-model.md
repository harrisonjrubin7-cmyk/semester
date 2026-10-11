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

The repository has guardian-link/restriction/history schema, private helper logic, RLS policies, family service tests and local sharing flows. The first convergence slice adds an online-only calendar projection: service-only publication requires a live staff-verified K–12 guardian link and the student's accepted exact-resource `family_grants` consent; the stored shape is closed to title, time, status and source freshness; every read rechecks both authorities and records an allow or deny; consent, link and restriction changes invalidate the projection immediately. Raw projection and audit tables have no client or service-role table grants.

That slice is a foundation, not a universal guardian portal. It does not project grades, transcripts, enrollment, submissions, aid, health, conduct, support cases or any other institutional record. It does not prove production relationship authority, institution-approved consent policy, live provider publication, immediate invalidation across deployed caches/sessions, institution approval, support operations or independent privacy review. Guardian projections remain online-only under the central offline classifier.

Required negative evidence: raw-table denial; relationship-without-consent denial; wrong tenant/purpose/field denial; next-request revocation; non-leaking errors; and proof support access cannot create or widen guardian consent.
