# Workflow catalog

_Generated 2026-10-05 from ui_kits/master-catalog/catalog-data.js, ui_kits/workflow-runner/runner-data.js and os-map-data.js. Design-level only: nothing here is verified until repo code, RLS/tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist._

17 workflows, 319 steps. Each row resolves the control chain for that step.

## Student journey

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Create account | Student | — | form | Identity | Student account | identity.form | Directory | Per role | Semester | identity.create_account | Catalogued | P2 |
| 2 | Join institution | Student | Institutional IT | form | Identity | GAP | identity.form | Directory | Per role | Semester | identity.join_institution | Designed (prototype) | P2 |
| 3 | Confirm identity | Student | Institutional IT | review | Identity | GAP | identity.review | Directory | Per role | Semester | identity.confirm_identity | Catalogued | P2 |
| 4 | Connect SSO | Student | Institutional IT | form | Identity | GAP | identity.form | Directory | Per role | Semester | identity.connect_sso | Designed (prototype) | P2 |
| 5 | Complete onboarding | Student | — | form | Student Workspace | GAP | student_workspace.form | Internal | Per role | Semester | student_workspace.complete_onboarding | Designed (prototype) | P2 |
| 6 | Select program/path | Student | — | form | Academic Path | Path | academic_path.form | Internal | Per role | Semester | academic_path.select_program_path | Catalogued | P2 |
| 7 | Import or review course context | Student | — | sync | Course | GAP | course.sync | Internal | Per role | Semester | course.import_or_review_course_context | Catalogued | P1 |
| 8 | Review Today | Student | — | review | Task | Today | task.review | Internal | Per role | Semester | task.review_today | Designed (prototype) | P2 |
| 9 | Create action/task | Student | — | form | Task | Action Center | task.form | Internal | Per role | Semester | task.create_action_task | Catalogued | P2 |
| 10 | Complete first meaningful action | Student | — | form | Task | Action Center | task.form | Internal | Per role | Semester | task.complete_first_meaningful_action | Designed (prototype) | P2 |
| 11 | Build term plan | Student | — | form | Academic Path | Plan | academic_path.form | Internal | Per role | Semester | academic_path.build_term_plan | Designed (prototype) | P2 |
| 12 | Compare courses/sections | Student | — | review | Registration | Section comparison | registration.review | Education record | Per role | Official system (SIS/LMS) | registration.compare_courses_sections | Catalogued | P0 |
| 13 | Review registration readiness | Student | Registrar staff | review | Registration | Registration readiness | registration.review | Education record | Per role | Official system (SIS/LMS) | registration.review_registration_readiness | Designed (prototype) | P0 |
| 14 | Resolve hold through official handoff | Student | Registrar staff | handoff | Financial Account | Holds | financial_account.handoff | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.resolve_hold_through_official_handoff | Designed (prototype) | P0 |
| 15 | Enroll or request registration | Student | Registrar staff | handoff | Registration | Registration readiness | registration.handoff | Education record | Per role | Official system (SIS/LMS) | registration.enroll_or_request_registration | Designed (prototype) | P0 |
| 16 | Build study plan | Student | — | form | Student Workspace | Plan | student_workspace.form | Internal | Per role | Semester | student_workspace.build_study_plan | Catalogued | P2 |
| 17 | Join course workspace | Student | — | form | Course | Project workspace | course.form | Internal | Per role | Semester | course.join_course_workspace | Catalogued | P2 |
| 18 | Read course guidance | Student | — | review | Course | Course AI guidance | course.review | Internal | Per role | Semester | course.read_course_guidance | Catalogued | P2 |
| 19 | Follow course AI rules | Student | — | form | AI Gateway | Priv: Classification rules | ai_gateway.form | Classified per request | Per role | Semester | ai_gateway.follow_course_ai_rules | Designed (prototype) | P0 |
| 20 | Use AI copilot | Student | — | ai | AI Gateway | AI Copilot | ai_gateway.ai | Classified per request | Per role | Semester | ai_gateway.use_ai_copilot | Designed (prototype) | P0 |
| 21 | Search approved sources | Student | — | ai | AI Gateway | Course search | ai_gateway.ai | Classified per request | Per role | Semester | ai_gateway.search_approved_sources | Catalogued | P0 |
| 22 | Create notes | Student | — | form | Notes | Notes | notes.form | Internal | Per role | Semester | notes.create_notes | Catalogued | P2 |
| 23 | Organize files | Student | — | form | Files | Files | files.form | Internal | Per role | Semester | files.organize_files | Catalogued | P2 |
| 24 | Join study group | Student | — | form | Community | Study groups | community.form | Personal · student-controlled | Per role | Semester | community.join_study_group | Catalogued | P2 |
| 25 | Request peer mentor | Student | Peer mentor | handoff | Career | Peer mentor directory | career.handoff | Personal · student-controlled | Per role | Semester | career.request_peer_mentor | Catalogued | P2 |
| 26 | Request advisor support | Student | Academic advisor | handoff | Support | Financial-support handoff | support.handoff | Personal (minimum context) | Per role | Semester | support.request_advisor_support | Catalogued | P2 |
| 27 | Share with advisor | Student | Academic advisor | consent | Privacy | Advisor sharing | privacy.consent | Personal · consent-bound | Required | Semester | privacy.share_with_advisor | Designed (prototype) | P0 |
| 28 | Share with family | Student | Family/guardian | consent | Privacy | Family sharing | privacy.consent | Personal · consent-bound | Required | Semester | privacy.share_with_family | Designed (prototype) | P0 |
| 29 | Review student account | Student | Student accounts staff | review | Financial Account | Student account | financial_account.review | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.review_student_account | Catalogued | P0 |
| 30 | Request payment plan | Student | Student accounts staff | handoff | Payment Plan | Payment plan | payment_plan.handoff | Education record · financial | Per role | Semester | payment_plan.request_payment_plan | Catalogued | P0 |
| 31 | Find campus resource | Student | — | form | Course | Course resources | course.form | Internal | Per role | Semester | course.find_campus_resource | Catalogued | P2 |
| 32 | Order dining | Student | Dining/campus-card staff | form | Dining | Dining | dining.form | Internal | Per role | Semester | dining.order_dining | Catalogued | P2 |
| 33 | Join organization/event | Student | Student organization leader | form | Community | Organization events | community.form | Personal · student-controlled | Per role | Semester | community.join_organization_event | Catalogued | P2 |
| 34 | Build portfolio | Student | — | form | Career | Portfolio | career.form | Personal · student-controlled | Per role | Semester | career.build_portfolio | Catalogued | P2 |
| 35 | Search opportunity | Student | — | review | Career | Opportunity search | career.review | Personal · student-controlled | Per role | Semester | career.search_opportunity | Catalogued | P2 |
| 36 | Apply for opportunity | Student | Employer | handoff | Career | Opportunities | career.handoff | Personal · student-controlled | Per role | Semester | career.apply_for_opportunity | Catalogued | P2 |
| 37 | Export personal data | Student | Institutional security/privacy | consent | Privacy | Data export | privacy.consent | Personal · consent-bound | Required | Semester | privacy.export_personal_data | Designed (prototype) | P0 |
| 38 | Adjust privacy/AI settings | Student | — | consent | AI Gateway | Privacy settings | ai_gateway.consent | Classified per request | Required | Semester | ai_gateway.adjust_privacy_ai_settings | Designed (prototype) | P0 |
| 39 | Request deletion/correction | Student | Institutional security/privacy | consent | Privacy | Account deletion request | privacy.consent | Personal · consent-bound | Required | Semester | privacy.request_deletion_correction | Catalogued | P0 |
| 40 | Transition to alumni | Student | Alumni | handoff | Career | Alumni mentor offers | career.handoff | Personal · student-controlled | Per role | Semester | career.transition_to_alumni | Catalogued | P2 |

