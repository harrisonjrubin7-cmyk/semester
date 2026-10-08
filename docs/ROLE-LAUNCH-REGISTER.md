# Role Launch Register

<!-- Rendered from app/src/lib/rolelaunch.ts by rolelaunch.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Every role the database can grant, and how far each has come towards being
switched on in a customer tenant. The roles are the rows of `public.app_roles`
and their capabilities the rows of `public.role_capabilities`, read out of
`supabase/migrations/` by the test that renders this page — so the list cannot
drift from what the database enforces.

A role's state is not written down anywhere. It is the highest rung of the
ladder below reached with every rung under it also reached, derived from the
evidence. A role is enabled for a customer only at **launch approved**.

| State | Meaning | Roles at this state | Roles holding this rung |
| --- | --- | ---: | ---: |
| defined | Role, purpose, scope, and boundaries documented | 0 | 69 |
| modeled | Role/capability/scope exists in authorization model | 0 | 69 |
| provisionable | Admin/SCIM/SSO/manual workflow can assign and revoke it | 46 | 69 |
| usable | Role-specific screens and workflow are implemented | 3 | 23 |
| secure | Positive and negative authorization tests pass | 18 | 47 |
| supportable | Training, runbook, audit trail, support routing, and recovery exist | 2 | 2 |
| launch-approved | All required role acceptance criteria and sign-offs pass | 0 | 0 |

## The finding

All 69 roles are at least **provisionable**, through one path: the
operations console’s `role-grant` duty (`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`).
A request names the person, the role, the scope and the expiry; the security
seat approves it, never the requester; `console_act()` writes the audit event
first and the grant second, and writes nothing when the event cannot be
written (`supabase/console-approvals.check.sql`). No SSO claim or SCIM group
assigns an app role, and `rolelaunch.test.ts` asserts from the code that
nothing else writes `role_grants`. What each role holds beyond this rung is
what the right-hand column above counts.

Two further limits on what the columns below prove:

- **Authorization checks** lists the SQL checks under `supabase/` that name the
  role. Naming it is necessary for a positive and negative test, not proof of
  both. The brief asks for a provision, positive, negative and revocation test
  per role; nobody has yet sorted these checks into those four.
- **Audit event** is not a column. Grants and revocations are audited
  (`supabase/role-grant-audit.check.sql`); the per-capability audit event the
  brief asks for has not been mapped.

## Student and learner roles

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `prospective_student` | provisionable | ✓ ✓ ✓ · · · · | — | — | — | — | — | Explore public programs, career paths, readiness tools, estimated cost/plan tools | Institutional records, other users’ data |
| `student` | secure | ✓ ✓ ✓ ✓ ✓ · · | `lti:launch`<br>`grades:receive` | `app/src/screens/Today.tsx` | `academic-record.check.sql`<br>`admins.check.sql`<br>`commercial-automation.check.sql`<br>`company-roles-student-data.check.sql`<br>`configuration-studio.check.sql`<br>`console-control-plane.check.sql`<br>`console-no-student-rows.check.sql`<br>`deletion.check.sql`<br>`expansion.check.sql`<br>`gradebook.check.sql`<br>`gtm.check.sql`<br>`help-requests.check.sql`<br>`human-overrides.check.sql`<br>`integration-hardening.check.sql`<br>`intelligence-policy.check.sql`<br>`legal-holds.check.sql`<br>`lti-capability.check.sql`<br>`lti-membership.check.sql`<br>`mentor-rosters.check.sql`<br>`migration-center.check.sql`<br>`officeactions.check.sql`<br>`onboarding-journeys.check.sql`<br>`productivity-commands.check.sql`<br>`retention-sweeps.check.sql`<br>`role-grant-audit.check.sql`<br>`roster-import.check.sql`<br>`student-accounts.check.sql`<br>`student-payment-plans.check.sql`<br>`support-access.check.sql`<br>`support-case-access.check.sql`<br>`trust-room.check.sql`<br>`workflow-builder.check.sql` | — | `docs/launch/STUDENT-QUICK-START.md`<br>`docs/launch/FIRST-DAY-CHECKLISTS.md` | Plan, study, search, create work, connect accounts, manage privacy, selectively share | Other students’ private records, unauthorized institutional data |
| `undergraduate_student` | secure | ✓ ✓ ✓ ✓ ✓ · · | `lti:launch`<br>`grades:receive` | `app/src/screens/Today.tsx` | `dining.check.sql`<br>`gradebook.check.sql`<br>`lti-capability.check.sql`<br>`registration_transaction.check.sql` | — | `docs/launch/STUDENT-QUICK-START.md` | Everything a student may, scoped to an undergraduate program | Other students’ private records, unauthorized institutional data |
| `graduate_student` | secure | ✓ ✓ ✓ ✓ ✓ · · | `lti:launch`<br>`grades:receive` | `app/src/screens/Today.tsx` | `gradebook.check.sql` | — | `docs/launch/STUDENT-QUICK-START.md` | Manage graduate milestones, funding and work planning, course/research workflows | Other students’ records |
| `admitted_student` | provisionable | ✓ ✓ ✓ · · · · | — | — | — | — | — | Complete pre-arrival actions, first-term planning, orientation actions, accepted mentor workflow | Current-student restricted data unless enrolled/authorized |
| `transfer_student` | provisionable | ✓ ✓ ✓ · · · · | `lti:launch`<br>`grades:receive` | — | — | — | — | Prepare transfer evaluation request, view approved articulation rules, use estimates | Self-verify transfer credit or approve equivalencies |
| `dual_enrollment_student` | provisionable | ✓ ✓ ✓ · · · · | — | — | — | — | — | Use authorized planning and shared workflows with required guardian protections | Unconsented sharing or general student network features |
| `alumni` | provisionable | ✓ ✓ ✓ · ✓ · · | — | — | `expansion.check.sql`<br>`mentor-rosters.check.sql`<br>`minimum-age.check.sql` | — | — | Maintain selected profile, mentoring offer, alumni tools | Current student data absent explicit contact/consent |

