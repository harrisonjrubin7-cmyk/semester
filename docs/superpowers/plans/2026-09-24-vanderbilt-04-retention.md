# Vanderbilt Retention and Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` and `supabase:supabase`.

**Goal:** Make expired, withdrawn or policy-invalid capture assets immediately inaccessible and physically delete every permitted Storage object through an observable, retry-safe worker.

**Architecture:** Postgres owns a tenant-scoped deletion queue and legal holds. A service-role Edge Function claims locked batches, deletes exact object keys, confirms absence and settles results. Supabase Cron invokes the worker with a dedicated secret.

### Task 1: Add the deletion queue

**Files:** Generate migration `supabase migration new capture_retention_queue`; create `supabase/retention-worker.check.sql`; modify `MIGRATION-HISTORY.md`.

- [ ] Write failing SQL cases for natural expiry, consent withdrawal, legal hold, duplicate scheduling, cross-tenant object keys, concurrent claims, stale claim recovery and immutable completion.
- [ ] Extend `private.expire_capture_assets()` to revoke access first and enqueue original plus derivative keys idempotently.
- [ ] Add `private.claim_capture_deletions(batch_size)` using `FOR UPDATE SKIP LOCKED`, bounded leases and service-role-only execution.
- [ ] Add settle functions for `deleted`, `already_missing`, retryable and permanent-review outcomes with attempt caps.
- [ ] Run focused and full SQL suites; commit `Queue capture assets for physical deletion`.

### Task 2: Implement the Storage deletion worker

**Files:** Create `supabase/functions/retention/index.ts`, `supabase/functions/_shared/retention.ts`; create unit tests beside shared logic; modify `supabase/config.toml` if required.

- [ ] Write failing tests for correct bucket/key deletion, missing-object success, partial batch failure, bounded retries, lease loss, malicious key, absent secret and log redaction.
- [ ] Require `Authorization: Bearer <CRON_SECRET>` and service-role environment; reject all other callers.
- [ ] Delete only keys returned by the claim function, confirm absence, and settle each item independently.
- [ ] Log counts, latency and error classes only; never content, filenames supplied by users or signed URLs.
- [ ] Run function tests and commit `Delete expired capture objects safely`.

### Task 3: Schedule, observe and prove deletion

**Files:** Generate migration `supabase migration new schedule_capture_retention`; create `app/scripts/retention-smoke.mjs`, fixtures, `docs/vanderbilt/retention-acceptance.md`; modify `app/package.json`.

- [ ] Write a failing smoke fixture that uploads disposable original/derivative objects, expires them, invokes the worker and expects database refusal plus object absence.
- [ ] Create the daily Cron invocation without embedding secrets in migration text; document dashboard/vault setup and job-run query.
- [ ] Add queue-age and permanent-failure readiness checks consumed by Workstream 5.
- [ ] Run local SQL/function tests and staging destructive acceptance only against disposable objects.
- [ ] Commit `Schedule and verify capture retention`.

**External gate:** Vanderbilt must approve retention periods, legal-hold owners and deletion exceptions. Staging proof uses synthetic disposable objects; production evidence requires the approved policy and operator acknowledgement.
