# PostgreSQL RLS / RBAC baseline — verification and Zite mapping

Source: "Semester: PostgreSQL RLS, Authentication, RBAC, and API Gateway" (owner upload, 2026-10-22).
Status: **verified_in_test** for the database layer only (disposable PostgreSQL 16.15, synthetic data).
Not applied to any Semester database or Redis. Not production-operated.

## What was run
- Migrations 001–005 transcribed into `rls/migrations.sql`. One addition: a test runtime login
  (`semester_runtime_login`, NOINHERIT, member of `semester_api`) so tests run as the real runtime role,
  not as an admin doing `SET ROLE`.
- Synthetic fixtures in `rls/seed.sql`: two tenants, four users, three workspaces, one workspace-scoped operator.
- `rls/test.sh`: 28 checks, covering the document's §12.2 cases and every §12.3 row that applies to the
  database layer.

## Result
- 28 / 28 pass.
- **Mutation control:** adding one permissive `using (true)` select policy (the document's own warning
  in §6.3) turns 13 checks red. Removing it returns to 28 / 28. So the isolation checks are known to fail
  when isolation breaks.
- Covered: no context; same-tenant and cross-tenant reads; tenant spoofing; updates to inaccessible rows;
  column-grant ownership lock; self role grant; insert owner check; cross-tenant workspace foreign key;
  denied delete; workspace-scoped `read_any`; revoked or expired membership; expired role assignment;
  disabled user; suspended tenant; connection reuse; concurrent expected-version updates (one wins);
  runtime cannot alter RLS, policies or IAM; the login holds nothing without the role; not superuser
  and not BYPASSRLS.

## Second document: audit, JWT, token bucket (owner upload, 2026-10-22)
Source: "Semester security implementation: RLS audit, JWT verification, API routing, and token-bucket tests".
Status: **verified_in_test**. Run on disposable PostgreSQL 16.15 and Redis, with synthetic data and the
real runtime login. Package versions are pinned in `rls/api/package.json`.

- `rls/migration_006.sql` (hardening and role catalog) applies cleanly on top of 001–005, and `test.sh`
  still passes 28 / 28.
- `rls/audit.sql` (§2.1–2.7): runtime not superuser, BYPASSRLS, CREATEROLE or CREATEDB; it reaches
  only `semester_api`; it owns no protected table. There are no `true` policies, no SECURITY DEFINER
  functions and no views. Writes are limited to `app.tasks` (UPDATE on title, state and due_at only).
  **Documented exceptions:** `iam.roles`, `iam.capabilities` and `iam.role_capabilities` have RLS off.
  They are global, read-only catalogs, as the document allows.
- `rls/api` (auth.ts, database.ts, limiter.ts, app.ts): **37 / 37 tests pass**, and `tsc --noEmit` is clean.
  - JWT, 10 tests: valid token; missing token; expired; older than maxTokenAge; wrong issuer; wrong
    audience; foreign key; `alg: none`; non-UUID subject; role claims are not promoted.
  - Token bucket against real Redis, 6 tests: burst; one budget shared by two connections under 20
    concurrent calls; refill; scope isolation; idle expiry; invalid configuration.
  - Database and HTTP, 21 tests: every row of the document's §12 table. Also, through the real route,
    a signed token claiming admin is still refused (403); a denied caller consumes no tenant budget;
    429 sets Retry-After; a limiter outage returns 503 rather than unlimited access.
- **Mutation controls.** Each broke exactly the test meant to catch it, then went green when restored:
  removing the audience check; removing the pre-limit membership check; making the limiter fail open;
  letting the runtime reach `semester_owner`.
- **Defects found in the document's code:**
  1. `type VerificationKey = Parameters<typeof jwtVerify>[1]` resolves to jose's function-only overload.
     Passing a public key, as the document's own tests do, fails typecheck. Fixed in `auth.ts`.
  2. The document needs a runtime login that inherits `semester_api`. The test login is NOINHERIT and runs
     `SET LOCAL ROLE semester_api` in `withTenant`, which proves the login holds nothing by itself.
     Either choice works; it must be decided in deployment.