## Faculty course lifecycle

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Accept course assignment | Faculty/instructor | Department chair | form | Assessment | Assignments | assessment.form | Education record | Per role | Semester | assessment.accept_course_assignment | Catalogued | P0 |
| 2 | Configure course workspace | Faculty/instructor | — | form | Course | Feedback workspace | course.form | Internal | Per role | Semester | course.configure_course_workspace | Catalogued | P2 |
| 3 | Publish syllabus | Faculty/instructor | Student | form | Course | Syllabus | course.form | Internal | Per role | Semester | course.publish_syllabus | Catalogued | P2 |
| 4 | Publish learning objectives | Faculty/instructor | — | form | Course | Learning objectives | course.form | Internal | Per role | Semester | course.publish_learning_objectives | Catalogued | P2 |
| 5 | Publish course guidance | Faculty/instructor | Student | form | Course | Course guidance | course.form | Internal | Per role | Semester | course.publish_course_guidance | Catalogued | P2 |
| 6 | Publish course AI policy | Faculty/instructor | Student | form | AI Gateway | GAP | ai_gateway.form | Classified per request | Per role | Semester | ai_gateway.publish_course_ai_policy | Designed (prototype) | P0 |
| 7 | Add approved resources | Faculty/instructor | — | decide | AI Gateway | Resource library | ai_gateway.decide | Classified per request | Per role | Semester | ai_gateway.add_approved_resources | Catalogued | P0 |
| 8 | Create assignment | Faculty/instructor | — | form | Assessment | Assignments | assessment.form | Education record | Per role | Semester | assessment.create_assignment | Catalogued | P0 |
| 9 | Create rubric | Faculty/instructor | — | form | Gradebook | Rubric builder | gradebook.form | Education record | Per role | Official system (SIS/LMS) | gradebook.create_rubric | Catalogued | P0 |
| 10 | Create assessment | Faculty/instructor | — | review | Assessment | Assessment builder | assessment.review | Education record | Per role | Semester | assessment.create_assessment | Catalogued | P0 |
| 11 | Create study pack | Faculty/instructor | Student | form | Course | Study packs | course.form | Internal | Per role | Semester | course.create_study_pack | Catalogued | P2 |
| 12 | Manage roster | Faculty/instructor | — | form | Course | GAP | course.form | Internal | Per role | Semester | course.manage_roster | Catalogued | P2 |
| 13 | Review student work | Faculty/instructor | Teaching assistant | review | Assessment | My Work | assessment.review | Education record | Per role | Semester | assessment.review_student_work | Catalogued | P0 |
| 14 | Provide feedback | Faculty/instructor | Teaching assistant | form | Assessment | Feedback workspace | assessment.form | Education record | Per role | Semester | assessment.provide_feedback | Catalogued | P0 |
| 15 | Enter grade | Faculty/instructor | — | form | Gradebook | Grade entry | gradebook.form | Education record | Per role | Official system (SIS/LMS) | gradebook.enter_grade | Catalogued | P0 |
| 16 | Moderate grade | Faculty/instructor | Department chair | decide | Gradebook | Grade entry | gradebook.decide | Education record | Per role | Official system (SIS/LMS) | gradebook.moderate_grade | Catalogued | P0 |
| 17 | Release grade | Faculty/instructor | Student | decide | Gradebook | Grade release | gradebook.decide | Education record | Per role | Official system (SIS/LMS) | gradebook.release_grade | Designed (prototype) | P0 |
| 18 | Resolve regrade | Faculty/instructor | Student | decide | Gradebook | Regrade queue | gradebook.decide | Education record | Per role | Official system (SIS/LMS) | gradebook.resolve_regrade | Designed (prototype) | P0 |
| 19 | Hold office hours | Faculty/instructor | Student | form | Financial Account | Office hours | financial_account.form | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.hold_office_hours | Catalogued | P0 |
| 20 | Communicate with class | Faculty/instructor | Student | comms | Course | GAP | course.comms | Internal | Per role | Semester | course.communicate_with_class | Catalogued | P2 |
| 21 | Review aggregate learning signals | Faculty/instructor | — | review | Analytics | Learning objectives | analytics.review | Aggregate, de-identified | Per role | Semester | analytics.review_aggregate_learning_signals | Catalogued | P2 |
| 22 | Review course accessibility | Faculty/instructor | Accessibility/disability services | review | Course | Course accessibility review | course.review | Internal | Per role | Semester | course.review_course_accessibility | Catalogued | P2 |
| 23 | Export/archive | Faculty/instructor | Registrar staff | sync | Migration | Course imports/exports | migration.sync | Internal | Per role | Semester | migration.export_archive | Catalogued | P1 |
| 24 | Grade passback (if approved) | Faculty/instructor | Registrar staff | decide | Gradebook | Grade passback | gradebook.decide | Education record | Per role | Official system (SIS/LMS) | gradebook.grade_passback_if_approved | Catalogued | P0 |

## Advising & student success

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Receive caseload | Academic advisor | — | review | Student Success | Caseload | student_success.review | Education record · sensitive | Per role | Semester | student_success.receive_caseload | Catalogued | P0 |
| 2 | Review student path | Academic advisor | — | review | Academic Path | Student path | academic_path.review | Internal | Per role | Semester | academic_path.review_student_path | Catalogued | P2 |
| 3 | Review action completion | Academic advisor | — | review | Task | Action completion | task.review | Internal | Per role | Semester | task.review_action_completion | Catalogued | P2 |
| 4 | Schedule meeting | Academic advisor | Student | form | Calendar | Appointment schedule | calendar.form | Internal | Per role | Semester | calendar.schedule_meeting | Catalogued | P2 |
| 5 | Record check-in | Academic advisor | Student | form | Academic Record | Check-ins | academic_record.form | Education record | Per role | Official system (SIS/LMS) | academic_record.record_check_in | Catalogued | P0 |
| 6 | Create success plan | Academic advisor | Student | form | Student Success | Success plan | student_success.form | Education record · sensitive | Per role | Semester | student_success.create_success_plan | Catalogued | P0 |
| 7 | Refer to office | Academic advisor | Counseling/wellbeing staff | handoff | Student Workspace | GAP | student_workspace.handoff | Internal | Per role | Semester | student_workspace.refer_to_office | Catalogued | P2 |
| 8 | Track referral outcome | Academic advisor | Counseling/wellbeing staff | handoff | Student Success | Referral workflow | student_success.handoff | Education record · sensitive | Per role | Semester | student_success.track_referral_outcome | Catalogued | P0 |
| 9 | Send approved outreach | Student success staff | Student | decide | Communication | Outreach queue | communication.decide | Internal | Per role | Semester | communication.send_approved_outreach | Catalogued | P0 |
| 10 | Review support request | Academic advisor | Student | handoff | Support | Support request history | support.handoff | Personal (minimum context) | Per role | Semester | support.review_support_request | Catalogued | P2 |
| 11 | Review consented share | Academic advisor | Student | consent | Privacy | GAP | privacy.consent | Personal · consent-bound | Required | Semester | privacy.review_consented_share | Designed (prototype) | P0 |
| 12 | Escalate risk through approved process | Academic advisor | Student success staff | decide | Student Success | Risk and priority signals | student_success.decide | Education record · sensitive | Per role | Semester | student_success.escalate_risk_through_approved_process | Catalogued | P0 |
| 13 | Review cohort aggregates | Student success staff | — | review | Tenant | Cohort dashboard | tenant.review | Internal | Per role | Semester | tenant.review_cohort_aggregates | Catalogued | P2 |
| 14 | Conduct term review | Academic advisor | — | review | Student Success | GAP | student_success.review | Education record · sensitive | Per role | Semester | student_success.conduct_term_review | Catalogued | P0 |
| 15 | Prepare registration readiness outreach | Student success staff | Student | comms | Registration | Registration Readiness Pilot page | registration.comms | Education record | Per role | Official system (SIS/LMS) | registration.prepare_registration_readiness_outreach | Catalogued | P0 |
| 16 | Review intervention effectiveness | Student success staff | — | review | Student Success | Intervention tracker | student_success.review | Education record · sensitive | Per role | Semester | student_success.review_intervention_effectiveness | Catalogued | P0 |
| 17 | Close or transition case | Academic advisor | Student | handoff | Student Success | GAP | student_success.handoff | Education record · sensitive | Per role | Semester | student_success.close_or_transition_case | Catalogued | P0 |

