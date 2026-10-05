# Security gap analysis

Baseline `origin/main` `c029822`, 27 Sep 2026. This is a read-only review. No
secret values appear in this document. Every finding is marked **Evidenced**
(read in source at the cited path) or **Suspected** (inferred, and needs
confirming). The four highest-severity rows (S-1, S-2, S-3, S-4) were
re-read in source by hand after the first pass.

## What is already strong (preserve)

- **RLS is the authorization boundary** (ADR 0002). An `ensure_rls` event
  trigger (`supabase/migrations/20260901000100_schema.sql`) enables RLS on
  every new table, and all 98 created tables have it on. Tables without
  policies are deny-all, with privileges revoked.
- **Capabilities, not roles.** Policies call `private.has_capability()`
  (`SECURITY DEFINER`, `search_path=''`). Clients cannot write `role_grants`,
  and grant changes are audited by trigger.
- **Tenant pinning.** `profiles.school_id` is not client-writable
  (`20260921211500_pin_profile_school.sql`).
- **Policies are tested as a second account.** `supabase/check.sh` runs 36
  `*.check.sql` suites against a disposable, socket-only Postgres, in CI.
- **Aggregates refuse n < 10** by check constraint (#762).
- **Secrets hygiene.**
  - Gitleaks runs on the diff and on the whole tree in CI (`.github/workflows/ci.yml`, `.gitleaks.toml`).
  - `npm audit --audit-level=high` runs in CI, and Dependabot covers `/app` and Actions.
  - `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are server-only names.
- **Institutional gateway** (`app/server/institution/gateway.ts`):
  - single-origin allowlist
  - network-verified bearer token
  - membership check
  - 60 requests/min per identity
  - 128 KB body cap
  - 20 s adapter timeout
  - encrypted journal
  - prepare → confirm → commit writes
- **Edge-function SSRF guards** in `fetchcal` and `canvas`; the `push` function refuses to run without `CRON_SECRET`.

**Secret scan at audit time.** A regex sweep of tracked files found no real
keys, private keys, JWTs or `sk-ant-` keys. The hits were name references,
Postgres role names, synthetic test fixtures, and the `sb_publishable_` key in
`app/.env.production`, which is public by design. Gitleaks is not installed in
this environment, so the CI job is the authoritative scan.

## Gaps

Severity reflects the current exposure: a live public app with pilot-scale
use.

| ID | Sev | Area | Finding | Evidence | Recommended fix | Phase |
|---|---|---|---|---|---|---|
| S-1 | **High** | AI boundary | The `claude` edge function forwards the caller's raw request body upstream. Any signed-in user picks model, `max_tokens` and tools. The cap counts calls (default 60/month), not tokens or cost, and the provider total is uncapped (`SECRETS.md`). | Evidenced: `supabase/functions/claude/index.ts` (`const body = await req.text()` → `fetch(ANTHROPIC, { body })`) | **Fixed on `feature/ai-gateway-clamp` (BL-1.0)**: `supabase/functions/_shared/clamp.ts` allowlists the app's four models, clamps `max_tokens` to 16 000, keeps only client tools + web search (≤5 uses), drops every other field, refuses >24 MB, and runs before the meter. Guarded by `app/src/lib/claudeclamp.test.ts`. Decision D-030. Still open: metering by estimated cost rather than calls | 1 (pre-pilot) |
| S-2 | Med | Account deletion | `deleteEverything` deletes per-table rows from the client and signs out. The `auth.users` row (email) is never deleted, and partial failure falls back to "email the owner". | Evidenced: `app/src/lib/cloud.ts:1000` | Add a server-side erasure function (edge function using the service role) that deletes the auth user after the owned rows. Keep the `data_requests` trail. **Built: `erase_account` (migration 20260929010000) and the `delete-account` function; live once the migration is applied and the function deployed** | 2 (membership/deletion) |
| S-3 | Med | Client credential | `VITE_TURN_PASS` is compiled into the public bundle as a static TURN credential. | Evidenced: `.github/workflows/pages.yml:148`, `app/src/lib/rtc.ts:90` | Issue short-lived TURN credentials from a function (TURN REST API shared-secret scheme) | 7 |
| S-4 | Med | BYO AI keys | Student-supplied keys are used browser-direct (`anthropic-dangerous-direct-browser-access`). Any XSS exposes them. | Evidenced: `app/src/lib/claude.ts:917,1300`; key storage location Suspected (localStorage) | Keep, but document it in the AI Controls page. Tighten CSP (S-6) | 3 |
| S-5 | Med | Session | supabase-js `persistSession: true` keeps the session token in localStorage, so CSP is the only XSS mitigation. No global sign-out lever (`SECURITY.md`). | Evidenced: `app/src/lib/cloud.ts:62` | Document a revoke-all runbook step. Consider a shorter JWT expiry. Fresh-auth for high-risk actions | 7 |
| S-6 | Med | Headers / CSP | The load-source CSP is a `<meta>` tag in `app/index.html`, and **GitHub Pages — the production host today (`.github/workflows/pages.yml`) — cannot send a response header of any kind**. So production still has no `frame-ancestors` (clickjacking), no HSTS, no `report-to`, and `style-src 'unsafe-inline'` stays (Mermaid needs it). **Partly addressed in-repo by #896:** `app/vercel.json` (all routes) and `app/public/_headers` (Netlify / Cloudflare Pages) now carry HSTS (1 year, includeSubDomains), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, a `Permissions-Policy` derived from the features the code calls, and a header CSP with `frame-ancestors 'self'` plus the LMS origin — not `'none'`, and no `X-Frame-Options: DENY`, because LTI opens the app inside the LMS iframe and either would break every school launch. `base-uri`, `form-action` and `object-src 'none'` are already in the meta policy. `app/src/lib/hostheaders.test.ts` fails if HSTS or `frame-ancestors` is dropped, if the two files disagree, or if the header CSP starts duplicating load sources (two policies intersect). | Evidenced: `app/index.html`, `app/vercel.json`, `app/public/_headers`, `.github/workflows/pages.yml` | **Not closed until production is served from a host that reads one of those files** (Vercel, Netlify or Cloudflare Pages — needs the owner's approval: production host change) **and a probe of the live response shows the headers.** `report-to` also needs a collector endpoint that does not exist. Until the move, record it as an accepted risk | 7 |
| S-7 | Med | Auth config | Email confirmation, providers, MFA, password policy and auth rate limits live only in the Supabase dashboard. `supabase/config.toml` has no `[auth]` section. | Evidenced | Capture the settings as `[auth]` in `config.toml` (reviewable), or as a checked dashboard export | 1 |
| S-8 | Med | Object authz | No advisor→student share model exists; `academic_advisor` is a role with no share table. | Addressed on `feature/advisor-meeting-mode` (Phase G), not yet merged or applied | `advisor_shares` + `advisor_share_events` (`20260928301000_advisor_shares.sql`): school-scoped advisor lookup, required expiry ≤ 120 days, one-way revocation, logged reads, no link-sharing (D-016, D-042); `supabase/advisor.check.sql` (45 checks) | 1→4 |
| S-9 | Med | Object authz | `data_request:handle` and `review:moderate` are checked at platform scope, so a holder sees every tenant's `data_requests`. | Evidenced: `supabase/migrations/20260926150000_expansion_roles_and_features.sql` ~L662, ~L1200 | Confirm this is intended (platform DPO). If not, scope it to the tenant | 5 |
| S-10 | Med | Rate limits / SSRF | `fetchcal` and `canvas` are authenticated fetch proxies with no per-user rate limit. The private-host guard is name-based, so DNS rebinding is not blocked (the code says so). | Evidenced; exploitability Suspected | Per-user rate limit through the existing rate-limit table. Pin resolved IPs if the runtime allows | 7 |
| S-11 | Low | Multi-tenant | `private.verified_student()` hard-codes `@vanderbilt.edu`. | Evidenced: `20260901000200_classmates.sql` | Read domains from `schools.email_domains`. Consistent with D-007 until a second school | 5 |
| S-12 | Low | Timing | `push` compares `CRON_SECRET` with `!==`. | Evidenced: `supabase/functions/push/index.ts:80` | Constant-time compare | 7 |
| S-13 | Low | Storage | No Storage buckets or `storage.objects` policies exist; files are device-only. Any future bucket starts unprotected. | Evidenced | Require a policy + check suite in the same migration as any bucket (add to the ADR 0002 checklist) | 3 |
| S-14 | Low | Dependency scanning | No CodeQL. Dependabot does not cover Deno imports in `supabase/functions`, `video/` or `packages/`. | Evidenced; Deno coverage Suspected | Add CodeQL for JS/TS. Pin Deno imports | 7 |
| S-15 | Ops | Recovery | Restore has never been drilled (`RESTORE.md`: RPO/RTO "not yet measured"). Staging steps 2–4 have never been run (`STAGING.md`). The rotation log is empty (`SECRETS.md`). There is a single owner. | Evidenced | Phase 7: restore drill, staging proof, first rotation, named backup owner | 7 |
| S-16 | Ops | Retention | `invites` never expires, and abandoned accounts are kept forever (`RETENTION.md`). | Evidenced | Retention clock for `invites`; dormant-account policy | 7 |

## New-surface rules for Phases 1–6

1. A new table ships with RLS, a two-account check suite, a `RETENTION.md`
   entry, and an `OWNED_TABLES` entry if the client writes it.
2. A new server route follows the gateway pattern: allowlisted origin, verified
   token, membership, rate limit, body cap, and prepare/confirm for writes.
3. Nothing new reads a secret through `VITE_`. `app/src/lib/secrets.test.ts`
   and gitleaks guard it.
4. AI features route through a server boundary that clamps model and size.
   No new feature may depend on S-1 being open.
5. Exports and shares show a full preview and need explicit confirmation.
   Time-bound shares need an expiry column and revocation.