## Not verified (still open)
- Remote JWKS fetching, key rotation and an unavailable key set: no Semester identity provider exists.
- Edge gateway: TLS, IP limits, trusted proxy, CORS/CSRF, webhook raw-body parsing.
- Search, files, reports, exports, cache and support-tool paths (§2.8 rows beyond base tables).
- Audited commands, transactional outbox, idempotency on mutation routes.
- Query plans at real tenant size; backups and restore; alerts; independent security review.
- Adapting to the repository's existing 254 migrations; nothing here has been run against them.

## Third document: simulator results and load testing (owner upload, 2026-10-22)
- **Simulation reproduced** (`rls/api/bench/simulation.py`). The token-bucket figures match exactly:
  1,200 / 1,299 / 1,299. The sliding-window figures fall within 4 of the document's 1,200, depending on
  whether the window boundary is inclusive. As the document says, this compares algorithms only.
- **Real load test** (`rls/api/bench/load.ts`). The actual route ran on two API instances sharing one
  Redis and Postgres, with 32 concurrent clients, two synthetic users and signed tokens claiming admin.
  - Steady load, 6 s: 2,594 offered, 114 admitted against a budget of 120, the rest 429. The budget is
    shared exactly across both instances: 64 in the first second (burst), then 10 per second
    (2 users × 5/s). p50 62 ms, p95 130 ms, p99 566 ms (local, single host).
  - Redis restart mid-run, without persistence: about 1 s of 503 (fail closed, none unlimited). Buckets
    reset, so the full burst was granted again: **196 admitted against a budget of 150**.
  - Same run with AOF (`appendfsync always`): **148 admitted against 150**. The reset is gone.
  - **Requirement:** production Redis for rate limiting must run with persistence, or budgets reset on
    restart or failover.
- **Defect found:** `import { Pool } from "pg"` throws at startup under plain Node ESM, because pg is
  CommonJS. The document's `server.ts` would crash on boot in an ESM project. Use
  `import pg from "pg"; const { Pool } = pg;`. Vitest hides this, so the unit tests cannot catch it.
- Not measured: CPU per instance, multi-host network latency, Redis failover (as opposed to restart),
  and the Alice/Alex/Bob checks through the **published** Zite login with separately signed-in users.

## Registrar registration command (registrar brief §2.4 and §2.7, 2026-10-22)
**Why it is here and not in Zite:** the Zite build has no section capacity at all (Sections have no
capacity field, and `staff.setEnrollment` checks none). Zite also cannot enforce capacity atomically:
its SQL is read-only and there is no conditional write (capability rows 20 and 21). The brief says:
"put this one command behind a transactional backend API." So it is built in the verified Postgres layer.

- `rls/migration_007_registrar.sql`:
  - `app.course_sections` has a `check (enrolled_count <= capacity)` constraint.
  - Request state and enrollment state live in separate tables (`app.registration_requests`,
    `app.enrollment_records`), as the brief requires; nothing is folded into one status field.
  - A partial unique index allows one live enrollment per student per section.
  - `app.submit_registration(section, idempotency_key)` locks the section row (`FOR UPDATE`),
    re-checks the key after taking the lock, and returns `enrolled`, `already_enrolled`,
    `capacity_unavailable` or `section_closed`.
  - The function runs as `semester_cmd`: no login, no BYPASSRLS, not reachable by the runtime login.
    RLS still applies to it, scoped to the caller's own tenant and user. The runtime has SELECT only
    on these tables.
- `rls/api/tests/registrar.integration.test.ts`, run as the real runtime login: **10 / 10 pass**, on
  3 consecutive runs.
  - 40 concurrent students for a 10-seat section: exactly 10 enrolled, 30 `capacity_unavailable`;
    the count and the live rows agree.
  - 10 concurrent retries with the same key: one request, one enrollment.
  - A new key for a held seat returns `already_enrolled`. Reusing a key for another section is refused.
  - Full and closed sections are rejected and their counts don't change.
  - Cross-tenant attempts are denied both ways.
  - The runtime cannot change counts or insert enrollments directly. Students see only their own
    enrollments. A revoked member cannot submit. The runtime cannot `SET ROLE semester_cmd`.
