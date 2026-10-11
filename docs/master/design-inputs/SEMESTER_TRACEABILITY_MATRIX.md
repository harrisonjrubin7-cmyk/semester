# Traceability matrix

_Generated 2026-10-05 from ui_kits/master-catalog/catalog-data.js, ui_kits/workflow-runner/runner-data.js and os-map-data.js. Design-level only: nothing here is verified until repo code, RLS/tenant isolation, accessibility, tests, monitoring, support, documentation and release evidence exist._

Layer → workflow → step → screen → system → capability → audit event.

| Layer | Workflow | Step | Screen | System | Capability | Audit event |
| --- | --- | --- | --- | --- | --- | --- |
| Identity, tenant, policy and trust foundation | Institution implementation | 1. Contract signed | Contracts | Billing | billing.milestone | billing.contract_signed |
| Identity, tenant, policy and trust foundation | Institution implementation | 2. Tenant created | Tenant overview | Tenant | tenant.milestone | tenant.tenant_created |
| Identity, tenant, policy and trust foundation | Institution implementation | 3. Executive sponsor named | Executive Overview | Student Workspace | student_workspace.milestone | student_workspace.executive_sponsor_named |
| Identity, tenant, policy and trust foundation | Institution implementation | 4. Operational champion named | GAP | Student Workspace | student_workspace.milestone | student_workspace.operational_champion_named |
| Identity, tenant, policy and trust foundation | Institution implementation | 5. Security/privacy scope confirmed | Privacy requests | Authorization | authorization.consent | authorization.security_privacy_scope_confirmed |
| Identity, tenant, policy and trust foundation | Institution implementation | 6. Data/integration inventory | Priv: Data inventory | Integration | integration.sync | integration.data_integration_inventory |
| Identity, tenant, policy and trust foundation | Institution implementation | 7. SSO/identity configured | Identity providers | Identity | identity.form | identity.sso_identity_configured |
| Identity, tenant, policy and trust foundation | Institution implementation | 8. Tenant policy configured | Tenant overview | Tenant | tenant.form | tenant.tenant_policy_configured |
| Identity, tenant, policy and trust foundation | Institution implementation | 9. Roles configured | Roles | Authorization | authorization.form | authorization.roles_configured |
| Identity, tenant, policy and trust foundation | Institution implementation | 10. Feature cohorts configured | Feature cohorts | Tenant | tenant.form | tenant.feature_cohorts_configured |
| Identity, tenant, policy and trust foundation | Institution implementation | 11. Data mapping approved | Data classification | Integration | integration.decide | integration.data_mapping_approved |
| Identity, tenant, policy and trust foundation | Institution implementation | 12. Sandbox sync tested | Sync health | Integration | integration.sync | integration.sandbox_sync_tested |
| Identity, tenant, policy and trust foundation | Institution implementation | 13. Reconciliation passed | GAP | Integration | integration.milestone | integration.reconciliation_passed |
| Identity, tenant, policy and trust foundation | Institution implementation | 14. Admin training | GAP | AI Gateway | ai_gateway.comms | ai_gateway.admin_training |
| Identity, tenant, policy and trust foundation | Institution implementation | 15. Student communication prepared | GAP | Communication | communication.comms | communication.student_communication_prepared |
| Identity, tenant, policy and trust foundation | Institution implementation | 16. Launch readiness gate passed | GAP | Student Workspace | student_workspace.milestone | student_workspace.launch_readiness_gate_passed |
| Identity, tenant, policy and trust foundation | Institution implementation | 17. Controlled launch | GAP | Student Workspace | student_workspace.milestone | student_workspace.controlled_launch |
| Identity, tenant, policy and trust foundation | Institution implementation | 18. Adoption monitored | GAP | Student Workspace | student_workspace.review | student_workspace.adoption_monitored |
| Identity, tenant, policy and trust foundation | Institution implementation | 19. Support and incident path live | Incident notices | Academic Path | academic_path.milestone | academic_path.support_and_incident_path_live |
| Identity, tenant, policy and trust foundation | Institution implementation | 20. Midpoint review | GAP | Student Workspace | student_workspace.review | student_workspace.midpoint_review |
| Identity, tenant, policy and trust foundation | Institution implementation | 21. Pilot outcome review | Pilot outcomes | Student Workspace | student_workspace.review | student_workspace.pilot_outcome_review |
| Identity, tenant, policy and trust foundation | Institution implementation | 22. Annual conversion or offboarding | Offboarding | Billing | billing.consent | billing.annual_conversion_or_offboarding |
| Student OS | Student journey | 1. Create account | Student account | Identity | identity.form | identity.create_account |
| Student OS | Student journey | 2. Join institution | GAP | Identity | identity.form | identity.join_institution |
| Student OS | Student journey | 3. Confirm identity | GAP | Identity | identity.review | identity.confirm_identity |
| Student OS | Student journey | 4. Connect SSO | GAP | Identity | identity.form | identity.connect_sso |
| Student OS | Student journey | 5. Complete onboarding | GAP | Student Workspace | student_workspace.form | student_workspace.complete_onboarding |
| Student OS | Student journey | 6. Select program/path | Path | Academic Path | academic_path.form | academic_path.select_program_path |
| Student OS | Student journey | 7. Import or review course context | GAP | Course | course.sync | course.import_or_review_course_context |
| Student OS | Student journey | 8. Review Today | Today | Task | task.review | task.review_today |
| Student OS | Student journey | 9. Create action/task | Action Center | Task | task.form | task.create_action_task |
| Student OS | Student journey | 10. Complete first meaningful action | Action Center | Task | task.form | task.complete_first_meaningful_action |
| Student OS | Student journey | 11. Build term plan | Plan | Academic Path | academic_path.form | academic_path.build_term_plan |
| Student OS | Student journey | 12. Compare courses/sections | Section comparison | Registration | registration.review | registration.compare_courses_sections |
| Student OS | Student journey | 13. Review registration readiness | Registration readiness | Registration | registration.review | registration.review_registration_readiness |
| Student OS | Student journey | 14. Resolve hold through official handoff | Holds | Financial Account | financial_account.handoff | financial_account.resolve_hold_through_official_handoff |
| Student OS | Student journey | 15. Enroll or request registration | Registration readiness | Registration | registration.handoff | registration.enroll_or_request_registration |
| Student OS | Student journey | 16. Build study plan | Plan | Student Workspace | student_workspace.form | student_workspace.build_study_plan |
| Student OS | Student journey | 17. Join course workspace | Project workspace | Course | course.form | course.join_course_workspace |
| Student OS | Student journey | 18. Read course guidance | Course AI guidance | Course | course.review | course.read_course_guidance |
| Student OS | Student journey | 19. Follow course AI rules | Priv: Classification rules | AI Gateway | ai_gateway.form | ai_gateway.follow_course_ai_rules |
| Student OS | Student journey | 20. Use AI copilot | AI Copilot | AI Gateway | ai_gateway.ai | ai_gateway.use_ai_copilot |
| Student OS | Student journey | 21. Search approved sources | Course search | AI Gateway | ai_gateway.ai | ai_gateway.search_approved_sources |
| Student OS | Student journey | 22. Create notes | Notes | Notes | notes.form | notes.create_notes |
| Student OS | Student journey | 23. Organize files | Files | Files | files.form | files.organize_files |
| Student OS | Student journey | 24. Join study group | Study groups | Community | community.form | community.join_study_group |
| Student OS | Student journey | 25. Request peer mentor | Peer mentor directory | Career | career.handoff | career.request_peer_mentor |
| Student OS | Student journey | 26. Request advisor support | Financial-support handoff | Support | support.handoff | support.request_advisor_support |
| Student OS | Student journey | 27. Share with advisor | Advisor sharing | Privacy | privacy.consent | privacy.share_with_advisor |
| Student OS | Student journey | 28. Share with family | Family sharing | Privacy | privacy.consent | privacy.share_with_family |
| Student OS | Student journey | 29. Review student account | Student account | Financial Account | financial_account.review | financial_account.review_student_account |
| Student OS | Student journey | 30. Request payment plan | Payment plan | Payment Plan | payment_plan.handoff | payment_plan.request_payment_plan |
| Student OS | Student journey | 31. Find campus resource | Course resources | Course | course.form | course.find_campus_resource |
| Student OS | Student journey | 32. Order dining | Dining | Dining | dining.form | dining.order_dining |
| Student OS | Student journey | 33. Join organization/event | Organization events | Community | community.form | community.join_organization_event |
| Student OS | Student journey | 34. Build portfolio | Portfolio | Career | career.form | career.build_portfolio |
| Student OS | Student journey | 35. Search opportunity | Opportunity search | Career | career.review | career.search_opportunity |
| Student OS | Student journey | 36. Apply for opportunity | Opportunities | Career | career.handoff | career.apply_for_opportunity |
| Student OS | Student journey | 37. Export personal data | Data export | Privacy | privacy.consent | privacy.export_personal_data |
| Student OS | Student journey | 38. Adjust privacy/AI settings | Privacy settings | AI Gateway | ai_gateway.consent | ai_gateway.adjust_privacy_ai_settings |
| Student OS | Student journey | 39. Request deletion/correction | Account deletion request | Privacy | privacy.consent | privacy.request_deletion_correction |
| Student OS | Student journey | 40. Transition to alumni | Alumni mentor offers | Career | career.handoff | career.transition_to_alumni |
| Productivity and collaboration workspace | Student journey | 1. Create account | Student account | Identity | identity.form | identity.create_account |
| Productivity and collaboration workspace | Student journey | 2. Join institution | GAP | Identity | identity.form | identity.join_institution |
| Productivity and collaboration workspace | Student journey | 3. Confirm identity | GAP | Identity | identity.review | identity.confirm_identity |
| Productivity and collaboration workspace | Student journey | 4. Connect SSO | GAP | Identity | identity.form | identity.connect_sso |
| Productivity and collaboration workspace | Student journey | 5. Complete onboarding | GAP | Student Workspace | student_workspace.form | student_workspace.complete_onboarding |
| Productivity and collaboration workspace | Student journey | 6. Select program/path | Path | Academic Path | academic_path.form | academic_path.select_program_path |
| Productivity and collaboration workspace | Student journey | 7. Import or review course context | GAP | Course | course.sync | course.import_or_review_course_context |
| Productivity and collaboration workspace | Student journey | 8. Review Today | Today | Task | task.review | task.review_today |
| Productivity and collaboration workspace | Student journey | 9. Create action/task | Action Center | Task | task.form | task.create_action_task |
| Productivity and collaboration workspace | Student journey | 10. Complete first meaningful action | Action Center | Task | task.form | task.complete_first_meaningful_action |
| Productivity and collaboration workspace | Student journey | 11. Build term plan | Plan | Academic Path | academic_path.form | academic_path.build_term_plan |
| Productivity and collaboration workspace | Student journey | 12. Compare courses/sections | Section comparison | Registration | registration.review | registration.compare_courses_sections |
| Productivity and collaboration workspace | Student journey | 13. Review registration readiness | Registration readiness | Registration | registration.review | registration.review_registration_readiness |
| Productivity and collaboration workspace | Student journey | 14. Resolve hold through official handoff | Holds | Financial Account | financial_account.handoff | financial_account.resolve_hold_through_official_handoff |
| Productivity and collaboration workspace | Student journey | 15. Enroll or request registration | Registration readiness | Registration | registration.handoff | registration.enroll_or_request_registration |
| Productivity and collaboration workspace | Student journey | 16. Build study plan | Plan | Student Workspace | student_workspace.form | student_workspace.build_study_plan |
| Productivity and collaboration workspace | Student journey | 17. Join course workspace | Project workspace | Course | course.form | course.join_course_workspace |
| Productivity and collaboration workspace | Student journey | 18. Read course guidance | Course AI guidance | Course | course.review | course.read_course_guidance |
| Productivity and collaboration workspace | Student journey | 19. Follow course AI rules | Priv: Classification rules | AI Gateway | ai_gateway.form | ai_gateway.follow_course_ai_rules |
| Productivity and collaboration workspace | Student journey | 20. Use AI copilot | AI Copilot | AI Gateway | ai_gateway.ai | ai_gateway.use_ai_copilot |
| Productivity and collaboration workspace | Student journey | 21. Search approved sources | Course search | AI Gateway | ai_gateway.ai | ai_gateway.search_approved_sources |
| Productivity and collaboration workspace | Student journey | 22. Create notes | Notes | Notes | notes.form | notes.create_notes |
| Productivity and collaboration workspace | Student journey | 23. Organize files | Files | Files | files.form | files.organize_files |
| Productivity and collaboration workspace | Student journey | 24. Join study group | Study groups | Community | community.form | community.join_study_group |
| Productivity and collaboration workspace | Student journey | 25. Request peer mentor | Peer mentor directory | Career | career.handoff | career.request_peer_mentor |
| Productivity and collaboration workspace | Student journey | 26. Request advisor support | Financial-support handoff | Support | support.handoff | support.request_advisor_support |
| Productivity and collaboration workspace | Student journey | 27. Share with advisor | Advisor sharing | Privacy | privacy.consent | privacy.share_with_advisor |
| Productivity and collaboration workspace | Student journey | 28. Share with family | Family sharing | Privacy | privacy.consent | privacy.share_with_family |
| Productivity and collaboration workspace | Student journey | 29. Review student account | Student account | Financial Account | financial_account.review | financial_account.review_student_account |
| Productivity and collaboration workspace | Student journey | 30. Request payment plan | Payment plan | Payment Plan | payment_plan.handoff | payment_plan.request_payment_plan |
| Productivity and collaboration workspace | Student journey | 31. Find campus resource | Course resources | Course | course.form | course.find_campus_resource |
| Productivity and collaboration workspace | Student journey | 32. Order dining | Dining | Dining | dining.form | dining.order_dining |
| Productivity and collaboration workspace | Student journey | 33. Join organization/event | Organization events | Community | community.form | community.join_organization_event |
| Productivity and collaboration workspace | Student journey | 34. Build portfolio | Portfolio | Career | career.form | career.build_portfolio |
| Productivity and collaboration workspace | Student journey | 35. Search opportunity | Opportunity search | Career | career.review | career.search_opportunity |
| Productivity and collaboration workspace | Student journey | 36. Apply for opportunity | Opportunities | Career | career.handoff | career.apply_for_opportunity |
| Productivity and collaboration workspace | Student journey | 37. Export personal data | Data export | Privacy | privacy.consent | privacy.export_personal_data |
| Productivity and collaboration workspace | Student journey | 38. Adjust privacy/AI settings | Privacy settings | AI Gateway | ai_gateway.consent | ai_gateway.adjust_privacy_ai_settings |
| Productivity and collaboration workspace | Student journey | 39. Request deletion/correction | Account deletion request | Privacy | privacy.consent | privacy.request_deletion_correction |
| Productivity and collaboration workspace | Student journey | 40. Transition to alumni | Alumni mentor offers | Career | career.handoff | career.transition_to_alumni |
| Academic path and degree planning | Student journey | 1. Create account | Student account | Identity | identity.form | identity.create_account |
| Academic path and degree planning | Student journey | 2. Join institution | GAP | Identity | identity.form | identity.join_institution |
| Academic path and degree planning | Student journey | 3. Confirm identity | GAP | Identity | identity.review | identity.confirm_identity |
| Academic path and degree planning | Student journey | 4. Connect SSO | GAP | Identity | identity.form | identity.connect_sso |
| Academic path and degree planning | Student journey | 5. Complete onboarding | GAP | Student Workspace | student_workspace.form | student_workspace.complete_onboarding |
| Academic path and degree planning | Student journey | 6. Select program/path | Path | Academic Path | academic_path.form | academic_path.select_program_path |
| Academic path and degree planning | Student journey | 7. Import or review course context | GAP | Course | course.sync | course.import_or_review_course_context |
| Academic path and degree planning | Student journey | 8. Review Today | Today | Task | task.review | task.review_today |
| Academic path and degree planning | Student journey | 9. Create action/task | Action Center | Task | task.form | task.create_action_task |
| Academic path and degree planning | Student journey | 10. Complete first meaningful action | Action Center | Task | task.form | task.complete_first_meaningful_action |
| Academic path and degree planning | Student journey | 11. Build term plan | Plan | Academic Path | academic_path.form | academic_path.build_term_plan |
| Academic path and degree planning | Student journey | 12. Compare courses/sections | Section comparison | Registration | registration.review | registration.compare_courses_sections |
| Academic path and degree planning | Student journey | 13. Review registration readiness | Registration readiness | Registration | registration.review | registration.review_registration_readiness |
| Academic path and degree planning | Student journey | 14. Resolve hold through official handoff | Holds | Financial Account | financial_account.handoff | financial_account.resolve_hold_through_official_handoff |
| Academic path and degree planning | Student journey | 15. Enroll or request registration | Registration readiness | Registration | registration.handoff | registration.enroll_or_request_registration |
| Academic path and degree planning | Student journey | 16. Build study plan | Plan | Student Workspace | student_workspace.form | student_workspace.build_study_plan |
| Academic path and degree planning | Student journey | 17. Join course workspace | Project workspace | Course | course.form | course.join_course_workspace |
| Academic path and degree planning | Student journey | 18. Read course guidance | Course AI guidance | Course | course.review | course.read_course_guidance |
| Academic path and degree planning | Student journey | 19. Follow course AI rules | Priv: Classification rules | AI Gateway | ai_gateway.form | ai_gateway.follow_course_ai_rules |
| Academic path and degree planning | Student journey | 20. Use AI copilot | AI Copilot | AI Gateway | ai_gateway.ai | ai_gateway.use_ai_copilot |
| Academic path and degree planning | Student journey | 21. Search approved sources | Course search | AI Gateway | ai_gateway.ai | ai_gateway.search_approved_sources |
| Academic path and degree planning | Student journey | 22. Create notes | Notes | Notes | notes.form | notes.create_notes |
| Academic path and degree planning | Student journey | 23. Organize files | Files | Files | files.form | files.organize_files |
| Academic path and degree planning | Student journey | 24. Join study group | Study groups | Community | community.form | community.join_study_group |
| Academic path and degree planning | Student journey | 25. Request peer mentor | Peer mentor directory | Career | career.handoff | career.request_peer_mentor |
| Academic path and degree planning | Student journey | 26. Request advisor support | Financial-support handoff | Support | support.handoff | support.request_advisor_support |
| Academic path and degree planning | Student journey | 27. Share with advisor | Advisor sharing | Privacy | privacy.consent | privacy.share_with_advisor |
| Academic path and degree planning | Student journey | 28. Share with family | Family sharing | Privacy | privacy.consent | privacy.share_with_family |
| Academic path and degree planning | Student journey | 29. Review student account | Student account | Financial Account | financial_account.review | financial_account.review_student_account |
| Academic path and degree planning | Student journey | 30. Request payment plan | Payment plan | Payment Plan | payment_plan.handoff | payment_plan.request_payment_plan |
| Academic path and degree planning | Student journey | 31. Find campus resource | Course resources | Course | course.form | course.find_campus_resource |
| Academic path and degree planning | Student journey | 32. Order dining | Dining | Dining | dining.form | dining.order_dining |
| Academic path and degree planning | Student journey | 33. Join organization/event | Organization events | Community | community.form | community.join_organization_event |
| Academic path and degree planning | Student journey | 34. Build portfolio | Portfolio | Career | career.form | career.build_portfolio |
| Academic path and degree planning | Student journey | 35. Search opportunity | Opportunity search | Career | career.review | career.search_opportunity |
| Academic path and degree planning | Student journey | 36. Apply for opportunity | Opportunities | Career | career.handoff | career.apply_for_opportunity |
| Academic path and degree planning | Student journey | 37. Export personal data | Data export | Privacy | privacy.consent | privacy.export_personal_data |
| Academic path and degree planning | Student journey | 38. Adjust privacy/AI settings | Privacy settings | AI Gateway | ai_gateway.consent | ai_gateway.adjust_privacy_ai_settings |
| Academic path and degree planning | Student journey | 39. Request deletion/correction | Account deletion request | Privacy | privacy.consent | privacy.request_deletion_correction |
| Academic path and degree planning | Student journey | 40. Transition to alumni | Alumni mentor offers | Career | career.handoff | career.transition_to_alumni |
| Academic path and degree planning | Registrar & academic operations | 1. Create term | Term management | Registration | registration.form | registration.create_term |
| Academic path and degree planning | Registrar & academic operations | 2. Configure academic calendar | Academic calendar | Calendar | calendar.form | calendar.configure_academic_calendar |
| Academic path and degree planning | Registrar & academic operations | 3. Import/manage catalog | Catalog management | Academic Record | academic_record.sync | academic_record.import_manage_catalog |
| Academic path and degree planning | Registrar & academic operations | 4. Create sections | Section management | Registration | registration.form | registration.create_sections |
| Academic path and degree planning | Registrar & academic operations | 5. Assign capacity/waitlists | Capacity management | AI Gateway | ai_gateway.form | ai_gateway.assign_capacity_waitlists |
| Academic path and degree planning | Registrar & academic operations | 6. Define prerequisites/co-requisites | Prerequisite rules | Registration | registration.form | registration.define_prerequisites_co_requisites |
| Academic path and degree planning | Registrar & academic operations | 7. Publish registration windows | Registration windows | Registration | registration.form | registration.publish_registration_windows |
| Academic path and degree planning | Registrar & academic operations | 8. Issue time tickets | Time tickets | Registration | registration.form | registration.issue_time_tickets |
| Academic path and degree planning | Registrar & academic operations | 9. Sync holds | Holds | Financial Account | financial_account.sync | financial_account.sync_holds |
| Academic path and degree planning | Registrar & academic operations | 10. Grant override | Overrides | Authorization | authorization.decide | authorization.grant_override |
| Academic path and degree planning | Registrar & academic operations | 11. Review enrollment attempt | Enrollment queue | Registration | registration.review | registration.review_enrollment_attempt |
| Academic path and degree planning | Registrar & academic operations | 12. Approve/deny exception | Data-quality exceptions | Developer Platform | developer_platform.decide | developer_platform.approve_deny_exception |
| Academic path and degree planning | Registrar & academic operations | 13. Manage add/drop/withdrawal | Add/drop/withdrawal workflow | Registration | registration.form | registration.manage_add_drop_withdrawal |
| Academic path and degree planning | Registrar & academic operations | 14. Reconcile with SIS | GAP | Integration | integration.sync | integration.reconcile_with_sis |
| Academic path and degree planning | Registrar & academic operations | 15. Correct academic record | Academic record search | Academic Record | academic_record.decide | academic_record.correct_academic_record |
| Academic path and degree planning | Registrar & academic operations | 16. Manage grade changes | Grade change workflow | Gradebook | gradebook.form | gradebook.manage_grade_changes |
| Academic path and degree planning | Registrar & academic operations | 17. Run degree audit | Degree audit rules | Degree Audit | degree_audit.review | degree_audit.run_degree_audit |
| Academic path and degree planning | Registrar & academic operations | 18. Evaluate transfer credit | Transfer credit view | Transfer | transfer.form | transfer.evaluate_transfer_credit |
| Academic path and degree planning | Registrar & academic operations | 19. Review graduation | Graduation review | Academic Record | academic_record.review | academic_record.review_graduation |
| Academic path and degree planning | Registrar & academic operations | 20. Export official records | Academic record search | Academic Record | academic_record.form | academic_record.export_official_records |
| Academic path and degree planning | Registrar & academic operations | 21. Close-of-term audit | Term management | Audit | audit.form | audit.close_of_term_audit |
| Course Studio and learning OS | Faculty course lifecycle | 1. Accept course assignment | Assignments | Assessment | assessment.form | assessment.accept_course_assignment |
| Course Studio and learning OS | Faculty course lifecycle | 2. Configure course workspace | Feedback workspace | Course | course.form | course.configure_course_workspace |
| Course Studio and learning OS | Faculty course lifecycle | 3. Publish syllabus | Syllabus | Course | course.form | course.publish_syllabus |
| Course Studio and learning OS | Faculty course lifecycle | 4. Publish learning objectives | Learning objectives | Course | course.form | course.publish_learning_objectives |
| Course Studio and learning OS | Faculty course lifecycle | 5. Publish course guidance | Course guidance | Course | course.form | course.publish_course_guidance |
| Course Studio and learning OS | Faculty course lifecycle | 6. Publish course AI policy | GAP | AI Gateway | ai_gateway.form | ai_gateway.publish_course_ai_policy |
| Course Studio and learning OS | Faculty course lifecycle | 7. Add approved resources | Resource library | AI Gateway | ai_gateway.decide | ai_gateway.add_approved_resources |
| Course Studio and learning OS | Faculty course lifecycle | 8. Create assignment | Assignments | Assessment | assessment.form | assessment.create_assignment |
| Course Studio and learning OS | Faculty course lifecycle | 9. Create rubric | Rubric builder | Gradebook | gradebook.form | gradebook.create_rubric |
| Course Studio and learning OS | Faculty course lifecycle | 10. Create assessment | Assessment builder | Assessment | assessment.review | assessment.create_assessment |
| Course Studio and learning OS | Faculty course lifecycle | 11. Create study pack | Study packs | Course | course.form | course.create_study_pack |
| Course Studio and learning OS | Faculty course lifecycle | 12. Manage roster | GAP | Course | course.form | course.manage_roster |
| Course Studio and learning OS | Faculty course lifecycle | 13. Review student work | My Work | Assessment | assessment.review | assessment.review_student_work |
| Course Studio and learning OS | Faculty course lifecycle | 14. Provide feedback | Feedback workspace | Assessment | assessment.form | assessment.provide_feedback |
| Course Studio and learning OS | Faculty course lifecycle | 15. Enter grade | Grade entry | Gradebook | gradebook.form | gradebook.enter_grade |
| Course Studio and learning OS | Faculty course lifecycle | 16. Moderate grade | Grade entry | Gradebook | gradebook.decide | gradebook.moderate_grade |
| Course Studio and learning OS | Faculty course lifecycle | 17. Release grade | Grade release | Gradebook | gradebook.decide | gradebook.release_grade |
| Course Studio and learning OS | Faculty course lifecycle | 18. Resolve regrade | Regrade queue | Gradebook | gradebook.decide | gradebook.resolve_regrade |
| Course Studio and learning OS | Faculty course lifecycle | 19. Hold office hours | Office hours | Financial Account | financial_account.form | financial_account.hold_office_hours |
| Course Studio and learning OS | Faculty course lifecycle | 20. Communicate with class | GAP | Course | course.comms | course.communicate_with_class |
| Course Studio and learning OS | Faculty course lifecycle | 21. Review aggregate learning signals | Learning objectives | Analytics | analytics.review | analytics.review_aggregate_learning_signals |
| Course Studio and learning OS | Faculty course lifecycle | 22. Review course accessibility | Course accessibility review | Course | course.review | course.review_course_accessibility |
| Course Studio and learning OS | Faculty course lifecycle | 23. Export/archive | Course imports/exports | Migration | migration.sync | migration.export_archive |
| Course Studio and learning OS | Faculty course lifecycle | 24. Grade passback (if approved) | Grade passback | Gradebook | gradebook.decide | gradebook.grade_passback_if_approved |
| Governed AI and intelligence platform | Governed AI request | 1. User asks | GAP | Student Workspace | student_workspace.ai | student_workspace.user_asks |
| Governed AI and intelligence platform | Governed AI request | 2. Intent identified | GAP | AI Gateway | ai_gateway.ai | ai_gateway.intent_identified |
| Governed AI and intelligence platform | Governed AI request | 3. Role/tenant/course scope established | Tenant overview | Authorization | authorization.ai | authorization.role_tenant_course_scope_established |
| Governed AI and intelligence platform | Governed AI request | 4. Data classification checked | Data classification | Course | course.review | course.data_classification_checked |
| Governed AI and intelligence platform | Governed AI request | 5. Consent checked | Consent policy | Privacy | privacy.consent | privacy.consent_checked |
| Governed AI and intelligence platform | Governed AI request | 6. Course/tenant AI policy checked | Tenant overview | AI Gateway | ai_gateway.review | ai_gateway.course_tenant_ai_policy_checked |
| Governed AI and intelligence platform | Governed AI request | 7. Provider/model selected | Identity providers | AI Gateway | ai_gateway.ai | ai_gateway.provider_model_selected |
| Governed AI and intelligence platform | Governed AI request | 8. Allowed sources retrieved | Approved sources | AI Gateway | ai_gateway.ai | ai_gateway.allowed_sources_retrieved |
| Governed AI and intelligence platform | Governed AI request | 9. Prompt/tool permission validated | GAP | AI Gateway | ai_gateway.ai | ai_gateway.prompt_tool_permission_validated |
| Governed AI and intelligence platform | Governed AI request | 10. Response generated | GAP | Student Workspace | student_workspace.ai | student_workspace.response_generated |
| Governed AI and intelligence platform | Governed AI request | 11. Sources and limits shown | Approved sources | AI Gateway | ai_gateway.review | ai_gateway.sources_and_limits_shown |
| Governed AI and intelligence platform | Governed AI request | 12. Suggested action presented | Action Center | Task | task.ai | task.suggested_action_presented |
| Governed AI and intelligence platform | Governed AI request | 13. Official handoff offered | Financial-support handoff | Community | community.handoff | community.official_handoff_offered |
| Governed AI and intelligence platform | Governed AI request | 14. Human escalation offered | GAP | Community | community.handoff | community.human_escalation_offered |
| Governed AI and intelligence platform | Governed AI request | 15. Usage/spend logged | GAP | Audit | audit.ai | audit.usage_spend_logged |
| Governed AI and intelligence platform | Governed AI request | 16. Audit/evaluation signal recorded | Audit explorer | Academic Record | academic_record.milestone | academic_record.audit_evaluation_signal_recorded |
| Governed AI and intelligence platform | Governed AI request | 17. Feedback/correction captured | GAP | Assessment | assessment.milestone | assessment.feedback_correction_captured |
| Advising, student success and support | Advising & student success | 1. Receive caseload | Caseload | Student Success | student_success.review | student_success.receive_caseload |
| Advising, student success and support | Advising & student success | 2. Review student path | Student path | Academic Path | academic_path.review | academic_path.review_student_path |
| Advising, student success and support | Advising & student success | 3. Review action completion | Action completion | Task | task.review | task.review_action_completion |
| Advising, student success and support | Advising & student success | 4. Schedule meeting | Appointment schedule | Calendar | calendar.form | calendar.schedule_meeting |
| Advising, student success and support | Advising & student success | 5. Record check-in | Check-ins | Academic Record | academic_record.form | academic_record.record_check_in |
| Advising, student success and support | Advising & student success | 6. Create success plan | Success plan | Student Success | student_success.form | student_success.create_success_plan |
| Advising, student success and support | Advising & student success | 7. Refer to office | GAP | Student Workspace | student_workspace.handoff | student_workspace.refer_to_office |
| Advising, student success and support | Advising & student success | 8. Track referral outcome | Referral workflow | Student Success | student_success.handoff | student_success.track_referral_outcome |
| Advising, student success and support | Advising & student success | 9. Send approved outreach | Outreach queue | Communication | communication.decide | communication.send_approved_outreach |
| Advising, student success and support | Advising & student success | 10. Review support request | Support request history | Support | support.handoff | support.review_support_request |
| Advising, student success and support | Advising & student success | 11. Review consented share | GAP | Privacy | privacy.consent | privacy.review_consented_share |
| Advising, student success and support | Advising & student success | 12. Escalate risk through approved process | Risk and priority signals | Student Success | student_success.decide | student_success.escalate_risk_through_approved_process |
| Advising, student success and support | Advising & student success | 13. Review cohort aggregates | Cohort dashboard | Tenant | tenant.review | tenant.review_cohort_aggregates |
| Advising, student success and support | Advising & student success | 14. Conduct term review | GAP | Student Success | student_success.review | student_success.conduct_term_review |
| Advising, student success and support | Advising & student success | 15. Prepare registration readiness outreach | Registration Readiness Pilot page | Registration | registration.comms | registration.prepare_registration_readiness_outreach |
| Advising, student success and support | Advising & student success | 16. Review intervention effectiveness | Intervention tracker | Student Success | student_success.review | student_success.review_intervention_effectiveness |
| Advising, student success and support | Advising & student success | 17. Close or transition case | GAP | Student Success | student_success.handoff | student_success.close_or_transition_case |
| Advising, student success and support | Support request | 1. User searches help | Course search | Support | support.review | support.user_searches_help |
| Advising, student success and support | Support request | 2. Opens support request | Support operations | Support | support.handoff | support.opens_support_request |
| Advising, student success and support | Support request | 3. Minimum safe context captured | GAP | Student Workspace | student_workspace.milestone | student_workspace.minimum_safe_context_captured |
| Advising, student success and support | Support request | 4. Categorized + severity | GAP | Support | support.form | support.categorized_severity |
| Advising, student success and support | Support request | 5. Routed to team/office | GAP | Support | support.handoff | support.routed_to_team_office |
| Advising, student success and support | Support request | 6. Owner accepts or routes | GAP | Support | support.handoff | support.owner_accepts_or_routes |
| Advising, student success and support | Support request | 7. User receives status | Registration status | Student Workspace | student_workspace.comms | student_workspace.user_receives_status |
| Advising, student success and support | Support request | 8. Resolution delivered | GAP | Support | support.form | support.resolution_delivered |
| Advising, student success and support | Support request | 9. Confirm or close | GAP | Support | support.review | support.confirm_or_close |
| Advising, student success and support | Support request | 10. Root cause tagged | GAP | Support | support.form | support.root_cause_tagged |
| Advising, student success and support | Support request | 11. Product/KB feedback loop | Products | Assessment | assessment.form | assessment.product_kb_feedback_loop |
| Advising, student success and support | Support request | 12. SLA and satisfaction recorded | GAP | Task | task.milestone | task.sla_and_satisfaction_recorded |
| Registrar, SIS and academic operations | Registrar & academic operations | 1. Create term | Term management | Registration | registration.form | registration.create_term |
| Registrar, SIS and academic operations | Registrar & academic operations | 2. Configure academic calendar | Academic calendar | Calendar | calendar.form | calendar.configure_academic_calendar |
| Registrar, SIS and academic operations | Registrar & academic operations | 3. Import/manage catalog | Catalog management | Academic Record | academic_record.sync | academic_record.import_manage_catalog |
| Registrar, SIS and academic operations | Registrar & academic operations | 4. Create sections | Section management | Registration | registration.form | registration.create_sections |
| Registrar, SIS and academic operations | Registrar & academic operations | 5. Assign capacity/waitlists | Capacity management | AI Gateway | ai_gateway.form | ai_gateway.assign_capacity_waitlists |
| Registrar, SIS and academic operations | Registrar & academic operations | 6. Define prerequisites/co-requisites | Prerequisite rules | Registration | registration.form | registration.define_prerequisites_co_requisites |
| Registrar, SIS and academic operations | Registrar & academic operations | 7. Publish registration windows | Registration windows | Registration | registration.form | registration.publish_registration_windows |
| Registrar, SIS and academic operations | Registrar & academic operations | 8. Issue time tickets | Time tickets | Registration | registration.form | registration.issue_time_tickets |
| Registrar, SIS and academic operations | Registrar & academic operations | 9. Sync holds | Holds | Financial Account | financial_account.sync | financial_account.sync_holds |
| Registrar, SIS and academic operations | Registrar & academic operations | 10. Grant override | Overrides | Authorization | authorization.decide | authorization.grant_override |
| Registrar, SIS and academic operations | Registrar & academic operations | 11. Review enrollment attempt | Enrollment queue | Registration | registration.review | registration.review_enrollment_attempt |
| Registrar, SIS and academic operations | Registrar & academic operations | 12. Approve/deny exception | Data-quality exceptions | Developer Platform | developer_platform.decide | developer_platform.approve_deny_exception |
| Registrar, SIS and academic operations | Registrar & academic operations | 13. Manage add/drop/withdrawal | Add/drop/withdrawal workflow | Registration | registration.form | registration.manage_add_drop_withdrawal |
| Registrar, SIS and academic operations | Registrar & academic operations | 14. Reconcile with SIS | GAP | Integration | integration.sync | integration.reconcile_with_sis |
| Registrar, SIS and academic operations | Registrar & academic operations | 15. Correct academic record | Academic record search | Academic Record | academic_record.decide | academic_record.correct_academic_record |
| Registrar, SIS and academic operations | Registrar & academic operations | 16. Manage grade changes | Grade change workflow | Gradebook | gradebook.form | gradebook.manage_grade_changes |
| Registrar, SIS and academic operations | Registrar & academic operations | 17. Run degree audit | Degree audit rules | Degree Audit | degree_audit.review | degree_audit.run_degree_audit |
| Registrar, SIS and academic operations | Registrar & academic operations | 18. Evaluate transfer credit | Transfer credit view | Transfer | transfer.form | transfer.evaluate_transfer_credit |
| Registrar, SIS and academic operations | Registrar & academic operations | 19. Review graduation | Graduation review | Academic Record | academic_record.review | academic_record.review_graduation |
| Registrar, SIS and academic operations | Registrar & academic operations | 20. Export official records | Academic record search | Academic Record | academic_record.form | academic_record.export_official_records |
| Registrar, SIS and academic operations | Registrar & academic operations | 21. Close-of-term audit | Term management | Audit | audit.form | audit.close_of_term_audit |
| Student accounts, billing and financial workflows | Student finance & payment | 1. Review student account | Account summary | Financial Account | financial_account.review | financial_account.review_student_account |
| Student accounts, billing and financial workflows | Student finance & payment | 2. Review charges and credits | Staff: Charge/credit request | Financial Account | financial_account.review | financial_account.review_charges_and_credits |
| Student accounts, billing and financial workflows | Student finance & payment | 3. See hold blocking registration | Holds and registration status | Registration | registration.form | registration.see_hold_blocking_registration |
| Student accounts, billing and financial workflows | Student finance & payment | 4. Open cost planner | Cost planner | Financial Account | financial_account.form | financial_account.open_cost_planner |
| Student accounts, billing and financial workflows | Student finance & payment | 5. Request payment plan | Payment plan | Payment Plan | payment_plan.handoff | payment_plan.request_payment_plan |
| Student accounts, billing and financial workflows | Student finance & payment | 6. Review plan terms | Payment plan | Student Workspace | student_workspace.review | student_workspace.review_plan_terms |
| Student accounts, billing and financial workflows | Student finance & payment | 7. Accept payment plan | Payment plan | Payment Plan | payment_plan.form | payment_plan.accept_payment_plan |
| Student accounts, billing and financial workflows | Student finance & payment | 8. Payment handoff to processor | Payment provider handoff | Identity | identity.handoff | identity.payment_handoff_to_processor |
| Student accounts, billing and financial workflows | Student finance & payment | 9. Processor confirms payment | Payment plan | Identity | identity.review | identity.processor_confirms_payment |
| Student accounts, billing and financial workflows | Student finance & payment | 10. Reconcile payment with SIS | Payment plan | Integration | integration.sync | integration.reconcile_payment_with_sis |
| Student accounts, billing and financial workflows | Student finance & payment | 11. Release hold | Holds | Financial Account | financial_account.form | financial_account.release_hold |
| Student accounts, billing and financial workflows | Student finance & payment | 12. Notify student of hold release | Holds | Financial Account | financial_account.comms | financial_account.notify_student_of_hold_release |
| Student accounts, billing and financial workflows | Student finance & payment | 13. Request refund status | Refund status | Financial Account | financial_account.handoff | financial_account.request_refund_status |
| Student accounts, billing and financial workflows | Student finance & payment | 14. Financial-aid handoff | Financial-aid handoff | AI Gateway | ai_gateway.handoff | ai_gateway.financial_aid_handoff |
| Student accounts, billing and financial workflows | Student finance & payment | 15. Emergency support request | Emergency aid resources | Support | support.handoff | support.emergency_support_request |
| Student accounts, billing and financial workflows | Student finance & payment | 16. Audit ledger reviewed | Staff: Audit ledger | Audit | audit.review | audit.audit_ledger_reviewed |
| Campus life and service super-app | Campus services | 1. Open campus map | Campus calendar | Student Workspace | student_workspace.form | student_workspace.open_campus_map |
| Campus life and service super-app | Campus services | 2. Find study space | Study space availability | Student Workspace | student_workspace.form | student_workspace.find_study_space |
| Campus life and service super-app | Campus services | 3. Check dining hours and menus | Dining hours | Dining | dining.form | dining.check_dining_hours_and_menus |
| Campus life and service super-app | Campus services | 4. Order dining | Dining locations | Dining | dining.form | dining.order_dining |
| Campus life and service super-app | Campus services | 5. Pay with meal balance | Meal balance | Financial Account | financial_account.form | financial_account.pay_with_meal_balance |
| Campus life and service super-app | Campus services | 6. Pick up order | Mobile order | Dining | dining.form | dining.pick_up_order |
| Campus life and service super-app | Campus services | 7. Donate meal swipes to pool | Meal plan | Dining | dining.form | dining.donate_meal_swipes_to_pool |
| Campus life and service super-app | Campus services | 8. Submit housing maintenance request | Housing assignment | AI Gateway | ai_gateway.handoff | ai_gateway.submit_housing_maintenance_request |
| Campus life and service super-app | Campus services | 9. Housing staff accepts request | Housing assignment | Housing | housing.handoff | housing.housing_staff_accepts_request |
| Campus life and service super-app | Campus services | 10. Request resolved | GAP | Student Workspace | student_workspace.milestone | student_workspace.request_resolved |
| Campus life and service super-app | Campus services | 11. Find accessibility services | Accessibility services | Campus Services | campus_services.form | campus_services.find_accessibility_services |
| Campus life and service super-app | Campus services | 12. Request accommodation | GAP | Campus Services | campus_services.handoff | campus_services.request_accommodation |
| Campus life and service super-app | Campus services | 13. Accommodation approved | GAP | Campus Services | campus_services.decide | campus_services.accommodation_approved |
| Campus life and service super-app | Campus services | 14. Find safety resources | Safety resources | AI Gateway | ai_gateway.form | ai_gateway.find_safety_resources |
| Campus life and service super-app | Campus services | 15. Wellness handoff | Housing handoff | Student Workspace | student_workspace.handoff | student_workspace.wellness_handoff |
| Community, organizations and peer connection | Community & moderation | 1. Set profile visibility per field | GAP | Migration | migration.form | migration.set_profile_visibility_per_field |
| Community, organizations and peer connection | Community & moderation | 2. Choose alias for public posts | Post creation | Community | community.form | community.choose_alias_for_public_posts |
| Community, organizations and peer connection | Community & moderation | 3. Join course community | Community directory | Course | course.form | course.join_course_community |
| Community, organizations and peer connection | Community & moderation | 4. Join organization space | Organization communities | Community | community.form | community.join_organization_space |
| Community, organizations and peer connection | Community & moderation | 5. Create post | Post creation | Community | community.form | community.create_post |
| Community, organizations and peer connection | Community & moderation | 6. AI pre-screen public post | Post creation | AI Gateway | ai_gateway.form | ai_gateway.ai_pre_screen_public_post |
| Community, organizations and peer connection | Community & moderation | 7. Post published | Post creation | Community | community.milestone | community.post_published |
| Community, organizations and peer connection | Community & moderation | 8. Ask question in Q&A | Question bank | Community | community.form | community.ask_question_in_q_a |
| Community, organizations and peer connection | Community & moderation | 9. Answer endorsed by TA | GAP | Community | community.form | community.answer_endorsed_by_ta |
| Community, organizations and peer connection | Community & moderation | 10. Create marketplace listing | GAP | Community | community.form | community.create_marketplace_listing |
| Community, organizations and peer connection | Community & moderation | 11. Integrity filter checks listing | GAP | Community | community.form | community.integrity_filter_checks_listing |
| Community, organizations and peer connection | Community & moderation | 12. Make offer in chat | GAP | Community | community.form | community.make_offer_in_chat |
| Community, organizations and peer connection | Community & moderation | 13. Arrange safe meet-up | GAP | Community | community.form | community.arrange_safe_meet_up |
| Community, organizations and peer connection | Community & moderation | 14. Report content | Report content | Community | community.form | community.report_content |
| Community, organizations and peer connection | Community & moderation | 15. Moderator reviews report | Report content | Community | community.review | community.moderator_reviews_report |
| Community, organizations and peer connection | Community & moderation | 16. Remove content or warn | Report content | Student Workspace | student_workspace.decide | student_workspace.remove_content_or_warn |
| Community, organizations and peer connection | Community & moderation | 17. Student appeals | Appeal decision | Community | community.handoff | community.student_appeals |
| Community, organizations and peer connection | Community & moderation | 18. Appeal decided | Appeal decision | Community | community.decide | community.appeal_decided |
| Community, organizations and peer connection | Community & moderation | 19. Safety escalation | Community safety resources | Student Workspace | student_workspace.handoff | student_workspace.safety_escalation |
| Community, organizations and peer connection | Community & moderation | 20. Community health reviewed | Community directory | Community | community.review | community.community_health_reviewed |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 1. Build skills profile | Skills graph | Career | career.form | career.build_skills_profile |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 2. Add evidence to portfolio | Skill evidence | Career | career.form | career.add_evidence_to_portfolio |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 3. Request skill verification | Skills graph | Career | career.handoff | career.request_skill_verification |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 4. Faculty verifies skill | Skills graph | Career | career.decide | career.faculty_verifies_skill |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 5. Generate resume from evidence | Skill evidence | Career | career.form | career.generate_resume_from_evidence |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 6. Search opportunities | Opportunity search | Career | career.review | career.search_opportunities |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 7. Employer posts internship | Employer: Internship management | Community | community.form | community.employer_posts_internship |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 8. Career staff approves posting | Career plan | Community | community.decide | community.career_staff_approves_posting |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 9. Apply to internship | Internship postings | Career | career.handoff | career.apply_to_internship |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 10. Employer reviews approved evidence | Skill evidence | Career | career.decide | career.employer_reviews_approved_evidence |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 11. Book career appointment | Career appointments | Developer Platform | developer_platform.handoff | developer_platform.book_career_appointment |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 12. Interview scheduled | Interview preparation | Career | career.form | career.interview_scheduled |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 13. Offer recorded | Alumni mentor offers | Academic Record | academic_record.milestone | academic_record.offer_recorded |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 14. Career outcome captured | Career outcome history | Student Workspace | student_workspace.milestone | student_workspace.career_outcome_captured |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 15. Transition to alumni | Alumni mentor offers | Career | career.handoff | career.transition_to_alumni |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 16. Alumni offers mentoring | Alumni mentor offers | Career | career.form | career.alumni_offers_mentoring |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 17. Mentor matched with student | Mentor directory | Career | career.milestone | career.mentor_matched_with_student |
| Career, alumni, employer and lifelong learning | Career, employer & alumni | 18. Continuing education enrolment | Continuing education | Student Workspace | student_workspace.form | student_workspace.continuing_education_enrolment |
| Family and guardian consent platform | Family & guardian consent | 1. Student opens family sharing | Family sharing | Privacy | privacy.handoff | privacy.student_opens_family_sharing |
| Family and guardian consent platform | Family & guardian consent | 2. Choose information categories | Shared categories | Family/Guardian | family_guardian.form | family_guardian.choose_information_categories |
| Family and guardian consent platform | Family & guardian consent | 3. Set access expiry | Time-limited access | Family/Guardian | family_guardian.form | family_guardian.set_access_expiry |
| Family and guardian consent platform | Family & guardian consent | 4. Send consent invitation | Invitation acceptance | Privacy | privacy.consent | privacy.send_consent_invitation |
| Family and guardian consent platform | Family & guardian consent | 5. Guardian confirms relationship | Relationship confirmation | Family/Guardian | family_guardian.review | family_guardian.guardian_confirms_relationship |
| Family and guardian consent platform | Family & guardian consent | 6. Guardian accepts scope | Consent scope | Authorization | authorization.decide | authorization.guardian_accepts_scope |
| Family and guardian consent platform | Family & guardian consent | 7. Guardian views shared items | Shared items | Privacy | privacy.consent | privacy.guardian_views_shared_items |
| Family and guardian consent platform | Family & guardian consent | 8. Billing/support handoff | Billing/support handoff | Support | support.handoff | support.billing_support_handoff |
| Family and guardian consent platform | Family & guardian consent | 9. Access history reviewed | Access history | Student Workspace | student_workspace.review | student_workspace.access_history_reviewed |
| Family and guardian consent platform | Family & guardian consent | 10. Student narrows scope | Consent scope | Authorization | authorization.decide | authorization.student_narrows_scope |
| Family and guardian consent platform | Family & guardian consent | 11. Student revokes access | Time-limited access | Student Workspace | student_workspace.decide | student_workspace.student_revokes_access |
| Family and guardian consent platform | Family & guardian consent | 12. Access expires automatically | Time-limited access | Student Workspace | student_workspace.form | student_workspace.access_expires_automatically |
| Family and guardian consent platform | Family & guardian consent | 13. Audit retained | GAP | AI Gateway | ai_gateway.form | ai_gateway.audit_retained |
| Institutional administration and control plane | Institution implementation | 1. Contract signed | Contracts | Billing | billing.milestone | billing.contract_signed |
| Institutional administration and control plane | Institution implementation | 2. Tenant created | Tenant overview | Tenant | tenant.milestone | tenant.tenant_created |
| Institutional administration and control plane | Institution implementation | 3. Executive sponsor named | Executive Overview | Student Workspace | student_workspace.milestone | student_workspace.executive_sponsor_named |
| Institutional administration and control plane | Institution implementation | 4. Operational champion named | GAP | Student Workspace | student_workspace.milestone | student_workspace.operational_champion_named |
| Institutional administration and control plane | Institution implementation | 5. Security/privacy scope confirmed | Privacy requests | Authorization | authorization.consent | authorization.security_privacy_scope_confirmed |
| Institutional administration and control plane | Institution implementation | 6. Data/integration inventory | Priv: Data inventory | Integration | integration.sync | integration.data_integration_inventory |
| Institutional administration and control plane | Institution implementation | 7. SSO/identity configured | Identity providers | Identity | identity.form | identity.sso_identity_configured |
| Institutional administration and control plane | Institution implementation | 8. Tenant policy configured | Tenant overview | Tenant | tenant.form | tenant.tenant_policy_configured |
| Institutional administration and control plane | Institution implementation | 9. Roles configured | Roles | Authorization | authorization.form | authorization.roles_configured |
| Institutional administration and control plane | Institution implementation | 10. Feature cohorts configured | Feature cohorts | Tenant | tenant.form | tenant.feature_cohorts_configured |
| Institutional administration and control plane | Institution implementation | 11. Data mapping approved | Data classification | Integration | integration.decide | integration.data_mapping_approved |
| Institutional administration and control plane | Institution implementation | 12. Sandbox sync tested | Sync health | Integration | integration.sync | integration.sandbox_sync_tested |
| Institutional administration and control plane | Institution implementation | 13. Reconciliation passed | GAP | Integration | integration.milestone | integration.reconciliation_passed |
| Institutional administration and control plane | Institution implementation | 14. Admin training | GAP | AI Gateway | ai_gateway.comms | ai_gateway.admin_training |
| Institutional administration and control plane | Institution implementation | 15. Student communication prepared | GAP | Communication | communication.comms | communication.student_communication_prepared |
| Institutional administration and control plane | Institution implementation | 16. Launch readiness gate passed | GAP | Student Workspace | student_workspace.milestone | student_workspace.launch_readiness_gate_passed |
| Institutional administration and control plane | Institution implementation | 17. Controlled launch | GAP | Student Workspace | student_workspace.milestone | student_workspace.controlled_launch |
| Institutional administration and control plane | Institution implementation | 18. Adoption monitored | GAP | Student Workspace | student_workspace.review | student_workspace.adoption_monitored |
| Institutional administration and control plane | Institution implementation | 19. Support and incident path live | Incident notices | Academic Path | academic_path.milestone | academic_path.support_and_incident_path_live |
| Institutional administration and control plane | Institution implementation | 20. Midpoint review | GAP | Student Workspace | student_workspace.review | student_workspace.midpoint_review |
| Institutional administration and control plane | Institution implementation | 21. Pilot outcome review | Pilot outcomes | Student Workspace | student_workspace.review | student_workspace.pilot_outcome_review |
| Institutional administration and control plane | Institution implementation | 22. Annual conversion or offboarding | Offboarding | Billing | billing.consent | billing.annual_conversion_or_offboarding |
| Integration, migration and interoperability fabric | Controlled integration | 1. Integration request | Integration analytics | Integration | integration.handoff | integration.integration_request |
| Integration, migration and interoperability fabric | Controlled integration | 2. Business purpose defined | GAP | Student Workspace | student_workspace.form | student_workspace.business_purpose_defined |
| Integration, migration and interoperability fabric | Controlled integration | 3. Data classification identified | Data classification | Course | course.review | course.data_classification_identified |
| Integration, migration and interoperability fabric | Controlled integration | 4. Security/privacy review | Security review | Privacy | privacy.consent | privacy.security_privacy_review |
| Integration, migration and interoperability fabric | Controlled integration | 5. Scope requested | Scope approval | Authorization | authorization.handoff | authorization.scope_requested |
| Integration, migration and interoperability fabric | Controlled integration | 6. Tenant approval | Scope approval | Tenant | tenant.form | tenant.tenant_approval |
| Integration, migration and interoperability fabric | Controlled integration | 7. Credential configured server-side | Credentials configuration | Integration | integration.sync | integration.credential_configured_server_side |
| Integration, migration and interoperability fabric | Controlled integration | 8. Sandbox validated | GAP | Integration | integration.sync | integration.sandbox_validated |
| Integration, migration and interoperability fabric | Controlled integration | 9. Mapping created | Mapping studio | Integration | integration.milestone | integration.mapping_created |
| Integration, migration and interoperability fabric | Controlled integration | 10. Mapping version approved | Mapping versions | Integration | integration.decide | integration.mapping_version_approved |
| Integration, migration and interoperability fabric | Controlled integration | 11. Read-only sync enabled | Sync schedule | Integration | integration.sync | integration.read_only_sync_enabled |
| Integration, migration and interoperability fabric | Controlled integration | 12. Reconciliation passed | Reconciliation dashboard | Integration | integration.milestone | integration.reconciliation_passed |
| Integration, migration and interoperability fabric | Controlled integration | 13. Monitoring enabled | GAP | Student Workspace | student_workspace.sync | student_workspace.monitoring_enabled |
| Integration, migration and interoperability fabric | Controlled integration | 14. Write direction requested | GAP | Integration | integration.handoff | integration.write_direction_requested |
| Integration, migration and interoperability fabric | Controlled integration | 15. Higher approval required | Scope approval | Developer Platform | developer_platform.decide | developer_platform.higher_approval_required |
| Integration, migration and interoperability fabric | Controlled integration | 16. Controlled write pilot | GAP | Integration | integration.form | integration.controlled_write_pilot |
| Integration, migration and interoperability fabric | Controlled integration | 17. Rollback verified | GAP | Release | release.form | release.rollback_verified |
| Integration, migration and interoperability fabric | Controlled integration | 18. Production approval | Scope approval | Developer Platform | developer_platform.decide | developer_platform.production_approval |
| Integration, migration and interoperability fabric | Controlled integration | 19. Periodic scope review | Scope approval | Authorization | authorization.review | authorization.periodic_scope_review |
| Integration, migration and interoperability fabric | Controlled integration | 20. Retirement/offboarding | Integration offboarding | Student Workspace | student_workspace.consent | student_workspace.retirement_offboarding |
| Integration, migration and interoperability fabric | Domain migration | 1. Domain inventory | GAP | AI Gateway | ai_gateway.sync | ai_gateway.domain_inventory |
| Integration, migration and interoperability fabric | Domain migration | 2. Source data inventory | Priv: Data inventory | Student Workspace | student_workspace.sync | student_workspace.source_data_inventory |
| Integration, migration and interoperability fabric | Domain migration | 3. Field mapping | Mapping studio | Integration | integration.sync | integration.field_mapping |
| Integration, migration and interoperability fabric | Domain migration | 4. Data classification | Data classification | Course | course.form | course.data_classification |
| Integration, migration and interoperability fabric | Domain migration | 5. Import staging | OneRoster import | Migration | migration.sync | migration.import_staging |
| Integration, migration and interoperability fabric | Domain migration | 6. Validation | GAP | Migration | migration.sync | migration.validation |
| Integration, migration and interoperability fabric | Domain migration | 7. Duplicate/conflict resolution | Duplicate resolution | Support | support.form | support.duplicate_conflict_resolution |
| Integration, migration and interoperability fabric | Domain migration | 8. Reconciliation | Reconciliation dashboard | Integration | integration.sync | integration.reconciliation |
| Integration, migration and interoperability fabric | Domain migration | 9. Dual run | GAP | Migration | migration.sync | migration.dual_run |
| Integration, migration and interoperability fabric | Domain migration | 10. User acceptance | GAP | Student Workspace | student_workspace.form | student_workspace.user_acceptance |
| Integration, migration and interoperability fabric | Domain migration | 11. Institution approval | Scope approval | Developer Platform | developer_platform.form | developer_platform.institution_approval |
| Integration, migration and interoperability fabric | Domain migration | 12. Cutover | GAP | Migration | migration.decide | migration.cutover |
| Integration, migration and interoperability fabric | Domain migration | 13. Enhanced monitoring | GAP | Student Workspace | student_workspace.review | student_workspace.enhanced_monitoring |
| Integration, migration and interoperability fabric | Domain migration | 14. Rollback window | GAP | Registration | registration.form | registration.rollback_window |
| Integration, migration and interoperability fabric | Domain migration | 15. Archive/export | Data export/portability | Migration | migration.sync | migration.archive_export |
| Integration, migration and interoperability fabric | Domain migration | 16. Legacy retirement | GAP | Migration | migration.sync | migration.legacy_retirement |
| Integration, migration and interoperability fabric | Domain migration | 17. Post-migration review | GAP | Migration | migration.review | migration.post_migration_review |
| Security, privacy, accessibility, compliance and trust | Incident response | 1. Alert or report | Operating review reports | Security | security.review | security.alert_or_report |
| Security, privacy, accessibility, compliance and trust | Incident response | 2. Triage | GAP | Security | security.review | security.triage |
| Security, privacy, accessibility, compliance and trust | Incident response | 3. Severity declared | GAP | Security | security.decide | security.severity_declared |
| Security, privacy, accessibility, compliance and trust | Incident response | 4. Incident commander | Incidents | Security | security.milestone | security.incident_commander |
| Security, privacy, accessibility, compliance and trust | Incident response | 5. Technical lead | GAP | Security | security.milestone | security.technical_lead |
| Security, privacy, accessibility, compliance and trust | Incident response | 6. Communications lead | GAP | Security | security.milestone | security.communications_lead |
| Security, privacy, accessibility, compliance and trust | Incident response | 7. Impact assessed | Priv: Impact assessments | Security | security.review | security.impact_assessed |
| Security, privacy, accessibility, compliance and trust | Incident response | 8. Risky releases paused | Release evidence | Student Success | student_success.decide | student_success.risky_releases_paused |
| Security, privacy, accessibility, compliance and trust | Incident response | 9. Mitigation executed | GAP | Security | security.form | security.mitigation_executed |
| Security, privacy, accessibility, compliance and trust | Incident response | 10. Internal update | GAP | Communication | communication.comms | communication.internal_update |
| Security, privacy, accessibility, compliance and trust | Incident response | 11. Customer update | Customer Directory | Communication | communication.comms | communication.customer_update |
| Security, privacy, accessibility, compliance and trust | Incident response | 12. Recovery monitored | Sec: Disaster recovery | Security | security.review | security.recovery_monitored |
| Security, privacy, accessibility, compliance and trust | Incident response | 13. Resolved | GAP | Student Workspace | student_workspace.milestone | student_workspace.resolved |
| Security, privacy, accessibility, compliance and trust | Incident response | 14. Postmortem | GAP | Security | security.review | security.postmortem |
| Security, privacy, accessibility, compliance and trust | Incident response | 15. Corrective actions to Inbox | Operations Inbox | Task | task.form | task.corrective_actions_to_inbox |
| Security, privacy, accessibility, compliance and trust | Incident response | 16. SLO/error budget reviewed | Error budgets | Release | release.review | release.slo_error_budget_reviewed |
| Security, privacy, accessibility, compliance and trust | Incident response | 17. Release policy updated | Release evidence | Tenant | tenant.form | tenant.release_policy_updated |
| Operations command center | Support request | 1. User searches help | Course search | Support | support.review | support.user_searches_help |
| Operations command center | Support request | 2. Opens support request | Support operations | Support | support.handoff | support.opens_support_request |
| Operations command center | Support request | 3. Minimum safe context captured | GAP | Student Workspace | student_workspace.milestone | student_workspace.minimum_safe_context_captured |
| Operations command center | Support request | 4. Categorized + severity | GAP | Support | support.form | support.categorized_severity |
| Operations command center | Support request | 5. Routed to team/office | GAP | Support | support.handoff | support.routed_to_team_office |
| Operations command center | Support request | 6. Owner accepts or routes | GAP | Support | support.handoff | support.owner_accepts_or_routes |
| Operations command center | Support request | 7. User receives status | Registration status | Student Workspace | student_workspace.comms | student_workspace.user_receives_status |
| Operations command center | Support request | 8. Resolution delivered | GAP | Support | support.form | support.resolution_delivered |
| Operations command center | Support request | 9. Confirm or close | GAP | Support | support.review | support.confirm_or_close |
| Operations command center | Support request | 10. Root cause tagged | GAP | Support | support.form | support.root_cause_tagged |
| Operations command center | Support request | 11. Product/KB feedback loop | Products | Assessment | assessment.form | assessment.product_kb_feedback_loop |
| Operations command center | Support request | 12. SLA and satisfaction recorded | GAP | Task | task.milestone | task.sla_and_satisfaction_recorded |
| Operations command center | Incident response | 1. Alert or report | Operating review reports | Security | security.review | security.alert_or_report |
| Operations command center | Incident response | 2. Triage | GAP | Security | security.review | security.triage |
| Operations command center | Incident response | 3. Severity declared | GAP | Security | security.decide | security.severity_declared |
| Operations command center | Incident response | 4. Incident commander | Incidents | Security | security.milestone | security.incident_commander |
| Operations command center | Incident response | 5. Technical lead | GAP | Security | security.milestone | security.technical_lead |
| Operations command center | Incident response | 6. Communications lead | GAP | Security | security.milestone | security.communications_lead |
| Operations command center | Incident response | 7. Impact assessed | Priv: Impact assessments | Security | security.review | security.impact_assessed |
| Operations command center | Incident response | 8. Risky releases paused | Release evidence | Student Success | student_success.decide | student_success.risky_releases_paused |
| Operations command center | Incident response | 9. Mitigation executed | GAP | Security | security.form | security.mitigation_executed |
| Operations command center | Incident response | 10. Internal update | GAP | Communication | communication.comms | communication.internal_update |
| Operations command center | Incident response | 11. Customer update | Customer Directory | Communication | communication.comms | communication.customer_update |
| Operations command center | Incident response | 12. Recovery monitored | Sec: Disaster recovery | Security | security.review | security.recovery_monitored |
| Operations command center | Incident response | 13. Resolved | GAP | Student Workspace | student_workspace.milestone | student_workspace.resolved |
| Operations command center | Incident response | 14. Postmortem | GAP | Security | security.review | security.postmortem |
| Operations command center | Incident response | 15. Corrective actions to Inbox | Operations Inbox | Task | task.form | task.corrective_actions_to_inbox |
| Operations command center | Incident response | 16. SLO/error budget reviewed | Error budgets | Release | release.review | release.slo_error_budget_reviewed |
| Operations command center | Incident response | 17. Release policy updated | Release evidence | Tenant | tenant.form | tenant.release_policy_updated |
| Revenue, GTM, customer success and company operations | Institution implementation | 1. Contract signed | Contracts | Billing | billing.milestone | billing.contract_signed |
| Revenue, GTM, customer success and company operations | Institution implementation | 2. Tenant created | Tenant overview | Tenant | tenant.milestone | tenant.tenant_created |
| Revenue, GTM, customer success and company operations | Institution implementation | 3. Executive sponsor named | Executive Overview | Student Workspace | student_workspace.milestone | student_workspace.executive_sponsor_named |
| Revenue, GTM, customer success and company operations | Institution implementation | 4. Operational champion named | GAP | Student Workspace | student_workspace.milestone | student_workspace.operational_champion_named |
| Revenue, GTM, customer success and company operations | Institution implementation | 5. Security/privacy scope confirmed | Privacy requests | Authorization | authorization.consent | authorization.security_privacy_scope_confirmed |
| Revenue, GTM, customer success and company operations | Institution implementation | 6. Data/integration inventory | Priv: Data inventory | Integration | integration.sync | integration.data_integration_inventory |
| Revenue, GTM, customer success and company operations | Institution implementation | 7. SSO/identity configured | Identity providers | Identity | identity.form | identity.sso_identity_configured |
| Revenue, GTM, customer success and company operations | Institution implementation | 8. Tenant policy configured | Tenant overview | Tenant | tenant.form | tenant.tenant_policy_configured |
| Revenue, GTM, customer success and company operations | Institution implementation | 9. Roles configured | Roles | Authorization | authorization.form | authorization.roles_configured |
| Revenue, GTM, customer success and company operations | Institution implementation | 10. Feature cohorts configured | Feature cohorts | Tenant | tenant.form | tenant.feature_cohorts_configured |
| Revenue, GTM, customer success and company operations | Institution implementation | 11. Data mapping approved | Data classification | Integration | integration.decide | integration.data_mapping_approved |
| Revenue, GTM, customer success and company operations | Institution implementation | 12. Sandbox sync tested | Sync health | Integration | integration.sync | integration.sandbox_sync_tested |
| Revenue, GTM, customer success and company operations | Institution implementation | 13. Reconciliation passed | GAP | Integration | integration.milestone | integration.reconciliation_passed |
| Revenue, GTM, customer success and company operations | Institution implementation | 14. Admin training | GAP | AI Gateway | ai_gateway.comms | ai_gateway.admin_training |
| Revenue, GTM, customer success and company operations | Institution implementation | 15. Student communication prepared | GAP | Communication | communication.comms | communication.student_communication_prepared |
| Revenue, GTM, customer success and company operations | Institution implementation | 16. Launch readiness gate passed | GAP | Student Workspace | student_workspace.milestone | student_workspace.launch_readiness_gate_passed |
| Revenue, GTM, customer success and company operations | Institution implementation | 17. Controlled launch | GAP | Student Workspace | student_workspace.milestone | student_workspace.controlled_launch |
| Revenue, GTM, customer success and company operations | Institution implementation | 18. Adoption monitored | GAP | Student Workspace | student_workspace.review | student_workspace.adoption_monitored |
| Revenue, GTM, customer success and company operations | Institution implementation | 19. Support and incident path live | Incident notices | Academic Path | academic_path.milestone | academic_path.support_and_incident_path_live |
| Revenue, GTM, customer success and company operations | Institution implementation | 20. Midpoint review | GAP | Student Workspace | student_workspace.review | student_workspace.midpoint_review |
| Revenue, GTM, customer success and company operations | Institution implementation | 21. Pilot outcome review | Pilot outcomes | Student Workspace | student_workspace.review | student_workspace.pilot_outcome_review |
| Revenue, GTM, customer success and company operations | Institution implementation | 22. Annual conversion or offboarding | Offboarding | Billing | billing.consent | billing.annual_conversion_or_offboarding |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 1. Define success measures with sponsor | Success plans | Student Success | student_success.form | student_success.define_success_measures_with_sponsor |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 2. Measures sheet signed | GAP | Analytics | analytics.milestone | analytics.measures_sheet_signed |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 3. Instrument events (no PII) | GAP | Community | community.form | community.instrument_events_no_pii |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 4. Aggregate with minimum cell size | GAP | Analytics | analytics.review | analytics.aggregate_with_minimum_cell_size |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 5. Weekly metrics review | Pilot metrics | Analytics | analytics.review | analytics.weekly_metrics_review |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 6. SLO dashboard reviewed | Finance dashboard | Release | release.review | release.slo_dashboard_reviewed |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 7. Error budget checked | Error budgets | Release | release.review | release.error_budget_checked |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 8. Pilot midpoint report | Pilot Workspace | Student Workspace | student_workspace.form | student_workspace.pilot_midpoint_report |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 9. Course analytics shared with faculty | GAP | Course | course.consent | course.course_analytics_shared_with_faculty |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 10. Program outcomes reviewed | Pilot outcomes | Academic Path | academic_path.review | academic_path.program_outcomes_reviewed |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 11. Pilot results report | Pilot Workspace | Student Workspace | student_workspace.form | student_workspace.pilot_results_report |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 12. Improvement backlog prioritized | GAP | Student Workspace | student_workspace.form | student_workspace.improvement_backlog_prioritized |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 13. Release evidence recorded | Release evidence | Academic Record | academic_record.milestone | academic_record.release_evidence_recorded |
| Revenue, GTM, customer success and company operations | Analytics, outcomes & reliability | 14. Quarterly operating review | Operating review reports | Student Workspace | student_workspace.review | student_workspace.quarterly_operating_review |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 1. Partner applies | GAP | Developer Platform | developer_platform.handoff | developer_platform.partner_applies |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 2. Partner agreement signed | GAP | Developer Platform | developer_platform.milestone | developer_platform.partner_agreement_signed |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 3. Sandbox tenant created | GAP | Tenant | tenant.milestone | tenant.sandbox_tenant_created |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 4. Request data scopes | Scope approval | Authorization | authorization.handoff | authorization.request_data_scopes |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 5. Security review of app | Security review | Developer Platform | developer_platform.review | developer_platform.security_review_of_app |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 6. Scopes approved | Scope approval | Authorization | authorization.decide | authorization.scopes_approved |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 7. Register OAuth client | GAP | Developer Platform | developer_platform.form | developer_platform.register_oauth_client |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 8. Configure webhooks | Webhook events | Developer Platform | developer_platform.form | developer_platform.configure_webhooks |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 9. Build against SDK | GAP | AI Gateway | ai_gateway.form | ai_gateway.build_against_sdk |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 10. Integration certification | Integration analytics | Integration | integration.form | integration.integration_certification |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 11. App review | GAP | Developer Platform | developer_platform.review | developer_platform.app_review |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 12. Listed in marketplace | GAP | Marketplace | marketplace.milestone | marketplace.listed_in_marketplace |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 13. Institution enables app | GAP | Developer Platform | developer_platform.decide | developer_platform.institution_enables_app |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 14. Metering and billing | GAP | Billing | billing.form | billing.metering_and_billing |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 15. Version deprecation notice | Mapping versions | Student Workspace | student_workspace.form | student_workspace.version_deprecation_notice |
| Developer platform, marketplace and partner ecosystem | Developer platform & marketplace | 16. App retired | GAP | Developer Platform | developer_platform.milestone | developer_platform.app_retired |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 1. Define success measures with sponsor | Success plans | Student Success | student_success.form | student_success.define_success_measures_with_sponsor |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 2. Measures sheet signed | GAP | Analytics | analytics.milestone | analytics.measures_sheet_signed |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 3. Instrument events (no PII) | GAP | Community | community.form | community.instrument_events_no_pii |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 4. Aggregate with minimum cell size | GAP | Analytics | analytics.review | analytics.aggregate_with_minimum_cell_size |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 5. Weekly metrics review | Pilot metrics | Analytics | analytics.review | analytics.weekly_metrics_review |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 6. SLO dashboard reviewed | Finance dashboard | Release | release.review | release.slo_dashboard_reviewed |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 7. Error budget checked | Error budgets | Release | release.review | release.error_budget_checked |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 8. Pilot midpoint report | Pilot Workspace | Student Workspace | student_workspace.form | student_workspace.pilot_midpoint_report |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 9. Course analytics shared with faculty | GAP | Course | course.consent | course.course_analytics_shared_with_faculty |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 10. Program outcomes reviewed | Pilot outcomes | Academic Path | academic_path.review | academic_path.program_outcomes_reviewed |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 11. Pilot results report | Pilot Workspace | Student Workspace | student_workspace.form | student_workspace.pilot_results_report |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 12. Improvement backlog prioritized | GAP | Student Workspace | student_workspace.form | student_workspace.improvement_backlog_prioritized |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 13. Release evidence recorded | Release evidence | Academic Record | academic_record.milestone | academic_record.release_evidence_recorded |
| Analytics, outcomes, reliability and continuous improvement | Analytics, outcomes & reliability | 14. Quarterly operating review | Operating review reports | Student Workspace | student_workspace.review | student_workspace.quarterly_operating_review |
