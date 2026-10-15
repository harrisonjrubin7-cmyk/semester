# SSO setup

> **Type:** runbook · **Audience:** implementers, institution-admins · **Owner:** `security` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This runbook says what exists for institutional single sign-on, who does each step and what is not built; stop reading if you need OIDC, which is not built, or a working campus sign-in, which no institution has today.

**Status:** SAML is `IMPLEMENTED_NOT_RELEASED` and blocked on an institutional identity provider. OIDC is `PLANNED`: the provider type accepts only `saml`. SAML is configured for no tenant, nothing has been tested against a real identity provider, and the public claims register lists SSO as "In preparation".

<!-- status: SAML SSO = IMPLEMENTED_NOT_RELEASED -->
<!-- status: OIDC SSO = PLANNED -->
<!-- capabilities: tenant:configure, audit:read -->
<!-- roles: university_admin -->
<!-- claim: sso In preparation -->
<!-- paths: docs/SAML-IMPLEMENTATION-RUNBOOK.md, docs/OIDC-IMPLEMENTATION-RUNBOOK.md, docs/SSO-TENANT-ONBOARDING.md, docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md, docs/SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md, docs/SSO-SECURITY-AND-SESSION-MANAGEMENT.md, docs/INSTITUTIONAL-SSO-ARCHITECTURE.md, docs/vanderbilt/identity-scim-acceptance.md -->

## How sign-in works here

Semester does not parse SAML. Supabase Auth receives the assertion, validates it and issues a session. Semester then decides access from its own tables on every request: the provider must be `authorized`, the person must have exactly one `active` membership in that tenant, and roles are reloaded from the membership row, never from the token. The first login binds only to a membership that SCIM already created. Without SCIM, sign-in is refused by design.

The authoritative procedure is [`SAML-IMPLEMENTATION-RUNBOOK.md`](../../SAML-IMPLEMENTATION-RUNBOOK.md). This page orders it and says who acts.

## Who does what

| Step | Institution | Semester |
| --- | --- | --- |
| 1. Tenant | Provides email domains; contract, DPA and security review recorded outside the repository | Creates the `schools` row |
| 2. Service-provider details | Receives entity ID, ACS URL and metadata URL, and the requested attribute list, over a secure channel | Sends them. Never through the repository |
| 3. Register the identity provider | Gives the metadata URL, discovery domain and the approved attribute list | Registers the provider in Supabase Auth (`supabase sso add`) with a mapping file naming only approved attributes |
| 4. Record the provider | Approves the minimal attribute mapping. A `university_admin` (holding `tenant:configure`) approves group-to-role mappings later | Inserts an `institution_identity_provider` row as `pending`. A database constraint refuses claims outside the allowlist and attributes that read as protected records |
| 5. Provision people | See [SCIM provisioning](SCIM-PROVISIONING.md) | Issues the credential and records group mappings |
| 6. Acceptance | Names controlled test accounts: student, faculty, staff or administrator | Walks the acceptance checklist in staging |
| 7. Authorize | Every owner signs off | Sets the provider to `authorized`. Until then the campus sign-in button is hidden |

A `university_admin` with `audit:read` can read the provisioning audit rows. There is no admin screen for steps 3, 4 or 7 and no SSO test-run record. The acceptance steps are manual, so keep your own dated notes.

## What the institution supplies

- A stable subject (NameID or opaque identifier) and the email address that SCIM `userName` will match.
- Optional: display name, affiliation, groups, campus, department.
- Nothing else. Grades, GPA, aid, health, disability, conduct, immigration and roster data are refused by name.
- One SSO domain per deployment today (`SEMESTER_SSO_DOMAIN`). Tenant discovery is by email domain and an institution selector; there is no tenant URL.

## What you can check

| Check | Expected |
| --- | --- |
| Domain matches no authorized provider | No campus button; ordinary sign-in only |
| Valid SSO, no active membership | Signed in with no institutional access; the gateway answers 403 "no verified access" |
| Membership suspended or deprovisioned | Same, from the next request. No data is deleted |
| Provider set to `disabled` | The campus button disappears; existing sessions lose institutional access on their next request |
| Arriving from an LMS course link with a deprovisioned account | A 403 page: "Your school access is not active". No session is opened |

## Not built, so plan around it

| Gap | Consequence |
| --- | --- |
| OIDC | `provider_type` is `'saml'` only. An OIDC campus needs either a Supabase Auth OIDC provider bound to the tenant or a broker presenting the campus provider as SAML. See [`OIDC-IMPLEMENTATION-RUNBOOK.md`](../../OIDC-IMPLEMENTATION-RUNBOOK.md) |
| Certificate expiry alert | No expiry is stored and nothing alerts. An expired certificate shows up as students unable to sign in. Name a rollover owner on your side |
| SSO test runs | Not recorded. Acceptance is manual |
| Unlink | No personal-to-institutional unlink exists |
| Real identity provider | No test has been run against one |

## Rollback

Set the provider to `disabled`, or unset `SEMESTER_SCIM` (the endpoint then answers 404), or revoke the SCIM credential. None of these deletes a membership.

## Read next

[`SSO-TENANT-ONBOARDING.md`](../../SSO-TENANT-ONBOARDING.md) for the order a new institution goes through. [`INSTITUTIONAL-SSO-LAUNCH-READINESS.md`](../../INSTITUTIONAL-SSO-LAUNCH-READINESS.md) for status against each requirement. [`identity-scim-acceptance.md`](../../vanderbilt/identity-scim-acceptance.md) for a filled-in acceptance checklist. [`SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md`](../../SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md) for the claim allowlist.