## Registrar & academic operations

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Create term | Registrar staff | — | form | Registration | Term management | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.create_term | Catalogued | P0 |
| 2 | Configure academic calendar | Registrar staff | — | form | Calendar | Academic calendar | calendar.form | Internal | Per role | Semester | calendar.configure_academic_calendar | Catalogued | P2 |
| 3 | Import/manage catalog | Registrar staff | — | sync | Academic Record | Catalog management | academic_record.sync | Education record | Per role | Official system (SIS/LMS) | academic_record.import_manage_catalog | Catalogued | P0 |
| 4 | Create sections | Registrar staff | — | form | Registration | Section management | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.create_sections | Catalogued | P0 |
| 5 | Assign capacity/waitlists | Registrar staff | — | form | AI Gateway | Capacity management | ai_gateway.form | Classified per request | Per role | Semester | ai_gateway.assign_capacity_waitlists | Catalogued | P0 |
| 6 | Define prerequisites/co-requisites | Registrar staff | — | form | Registration | Prerequisite rules | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.define_prerequisites_co_requisites | Catalogued | P0 |
| 7 | Publish registration windows | Registrar staff | Student | form | Registration | Registration windows | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.publish_registration_windows | Catalogued | P0 |
| 8 | Issue time tickets | Registrar staff | Student | form | Registration | Time tickets | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.issue_time_tickets | Catalogued | P0 |
| 9 | Sync holds | Registrar staff | Institutional IT | sync | Financial Account | Holds | financial_account.sync | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.sync_holds | Catalogued | P0 |
| 10 | Grant override | Registrar staff | Student | decide | Authorization | Overrides | authorization.decide | Internal | Per role | Semester | authorization.grant_override | Designed (prototype) | P0 |
| 11 | Review enrollment attempt | Registrar staff | Student | review | Registration | Enrollment queue | registration.review | Education record | Per role | Official system (SIS/LMS) | registration.review_enrollment_attempt | Catalogued | P0 |
| 12 | Approve/deny exception | Registrar staff | Student | decide | Developer Platform | Data-quality exceptions | developer_platform.decide | Internal | Per role | Semester | developer_platform.approve_deny_exception | Designed (prototype) | P0 |
| 13 | Manage add/drop/withdrawal | Registrar staff | Student | form | Registration | Add/drop/withdrawal workflow | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.manage_add_drop_withdrawal | Catalogued | P0 |
| 14 | Reconcile with SIS | Registrar staff | Institutional IT | sync | Integration | GAP | integration.sync | Internal | Per role | Semester | integration.reconcile_with_sis | Catalogued | P1 |
| 15 | Correct academic record | Registrar staff | — | decide | Academic Record | Academic record search | academic_record.decide | Education record | Per role | Official system (SIS/LMS) | academic_record.correct_academic_record | Catalogued | P0 |
| 16 | Manage grade changes | Registrar staff | Faculty/instructor | form | Gradebook | Grade change workflow | gradebook.form | Education record | Per role | Official system (SIS/LMS) | gradebook.manage_grade_changes | Catalogued | P0 |
| 17 | Run degree audit | Registrar staff | Academic advisor | review | Degree Audit | Degree audit rules | degree_audit.review | Education record | Per role | Official system (SIS/LMS) | degree_audit.run_degree_audit | Catalogued | P0 |
| 18 | Evaluate transfer credit | Registrar staff | Transfer student | form | Transfer | Transfer credit view | transfer.form | Education record | Per role | Official system (SIS/LMS) | transfer.evaluate_transfer_credit | Catalogued | P0 |
| 19 | Review graduation | Registrar staff | Academic advisor | review | Academic Record | Graduation review | academic_record.review | Education record | Per role | Official system (SIS/LMS) | academic_record.review_graduation | Catalogued | P0 |
| 20 | Export official records | Registrar staff | Institutional auditor | form | Academic Record | Academic record search | academic_record.form | Education record | Per role | Official system (SIS/LMS) | academic_record.export_official_records | Catalogued | P0 |
| 21 | Close-of-term audit | Registrar staff | Institutional auditor | form | Audit | Term management | audit.form | Internal | Per role | Semester | audit.close_of_term_audit | Catalogued | P2 |

## Institution implementation

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Contract signed | Semester implementation lead | Semester revenue operations | milestone | Billing | Contracts | billing.milestone | Company internal | Per role | Semester | billing.contract_signed | Catalogued | P2 |
| 2 | Tenant created | Semester implementation lead | — | milestone | Tenant | Tenant overview | tenant.milestone | Internal | Per role | Semester | tenant.tenant_created | Catalogued | P2 |
| 3 | Executive sponsor named | Institutional executive | Institutional executive | milestone | Student Workspace | Executive Overview | student_workspace.milestone | Internal | Per role | Semester | student_workspace.executive_sponsor_named | Catalogued | P2 |
| 4 | Operational champion named | Semester customer-success manager | Institutional executive | milestone | Student Workspace | GAP | student_workspace.milestone | Internal | Per role | Semester | student_workspace.operational_champion_named | Catalogued | P2 |
| 5 | Security/privacy scope confirmed | Institutional security/privacy | — | consent | Authorization | Privacy requests | authorization.consent | Internal | Required | Semester | authorization.security_privacy_scope_confirmed | Catalogued | P0 |
| 6 | Data/integration inventory | Institutional IT | — | sync | Integration | Priv: Data inventory | integration.sync | Internal | Per role | Semester | integration.data_integration_inventory | Catalogued | P1 |
| 7 | SSO/identity configured | Institutional IT | Semester implementation lead | form | Identity | Identity providers | identity.form | Directory | Per role | Semester | identity.sso_identity_configured | Catalogued | P2 |
| 8 | Tenant policy configured | Institutional IT | — | form | Tenant | Tenant overview | tenant.form | Internal | Per role | Semester | tenant.tenant_policy_configured | Catalogued | P2 |
| 9 | Roles configured | Institutional IT | Semester implementation lead | form | Authorization | Roles | authorization.form | Internal | Per role | Semester | authorization.roles_configured | Catalogued | P2 |
| 10 | Feature cohorts configured | Institutional IT | — | form | Tenant | Feature cohorts | tenant.form | Internal | Per role | Semester | tenant.feature_cohorts_configured | Catalogued | P2 |
| 11 | Data mapping approved | Institutional IT | — | decide | Integration | Data classification | integration.decide | Internal | Per role | Semester | integration.data_mapping_approved | Catalogued | P0 |
| 12 | Sandbox sync tested | Institutional IT | — | sync | Integration | Sync health | integration.sync | Internal | Per role | Semester | integration.sandbox_sync_tested | Catalogued | P1 |
| 13 | Reconciliation passed | Institutional IT | — | milestone | Integration | GAP | integration.milestone | Internal | Per role | Semester | integration.reconciliation_passed | Catalogued | P2 |
| 14 | Admin training | Semester implementation lead | Registrar staff | comms | AI Gateway | GAP | ai_gateway.comms | Classified per request | Per role | Semester | ai_gateway.admin_training | Catalogued | P0 |
| 15 | Student communication prepared | Semester customer-success manager | Student | comms | Communication | GAP | communication.comms | Internal | Per role | Semester | communication.student_communication_prepared | Catalogued | P2 |
| 16 | Launch readiness gate passed | Institutional executive | — | milestone | Student Workspace | GAP | student_workspace.milestone | Internal | Per role | Semester | student_workspace.launch_readiness_gate_passed | Catalogued | P2 |
| 17 | Controlled launch | Semester implementation lead | Student | milestone | Student Workspace | GAP | student_workspace.milestone | Internal | Per role | Semester | student_workspace.controlled_launch | Catalogued | P2 |
| 18 | Adoption monitored | Semester customer-success manager | — | review | Student Workspace | GAP | student_workspace.review | Internal | Per role | Semester | student_workspace.adoption_monitored | Catalogued | P2 |
| 19 | Support and incident path live | Semester implementation lead | Semester support operator | milestone | Academic Path | Incident notices | academic_path.milestone | Internal | Per role | Semester | academic_path.support_and_incident_path_live | Catalogued | P2 |
| 20 | Midpoint review | Institutional executive | — | review | Student Workspace | GAP | student_workspace.review | Internal | Per role | Semester | student_workspace.midpoint_review | Catalogued | P2 |
| 21 | Pilot outcome review | Institutional executive | — | review | Student Workspace | Pilot outcomes | student_workspace.review | Internal | Per role | Semester | student_workspace.pilot_outcome_review | Catalogued | P2 |
| 22 | Annual conversion or offboarding | Institutional executive | — | consent | Billing | Offboarding | billing.consent | Company internal | Required | Semester | billing.annual_conversion_or_offboarding | Catalogued | P0 |

