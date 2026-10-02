# Go-Live Checklist

**Status: `IN_PROGRESS`** — repository controls exist, but live operational
and institutional evidence is still required before sign-off.

Every line requires evidence, not an opinion.

## Blocking

- [x] Institutional data-layer tenant isolation enforced in policy and covered
  by cross-tenant tests (`supabase/*institution*.check.sql`, evidence, policy,
  identity, journal and role-audit suites). This does not certify every legacy
  direct-to-Supabase product table for multi-tenant institutional use.
- [ ] Restore tested from backup, timed, and the restored DB passes the policy suites
- [x] Gateway journal is on the production physical-backup path: the completed
  1 October restore contained `private.gateway_audit`, the `ensure_rls`
  trigger and zero public/private tables without RLS. Production held zero
  gateway-journal rows, so recovery of a non-empty sample is not claimed.
  Evidence: `docs/evidence/restore/2026-10-02-production-physical-restore.md`.
- [ ] Error monitoring live and alerting to a named person
- [x] Hourly synthetic monitoring covers the public Pages HTML, deployed
  module/stylesheet assets and production Supabase PostgREST
- [x] Security headers are served by the Vercel production deployment at
  `https://semester-shared-core.vercel.app/`: a live HTTP 200 response carried
  CSP, HSTS, `nosniff`, referrer and permissions policies on 2 October 2026.
  GitHub Pages remains a separate unhardened path and is not the basis for this
  claim. Evidence: `docs/evidence/production/2026-10-02-production-controls.md`.
- [x] Append-only audit evidence records tenant-setting, future role-grant and
  current report-moderation status changes; isolation, pseudonymization and
  immutability checks pass
- [ ] Rate limiting on the Supabase-direct paths, not just the gateway
  - *Built, not yet live.* `supabase/migrations/20260928230000_direct_rate_limits.sql`
    puts a per-account sliding-window limit (per form for signed-out answers)
    on the fourteen tables the browser writes to that reach other people or a
    staff queue — messages, reactions, both report queues, feedback, help and
    mentor requests, community posts, communities, study sessions, groups,
    group tasks, listings, form answers. `supabase/rate-limits.check.sql` is
    the evidence in this repository. Read off the project on 29 September
    2026: the migration is applied and `zz_rate_limit` is on fourteen tables
    (communities, community_posts, community_reports, community_sessions,
    feedback, form_responses, group_tasks, groups, help_requests,
    mentor_requests, message_reactions, messages, opportunities, reports).
    The Auth dashboard was read on 2 October 2026 and sign-in/sign-up, OTP,
    token refresh, SMS, anonymous and Web3 values are recorded in
    `supabase/DEPLOY.md` and the dated production-control evidence. The email
    field was platform-managed and disabled, and its numeric value was not
    exposed through the accessible dashboard output, so this line remains
    unticked rather than guessing it.
- [x] Data export and account deletion available to users: **Take it with you**
  downloads portable CSV, Markdown, calendar, attachment and restorable JSON
  files; specialized workspaces have a second explicit backup; **Privacy**
  exposes typed-confirmation cloud-account deletion and device erasure. The
  export/privacy/retention/erase suites are the release evidence.
- [ ] Accessibility audit of the piloted workflows
- [x] Incident process with named owner and university contact templates:
  Harrison Rubin is the Semester incident and support owner; the public
  templates remain in `INCIDENT_COMMUNICATION_TEMPLATES.md`. Institution-side
  contacts are still a per-pilot external input.
- [ ] Rollback tested on the production deployment path
- [x] No production secret in git, bundles, docs or fixtures — Gitleaks 8.28.0
  passed the current tree, all reachable history and the release-branch range;
  the production and isolated institutional bundles passed the redacting
  artifact scanner. Measurements and reviewed false positives are recorded in
  `docs/evidence/security/2026-10-01-secret-verification.md`.

## Required if the deployment includes it

- [ ] SSO configured and tested against the university's IdP
- [ ] Each integration adapter approved, credentialed and tested against sandbox
- [ ] AI gateway enforcing the tenant boundary by construction
- [ ] Institutional gateway liveness/readiness added to the hourly monitor by
  setting both production URL variables; the workflow fails on a partial pair

## Sign-off

| Who | Confirms |
| --- | --- |
| Engineering | Blocking list met, with evidence attached |
| Support | Ready to receive |
| University sponsor | Scope and criteria agreed in writing |

## The rule

A checkbox is ticked by a link to evidence — a passing named test, a measured
figure, a screenshot of a live dashboard. Not by anybody's recollection.
