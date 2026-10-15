# Native registrar replacement — implementation blueprint

> **Start with PRODUCTION-DIFF.md.** The repo already has `public.registration_*` with a real transaction. Everything below is a checklist for additive changes to it, not a schema to apply.

From "expand outline deppen enhance build enire registar.pdf" (13 Oct). Replace the registrar **software domain**, not the registrar's professional authority. Institutional officials keep academic policy, exceptions, official records, awards and consequential decisions.

Build the entire native scope · integrate while authority stays external · transfer authority only for explicitly accepted domains · retire legacy only after reconciliation, recovery, export and institutional acceptance.

| File | What |
|---|---|
| capability-register.yaml | 9 domains (A–I), 93 capabilities, six facts each. Today only "designed" is true for some; nothing is implemented, deployed or authorized. |
| authority-register.yaml | Writer of record per domain. All named legacy source today. |
| data-model.yaml | Entity families, required metadata (effective vs recorded time), 9 critical invariants |
| enrollment-engine.yaml | Execution order, 7 outcomes, transaction requirements, external- vs native-authority mode |
| access.yaml | 13 role bundles, decision inputs, separation-of-duties pairs, student-rights workflows |
| events.yaml | 15 registrar events + cross-platform consequences |
| migration.yaml | Stages 1–6 Discover → Retire |
| acceptance.yaml | 12 acceptance suites, release gates, definition of complete |
| work-packages.yaml | R01–R12 with proposed owner roles |
| api/academic.openapi.yaml | 8 reads + 13 commands, Operation outcomes, idempotency rule (from "Full registrar system blueprint" PDF) |
| erd.mmd | Entity relationships |
| curriculum-and-scheduling.yaml | Versioning, publication, requirement node types, scheduling pipeline, waitlist |
| requirements/ | requirement-graph.ts.txt (typed graph, evaluator, validate), golden-cases.yaml (6 illustrative, unapproved), golden.test.ts.txt |
| ledger/ledger-spec.yaml | Working gradebook vs official ledger, entry contract, calculation versions, correction |
| proposed-schema/110_capacity_pools.sql | Physical/cross-list/reserved/linked pools, ordered locks, offer expiry |
| deploy-runbook.yaml | 12-step rollout, recovery matrix, IAM, migration reconciliation |
| proposed-schema/120_identity_enrollment_grades.sql | Person ≠ account, academic contexts, program assignments, registration operations (digest, admin reason), enrollment events, overrides (requester ≠ approver, use limits), grade scales, submissions, append-only official decision chain (one original, supersede once, idempotent per submission), calculation runs, transcript snapshots, source bindings |
| tests/registrar_invariants.sql | 10 pgTAP checks: last seat, idempotent replay when full, capacity CHECK, override requester ≠ approver, append-only grades, one original per attempt, correction supersedes and keeps the original, admin reason |
| api/curriculum-scheduling.openapi.yaml + common-rest-contract.yaml | Curriculum + scheduling routes with authority, preconditions, status codes, error body |
| migration/ | legacy-mapping-contract.yaml, phases.yaml (M0–M8, rollback, activation blockers), import.mjs.txt (load order, quarantine, never guesses identity) |
| reference-package/ | Your conservative registrar_ref schema, read-only checks, enrollment OpenAPI + INTEGRATION-NOTES.md |
| migration/sync-failures.yaml, reconciliation.yaml (R1–R10), cutover.yaml (16 steps, point of no return, triggers) | From the cutover runbook PDF |
| next-outputs.yaml | The 8 outputs in order with status |
| blockers.yaml | 6 open blockers + required owners |
| proposed-schema/100_registrar_core.sql | Seat allocation + enrollment + grade posting with the invariants enforced in SQL |

Out of scope (separate connected domains): admissions decisions, financial aid determination, payment/accounting, identity-provider operation, learning content and classroom assessment, accommodation case management, government/third-party reporting destinations.

The interactive version is ui_kits/registrar-replacement/ in the design project (opens from the platform's Registrar workspace).


**Reference vs production:** every schema here (100–120 and reference-package/) is a proposal. The next step is a reviewed diff against the repo's existing migrations — not applying these beside them.