## Academic and support roles

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `faculty` | secure | ✓ ✓ ✓ ✓ ✓ · · | `skill:verify`<br>`help_request:respond`<br>`lti:launch`<br>`course:publish`<br>`record:propose`<br>`grades:enter`<br>`grades:moderate`<br>`grades:release`<br>`grades:export` | `app/src/components/HelpInbox.tsx` | `academic-record.check.sql`<br>`advisor.check.sql`<br>`console-scoped-tenant-access.check.sql`<br>`coursestudio.check.sql`<br>`demand.check.sql`<br>`expansion.check.sql`<br>`gradebook.check.sql`<br>`human-overrides.check.sql`<br>`ledger-chains.check.sql`<br>`ledger-seals.check.sql`<br>`lti-capability.check.sql`<br>`onboarding-journeys.check.sql`<br>`role-grant-audit.check.sql`<br>`rolegrants.check.sql` | — | `docs/FACULTY-ENABLEMENT.md`<br>`docs/launch/FIRST-DAY-CHECKLISTS.md` | Build/manage course content, define course AI policy, teach, assess, grade, give feedback | Private student plans, diagnoses, unrelated records |
| `teaching_assistant` | secure | ✓ ✓ ✓ ✓ ✓ · · | `help_request:respond`<br>`lti:launch`<br>`grades:enter` | `app/src/components/HelpInbox.tsx` | `gradebook.check.sql`<br>`lti-membership.check.sql`<br>`rolegrants.check.sql` | — | `docs/FACULTY-ENABLEMENT.md` | Perform delegated, course-scoped grading/support duties | Unapproved grade controls or unrelated course/student data |
| `academic_advisor` | secure | ✓ ✓ ✓ ✓ ✓ · · | `help_request:respond` | `app/src/components/HelpInbox.tsx` | `advisor.check.sql`<br>`console-scoped-tenant-access.check.sql`<br>`help-requests.check.sql`<br>`share-audit.check.sql` | — | `docs/launch/FIRST-DAY-CHECKLISTS.md` | View only student-shared plans/agendas and authorized follow-up | Private study activity, health, billing, or unrestricted browsing |
| `tutor` | secure | ✓ ✓ ✓ ✓ ✓ · · | `help_request:respond`<br>`lti:launch` | `app/src/components/HelpInbox.tsx` | `help-requests.check.sql`<br>`rolegrants.check.sql` | — | — | Manage assigned tutoring/session workflow and student-consented context | Grades, private plans, unrelated student records |
| `learning_center_staff` | secure | ✓ ✓ ✓ ✓ ✓ · · | `resource:publish`<br>`tutoring:manage`<br>`help_request:respond` | `app/src/components/HelpInbox.tsx` | `coursestudio.check.sql`<br>`supportshares.check.sql` | — | — | Publish resources, manage tutoring availability/sessions where authorized | Grades or broad private student data |
| `career_coach` | usable | ✓ ✓ ✓ ✓ · · · | `skill:verify`<br>`opportunity:publish`<br>`help_request:respond` | `app/src/components/ListingDesk.tsx`<br>`app/src/components/HelpInbox.tsx` | — | — | — | Verify skills, publish opportunities and answer help requests for students who asked | Grades, private plans, or students who have not asked |
| `peer_mentor` | provisionable | ✓ ✓ ✓ · ✓ · · | `mentee:read` | — | `expansion.check.sql`<br>`mentor-rosters.check.sql` | — | — | See onboarding-checklist progress of students who accepted them, within one cohort | Any student before that student accepts the mentor |
| `orientation_leader` | provisionable | ✓ ✓ ✓ · · · · | `mentee:read` | — | — | — | — | See onboarding-checklist progress of students who accepted them, within one cohort | Academic or private records of the cohort |

