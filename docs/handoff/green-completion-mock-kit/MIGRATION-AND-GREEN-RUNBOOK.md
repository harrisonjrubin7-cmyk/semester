# Evidence-driven path to green and availability-preserving migration

## Actual delivery status
16-domain workbook follows user screenshot; it is not a live census. Local simulation and tests are not institution authorization. Nothing deployed, activated, or changed remotely. No actual legacy-table or FK inventory obtained; SQL is metadata query only.

## Green is an evidence decision
Designed: reviewed screen/workflow/data/state specs. Implemented: code and durable backend complete. Tested: release-bound positive/negative/failure/accessibility evidence. Deployed: matching app/backend/schema and observed health. Authority: explicit tenant/domain approval or justified N/A for noninstitution domains, not forged Yes. Enabled: server-owned activation plus verified role journey and rollback. Blank or expired evidence blocks. Workbook filled references trigger review, not approval.
Source project release catalog has 22 required gates. Every domain also needs owner/support, privacy/retention, tenant isolation, provenance, accessibility, monitoring, recovery, and authority. Never color green because documentation exists.

## Assignments adapter walkthrough
1. Gate tenant and current institutional approval.
2. Authorize upstream section/object for each operation.
3. Verify connection read/write scope.
4. Validate area/action/fields and expected record version.
5. Review without mutation or reservation.
6. Execute at atomic backend boundary, rechecking authorization/version and durable key+payload binding.
7. Treat errors after potential write as uncertain; do not claim nothing happened.
8. Reconcile authoritative operation without re-execute; enforce current read access.
Previous TypeScript adapter is a proposed boundary, not vendor backend. This pack uses separate runnable JavaScript behavioral reference and SQLite mock; it does NOT execute or certify prior TypeScript code.

## Mock database verification
Node built-in tests + Python standard SQLite worker. 15 tests cover review no-write, submission, replay, conflicting payload, tenant/actor denial, revoked grant, stale version, fields/action, approval, read-only, timeout AFTER commit/reconciliation, unknown outcome, concurrent duplicate key. Database is disposable and synthetic; no network. Worker serializes calls; simultaneous Node requests prove duplicate handling here, not distributed multi-worker concurrency. Production Node requirement is not established by tests run under Node20.
Run: node --test mock-adapter.test.mjs (Python3 available). No npm dependencies.

## Tables to services
Do not require microservices to reach green. Start with clear domain ownership and modular boundaries; extract only with justified operational/scale/isolation requirements. Inventory actual tables, FKs, RLS, functions, views, triggers, grants, transactions, cron/jobs, storage and events. Strongly coupled FK/transaction clusters are candidates to migrate together. Do not blindly split cross-service FKs or erase constraints. Retain an authoritative transactional cluster or replace links with explicitly tested references/reconciliation, not imaginary atomicity.
Track schema.table, proposed owner, incoming/outgoing FKs, application references, data classification, volume, authority, migration stage, dependencies, owner, evidence and rollback. Unclassified table is not auto-assigned by name.

## Availability-preserving cutover (zero-downtime target, not guarantee)
0. Confirm exact target, migration executor, baseline, approved traffic/error thresholds and recovery evidence.
1. Discover metadata and hidden dependencies; compare migration ledger/object fingerprints.
2. Introduce compatible API facade/domain boundary; keep legacy path available.
3. Expand schema additively with bounded lock waits and migration rehearsal. PostgreSQL ALTER TABLE can take strong locks; low lock_timeout reduces waiting, not eliminates locking.
4. Create suitable indexes concurrently where supported; handle invalid indexes, transaction-block restrictions and index readiness. Avoid blindly embedding concurrent DDL in transaction-wrapped tooling.
5. Backfill in checkpointed batches with throttling and stable IDs; preserve classification and tenant scope.
6. Keep one authoritative writer. Use transaction/outbox or a justified capture mechanism to project into the new store. Do not use uncoordinated dual-write HTTP calls.
7. Shadow reads and reconcile deterministic counts/content/relationships, auth denials, lag and deletes. Never shadow writes/payments/notifications as duplicate effects.
8. Validate suitable NOT VALID FK/CHECK constraints later using a rehearsed lock plan; deferred validation is not permission to leave invalid data.
9. Canary reads behind server-owned policy; observe baseline-approved thresholds.
10. Fence old writes and drain/reconcile outstanding commands BEFORE switching write authority. Unknown results require authoritative lookup. If continuity cannot be guaranteed, use disclosed bounded maintenance rather than pretend zero downtime.
11. Cut over named tenant/domain only after approval; stale clients remain compatible or explicit safe read-only.
12. Observe; test rollback with migrated/new writes. Application routing rollback requires reverse projection or safe compatible store; preserving legacy code alone is insufficient.
13. Contract destructive cleanup only after incompatible rollback candidates expire, reconciliation passes and retention/holds permit.
Sources: PostgreSQL ALTER TABLE/CREATE INDEX docs; AWS strangler fig guidance. These are strategy, not an executed migration.

## Critical path
Identity/isolation + policy/evidence + source/data authority + durable command/receipts → approved institution/gateway → courses/assignments/registration and official records → support/campus/career/finance → company/developer workflows → per-domain activation. AI is policy-bounded from foundation, not enabled first and governed later. Complete shared services once; avoid duplicate apps/registries.

## Required launch decisions
Named owner per row; approved production mapping; real backend contract; tenant institution authority; legal/provider/retention decisions; acceptance fixtures; accessibility/security results; support/monitoring coverage; restore/rollback receipt; release and activation manifest. Those cannot be fabricated by this toolkit.
