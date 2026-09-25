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
- [x] Append-only audit evidence records tenant-setting, future role-grant and
  current report-moderation status changes; isolation, pseudonymization and
  immutability checks pass
- [ ] Rate limiting on the Supabase-direct paths, not just the gateway
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
