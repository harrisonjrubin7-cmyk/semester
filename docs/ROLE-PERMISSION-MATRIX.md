<!-- Rendered by supabase/tools/render_inventory.py from a database built by applying every
     migration to a throwaway Postgres 17. Do not edit by hand; regenerate:
       supabase/tools/introspect.sh supabase/tools/inventory.sql > /tmp/inv.out
       python3 supabase/tools/render_inventory.py /tmp/inv.out docs -->

# Role and permission matrix

What the migrations grant, read from a database built by applying all of them: **69 roles**, **84 capabilities**, **157 role–capability grants**. 62 roles hold at least one capability; 7 hold none and act only through rows they own.

## How to read it

- A policy asks whether the caller holds a **capability** at a **scope**, never whether they hold a role: `private.has_capability(capability, scope_kind, scope_id)`. A role is a bundle of capabilities.
- A grant lives in `role_grants(subject, role, scope_kind, scope_id)`. Scope kinds: `platform`, `school`, `organization`, `course`, `department`, `office`, `residence`, `business`, `employer`, `cohort`, `partner`. A **global** role (marked below) is granted at platform scope; every other role is scoped to a resource.
- **This is RBAC only.** The attribute rules that narrow a grant — consent, minimum age (13, and minors kept off social surfaces until 18), time-limited support-access and break-glass grants, feature state and release cohort, and object-level ownership — are enforced in policies and definer functions, not in this table. They are listed in [DEFINER-RLS-REGISTER.md](DEFINER-RLS-REGISTER.md) and proved, allowed and denied, by the `supabase/*.check.sql` suites (for example `role-grant-audit`, `support-access`, `console-approvals`, `minimum-age`, `integration-rls-matrix`).
- Student data is owned by the account (`auth.uid()`), not by a tenant or a role. No role here reads a student's private work by default.
- The UI role model (`app/src/lib/role.ts`) is not a security boundary; this table and the policies behind it are.

## Roles

| Role | Scope | Capabilities |
| --- | --- | --- |
| `academic_advisor` | resource | `help_request:respond` |
| `account_executive` | global | `account:manage`, `success:manage` |
| `admitted_student` | resource | — (none) |
| `alumni` | resource | — (none) |
| `athletic_academic_support` | resource | — (none) |
| `athletics_compliance_officer` | resource | `institution_action:publish` |
| `billing_contact` | resource | `billing:read` |
| `business_admin` | resource | `finance:approve`, `finance:approve_high`, `finance:close`, `finance:read` |
| `campaign_reviewer` | resource | `campaign:review` |
| `career_center_staff` | resource | `institution_action:publish` |
| `career_coach` | resource | `help_request:respond`, `opportunity:publish`, `skill:verify` |
| `community_manager` | resource | `community:manage` |
| `compliance_owner` | global | `compliance:manage` |
| `content_owner` | global | `content:manage` |
| `counseling_liaison` | resource | `resource:publish` |
| `customer_success` | global | `success:manage` |
| `data_steward` | global | `console:operate`, `data_request:handle` |
| `dean` | resource | `demand:read`, `migration:approve`, `migration:view`, `outcomes:read`, `record:approve`, `record:read` |
| `department_admin` | resource | — (none) |
| `department_chair` | resource | `demand:read` |
| `dining_staff` | resource | `dining:operate` |
| `disability_services_officer` | resource | `accommodation:verify` |
| `disability_services_staff` | resource | `institution_action:publish` |
| `dual_enrollment_student` | resource | — (none) |
| `employer` | resource | `opportunity:publish`, `talent:search` |
| `faculty` | resource | `course:publish`, `grades:enter`, `grades:export`, `grades:moderate`, `grades:release`, `help_request:respond`, `lti:launch`, `record:propose`, `skill:verify` |
| `finance_operator` | global | `billing:operate` |
| `financial_aid_officer` | resource | `finance:read`, `finance:request`, `institution_action:publish` |
| `first_year_staff` | resource | `institution_action:publish` |
| `graduate_student` | resource | `grades:receive`, `lti:launch` |
| `high_school_counselor` | resource | — (none) |
| `implementation_manager` | resource | `console:operate`, `migration:manage`, `migration:view`, `tenant:implement` |
| `incident_responder` | global | `breakglass:request`, `console:operate`, `incident:communicate`, `killswitch:engage` |
| `institutional_researcher` | resource | `demand:read`, `migration:view`, `outcomes:read` |
| `integration_admin` | resource | `integration:configure`, `integration:reconcile`, `integration:replay`, `integration:sync`, `integration:view`, `migration:manage`, `migration:view` |
| `international_student_advisor` | resource | `institution_action:publish` |
| `learning_center_staff` | resource | `help_request:respond`, `resource:publish`, `tutoring:manage` |
| `marketing_admin` | resource | `campaign:manage`, `campaign:report` |
| `marketing_analyst` | resource | `campaign:report` |
| `marketplace_partner` | resource | `opportunity:publish` |
| `moderator` | global | `moderation:action`, `opportunity:moderate`, `report:read`, `review:moderate` |
| `organization_admin` | resource | `application:manage`, `event:create`, `event:update`, `member:manage`, `organization:read`, `organization:update` |
| `organization_member` | resource | `organization:read` |
| `organization_officer` | resource | `event:create`, `event:update`, `organization:read` |
| `orientation_leader` | resource | `mentee:read` |
| `peer_mentor` | resource | `mentee:read` |
| `platform_admin` | global | `approval:decide`, `beta:manage`, `beta:triage`, `breakglass:request`, `console:operate`, `moderation:action`, `platform:configure`, `report:read` |
| `portfolio_council` | global | `governance:decide` |
| `prospective_student` | resource | — (none) |
| `registrar` | resource | `articulation:approve`, `catalog:sync`, `demand:read`, `grades:export`, `help_request:respond`, `institution_action:publish`, `migration:approve`, `migration:view`, `record:approve`, `record:override`, `record:propose`, `record:read`, `registration:administer`, `registration_window:publish` |
| `research_partner` | resource | `outcomes:read` |
| `residence_life_staff` | resource | `institution_action:publish` |
| `resident_assistant` | resource | `resource:publish` |
| `scholarship_provider` | resource | `opportunity:publish` |
| `student` | resource | `grades:receive`, `lti:launch` |
| `student_accounts_officer` | resource | `finance:approve`, `finance:read`, `finance:request`, `institution_action:publish` |
| `study_abroad_advisor` | resource | `institution_action:publish` |
| `support_agent` | global | `beta:triage`, `console:operate`, `support:ticket` |
| `teaching_assistant` | resource | `grades:enter`, `help_request:respond`, `lti:launch` |
| `transfer_partner_admin` | resource | `articulation:propose` |
| `transfer_student` | resource | `grades:receive`, `lti:launch` |
| `trust_officer` | global | `console:operate`, `trust:publish` |
| `trust_safety_reviewer` | global | `community:review` |
| `trust_safety_senior` | global | `community:escalation_agreements`, `community:review`, `community:review_senior` |
| `tutor` | resource | `help_request:respond`, `lti:launch` |
| `undergraduate_student` | resource | `grades:receive`, `lti:launch` |
| `university_admin` | resource | `ai:configure`, `audit:read`, `integration:approve`, `integration:view`, `killswitch:engage`, `migration:approve`, `migration:view`, `source:approve`, `sponsor:review`, `tenant:configure` |
| `university_staff` | resource | `help_request:respond`, `support:read` |
| `veterans_certifying_official` | resource | `institution_action:publish` |

