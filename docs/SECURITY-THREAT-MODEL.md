# Security threat model — whole platform

Full-beta Milestone 1. Written 30 Sep 2026 from a read of the tree at `fd056fc`, not from a penetration test: **no adversarial testing of this platform has been done** (`docs/trust/PENETRATION-TEST-PLAN.md` is a plan). Every "Control" below names something in the tree; every "Evidence" says whether a test holds it, and where none does the row says so.

This page is the platform-wide model the audit found missing. It does not replace the narrower ones: [INTEGRATION-THREAT-MODEL.md](INTEGRATION-THREAT-MODEL.md), [ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md](ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md), and the incident-oriented [SECURITY.md](../SECURITY.md).

## What is being protected

1. A student's academic and personal work (courses, notes, files, AI conversations, plans).
2. Education records an institution shares (identity, enrolment, grades, aid) — none flows in production today (no production adapters).
3. Billing state and entitlements.
4. The integrity of authorization itself: who may read whose data.
5. Availability of sign-in, sync and the AI proxy.

## Trust boundaries

| # | Boundary | Assumption |
| --- | --- | --- |
| B1 | Browser ↔ Supabase (PostgREST, Auth, Storage) | The client is hostile. It holds only a publishable key (ADR 0002). |
| B2 | Browser ↔ edge functions | Each function authenticates itself (`verify_jwt = false` on all thirteen; auth is in code). |
| B3 | Edge functions / gateway ↔ Postgres | Service-role access; never exposed to the client. |
| B4 | Semester ↔ Stripe | Stripe state enters only through a signature-verified webhook. |
| B5 | Semester ↔ AI providers | Provider output is untrusted text; uploaded material is untrusted input. |
| B6 | Semester ↔ institution systems (SSO, SCIM, LTI, SIS) | Not live for any real institution. |
| B7 | Operator ↔ student data | No unrestricted browsing; support access is student-approved, purpose-limited, time-limited, audited. |
| B8 | Device storage (localStorage, IndexedDB) | Readable by any script running in the origin. |

## Threats by category (STRIDE)

Status: **Held** = a control exists and a test in the tree would fail without it. **Partial** = control exists, test coverage or scope is incomplete. **Open** = no control, or nothing in the tree shows it works.

### Spoofing

| Threat | Control | Evidence | Status |
| --- | --- | --- | --- |
| Forged JWT to an edge function | Each function verifies the token itself; `push` and `integration-tick` check a bearer secret and refuse when it is unset | function tests; fail-closed 503 paths | Partial — no live probe of a deployed function |
| Forged Stripe event | HMAC-SHA256 over `t.rawBody`, constant-time compare, 5-minute tolerance, body cap, Origin refused | `billing/webhook.test.ts` | Held |
| SSO assertion replay / wrong IdP | Supabase Auth SSO, one provider per tenant, first login binds to a SCIM membership | `institutional-foundation` suites | Open for real IdPs — never exercised against one |
| LTI launch forgery | state and nonce store, `iss`+`client_id`+deployment binding, JWKS signature check | `lti` function tests | Partial — an unbound registration answers `allowed-unbound` |
| Account takeover through password reset | Same neutral message for unknown addresses; recovery link opens the app's own password dialog under one shared floor (M1) | `AccountSecurity.test.tsx` | Partial — no rate limit in the repo; sign-in limits are Supabase defaults |
| Stolen session on another device | "Sign out other devices" behind a confirmation (M1) | test with fakes | Partial — no session list |

### Tampering

| Threat | Control | Evidence | Status |
| --- | --- | --- | --- |
| Reading or writing another user's rows | RLS on every table; ownership by `auth.uid()`; capability checks by `private.has_capability` | `rls-coverage`, `integration-rls-matrix`, `definer-sweep`, per-feature suites (78 `*.check.sql`) | Held for what the suites cover; tenant scoping of classmates/rooms/groups is **open** (G-03) |
| Client writing its own audit history | `audit_event` has no client write path; recorder is service-only (M1) | `audit-and-subject-requests.check.sql` (22 checks) | Held |
| Editing or deleting audit evidence | immutability triggers; purge only through the retention sweep past three years | same suite; `retention-sweeps.check.sql` | Held |
| Privilege escalation through a `security definer` function | pinned `search_path`; every callable definer function is called by a zero-privilege account | `definer-sweep.check.sql`; register DR-02 notes object-id (BOLA) cases are left to feature suites | Partial |
| Changing a protected column (school, age) | column-pinning triggers | `tenancy`, `minimum-age` suites | Held |
| Tampering with content in transit to the AI | none beyond TLS | — | Open |

