# Institutional Go-Live Checklist

| Control | Value |
| --- | --- |
| Status | **NO-GO — REPOSITORY CONTROLS EXIST; TARGET, OPERATED AND CUSTOMER EVIDENCE REMAIN OPEN** |
| Owner | Harrison Rubin — company-side release coordinator; independent approvers, trained backups and customer go-live authorities unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../market-readiness/GO_LIVE_CHECKLIST.md`](../market-readiness/GO_LIVE_CHECKLIST.md), [`../market-readiness/LAUNCH-READINESS-CHECKLIST.md`](../market-readiness/LAUNCH-READINESS-CHECKLIST.md), and [`INSTITUTIONAL-IMPLEMENTATION-GUIDE.md`](INSTITUTIONAL-IMPLEMENTATION-GUIDE.md) |

Every checked line requires a dated link or protected evidence reference for the exact release, target, configuration and scope. Repository tests satisfy only the repository-control portion of a gate. `N/A` requires a named approver and rationale. Any open P0/P1, missing authority or unavailable stop/rollback path is `NO-GO`.

## Scope and authority

- [ ] Named institution/tenant, cohort, workflow, environment, candidate revision and configuration are frozen.
- [ ] Authorized order/pilot terms, data roles/schedule, notices/consent and signing authority are effective.
- [ ] Success definitions, baseline, sources, privacy thresholds, guardrails and stop/offboarding decisions are accepted.
- [ ] Responsibility matrix names available primary/backups and customer decision owners for every in-scope workstream.
- [ ] Known limitations, exclusions, dependencies and residual risks are accepted by authorized owners.

## Security, privacy, identity and access

- [ ] Exact-candidate security evidence and target configuration/readback are accepted; blocking findings are remediated or formally accepted.
- [ ] Target two-tenant/role negative tests, IDOR/session/revocation and privileged/support access tests pass.
- [ ] Identity/provider, claim/group mapping, MFA/step-up, joiner/mover/leaver and access-review evidence pass where applicable.
- [ ] Data map, minimization, provider/region/retention/deletion/export/hold and rights procedures match deployed behavior.
- [ ] Audit event coverage/export/access/retention and incident evidence are accepted for the target.

## Product, accessibility and integration

- [ ] Representative users complete approved first-win and critical workflows on supported devices/browsers.
- [ ] Qualified accessibility/manual assistive-technology review and barrier/accommodation route are accepted.
- [ ] Every enabled integration is bound, least-scoped, target-tested and reconciled; unsupported/unbound paths are disabled.
- [ ] Official-system/source/freshness labels, degraded behavior and safe manual fallback are verified.
- [ ] Official writes remain off unless explicitly authorized, previewable, audited, idempotent, reconciled and reversible.

## Reliability, release and recovery

- [ ] Exact-candidate tests/build/migrations/scans and dependency/secret checks pass with evidence and reviewed exceptions.
- [ ] Target headers, rate limits, secrets, domains/TLS, provider configuration and environment separation are verified by readback.
- [ ] Monitoring/alerts cover critical workflows and reach named primary/backups; escalation and customer routes are exercised.
- [ ] Rollout, feature/kill switch, rollback/forward-fix and emergency change paths are rehearsed on the actual deployment path.
- [ ] Backup/restore and relevant journal/file/job recovery are timed and validated; measured RTO/RPO are reported only for tested scope.

## Operations and launch

- [ ] Support channels, staffed hours, queue, knowledge, accessible alternatives, domain escalation and closure are exercised.
- [ ] Training, communications, UAT, issue disposition and customer acceptance are complete for each representative role.
- [ ] Launch window, command roles, status/update plan, change freeze, smoke tests and abort thresholds are approved.
- [ ] Invitation/activation is separately authorized after technical deployment; activation count is reconciled.
- [ ] Post-launch monitoring, weekly review, incident/change control, closeout and offboarding dates/owners are scheduled.

## Decision record

| Decision | Required entry |
| --- | --- |
| candidate / target / scope | `[SHA, ARTIFACT, ENVIRONMENT, TENANT, COHORT, WORKFLOW]` |
| open risks and exceptions | `[ITEM, OWNER, EXPIRY, ACCEPTOR]` |
| evidence manifest | `[CONTROL → CURRENT EVIDENCE]` |
| Semester approvals | `[PRODUCT, ENGINEERING, SECURITY/PRIVACY/A11Y, SUPPORT/OPS, EXECUTIVE]` |
| customer approvals | `[SPONSOR, TECHNICAL, DATA/PRIVACY/SECURITY, WORKFLOW OWNER]` |
| result | `GO / CONDITIONAL GO / NO-GO`, `[TIME]`, `[ACTIVATION AUTHORITY]` |

## Evidence state

**Repository evidence.** Extensive product, security, privacy, integration, accessibility, release and recovery controls support individual checklist lines.

**Operational evidence.** This checklist is not signed and does not establish a target tenant, approved customer, staffed operation, exact-candidate acceptance, go-live, activation or observed operation.

**Missing test/proof.** Close every applicable line with exact target evidence, resolve or formally accept risks, obtain independent/customer approvals and record the go/no-go and separate activation decision.

## Claim ceiling

Semester may say it maintains an evidence-gated institutional go-live checklist. Current state remains no-go for a named institutional activation.

## Prohibited claims

Do not claim go-live readiness, production approval, successful deployment, activated users, operational acceptance, SLA/recovery achievement, customer sign-off or institutional launch from unchecked lines, repository tests or an unsigned decision record.