## Capabilities

| Capability | What it allows | Held by |
| --- | --- | --- |
| `accommodation:verify` | Issue and revoke verified accommodation passports for one university. Never reads diagnoses. | `disability_services_officer` |
| `account:manage` | Semester's own institutional pipeline: accounts, buying committees, decision logs and pilots. | `account_executive` |
| `ai:configure` | Change one university tenant AI policy and budget. | `university_admin` |
| `application:manage` | Read, comment on and decide applications to one organization. | `organization_admin` |
| `approval:decide` | Decide an approval request in the operations console as a role party; seat holders decide by seat. | `platform_admin` |
| `articulation:approve` | Approve, retire or reject transfer-credit equivalencies for one university. | `registrar` |
| `articulation:propose` | Propose transfer-credit equivalencies from one partner institution. | `transfer_partner_admin` |
| `audit:read` | Read configuration and access audit events for one university tenant. | `university_admin` |
| `beta:manage` | Run an invite-only beta: programs, cohorts, invitations, known issues and activation. | `platform_admin` |
| `beta:triage` | Read and triage beta feedback, which carries no sender identity, and publish known issues. | `platform_admin`, `support_agent` |
| `billing:operate` | Semester's back office: read every billing account, subscription, invoice, contract and dunning case. Writes still go through the service role. | `finance_operator` |
| `billing:read` | Read one school's commercial records: contracts, invoices, subscriptions, renewal dates. Never configuration or student data. | `billing_contact` |
| `breakglass:request` | Request break-glass access to a production tenant through the operations console. | `incident_responder`, `platform_admin` |
| `campaign:manage` | Create and change one school's recruitment and adoption campaigns and links. Cannot review or approve its own campaign, and never reads a contact. | `marketing_admin` |
| `campaign:report` | Read one school's campaign results as suppressed counts. Never a contact, a consent row or a send. | `marketing_admin`, `marketing_analyst` |
| `campaign:review` | Record a privacy, accessibility or brand review of one school's campaign. | `campaign_reviewer` |
| `catalog:sync` | Write section capacity and seat counts for one university. | `registrar` |
| `community:escalation_agreements` | Record, activate and retire a university's escalation agreement — one person drafts, another activates. Never reads a case. | `trust_safety_senior` |
| `community:manage` | Create institution and organization communities, and approved study venues, for one university. | `community_manager` |
| `community:review` | Decide Community moderation cases (P1–P3) and appeals. Never reads a reporter. | `trust_safety_reviewer`, `trust_safety_senior` |
| `community:review_senior` | Everything community:review does, plus P0 account restrictions. | `trust_safety_senior` |
| `compliance:manage` | Read and maintain the compliance control register, evidence index and public claims register. | `compliance_owner` |
| `console:operate` | Open the operations console: read its duty matrix, council seats, figures and audit-chain status. | `data_steward`, `implementation_manager`, `incident_responder`, `platform_admin`, `support_agent`, `trust_officer` |
| `content:manage` | Read and maintain the content register and CTA routing table behind the company site. | `content_owner` |
| `course:publish` | Publish AI rules, guidance and study packs for one course. Reads nothing about students. | `faculty` |
| `data_request:handle` | Work export, deletion, correction and restriction requests. | `data_steward` |
| `demand:read` | Read anonymized course-demand snapshots (n >= 10) for one university or department. | `dean`, `department_chair`, `institutional_researcher`, `registrar` |
| `dining:operate` | Work one school's mobile-order queue: accept, ready, hand over or cancel an order, pause a location, and read the shared-swipe pool as totals. Never a balance or plan, or who gave or used a shared swipe. | `dining_staff` |
| `event:create` | Create an event for one organization. | `organization_admin`, `organization_officer` |
| `event:update` | Edit, publish, cancel and check people in to one organization's events. | `organization_admin`, `organization_officer` |
| `finance:approve` | Approve or reject a request on one school's student accounts, never one they made, and never the refund of a payment they put on the ledger. | `business_admin`, `student_accounts_officer` |
| `finance:approve_high` | Approve a refund, adjustment, reversal or aid credit at or above the school's high-value threshold. | `business_admin` |
| `finance:close` | Record a reconciliation with the payment provider, close a month, and set the school's thresholds. | `business_admin` |
| `finance:read` | Read one school's student accounts and the requests made against them. | `business_admin`, `financial_aid_officer`, `student_accounts_officer` |
| `finance:request` | Request a charge, payment, refund, adjustment, reversal, aid credit or chargeback on one school's student accounts. Never approves it. | `financial_aid_officer`, `student_accounts_officer` |
| `governance:decide` | Record a portfolio decision: score a proposed capability or tenant request and decide build, partner, integrate, defer or decline. | `portfolio_council` |
| `grades:enter` | Enter and change draft grades, and resolve regrade requests, for one course. | `faculty`, `teaching_assistant` |
| `grades:export` | Read and export released grades for one course or school, for the registrar. | `faculty`, `registrar` |
| `grades:moderate` | Moderate another grader's draft grades before release, for one course. | `faculty` |
| `grades:receive` | Be graded in one course: the gradebook's roster. | `graduate_student`, `student`, `transfer_student`, `undergraduate_student` |
| `grades:release` | Set the grading scheme, add items, release grades and queue passback for one course. | `faculty` |
| `help_request:respond` | Open and answer help requests a student chose to send to one office or course. Sees only what the student wrote and ticked; every open is recorded for the student. | `academic_advisor`, `career_coach`, `faculty`, `learning_center_staff`, `registrar`, `teaching_assistant`, `tutor`, `university_staff` |
| `incident:communicate` | Record an incident notice as sent, to one university or to every one. | `incident_responder` |
| `institution_action:publish` | Publish an official action (hold, deadline, compliance reminder) to named students or a cohort in one office scope. | `athletics_compliance_officer`, `career_center_staff`, `disability_services_staff`, `financial_aid_officer`, `first_year_staff`, `international_student_advisor`, `registrar`, `residence_life_staff`, `student_accounts_officer`, `study_abroad_advisor`, `veterans_certifying_official` |
| `integration:approve` | Approve a connection, a scope or a write direction for one university. | `university_admin` |
| `integration:configure` | Create and change one university's integration connections, scopes and field mappings. Approval of a connection is a separate step. | `integration_admin` |
| `integration:reconcile` | Work one university's reconciliation discrepancies, acknowledge schema drift and resolve duplicate candidates. Counts, redacted references and field names only — never a student's record. | `integration_admin` |
| `integration:replay` | Request a replay of a dead-lettered event. The request is reviewed and run by a worker, never executed from the browser. | `integration_admin` |
| `integration:sync` | Pause and resume one university's sync. | `integration_admin` |
| `integration:view` | See one university's integration connections, scopes, mappings, sync runs and errors. Never credentials, never a student's imported records. | `integration_admin`, `university_admin` |
| `killswitch:engage` | Engage or release a kill switch. Over the platform scope it stops every university; over a school it stops one. | `incident_responder`, `university_admin` |
| `lti:launch` | Open Semester from a course link in the school's LMS (LTI 1.3). | `faculty`, `graduate_student`, `student`, `teaching_assistant`, `transfer_student`, `tutor`, `undergraduate_student` |
| `member:manage` | Admit, remove and promote members of one organization. | `organization_admin` |
| `mentee:read` | See onboarding-checklist progress of students who accepted this mentor, within one cohort. | `orientation_leader`, `peer_mentor` |
| `migration:approve` | Record an approval or rejection of one school's migration cutover in an area such as registrar, IT or academic leadership. Never on a migration they created. | `dean`, `registrar`, `university_admin` |
| `migration:manage` | Plan and run one school's migrations out of a retiring system: inventory, mapping, cleaning rules and recorded counts. Never a student record; cannot approve a cutover. | `implementation_manager`, `integration_admin` |
| `migration:view` | Read one school's migrations, their evidence counts and approvals. | `dean`, `implementation_manager`, `institutional_researcher`, `integration_admin`, `registrar`, `university_admin` |
| `moderation:action` | Move a report along, and take the actions item 296 lists. | `moderator`, `platform_admin` |
| `opportunity:moderate` | Publish or remove submitted opportunities. | `moderator` |
| `opportunity:publish` | Draft and submit jobs, internships, scholarships or deals for review. | `career_coach`, `employer`, `marketplace_partner`, `scholarship_provider` |
| `organization:read` | See an organization's private member information, files and meetings. | `organization_admin`, `organization_member`, `organization_officer` |
| `organization:update` | Change an organization's profile and settings. | `organization_admin` |
| `outcomes:read` | Read anonymized cohort outcome aggregates (n >= 10) for one university. | `dean`, `institutional_researcher`, `research_partner` |
| `platform:configure` | Change Semester's own configuration: universities, feature flags, integrations. | `platform_admin` |
| `record:approve` | Approve or reject a proposed change to one school's academic record, never one they proposed, and link an account to its record. | `dean`, `registrar` |
| `record:override` | Approve a correction or reversal of a grade, standing or conferral already on one school's record: a registrar override. | `registrar` |
| `record:propose` | Propose a change to one school's academic record, with a reason, an effective date and its source. Never approves it. | `faculty`, `registrar` |
| `record:read` | Read one school's academic record ledger and its proposed changes. | `dean`, `registrar` |
| `registration:administer` | Run one school's registration: term calendars, sections, approvals and overrides; read its enrollments and their audit. Never a hold's reason. | `registrar` |
| `registration_window:publish` | Publish registration windows and time tickets for one university. | `registrar` |
| `report:read` | Read the trust-and-safety report queue. | `moderator`, `platform_admin` |
| `resource:publish` | Publish a support-resource action only (no deadlines, no holds). For counseling and wellbeing offices. | `counseling_liaison`, `learning_center_staff`, `resident_assistant` |
| `review:moderate` | Publish or remove course reviews, and see who wrote one. | `moderator` |
| `skill:verify` | Verify a skill a student asked to have verified, within one course or office. | `career_coach`, `faculty` |
| `source:approve` | Approve course sources for one university tenant. | `university_admin` |
| `sponsor:review` | Approve or remove one school's sponsor placements under that school's sponsorship policy. | `university_admin` |
| `success:manage` | Semester customer success: read implementation projects, success plans, QBRs, renewals and account health. | `account_executive`, `customer_success` |
| `support:read` | Inspect explainable support signals for one university tenant. | `university_staff` |
| `support:ticket` | Handle support tickets. Grants no student data without a support_access_grant. | `support_agent` |
| `talent:search` | Search opted-in, unexpired student talent profiles on behalf of one employer. | `employer` |
| `tenant:configure` | Change one university tenant configuration. | `university_admin` |
| `tenant:implement` | Configure a university tenant in sandbox during implementation. | `implementation_manager` |
| `trust:publish` | Register a trust-packet artifact and publish a new version of it. Versions are append-only; granting access to them is account:manage. | `trust_officer` |
| `tutoring:manage` | Manage tutoring availability and sessions for one learning-center office. | `learning_center_staff` |

## Consistency

- Capabilities granted to a role but not defined: none.
- Capabilities defined but held by no role: none.

## What this page does not show

It says who *may* hold a capability, not who *does*: grants are per person and per scope, in production data this page never sees. Whether a role is ready to give to a real person is the [Role Launch Register](ROLE-LAUNCH-REGISTER.md). Tenant-specific role limits on a feature flag (roles and release cohorts) are in the `tenant_feature_policy` table and `FEATURE-FLAG-REGISTRY.md`.
