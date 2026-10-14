Proposed architecture: shared Semester shell -> gateway -> resource policy -> tenant-scoped service -> database/audit/outbox.
Grading plane: authenticated submission -> immutable artifact -> ephemeral isolated worker -> bounded evidence -> human review -> authorized grade publication. Static portal never executes learner code.
Control-plane API operations are proposed, not deployed: POST /v1/apps; GET /v1/apps/{appId}; POST /v1/installations/{id}/grant-requests; POST /v1/grants/{id}/revocations; POST /v1/releases/{id}/test-runs; POST /v1/apps/{id}/certification-submissions. Require schema validation, scope AND resource policy, idempotency for writes, structured errors and audit. This excerpt is not the prior complete 67-operation contract.
No real student records to AI, no browser service-role keys, no automatic official grades. Isolation must cover API/database/cache/storage/search/events.
SDK: strict TypeScript, generated types, runtime validation, cancellation, bounded safe retries, explicit environments.
Existing workflow-lab is a router/benchmark application; curriculum integration must not overwrite benchmark workflows.
