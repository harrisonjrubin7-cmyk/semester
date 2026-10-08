# Role offboarding catalog

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

Existing coverage: [`SCHOOL-OFFBOARDING.md`](../SCHOOL-OFFBOARDING.md) (a school leaving; "built, not used"), [`SCIM-LIFECYCLE-MANAGEMENT.md`](../SCIM-LIFECYCLE-MANAGEMENT.md), [`DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md) (student half), [`DATA-RETENTION-EXPORT-DELETION.md`](../DATA-RETENTION-EXPORT-DELETION.md), [`DECISION-RIGHTS.md`](../DECISION-RIGHTS.md).

## Mechanisms that exist

| Mechanism | Does | Evidence |
| --- | --- | --- |
| `role_grants.expires_at`, `revoked_at` | Grant stops satisfying `has_capability` at read time | `20260921223000_role_grants.sql` |
| `private.revoke_grants_on_deprovision` | When `institution_membership.status` becomes `deprovisioned`, revokes **school-scoped** grants | `20260930210000`; `offboarding-grants.check.sql` |
| `audit_role_grant_change` | Audits grant and revoke into `role_grant_audit_event` | `role-grant-audit.check.sql` |
| School offboarding RPCs | Propose, preflight, approve, notice, disable, export, verify, archive, restore, authorize purge | `20260930200000_school_offboarding.sql`; `school-offboarding.check.sql` |
| `leave_school`, `revoke_school_membership` | Student or admin ends a school membership | `20260930185000` |
| Legal hold | Refuses account deletion while a hold is live; sweeps are hold-aware | `20260930100000`; `legal-holds.check.sql` and three sweep suites |
| `delete-account` function, `private.account_data_map()` | Student export and erasure | Edge Function; `deletion.check.sql` |
| Erasure scrubs audit copies | Removes personal copies from audit rows | `20261004190000` |
| `family_grants` expiry and revoke | Guardian consent ends | `family.check.sql` |
| Break-glass four-hour cap | Elevated access expires | `console-approvals.check.sql` |
| Retention sweeps | `private.sweep_*`, scheduled by pg_cron | `scheduler.sql`; production schedule UNVERIFIED |

## Required steps, per the brief, against what exists

| Step | Built for |
| --- | --- |
| Trigger and owner | School offboarding (propose, approve). No trigger for person or role changes |
| Record-authority assessment | `school_offboarding` preflight |
| Retention and legal-hold check | Yes, hold-aware |
| Open-work ownership transfer | Not built for any role |
| Session and credential revocation | Account-level only through Supabase Auth; no per-role session revoke UI |
| Membership and capability removal | School scope only (RG-03) |
| Service account, API, webhook handling | `scim_credential` and integration pause exist; no app or webhook revoke flow; no developer principal |
| Export and portability | Student export; school export in offboarding RPCs |
| Archive and deletion schedule | Offboarding archive and purge authorization; sweeps |
| Final audit event | Offboarding writes `audit_event`; per-role flows do not exist |
| Completion evidence | Offboarding verify step; others none |

## The nine flows

| Flow | State | What is missing |
| --- | --- | --- |
| Student graduation, leave, transfer, withdrawal, alumni transition | Not built. `leave_school` ends membership only. `alumni` role holds no capability | Graduation review, transition to alumni with a student choice of what continues, scope removal with audit |
| Faculty and TA end-of-term access sunset | Partial: `expires_at` can be set on a grant. Course-scoped grants are not revoked on deprovision | Term-end job, grade handoff check, archive |
| Advisor caseload reassignment | Not built (no caseload) | Caseload model, reassignment, share handling |
| Registrar and admin role transfer | Two separate console grants and a revoke | Transfer flow with open-work handoff; the legacy `app_admins` flag is outside this path (RG-01) |
| Guardian consent expiry and revocation | Built | Expiry sweep schedule UNVERIFIED |
| Institutional customer cancellation and portability | Backend RPCs built | No UI (gap register Implementation #22); no customer ever offboarded; billing and portability tie-in UNVERIFIED |
| Partner or developer app deprecation | Not started | Everything |
| Semester employee offboarding | Not started in product. Manual: revoke grant, rotate secrets per `SECRETS.md`, with one operator | HR trigger, checklist, access review, evidence |
| Board member access expiry | Not started | Board portal and expiring grant |

## Defects to fix before any offboarding claim

1. Extend revocation on deprovision to organization, course, department, office, residence, business, employer, cohort and partner scopes that belong to the tenant (RG-03). The migration states the gap itself.
2. Move offboarding and enforcement gates off `private.is_app_admin()` onto a capability (RG-01).
3. Add step-up to `approve_offboarding` and `set_school_enforcement` (RG-10).
4. Prove the retention sweeps are scheduled in production; a restore has never been done in production ([`RESTORE.md`](../../RESTORE.md)).
