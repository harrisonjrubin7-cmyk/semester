# Semester beta exit criteria

**Status:** open
**Applies to:** the first GA release and every named institutional production launch

GA is a release state supported by evidence. It is not achieved by deleting the word “beta.” All mandatory gates below must be closed against one immutable release candidate.

## Mandatory GA gates

| Gate | Exit criterion | Acceptance evidence | Owner | Current state |
| --- | --- | --- | --- | --- |
| Product | Critical student journeys work on supported desktop and mobile browsers with no P0/P1 defect | versioned end-to-end results, route inventory and approved limitations | Product | partial |
| Reliability | SLOs, alerting, escalation, rollback and restore work on the production path | 30-day measurements, paging test, rollback drill, restore drill with RTO/RPO | Operations/SRE | unmet |
| Security | No open P0/P1 vulnerability; dependencies, secrets, SAST and DAST are clean or formally disposed | scan reports, pen-test, remediation tickets and clean rescans | Security | unmet |
| Privacy | Data map, retention/deletion, consent, export, subprocessor and rights workflows are reviewed and exercised | counsel-approved notices, tests and dated operational evidence | Privacy/Legal | partial |
| Accessibility | Piloted workflows meet the stated accessibility target and known exceptions are published | independent audit, keyboard and screen-reader testing, remediation, ACR/VPAT status | Accessibility | unmet |
| Legal | Public terms and policies are in force; entity, jurisdiction, liability, IP, age and contracting authority are resolved | counsel approval and published/versioned documents | Legal | unmet |
| Support | A reachable support route, coverage model, SLAs, escalation owners and incident communications are exercised | named roster, ticket test, incident exercise and templates | Customer Success | unmet |
| Commercial | Prices, entitlements, taxes, billing, cancellation, refund and reconciliation work end-to-end | production-like paid lifecycle evidence and approved terms | Finance/Product | unmet |
| Institution | Each institutional capability has a current named-tenant approval and required data/provider configuration | signed tenant register and acceptance report | Institution champion/Data | unmet |
| Governance | All launch council seats are held and every seat signs the exact candidate | signed decision record, no expired waiver, no open P0/P1 | Founder/Council | unmet |

## Non-waivable gates

P0/P1 security, privacy, accessibility, reliability, safety, legal authority, tenant isolation, data-loss, restore, and institutional-authorization failures cannot be waived for GA. A bounded pilot may accept a documented P2/P3 only when the existing launch model permits it, the founder signs the risk, users are told, and the waiver has an expiry date.

## Beta-reference transition plan

When every gate is closed, prepare one atomic release that:

1. assigns the immutable GA version and commit;
2. records council and institutional sign-off;
3. publishes the in-force legal/support/trust material;
4. changes only release-state beta language while retaining capability-specific maturity labels;
5. validates metadata, structured data, navigation, account creation, payments and support;
6. deploys with monitored rollback criteria;
7. verifies the live URL and production configuration; and
8. publishes the announcement only after the post-deploy checks pass.

If any post-deploy check fails, roll back the release-state copy with the application. Do not leave a GA marketing surface pointing at a beta or degraded service.

## Current decision

The criteria are not met. Semester remains in beta. No GA date or version should be announced yet.