## Campus offices

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `disability_services_officer` | provisionable | ✓ ✓ ✓ · ✓ · · | `accommodation:verify` | — | `expansion.check.sql` | — | — | Issue/revoke functional accommodation passport | Diagnoses in Semester; unrestricted academic records |
| `registrar` | secure | ✓ ✓ ✓ ✓ ✓ · · | `institution_action:publish`<br>`registration_window:publish`<br>`catalog:sync`<br>`articulation:approve`<br>`demand:read`<br>`help_request:respond`<br>`migration:approve`<br>`migration:view`<br>`record:propose`<br>`record:approve`<br>`record:override`<br>`record:read`<br>`registration:administer`<br>`grades:export`<br>`override:record`<br>`override:review`<br>`config:publish`<br>`config:view`<br>`workflow:publish`<br>`workflow:view` | `app/src/components/HelpInbox.tsx` | `academic-record.check.sql`<br>`configuration-studio.check.sql`<br>`demand.check.sql`<br>`expansion.check.sql`<br>`gradebook.check.sql`<br>`human-overrides.check.sql`<br>`ledger-chains.check.sql`<br>`ledger-seals.check.sql`<br>`migration-center.check.sql`<br>`officeactions.check.sql`<br>`registration_transaction.check.sql`<br>`school-offboarding.check.sql`<br>`workflow-builder.check.sql` | — | — | Publish catalog, requirements, windows, approved articulation decisions, institutional actions | Individual private plans, AI memory, unrestricted student browsing |
| `department_chair` | provisionable | ✓ ✓ ✓ · ✓ · · | `demand:read` | — | `demand.check.sql`<br>`gradebook.check.sql` | — | — | View allowed aggregate demand/outcomes for scope | Individual records |
| `dean` | provisionable | ✓ ✓ ✓ · ✓ · · | `demand:read`<br>`outcomes:read`<br>`migration:approve`<br>`migration:view`<br>`record:approve`<br>`record:read` | — | `academic-record.check.sql` | — | — | View allowed school-level aggregates and decisions | Individual records without explicit authorization |
| `institutional_researcher` | provisionable | ✓ ✓ ✓ · ✓ · · | `demand:read`<br>`outcomes:read`<br>`migration:view`<br>`config:view`<br>`workflow:view` | — | `academic-record.check.sql`<br>`configuration-studio.check.sql`<br>`expansion.check.sql`<br>`migration-center.check.sql`<br>`workflow-builder.check.sql` | — | — | View governed, aggregate, suppressed analytics | Individual student records |
| `financial_aid_officer` | provisionable | ✓ ✓ ✓ · ✓ · · | `institution_action:publish`<br>`finance:request`<br>`finance:read` | — | `officeactions.check.sql`<br>`student-accounts.check.sql`<br>`student-payment-plans.check.sql` | — | — | Publish limited official actions/checklists | Student plans/cost scenarios unless specifically authorized |
| `student_accounts_officer` | provisionable | ✓ ✓ ✓ · ✓ · · | `institution_action:publish`<br>`finance:request`<br>`finance:approve`<br>`finance:read` | — | `ledger-chains.check.sql`<br>`ledger-seals.check.sql`<br>`student-accounts.check.sql`<br>`student-payment-plans.check.sql` | — | — | Publish limited billing/action prompts | Student cost plans or payment details |
| `international_student_advisor` | provisionable | ✓ ✓ ✓ · · · · | `institution_action:publish` | — | — | — | — | Publish compliance actions under approved scope | Private student segments beyond approved source/need |
| `veterans_certifying_official` | provisionable | ✓ ✓ ✓ · · · · | `institution_action:publish` | — | — | — | — | Publish certification actions under approved scope | Private plans or unrelated data |
| `dining_staff` | provisionable | ✓ ✓ ✓ · ✓ · · | `dining:operate` | — | `dining.check.sql` | — | — | Work one school’s mobile-order queue, pause a location, read the shared-swipe pool as totals (dining:operate) | A student’s balance or plan, or who gave or used a shared swipe |
| `residence_life_staff` | provisionable | ✓ ✓ ✓ · · · · | `institution_action:publish` | — | — | — | — | Publish residence/action information under scope | Roommate detail, precise location, academic records |
| `resident_assistant` | provisionable | ✓ ✓ ✓ · ✓ · · | `resource:publish` | — | `officeactions.check.sql` | — | — | Publish approved resource/event information | Resident academic or private data |
| `counseling_liaison` | provisionable | ✓ ✓ ✓ · · · · | `resource:publish` | — | — | — | — | Publish resource-only actions | Student records or private wellbeing data |
| `athletics_compliance_officer` | provisionable | ✓ ✓ ✓ · ✓ · · | `institution_action:publish` | — | `supportshares.check.sql` | — | — | Publish approved compliance actions | Health, injury, private study behavior, motivation inference |
| `career_center_staff` | provisionable | ✓ ✓ ✓ · · · · | `institution_action:publish` | — | — | — | — | Publish career-office actions and events to the students they reach (D-048) | Individual private plans, grades, or who acted on an action below a group of ten |
| `disability_services_staff` | provisionable | ✓ ✓ ✓ · · · · | `institution_action:publish` | — | — | — | — | Publish disability-services resources and events (D-048) | Accommodation records, health information, or which student opened a resource |
| `study_abroad_advisor` | provisionable | ✓ ✓ ✓ · · · · | `institution_action:publish` | — | — | — | — | Publish study-abroad actions, deadlines and events (D-048) | A student’s own study-abroad plan unless the student shares it |
| `first_year_staff` | provisionable | ✓ ✓ ✓ · · · · | `institution_action:publish` | — | — | — | — | Publish first-year actions and events to the students they reach (D-048) | Individual private plans or study activity |
| `athletic_academic_support` | provisionable | ✓ ✓ ✓ · ✓ · · | — | — | `supportshares.check.sql` | — | — | Read only what an athlete chose to share with them, while the share is live (D-039) | Grades, NIL, hours logs, health, finances, location, or any share once revoked or expired |

