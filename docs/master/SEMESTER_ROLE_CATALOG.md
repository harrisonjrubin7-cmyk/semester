# Semester role catalog

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** The role and capability counts are read from `docs/ROLE-PERMISSION-MATRIX.md` (rendered from a throwaway PostgreSQL 17 built from all migrations). Role launch maturity is from `docs/ROLE-LAUNCH-REGISTER.md`. No role is `launch-approved`. A role existing in the database is not evidence that anyone holds it in production.

## The model

A policy asks `private.has_capability(capability, scope_kind, scope_id)`. It never asks whether you hold a role. A role is a bundle of capabilities; a grant ties a subject to a role at a scope in `role_grants(subject, role, scope_kind, scope_id)`.

- **Scope kinds:** platform, school, organization, course, department, office, residence, business, employer, cohort, partner.
- **Global roles** (granted at platform scope, 14): `account_executive`, `compliance_owner`, `content_owner`, `customer_success`, `data_steward`, `finance_operator`, `incident_responder`, `moderator`, `platform_admin`, `portfolio_council`, `support_agent`, `trust_officer`, `trust_safety_reviewer`, `trust_safety_senior`. Every other role is resource-scoped.
- **RBAC only.** Attribute rules that narrow a grant live in policies and definer functions and are proved by `supabase/*.check.sql`: consent; minimum age 13 with minors off social surfaces until 18; time-limited support access and break-glass; feature state and release cohort; object ownership.
- **Student data is owned by the account** (`auth.uid()`). No role reads private work by default.
- **The UI role model (`app/src/lib/role.ts`) is not a security boundary.** The server is.
- **Separation of duties** is encoded in capability descriptions: a requester never approves; a proposer never decides; a corrector needs `record:override`; one person drafts and another activates an escalation agreement.

Counts: 69 roles, 84 capabilities, 157 role-capability grants. 62 roles hold at least one capability. Seven hold none (`admitted_student`, `alumni`, `athletic_academic_support`, `department_admin`, `dual_enrollment_student`, `high_school_counselor`, `prospective_student`), which means a defined role with no access: those are not yet usable. Role launch ladder: 46 at `provisionable`, 3 at `usable`, 18 at `secure`, 2 at `supportable`, 0 `launch-approved`.

A second vocabulary exists on the institutional gateway (`packages/institution`, `UNIVERSITY_ROLES`): student, faculty, teaching_assistant, advisor, admin, staff, applicant, payer, family, alumni. **Two role vocabularies is a drift risk.** Mapping gateway role to database role is a decision for ADR-0002.

## Role clusters

| Cluster | Roles (database names) | Primary domains | Notes |
| --- | --- | --- | --- |
| Learners | `student`, `undergraduate_student`, `graduate_student`, `transfer_student`, `dual_enrollment_student`, `admitted_student`, `prospective_student`, `alumni` | D01 to D03, D05, D23, D24 | Five of eight have no capability beyond account ownership today |
| Teaching | `faculty`, `teaching_assistant`, `tutor`, `department_chair`, `dean` | D04, D05, D08 | Course-scoped |
| Registrar and records | `registrar`, `university_staff`, `university_admin`, `department_admin` | D10 to D12 | `department_admin` holds no capability |
| Money | `student_accounts_officer`, `financial_aid_officer`, `business_admin`, `billing_contact` | D13, D14, D32 | `finance:approve_high` and `finance:close` are separated |
| Student success | `academic_advisor`, `career_center_staff`, `career_coach`, `learning_center_staff`, `counseling_liaison`, `first_year_staff`, `peer_mentor`, `orientation_leader`, `veterans_certifying_official`, `international_student_advisor`, `study_abroad_advisor`, `athletics_compliance_officer`, `athletic_academic_support` | D09, D15, D23 | Share-gated access |
| Campus services | `dining_staff`, `residence_life_staff`, `resident_assistant`, `disability_services_officer` (and staff), `high_school_counselor` | D15 to D17, D20 | Disability data is T4 |
| Community | `organization_admin`, `organization_officer`, `organization_member`, `community_manager`, `moderator` | D19 | |
| Outside | `employer`, `marketplace_partner`, `scholarship_provider`, `research_partner`, `transfer_partner_admin` | D23, D35 | No portal exists for any |
| Semester operators | `platform_admin`, `support_agent`, `incident_responder`, `trust_safety_reviewer`, `trust_safety_senior`, `trust_officer`, `data_steward`, `compliance_owner`, `content_owner`, `finance_operator`, `account_executive`, `customer_success`, `portfolio_council`, `implementation_manager`, `integration_admin`, `marketing_admin`, `marketing_analyst`, `campaign_reviewer`, `institutional_researcher` | D25 to D33 | All held by one person today |