- **Mutation control:** removing `FOR UPDATE` fails both concurrency tests; restoring it passes 10 / 10.
- After the migration, the full suite passes: 47 Vitest tests and 28 SQL checks. The audit (§2.6) now
  lists exactly one SECURITY DEFINER function, `app.submit_registration`, which has been reviewed.
- Not built here: waitlists and offer expiry, overrides, prerequisite and hold evaluation, drop and
  withdraw, and the registrar's approval step. The command shows the integrity core only.

## Full-stack brief (registrar §3, tuition §8–9) and remediation briefs (2026-10-22)
**Registrar schema from the brief** (`rls/migration_008_registrar_doc.sql`), transcribed verbatim:
- **Defect:** the migration fails as written. It runs `set local role semester_owner` and then
  `create schema`, but that role has no CREATE privilege on the database. Minimal fix: create the
  schema first, then switch role.
- `rls/api/tests/registrar-doc.integration.test.ts`: **10 / 10** under the runtime login. All seven
  §9 checks pass:
  - students see only their own enrollments and grades;
  - grade revisions are kept and unique;
  - tenant spoofing is denied;
  - cross-tenant foreign keys are rejected;
  - the runtime cannot write;
  - 20 concurrent claims on the last seat produce exactly one success.
- Mutation control: one `using (true)` policy on grades makes the grade-privacy test fail.
- **Three findings in the brief's schema**, asserted by tests so they stay visible:
  1. Students cannot read the catalog (terms, sections). The brief's `catalog.read` route needs a policy.
  2. `unique (tenant, student, section)` stops a dropped student getting a new enrollment row;
     re-adding must reactivate the row instead.
  3. A grade correction can supersede another enrollment's grade; the chain is not enforced.

**Tuition payments** (`rls/migration_009_tuition.sql`, `rls/api/src/webhook.ts`):
- Separate `semester_webhook_login`, whose only right is to execute `apply_provider_event`.
- Receipts are deduplicated on (provider, account, event id).
- States only move forward; a confirmed payment can only become refunded.
- Amount or currency mismatches go to `reconciliation_required`.
- The ledger is append-only, with at most one payment per operation and one refund per event.
- The webhook verifies an HMAC signature over the raw body, with 5-minute replay tolerance and a
  constant-time comparison.
- `tuition.integration.test.ts`: **12 / 12**, covering §9's tuition list: forged signature, replay,
  duplicate delivery, re-sent success, reordering, wrong currency and amount, partial payment, refund
  kept as a separate entry, unknown provider account, students unable to post, idempotent initiation.
- Mutation controls: disabling the signature check fails 5 tests (a forged payment was posted);
  removing the forward-only rule fails the reordering test.

**Append-only, tamper-evident audit and transactional outbox** (`rls/migration_010_audit_outbox.sql`):
- A trigger refuses UPDATE, DELETE and TRUNCATE, including from the table owner.
- Each row's SHA-256 hash covers the previous hash. A transaction-scoped advisory lock keeps the chain
  linear. `platform.verify_audit_chain()` returns the first altered row.
- Registration now writes request, enrollment, audit and outbox in one transaction.
- `audit.integration.test.ts`: **9 / 9**:
  - an injected audit or outbox failure leaves no request, enrollment or seat change;
  - retries add no audit rows;
  - the runtime has no access to audit or outbox;
  - the owner cannot edit or delete;
  - 40 concurrent writers keep one unbroken chain;
  - an edit by someone who disables the trigger is detected at that row.
- **Honest limit:** a superuser can still rewrite the whole chain. Independent retention (an exported
  head hash or a write-once store) is still required, as the briefs say.
- **Mutation control, and a probe error found and fixed:** the first chain test drove all writes through
  one section, so the section lock alone serialized them and removing the audit lock changed nothing.
  A direct 40-writer test was added. With the audit lock removed it fails (fork); restored, it passes.

**Totals after migrations 001–010:** 78 Vitest tests and 28 SQL checks pass; `tsc --noEmit` is clean.

**Audit coverage gap found and fixed.** `audit.sql` only scanned `iam` and `app`. It now scans every
application schema. Documented exceptions:
- `iam` catalogs and the `platform` tables have RLS off, and no application role has any grant on them.
- Seven `true` policies are scoped to `semester_payments_cmd`. Provider events carry no user, so scope
  comes from `provider_accounts`; the role is reachable only through `apply_provider_event`, which only
  the webhook login may execute.
