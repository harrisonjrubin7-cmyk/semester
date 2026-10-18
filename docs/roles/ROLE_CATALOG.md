# Role catalog

**As of** 2026-10-05 · **Part of** [`ROLE_SYSTEM_MASTER_MAP.md`](ROLE_SYSTEM_MASTER_MAP.md) · **Status** audit evidence.

The brief names about 110 roles in six families. The database defines 69 (`public.app_roles`, confirmed on the live project: 69 roles, 96 capabilities, 185 role-capability rows, 4 `role_grants` rows). This page maps every brief role to what exists. Role state is the ladder in [`ROLE-LAUNCH-REGISTER.md`](../ROLE-LAUNCH-REGISTER.md); this page does not recompute it. Where a role holds no capability, state is as the register shows it.

**Reading the columns.** *DB role* is a row of `app_roles`. *Other* is a non-role mechanism that stands in (a grant, a membership, a table). *None* means no database role and no stand-in found. *Ladder* is the register's state, or `—`.

**Four vocabularies for "a role" exist in code** and are not mapped to each other (RG-02): `app_roles` (69), `UNIVERSITY_ROLES` in `packages/institution` and `Role` in `app/src/lib/role.ts` (the same ten: student, faculty, teaching_assistant, advisor, admin, staff, applicant, payer, family, alumni), `FlightRole` in `app/src/lib/flight-plan.ts` (twelve), and `profiles.account_role` (student, parent, mentor). Only the first is an authority. ADR-0002 (proposed) names the mapping as undecided.

## A. Learner and education-community roles

| Brief role | Internal / external | DB role | Other | Ladder | Notes |
| --- | --- | --- | --- | --- | --- |
| Self-serve student | external | none | account-owned data, `profiles.account_role` | n/a | Needs no grant; data is owned by `auth.uid()` |
| Institution-linked student | external, tenant | `student`, `undergraduate_student`, `graduate_student`, `transfer_student` | `profiles.school_id` via `claim_school()`, `school_membership_requests`, `institution_membership` | secure (first three), provisionable | Capabilities: `lti:launch`, `grades:receive` |
| Applicant | external | `prospective_student`, `admitted_student` | gateway role `applicant` | provisionable | Both hold no capability |
| Alumni / lifelong learner | external | `alumni` | | provisionable | Holds no capability |
| Parent / guardian | external | none, by design | `family_grants`, `family_invites`, `guardian_links` | n/a | Grant from a student, not a role |
| Peer mentor | external | `peer_mentor`, `orientation_leader` | `peer_mentor_assignments` | provisionable | `mentee:read`, cohort-scoped, only after the student accepts |
| Community member | external | none | `community_members` + `private.community_role` | n/a | |
| Student organization leader | external | `organization_admin`, `organization_officer`, `organization_member` | `organization_members.capabilities` (duplicate store, RG-18) | provisionable | |

## B. Teaching and learning roles

| Brief role | DB role | Ladder | Notes |
| --- | --- | --- | --- |
| Faculty member | `faculty` | secure | `grades:enter/moderate/release/export`, `course:publish`, `record:propose`, `skill:verify` |
| Teaching assistant | `teaching_assistant` | secure | `grades:enter`, `help_request:respond`, `lti:launch` |
| Course designer | none | — | `course:publish` is held by `faculty` |
| Department chair | `department_chair` | provisionable | `demand:read` only |
| Learning support / tutor | `tutor`, `learning_center_staff` | secure | |
| Accessibility-services teaching support | `disability_services_officer`, `disability_services_staff` | provisionable | `accommodation:verify`; disability data is class T4 |

## C. Student success and services roles

| Brief role | DB role | Ladder | Notes |
| --- | --- | --- | --- |
| Advisor | `academic_advisor` | secure | Holds only `help_request:respond`; reads advisor shares through a live grant |
| Student-success coach | none | — | `career_coach`, `first_year_staff` are neighbours, not equivalents |
| Student-success leader | none | — | Aggregate reads: `dean`, `institutional_researcher` (`outcomes:read`) |
| Support specialist (institution) | `university_staff` | secure | `support:read`, `help_request:respond`, `guardians:manage` |
| Financial-aid liaison | `financial_aid_officer` | provisionable | `finance:request`, `finance:read` |
| Student accounts operator | `student_accounts_officer` | provisionable | `finance:approve` |
| Housing operator | `residence_life_staff`, `resident_assistant` | provisionable | Publish-only |
| Dining operator | `dining_staff` | provisionable | `dining:operate` |
| Library operator | none | — | |
| Recreation / events operator | none | — | `organization_officer` covers student organizations only |
| Campus-services operator | none | — | `university_staff` is the nearest |
| Community moderator | `moderator`, `trust_safety_reviewer` | supportable | Global roles |
| Community safety operator | `trust_safety_senior`, `community_manager` | secure, provisionable | |
| Career staff | `career_center_staff`, `career_coach` | provisionable, usable | |
| Alumni staff | none | — | |
| Employer | `employer` | secure | `talent:search`, `opportunity:publish`; no portal beyond `ListingDesk` |

## D. Academic and institutional-administration roles

