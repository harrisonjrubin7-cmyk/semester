# Semester enterprise architecture reference package

## Deliverables
- semester_schema.sql: full migration for the bounded operations/document reference slice.
- api_contracts.ts: HTTP contract types plus transition-to-RPC adapter.
- architecture_dashboard.html: self-contained interactive explorer, filters, and state simulator.

## Scope and truthfulness
This is NOT the complete university operating-system database. It includes tenant roles, general business documents, basic CRM/implementation records, endpoint catalog, and educational read models. Payroll, ledger, final grades, personal workspaces, accommodations, external signers, retention scheduling, and production infrastructure are not implemented.
No database migration, TypeScript compilation, or browser execution has been performed here. Files have been generated and checked for existence only.

## Migration assumptions
Use a fresh Supabase database with auth.users/auth.uid and anon/authenticated roles. Run the transaction as a trusted migration owner that owns all created tables and functions. The definer helpers/commands rely on owner RLS bypass; this package does NOT enable FORCE RLS. Switching ownership or FORCE RLS requires redesign and tests. Do not use the migration owner for general frontend traffic.
Keep semester_private out of exposed API schemas. If using PostgREST RPC, expose semester deliberately. SQL grants alone do not configure API exposure. Membership/role bootstrap must be performed through trusted administrative tooling. No tenant/role seed is created automatically.
All client table access is read-only. Creating/revising documents and changing state uses authorized definer commands. Other writes are intentionally unavailable to clients. Trusted administrators and workers remain privileged and must be separately controlled and audited.

## Important command boundaries
create_document_version does not verify uploaded file bytes or storage ownership. The application must validate a tenant-authorized immutable upload and compute the SHA-256 hash before invoking it. It has no idempotency receipt; the HTTP adapter must deduplicate creation requests if retries must be supported.
transition_document includes actor+tenant+key idempotency, expected-state checks, document/version locking, reviewer assignment, self-review prohibition, quorum, signature evidence gate, atomic supersession, legal-hold archive guard, event history, and outbox.
All review tasks are required. All signers must be active internal members in this reference slice; external contract signing requires a verified external-party model. Review permission is checked at decision time. Reviewer assignment validates membership, not future availability or permission possession.
Archived means lifecycle state only: no content deletion. Retention scheduling and holds-aware storage deletion are separate unimplemented workers. General business document readers can see all business documents within their tenant. Never put payroll, protected student-service records, restricted legal matters, or other sensitive classes into this policy model without audience-specific policies.
Signature evidence is NOT created by the frontend. A trusted integration must authenticate callbacks, verify provider evidence and exact content hash, enforce idempotency, and insert evidence; that callback implementation is not included.
Membership helper is executable for RLS and returns only a boolean but permits membership probing for known IDs; add a narrower wrapper if that boolean is sensitive.

## API implementation
TypeScript types do not validate runtime inputs. Add UUID/hash/enum validation, participant uniqueness and size caps, pagination limits, session verification, CSRF protection where appropriate, rate limits, structured error mapping, and storage authorization.
HTTP paths in the dashboard/types are specifications, not deployed handlers. SQL RPC names and arguments are exact; camelCase responses are produced by commands. Read handlers must map snake_case database fields to camelCase DTOs and omit raw storage keys.
Never accept an actor ID from request JSON. User commands must preserve authenticated auth.uid; using a service-role client without that context will not make the command work as that user.

## Acceptance tests before deployment
1. Tenant A cannot read Tenant B records or execute its commands.
2. Anonymous and suspended members cannot read protected data.
3. Section-scoped faculty cannot read another section's drafts/submissions.
4. Students cannot read peers' submissions or draft assignments.
5. Client inserts/updates/deletes and role self-assignment are denied.
6. Cross-tenant/section foreign keys reject invalid relationships.
7. Approvals require assigned pending task and prohibit author self-review.
8. Multiple required approvals leave state in_review until final approval.
9. Changes requested creates a new version; old content and decisions remain unchanged.
10. Signature activation rejects absent or mismatched evidence.
11. Parallel activation preserves a single effective version.
12. Retry returns prior receipt; reused key with different payload fails.
13. Legal holds block archive; archive never deletes files.
14. Storage access independently enforces tenant/document access.
15. Outbox delivery is retryable/idempotent and preserves audit evidence.

## Public documentation used
Supabase database functions: https://supabase.com/docs/guides/database/functions
PostgreSQL CREATE FUNCTION: https://www.postgresql.org/docs/current/sql-createfunction.html
