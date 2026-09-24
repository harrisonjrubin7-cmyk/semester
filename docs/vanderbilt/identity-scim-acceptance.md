# Vanderbilt identity and SCIM acceptance

Status: **BUILT — NOT YET AUTHORIZED OR DEPLOYED**

This runbook is the controlled acceptance gate for Vanderbilt SAML SSO and
SCIM provisioning. The application, tenant authorization, provisioning data
model, SCIM service and guarded sign-in entry are implemented locally. None of
that means Vanderbilt has approved the integration, supplied production
metadata, or completed acceptance.

Do not set an identity provider to `authorized`, issue a production SCIM
credential, or display the Vanderbilt sign-in button until every required
owner has approved the corresponding evidence below.

## Owners and status language

| State | Meaning |
| --- | --- |
| BUILT | Code and automated tests exist locally. |
| STAGING | Deployed with non-production configuration and controlled accounts. |
| AUTHORIZED | Vanderbilt's authorized IdP/LMS administrators have approved the exact configuration and acceptance evidence. |
| PRODUCTION | The authorized configuration is deployed, monitored and covered by support and incident procedures. |

Required owners:

- Vanderbilt identity administrator: `[NAME / TEAM / TICKET]`
- Vanderbilt SCIM or directory administrator: `[NAME / TEAM / TICKET]`
- Semester security owner: `[NAME]`
- Semester deployment owner: `[NAME]`
- Vanderbilt pilot owner: `[NAME]`

Secrets and metadata must travel through an approved secure channel. Do not
paste SAML metadata, signing certificates, service-role keys, SCIM bearer
tokens, controlled-account passwords or production identifiers into this
repository, an issue, chat, screenshot, or acceptance result.

## SAML configuration worksheet

Record only secure-vault or ticket references here.

| Field | Value or secure reference |
| --- | --- |
| Supabase project | `[PROJECT REFERENCE]` |
| SAML metadata | `[SECURE REFERENCE]` |
| Entity ID / audience | `[APPROVED VALUE]` |
| ACS / callback URL | `[APPROVED HTTPS URL]` |
| Semester app URL | `[APPROVED HTTPS URL]` |
| Exact redirect allowlist entry | `[APPROVED HTTPS URL WITH TRAILING SLASH]` |
| Discovery domain | `vanderbilt.edu` (confirm with Vanderbilt) |
| NameID format | `[APPROVED VALUE]` |
| Required attributes | `[SUBJECT, EMAIL, DISPLAY NAME AS APPROVED]` |
| Signing/encryption policy | `[APPROVED POLICY]` |
| Certificate rollover owner | `[OWNER / PROCEDURE]` |
| Logout behavior | `[APPROVED BEHAVIOR]` |

Server configuration uses `SEMESTER_SSO_LABEL` and `SEMESTER_SSO_DOMAIN` only
as candidate public values. The unauthenticated `/v1/auth/config` endpoint
returns them only when the database contains exactly one matching provider in
the `authorized` state. It never returns metadata, provider identifiers,
certificates, credentials, tenant IDs, or service-role keys.

## SCIM configuration worksheet

| Field | Value or secure reference |
| --- | --- |
| SCIM base URL | `[APPROVED HTTPS URL]/api/scim/v2` |
| Bearer credential | `[VAULT REFERENCE — NEVER THE TOKEN]` |
| Credential owner and expiry | `[OWNER / DATE]` |
| Vanderbilt tenant binding | `[INTERNAL APPROVAL REFERENCE]` |
| User identifier mapping | `[APPROVED MAPPING]` |
| Group-to-role mapping | `[APPROVED MAPPING REFERENCE]` |
| Unknown-group behavior | No grant; confirm in evidence |
| Deprovisioning target | Membership deprovisioned and roles cleared |
| Credential rotation procedure | `[RUNBOOK REFERENCE]` |

The bearer credential must be generated once, shown once, stored in an
approved vault and persisted only as a salted hash. The tenant is bound to the
credential server-side; it is never accepted from a SCIM request body.

## Controlled-account acceptance

Run these cases in staging with accounts Vanderbilt created for testing. Save
timestamps, request or audit IDs, screenshots without personal data, and the
reviewer's result in `[EVIDENCE LOCATION]`.

- [ ] A provisioned student starts at Semester and completes Vanderbilt SSO.
- [ ] The callback returns only to the exact allowlisted Semester app URL.
- [ ] A missing, pending, disabled or ambiguous provider hides the Vanderbilt button.
- [ ] A user without an active Vanderbilt membership is denied after valid SSO.
- [ ] A suspended or deprovisioned user is denied on the next authorization check.
- [ ] Session expiry produces a readable sign-in recovery and does not loop.
- [ ] Logout ends the Semester session; Vanderbilt's approved IdP logout behavior is documented.
- [ ] A tenant mismatch is refused and produces no academic-data response.
- [ ] Current database roles override stale token metadata.
- [ ] An approved group grants only its mapped Semester roles.
- [ ] An unknown or removed group grants nothing.
- [ ] SCIM user create and identical replay are idempotent.
- [ ] SCIM user update changes approved attributes only.
- [ ] SCIM `active: false` deprovisions membership and clears roles.
- [ ] SCIM group replacement removes roles no longer justified by membership.
- [ ] Invalid, expired and revoked SCIM credentials are denied and audited.
- [ ] SCIM discovery, filtering and pagination match the approved client behavior.
- [ ] Logs and audit exports contain no bearer token, SAML assertion, password or academic content.
- [ ] Keyboard-only users can reach, identify, activate and recover from the Vanderbilt sign-in control.
- [ ] Screen-reader output names the control and announces a failed sign-in through the alert region.

## Authorization decision

All boxes above must pass before the provider changes from `pending` to
`authorized`. Attach:

- `[VANDERBILT IDENTITY APPROVAL]`
- `[VANDERBILT SCIM APPROVAL]`
- `[SEMESTER SECURITY REVIEW]`
- `[ACCESSIBILITY EVIDENCE]`
- `[STAGING TEST EVIDENCE]`
- `[GO-LIVE / ROLLBACK APPROVAL]`

Decision: `[PENDING / APPROVED / REJECTED]`

Approved by: `[NAMES AND ROLES]`

Date: `[YYYY-MM-DD]`

Rollback trigger and owner: `[PROCEDURE / OWNER]`

## External gate

Production remains blocked until Vanderbilt's authorized administrators supply
and approve SAML metadata, the callback and redirect allowlist, attribute and
group mappings, and a SCIM credential through secure channels, then witness
the controlled-account and deprovisioning cases. Local code and a green test
suite cannot satisfy this institutional approval gate.
