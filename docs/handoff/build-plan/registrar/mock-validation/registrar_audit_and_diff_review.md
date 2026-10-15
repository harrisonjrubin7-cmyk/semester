# Enrollment API audit
Audit of the reference contract described/generated earlier; not live HTTP conformance.
Critical: operation-specific arrays were optional without oneOf branches, minItems and required sets. Fix with add/drop/swap/withdraw branches and reject irrelevant fields.
High: bearer scheme documents authentication but does not prove JWT issuer/audience/signature/expiry, key rotation or revocation.
High: current membership/purpose and integration-mode authority need execution-time checks, not client role claims.
High: timeout after dispatch must be reconcile_required; preserve operation identity, never blind retry.
High: reference schema lacks schedule-version store, policy evaluation, shared/reserved capacity and transactional executor.
Medium: negative expected versions, unknown fields, invalid UUIDs, duplicate arrays, payload size limits and credit precision need actual HTTP tests.
Medium: documented 429 needs Retry-After behavior; 401 needs WWW-Authenticate; 202 should identify operation Location and polling policy.
Medium: pagination must use stable scoped cursors; sensitive resource existence must not leak.
Local checks: 10 mock scenarios pass; do not equate mock token checks with JWT verification, SQLite with PostgreSQL RLS/locking, or function returns with HTTP conformance.
Production diff: live semester project contains registration_* , grade_entries, academic_record_entries and module-mode controls. registrar_ref is a duplicate reference family, not an approved replacement. Need column/constraint/function/policy and migration-history diff plus confirmed target. Platform project returned no tables in queried core/academic/learn/public schemas; no assertion about other schemas.
