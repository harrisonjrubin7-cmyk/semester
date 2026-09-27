# Institutional SSO architecture

Status: **SAML, SCIM and LTI 1.3 BUILT; OIDC and account linking NOT BUILT; nothing
AUTHORIZED or in PRODUCTION.** Status words are the ones
[`docs/vanderbilt/identity-scim-acceptance.md`](vanderbilt/identity-scim-acceptance.md)
defines: BUILT means code and tests exist, and nothing more.

This is the index for the institutional-identity docs. It says what each protocol
does in Semester, where the code is, and which of the tables the SSO/SCIM/LTI
command asked for already exist under another name.

## Three protocols, three jobs

```text
Campus IdP ── SAML (via Supabase Auth SSO) ──► who is signing in
          └─ SCIM 2.0 (app/server/institution/scim.ts) ──► who is a member, in which groups
LMS ────────── LTI 1.3 (supabase/functions/lti) ──► which course and resource a launch is for
                                   │
                                   ▼
     institution_membership → private.has_capability → RLS → entitlement chain
```

They complement each other and none substitutes for another. SAML proves a
person. SCIM decides membership and ends it. LTI carries course context. None of them
grants a role directly. Roles come from administrator-approved group mappings,
and every read still passes row-level security
([ADR 0002](architecture/0002-rls-is-the-authorization-boundary.md)).

## Where each piece lives

| Concern | Code | Tables | Doc |
| --- | --- | --- | --- |
| SAML sign-in | Supabase Auth SSO; `app/server/institution/auth.ts`, `membership.ts` | `institution_identity_provider`, `institution_membership` | [SAML runbook](SAML-IMPLEMENTATION-RUNBOOK.md) |
| First-login binding | `public.bind_institution_sso_membership` | same | [Account linking](ACCOUNT-LINKING-AND-IDENTITY-PRIVACY.md) |
| SCIM lifecycle | `app/server/institution/scim.ts`, `packages/institution/src/provisioning.ts` | `scim_credential`, `scim_external_identity`, `scim_group_mapping`, `provisioning_audit_event` | [SCIM](SCIM-LIFECYCLE-MANAGEMENT.md) |
| LTI launch, deep linking, AGS | `supabase/functions/lti`, `_shared/lti*.ts` | `lti_platform`, `lti_nonce`, `lti_identity`, `lti_link_ticket`, `lti_line_item` | [LTI runbook](LTI-1.3-LAUNCH-RUNBOOK.md) |
| Claim minimization | `packages/institution/src/identity.ts` | constraint on `institution_identity_provider.attribute_mapping` | [Claim mapping](SSO-CLAIM-MAPPING-AND-DATA-MINIMIZATION.md) |
| Entitlement order | `packages/institution/src/entitlement.ts` | none (pure) | [Entitlement](ENTITLEMENT-RESOLUTION.md) |
| OIDC | none | none | [OIDC runbook](OIDC-IMPLEMENTATION-RUNBOOK.md) |

## The requested tables, against what exists

The command listed twenty-five tables. Creating them under new names beside the
ones that already do the job would split one fact across two places. The command
said "create/adapt", and this is the adapt.

| Requested | Exists as | State |
| --- | --- | --- |
| `tenant_sso_configurations`, `identity_provider_connections` | `institution_identity_provider` | BUILT (SAML only) |
| `tenant_identity_domains` | `institution_identity_provider.domains`, `schools.email_domains` | BUILT |
| `identity_claim_mappings` | `institution_identity_provider.attribute_mapping`, now constrained | BUILT |
| `institutional_identities` | `scim_external_identity` + `institution_membership.auth_user_id` | BUILT |
| `institutional_identity_vault_references` | none. No legal identity is stored, so nothing needs vaulting yet | NOT NEEDED |
| `tenant_memberships` | `institution_membership` | BUILT |
| `provisioning_events`, `scim_provisioning_records` | `provisioning_audit_event` (immutable) | BUILT |
| `scim_group_mappings` | `scim_group_mapping` | BUILT |
| `lti_platform_configurations`, `lti_deployments` | `lti_platform` (keyed issuer, client, deployment; nullable `tenant_id`) | BUILT; tenant recorded, not yet read |
| `lti_launch_audits` | function logs only | GAP |
| `lti_context_mappings` | `lti_line_item` (context → line item) | PARTIAL |
| `account_link_requests` | `lti_link_ticket` (LTI only) | PARTIAL |
| `account_link_audits`, `account_unlink_requests` | none | NOT BUILT |
| `session_security_events` | gateway authorization audit (`membership.ts`) | PARTIAL |
| `sso_test_runs`, `sso_configuration_audits` | the acceptance checklist in `docs/vanderbilt/` | MANUAL |
| `tenant_plan_entitlements`, `user_plan_entitlements`, `sponsored_access_entitlements`, `usage_allowances`, `usage_counters` | shape defined by `EntitlementRequest`; `usage_atomic` covers AI usage | CONTRACT ONLY |

## Known gaps, in the order they matter

1. **LTI launches do not read `lti_platform.tenant_id` yet.** The column exists
   and is foreign-keyed to `schools`, but it is null for registrations installed
   before it, and the launch function does not use it. Until it does, LTI
   context cannot be joined to `institution_membership`. This comes first
   because the entitlement chain's course steps depend on it.
2. **No LTI launch audit table.** Refusals are logged by reason code and not
   persisted.
3. **Entitlement tables.** The resolver is a tested contract. Nothing yet
   stores tenant plans, modules or allowances for it to read.
4. **OIDC** is not supported. `provider_type` admits only `'saml'`.
5. **Personal ↔ institutional account linking** for SSO accounts does not exist.

Nothing here is deployed, and nothing here changes a production provider's
state.
