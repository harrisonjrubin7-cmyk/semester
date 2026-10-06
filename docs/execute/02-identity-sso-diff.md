# Stream 02 · identity, SSO and onboarding: what exists

Audit of `docs/handoff/execute/02-identity-sso.md` against the repository at `d34e477b`. Status is *exists*, *partial* or *missing*; paths are repository-relative. The roster decision is D-1318.

| # | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| 1a | SAML SSO via Supabase Auth | exists, not deployed | `app/server/institution/auth.ts`, `20260924150142_institution_identity_provisioning.sql`, `20260924154500_bind_institution_sso_membership.sql`, `docs/INSTITUTIONAL-SSO-LAUNCH-READINESS.md` | No browser sign-in UI for SSO; one domain per deployment; certificate rotation and alerting not built |
| 1b | OIDC for institutions | missing | readiness doc: `provider_type` accepts only `saml` | not built |
| 1c | `tenant_sso_policy` | exists | `20260928011845_tenant_sso_policy.sql`, `supabase/tenant-sso-policy.check.sql` | no admin UI found |
| 1d | membership binding | exists | `app/server/institution/membership.ts`, `membership.test.ts`, `identity-provisioning.check.sql` | none |
| 1e | SCIM gateway | exists, off by default | `scim.ts`, `scim-route.ts`, `postgres-scim.ts`, `scim-gateway.check.sql` | not switched on anywhere |
| 1f | IdP group to role mapping | partial, by design | `mapScimGroupsToRoles`, `scim_group_mapping`; `rolelaunch.test.ts` asserts no SSO claim or SCIM group assigns an app role | institutional roles only; Vanderbilt group names are a human input |
| 1g | claim minimization | exists | `packages/institution/src/identity.ts`, `identity.test.ts` | none |
| 2 | mock or staging IdP | **extended in slice 1** | `app/server/institution/mock-idp.ts` | the real staging IdP needs the university's metadata and test accounts |
| 3a | account switcher | missing | none | build |
| 3b | sessions list, remote sign-out | partial | `AccountSecurity.tsx`, `signOutOtherDevices()` in `lib/cloud.ts` | no per-session list or single sign-out; Supabase Auth has no list API, so it needs a sessions table with RLS and a check suite |
| 3c | delegated access with expiry | exists | `support_access`, family, advisor and support shares, K-12 guardians, with check suites | no single "who has access to me" view; expiry confirmed required only on `support_access` |
| 4 | role onboarding | partial | one generic flow, `screens/Onboarding.tsx`, `ONB_STEPS = 5` | zero per-role flows; no explicit connect, privacy or AI step; `templates/role-onboarding/` was not copied (`docs/handoff/IN-THIS-REPO.md`) |
| 5 | Capabilities and Permissions screen | **extended in slice 2** | `app/src/components/DevicePermissions.tsx`, `app/src/lib/permissions.ts`, rendered on the Your data page; D-1335 | a panel, not a settings page, because the settings index is capped at eleven rows; revoking camera, microphone and location is the browser's, so they carry directions |
| 6a | test login per pilot role | **extended in slice 1** | `app/server/institution/pilot-login.test.ts` | staging half is a human input |
| 6b | role-mapping tests | **extended in slice 1** | same file; `provisioning.test.ts`, `rolelaunch.test.ts` | none in mock form |
| 6c | onboarding a11y per role | missing | `a11y/axe.test.tsx` mentions onboarding only in a comment | no per-role onboarding to test yet |

## Human-only inputs
The university's IdP metadata and signing certificate (secure channel only); its identity admin, SCIM admin and pilot owner (placeholders in `docs/vanderbilt/identity-scim-acceptance.md`); controlled test accounts; the university's IdP group and attribute names; `templates/role-onboarding/`, `docs/launch/Cutover Plan.html` and `ui_kits/`, which must be re-supplied; a Supabase Auth SAML registration and a production SCIM credential, which this stream must not do.

## Next slices, in order
1. ~~Capabilities and Permissions screen~~ (done, D-1335).
2. Per-role onboarding with the connect, privacy and AI steps, and an axe and keyboard test per role.
3. Sessions table, per-session sign-out and an account switcher, with a "who has access to me" view.