## Controlled integration

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Integration request | Institutional IT | Institutional security/privacy | handoff | Integration | Integration analytics | integration.handoff | Internal | Per role | Semester | integration.integration_request | Catalogued | P2 |
| 2 | Business purpose defined | Institutional IT | Institutional security/privacy | form | Student Workspace | GAP | student_workspace.form | Internal | Per role | Semester | student_workspace.business_purpose_defined | Catalogued | P2 |
| 3 | Data classification identified | Institutional IT | Institutional security/privacy | review | Course | Data classification | course.review | Internal | Per role | Semester | course.data_classification_identified | Catalogued | P2 |
| 4 | Security/privacy review | Semester implementation lead | — | consent | Privacy | Security review | privacy.consent | Personal · consent-bound | Required | Semester | privacy.security_privacy_review | Catalogued | P0 |
| 5 | Scope requested | Institutional IT | Institutional security/privacy | handoff | Authorization | Scope approval | authorization.handoff | Internal | Per role | Semester | authorization.scope_requested | Catalogued | P2 |
| 6 | Tenant approval | Institutional security/privacy | Semester implementation lead | form | Tenant | Scope approval | tenant.form | Internal | Per role | Semester | tenant.tenant_approval | Catalogued | P2 |
| 7 | Credential configured server-side | Semester implementation lead | — | sync | Integration | Credentials configuration | integration.sync | Internal | Per role | Semester | integration.credential_configured_server_side | Catalogued | P1 |
| 8 | Sandbox validated | Semester implementation lead | — | sync | Integration | GAP | integration.sync | Internal | Per role | Semester | integration.sandbox_validated | Catalogued | P1 |
| 9 | Mapping created | Semester implementation lead | — | milestone | Integration | Mapping studio | integration.milestone | Internal | Per role | Semester | integration.mapping_created | Catalogued | P2 |
| 10 | Mapping version approved | Semester implementation lead | Institutional security/privacy | decide | Integration | Mapping versions | integration.decide | Internal | Per role | Semester | integration.mapping_version_approved | Catalogued | P0 |
| 11 | Read-only sync enabled | Semester implementation lead | — | sync | Integration | Sync schedule | integration.sync | Internal | Per role | Semester | integration.read_only_sync_enabled | Catalogued | P1 |
| 12 | Reconciliation passed | Semester implementation lead | — | milestone | Integration | Reconciliation dashboard | integration.milestone | Internal | Per role | Semester | integration.reconciliation_passed | Catalogued | P2 |
| 13 | Monitoring enabled | Semester implementation lead | Semester support operator | sync | Student Workspace | GAP | student_workspace.sync | Internal | Per role | Semester | student_workspace.monitoring_enabled | Catalogued | P1 |
| 14 | Write direction requested | Institutional IT | Institutional security/privacy | handoff | Integration | GAP | integration.handoff | Internal | Per role | Semester | integration.write_direction_requested | Catalogued | P2 |
| 15 | Higher approval required | Institutional security/privacy | Semester implementation lead | decide | Developer Platform | Scope approval | developer_platform.decide | Internal | Per role | Semester | developer_platform.higher_approval_required | Catalogued | P0 |
| 16 | Controlled write pilot | Semester implementation lead | — | form | Integration | GAP | integration.form | Internal | Per role | Semester | integration.controlled_write_pilot | Catalogued | P2 |
| 17 | Rollback verified | Semester implementation lead | — | form | Release | GAP | release.form | Company internal | Per role | Semester | release.rollback_verified | Catalogued | P2 |
| 18 | Production approval | Institutional security/privacy | Semester implementation lead | decide | Developer Platform | Scope approval | developer_platform.decide | Internal | Per role | Semester | developer_platform.production_approval | Catalogued | P0 |
| 19 | Periodic scope review | Institutional security/privacy | Semester implementation lead | review | Authorization | Scope approval | authorization.review | Internal | Per role | Semester | authorization.periodic_scope_review | Catalogued | P2 |
| 20 | Retirement/offboarding | Semester implementation lead | Semester support operator | consent | Student Workspace | Integration offboarding | student_workspace.consent | Internal | Required | Semester | student_workspace.retirement_offboarding | Catalogued | P0 |

## Governed AI request

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | User asks | Student | — | ai | Student Workspace | GAP | student_workspace.ai | Internal | Per role | Semester | student_workspace.user_asks | Designed (prototype) | P2 |
| 2 | Intent identified | AI gateway (system) | — | ai | AI Gateway | GAP | ai_gateway.ai | Classified per request | Per role | Semester | ai_gateway.intent_identified | Catalogued | P0 |
| 3 | Role/tenant/course scope established | AI gateway (system) | — | ai | Authorization | Tenant overview | authorization.ai | Internal | Per role | Semester | authorization.role_tenant_course_scope_established | Catalogued | P2 |
| 4 | Data classification checked | AI gateway (system) | — | review | Course | Data classification | course.review | Internal | Per role | Semester | course.data_classification_checked | Designed (prototype) | P2 |
| 5 | Consent checked | AI gateway (system) | — | consent | Privacy | Consent policy | privacy.consent | Personal · consent-bound | Required | Semester | privacy.consent_checked | Catalogued | P0 |
| 6 | Course/tenant AI policy checked | AI gateway (system) | — | review | AI Gateway | Tenant overview | ai_gateway.review | Classified per request | Per role | Semester | ai_gateway.course_tenant_ai_policy_checked | Designed (prototype) | P0 |
| 7 | Provider/model selected | AI gateway (system) | — | ai | AI Gateway | Identity providers | ai_gateway.ai | Classified per request | Per role | Semester | ai_gateway.provider_model_selected | Catalogued | P0 |
| 8 | Allowed sources retrieved | AI gateway (system) | — | ai | AI Gateway | Approved sources | ai_gateway.ai | Classified per request | Per role | Semester | ai_gateway.allowed_sources_retrieved | Catalogued | P0 |
| 9 | Prompt/tool permission validated | AI gateway (system) | — | ai | AI Gateway | GAP | ai_gateway.ai | Classified per request | Per role | Semester | ai_gateway.prompt_tool_permission_validated | Catalogued | P0 |
| 10 | Response generated | AI gateway (system) | Student | ai | Student Workspace | GAP | student_workspace.ai | Internal | Per role | Semester | student_workspace.response_generated | Catalogued | P2 |
| 11 | Sources and limits shown | AI gateway (system) | Student | review | AI Gateway | Approved sources | ai_gateway.review | Classified per request | Per role | Semester | ai_gateway.sources_and_limits_shown | Designed (prototype) | P0 |
| 12 | Suggested action presented | AI gateway (system) | Student | ai | Task | Action Center | task.ai | Internal | Per role | Semester | task.suggested_action_presented | Catalogued | P2 |
| 13 | Official handoff offered | AI gateway (system) | Registrar staff | handoff | Community | Financial-support handoff | community.handoff | Personal · student-controlled | Per role | Semester | community.official_handoff_offered | Catalogued | P2 |
| 14 | Human escalation offered | AI gateway (system) | Academic advisor | handoff | Community | GAP | community.handoff | Personal · student-controlled | Per role | Semester | community.human_escalation_offered | Catalogued | P2 |
| 15 | Usage/spend logged | AI gateway (system) | Semester product operator | ai | Audit | GAP | audit.ai | Internal | Per role | Semester | audit.usage_spend_logged | Catalogued | P2 |
| 16 | Audit/evaluation signal recorded | AI gateway (system) | Semester product operator | milestone | Academic Record | Audit explorer | academic_record.milestone | Education record | Per role | Official system (SIS/LMS) | academic_record.audit_evaluation_signal_recorded | Catalogued | P0 |
| 17 | Feedback/correction captured | Student | — | milestone | Assessment | GAP | assessment.milestone | Education record | Per role | Semester | assessment.feedback_correction_captured | Catalogued | P0 |

