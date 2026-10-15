# Evidence record — strengthened package lab (filed 2026-10-14)

| Field | Value |
|---|---|
| What ran | `lab/` — local Python + SQLite loopback app (8 domain commands + outbox worker) |
| Where | the package author's machine (loopback 127.0.0.1), **not** the repo, CI, Semester-Platform or production |
| Result | 34/34 unit tests passed (validation/UNIT-REPORT.txt); browser smoke: onboarding + submission, mobile no overflow, operator sees no student records, outbox worker, 0 page errors (validation/BROWSER-REPORT.json) |
| Re-run here | No (no Python in this design environment) |
| Counts as | evidence that the **design rules** hold in a reference implementation: tenant/course scope, cross-tenant and cross-student denial, independent bound release, expiry, self-approval blocked even after role change, idempotent receipts, version conflict, stale source, worker replay |
| Does not count as | repo test evidence, RLS proof, deployment, activation, or any of the 15 REL-READINESS-001 evidence items — those need runs against the repo on Semester-Platform |

Stated limits (EVIDENCE-BOUNDARIES.md): production isolation, migration integrity, concurrent load, event-gap leases/DLQ recovery, manual accessibility, and security/legal/customer authority not tested. 8 executable slices; the other modules are specifications, templates or storyboards.
