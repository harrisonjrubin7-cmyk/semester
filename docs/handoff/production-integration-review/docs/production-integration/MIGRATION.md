# Production migration plan

## Exact proposed change
Zero database migrations in this patch. It adds documentation and test orchestration. No SQLite schema is suitable for connected Supabase/PostgreSQL production. Naming a migration without a verified schema delta would be speculative.

## Gate 0: resolve authority and target
Database owner confirms project reference, region, environment, mapped application/functions, and migration executor. Match deployed public config and server configuration without exposing credentials. Distinguish semester, Semester2 and restore-drill environments. Stop if mapping is ambiguous.

## Gate 1: compare histories and objects
At the approved release commit, inventory supabase/migrations filenames/checksums; read target migration ledger; compare schema columns, constraints, indexes, functions, privileges and policies. Use existing fingerprint/rehearsal tools only after reading them. Do not repair migration history or create stubs to silence drift without reviewed evidence. ROLLBACK.md contains historical repairs, not current permission to repeat them.

## Gate 2: design expand phase
Specify new capability's exact schema/API need. Add backward-compatible tables/columns first; explicit RLS/grants; database constraints and versioning; indexes/lock impact assessed. Do not drop/rename columns needed by rollback candidates. Select migration version after the current remote maximum is verified. No timestamp is preassigned here.

## Gate 3: rehearse
Disposable local/preview PostgreSQL from repository migrations → synthetic existing-state fixtures → migration application → old and new application compatibility → denial tests → duplicate/retry/failure tests → schema fingerprint → restore rehearsal. Preserve result tied to commit, migration hash, schema fingerprint and environment.

## Gate 4: authorize execution
Record migration owner, approver, target, exact SQL hash, backup/restore evidence, lock/time limits, monitoring and abort conditions. Dashboard-based Supabase Branching may already apply on merge: verify executor and avoid a second competing db-push path. Approval precedes merge if merge triggers production mutation.

## Gate 5: apply and reconcile
Chosen sole executor applies reviewed migration → verify actual ledger and objects → deploy compatible app/functions → run authorized checks → observe → enable approved domain. A successful build or integration status is not schema verification.

## Gate 6: contract later
Only after observation window, data reconciliation, and retirement of incompatible rollback candidates: separately approve destructive cleanup. Application rollback does not reverse schema or restore data. Restore/forward correction is an explicit incident decision, not automatic down migration.

## Required evidence
Target mapping; before/after fingerprints; reviewed SQL; old/new compatibility; RLS denial; lock impact; backup restore; executor; approvals; observed application and domain receipts. Missing evidence blocks activation, not silently downgrades the test.
