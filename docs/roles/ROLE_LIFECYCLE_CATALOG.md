# Role lifecycle catalog

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

The brief's lifecycle is one path for every person. This page states where each stage exists today. "Role launch maturity" (the seven-rung ladder in [`ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md)) is a different thing from a person's lifecycle; this page is about the person.

| Stage | Exists today | Evidence | Gap |
| --- | --- | --- | --- |
| Discover / invite | Public site, `site_leads`, family and beta invitations | `company-site/`, `lead-intake` function, `family_invites`, `beta_invitations` | No invite flow for faculty, advisor, registrar, buyer or partner roles |
| Identity / account | Supabase Auth, email and OAuth | `app/src/lib/cloud.ts`; `profiles` | No auth hook; no passkey UI found (UNVERIFIED) |
| Verification or institution SSO | `claim_school()` by confirmed email domain; `school_membership_requests`; `tenant_sso_policy`; SAML/OIDC/SCIM backend off by default | `20260930185000_school_membership_enforcement.sql`, `20260928011845`, `app/server/institution/scim.ts` | No admin screen for SSO policy or SCIM credentials |
| Tenant, membership, role resolution | `role_grants` at `scope_kind='school'`, one write path (console `role-grant` duty) | `20260929110000_console_approvals_and_break_glass.sql` | `institution_membership.roles` is a separate vocabulary that SCIM writes and nothing converts (RG-02) |
| Policy, consent, entitlement resolution | Capability in SQL; consent tables; entitlement in TypeScript only | `private.has_capability`, `consent_record`, `supabase/functions/_shared/entitlement.ts` | `has_capability` checks neither consent nor entitlement; entitlement runs in shadow on the LTI path only |
| Role-aware onboarding | Student carousel only | `app/src/screens/Onboarding.tsx` | No versioning, resume, role assignment or support handoff (RG-26) |
| First meaningful action | Student first-run empty state | `FirstRun.tsx` | No first-value event is collected; definitions only |
| Daily workspace | Student OS; staff tabs inside `University.tsx`; `Console.tsx` | `app/src/screens.tsx` | No role shell (RG-12) |
| Controlled cross-role workflow | Registration, gradebook, advisor share, Console approvals | see [`ROLE_CROSS_WORKFLOW_MAP.md`](ROLE_CROSS_WORKFLOW_MAP.md) | No outbox or receipt in any (RG-11) |
| Support / escalation | Student tickets, operator queue, time-limited support access, break-glass | `support_tickets`, `support_access_grant`, `break_glass_grant` | Incident declaration and commander not built |
| Audit / evidence | `audit_event` and per-domain audit tables, hash-chained Console audit | [`DEFINER-RLS-REGISTER.md`](../DEFINER-RLS-REGISTER.md) | No single schema (RG-19) |
| Role change / end | Revocation by trigger on deprovision; `expires_at` on grants; offboarding RPCs | `private.revoke_grants_on_deprovision` | Non-school scopes survive (RG-03) |
| Portability, retention, deletion | Account export and erasure; legal holds; retention sweeps | `delete-account` function, `20260930100000` | School offboarding has no UI; production sweeps UNVERIFIED |

## Grant lifecycle as built

1. A request names person, role, scope and expiry (`request_approval`, duty `role-grant`).
2. A different holder of the approver seat decides, with fresh MFA (`aal2` within 15 minutes).
3. `console_act()` writes the audit event first, then inserts the grant with `provenance='platform'`.
4. The grant is live while `revoked_at` is null and `expires_at` is null or future; `has_capability` checks at read time.
5. Revocation is an update on the same row; `audit_role_grant_change` records it.

Limits: the service key can still insert a grant directly with no approval (RG-04); the live project holds four grants and the approval path has never run in production.

## Lifecycle by person type

| Person | Enters by | Ends by | Built |
| --- | --- | --- | --- |
| Self-serve student | Signup | Export, delete | Yes (`delete-account`) |
| Institution-linked student | Email-domain claim or admin-approved request | `leave_school`, `revoke_school_membership`, deprovision | Yes; graduation and alumni transition not built |
| Faculty, TA | Operator `role-grant` | `expires_at` | End-of-term sunset not built |
| Advisor | Operator `role-grant` | Revoke | Caseload reassignment not built |
| Registrar, admin | Operator `role-grant` | Revoke | Role transfer is two separate grants; no transfer flow |
| Guardian | Student-created family invite | Expiry or revoke | Built (`family_grants`); expiry sweep UNVERIFIED |
| Customer | Contract | Offboarding RPCs | Backend only |
| Developer, partner | None | None | Not started |
| Semester employee | Operator `role-grant` | Revoke | No HR trigger, no access review cadence |
| Board member | None | None | Not started |