| Brief role | DB role | Ladder | Notes |
| --- | --- | --- | --- |
| Registrar | `registrar` | secure | `registration:administer`, `record:*`, `override:*`, `config:publish` |
| Registrar administrator | none | — | |
| Academic affairs administrator | none | — | `dean` reads aggregates and approves `record:approve` |
| Curriculum / program administrator | none | — | `catalog:sync`, `articulation:approve` sit with `registrar` |
| Records specialist | none | — | |
| Graduation / credential specialist | none | — | No graduation workflow exists |
| Institution executive | `dean`, `institutional_researcher` | provisionable | Aggregates only |
| Institution administrator | `university_admin` | secure | `tenant:configure`, `ai:configure`, `audit:read`, `killswitch:engage` |
| Implementation lead | `implementation_manager` | provisionable | A Semester-side role; the customer-side lead is a program seat |
| IT administrator | `integration_admin` | secure | |
| Identity administrator | none | — | Split across `integration_admin` and `university_admin` |
| Security officer | none | — | Customer-side seat "NOT IDENTIFIED" in `OWNER-AND-ACCOUNTABILITY-MATRIX.md` |
| Privacy officer | none | — | Same |
| Compliance officer | `compliance_owner` (Semester-side) | provisionable | |
| Accessibility officer | none | — | |
| Finance / billing administrator | `business_admin`, `billing_contact` | provisionable | `finance:approve_high`, `finance:close` |
| Procurement / legal liaison | none | — | Trust-room guests use `trust_room_grants` |

## E. Commercial, partner and developer roles

| Brief role | DB role | Other | Notes |
| --- | --- | --- | --- |
| Institutional buyer | none | `gtm_prospects`, `site_leads`, `trust_room_grants` | Lead data is server-only (RLS, no client policy) |
| Procurement / security evaluator | none | `trust_room_grants`, `trust-room` Edge Function | NDA room opened by fragment token |
| Partner | `marketplace_partner`, `research_partner`, `scholarship_provider`, `transfer_partner_admin` | | No partner portal |
| Marketplace partner | `marketplace_partner` | | `opportunity:publish` only |
| Developer | none | | No developer principal or app registration |
| Developer organization administrator | none | | |

## F. Semester company roles

| Brief role | DB role | Notes |
| --- | --- | --- |
| Founder / CEO | `platform_admin`, `portfolio_council` | One person holds every seat today |
| COO | none | Falls back to `platform_admin` |
| CPO, Product leader, Product manager | none | |
| Product designer, UX researcher | none | |
| Software engineer, Platform engineer | none | Repository access is outside the role table |
| SRE | `incident_responder` | `killswitch:engage`, `incident:communicate`, `breakglass:request` |
| Security engineer | none | `trust_officer` publishes trust documents |
| Privacy / compliance lead | `compliance_owner`, `data_steward` | |
| Accessibility lead | none | |
| AI governance lead | none | `portfolio_council` holds `governance:decide` |
| Support specialist | `support_agent` | `support:ticket`, `console:operate` |
| Support lead | none | |
| Implementation manager | `implementation_manager` | |
| Customer-success manager | `customer_success` | |
| Account executive | `account_executive` | |
| Sales leader | none | |
| Marketing / growth lead | `marketing_admin`, `marketing_analyst`, `campaign_reviewer`, `content_owner` | Campaign author and reviewer are separate |
| Finance operator | `finance_operator` | |
| Legal / vendor operator | none | |
| People-operations operator | none | |
| Partner manager | none | |
| Developer-relations lead | none | |
| Board member, Investor / report viewer | none | No board portal |

## Database roles with no brief equivalent

Present in `app_roles` and not named by the brief: `athletics_compliance_officer`, `athletic_academic_support`, `counseling_liaison`, `dual_enrollment_student`, `high_school_counselor`, `international_student_advisor`, `study_abroad_advisor`, `veterans_certifying_official`, `university_staff`, `moderator`, `trust_safety_senior`, `institutional_researcher`, `scholarship_provider`. Keep them; map them into the families above in `ROLE_CAPABILITY_MATRIX.md`.

## Roles that hold no capability

`admitted_student`, `alumni`, `athletic_academic_support`, `department_admin`, `dual_enrollment_student`, `high_school_counselor`, `prospective_student`. A role with no capability can be granted and does nothing (RG-21).

## Per-role record

Every role needs the thirty fields in the brief's Phase 0 list. They are not completed for all 69 roles in this phase. The fields that the register already derives (state, capabilities, interface, authorization checks, runbook, training, must-be-able-to, must-never) live in `ROLE-LAUNCH-REGISTER.md` and are not duplicated. The remaining fields (approval requirements, step-up requirements, audit events, notifications, retention behaviour, owner, release-gate criteria) are completed per role as each P0 branch lands; the P0 roles are `student`, `academic_advisor`, `registrar`, `university_admin`, `integration_admin`, `implementation_manager`, `support_agent`, `platform_admin`, `incident_responder` and `faculty`.

Named owner for every company seat today is Harrison Rubin, with every backup unassigned ([`OWNER-AND-ACCOUNTABILITY-MATRIX.md`](../../OWNER-AND-ACCOUNTABILITY-MATRIX.md)).