## Institutional administration

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `university_admin` | secure | ✓ ✓ ✓ ✓ ✓ · · | `tenant:configure`<br>`ai:configure`<br>`source:approve`<br>`audit:read`<br>`integration:view`<br>`integration:approve`<br>`killswitch:engage`<br>`sponsor:review`<br>`migration:approve`<br>`migration:view`<br>`hold:read`<br>`hold:place`<br>`hold:release`<br>`override:review`<br>`config:manage`<br>`config:publish`<br>`config:view`<br>`workflow:manage`<br>`workflow:publish`<br>`workflow:view`<br>`guardians:manage` | `app/src/components/institutional/ControlPlane.tsx`<br>`app/src/components/institutional/IntegrationDashboard.tsx` | `answer-rights-requests.check.sql`<br>`audit-and-subject-requests.check.sql`<br>`canonical-display.check.sql`<br>`commercial.check.sql`<br>`configuration-studio.check.sql`<br>`console-approvals.check.sql`<br>`console-control-plane.check.sql`<br>`console-integration-health.check.sql`<br>`console-scoped-tenant-access.check.sql`<br>`evidence-graphs.check.sql`<br>`feature_cohorts.check.sql`<br>`governance.check.sql`<br>`gtm.check.sql`<br>`human-overrides.check.sql`<br>`institutional-foundation.check.sql`<br>`integration-control-plane.check.sql`<br>`integration-quality.check.sql`<br>`intelligence-policy.check.sql`<br>`k12-guardians.check.sql`<br>`legal-holds.check.sql`<br>`lti-capability.check.sql`<br>`migration-center.check.sql`<br>`module_mode.check.sql`<br>`offboarding-grants.check.sql`<br>`role-grant-audit.check.sql`<br>`school-membership.check.sql`<br>`school-offboarding.check.sql`<br>`share-audit.check.sql`<br>`tenant-plan.check.sql`<br>`tenant-rollout.check.sql`<br>`tenant-sso-policy.check.sql`<br>`trust-room.check.sql`<br>`workflow-builder.check.sql` | — | `docs/launch/FIRST-DAY-CHECKLISTS.md`<br>`docs/SSO-TENANT-ONBOARDING.md` | Configure tenant, modules, branding, approved sources, policy, aggregate dashboards | Unrestricted education-record browsing |
| `department_admin` | provisionable | ✓ ✓ ✓ · · · · | — | — | — | — | — | Manage approved department content and scoped configuration | Other department/tenant records |
| `university_staff` | secure | ✓ ✓ ✓ ✓ ✓ · · | `support:read`<br>`help_request:respond`<br>`guardians:manage` | `app/src/components/HelpInbox.tsx` | `console-approvals.check.sql`<br>`console-control-plane.check.sql`<br>`dining.check.sql`<br>`export-withholds-guardian-restrictions.check.sql`<br>`k12-guardians.check.sql`<br>`support-access.check.sql`<br>`support-case-access.check.sql` | — | — | Perform only an explicitly granted, scoped duty | Implicit global authority |
| `integration_admin` | secure | ✓ ✓ ✓ ✓ ✓ · · | `integration:view`<br>`integration:configure`<br>`integration:sync`<br>`integration:replay`<br>`integration:reconcile`<br>`migration:manage`<br>`migration:view`<br>`config:manage`<br>`config:view`<br>`workflow:manage`<br>`workflow:view` | `app/src/components/institutional/IntegrationDashboard.tsx` | `canonical-display.check.sql`<br>`configuration-studio.check.sql`<br>`console-integration-health.check.sql`<br>`console-no-student-rows.check.sql`<br>`dining.check.sql`<br>`integration-control-plane.check.sql`<br>`integration-hardening.check.sql`<br>`integration-quality.check.sql`<br>`integration-rls-matrix.check.sql`<br>`migration-center.check.sql`<br>`workflow-builder.check.sql` | `docs/INTEGRATION-OPERATOR-RUNBOOK.md` | — | Configure integrations, security policy, audit/access processes | Student content unless separately authorized and audited |
| `implementation_manager` | provisionable | ✓ ✓ ✓ · ✓ · · | `tenant:implement`<br>`console:operate`<br>`migration:manage`<br>`migration:view`<br>`config:manage`<br>`config:view`<br>`workflow:manage`<br>`workflow:view` | — | `configuration-studio.check.sql`<br>`console-control-plane.check.sql`<br>`console-integration-health.check.sql`<br>`console-no-student-rows.check.sql`<br>`console-release-incidents.check.sql`<br>`console-scoped-tenant-access.check.sql`<br>`console-security-reads.check.sql`<br>`console-tenant-operations.check.sql`<br>`governance.check.sql`<br>`help-requests.check.sql`<br>`migration-center.check.sql`<br>`privacy-case-workspace.check.sql`<br>`workflow-builder.check.sql` | — | `docs/SSO-TENANT-ONBOARDING.md` | Configure sandbox tenant and launch setup | Broad production student-data access |
| `data_steward` | provisionable | ✓ ✓ ✓ · ✓ · · | `data_request:handle`<br>`console:operate` | — | `answer-rights-requests.check.sql`<br>`console-control-plane.check.sql`<br>`console-no-student-rows.check.sql`<br>`console-security-reads.check.sql`<br>`expansion.check.sql`<br>`governance.check.sql`<br>`privacy-case-actions.check.sql`<br>`privacy-case-workspace.check.sql` | — | — | Process data requests under strict workflow | AI memories and student plans absent required authority |
| `portfolio_council` | provisionable | ✓ ✓ ✓ · ✓ · · | `governance:decide` | — | `governance.check.sql` | — | — | Decide governance items put to the council | Any individual student record |
| `billing_contact` | provisionable | ✓ ✓ ✓ · ✓ · · | `billing:read` | — | `commercial.check.sql` | — | — | Read one school’s contracts, invoices, subscriptions and renewal dates | The school’s configuration, implementation records or any student data |

