# Institutional Security Package

| Control | Value |
| --- | --- |
| Status | **CONTROLLED EVIDENCE PACKAGE — REPOSITORY CONTROLS PRESENT; INDEPENDENT/TARGET ASSURANCE PARTIAL** |
| Owner | Harrison Rubin — company-side security owner; backup responder, independent assessor and customer security authority unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../institutional-rollout/generated/publication/procurement-security-review-package.md`](../institutional-rollout/generated/publication/procurement-security-review-package.md) and [`../market-readiness/TRUST-CENTER-CONTENT.md`](../market-readiness/TRUST-CENTER-CONTENT.md) |

## System and trust boundary

Semester is a React/local-first application with optional Supabase-backed account/institutional services and a separate gateway/adapters for approved institutional actions. Repository controls describe intended behavior. Hosting/provider configuration, encryption settings, identity providers, secrets, integrations, tenants and operational ownership must be confirmed for each target; no connector or policy in code proves a live customer deployment.

## Evidence index

| Domain | Repository/code evidence | Operational/external gap |
| --- | --- | --- |
| architecture/data flow | system/application/data/integration architecture and environment controls | customer-specific flow, target inventory/readback and data authority absent |
| identity/authorization/tenancy | RLS, grants, capabilities, role/tenant negative tests, provisioning and integration gates | named IdP/role mapping, target two-role/cross-tenant acceptance and access review absent |
| secure development/release | CI tests, secret/dependency/license checks, SBOM generation, release/rollback standards | exact-candidate aggregate, branch settings, signed provenance and independent review incomplete |
| application/data security | input/policy tests, rate limits, audit controls, feature kills/read-only, database checks | target configuration, full route adoption, operated alerting and production exercise partial |
| vulnerability management | disclosure route, internal severity/remediation targets, dependency automation, DAST workflow | current exact-SHA DAST may be unavailable; independent penetration test and measured remediation history absent |
| logging/monitoring/incident | privacy-safe logging design, monitoring/incident/communication runbooks | accepted telemetry, alert delivery, trained backup rota/customer contacts and exercises absent |
| resilience/recovery | logical restore, rollback/DR plans, local load/invariant tests | provider backup/PITR restore, gateway-journal recovery, full-stack capacity and measured RTO/RPO absent |
| third parties | subprocessor/vendor/supply-chain registers and provider boundaries | executed vendor terms, customer approval, target regions/configuration and full assurance review open |

## Disclosure and acceptance

Share only approved versions through the authorized confidential channel; redact secrets, credentials, exploit details, personal/student/customer data and unrelated tenant information. Record recipient, purpose, artifact/version, grant/expiry and access. Findings stay tied to environment, revision, method, date, scope and limitations. A scan, questionnaire answer or test suite is not a certification or blanket absence-of-vulnerability statement.

Before institutional activation: freeze target/revision/configuration; approve data/identity/provider scope; complete target role/tenant/security tests; resolve/accept findings with expiry; verify logging/alerts/incidents/support/access reviews; run rollback/kill/restore exercises; complete independent review appropriate to risk; assign trained primary/backups and customer contacts; obtain customer security acceptance.

## Evidence state

**Repository evidence.** Broad preventative/detective/recovery controls and test suites support detailed security review.

**Operational evidence.** Current independent penetration test, complete exact-candidate scan set, target configuration/access review, operated alert/incident history, provider-backed recovery and institutional acceptance are not established.

**Missing test/proof.** Build an exact-candidate evidence manifest; run available SAST/DAST/dependency/secret and target tests; commission independent assessment; remediate/retest; exercise operations/recovery; approve residual risk and customer acceptance.

## Claim ceiling

Semester may describe specific dated repository-tested controls and disclose the exact limitations of available assurance.

## Prohibited claims

Do not claim secure, vulnerability-free, penetration-tested/cleared, certified/compliant, zero-trust complete, tenant-isolated in a named target, incident-ready, disaster-recoverable or institution-approved without matching current evidence.
