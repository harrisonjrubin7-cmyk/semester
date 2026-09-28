# Institutional SSO Launch Readiness

Where each part of the launch command's identity section stands, what has to
happen before a pilot school's identity goes live, and in what order.
Launch-readiness Phase 2. Checked against `origin/main` at `1201317` and the
open pull requests on 2026-09-27.

The architecture documents belong to harrisonjrubin7-cmyk/semester#803:
`INSTITUTIONAL-SSO-ARCHITECTURE.md`, the SAML, OIDC and LTI runbooks,
`SCIM-LIFECYCLE-MANAGEMENT.md`, claim mapping, account linking and
entitlement resolution. This document does not repeat them. It is the
checklist a council member reads to decide whether identity is ready for a
cohort.

## What this change adds

**SCIM is reachable, and off by default.** The SCIM 2.0 service
(`app/server/institution/scim.ts`) and its data layer
(`20260924150142_institution_identity_provisioning.sql`) were both on main,
tested, and not connected. The functions it writes through live in `private`,
which PostgREST does not publish, so it had no production repository and no
route. The Phase 0 audit recorded this as finding 4.

| File | What |
| --- | --- |
| `supabase/migrations/20260928200000_scim_gateway.sql` | Four `service_role`-only wrappers: credential material, provision a user, replace a group's members, record a refusal. Every rule stays in the private function each one wraps |
| `app/server/institution/postgres-scim.ts` | The production `ScimRepository` |
| `app/server/institution/scim-route.ts` | Mounts SCIM at `/scim/v2` on the gateway when `SEMESTER_SCIM=on` |
| `supabase/scim-gateway.check.sql`, `app/server/institution/postgres-scim.test.ts` | 13 database checks. 17 repository tests, run through the real service |

Where SCIM and the schema disagree, the schema wins:

- **A user's `id` is their membership, and their `externalId` is fixed.**
  Changing it would create a second person, so it is refused with a 400.
- **A group is an administrator's mapping.** An identity provider cannot
  create a role by sending a group. An unmapped group is recorded as
  `unknown_group` and refused with a 400 that says who can map it. Deleting a
  group empties its membership and leaves the mapping in place.
- **Deprovisioning deactivates.** `DELETE /Users/{id}` sets the person
  inactive and clears their roles. Nothing the student made is touched:
  membership is authorization, not content. This meets the command's "no
  immediate destruction of student-created private work".

## Status against the command

| Item | Status | Where |
| --- | --- | --- |
| Tenant discovery | **Partial.** Email-domain hint and institution selector; one SSO domain per deployment. No tenant URL | `lib/schoolclaim.ts`, `lib/findschool.ts`, `SEMESTER_SSO_DOMAIN` |
| SAML 2.0 | **Built on Supabase Auth SSO**, bound to one authorized provider per tenant; first login binds to the SCIM membership | `institution_identity_provider`, `20260924154500_bind_institution_sso_membership.sql`, `app/server/institution/auth.ts` |
| SAML certificate rotation and alerting | **Not built.** No expiry is stored and nothing alerts | — |
| OIDC | **Not built for institutions.** `provider_type` accepts only `'saml'`. The app's own sign-in uses PKCE | #803 `OIDC-IMPLEMENTATION-RUNBOOK.md` |
| SCIM 2.0 | **Built, and now reachable (off).** Users and Groups, idempotent, audited, tenant-bound credentials, admin-approved group-to-role mapping | This change |
| LTI 1.3 / Advantage | **Built.** Launch, deep linking, AGS. Names and Roles refused. Grade passback gated for registrations bound to a school; an unbound registration still answers `allowed-unbound` | `supabase/functions/lti/`, `20260927180000_lti_integration_binding.sql`; LTI-to-membership join in #803 |
| Minimal claims | **Enforced by constraint in #803** (nine allowed claims; values naming protected records refused) | #803 `20260927120000_identity_claim_minimization.sql` |
| Account linking | **Partial.** LTI identity links by ticket, and auto-link by email is refused. SSO binds only to a SCIM-created membership. No personal-to-institutional link and no unlink | `20260921160100_lti_identity.sql` |
| Entitlement resolution | **Contract only**, in #803. The flag evaluator on main walks the first steps | `lib/flags.ts`; #803 `entitlement.ts` |
| Admin test wizard / SSO test runs | **Not built.** The acceptance steps are manual | `docs/vanderbilt/identity-scim-acceptance.md` |

## Activation order for one school

Nothing in this list is automatic, and each step has its own owner. Do them in
order. A later step does not make up for a skipped earlier one.

1. **The school's IdP owner is named** in the council's seat list and in
   `docs/vanderbilt/incident-routing.md`. That row is currently unassigned.
2. **The SAML provider is registered in Supabase Auth**, and one
   `institution_identity_provider` row for the tenant is set to `authorized`,
   with its domains. Its attribute mapping passes #803's claim constraint.
3. **Group mappings are approved.** A tenant administrator
   (`tenant:configure`) writes `scim_group_mapping` rows: which IdP groups
   confer which Semester roles. A group left unmapped grants nothing.
4. **A SCIM credential is issued** to the tenant, with an expiry. Only the
   salted hash is stored. The bearer secret goes to the IdP owner once, outside
   this repository.
5. **SCIM is turned on in Preview first.** Set `SEMESTER_SCIM=on` and
   `SEMESTER_SCIM_PUBLIC_URL`, and point the IdP's sandbox at it.
6. **Acceptance in the sandbox:** follow
   `docs/vanderbilt/identity-scim-acceptance.md`. Provision a test user,
   put them in a mapped group and check the role, sign in by SSO and check the
   binding, deprovision and check that sign-in is refused. Every accepted and
   refused call should appear in `provisioning_audit_event`.
7. **Only then in Production.** Set `SEMESTER_SCIM=on` there, and record the
   council's sign-off.

Rollback at any step: unset `SEMESTER_SCIM` (the endpoint then answers 404),
revoke the credential (`scim_credential.status = 'revoked'`), or set the
provider to `disabled`. None of these deletes a membership.

## Not in this change, in the order a pilot would need them

1. **Bind or stop the unbound LTI registration.** Before any beta, bind the
   pilot school's registration or engage `kill.writeback`
   (`docs/PRIVATE-BETA-PROGRAM.md` refuses an active beta otherwise).
2. **SAML certificate expiry.** Store it with the provider, and alert the
   named IdP owner 30 days out. Today an expired certificate shows up as
   students unable to sign in.
3. **An SSO test-run record** (`sso_test_runs` in the command). This makes
   step 6 above evidence, not memory.
4. **Unlink, with an explanation of lost access and an export first.**
5. **OIDC** as a second `provider_type`, only when a pilot school needs it.
6. **A tenant URL** for discovery, when more than one school is live.

## Confirmation

This change enables no identity provider, adds no route that answers by
default, provisions nobody, and changes no existing sign-in path.