## Support request

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | User searches help | Student | — | review | Support | Course search | support.review | Personal (minimum context) | Per role | Semester | support.user_searches_help | Catalogued | P2 |
| 2 | Opens support request | Student | Semester support operator | handoff | Support | Support operations | support.handoff | Personal (minimum context) | Per role | Semester | support.opens_support_request | Designed (prototype) | P2 |
| 3 | Minimum safe context captured | Semester support operator | — | milestone | Student Workspace | GAP | student_workspace.milestone | Internal | Per role | Semester | student_workspace.minimum_safe_context_captured | Catalogued | P2 |
| 4 | Categorized + severity | Semester support operator | Semester support operator | form | Support | GAP | support.form | Personal (minimum context) | Per role | Semester | support.categorized_severity | Catalogued | P2 |
| 5 | Routed to team/office | Semester support operator | Semester support operator | handoff | Support | GAP | support.handoff | Personal (minimum context) | Per role | Semester | support.routed_to_team_office | Catalogued | P2 |
| 6 | Owner accepts or routes | Semester support operator | Registrar staff | handoff | Support | GAP | support.handoff | Personal (minimum context) | Per role | Semester | support.owner_accepts_or_routes | Catalogued | P2 |
| 7 | User receives status | Student | Student | comms | Student Workspace | Registration status | student_workspace.comms | Internal | Per role | Semester | student_workspace.user_receives_status | Catalogued | P2 |
| 8 | Resolution delivered | Semester support operator | Registrar staff | form | Support | GAP | support.form | Personal (minimum context) | Per role | Semester | support.resolution_delivered | Catalogued | P2 |
| 9 | Confirm or close | Student | — | review | Support | GAP | support.review | Personal (minimum context) | Per role | Semester | support.confirm_or_close | Catalogued | P2 |
| 10 | Root cause tagged | Semester support operator | — | form | Support | GAP | support.form | Personal (minimum context) | Per role | Semester | support.root_cause_tagged | Catalogued | P2 |
| 11 | Product/KB feedback loop | Semester product operator | — | form | Assessment | Products | assessment.form | Education record | Per role | Semester | assessment.product_kb_feedback_loop | Catalogued | P0 |
| 12 | SLA and satisfaction recorded | Semester support operator | — | milestone | Task | GAP | task.milestone | Internal | Per role | Semester | task.sla_and_satisfaction_recorded | Catalogued | P2 |

## Incident response

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Alert or report | Semester security operator | Semester support operator | review | Security | Operating review reports | security.review | Restricted | Per role | Semester | security.alert_or_report | Catalogued | P1 |
| 2 | Triage | Semester security operator | — | review | Security | GAP | security.review | Restricted | Per role | Semester | security.triage | Catalogued | P1 |
| 3 | Severity declared | Semester executive | — | decide | Security | GAP | security.decide | Restricted | Per role | Semester | security.severity_declared | Catalogued | P0 |
| 4 | Incident commander | Semester executive | — | milestone | Security | Incidents | security.milestone | Restricted | Per role | Semester | security.incident_commander | Catalogued | P1 |
| 5 | Technical lead | Semester security operator | — | milestone | Security | GAP | security.milestone | Restricted | Per role | Semester | security.technical_lead | Catalogued | P1 |
| 6 | Communications lead | Semester customer-success manager | — | milestone | Security | GAP | security.milestone | Restricted | Per role | Semester | security.communications_lead | Catalogued | P1 |
| 7 | Impact assessed | Semester security operator | Institutional security/privacy | review | Security | Priv: Impact assessments | security.review | Restricted | Per role | Semester | security.impact_assessed | Catalogued | P1 |
| 8 | Risky releases paused | Semester product operator | — | decide | Student Success | Release evidence | student_success.decide | Education record · sensitive | Per role | Semester | student_success.risky_releases_paused | Catalogued | P0 |
| 9 | Mitigation executed | Semester security operator | — | form | Security | GAP | security.form | Restricted | Per role | Semester | security.mitigation_executed | Catalogued | P1 |
| 10 | Internal update | Semester customer-success manager | — | comms | Communication | GAP | communication.comms | Internal | Per role | Semester | communication.internal_update | Catalogued | P2 |
| 11 | Customer update | Semester customer-success manager | Institutional executive | comms | Communication | Customer Directory | communication.comms | Internal | Per role | Semester | communication.customer_update | Catalogued | P2 |
| 12 | Recovery monitored | Semester security operator | — | review | Security | Sec: Disaster recovery | security.review | Restricted | Per role | Semester | security.recovery_monitored | Catalogued | P1 |
| 13 | Resolved | Semester security operator | — | milestone | Student Workspace | GAP | student_workspace.milestone | Internal | Per role | Semester | student_workspace.resolved | Catalogued | P2 |
| 14 | Postmortem | Semester executive | — | review | Security | GAP | security.review | Restricted | Per role | Semester | security.postmortem | Catalogued | P1 |
| 15 | Corrective actions to Inbox | Semester security operator | Semester product operator | form | Task | Operations Inbox | task.form | Internal | Per role | Semester | task.corrective_actions_to_inbox | Catalogued | P2 |
| 16 | SLO/error budget reviewed | Semester product operator | — | review | Release | Error budgets | release.review | Company internal | Per role | Semester | release.slo_error_budget_reviewed | Catalogued | P2 |
| 17 | Release policy updated | Semester product operator | — | form | Tenant | Release evidence | tenant.form | Internal | Per role | Semester | tenant.release_policy_updated | Catalogued | P2 |

## Domain migration

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Domain inventory | Semester implementation lead | — | sync | AI Gateway | GAP | ai_gateway.sync | Classified per request | Per role | Semester | ai_gateway.domain_inventory | Catalogued | P0 |
| 2 | Source data inventory | Semester implementation lead | — | sync | Student Workspace | Priv: Data inventory | student_workspace.sync | Internal | Per role | Semester | student_workspace.source_data_inventory | Catalogued | P1 |
| 3 | Field mapping | Registrar staff | — | sync | Integration | Mapping studio | integration.sync | Internal | Per role | Semester | integration.field_mapping | Catalogued | P1 |
| 4 | Data classification | Registrar staff | — | form | Course | Data classification | course.form | Internal | Per role | Semester | course.data_classification | Catalogued | P2 |
| 5 | Import staging | Semester implementation lead | — | sync | Migration | OneRoster import | migration.sync | Internal | Per role | Semester | migration.import_staging | Catalogued | P1 |
| 6 | Validation | Semester implementation lead | — | sync | Migration | GAP | migration.sync | Internal | Per role | Semester | migration.validation | Catalogued | P1 |
| 7 | Duplicate/conflict resolution | Registrar staff | — | form | Support | Duplicate resolution | support.form | Personal (minimum context) | Per role | Semester | support.duplicate_conflict_resolution | Catalogued | P2 |
| 8 | Reconciliation | Registrar staff | — | sync | Integration | Reconciliation dashboard | integration.sync | Internal | Per role | Semester | integration.reconciliation | Catalogued | P1 |
| 9 | Dual run | Semester implementation lead | — | sync | Migration | GAP | migration.sync | Internal | Per role | Semester | migration.dual_run | Catalogued | P1 |
| 10 | User acceptance | Institutional executive | Registrar staff | form | Student Workspace | GAP | student_workspace.form | Internal | Per role | Semester | student_workspace.user_acceptance | Catalogued | P2 |
| 11 | Institution approval | Institutional executive | Semester implementation lead | form | Developer Platform | Scope approval | developer_platform.form | Internal | Per role | Semester | developer_platform.institution_approval | Catalogued | P2 |
| 12 | Cutover | Institutional IT | Registrar staff | decide | Migration | GAP | migration.decide | Internal | Per role | Semester | migration.cutover | Catalogued | P0 |
| 13 | Enhanced monitoring | Institutional IT | — | review | Student Workspace | GAP | student_workspace.review | Internal | Per role | Semester | student_workspace.enhanced_monitoring | Catalogued | P2 |
| 14 | Rollback window | Institutional IT | — | form | Registration | GAP | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.rollback_window | Catalogued | P0 |
| 15 | Archive/export | Semester implementation lead | Institutional auditor | sync | Migration | Data export/portability | migration.sync | Internal | Per role | Semester | migration.archive_export | Catalogued | P1 |
| 16 | Legacy retirement | Institutional IT | — | sync | Migration | GAP | migration.sync | Internal | Per role | Semester | migration.legacy_retirement | Catalogued | P1 |
| 17 | Post-migration review | Semester implementation lead | — | review | Migration | GAP | migration.review | Internal | Per role | Semester | migration.post_migration_review | Catalogued | P2 |

