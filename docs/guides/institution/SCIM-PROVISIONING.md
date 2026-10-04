# SCIM provisioning

> **Type:** how-to · **Audience:** implementers, institution-admins · **Owner:** `security` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page shows how an identity owner points an identity provider at Semester's SCIM service and what happens to people and roles; stop reading if you want the endpoint-by-endpoint contract, which is in the [SCIM API reference](../../reference/SCIM-API.md), or if you need a provisioning model that has run against a real provider, which does not exist yet.

**Status:** `IMPLEMENTED_NOT_RELEASED`. The SCIM 2.0 service is built, tested through its real service and off unless the gateway sets `SEMESTER_SCIM=on`. It has never been run against a real identity provider, it is enabled for no tenant, and the public claims register lists it as "In preparation". Treat everything below as the intended procedure, to be proven in a sandbox first.

<!-- status: SCIM 2.0 = IMPLEMENTED_NOT_RELEASED -->
<!-- capabilities: tenant:configure, audit:read -->
<!-- roles: university_admin -->
<!-- claim: scim In preparation -->
<!-- routes: /scim/v2, /Users, /Groups, /ServiceProviderConfig, /Schemas, /ResourceTypes -->
<!-- pending-links: docs/reference/SCIM-API.md -->
<!-- paths: docs/SCIM-LIFECYCLE-MANAGEMENT.md, docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md, docs/vanderbilt/identity-scim-acceptance.md, app/server/institution/scim.ts, app/server/institution/scim-route.ts -->

## What SCIM does here

SCIM creates and deactivates the institutional membership of a person, and assigns roles through approved group mappings. It is how SSO sign-in finds a membership to bind to. It does not carry rosters or enrolments, and deprovisioning removes institutional access without touching anything a student made.

## Who does what

| Step | Institution | Semester |
| --- | --- | --- |
| 1. Group mappings | A `university_admin` (holding `tenant:configure`) approves which identity-provider groups confer which Semester roles. A mapping to an administrator role carries an `approved_by` | Writes `scim_group_mapping` rows after approval |
| 2. Credential | Receives the bearer secret once, through a secure channel, and vaults it | Issues a `scim_credential` for the tenant with an expiry. Only a salted hash is stored. There is no screen for this step |
| 3. Turn it on in a preview | Points the identity provider's sandbox at the base URL | Sets `SEMESTER_SCIM=on` and `SEMESTER_SCIM_PUBLIC_URL` in the Preview deployment |
| 4. Acceptance | Provisions a test user, puts them in a mapped group, signs in by SSO, then deprovisions | Reads `provisioning_audit_event` for each call |
| 5. Production | Records sign-off | Sets `SEMESTER_SCIM=on` in Production only after step 4 passes and the council records sign-off |

## Point your identity provider at it

1. Use the base URL Semester gives you. It is the address in `SEMESTER_SCIM_PUBLIC_URL`, served under the path `/scim/v2` on the institution gateway. Semester does not guess it from a request, and the service refuses to start without it.
2. Authenticate with an HTTP bearer token shaped `<credential id>.<secret>`. The tenant is taken from the credential, never from a request body.
3. Expect responses of type `application/scim+json`.
4. Send an `Idempotency-Key` header with every mutation, delete included, up to 300 characters. The SCIM service documentation requires it for create, update and patch, and a missing or oversized key is refused with a 400. Confirm with your identity provider whether it can send one; this has not been tested against any real provider.
5. Map your user attributes to `userName` and `externalId`. Filters support only `eq` on `userName` or `externalId`, with a page size of at most 200.

Discovery endpoints (`/ServiceProviderConfig`, `/Schemas`, `/ResourceTypes`) report patch yes, bulk no, filter yes. The resources are `/Users` and `/Groups`. The full list of methods and responses is in the [SCIM API reference](../../reference/SCIM-API.md); this page does not repeat it.

## Rules to design around

| Rule | Consequence for you |
| --- | --- |
| `DELETE /Users/{id}` deactivates | The membership becomes `deprovisioned` and its roles are cleared. Nothing is hard-deleted and no student work is touched |
| A user's `externalId` is fixed | Changing it is refused with a 400, because it would create a second person |
| A group is an administrator's mapping | An identity provider cannot create a role by sending a group. An unmapped group grants nothing and is refused with a 400 naming who can map it |
| Roles are recomputed from current group membership and active mappings | Removing someone from a group removes the role |
| Reactivation is explicit | It does not restore old roles; group membership must grant them again |
| Every mutation, accepted or refused, writes an immutable `provisioning_audit_event` | A holder of `audit:read` can read them. There is no health view of SCIM traffic |

## What you can verify

1. Provision a test user in a mapped group, then read the membership: it is `active` with the mapped role.
2. Sign in by SSO as that user and confirm they bind to the membership.
3. Remove the user from the group and confirm the role is gone.
4. Deprovision and confirm sign-in no longer gives institutional access.
5. Ask for the matching `provisioning_audit_event` rows for each call.

## Not built

- No notification or export prompt when a membership is deprovisioned.
- No admin health view of SCIM traffic.
- No real identity provider has been tested.
- No unlink for a personal account that was linked to an institutional one.

## Rollback

Unset `SEMESTER_SCIM` (the endpoint then answers 404 like any other unknown path), or revoke the credential, or set the identity provider row to `disabled`. None of these deletes a membership.