- Three SECURITY DEFINER functions, all reviewed: `submit_registration`, `apply_provider_event`,
  `append_audit`.

## Private files (security blueprint §1–2, 2026-10-22)
This addresses the blocker "uploaded files can be downloaded by anyone who has the link", in the
verified layer. Zite's own uploads stay public-by-link and now carry a warning.

- `rls/migration_011_files.sql`:
  - File metadata lives in `platform.files` under FORCE RLS. A file is visible only to its owner, or to
    a named grantee whose grant is live, unrevoked and unexpired (at most 180 days).
  - Only the owner can grant, and only on their own file.
  - Storage keys are 256-bit random hex, with no names or ids.
  - `platform.file_link_lookup` is the one path that reads metadata without a user. It answers for an
    exact key and runs as its own role, `semester_files_cmd`.
- `rls/api/src/files.ts`:
  - Downloads are authenticated and re-check the row policy on every request. A file that isn't
    visible returns 404 with no metadata.
  - Signed links (60 s, one object, HMAC with a constant-time comparison) are minted only after that
    check and are never stored.
  - Upload type is decided from the bytes; the extension and the content-type header are ignored.
    Uploads are capped at 10 MB and filenames are sanitized.
  - A rejected upload leaves no stored bytes.
  - Allow and deny decisions are logged without tokens, signatures or contents.
- `files.integration.test.ts`: **15 / 15**, the blueprint's §2 matrix:
  - anonymous request denied; own file allowed;
  - another student's file id denied, and another institution's denied (both tenant ids tried);
  - staff without a grant denied, even with an admin claim in the token;
  - an explicit grant allows, then revocation denies on the next request; an expired grant denies;
  - a student can't grant on someone else's file;
  - a member removed mid-session is denied;
  - a signed link works only for its own object, expires and can't be forged, and is only minted
    after authorization;
  - a raw storage path is unreachable;
  - an executable named `.pdf` is refused, as are 10 MB + 1 byte uploads and path-traversal names;
  - uploading into another institution leaves no orphaned file;
  - logs contain no secrets.
- Mutation controls: ignoring grant expiry fails 2 tests; skipping the signature comparison fails 1.
- Limit (as the blueprint says): a signed link is a bearer capability until it expires, so keep the
  TTL short. Not built here: malware scanning, an alert on repeated denials, a real object store.
- **Totals after migrations 001–011:** 93 Vitest tests and 28 SQL checks pass; `tsc --noEmit` is clean.
  The audit lists 4 reviewed SECURITY DEFINER functions.

## Mapping to the current Zite build
**Zite has no DB-level RLS** (capability assessment #4). The Zite app enforces the same rules in endpoint code.

| Document rule | Zite today | Gap |
|---|---|---|
| Identity from verified token, never from the client | `context.user.id` from Zite auth; no client-supplied role or tenant is read | none |
| Current membership checked per request | `requireAccess` reloads memberships every call and requires `Active` | no `valid_until`; institution suspension is not checked |
| Tenant scope on every query | `tenantScope()` + `inSet()`; this pass also fixed `learn.canTeach`, `learn.teach` and `progress.verify` | code-level only, so one missed query leaks |
| Capabilities, not roles | roles array on membership (Student, Faculty, Advisor, Staff, Administrator) | no capability table; no workspace-scoped assignment |
| Owner-only private content | checked per endpoint (drafts, resources, messages, slots) | — |
| Expected version / optimistic concurrency | not implemented | no transactions in Zite (#1) |
| Staff do not get blanket read_any | advisor access is by student share (`advisorShare`) | registrar and affairs queues are role-wide inside a tenant |

## Recommendation
Records from real institutions need the database layer, not only endpoint checks.

1. Keep the Zite build as the synthetic-data demo.
2. Put the verified baseline behind the Semester API in the GitHub repository. Adapt it to the existing
   254 migrations; do not copy it as-is.
3. Have Zite call only that API.

This is a decision for the owner, not something to change unilaterally.
