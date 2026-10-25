# Semester logical schema for all three operating layers (proposed)

> Source: same document, sections 4.2–4.7. A proposal: map it onto the existing Zite tables; do not create a parallel model.
> Text extracted from the PDF with its layout kept; read it as the governing brief, not as proof that anything exists.

```text
4.2 Shared platform schema
                         Table                                   Principal columns

        platform.users                             id, display_name, status, timestamps

        platform.identity_links                    id, user_id, provider, provider_subject

                          Table                                  Principal columns

         platform.workspaces                 id, kind, name, status, region

         platform.departments                id, workspace_id, parent_id, name

         platform.memberships                id, workspace_id, user_id, status, validity

         platform.roles                      id, key, description

         platform.capabilities               id, key, description

         platform.role_capabilities          role_id, capability_id

         platform.role_assignments           id, membership_id, role_id, scope, expiry

         platform.resources                  id, workspace_id, kind, owner, classification

         platform.resource_grants            id, resource_id, grantee, action, expiry

         platform.consents                   id, grantor, recipient, purpose, scope, expiry, status

         platform.delegations                id, delegator, delegate, scope, expiry, status

         platform.policy_versions            id, workspace_id, key, version, effective dates

         platform.files                      id, resource_id, storage key, media type, retention

         platform.audit_events               id, actor, scope, action, target, outcome, correlation

         platform.outbox_events              id, type, version, payload, publication status

         platform.consumer_receipts          consumer, event ID, processed time

         platform.idempotency_records        scope, key, request hash, response, expiry

         platform.jobs                       id, type, scope, status, attempts, next run

         platform.feature_flags              key, scope, state, reviewed configuration

         platform.notification_preferences   user, scope, category, channel, state

         platform.notifications              id, user, scope, template, status

         platform.delivery_attempts          notification, channel, provider reference, outcome


4.3 Layer 1: Education Experience schema
    Domain                                   Tables and key fields

 Personal        student_profiles(user_id, preferences); student_memberships(user_id,
 identity        institution_workspace_id, status)

 Goals           goals(id, workspace_id, owner_user_id, title, target_date, status)

                 plans(id, workspace_id, owner_user_id, kind, title, status);
 Plans
                 plan_items(id, plan_id, resource_id, position)

                 tasks(id, workspace_id, owner_user_id, title, due_at, state,
 Tasks
                 source_resource_id, version)

      Domain                                   Tables and key fields

                  calendars(id, workspace_id, owner_user_id, timezone);
  Calendar        calendar_events(id, calendar_id, starts_at, ends_at,
                  source_resource_id)

                  documents(id, resource_id, title, current_version_id);
  Documents
                  document_versions(id, document_id, content_ref, author_id)

  Notes           notes(id, resource_id, context_resource_id, content_ref)

                  study_sets(id, resource_id, course_section_id); study_items(id,
  Study           study_set_id, prompt_ref, answer_ref); study_sessions(id, user_id,
                  study_set_id, started_at, ended_at)

                  appointment_requests(id, workspace_id, requester_id, service_id,
  Appointments
                  state)

  Support         service_requests(id, workspace_id, requester_id, service_id, state,
  experience      restricted_content_ref)

                  career_profiles(id, resource_id); portfolio_items(id, resource_id,
  Career
                  evidence_ref); applications(id, owner_user_id, opportunity_id, state)

                  groups(id, workspace_id, visibility); group_memberships(group_id,
  Community
                  user_id, role); posts(id, resource_id, group_id, body_ref)

                  content_reports(id, workspace_id, target_resource_id, state);
  Moderation
                  moderation_actions(id, report_id, actor_id, action)

                  conversations(id, workspace_id, kind);
  Messaging       conversation_members(conversation_id, user_id); messages(id,
                  conversation_id, sender_id, content_ref)

                  listings(id, workspace_id, seller_id, state); orders(id, buyer_id,
  Marketplace     listing_id, state, amount_minor, currency); disputes(id, order_id,
                  state)

Private personal data belongs in a personal scope. Institution-controlled academic information
belongs in the institution scope. Connecting the two should use authorized references and
sharing rules, not a single institution-owned student row containing everything.

4.4 Layer 2: Institution OS schema
       Domain                                   Tables and key fields

                    institutions(workspace_id, legal_name, timezone); campuses(id,
  Institution
                    workspace_id, name)

  Academic time     academic_terms(id, workspace_id, code, starts_on, ends_on)

                    programs(id, workspace_id, code, title); program_requirements(id,
  Programs
                    program_id, policy_version_id, rule_definition)

                    courses(id, workspace_id, code, title, credits); course_sections(id,
  Courses
                    workspace_id, course_id, term_id, status)

     Domain                                  Tables and key fields

                  section_staff(id, workspace_id, section_id, user_id,
Teaching
                  responsibility)

                  enrollments(id, workspace_id, section_id, student_user_id, state,
Enrollment
                  source_ref)

                  assignments(id, workspace_id, section_id, title, due_at,
Assignments
                  authority_mode)

                  submissions(id, workspace_id, assignment_id, student_user_id,
Submissions
                  state, content_ref)

                  grade_records(id, workspace_id, enrollment_id, value_ref,
Grade workflows   release_state, authority_mode); grade_change_requests(id,
                  workspace_id, grade_record_id, state)

                  student_holds(id, workspace_id, student_user_id, hold_type_id,
Holds
                  state, source_ref)

                  readiness_rules(id, workspace_id, policy_version_id,
Readiness         rule_definition); readiness_evaluations(id, workspace_id,
                  student_user_id, evaluated_at, result_ref)

                  registration_requests(id, workspace_id, student_user_id,
Registration
                  section_id, state, authority_mode)

                  advisor_assignments(id, workspace_id, advisor_user_id,
Advising          student_user_id, validity); advising_plans(id, resource_id,
                  student_user_id)

                  service_catalog(id, workspace_id, owning_department_id, name,
Services
                  routing_policy_id)

                  cases(id, workspace_id, service_request_id, assigned_team_id,
Cases             state, classification); case_events(id, case_id, actor_id,
                  event_type, content_ref)

Accommodation     approved_accommodation_notices(id, workspace_id, student_user_id,
delivery          section_id, approved_notice_ref, validity)

                  housing_units(id, workspace_id, campus_id, status);
Housing           housing_assignments(id, workspace_id, student_user_id, unit_id,
                  validity)

                  student_account_refs(id, workspace_id, student_user_id,
Financial
references        provider_ref); student_obligations(id, workspace_id, account_ref_id,
                  state, source_ref)

                  communication_campaigns(id, workspace_id, audience_definition_id,
Communications    state); communication_approvals(id, campaign_id, approver_id,
                  outcome)

                  connections(id, workspace_id, adapter_type, secret_ref, state);
Integrations      external_mappings(id, workspace_id, connection_id, external_id,
                  resource_id)

          Domain                                Tables and key fields

                    sync_runs(id, workspace_id, connection_id, state);
  Reconciliation    reconciliation_findings(id, sync_run_id, resource_id, kind,
                    resolution_state)

Do not store an accommodation’s underlying reason in a table exposed to instructors. The
books explicitly distinguish approved accommodations from their reasons. [3] [4]

4.5 Layer 3: Semester Company OS schema
Use a separate company scope and restricted database access.

        Domain                                 Tables and key fields

                   accounts(id, legal_name, segment, owner_id); contacts(id, account_id,
  CRM
                   name, contact_ref)

                   opportunities(id, account_id, stage, amount_minor, currency,
  Sales
                   next_step, owner_id)

                   quotes(id, opportunity_id, version, state, valid_until);
  Quotes
                   quote_lines(id, quote_id, product_id, quantity, unit_amount_minor)

                   contracts(id, account_id, state, signed_document_ref, starts_on,
  Agreements       ends_on); contract_obligations(id, contract_id, owner_id, due_at,
                   state)

                   implementation_projects(id, account_id, contract_id, state,
  Implementation
                   owner_id); milestones(id, project_id, due_at, acceptance_state)

  Customer         success_plans(id, account_id, owner_id); outcome_measures(id,
  success          success_plan_id, definition_id, baseline_ref, target_ref)

                   tickets(id, account_id, requester_ref, severity, state,
  Support
                   assigned_to); ticket_events(id, ticket_id, type, safe_content_ref)

                   controls(id, key, owner_id, state); evidence(id, control_id,
  Trust
                   artifact_ref, verified_at, expires_at)

                   security_findings(id, affected_resource_ref, severity, state,
  Findings
                   owner_id)

  Legal            legal_reviews(id, contract_id, reviewer_id, state)

                   vendors(id, name, purpose, owner_id); vendor_reviews(id, vendor_id,
  Vendors
                   state, evidence_ref)

                   staff_records(id, user_id, status); onboarding_tasks(id, staff_id,
  People
                   state); access_reviews(id, subject_user_id, reviewer_id, outcome)

                   content_items(id, title, state, owner_id); claims(id, statement,
  Marketing
                   evidence_ref, approval_state); campaigns(id, name, state)

                   decisions(id, owner_id, decision, rationale_ref); risks(id, severity,
  Operations       owner_id, mitigation_ref, state); work_items(id, owner_id, state,
                   due_at)

     Domain                                  Tables and key fields

               incidents(id, severity, state, started_at, resolved_at);
 Reliability
               incident_updates(id, incident_id, audience, approved_content_ref)

               releases(id, commit_ref, environment, state); release_gates(id,
 Releases
               release_id, gate_key, outcome, evidence_ref)

               restore_drills(id, environment, started_at, completed_at, result,
 Recovery
               evidence_ref)

               cost_records(id, provider, period, account_id, category,
 Costs
               amount_minor, currency)

               metric_definitions(id, key, version, formula_ref, owner_id);
 Metric
               metric_snapshots(id, definition_id, scope_ref, period, value,
 governance
               source_ref)


4.6 Shared commercial billing schema

 billing.customers
   id, owning_scope_id, external_account_ref, legal_name

 billing.products
   id, key, name, status

 billing.prices
   id, product_id, currency, amount_minor, interval, effective_dates

 billing.subscriptions
   id, customer_id, state, current_period_start, current_period_end

 billing.subscription_items
   id, subscription_id, price_id, quantity

 billing.entitlement_definitions
   id, key, value_type

 billing.entitlement_grants
   id, customer_id, subscription_id, workspace_id,
   entitlement_key, value, validity, status

 billing.usage_records
   id, customer_id, workspace_id, meter_key,
   quantity, occurred_at, deduplication_key

 billing.invoices
   id, customer_id, state, currency,
   subtotal_minor, tax_minor, total_minor, due_at

 billing.invoice_lines
   id, invoice_id, description, quantity,
   unit_amount_minor, line_total_minor

 billing.payment_attempts
   id, invoice_id, provider, provider_reference,

    state, amount_minor, currency

  billing.webhook_receipts
    id, provider, provider_event_id,
    verified_at, processing_state

  billing.credits
    id, invoice_id, amount_minor, currency,
    reason, approval_ref, state

  billing.refunds
    id, payment_attempt_id, amount_minor,
    currency, approval_ref, provider_reference, state

  billing.dunning_cases
    id, customer_id, invoice_id, stage, next_action_at, state

  billing.reconciliation_runs
    id, provider, period, state, evidence_ref


Commercial billing is not the same as student accounts, marketplace settlement, or statutory
accounting. Keep their ownership and ledgers distinct even when the interfaces share
components.

4.7 Representative SQL constraints
This is an illustrative foundation, not a complete production migration:

```