## Semester platform operations

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `platform_admin` | secure | ✓ ✓ ✓ ✓ ✓ · · | `report:read`<br>`moderation:action`<br>`platform:configure`<br>`beta:manage`<br>`beta:triage`<br>`console:operate`<br>`approval:decide`<br>`breakglass:request` | `app/src/screens/Moderation.tsx` | `admins.check.sql`<br>`beta.check.sql`<br>`capabilities.check.sql`<br>`community.check.sql`<br>`console-approvals.check.sql`<br>`console-command-center.check.sql`<br>`console-control-plane.check.sql`<br>`console-integration-health.check.sql`<br>`console-no-student-rows.check.sql`<br>`console-release-incidents.check.sql`<br>`console-scoped-tenant-access.check.sql`<br>`console-security-reads.check.sql`<br>`governance.check.sql`<br>`integration-quality.check.sql`<br>`legal-holds.check.sql`<br>`lti-capability.check.sql`<br>`privacy-case-workspace.check.sql`<br>`rolegrants.check.sql`<br>`school-membership.check.sql`<br>`school-offboarding.check.sql`<br>`schools.check.sql` | — | — | Maintain platform operations under least privilege and audit | Automatic access to all application data |
| `support_agent` | provisionable | ✓ ✓ ✓ · ✓ · · | `support:ticket`<br>`beta:triage`<br>`console:operate` | — | `beta.check.sql`<br>`console-control-plane.check.sql`<br>`console-security-reads.check.sql`<br>`support-case-access.check.sql`<br>`support-tickets.check.sql` | `docs/market-readiness/SUPPORT_PLAYBOOK.md` | — | Handle support tickets and approved support-access sessions | Student data without live student-created grant |
| `incident_responder` | provisionable | ✓ ✓ ✓ · ✓ · · | `killswitch:engage`<br>`incident:communicate`<br>`console:operate`<br>`breakglass:request` | — | `console-control-plane.check.sql`<br>`console-no-student-rows.check.sql`<br>`console-release-incidents.check.sql`<br>`console-security-reads.check.sql`<br>`governance.check.sql`<br>`integration-control-plane.check.sql` | `docs/CRISIS-RESPONSE-RUNBOOK.md` | — | Engage a kill switch and communicate an incident | Student data beyond what the incident requires |
| `moderator` | supportable | ✓ ✓ ✓ ✓ ✓ ✓ · | `report:read`<br>`moderation:action`<br>`review:moderate`<br>`opportunity:moderate` | `app/src/screens/Moderation.tsx`<br>`app/src/components/ListingDesk.tsx` | `capabilities.check.sql`<br>`community.check.sql`<br>`expansion.check.sql`<br>`listings.check.sql`<br>`moderation-audit.check.sql`<br>`my-capabilities.check.sql`<br>`reports.check.sql`<br>`rolegrants.check.sql` | `docs/CAMPUS-MODERATION-SOP.md` | `docs/VOLUNTEER-MODERATOR-PROGRAM.md` | Moderate reviews/opportunities, with author access strictly audited | Unrelated private student data |
| `trust_safety_reviewer` | supportable | ✓ ✓ ✓ ✓ ✓ ✓ · | `community:review` | `app/src/components/community/Escalation.tsx` | `community.check.sql` | `docs/CAMPUS-MODERATION-SOP.md`<br>`docs/CAMPUS-ESCALATION-POLICY.md` | `docs/VOLUNTEER-MODERATOR-PROGRAM.md` | Review community cases and propose actions for a second reviewer | Private student data outside the case |
| `trust_safety_senior` | secure | ✓ ✓ ✓ ✓ ✓ · · | `community:review`<br>`community:review_senior`<br>`community:escalation_agreements` | `app/src/components/community/Escalation.tsx` | `community.check.sql` | `docs/CAMPUS-MODERATION-SOP.md`<br>`docs/CAMPUS-ESCALATION-POLICY.md` | — | Approve or refuse escalations and hold escalation agreements | Private student data outside the case |
| `community_manager` | provisionable | ✓ ✓ ✓ · ✓ · · | `community:manage` | — | `community.check.sql` | `docs/CAMPUS-MODERATION-SOP.md` | — | Manage community spaces and their rules | Private student data or case content without review rights |

## External and partner roles

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `employer` | secure | ✓ ✓ ✓ ✓ ✓ · · | `talent:search`<br>`opportunity:publish` | `app/src/components/ListingDesk.tsx` | `expansion.check.sql`<br>`listings.check.sql`<br>`lti-capability.check.sql` | — | — | Search only opted-in, unexpired talent profiles; publish opportunities if approved | Non-opted-in profiles, grades, plans, student records |
| `scholarship_provider` | usable | ✓ ✓ ✓ ✓ · · · | `opportunity:publish` | `app/src/components/ListingDesk.tsx` | — | — | — | Publish/maintain own approved listing | Student education records |
| `marketplace_partner` | usable | ✓ ✓ ✓ ✓ · · · | `opportunity:publish` | `app/src/components/ListingDesk.tsx` | — | — | — | Publish approved deals/housing listings | Student data absent authorized interaction |
| `transfer_partner_admin` | provisionable | ✓ ✓ ✓ · ✓ · · | `articulation:propose` | — | `expansion.check.sql` | — | — | Propose equivalencies within partner scope | Approve own proposals or inspect student records |
| `high_school_counselor` | provisionable | ✓ ✓ ✓ · · · · | — | — | — | — | — | Use public/consented dual-enrollment workflow only | Student institutional record by default |
| `research_partner` | provisionable | ✓ ✓ ✓ · · · · | `outcomes:read` | — | — | — | — | View only approved aggregate outcomes meeting suppression thresholds | Individual student-level records |
| `business_admin` | provisionable | ✓ ✓ ✓ · ✓ · · | `finance:approve`<br>`finance:approve_high`<br>`finance:close`<br>`finance:read` | — | `lti-capability.check.sql`<br>`student-accounts.check.sql`<br>`student-payment-plans.check.sql` | — | — | Nothing yet: the role exists and holds no capability | Any student record |

## Student organizations

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `organization_member` | provisionable | ✓ ✓ ✓ · ✓ · · | `organization:read` | — | `capabilities.check.sql`<br>`lti-capability.check.sql`<br>`rolegrants.check.sql` | — | — | Read one organization’s member information, files and meetings | Other organizations, or members’ academic records |
| `organization_officer` | provisionable | ✓ ✓ ✓ · ✓ · · | `organization:read`<br>`event:create`<br>`event:update` | — | `rolegrants.check.sql` | — | — | Create and run one organization’s events | Admitting or removing members; other organizations |
| `organization_admin` | provisionable | ✓ ✓ ✓ · ✓ · · | `organization:read`<br>`organization:update`<br>`member:manage`<br>`application:manage`<br>`event:create`<br>`event:update` | — | `capabilities.check.sql`<br>`institutional-foundation.check.sql`<br>`rolegrants.check.sql` | — | — | Manage one organization’s profile, members, applications and events | Other organizations, or members’ academic records |