## The brief's roles, against the database

| Brief role | Database role | Gap |
| --- | --- | --- |
| Student | `student` family | None at the model level |
| Faculty | `faculty`, `teaching_assistant` | |
| Advisor | `academic_advisor` | |
| Registrar | `registrar` | |
| Institution leader | `university_admin`, `dean`, `institutional_researcher` | Aggregate-only analytics capability should be explicit (`outcomes:read`) |
| Family/guardian | grants, not a role | By design: a family member holds a grant from a student, not a role |
| Employer | `employer` | No capability beyond `talent:search`; no portal |
| Partner | `marketplace_partner`, `research_partner` | No portal |
| Semester operator | the operator cluster above | One person; no second approver |
| Security/privacy | `compliance_owner`, `data_steward`, `trust_officer` | |
| Student success staff | `first_year_staff`, `learning_center_staff` | |
| Developer | none | A developer role and app registration model are not in the role table |
| Customer-side executive sponsor, champion, IT lead, data steward, registrar liaison, accessibility lead, privacy officer | none | The seven customer-side seats are "NOT IDENTIFIED" (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`); these are program seats, not application roles |

## Role-by-domain capability matrix (summary)

● = the role holds capabilities in that domain; ○ = may read a share the student granted; blank = none. Assembled by hand from role and capability names in `docs/ROLE-PERMISSION-MATRIX.md`; it is a summary, not a rendering, so check a cell against that file before relying on it. It is an authorisation map, not a statement that anyone is provisioned.

| Role | D01 Student OS | D04/D05 Course and grades | D09 Success | D10-12 Records | D13 Finance | D19 Community | D24 Family | D26-28 Identity/data | D29-31 Security and ops |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| student (any) | ● own | ● own | ● own | ○ own | ○ own | ● | ● grants | ● own | |
| faculty | | ● course | ○ | | | | | | |
| teaching_assistant | | ● course | | | | | | | |
| academic_advisor | | | ● shares | ○ | | | | | |
| registrar | | | | ● | | | | | |
| student_accounts_officer | | | | | ● | | | | |
| financial_aid_officer | | | | | ● read/request | | | | |
| disability_services_officer | | ○ | ○ | | | | | | |
| moderator / trust_safety_* | | | | | | ● | | | |
| data_steward | | | | | | | | ● | ○ |
| compliance_owner | | | | | | | | ● | ● |
| platform_admin | | | | | | | | ● | ● |
| support_agent | | | | | | | | | ● time-limited |
| incident_responder | | | | | | | | | ● |
| integration_admin | | | | | | | | ● | |

## Role definition template

The platform constitution requires ten attributes for a role before it exists. Every new role needs this record (`docs/PLATFORM-CONSTITUTION.md`):

```yaml
role: <database name>
cluster: <cluster>
purpose: <one sentence>
scope_kinds: [school, course, ...]
capabilities: [<domain:verb>, ...]
data_classes_readable: [T0, T1, ...]      # never above what the purpose needs
separation_of_duties: <who must not hold this with which other role>
consent_required: <what a student must grant first, if any>
provisioning: <SCIM group | invitation | operator grant>
audit: <what is logged on use>
owner_seat: <council seat>
launch_state: defined|modeled|provisionable|usable|secure|supportable|launch-approved
```

## Required next steps (also in the backlog)

1. Give each of the seven capability-less roles a capability set or retire it (P2).
2. Decide the mapping between the gateway role vocabulary and `app_roles` (ADR-0002, P0 with Phase 1 step 7).
3. Add a `developer` / `app` principal with scoped credentials (platform ecosystem plan).
4. Dual-control proof in database check suites for `finance:approve_high`, `finance:close`, `record:override`, `grades:release` (ADR-0010).
5. Two people in the operator cluster before any two-person control can be exercised.
