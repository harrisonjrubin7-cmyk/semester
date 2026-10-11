# Penetration Test Plan

**No external penetration test has been performed.** This is the plan for the
first one: what an independent tester is asked to attack, under what rules,
with which accounts, and what Semester commits to do with the findings. It is
written so that a firm can quote from it and a university reviewer can see what
will be tested. It is not evidence that anything has been tested, and no
document in this repository should cite it as such. The master register row
SEC-005 is `designed` on the strength of this file and cannot move further
until a report is filed under `docs/evidence/`.

The internal testing that does exist — the row-level security suites under
`supabase/` run by `supabase/check.sh`, the RLS sweep in
`supabase/rls-coverage.check.sql`, the secret scans in
`.github/workflows/ci.yml` — is Semester testing itself. It is what makes an
external test worth paying for, and it is not a substitute for one.

## Scope

In scope, against a **non-production** Supabase project built from this
repository's migrations (see *Environment*), and the matching app build:

| Target | What it is | What the tester is asked to try |
| --- | --- | --- |
| The web app | The static React build (`app/`), as served by the production host | XSS in every place user text is rendered (notes, Mermaid diagrams, community posts, study guides), CSP bypass given `style-src 'unsafe-inline'`, token theft from local storage, clickjacking on a header-setting host, open redirects |
| Row-level security | Every table in `public`, reached with the publishable key as `anon` and as `authenticated` | Reading or writing another account's rows; crossing tenants (school A reading school B); escalating through `role_grants`; reaching tables that should have no policy (`invites`, `access_gate`); calling `security definer` functions not meant for the API |
| RPC functions | Functions exposed through PostgREST | Argument tampering, IDOR through ids, calling service-only functions, rate-limit evasion on the direct write paths (`supabase/migrations/20260928230000_direct_rate_limits.sql`) |
| Edge Functions | `billing-cancel`, `billing-checkout`, `billing-portal`, `billing-webhook`, `calendar`, `canvas`, `claude`, `delete-account`, `fetchcal`, `productivity-sourcecheck`, `integration-tick`, `lead-intake`, `lti`, `ops-projector`, `push`, `support-reply-notify`, `trust-room` under `supabase/functions/` | Authentication bypass (each checks its own caller; `verify_jwt` is off by design), SSRF through `fetchcal`, `canvas` and `productivity-sourcecheck` including DNS rebinding (a known limit, `docs/SECURITY-GAP-ANALYSIS.md` S-10), cron-token guessing on `push` and `integration-tick`, dedicated-bearer bypass or oversized batch requests against dormant `ops-projector`, AI-budget exhaustion through `claude`, LTI launch forgery and replay, erasing another account through `delete-account` (it must take the account from the caller's token, never the body), support-recipient disclosure or notification spam through `support-reply-notify`, a forged or replayed `Stripe-Signature` on `billing-webhook`, checkout through `billing-checkout` for a tenant the caller does not own, cancelling someone else's subscription through `billing-cancel` (it must find the subscription with the caller's own token, never an id in the request), opening `billing-portal` for another person's Stripe customer (the customer id must come from the caller's RLS-scoped account, never the request), origin spoofing against `ALLOWED_ORIGIN` and `SITE_ORIGINS`, and honeypot or rate-limit evasion on `lead-intake` |
| The institutional gateway | `app/api/institution/[...path].ts` and `app/server/institution/` on Vercel | Token validation, tenant scoping, the two-phase action journal, replay of a confirmed action, rate limits |
| Auth configuration | Supabase Auth on the test project | Sign-up with the invite gate on, email enumeration, password policy, session fixation, refresh-token reuse, OAuth state handling |

**Out of scope:** production (`lzrqvlugnawcgywkhqlz`) and any real student's
data; denial-of-service and volumetric load; social engineering and phishing of
the owner; physical attacks; the infrastructure of Supabase, Vercel, GitHub,
Anthropic, OpenAI or any LMS (their own programmes cover it — see
[`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md)); a student's own accounts
at Google, Microsoft, Zoom or Apple.

## Environment

A separate Supabase project (or a preview branch) built from `main` at a tagged
commit, with every migration applied, the Edge Functions deployed from the same
commit, and the app built with `VITE_SUPABASE_URL` pointing at it. The commit
is written in the report so a finding can be reproduced against the exact code.
`STAGING.md` has how preview branches are built and what they do and do not
carry. No production secret is placed in the test environment: new keys, a new
cron secret, a test AI key with a low spend cap.

## Test accounts

Created in the test project before the window opens, and handed to the tester
through a channel other than the report:

| Account | Role | Why |
| --- | --- | --- |
| student-a@school-a.test, student-b@school-a.test | Students at school A | Same-tenant isolation: A must not read B |
| student-c@school-b.test | Student at school B | Cross-tenant isolation |
| staff-a@school-a.test | School A staff with an integration role | Staff capability boundaries |
| admin-a@school-a.test | School A tenant administrator | What an admin can and cannot reach outside their school |
| An LTI test platform registration | Institution-directed | Launch and deep-link testing |
| A trust-room reviewer grant | External reviewer | The NDA room's link and expiry |

Each account is seeded with a small, recognisable, synthetic data set so that a
successful read across a boundary is unambiguous in the evidence.

## Rules of engagement

- **Window:** agreed dates and hours, in writing, before anything starts. The
  owner is reachable throughout by the contact in [`SECURITY.md`](../../SECURITY.md).
- **Stop conditions:** the tester stops and calls the owner immediately on any
  finding that appears to reach production, real personal data, or a third
  party's systems, and on any critical finding.
- **No destructive testing** beyond the test project; no data exfiltration
  beyond what proves a finding; no persistence left behind; test artefacts
  listed in the report and removed.
- **Source access:** the tester gets read access to the repository. This is a
  grey-box test; a black-box test of an open-schema app is slower and finds
  less.
- **Confidentiality:** the report is NDA-gated and delivered through the trust
  room, not e-mail attachments.
- **Authorisation:** a signed letter from the owner authorising the named
  tester, the scope above, and the window. Vendor policies that require notice
  (Supabase, Vercel) are checked and followed before the window.

## Success criteria

The test is complete, and SEC-005 can move, when:

1. Every row in *Scope* has been exercised and the report says how.
2. The report rates each finding (CVSS or the firm's equivalent) with
   reproduction steps against the stated commit.
3. Every critical and high finding is fixed and **re-tested by the tester**, or
   formally accepted in writing by the owner with the reason and a date to
   revisit.
4. An executive summary a university can be given is filed under
   `docs/evidence/`, and the HECVAT VULN-2 and RFP answers are updated from it.

A test with zero findings is accepted only if the report shows the coverage;
an empty report is also what a test that did not look produces.

## Remediation commitments

Measured from the day the report is received:

| Severity | Fix or formally accept | Re-test |
| --- | --- | --- |
| Critical | 7 days; production exposure checked the same day | By the tester, before the next pilot starts |
| High | 30 days | By the tester |
| Medium | 90 days | In the next test |
| Low / informational | Triaged within 90 days; fixed or accepted with a reason | In the next test |

Each finding becomes an issue that links the report section, and each fix a
pull request whose description names the finding. A fix is not closed until a
guard test fails against a revert of it, which is this repository's standing
rule (`CLAUDE.md`).

## Cadence

Before the first pilot with real students, then yearly, and after any change
that moves an attack surface: a new Edge Function, a new identity path, a
change of production host, or a new institutional integration.

## Status

| Item | State |
| --- | --- |
| Firm selected | not started |
| Authorisation letter signed | not started |
| Test environment built | not started |
| Test performed | **no** |
| Report filed under `docs/evidence/` | **no** |