## Semester commercial team

| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `account_executive` | provisionable | ✓ ✓ ✓ · ✓ · · | `account:manage`<br>`success:manage` | — | `gtm.check.sql`<br>`trust-room.check.sql` | — | `docs/gtm/EXECUTION-PLAN.md` | Manage a prospect account and send its procurement room | Any student data |
| `trust_officer` | provisionable | ✓ ✓ ✓ · ✓ · · | `trust:publish`<br>`console:operate` | — | `console-control-plane.check.sql`<br>`console-security-reads.check.sql`<br>`trust-room.check.sql` | `docs/trust/README.md` | — | Publish documents to the trust room | Any student data |
| `marketing_admin` | secure | ✓ ✓ ✓ ✓ ✓ · · | `campaign:manage`<br>`campaign:report` | `app/src/components/institutional/CampaignManager.tsx` | `gtm.check.sql` | — | — | Manage and report on campaigns | Any student data; sending a campaign nobody reviewed |
| `marketing_analyst` | secure | ✓ ✓ ✓ ✓ ✓ · · | `campaign:report` | `app/src/components/institutional/CampaignManager.tsx` | `gtm.check.sql` | — | — | Read campaign reports | Editing or sending campaigns; any student data |
| `campaign_reviewer` | secure | ✓ ✓ ✓ ✓ ✓ · · | `campaign:review` | `app/src/components/institutional/CampaignManager.tsx` | `gtm.check.sql` | — | — | Review a campaign before it is sent | Authoring the campaign they review |
| `finance_operator` | provisionable | ✓ ✓ ✓ · ✓ · · | `billing:operate` | — | `commercial.check.sql` | `docs/COMMERCIAL-CORE.md` | — | Read every billing account, subscription, invoice, contract and dunning case | Account health; writing a price, invoice or payment through the API; any student data |
| `customer_success` | provisionable | ✓ ✓ ✓ · · · · | `success:manage` | — | — | `docs/COMMERCIAL-CORE.md` | — | Read implementation projects, success plans, QBRs, renewals and account health | Any student data; outreach from a health snapshot nobody reviewed |
| `compliance_owner` | provisionable | ✓ ✓ ✓ · · · · | `compliance:manage` | — | — | — | — | Read and maintain the control register, evidence index and public claims register | Activating a claim with no control, owner and review date; any student data |
| `content_owner` | provisionable | ✓ ✓ ✓ · · · · | `content:manage` | — | — | — | — | Read and maintain the content register and CTA routing table | Publishing content with no owner, review date or source; any student data |

## The internal boundary

No Semester-internal role — the platform operations and commercial rows above —
inherits access to a student's records because it is internal. `rolelaunch.test.ts`
holds the matrix to two lists in `rolelaunch.ts`, in both directions: an internal
role may hold only an operations capability, and never one that reaches a student's
own records. A grant outside either list fails the build until somebody judges it.

| Internal roles may hold | Internal roles never hold |
| --- | --- |
| `console:operate`<br>`approval:decide`<br>`breakglass:request`<br>`beta:manage`<br>`beta:triage`<br>`platform:configure`<br>`support:ticket`<br>`incident:communicate`<br>`killswitch:engage`<br>`moderation:action`<br>`report:read`<br>`review:moderate`<br>`opportunity:moderate`<br>`community:review`<br>`community:review_senior`<br>`community:escalation_agreements`<br>`community:manage`<br>`account:manage`<br>`success:manage`<br>`billing:operate`<br>`compliance:manage`<br>`content:manage`<br>`campaign:manage`<br>`campaign:report`<br>`campaign:review`<br>`trust:publish` | `mentee:read`<br>`help_request:respond`<br>`accommodation:verify`<br>`skill:verify`<br>`support:read`<br>`data_request:handle`<br>`talent:search`<br>`lti:launch`<br>`audit:read`<br>`outcomes:read`<br>`demand:read`<br>`registration:administer` |

## Role × capability

One row per row of `public.role_capabilities`. A capability's checks are the SQL checks that name it.

