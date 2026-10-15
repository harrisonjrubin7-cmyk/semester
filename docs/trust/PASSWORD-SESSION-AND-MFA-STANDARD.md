# Semester password, session and MFA standard — controlled draft

- **Status:** `PARTIAL`
- **Owner:** Harrison Rubin, Security/Identity primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Scope:** product identities, privileged roles, company/provider consoles, service credentials and recovery

## Standard

Authentication must use approved managed identity services; passwords must not be stored or logged by Semester application code. Sessions must be bound to the authenticated subject, validated server-side for protected actions, protected in transit, revocable, expired according to approved risk, and re-authenticated or stepped up for sensitive actions. MFA is required for privileged/company/provider access and for product roles/actions according to the adopted risk model.

Recovery must not bypass MFA, tenant/resource authorization, identity proofing or audit. Error messages, rate limits and support flows must avoid enumeration and social-engineering shortcuts. Tokens, cookies, refresh artifacts, one-time links and recovery codes are secrets and must not enter URLs, analytics, logs, chat, tickets or documentation except where a protocol strictly requires a protected one-use exchange.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| managed sign-in/session validation | auth/session code and tests; [`docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md`](../SSO-SECURITY-AND-SESSION-MANAGEMENT.md) | target configuration/export not filed | `PARTIAL` | Identity/Engineering | target fixation/reuse/revocation/recovery suite |
| product privileged step-up | [`supabase/migrations/20261008223000_privileged_role_mfa.sql`](../../supabase/migrations/20261008223000_privileged_role_mfa.sql); [`supabase/privileged-mfa.check.sql`](../../supabase/privileged-mfa.check.sql); console enrolment/challenge code | production Auth configuration not filed | `PARTIAL` | Security/Product | platform_admin and support_agent grants require aal2; student/passkey and recovery coverage remain open |
| company/provider-console MFA | owner attestation referenced in evidence registers | configuration exports/screenshots absent | `UNVERIFIED` | Security | dated enforcement proof for every console |
| SSO/SCIM session lifecycle | SAML/SCIM binding and policy tests | no live institution IdP acceptance | `CONDITIONAL` | Identity/Customer | named-tenant login/logout/revoke/recovery |
| service/machine identities | secret/configuration references | inventory, ownership and rotation evidence incomplete | `PARTIAL` | Security/Engineering | machine-identity lifecycle review |

## Required configuration record

`[IDENTITY SYSTEM]`, subjects/roles, auth factors, enrollment/recovery, session/idle/absolute lifetimes, refresh/reuse behavior, revocation, device/risk signals, step-up actions, lockout/rate limit, logs/alerts, break glass, owner/backup, customer dependency, review date and exception.

## Claim ceiling and activation blockers

Permitted: “Semester implements and tests selected authentication, SSO, session, step-up and revocation controls. Platform-admin and support-agent product grants require an aal2 session in the shared server authorization predicate.” Prohibited: universal MFA, passwordless security, complete session governance, production-console enforcement, live institutional SSO, or account-takeover prevention. Blocks: adopted configuration, all-console MFA proof, student/passkey enrolment, privileged/service identity inventory, recovery and break-glass drill, target abuse/session tests, access review, monitoring/alerting, customer acceptance, incident route and named owners.
