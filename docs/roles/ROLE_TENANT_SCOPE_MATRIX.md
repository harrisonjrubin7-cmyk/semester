# Role tenant and scope matrix

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

## How a tenant is represented

- **Tenant root:** `public.schools(id text slug, email_domains[], enforce_membership)`. A tenant is a school; there is no separate tenant table and no tenant creation flow (nothing built, Implementation #2 in the gap register).
- **Row-level tenant:** a `tenant_id text` column referencing `schools.id`; about 187 of 352 tables carry `tenant_id` or `school_id` (parse, approximate).
- **Student tenant:** `profiles.school_id`, set only by `claim_school()` (confirmed email domain) or an approved `school_membership_requests` row. Client update is revoked. `private.school_of()` reads it. The tenant is derived, never submitted, for student self-service calls (`join_community`, `send_help_request`, registration, dining).
- **Staff tenant:** a `role_grants` row with `scope_kind='school'` and `scope_id = schools.id`. Policies call `private.has_capability('<cap>','school',tenant_id)`. Admin functions that take a tenant parameter gate it the same way.
- **SCIM tenant:** `institution_membership(tenant_id, auth_user_id, status, roles[], source)`. A separate store, with its own role vocabulary (RG-02).
- **Client tenant:** `state.schoolId`, local, default `'vanderbilt'`. It drives navigation and search only. It is not authority and must never be treated as one.

## Scope kinds

`platform`, `school`, `organization`, `course`, `department`, `office`, `residence`, `business`, `employer`, `cohort`, `partner`. A platform grant has `scope_id = ''` (check constraint). A course scope is `school/CODE`; `private.scope_in_tenant(scope, tenant)` is a prefix match that lets a course grant satisfy a school-level read where a policy asks for it.

## Role family by scope

| Family | Typical scope kind | Global role? |
| --- | --- | --- |
| Students, applicants, alumni | account-owned; school via profile | no |
| Faculty, TA, tutor | course (`school/CODE`), school | no |
| Advisor | school, plus a student-created share | no |
| Registrar, student accounts, financial aid | school, office | no |
| Institution administrator, integration admin | school | no |
| Department chair, dean | department, school | no |
| Organization roles | organization | no |
| Employer, partners | employer, partner | no |
| Semester operators | platform | **yes (14 roles):** `account_executive`, `compliance_owner`, `content_owner`, `customer_success`, `data_steward`, `finance_operator`, `incident_responder`, `moderator`, `platform_admin`, `portfolio_council`, `support_agent`, `trust_officer`, `trust_safety_reviewer`, `trust_safety_senior` |

`implementation_manager`, `integration_admin` and `billing_contact` are resource-scoped Semester-side or customer-side roles; confirm per grant.

## Isolation status

| Layer | State | Evidence |
| --- | --- | --- |
| Database, RLS enabled | Live project: 0 public tables without RLS (321) | read-only catalog query |
| Database, tenant-scoped policies | Built; sweeps assert no write policy of `true` | `rls-coverage.check.sql`, `definer-sweep.check.sql`, `integration-rls-matrix.check.sql` |
| Membership enforcement | **Off.** `enforce_membership` defaults false for every school; before it is on, any confirmed address can enter any school's course room. Whether any school is switched on is UNVERIFIED | `supabase/tenancy.check.sql`, `20260930185000_school_membership_enforcement.sql` |
| Platform isolation conformance | In-memory adapters only. Real adapters have not been shown to pass | `packages/platform/src/testing/conformance.ts` |
| Policy-less tables | 33 public tables with RLS and no policy (service-role only, mostly intended): `registration_holds`, `registration_completions`, `registration_requests`, `payment_events`, `support_tickets`, `scim_credential`, `gtm_*` consent tables, `lti_*`, `beta_*`, and others | live catalog; [`DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) DR-03 |
| Storage | Two private buckets. Policies for `community-media` exist; `trust-packet` is reached by one-minute signed URLs from the `trust-room` function (`verify_jwt` off) | live catalog; no storage test runs against real `storage.objects` |
| Edge Functions | All 16 or 17 live functions have `verify_jwt=false`; authorization is in code and not tested in `supabase/` | live function list; UNVERIFIED per function |
| Cache, queue, search, AI retrieval, analytics | Conformance cases exist; real adapters not built | `docs/platform/ISOLATION.md` |

## Isolation gaps, ordered

1. **Membership enforcement off** (RG-07). Switch-on needs the lock-out acknowledgement in `set_school_enforcement`, which today requires the legacy `app_admins` flag (RG-01).
2. **Grants outside school scope survive deprovision** (RG-03).
3. **Anonymous readability:** `schools_read` is `using (true)` to `public`, exposing school names and email domains; main keeps this deliberately pending a product and counsel decision. `institution_action_offices` says "anyone signed in" but is granted to `public`. The live read-only pass found 32 public tables SELECT-visible to `anon` (including `profiles`, `messages`, `notes`, `push_devices`, `family_grants`) with rows gated by RLS; migration `20261005200000` on main removes those grants, and whether it is applied to the live project is UNVERIFIED (RG-08).
4. **Edge Function authorization unproven** (RG-09).
5. **`kill_switch_engaged` answers for any tenant** (DR-01, low).
6. **`productivity_readiness_aggregate` authorizes on `institution_membership.roles` containing `'admin'`**, not on a capability (RG-02).