### Repudiation

| Threat | Control | Evidence | Status |
| --- | --- | --- | --- |
| Staff deny a data access | `support_access_event`, `console_action_record`, break-glass review | `support-access`, `console-approvals` suites | Held |
| No common trail across features | `audit_event` envelope (M1) has **two** producers; about twelve older audit tables are separate | — | Partial (G-04) |
| Request handled and not recorded | `data_subject_request` with due date (M1) | suite | Partial — nobody is named to answer them |

### Information disclosure

| Threat | Control | Evidence | Status |
| --- | --- | --- | --- |
| Cross-tenant read | `tenant_id` foreign keys on ~43 tables; capability scoped to a school | `integration-rls-matrix`, `tenant-*` suites | Partial (G-03) |
| Small-cell re-identification in aggregates | `n >= 10` CHECK constraints and `HAVING` on demand and outcome data; campaign report suppresses under 10 | constraints in migrations | Partial — no complementary suppression or protection against overlapping cuts (G-24) |
| Secrets in the repo | gitleaks in CI; publishable key only in the client; secrets listed in `SECRETS.md` and checked by `secrets.test.ts` | CI job `secrets` | Held; rotation log is empty |
| OAuth tokens stolen from the browser | narrowest scopes; tokens kept in `localStorage`; provider-side revoke on disconnect | `oauthscopes`, `revoke.ts` | **Open** — plaintext in storage, exposed to any XSS (G-22) |
| Prompt injection exfiltrating data | untrusted text fenced in `<material>` tags with a fixed data rule | `injection.test.ts` (structural) | **Open** for live models — the red team is "still owed" (G-14) |
| PII in logs and telemetry | gateway logs ids, route, status, error class; audit stores pseudonyms; detail capped at 2 KB | code; suite | Partial — no client error capture to review |
| Minors' exposure to strangers | age gate (13+), minors kept off discovery, matching, messaging | `minimum-age.check.sql` (63 checks) | Held; accounts that never stated an age are treated as minors |
| Export file left on a shared device | export is a client-side download | — | Open (no expiry, by nature) |

### Denial of service

| Threat | Control | Evidence | Status |
| --- | --- | --- | --- |
| AI cost abuse | monthly per-account call cap (default 60), request clamps, kill switch | `claude` function, `aikillswitch` test | Partial — flat count, not cost-based |
| Open proxies (`canvas`, `fetchcal`) | SSRF guard, size and time bounds | function tests | Partial — signed-in accounts unthrottled beyond the platform |
| Abuse of anonymous forms | origin allowlist, salted IP hash, `site_lead_hits` rate limit | `lead-intake` | Held for that function |
| Sync storm / deadlock | serialized plan save (main, `20260929350000`) | load test noted in that commit | Partial |
| Backup absent or unrestorable | CI logical-dump rehearsal | `restore.sh` | **Open** — production has never been restored (D-126) |

### Elevation of privilege

| Threat | Control | Evidence | Status |
| --- | --- | --- | --- |
| Self-granting a role | `role_grants` writable only by trusted services; grants audited | `role-grant-audit.check.sql` | Held |
| Staff gaining student data without consent | support access needs an active consent record, one scope, ≤7 days, two people, every view logged | `support-access` suite | Held |
| Emergency access misuse | break-glass: two-party approval, ≤4 hours, post-hoc review | `console-approvals.check.sql` | Held |
| Admin changing their own plan or limits | plan and tier writable by the service role only | `tenant-plan.check.sql` | Held |
| Feature enabled for an ineligible tenant or cohort | tenant feature policy with role and release-cohort limits; kill switches | `flags.test.ts`, main's `feature_cohorts` suites | Held for what is tested |

## Top risks, in the order I would fix them

1. **Tokens in `localStorage`** with no server-side encryption or revocation cascade (G-22).
2. **Live prompt-injection and evaluation not run** while AI is on for students (G-14, G-15).
3. **Tenant scoping of rooms and groups** is open by an earlier decision (G-03) — the owner's call.
4. **No alert reaches anyone** (`MONITORING.md`), so a failure can go unseen; no client error capture.
5. **Production never restored**; the gateway journal has no backup.
6. **No adversarial test** of any of this. Everything above is a reading of code and CI suites.

## What would change this page

A penetration test, a live restore drill, the red-team run, a connected real IdP, or any new boundary (a production adapter, file storage in M5, Stripe going live in M6). Re-run this model at the end of Milestones 5–8.