## Student finance & payment

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Review student account | Student | — | review | Financial Account | Account summary | financial_account.review | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.review_student_account | Added (runner) | P0 |
| 2 | Review charges and credits | Student | — | review | Financial Account | Staff: Charge/credit request | financial_account.review | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.review_charges_and_credits | Added (runner) | P0 |
| 3 | See hold blocking registration | Student | — | form | Registration | Holds and registration status | registration.form | Education record | Per role | Official system (SIS/LMS) | registration.see_hold_blocking_registration | Added (runner) | P0 |
| 4 | Open cost planner | Student | — | form | Financial Account | Cost planner | financial_account.form | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.open_cost_planner | Added (runner) | P0 |
| 5 | Request payment plan | Student | Student accounts staff | handoff | Payment Plan | Payment plan | payment_plan.handoff | Education record · financial | Per role | Semester | payment_plan.request_payment_plan | Added (runner) | P0 |
| 6 | Review plan terms | Student accounts staff | — | review | Student Workspace | Payment plan | student_workspace.review | Internal | Per role | Semester | student_workspace.review_plan_terms | Added (runner) | P2 |
| 7 | Accept payment plan | Student | — | form | Payment Plan | Payment plan | payment_plan.form | Education record · financial | Per role | Semester | payment_plan.accept_payment_plan | Added (runner) | P0 |
| 8 | Payment handoff to processor | Student | Payment processor (system) | handoff | Identity | Payment provider handoff | identity.handoff | Directory | Per role | Semester | identity.payment_handoff_to_processor | Added (runner) | P2 |
| 9 | Processor confirms payment | Payment processor (system) | — | review | Identity | Payment plan | identity.review | Directory | Per role | Semester | identity.processor_confirms_payment | Added (runner) | P2 |
| 10 | Reconcile payment with SIS | Student accounts staff | Registrar staff | sync | Integration | Payment plan | integration.sync | Internal | Per role | Semester | integration.reconcile_payment_with_sis | Added (runner) | P1 |
| 11 | Release hold | Student accounts staff | Student | form | Financial Account | Holds | financial_account.form | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.release_hold | Added (runner) | P0 |
| 12 | Notify student of hold release | Student accounts staff | Student | comms | Financial Account | Holds | financial_account.comms | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.notify_student_of_hold_release | Added (runner) | P0 |
| 13 | Request refund status | Student | Student accounts staff | handoff | Financial Account | Refund status | financial_account.handoff | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.request_refund_status | Added (runner) | P0 |
| 14 | Financial-aid handoff | Student | Financial aid staff | handoff | AI Gateway | Financial-aid handoff | ai_gateway.handoff | Classified per request | Per role | Semester | ai_gateway.financial_aid_handoff | Added (runner) | P0 |
| 15 | Emergency support request | Student | Student accounts staff | handoff | Support | Emergency aid resources | support.handoff | Personal (minimum context) | Per role | Semester | support.emergency_support_request | Added (runner) | P2 |
| 16 | Audit ledger reviewed | Student accounts staff | Institutional auditor | review | Audit | Staff: Audit ledger | audit.review | Internal | Per role | Semester | audit.audit_ledger_reviewed | Added (runner) | P2 |

## Campus services

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Open campus map | Student | — | form | Student Workspace | Campus calendar | student_workspace.form | Internal | Per role | Semester | student_workspace.open_campus_map | Added (runner) | P2 |
| 2 | Find study space | Student | — | form | Student Workspace | Study space availability | student_workspace.form | Internal | Per role | Semester | student_workspace.find_study_space | Added (runner) | P2 |
| 3 | Check dining hours and menus | Student | — | form | Dining | Dining hours | dining.form | Internal | Per role | Semester | dining.check_dining_hours_and_menus | Added (runner) | P2 |
| 4 | Order dining | Student | Dining/campus-card staff | form | Dining | Dining locations | dining.form | Internal | Per role | Semester | dining.order_dining | Added (runner) | P2 |
| 5 | Pay with meal balance | Student | Dining/campus-card staff | form | Financial Account | Meal balance | financial_account.form | Education record · financial | Per role | Official system (SIS/LMS) | financial_account.pay_with_meal_balance | Added (runner) | P0 |
| 6 | Pick up order | Dining/campus-card staff | Dining/campus-card staff | form | Dining | Mobile order | dining.form | Internal | Per role | Semester | dining.pick_up_order | Added (runner) | P2 |
| 7 | Donate meal swipes to pool | Student | Dining/campus-card staff | form | Dining | Meal plan | dining.form | Internal | Per role | Semester | dining.donate_meal_swipes_to_pool | Added (runner) | P2 |
| 8 | Submit housing maintenance request | Student | Housing staff | handoff | AI Gateway | Housing assignment | ai_gateway.handoff | Classified per request | Per role | Semester | ai_gateway.submit_housing_maintenance_request | Added (runner) | P0 |
| 9 | Housing staff accepts request | Housing staff | — | handoff | Housing | Housing assignment | housing.handoff | Internal | Per role | Semester | housing.housing_staff_accepts_request | Added (runner) | P2 |
| 10 | Request resolved | Housing staff | Student | milestone | Student Workspace | GAP | student_workspace.milestone | Internal | Per role | Semester | student_workspace.request_resolved | Added (runner) | P2 |
| 11 | Find accessibility services | Student | — | form | Campus Services | Accessibility services | campus_services.form | Internal | Per role | Semester | campus_services.find_accessibility_services | Added (runner) | P2 |
| 12 | Request accommodation | Student | Accessibility/disability services | handoff | Campus Services | GAP | campus_services.handoff | Internal | Per role | Semester | campus_services.request_accommodation | Added (runner) | P2 |
| 13 | Accommodation approved | Accessibility/disability services | Student | decide | Campus Services | GAP | campus_services.decide | Internal | Per role | Semester | campus_services.accommodation_approved | Added (runner) | P0 |
| 14 | Find safety resources | Student | Campus safety staff | form | AI Gateway | Safety resources | ai_gateway.form | Classified per request | Per role | Semester | ai_gateway.find_safety_resources | Added (runner) | P0 |
| 15 | Wellness handoff | Student | Counseling/wellbeing staff | handoff | Student Workspace | Housing handoff | student_workspace.handoff | Internal | Per role | Semester | student_workspace.wellness_handoff | Added (runner) | P2 |

