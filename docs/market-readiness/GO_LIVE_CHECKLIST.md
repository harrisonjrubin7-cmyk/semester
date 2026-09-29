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
- [ ] Gateway journal backed up
- [ ] Error monitoring live and alerting to a named person
- [x] Hourly synthetic monitoring covers the public Pages HTML, deployed
  module/stylesheet assets and production Supabase PostgREST
- [ ] Security headers configured at the host
  Written, not served: `app/vercel.json` and `app/public/_headers` carry the
  set, held equal and complete by `app/src/lib/hostheaders.test.ts`. GitHub
  Pages reads neither. Tick this when production is served from a host that
  reads one and a probe of the live response shows the headers.
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
    Still open before this is ticked: the Auth endpoint limits (sign-in,
    sign-up, OTP, token refresh, email) read off the dashboard and recorded —
    `supabase/DEPLOY.md` under **Rate limits**.
- [x] Data export and account deletion available to users: **Take it with you**
  downloads portable CSV, Markdown, calendar, attachment and restorable JSON
  files; specialized workspaces have a second explicit backup; **Privacy**
  exposes typed-confirmation cloud-account deletion and device erasure. The
  export/privacy/retention/erase suites are the release evidence.
- [ ] Accessibility audit of the piloted workflows
- [ ] Incident process with named owner and university contact templates
- [ ] Rollback tested on the production deployment path
- [ ] No production secret in git, bundles, docs or fixtures — verified, not assumed

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
