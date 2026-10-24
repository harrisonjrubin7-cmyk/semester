# Zite capability assessment against Semester's requirements

Assessed 22 Oct 2026 while building in the Education OS workspace. Classifications use the context brief's vocabulary:
**supported directly** · **supported through verified integration** · **requires external backend** · **unsupported** · **not yet verified**.
"Observed" means seen working in this workspace today; "Docs" means only the platform documentation says so.

| # | Requirement | Classification | Evidence and consequence |
|---|---|---|---|
| 1 | External-user authentication | Supported directly | Observed. External apps sign in by email link or Google (`authentication` in each app's `zite.config.json`). Sign-up is currently **open** on the Semester app. Decide whether to restrict before any real data. |
| 2 | Institutional SSO (SAML) | Not yet verified | Config exposes `"sso": false`. Whether Zite can act as a SAML service provider for a university IdP is unverified. Pilot contract item. |
| 3 | Verified roles and scoped permissions | Supported directly (in app code) | Observed. Endpoints run server-side and check the Memberships table (`requireAccess`, `tenantScope`). There is no platform RBAC for external users; every rule lives in endpoint code. Role changes need a second approver (approvals.ts). |
| 4 | Database constraints | Unsupported (beyond field types) | Observed. Tables support typed and linked fields; no unique or check constraints are exposed to the tools. Uniqueness ("one open regrade per course") is enforced in endpoint code and can race. |
| 5 | Row-level / server-side isolation | Supported directly (server-side only) | Observed. Browsers cannot query tables; only endpoints can. There is no database RLS: isolation depends on every endpoint filtering correctly. Seven leaks were found and fixed today; a structural check across endpoints is still needed. |
| 6 | Transactions | Unsupported | Observed. Each write is its own call; there is no multi-record transaction. Mitigation: audit-before-write ordering, idempotent re-runs, and `bulkCreate … matchOn` upserts. A failure mid-sequence can leave partial state. |
| 7 | Secret storage | Supported directly | Docs. Settings → Secrets, read as `process.env.ZITE_*`. Integration credentials are injected server-side (`integrations.get`). |
| 8 | Signed webhook verification | Not yet verified | Docs: webhook triggers are set up in the editor. Signature verification for payment and SIS events is unverified. |
| 9 | Background jobs | Supported directly | Docs: schedules on endpoints. Not used yet. |
| 10 | Retries and dead letters | Not yet verified | No documented dead-letter mechanism was found. A durable outbox would need a table plus a scheduled worker endpoint. |
| 11 | Audit records | Supported through app table | Observed. An Audit Events table is written by endpoints. It is **not append-only**: workspace editors can change rows in the database UI. Platform publish logs exist (Docs). |
| 12 | File permissions | **Unsupported for private files** | Observed. Uploaded files get `files.zite.com/...` URLs that downloaded **without authentication** in this session. Unguessable but public, so not suitable for transcripts, case documents or other student files without an external permissioned store. |
| 13 | Migrations and versioning | Partly supported | Code is versioned in git with build snapshots, and publishing keeps versions and rollback (Docs). Schema changes are made through tools/UI, not versioned migrations. Changes made today are recorded in commit messages. |
| 14 | Automated testing | Supported through sandbox scripts | Observed. No built-in test runner or CI. Added `apps/semester/tests/run.sh` (esbuild + node, pure logic) and runtime probes via one-off scripts. Neither runs automatically on commit. |
| 15 | Export and source ownership | Supported directly | Observed. The workspace is a git monorepo readable from the sandbox. Mirrored to GitHub via pull request (see report). |
| 16 | Environment separation | **Unsupported (as used)** | Observed. Preview runs and one-off scripts use the **same live database** as published apps. There is no staging copy, so probes here wrote to, and cleaned up, live data. |
| 17 | Regional deployment controls | Not yet verified | An EU upload host exists (Docs); data residency for the database is unverified. |
| 18 | Backups and restore evidence | Not yet verified | No restore has been exercised. |
| 19 | Missing-record behaviour | Observed quirk | `findOne({ id })` on a missing record **throws** "Record not found" instead of returning undefined, so `if (!r) forbid()` guards never run. Access is still denied, but as a generic error rather than the intended message. Fix: catch NOT_FOUND in a shared helper. |
| 20 | Atomic conditional write / optimistic concurrency | **Unsupported (measured)** | Observed 22 Oct 2026: `zite.sql` is read-only ("Only SELECT statements are supported"), and `update` takes no condition. So there is no compare-and-set and no expected-version check. |
| 21 | Idempotent create (`bulkCreate` with `matchOn`) | **Not atomic (measured)** | Probe 22 Oct 2026 with synthetic records, cleaned up. Two sequential calls with the same key left 1 row (control). 20 concurrent calls left **2 rows**. It removes ordinary repeats but does not guarantee single execution. Duplicate submits and stale versions (plan Workflow 2) therefore belong in the Semester API; the verified baseline passes "exactly one wins". |
| 22 | Custom access rules: fallback and session caching | Not used | Semester does not rely on Zite custom access rules. Every endpoint reloads the caller's membership on each call (`requireAccess`), so there is no cached session decision. App sign-up is `open`; a signed-up user with no Active membership is refused by every endpoint (deny by default). |
| 23 | Revocation delay | Per request (by design) | A membership set to non-Active fails the next endpoint call. This follows from the code; it has not been measured against the published app with a live session. |
| 24 | Zite workflows: runner permissions, run history, secret redaction | Not used / not yet verified | Server endpoints are used instead of editor workflows, so workflow history and "Run as user" have not been exercised. |
| 25 | JWT issuer/audience/expiry/signature | Not applicable inside Zite | Zite issues and checks its own sessions. Verifying a third-party JWT belongs in the Semester API; that middleware passes 10/10 tests in `rls/api`. |
| 26 | Distributed rate limiting | Unsupported natively | The public request form throttles by counting rows (3 per email per hour). That is not atomic, so treat it as abuse reduction, not a guarantee. The Redis token bucket is verified in `rls/api` (6/6 tests) and belongs at the API gateway. |
| 27 | Testing with unauthorized users | Supported through scripts | Cross-tenant probes used a temporary second institution and a control (7 leaks found and fixed). Not yet repeated through the published login flow with real sessions. |

## What this means for Semester
- **Fine on Zite now (with synthetic data):** the public site, the education product UI and its endpoints, the Institution Console, the internal Company OS, the planning simulator.
- **Needs an external backend or service before real student records:** private file storage (12); a staging environment (16); database-level isolation, or a structural endpoint check (5); transactional writes for billing and registration (6); signed webhooks and a durable outbox for SIS sync and payments (8, 10); append-only audit (11); verified SAML SSO (2); restore evidence (18).
- **Rule kept:** no server-side control is replaced by hidden buttons or client-side checks. Every guard added today is in an endpoint.
