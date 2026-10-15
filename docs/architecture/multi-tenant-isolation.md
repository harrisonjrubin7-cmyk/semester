# Multi-tenant isolation baseline

Status: implemented in many schemas; repository verification could not be rerun locally because PostgreSQL 17 was unavailable.

## Current model

Semester uses Supabase/PostgreSQL with tenant-bearing tables, RLS policies, capability grants, restricted functions, audit records, integration connection binding, and negative check suites. The repository contains 171 migrations and 106 SQL check suites. The check harness intentionally refuses a different PostgreSQL major from the configured production major.

Static inventory found roughly 348 distinct application-table declarations, 350 distinct RLS-enable targets, 527 policy declarations and 695 function declarations across the migration history. These are declaration counts, not active-production object counts, because later migrations can replace objects. No created application table was found without a matching RLS-enable declaration by the static name check. No `FORCE ROW LEVEL SECURITY` declaration was found. This is useful evidence, not a substitute for applying the final schema and exercising every role.

## Required request context

Every privileged server transaction should set and validate:

- `app.tenant_id`
- `app.person_id`
- `app.membership_id`
- `app.request_purpose`
- `app.request_id`

The repository does not yet expose one uniformly adopted public helper set under the exact requested `app.*` names. Existing `private.*` helpers and Supabase `auth.uid()` policies should be inventoried before adding new helpers; duplicate authorization systems would increase risk.

## Required invariants

1. Tenant is derived from authenticated server context or a tenant-bound integration credential, never trusted from the browser body.
2. Every tenant-owned row carries `tenant_id`; composite foreign keys include tenant when parent identity could otherwise cross tenants.
3. RLS is enabled and forced where owner bypass is not required; client roles do not receive bypass privileges.
4. Security-definer functions have fixed search paths, narrow grants, explicit tenant checks, and audit behavior.
5. Storage, queues, jobs, search, analytics, AI retrieval, exports, and caches use the same tenant boundary.
6. Missing actor, tenant, membership, purpose, policy, or relationship fails closed.
7. Support uses justified, time-limited, scoped grants with read audit; platform-admin status alone is not a student-record entitlement.
8. Guardian and partner views are projections, not RLS access to raw record tables.

## Evidence found

| Area | State | Evidence |
| --- | --- | --- |
| Tenant-scoped migrations and policies | Implemented | `supabase/migrations`, `supabase/tenancy.check.sql`, integration and role check suites |
| Integration tenant binding | Implemented in contract/schema | composite tenant keys, connection-bound worker/registry contracts |
| Cross-tenant negative tests | Extensive but not rerun | SQL check suites and TypeScript isolation tests |
| Support access | Partial/implemented foundation | support-access migrations, UI, checks, reply audit/outbox |
| Audit correlation/outbox | Implemented foundation | `20260928320000_audit_correlation_and_outbox.sql` and later audit migrations |
| Unified transaction context contract | Partial | patterns exist, exact `app.*` helper contract is not consistently visible |
| RLS owner bypass posture | Gap requiring explicit decision | no `FORCE ROW LEVEL SECURITY` declaration found; service/owner paths require separate least-privilege review |
| Object-storage tenant isolation | Documented/unverified | no live bucket-policy inspection in this assessment |
| Search/AI shared authorization | Partial | local search and AI policy exist; no single server-side retrieval service was verified |

## Verification gate

Before any tenant pilot, run the full PostgreSQL 17 migration/check harness on a clean database and a restored representative schema. At minimum prove:

- Tenant A cannot select, mutate, infer counts for, export, search, or retrieve via AI any Tenant B protected record.
- Connection external IDs are unique within tenant + connection, not globally assumed.
- Revoked membership and support grants take effect on the next request.
- Definer functions do not admit public/anon execution unless explicitly designed for it.
- Background jobs and dead-letter/replay flows preserve tenant binding.
- Errors, metrics, and audit events do not leak raw student content or identifiers across tenants.

No named institution should be activated until an institution-specific role/permission matrix and data map are signed off by the institution, security/privacy, and legal owners.

## Migration strategy

1. Generate the active-schema/RLS inventory from a clean PostgreSQL 17 apply, rather than relying on declaration grep.
2. Classify each table as global-public, platform-control, tenant-owned, person-owned, projection, immutable audit/outbox, or integration staging.
3. For each tenant-owned relation, prove tenant-bearing primary/foreign keys, RLS enable/force decision, client/service grants, definer functions, background-job path and negative tests.
4. Introduce one server-derived request-context helper behind existing policies; do not flip all schemas in one migration.
5. Migrate domain-by-domain with compatibility views/functions and dual-read comparison where necessary. Avoid dual-write authorization decisions.
6. Remove legacy helper paths only after callers, queued jobs, exports, search, AI and support workflows are proven on the canonical decision contract.
