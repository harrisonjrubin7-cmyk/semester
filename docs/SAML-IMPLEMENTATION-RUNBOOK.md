# SAML implementation runbook

Status: **BUILT.** The tenant-specific acceptance gate is
[`docs/vanderbilt/identity-scim-acceptance.md`](vanderbilt/identity-scim-acceptance.md),
and activation is
[`docs/vanderbilt/production-activation-runbook.md`](vanderbilt/production-activation-runbook.md).
This page is the general procedure those two instantiate for one school.

## Who validates what

Semester does not parse SAML. Supabase Auth's SSO implementation receives the
assertion, validates it, and issues a session whose `app_metadata.provider` is
`sso:<provider id>`. Semester then decides access from its own tables:

| Check | Done by |
| --- | --- |
| Assertion signature, issuer, audience, validity window, recipient, response binding | Supabase Auth SSO. Confirm each in staging with a deliberately bad assertion; do not assume |
| Token still valid and not revoked | `auth.ts`, `getUser` over the network, every request |
| Provider is `authorized` and unambiguous | `membership.ts` → `providersFor` |
| Person has exactly one `active` membership in that tenant | `membership.ts` → `membershipsFor` |
| First login binds only to a pre-provisioned SCIM identity on an authorized domain | `bind_institution_sso_membership` |
| Roles are current, not from a stale token | Reloaded from `institution_membership` each request |

## Steps

1. **Tenant.** A `schools` row exists. Contract, DPA and security review are
   recorded outside this repository.
2. **Service-provider details to the campus identity team:** entity ID, ACS URL
   and metadata URL from the Supabase project's SSO settings; the requested
   attribute list (step 4); the support contact. Send these through the secure
   channel the acceptance doc names, never through this repository.
3. **Register the IdP in Supabase Auth** (`supabase sso add`) with the campus
   metadata URL, the discovery domain, and an attribute-mapping file naming
   only the approved attributes of step 4. Supabase keeps what that file maps,
   so it must not be wider than the `attribute_mapping` row.
4. **Record the provider** as a `pending` row in `institution_identity_provider`
   with its `sso:` identifier, its domains and a minimal `attribute_mapping`. The
   constraint refuses any claim outside the allowlist and any attribute that reads
   as a protected record. See
   [SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md](SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md).
5. **Issue a SCIM credential** and approve group mappings. See
   [SCIM-LIFECYCLE-MANAGEMENT.md](SCIM-LIFECYCLE-MANAGEMENT.md). Without SCIM,
   sign-in is refused by design.
6. **Run the controlled-account acceptance** in staging.
7. **Authorize.** Set `status = 'authorized'` only after every owner signs off.
   Until then `/v1/auth/config` hides the campus sign-in button.

## Minimum attributes

Required: a stable subject (NameID or an opaque ID) and the email the SCIM
`userName` will match. Optional: display name, affiliation, groups, campus,
department. Nothing else, and never grades, GPA, aid, health, disability,
conduct, immigration or roster data.

## Certificate rotation

Supabase Auth reads the IdP's metadata URL. Rotation is handled by the IdP
publishing a new certificate there. Semester has **no expiry alert** today; the
acceptance doc names a rollover owner as the control. Automated alerting is a
gap.
