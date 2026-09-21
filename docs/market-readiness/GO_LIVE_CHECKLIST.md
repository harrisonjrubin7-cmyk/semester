# Go-Live Checklist

**Status: `NOT_STARTED`** — no item below is currently met.

Every line requires evidence, not an opinion.

## Blocking

- [ ] Tenant isolation enforced in policy and covered by cross-tenant tests
- [ ] Restore tested from backup, timed, and the restored DB passes the policy suites
- [ ] Gateway journal backed up
- [ ] Error monitoring live and alerting to a named person
- [ ] Uptime monitoring live
- [ ] Security headers configured at the host
- [ ] Admin audit log recording role and tenant-setting changes
- [ ] Rate limiting on the Supabase-direct paths, not just the gateway
- [ ] Data export and account deletion available to users
- [ ] Accessibility audit of the piloted workflows
- [ ] Incident process with named owner and university contact templates
- [ ] Rollback tested on the production deployment path
- [ ] No production secret in git, bundles, docs or fixtures — verified, not assumed

## Required if the deployment includes it

- [ ] SSO configured and tested against the university's IdP
- [ ] Each integration adapter approved, credentialed and tested against sandbox
- [ ] AI gateway enforcing the tenant boundary by construction

## Sign-off

| Who | Confirms |
| --- | --- |
| Engineering | Blocking list met, with evidence attached |
| Support | Ready to receive |
| University sponsor | Scope and criteria agreed in writing |

## The rule

A checkbox is ticked by a link to evidence — a passing named test, a measured
figure, a screenshot of a live dashboard. Not by anybody's recollection.
