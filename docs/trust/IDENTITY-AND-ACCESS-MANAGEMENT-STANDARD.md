# Semester identity and access management standard — controlled draft

- **Status:** `PARTIAL / TENANT-CONFIGURATION DEPENDENT`
- **Owner:** Security/IAM owner with Engineering, HR/People, system owners, and institution identity authority
- **Evidence date:** 2026-10-03

## Standard

Every human and machine identity must be unique, verified to an approved source, bound to the correct tenant/account, protected at risk-appropriate authentication strength, granted only approved capabilities, and governed through joiner/mover/leaver, review, incident, and recovery processes. Federation or provisioning code is not a live institutional identity integration until configured and accepted with that institution.

## Required identity record

Identity source, subject/account, tenant, role/capabilities/resource scope, approver, authentication/MFA method, provisioning path, start/expiry, last review, recovery, linked service accounts/tokens, audit evidence, customer authority, exception, and revocation/disposition.

## Control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| sign-in/account recovery | auth and account flows/tests | target provider/config/support exercise incomplete | IAM/Support | account recovery/lockout UAT |
| institutional SSO binding | SAML membership and tenant-policy tests | no successful named-institution IdP exchange | IAM/Customer | real IdP acceptance |
| SCIM provisioning | service/repository and audit tests | not proven reachable/operated in production | IAM/Engineering | target provisioning/deprovisioning run |
| MFA/step-up | operator MFA and freshness controls | coverage, enrollment/recovery and break-glass open | Security/Operations | target MFA lifecycle exercise |
| roles/capabilities/access review | capability and grant audit tests | signed customer matrix and recurring review absent | IAM/Customer | joiner/mover/leaver and review evidence |
| machine identity | OAuth/service configuration and secret controls | inventory, rotation and ownership incomplete | Engineering/Security | service-account/token review |

Relevant design sources include [institutional SSO architecture](../INSTITUTIONAL-SSO-ARCHITECTURE.md) and [SSO security/session management](../SSO-SECURITY-AND-SESSION-MANAGEMENT.md).

## Claim ceiling and activation blockers

Permitted: “SAML binding, SCIM, capabilities, and selected MFA controls are implemented and tested in the repository.” Prohibited: live SSO/SCIM, universal MFA, complete lifecycle governance, institution approval, or production IAM operation. Blocks: named owners/backups, authoritative directories, customer mapping/approval, target IdP/provisioning tests, MFA/recovery/break-glass, machine-identity inventory/rotation, access reviews, monitoring/support, offboarding, incident drill, and signed acceptance.
