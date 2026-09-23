# Canonical Data Model and Permissions

**Version date:** 2026-09-23  
**Status:** Controlled rollout source  
**Evidence basis:** §5 platform architecture; §6 identity and permissions; tenant-role schema map

> Truth boundary: repository behavior and reproduced checks are current evidence. Provider activation, institutional approval and production data exchange remain external gates until authoritative readback succeeds.

## Verified baseline

| Measure | Current value |
| --- | ---: |
| Registered destinations | 59 |
| Screen union members | 81 |
| Accounted non-destinations | 22 |
| Unaccounted screens | 0 |
| Database migrations | 46 |
| Duplicate migration versions | 0 |
| Institution gateway files | 26 |

## Operating decision

Semester remains the authoritative React, TypeScript and Supabase product. The institutional program extends the existing routes and local-first behavior through server-enforced tenancy, verified grants, canonical academic records, governed integrations and observable release gates. Sample and sandbox evidence is labeled and cannot be promoted to production status by presentation alone.

## 5. Canonical platform architecture

## 6. Identity, roles and permissions

# Semester tenant and role schema map

Measured against the migrations and university gateway on 23 September 2026.
This is a map of what exists, not a claim that an institutional deployment is
configured.

## Canonical mapping

| Approved layer | Existing implementation | Boundary it enforces |
| --- | --- | --- |
| Institution | `public.schools` | Stable institution id, verified email domains, public directory row |
| User affiliation | `public.profiles.school_id` through `public.claim_school()` | A client cannot declare its own campus; the confirmed address is checked server-side |
| Sub-institution organization | `public.organizations.school_id` | Organization discovery is restricted to the claimed campus, with member access for unlisted organizations |
| Scoped grants | `public.role_grants` | Subject, role, scope kind/id, provenance, expiry and revocation |
| Role vocabulary | `public.app_roles` | One foreign-key-backed list rather than role strings repeated in policies |
| Permission vocabulary | `public.app_capabilities` | Named actions with human-readable meanings |
| Role-permission matrix | `public.role_capabilities` | Set membership rather than an ordinal admin ladder |
| Enforcement predicate | `private.has_capability()` | Caller-bound, live, exact-scope capability checks for RLS policies |
| External tenant routing | `UniversityIdentity.institutionId` plus the server adapter registry | The verified server identity selects an institution adapter; the request body cannot |
| Client presentation | `resolveWorkspaceAccess()` | A selected role changes presentation only; server-returned grants alone expose capabilities |

## What is already strong

- `profiles.school_id` is pinned against direct `anon` and `authenticated`
  updates. `claim_school()` is the only client path and reads the confirmed
  address from `auth.users`.
- `organizations` carries a non-null school foreign key and its discovery
  policy compares against `private.school_of()`.
- `role_grants` is client-readable only by its subject and client-writable by
  nobody. Revoked and expired grants remain visible for explanation but do not
  satisfy the predicates.
- `private.has_capability()` joins a live scoped grant to the role-capability
  matrix. Policies ask for actions, not broad role names.
- The university gateway chooses adapters from the authenticated identity's
  `institutionId`; a client cannot select another tenant's adapter.
- Institution adapters must repeat vendor object-level authorization at every
  read, review and write boundary.

## Gaps that remain real

1. Department, academic program and course scopes are vocabulary and text
   identifiers today, not a complete canonical hierarchy with foreign keys.
2. A `role_grants.scope_id` is intentionally polymorphic text. Exact matching
   prevents one scope from authorizing another, but the database cannot yet
   prove that a course or department scope belongs to the same institution as
   the subject.
3. SSO, SCIM/lifecycle provisioning and institution-managed account recovery
   are not implemented.
4. Consent, retention, legal hold and tenant-specific deletion configuration
   are not represented as complete server-side policy objects.
5. Tenant-level AI policy exists only in narrower school capability switches;
   it is not yet a complete institution-governed model/tool/data policy.
6. Production adapter registration is intentionally empty without approved
   credentials and agreements. Sandbox records are not institutional records.

## Migration decision

No migration is added by this baseline task. The existing objects already
enforce the invariants this task is allowed to claim, and the new disposable
probe exercises them directly. A future canonical-hierarchy migration must be
designed before implementation because replacing polymorphic scope text with
foreign keys affects existing grants.

Proposed future migration family: `institution_hierarchy_and_scoped_grants`.
It must add institutions' departments, programs, terms, courses and sections;
backfill and validate scope references; preserve grant history; add same-tenant
constraints; and retain a rollback path that restores the old text values
without losing revocation, expiry or provenance.

## Evidence and checks

- `supabase/institutional-foundation.check.sql` — the combined cross-tenant and
  scoped-capability probe added with this map.
- `supabase/schools.check.sql` — school claims and the pinned profile column.
- `supabase/organizations.check.sql` — organization visibility and mutation.
- `supabase/rolegrants.check.sql` — scoped role lifecycle and client locks.
- `supabase/capabilities.check.sql` — set-based permissions and the private
  predicate.
- `app/server/institution/gateway.test.ts` — authenticated adapter routing and
  two-phase actions.
- `app/src/lib/institutional-access.test.ts` — client presentation never grants
  authorization.