## Community & moderation

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Set profile visibility per field | Student | — | form | Migration | GAP | migration.form | Internal | Per role | Semester | migration.set_profile_visibility_per_field | Added (runner) | P2 |
| 2 | Choose alias for public posts | Student | — | form | Community | Post creation | community.form | Personal · student-controlled | Per role | Semester | community.choose_alias_for_public_posts | Added (runner) | P2 |
| 3 | Join course community | Student | — | form | Course | Community directory | course.form | Internal | Per role | Semester | course.join_course_community | Added (runner) | P2 |
| 4 | Join organization space | Student | — | form | Community | Organization communities | community.form | Personal · student-controlled | Per role | Semester | community.join_organization_space | Added (runner) | P2 |
| 5 | Create post | Student | — | form | Community | Post creation | community.form | Personal · student-controlled | Per role | Semester | community.create_post | Added (runner) | P2 |
| 6 | AI pre-screen public post | AI gateway (system) | — | form | AI Gateway | Post creation | ai_gateway.form | Classified per request | Per role | Semester | ai_gateway.ai_pre_screen_public_post | Added (runner) | P0 |
| 7 | Post published | Student | — | milestone | Community | Post creation | community.milestone | Personal · student-controlled | Per role | Semester | community.post_published | Added (runner) | P2 |
| 8 | Ask question in Q&A | Student | — | form | Community | Question bank | community.form | Personal · student-controlled | Per role | Semester | community.ask_question_in_q_a | Added (runner) | P2 |
| 9 | Answer endorsed by TA | Teaching assistant | Student | form | Community | GAP | community.form | Personal · student-controlled | Per role | Semester | community.answer_endorsed_by_ta | Added (runner) | P2 |
| 10 | Create marketplace listing | Student | — | form | Community | GAP | community.form | Personal · student-controlled | Per role | Semester | community.create_marketplace_listing | Added (runner) | P2 |
| 11 | Integrity filter checks listing | AI gateway (system) | — | form | Community | GAP | community.form | Personal · student-controlled | Per role | Semester | community.integrity_filter_checks_listing | Added (runner) | P2 |
| 12 | Make offer in chat | Student | Student | form | Community | GAP | community.form | Personal · student-controlled | Per role | Semester | community.make_offer_in_chat | Added (runner) | P2 |
| 13 | Arrange safe meet-up | Student | Student | form | Community | GAP | community.form | Personal · student-controlled | Per role | Semester | community.arrange_safe_meet_up | Added (runner) | P2 |
| 14 | Report content | Student | Community moderator | form | Community | Report content | community.form | Personal · student-controlled | Per role | Semester | community.report_content | Added (runner) | P2 |
| 15 | Moderator reviews report | Community moderator | Community moderator | review | Community | Report content | community.review | Personal · student-controlled | Per role | Semester | community.moderator_reviews_report | Added (runner) | P2 |
| 16 | Remove content or warn | Community moderator | Student | decide | Student Workspace | Report content | student_workspace.decide | Internal | Per role | Semester | student_workspace.remove_content_or_warn | Added (runner) | P0 |
| 17 | Student appeals | Student | Community moderator | handoff | Community | Appeal decision | community.handoff | Personal · student-controlled | Per role | Semester | community.student_appeals | Added (runner) | P2 |
| 18 | Appeal decided | Community moderator | Student | decide | Community | Appeal decision | community.decide | Personal · student-controlled | Per role | Semester | community.appeal_decided | Added (runner) | P0 |
| 19 | Safety escalation | Community moderator | Campus safety staff | handoff | Student Workspace | Community safety resources | student_workspace.handoff | Internal | Per role | Semester | student_workspace.safety_escalation | Added (runner) | P2 |
| 20 | Community health reviewed | Community moderator | Semester product operator | review | Community | Community directory | community.review | Personal · student-controlled | Per role | Semester | community.community_health_reviewed | Added (runner) | P2 |

## Career, employer & alumni

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Build skills profile | Student | — | form | Career | Skills graph | career.form | Personal · student-controlled | Per role | Semester | career.build_skills_profile | Added (runner) | P2 |
| 2 | Add evidence to portfolio | Student | — | form | Career | Skill evidence | career.form | Personal · student-controlled | Per role | Semester | career.add_evidence_to_portfolio | Added (runner) | P2 |
| 3 | Request skill verification | Student | Faculty/instructor | handoff | Career | Skills graph | career.handoff | Personal · student-controlled | Per role | Semester | career.request_skill_verification | Added (runner) | P2 |
| 4 | Faculty verifies skill | Faculty/instructor | Student | decide | Career | Skills graph | career.decide | Personal · student-controlled | Per role | Semester | career.faculty_verifies_skill | Added (runner) | P0 |
| 5 | Generate resume from evidence | Student | — | form | Career | Skill evidence | career.form | Personal · student-controlled | Per role | Semester | career.generate_resume_from_evidence | Added (runner) | P2 |
| 6 | Search opportunities | Student | — | review | Career | Opportunity search | career.review | Personal · student-controlled | Per role | Semester | career.search_opportunities | Added (runner) | P2 |
| 7 | Employer posts internship | Employer | Career staff | form | Community | Employer: Internship management | community.form | Personal · student-controlled | Per role | Semester | community.employer_posts_internship | Added (runner) | P2 |
| 8 | Career staff approves posting | Career staff | — | decide | Community | Career plan | community.decide | Personal · student-controlled | Per role | Semester | community.career_staff_approves_posting | Added (runner) | P0 |
| 9 | Apply to internship | Student | Employer | handoff | Career | Internship postings | career.handoff | Personal · student-controlled | Per role | Semester | career.apply_to_internship | Added (runner) | P2 |
| 10 | Employer reviews approved evidence | Employer | — | decide | Career | Skill evidence | career.decide | Personal · student-controlled | Per role | Semester | career.employer_reviews_approved_evidence | Added (runner) | P0 |
| 11 | Book career appointment | Student | Career staff | handoff | Developer Platform | Career appointments | developer_platform.handoff | Internal | Per role | Semester | developer_platform.book_career_appointment | Added (runner) | P2 |
| 12 | Interview scheduled | Employer | Student | form | Career | Interview preparation | career.form | Personal · student-controlled | Per role | Semester | career.interview_scheduled | Added (runner) | P2 |
| 13 | Offer recorded | Employer | Student | milestone | Academic Record | Alumni mentor offers | academic_record.milestone | Education record | Per role | Official system (SIS/LMS) | academic_record.offer_recorded | Added (runner) | P0 |
| 14 | Career outcome captured | Career staff | — | milestone | Student Workspace | Career outcome history | student_workspace.milestone | Internal | Per role | Semester | student_workspace.career_outcome_captured | Added (runner) | P2 |
| 15 | Transition to alumni | Student | Alumni | handoff | Career | Alumni mentor offers | career.handoff | Personal · student-controlled | Per role | Semester | career.transition_to_alumni | Added (runner) | P2 |
| 16 | Alumni offers mentoring | Alumni | Student | form | Career | Alumni mentor offers | career.form | Personal · student-controlled | Per role | Semester | career.alumni_offers_mentoring | Added (runner) | P2 |
| 17 | Mentor matched with student | Alumni | Student | milestone | Career | Mentor directory | career.milestone | Personal · student-controlled | Per role | Semester | career.mentor_matched_with_student | Added (runner) | P2 |
| 18 | Continuing education enrolment | Student | — | form | Student Workspace | Continuing education | student_workspace.form | Internal | Per role | Semester | student_workspace.continuing_education_enrolment | Added (runner) | P2 |

