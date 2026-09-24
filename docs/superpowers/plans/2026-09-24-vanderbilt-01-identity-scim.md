# Vanderbilt Identity and SCIM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` and `supabase:supabase`. Execute only after the master plan is approved.

**Goal:** Authenticate Vanderbilt accounts through tenant-bound Supabase SAML and provision institutional access through an audited SCIM 2.0 lifecycle.

**Architecture:** Supabase validates SAML. The gateway resolves the verified SSO provider to one tenant and reloads active memberships and roles from Postgres on sensitive requests. A separate SCIM bearer boundary writes identities, memberships and group-derived role grants without accepting a tenant from the request body.

### Task 1: Add provisioning contracts

**Files:** Create `packages/institution/src/provisioning.ts`, `packages/institution/src/provisioning.test.ts`; modify `packages/institution/src/index.ts`.

- [ ] Write failing tests for SCIM filter parsing, PATCH `add`/`replace`/`remove`, inactive users, group-role mapping, unknown-group no-op and response redaction.
- [ ] Run `cd app && pnpm exec vitest run ../packages/institution/src/provisioning.test.ts` and observe missing exports.
- [ ] Add strict `ScimUser`, `ScimGroup`, `ScimPatchOperation`, `ProvisioningResult` and parser contracts with bounded strings and rejected unknown mutation paths.
- [ ] Rerun the focused test and `pnpm run check:university`.
- [ ] Commit: `git commit -m "Add institutional provisioning contracts"`.

### Task 2: Persist provider, membership and SCIM state

**Files:** Generate a migration with `supabase migration new institution_identity_provisioning`; create `supabase/identity-provisioning.check.sql`; modify `MIGRATION-HISTORY.md`.

- [ ] Write a failing SQL suite proving cross-tenant denial, unique tenant/external IDs, salted credential hashes only, unknown groups grant nothing, deactivation revokes membership, and audit rows are immutable.
- [ ] Run `./supabase/check.sh identity-provisioning` and observe RED.
- [ ] Add `institution_identity_provider`, `institution_membership`, `scim_credential`, `scim_external_identity`, `scim_group_mapping`, and `provisioning_audit_event`; constrain states and enable RLS on every public table.
- [ ] Add narrowly scoped database functions for service-role credential lookup, atomic user upsert/deactivation and group membership replacement. Do not expose credential hashes through public views.
- [ ] Run the focused SQL suite and the full `./supabase/check.sh`.
- [ ] Commit: `git commit -m "Persist tenant identity provisioning"`.

### Task 3: Authorize from current membership

**Files:** Modify `app/server/institution/auth.ts`, `auth.test.ts`, `gateway.ts`, `gateway.test.ts`; create `app/server/institution/membership.ts`, `membership.test.ts`.

- [ ] Write failing tests for provider-to-tenant resolution, absent/ambiguous providers, inactive membership, current roles overriding stale JWT metadata, and immediate deprovision denial.
- [ ] Introduce `VerifiedAuthUser` and `MembershipResolver`; have `supabaseIdentity()` validate the token then resolve tenant and roles from server records.
- [ ] Keep legacy `trustedIdentity()` only for local fixtures; production runtime must require the database resolver.
- [ ] Make sensitive gateway operations reload membership. Audit successful and denied institutional authorization without logging tokens.
- [ ] Run `pnpm exec vitest run server/institution/auth.test.ts server/institution/membership.test.ts server/institution/gateway.test.ts`.
- [ ] Commit: `git commit -m "Authorize institutional access from current membership"`.

### Task 4: Implement the SCIM service

**Files:** Create `app/server/institution/scim.ts`, `scim.test.ts`, `app/api/scim/v2/[...resource].ts`; modify `app/server/institution/runtime.ts` after Workstream 5 creates it.

- [ ] Write failing request-level tests for discovery endpoints, Users/Groups CRUD and filter, idempotent replay, body limit, invalid schema, bad credential, tenant escape, rate limit and deactivation.
- [ ] Implement a tenant-bound `ScimRepository` and `createScimService()`; compare bearer credentials using constant-time verification of salted hashes.
- [ ] Return SCIM error schemas and pagination; never include Semester academic records.
- [ ] Add immutable provisioning audit writes for both accepted and refused mutations.
- [ ] Run focused tests and `pnpm run check:university`.
- [ ] Commit: `git commit -m "Add audited SCIM lifecycle service"`.

### Task 5: Add Vanderbilt SSO entry and acceptance runbook

**Files:** Modify `app/src/lib/cloud.ts`, `cloud.test.ts`, `app/src/components/Credentials.tsx`, `app/src/screens/Account.tsx`; create `docs/vanderbilt/identity-scim-acceptance.md`.

- [ ] Write failing UI/library tests for an authorized SSO domain, allowlisted redirect, missing-provider disabled state and readable error recovery.
- [ ] Add `signInWithSSO({ domain, redirectTo })`; show “Continue with Vanderbilt” only from server-supplied enabled configuration.
- [ ] Document secure dashboard fields and acceptance cases; use placeholders, never real metadata or credentials.
- [ ] Run focused tests, lint, build and keyboard smoke.
- [ ] Commit: `git commit -m "Add Vanderbilt SSO activation path"`.

**External gate:** Mark `authorized` only after Vanderbilt administrators supply SAML metadata, callback approval, group mappings and a SCIM credential through secure channels, and deprovisioning passes with controlled accounts.
