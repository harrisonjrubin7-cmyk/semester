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
| 3a | account switcher | missing, **deliberately not built** (D-1354) | none | Supabase holds one session per browser client, so this changes how sign-in works; a product decision |
| 3b | sessions list, remote sign-out | **extended in slice 5** | `my_sessions()`, `end_my_session()` over `auth.sessions` (no new table), `SignedInDevices.tsx`, `my-sessions.check.sql`; D-1354 | not applied to production; the signed-in list was not seen in a browser |
| 3c | delegated access with expiry | exists | `support_access`, family, advisor and support shares, K-12 guardians, with check suites | **view added in slice 4** (`lib/access-overview.ts`, `WhoCanSeeYou.tsx`, D-1347): reads, names no one, ends nothing; expiry confirmed required only on `support_access` |
| 4 | role onboarding | partial, **re-scoped** | one generic flow, `screens/Onboarding.tsx`, `ONB_STEPS = 5`; the server side exists as versioned journeys (D-1330), unapplied, none published | per-role flows are not hard-coded (D-1342); they wait for a published journey and the re-supplied `templates/role-onboarding/` |
| 5 | Capabilities and Permissions screen | **extended in slice 2** | `app/src/components/DevicePermissions.tsx`, `app/src/lib/permissions.ts`, rendered on the Your data page; D-1335 | a panel, not a settings page, because the settings index is capped at eleven rows; revoking camera, microphone and location is the browser's, so they carry directions |
| 6a | test login per pilot role | **extended in slice 1** | `app/server/institution/pilot-login.test.ts` | staging half is a human input |
| 6b | role-mapping tests | **extended in slice 1** | same file; `provisioning.test.ts`, `rolelaunch.test.ts` | none in mock form |
| 6c | onboarding a11y per role | **extended in slice 3** | `app/src/a11y/axe.test.tsx`: steps 1 to 5 of first run, desktop and phone | per role only once role flows exist (D-1342) |

## Human-only inputs
The university's IdP metadata and signing certificate (secure channel only); its identity admin, SCIM admin and pilot owner (placeholders in `docs/vanderbilt/identity-scim-acceptance.md`); controlled test accounts; the university's IdP group and attribute names; `templates/role-onboarding/`, `docs/launch/Cutover Plan.html` and `ui_kits/`, which must be re-supplied; a Supabase Auth SAML registration and a production SCIM credential, which this stream must not do.

## Next slices, in order
1. ~~Capabilities and Permissions screen~~ (done, D-1335).
2. ~~Per-role onboarding~~: not hard-coded; re-scoped to published journeys (D-1342). The existing first run is now audited at every step.
3. ~~"Who has access to me" view~~ done in slice 4 (D-1347). ~~Sessions list and per-session sign-out~~ done in slice 5 (D-1354), with no new table. The account switcher is not built and waits on a product decision (D-1354).
4. Stream 02 is otherwise complete in mock form; the remaining gates are the human ones (Vanderbilt IdP metadata, test accounts, group names).