| Role | Capability | Interface | Checks naming the capability |
| --- | --- | --- | --- |
| `student` | `lti:launch` | — | `lti-capability.check.sql` |
| `student` | `grades:receive` | — | — |
| `undergraduate_student` | `lti:launch` | — | `lti-capability.check.sql` |
| `undergraduate_student` | `grades:receive` | — | — |
| `graduate_student` | `lti:launch` | — | `lti-capability.check.sql` |
| `graduate_student` | `grades:receive` | — | — |
| `transfer_student` | `lti:launch` | — | `lti-capability.check.sql` |
| `transfer_student` | `grades:receive` | — | — |
| `faculty` | `skill:verify` | — | — |
| `faculty` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `faculty` | `lti:launch` | — | `lti-capability.check.sql` |
| `faculty` | `course:publish` | — | — |
| `faculty` | `record:propose` | — | — |
| `faculty` | `grades:enter` | — | — |
| `faculty` | `grades:moderate` | — | — |
| `faculty` | `grades:release` | — | — |
| `faculty` | `grades:export` | — | — |
| `teaching_assistant` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `teaching_assistant` | `lti:launch` | — | `lti-capability.check.sql` |
| `teaching_assistant` | `grades:enter` | — | — |
| `academic_advisor` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `tutor` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `tutor` | `lti:launch` | — | `lti-capability.check.sql` |
| `learning_center_staff` | `resource:publish` | — | — |
| `learning_center_staff` | `tutoring:manage` | — | — |
| `learning_center_staff` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `career_coach` | `skill:verify` | — | — |
| `career_coach` | `opportunity:publish` | `app/src/components/ListingDesk.tsx` | — |
| `career_coach` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `peer_mentor` | `mentee:read` | — | — |
| `orientation_leader` | `mentee:read` | — | — |
| `disability_services_officer` | `accommodation:verify` | — | — |
| `registrar` | `institution_action:publish` | — | — |
| `registrar` | `registration_window:publish` | — | — |
| `registrar` | `catalog:sync` | — | — |
| `registrar` | `articulation:approve` | — | — |
| `registrar` | `demand:read` | — | — |
| `registrar` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `registrar` | `migration:approve` | — | — |
| `registrar` | `migration:view` | — | — |
| `registrar` | `record:propose` | — | — |
| `registrar` | `record:approve` | — | — |
| `registrar` | `record:override` | — | — |
| `registrar` | `record:read` | — | `human-overrides.check.sql` |
| `registrar` | `registration:administer` | — | — |
| `registrar` | `grades:export` | — | — |
| `registrar` | `override:record` | — | — |
| `registrar` | `override:review` | — | — |
| `registrar` | `config:publish` | — | — |
| `registrar` | `config:view` | — | — |
| `registrar` | `workflow:publish` | — | — |
| `registrar` | `workflow:view` | — | — |
| `department_chair` | `demand:read` | — | — |
| `dean` | `demand:read` | — | — |
| `dean` | `outcomes:read` | — | — |
| `dean` | `migration:approve` | — | — |
| `dean` | `migration:view` | — | — |
| `dean` | `record:approve` | — | — |
| `dean` | `record:read` | — | `human-overrides.check.sql` |
| `institutional_researcher` | `demand:read` | — | — |
| `institutional_researcher` | `outcomes:read` | — | — |
| `institutional_researcher` | `migration:view` | — | — |
| `institutional_researcher` | `config:view` | — | — |
| `institutional_researcher` | `workflow:view` | — | — |
| `financial_aid_officer` | `institution_action:publish` | — | — |
| `financial_aid_officer` | `finance:request` | — | — |
| `financial_aid_officer` | `finance:read` | — | — |
| `student_accounts_officer` | `institution_action:publish` | — | — |
| `student_accounts_officer` | `finance:request` | — | — |
| `student_accounts_officer` | `finance:approve` | — | — |
| `student_accounts_officer` | `finance:read` | — | — |
| `international_student_advisor` | `institution_action:publish` | — | — |
| `veterans_certifying_official` | `institution_action:publish` | — | — |
| `dining_staff` | `dining:operate` | — | — |
| `residence_life_staff` | `institution_action:publish` | — | — |
| `resident_assistant` | `resource:publish` | — | — |
| `counseling_liaison` | `resource:publish` | — | — |
| `athletics_compliance_officer` | `institution_action:publish` | — | — |
| `career_center_staff` | `institution_action:publish` | — | — |
| `disability_services_staff` | `institution_action:publish` | — | — |
| `study_abroad_advisor` | `institution_action:publish` | — | — |
| `first_year_staff` | `institution_action:publish` | — | — |
| `university_admin` | `tenant:configure` | `app/src/components/institutional/ControlPlane.tsx` | `console-approvals.check.sql`<br>`console-security-reads.check.sql`<br>`institutional-foundation.check.sql`<br>`my-capabilities.check.sql`<br>`offboarding-grants.check.sql`<br>`school-offboarding.check.sql` |
| `university_admin` | `ai:configure` | — | — |
| `university_admin` | `source:approve` | — | — |
| `university_admin` | `audit:read` | — | `console-approvals.check.sql`<br>`console-control-plane.check.sql` |
| `university_admin` | `integration:view` | `app/src/components/institutional/IntegrationDashboard.tsx` | `console-approvals.check.sql` |
| `university_admin` | `integration:approve` | — | — |
| `university_admin` | `killswitch:engage` | — | — |
| `university_admin` | `sponsor:review` | — | — |
| `university_admin` | `migration:approve` | — | — |
| `university_admin` | `migration:view` | — | — |
| `university_admin` | `hold:read` | — | — |
| `university_admin` | `hold:place` | — | — |
| `university_admin` | `hold:release` | — | — |
| `university_admin` | `override:review` | — | — |
| `university_admin` | `config:manage` | — | — |
| `university_admin` | `config:publish` | — | — |
| `university_admin` | `config:view` | — | — |
| `university_admin` | `workflow:manage` | — | — |
| `university_admin` | `workflow:publish` | — | — |
| `university_admin` | `workflow:view` | — | — |
| `university_admin` | `guardians:manage` | — | — |
| `university_staff` | `support:read` | — | `support-access.check.sql`<br>`support-retention.check.sql` |
| `university_staff` | `help_request:respond` | `app/src/components/HelpInbox.tsx` | — |
| `university_staff` | `guardians:manage` | — | — |
| `integration_admin` | `integration:view` | `app/src/components/institutional/IntegrationDashboard.tsx` | `console-approvals.check.sql` |
| `integration_admin` | `integration:configure` | — | — |
| `integration_admin` | `integration:sync` | — | — |
| `integration_admin` | `integration:replay` | — | — |
| `integration_admin` | `integration:reconcile` | — | — |
| `integration_admin` | `migration:manage` | — | — |
| `integration_admin` | `migration:view` | — | — |
| `integration_admin` | `config:manage` | — | — |
| `integration_admin` | `config:view` | — | — |
| `integration_admin` | `workflow:manage` | — | — |
| `integration_admin` | `workflow:view` | — | — |
| `implementation_manager` | `tenant:implement` | — | — |
| `implementation_manager` | `console:operate` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql`<br>`projection-foundation.check.sql` |
| `implementation_manager` | `migration:manage` | — | — |
| `implementation_manager` | `migration:view` | — | — |
| `implementation_manager` | `config:manage` | — | — |
| `implementation_manager` | `config:view` | — | — |
| `implementation_manager` | `workflow:manage` | — | — |
| `implementation_manager` | `workflow:view` | — | — |
| `data_steward` | `data_request:handle` | — | — |
| `data_steward` | `console:operate` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql`<br>`projection-foundation.check.sql` |
| `portfolio_council` | `governance:decide` | — | — |
| `platform_admin` | `report:read` | `app/src/screens/Moderation.tsx` | `capabilities.check.sql`<br>`my-capabilities.check.sql`<br>`reports.check.sql` |
| `platform_admin` | `moderation:action` | `app/src/screens/Moderation.tsx` | `capabilities.check.sql`<br>`reports.check.sql` |
| `platform_admin` | `platform:configure` | — | `capabilities.check.sql`<br>`institutional-foundation.check.sql` |
| `platform_admin` | `beta:manage` | — | `capabilities.check.sql` |
| `platform_admin` | `beta:triage` | — | `capabilities.check.sql` |
| `platform_admin` | `console:operate` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql`<br>`projection-foundation.check.sql` |
| `platform_admin` | `approval:decide` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql` |
| `platform_admin` | `breakglass:request` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql` |
| `support_agent` | `support:ticket` | — | — |
| `support_agent` | `beta:triage` | — | `capabilities.check.sql` |
| `support_agent` | `console:operate` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql`<br>`projection-foundation.check.sql` |
| `incident_responder` | `killswitch:engage` | — | — |
| `incident_responder` | `incident:communicate` | — | — |
| `incident_responder` | `console:operate` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql`<br>`projection-foundation.check.sql` |
| `incident_responder` | `breakglass:request` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql` |
| `moderator` | `report:read` | `app/src/screens/Moderation.tsx` | `capabilities.check.sql`<br>`my-capabilities.check.sql`<br>`reports.check.sql` |
| `moderator` | `moderation:action` | `app/src/screens/Moderation.tsx` | `capabilities.check.sql`<br>`reports.check.sql` |
| `moderator` | `review:moderate` | — | — |
| `moderator` | `opportunity:moderate` | `app/src/components/ListingDesk.tsx` | — |
| `trust_safety_reviewer` | `community:review` | `app/src/components/community/Escalation.tsx` | — |
| `trust_safety_senior` | `community:review` | `app/src/components/community/Escalation.tsx` | — |
| `trust_safety_senior` | `community:review_senior` | — | — |
| `trust_safety_senior` | `community:escalation_agreements` | — | — |
| `community_manager` | `community:manage` | — | — |
| `employer` | `talent:search` | — | — |
| `employer` | `opportunity:publish` | `app/src/components/ListingDesk.tsx` | — |
| `scholarship_provider` | `opportunity:publish` | `app/src/components/ListingDesk.tsx` | — |
| `marketplace_partner` | `opportunity:publish` | `app/src/components/ListingDesk.tsx` | — |
| `transfer_partner_admin` | `articulation:propose` | — | — |
| `research_partner` | `outcomes:read` | — | — |
| `business_admin` | `finance:approve` | — | — |
| `business_admin` | `finance:approve_high` | — | — |
| `business_admin` | `finance:close` | — | — |
| `business_admin` | `finance:read` | — | — |
| `organization_member` | `organization:read` | — | `capabilities.check.sql`<br>`institutional-foundation.check.sql` |
| `organization_officer` | `organization:read` | — | `capabilities.check.sql`<br>`institutional-foundation.check.sql` |
| `organization_officer` | `event:create` | — | `capabilities.check.sql` |
| `organization_officer` | `event:update` | — | — |
| `organization_admin` | `organization:read` | — | `capabilities.check.sql`<br>`institutional-foundation.check.sql` |
| `organization_admin` | `organization:update` | — | — |
| `organization_admin` | `member:manage` | — | `capabilities.check.sql` |
| `organization_admin` | `application:manage` | — | `capabilities.check.sql` |
| `organization_admin` | `event:create` | — | `capabilities.check.sql` |
| `organization_admin` | `event:update` | — | — |
| `account_executive` | `account:manage` | — | — |
| `account_executive` | `success:manage` | — | — |
| `trust_officer` | `trust:publish` | — | — |
| `trust_officer` | `console:operate` | — | `capabilities.check.sql`<br>`console-control-plane.check.sql`<br>`projection-foundation.check.sql` |
| `marketing_admin` | `campaign:manage` | `app/src/components/institutional/CampaignManager.tsx` | — |
| `marketing_admin` | `campaign:report` | `app/src/components/institutional/CampaignManager.tsx` | — |
| `marketing_analyst` | `campaign:report` | `app/src/components/institutional/CampaignManager.tsx` | — |
| `campaign_reviewer` | `campaign:review` | `app/src/components/institutional/CampaignManager.tsx` | — |
| `finance_operator` | `billing:operate` | — | — |
| `customer_success` | `success:manage` | — | — |
| `compliance_owner` | `compliance:manage` | — | — |
| `content_owner` | `content:manage` | — | — |
| `billing_contact` | `billing:read` | — | — |

## Roles the brief names that are not app roles

| Brief | Where its access lives |
| --- | --- |
| Parent/supporter | A family grant the student issues and can revoke (`accept_family_grant`, 20260921161500_roles.sql), not a role anybody holds over a student. |
| Institution admin | `university_admin`. |
| IT/security | Split between `integration_admin` and `university_admin`; there is no single IT role. |
| Alumni mentor | `alumni` offering mentoring, seen through `peer_mentor` only after a student accepts. |
