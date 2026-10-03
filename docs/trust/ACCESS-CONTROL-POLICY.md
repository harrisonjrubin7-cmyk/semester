# Semester access control policy — controlled draft

- **Status:** `PARTIAL`
- **Owner:** Security/IAM owner with system/data owners and customer authority
- **Evidence date:** 2026-10-03

## Policy

Access must be explicitly authorized, least-privileged, purpose- and tenant/resource-scoped, time-bound where appropriate, separated for high-risk actions, authenticated at the required strength, logged, reviewed, and promptly revoked. Default deny applies when identity, tenant, role, capability, purpose, source, or approval is unknown.

## Lifecycle

Request with business/purpose/data scope; validate identity and authority; obtain system/data/customer approval; provision named access; verify effective permissions; log use and privileged actions; review on cadence and trigger; revoke on role/need/contract/incident/offboarding change; retain evidence and investigate exceptions. Shared accounts and standing emergency access require documented exception, compensating controls, expiry, and review.

## Control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| account/tenant/resource isolation | authentication and RLS/tenancy negative tests | target named-tenant acceptance absent | Security/Engineering | target cross-tenant test |
| capability grants and audit | capability/role/grant sources and tests | approved customer permission matrix absent | IAM/Customer | representative joiner-mover-leaver UAT |
| privileged/step-up actions | MFA/operator/approval controls | access review and break-glass exercise incomplete | Security/Operations | target step-up and emergency drill |
| support/trust-room access | time-bound grant and audit designs/tests | staffing, grant review and revocation operation open | Support/Security | target access/revoke/evidence exercise |
| service accounts/secrets | configuration and secret controls | full inventory/rotation/owner proof incomplete | Engineering/Security | target machine-identity review |

## Claim ceiling and activation blockers

Permitted: “Repository tests enforce scoped access and tenant isolation for defined paths.” Prohibited: universal least privilege, complete tenant isolation, continuous review, production MFA coverage, or customer-approved access. Blocks: complete account/system inventory, named owners/backups, customer role matrix, target negative tests, joiner/mover/leaver and access-review operation, privileged/service-account controls, break-glass drill, monitoring, exceptions, training, and accepted residual risk.