## Family & guardian consent

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Student opens family sharing | Student | — | handoff | Privacy | Family sharing | privacy.handoff | Personal · consent-bound | Per role | Semester | privacy.student_opens_family_sharing | Added (runner) | P2 |
| 2 | Choose information categories | Student | — | form | Family/Guardian | Shared categories | family_guardian.form | Personal · consent-bound | Per role | Semester | family_guardian.choose_information_categories | Added (runner) | P2 |
| 3 | Set access expiry | Student | — | form | Family/Guardian | Time-limited access | family_guardian.form | Personal · consent-bound | Per role | Semester | family_guardian.set_access_expiry | Added (runner) | P2 |
| 4 | Send consent invitation | Student | Family/guardian | consent | Privacy | Invitation acceptance | privacy.consent | Personal · consent-bound | Required | Semester | privacy.send_consent_invitation | Added (runner) | P0 |
| 5 | Guardian confirms relationship | Family/guardian | Student | review | Family/Guardian | Relationship confirmation | family_guardian.review | Personal · consent-bound | Per role | Semester | family_guardian.guardian_confirms_relationship | Added (runner) | P2 |
| 6 | Guardian accepts scope | Family/guardian | Student | decide | Authorization | Consent scope | authorization.decide | Internal | Per role | Semester | authorization.guardian_accepts_scope | Added (runner) | P0 |
| 7 | Guardian views shared items | Family/guardian | — | consent | Privacy | Shared items | privacy.consent | Personal · consent-bound | Required | Semester | privacy.guardian_views_shared_items | Added (runner) | P0 |
| 8 | Billing/support handoff | Family/guardian | Student accounts staff | handoff | Support | Billing/support handoff | support.handoff | Personal (minimum context) | Per role | Semester | support.billing_support_handoff | Added (runner) | P2 |
| 9 | Access history reviewed | Student | Student | review | Student Workspace | Access history | student_workspace.review | Internal | Per role | Semester | student_workspace.access_history_reviewed | Added (runner) | P2 |
| 10 | Student narrows scope | Student | Family/guardian | decide | Authorization | Consent scope | authorization.decide | Internal | Per role | Semester | authorization.student_narrows_scope | Added (runner) | P0 |
| 11 | Student revokes access | Student | Family/guardian | decide | Student Workspace | Time-limited access | student_workspace.decide | Internal | Per role | Semester | student_workspace.student_revokes_access | Added (runner) | P0 |
| 12 | Access expires automatically | Semester privacy/legal operator | — | form | Student Workspace | Time-limited access | student_workspace.form | Internal | Per role | Semester | student_workspace.access_expires_automatically | Added (runner) | P2 |
| 13 | Audit retained | Semester privacy/legal operator | — | form | AI Gateway | GAP | ai_gateway.form | Classified per request | Per role | Semester | ai_gateway.audit_retained | Added (runner) | P0 |

## Developer platform & marketplace

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Partner applies | Developer/partner | Semester product operator | handoff | Developer Platform | GAP | developer_platform.handoff | Internal | Per role | Semester | developer_platform.partner_applies | Added (runner) | P2 |
| 2 | Partner agreement signed | Semester product operator | Developer/partner | milestone | Developer Platform | GAP | developer_platform.milestone | Internal | Per role | Semester | developer_platform.partner_agreement_signed | Added (runner) | P2 |
| 3 | Sandbox tenant created | Semester product operator | Developer/partner | milestone | Tenant | GAP | tenant.milestone | Internal | Per role | Semester | tenant.sandbox_tenant_created | Added (runner) | P2 |
| 4 | Request data scopes | Developer/partner | Semester product operator | handoff | Authorization | Scope approval | authorization.handoff | Internal | Per role | Semester | authorization.request_data_scopes | Added (runner) | P2 |
| 5 | Security review of app | Semester product operator | Institutional security/privacy | review | Developer Platform | Security review | developer_platform.review | Internal | Per role | Semester | developer_platform.security_review_of_app | Added (runner) | P2 |
| 6 | Scopes approved | Institutional security/privacy | Developer/partner | decide | Authorization | Scope approval | authorization.decide | Internal | Per role | Semester | authorization.scopes_approved | Added (runner) | P0 |
| 7 | Register OAuth client | Developer/partner | — | form | Developer Platform | GAP | developer_platform.form | Internal | Per role | Semester | developer_platform.register_oauth_client | Added (runner) | P2 |
| 8 | Configure webhooks | Developer/partner | — | form | Developer Platform | Webhook events | developer_platform.form | Internal | Per role | Semester | developer_platform.configure_webhooks | Added (runner) | P2 |
| 9 | Build against SDK | Developer/partner | — | form | AI Gateway | GAP | ai_gateway.form | Classified per request | Per role | Semester | ai_gateway.build_against_sdk | Added (runner) | P0 |
| 10 | Integration certification | Semester product operator | Semester product operator | form | Integration | Integration analytics | integration.form | Internal | Per role | Semester | integration.integration_certification | Added (runner) | P2 |
| 11 | App review | Semester product operator | — | review | Developer Platform | GAP | developer_platform.review | Internal | Per role | Semester | developer_platform.app_review | Added (runner) | P2 |
| 12 | Listed in marketplace | Semester product operator | Developer/partner | milestone | Marketplace | GAP | marketplace.milestone | Internal | Per role | Semester | marketplace.listed_in_marketplace | Added (runner) | P2 |
| 13 | Institution enables app | Institutional security/privacy | Student | decide | Developer Platform | GAP | developer_platform.decide | Internal | Per role | Semester | developer_platform.institution_enables_app | Added (runner) | P0 |
| 14 | Metering and billing | Semester finance operator | — | form | Billing | GAP | billing.form | Company internal | Per role | Semester | billing.metering_and_billing | Added (runner) | P2 |
| 15 | Version deprecation notice | Semester product operator | Developer/partner | form | Student Workspace | Mapping versions | student_workspace.form | Internal | Per role | Semester | student_workspace.version_deprecation_notice | Added (runner) | P2 |
| 16 | App retired | Developer/partner | — | milestone | Developer Platform | GAP | developer_platform.milestone | Internal | Per role | Semester | developer_platform.app_retired | Added (runner) | P2 |

## Analytics, outcomes & reliability

| # | Step | Actor | Hands to | Kind | System | Screen | Capability | Classification | Consent | Source authority | Audit event | Status | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Define success measures with sponsor | Institutional executive | Institutional executive | form | Student Success | Success plans | student_success.form | Education record · sensitive | Per role | Semester | student_success.define_success_measures_with_sponsor | Added (runner) | P0 |
| 2 | Measures sheet signed | Institutional executive | Institutional executive | milestone | Analytics | GAP | analytics.milestone | Aggregate, de-identified | Per role | Semester | analytics.measures_sheet_signed | Added (runner) | P2 |
| 3 | Instrument events (no PII) | Semester product operator | — | form | Community | GAP | community.form | Personal · student-controlled | Per role | Semester | community.instrument_events_no_pii | Added (runner) | P2 |
| 4 | Aggregate with minimum cell size | Semester product operator | — | review | Analytics | GAP | analytics.review | Aggregate, de-identified | Per role | Semester | analytics.aggregate_with_minimum_cell_size | Added (runner) | P2 |
| 5 | Weekly metrics review | Semester executive | — | review | Analytics | Pilot metrics | analytics.review | Aggregate, de-identified | Per role | Semester | analytics.weekly_metrics_review | Added (runner) | P2 |
| 6 | SLO dashboard reviewed | Semester product operator | — | review | Release | Finance dashboard | release.review | Company internal | Per role | Semester | release.slo_dashboard_reviewed | Added (runner) | P2 |
| 7 | Error budget checked | Semester product operator | — | review | Release | Error budgets | release.review | Company internal | Per role | Semester | release.error_budget_checked | Added (runner) | P2 |
| 8 | Pilot midpoint report | Semester customer-success manager | Institutional executive | form | Student Workspace | Pilot Workspace | student_workspace.form | Internal | Per role | Semester | student_workspace.pilot_midpoint_report | Added (runner) | P2 |
| 9 | Course analytics shared with faculty | Semester customer-success manager | Faculty/instructor | consent | Course | GAP | course.consent | Internal | Required | Semester | course.course_analytics_shared_with_faculty | Added (runner) | P0 |
| 10 | Program outcomes reviewed | Institutional executive | — | review | Academic Path | Pilot outcomes | academic_path.review | Internal | Per role | Semester | academic_path.program_outcomes_reviewed | Added (runner) | P2 |
| 11 | Pilot results report | Semester customer-success manager | Institutional executive | form | Student Workspace | Pilot Workspace | student_workspace.form | Internal | Per role | Semester | student_workspace.pilot_results_report | Added (runner) | P2 |
| 12 | Improvement backlog prioritized | Semester product operator | Semester product operator | form | Student Workspace | GAP | student_workspace.form | Internal | Per role | Semester | student_workspace.improvement_backlog_prioritized | Added (runner) | P2 |
| 13 | Release evidence recorded | Semester product operator | — | milestone | Academic Record | Release evidence | academic_record.milestone | Education record | Per role | Official system (SIS/LMS) | academic_record.release_evidence_recorded | Added (runner) | P0 |
| 14 | Quarterly operating review | Semester executive | Board/investor (company) | review | Student Workspace | Operating review reports | student_workspace.review | Internal | Per role | Semester | student_workspace.quarterly_operating_review | Added (runner) | P2 |
