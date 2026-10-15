# Semester personal-data processing register — controlled draft

- **Status:** `INCOMPLETE`
- **Owner:** Harrison Rubin, Privacy primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Legal status:** not a completed statutory record of processing activities

## Purpose and rule

This register captures candidate processing activities and the evidence required to approve them. Legal roles, bases, statutory applicability, special-category treatment, international-transfer mechanisms and retention periods require qualified review for the actual entity, audiences, ages, jurisdictions, customers, providers and configuration.

## Processing register

| Activity | Subjects/data | Purpose/source | Role/authority | Systems/providers/regions | Recipients | Retention/rights | Security evidence | Status and missing proof |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| individual local planning | students/users; course/tasks/content | user-requested planning | `[ROLE/BASIS TBD]` | device/browser | user-directed only | device/user controls | local product controls | `PARTIAL`; age/jurisdiction and device behavior |
| optional account/sync | account/profile and synchronized workspace | continuity across devices | `[TBD]` | Supabase services/regions `[VERIFY]` | authorized user/service | schedule/export/delete `[VERIFY]` | RLS and account checks | `PARTIAL`; production/provider evidence |
| institutional pilot | cohort identity, approved sources and scoped usage | contracted pilot purposes | `[CONTROLLER/PROCESSOR/SCHOOL-OFFICIAL ANALYSIS TBD]` | tenant/gateway/providers `[TBD]` | approved customer/providers | customer schedule `[TBD]` | tenant/policy tests | `CONDITIONAL`; no signed/live tenant |
| AI assistance | prompt/context/output/usage metadata | requested assistive feature | `[TBD]` | approved provider/model/region `[TBD]` | configured provider | `[TBD]` | gateway/policy/kill-switch sources | `CONDITIONAL`; terms/evaluation/activation |
| support/security | request, diagnostics, audit/security events | help, integrity and incident response | `[TBD]` | support/audit systems | authorized operators/providers | `[TBD]` | capability/audit sources | `PARTIAL`; staffing/exercise |
| procurement/sales | institutional contacts and response records | relationship/procurement | `[TBD]` | `[CRM/EMAIL/SYSTEM TBD]` | authorized personnel/vendors | `[TBD]` | incomplete | **MISSING / EXTERNAL** |
| rights/legal/contract records | identity, request, decision and evidence | rights, legal and contractual duties | `[TBD]` | controlled records systems `[TBD]` | authorized parties | legal schedule/hold `[TBD]` | draft processes | `INCOMPLETE` |

## Required activity fields

Entity and role; data subjects/ages; categories/sensitivity; sources; purpose; authority/legal basis; collection status; recipients; subprocessors; transfers/regions/mechanism; retention/backups/hold; rights/notice/consent; automated/AI decisions; security/access; DPIA or other assessment; contract/customer; owner; evidence; last/next review; incidents; and disposition.

## Evidence and control map

| Control | Code/config evidence | Operational evidence | Owner | Missing test/evidence |
| --- | --- | --- | --- | --- |
| schema/data-set coverage | data inventory and retention map | target production reconciliation absent | Data/Privacy | field/activity-to-schema reconciliation |
| provider/recipient coverage | subprocessor/provider sources | contracts, regions and live routes incomplete | Privacy/Security | provider activation review |
| rights/lifecycle | export/deletion/rights code and checks | no complete representative target cases | Privacy/Operations | exercised request and offboarding |
| lawful/applicable basis | none established by code | qualified legal/customer decisions absent | Counsel/Customer | applicability memo and approved record |

## Claim ceiling and activation blockers

Permitted: “Semester maintains a draft evidence-linked processing register for review.” Prohibited: complete ROPA, universal legal basis, FERPA/GDPR/COPPA compliance, approved transfers, or live customer processing. Blocks: entity/role analysis, complete field/activity map, ages/jurisdictions, notices/consent, provider terms/regions, retention, rights operations, security review, assessment requirements, named owners and approval.
