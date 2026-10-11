# Canvas read adapter activation boundary

`canvas_lms_read` is the first non-mock member of the integration tick registry. It reads active course context only.
Its presence in source code is not university approval, credential availability, deployment, provider validation or
general availability.

## Admission chain

A scheduled or replayed pull reaches Canvas only when every gate holds:

1. the connection is approved, runnable and due;
2. the tenant's `integration.lms_lti` feature is `production`;
3. `scope.lms.course_context_read` is approved and unexpired;
4. global, tenant and connection kill switches are clear;
5. the connection declares `api_key`, a tenant-bound secret-manager reference and a bare hosted-Instructure HTTPS origin;
6. the provider runtime can audit and issue a short-lived credential lease.

Failure is closed. Invalid connection configuration opens no run and makes no provider call. Missing credential
services or a refused lease makes no provider call and enters the existing sanitized error/dead-letter path.

## Read boundary

- only `GET /api/v1/courses?enrollment_state=active&per_page=100`;
- only same-origin opaque pagination links whose path remains `/api/v1/courses`;
- JSON only, at most 2 MiB per page;
- only `id`, `name` and `course_code` enter the mapping pipeline;
- T0 `lms_context` records only; no roster, grades, submissions, files, messages or writeback;
- idempotency, provenance, freshness, health, retry/dead-letter, pause and kill-switch behavior remain the shared worker's.

The generic reconciliation operation remains available to operators after a complete inventory. The adapter does not
treat one partial page as proof that a missing course was deleted.

## Evidence and remaining blockers

Repository evidence consists of adapter contract tests, negative connection/runtime tests, the migration policy check
and generated Edge parity. Remaining external gates are a production credential broker, an institution-approved
connection and least-privilege Canvas token, provider sandbox/conformance execution, monitoring and alert validation,
reconciliation rehearsal, security review and customer UAT.
