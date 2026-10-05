<!-- Rendered by supabase/tools/render_inventory.py from a database built by applying every
     migration to a throwaway Postgres 17. Do not edit by hand; regenerate:
       supabase/tools/introspect.sh supabase/tools/inventory.sql > /tmp/inv.out
       python3 supabase/tools/render_inventory.py /tmp/inv.out docs -->

# Data inventory and lineage

What the schema holds, read from a database built by applying every migration: **302 tables in `public`**. This is the *structural* inventory. Field-level classification, retention and the reason each table exists are in [RETENTION.md](../RETENTION.md) (a row per table, held in both directions by `retention.test.ts`), [operating-model/DATA-STEWARDSHIP.md](operating-model/DATA-STEWARDSHIP.md) (tiers T0–T6) and [DEFINER-RLS-REGISTER.md](DEFINER-RLS-REGISTER.md). This page does not restate them.

## Summary

| Measure | Count |
| --- | --- |
| Tables in `public` | 302 |
| Row-level security on | 302 |
| **Row-level security off** | 0 |
| RLS on, **no policy** (deny by default; reached only by definer functions or the service role) | 32 |
| Owned by an account (foreign key to `auth.users`) | 190 |
| Carry a `tenant_id` | 151 |
| **Neither** account-owned nor tenant-scoped | 64 |
| Writable directly by a signed-in client role (before RLS) | 119 |

Account-owned tables are walked by `private.account_data_map()`, which derives them from the catalog, so export and erasure cover a new one automatically (`erasure.test.ts`, `deletion.check.sql`). A table that is neither account-owned nor tenant-scoped is not necessarily wrong — a catalog, a platform configuration table, a counter — but each is a place where nothing in the schema says whose data it is, so each is listed for review.

## Row-level security off

None. `supabase/rls-coverage.check.sql` fails the build if this list is ever not empty.

## Neither account-owned nor tenant-scoped (review)

`access_gate`, `app_capabilities`, `app_roles`, `beta_cohorts`, `beta_exit_requests`, `beta_feature_flags`, `beta_feedback`, `checkout_sessions`, `commercial_plans`, `commercial_prices`, `commercial_products`, `community_case_events`, `community_detector_rules`, `community_escalation_deliveries`, `community_identity_grants`, `community_media_deletions`, `community_retention_runs`, `community_signals`, `community_volunteer_events`, `compliance_controls`, `compliance_frameworks`, `console_duty`, `control_evidence`, `credits_refunds`, `cta_routes`, `customer_commitment`, `customer_contract`, `dining_hours`, `dining_menu_items`, `dunning_actions`, `dunning_cases`, `entitlement_definitions`, `form_publications`, `form_responses`, `gtm_decision_log`, `gtm_pilot_metrics`, `gtm_pilot_outcomes`, `gtm_pilots`, `gtm_stakeholders`, `implementation_milestones`, `institution_action_offices`, `invites`, `invoice_lines`, `invoices`, `lti_line_item`, `lti_nonce`, `moderation_audit_event`, `payment_events`, `plan_entitlements`, `provider_registry`, `qbrs`, `quote_lines`, `role_capabilities`, `schools`, `site_leads`, `student_payment_plan_installments`, `subscription_entitlements`, `subscriptions`, `support_notification_outbox`, `support_ticket_messages`, `trust_artifacts`, `trust_room_access_log`, `trust_room_grant_items`, `trust_room_requests`


## RLS on with no policy (deny by default)

Counted from `pg_policy` in the built database. [DEFINER-RLS-REGISTER.md](DEFINER-RLS-REGISTER.md) reports 45 from a static parse of the migrations; the two disagree, and the catalog count here is the one to trust for these migrations. The register's count should be reconciled (its own note DR-03 says policies created in loops are invisible to the parser).

`access_gate`, `app_admins`, `beta_cohorts`, `beta_exit_requests`, `beta_feature_flags`, `beta_feedback`, `beta_invitations`, `beta_known_issues`, `beta_memberships`, `beta_programs`, `community_media_deletions`, `community_safety_entries`, `gtm_communication_events`, `gtm_consent`, `gtm_conversion_events`, `gtm_prospects`, `gtm_suppression`, `invites`, `lti_identity`, `lti_line_item`, `lti_link_ticket`, `lti_nonce`, `lti_platform`, `payment_events`, `registration_completions`, `registration_holds`, `registration_requests`, `scim_credential`, `site_leads`, `support_notification_outbox`, `support_ticket_messages`, `support_tickets`


## Every table

`Client read/write` is table privilege for the `authenticated` role before RLS; a row is still refused unless a policy admits it.

| Table | RLS | Policies | tenant_id | Account FK | Client read | Client write |
| --- | --- | --- | --- | --- | --- | --- |
| `academic_record_changes` | yes | 3 | yes | yes | yes | yes |
| `academic_record_entries` | yes | 1 | yes | yes | yes | — |
| `academic_record_subjects` | yes | 3 | yes | yes | yes | yes |
| `access_gate` | yes | 0 | — | — | — | — |
| `access_log` | yes | 2 | — | yes | yes | yes |
| `accommodation_access_events` | yes | 1 | — | yes | yes | — |
| `accommodation_passports` | yes | 3 | yes | yes | yes | yes |
| `accommodation_shares` | yes | 4 | — | yes | yes | yes |
| `account_health_snapshots` | yes | 1 | — | yes | yes | — |
| `activity` | yes | 2 | — | yes | yes | yes |
| `advisor_share_events` | yes | 1 | — | yes | yes | — |
| `advisor_shares` | yes | 3 | yes | yes | yes | yes |
| `ai_memories` | yes | 1 | — | yes | yes | yes |
| `ai_policy` | yes | 4 | yes | yes | yes | yes |
| `alumni_mentor_offers` | yes | 4 | yes | yes | yes | yes |
| `app_admins` | yes | 0 | — | yes | — | — |
| `app_capabilities` | yes | 1 | — | — | yes | — |
| `app_roles` | yes | 1 | — | — | yes | — |
| `appointments` | yes | 1 | — | yes | yes | yes |
| `approval_decision` | yes | 1 | — | yes | yes | — |
| `approval_request` | yes | 1 | yes | yes | yes | — |
| `approved_source` | yes | 4 | yes | yes | yes | yes |
| `articulation_rules` | yes | 4 | yes | yes | yes | yes |
| `audit_event` | yes | 1 | yes | — | yes | — |
| `beta_cohorts` | yes | 0 | — | — | — | — |
| `beta_exit_requests` | yes | 0 | — | — | — | — |
| `beta_feature_flags` | yes | 0 | — | — | — | — |
| `beta_feedback` | yes | 0 | — | — | — | — |
| `beta_invitations` | yes | 0 | — | yes | — | — |
| `beta_known_issues` | yes | 0 | — | yes | — | — |
| `beta_memberships` | yes | 0 | — | yes | — | — |
| `beta_programs` | yes | 0 | — | yes | — | — |
| `billing_account_tenants` | yes | 1 | yes | — | yes | — |
| `billing_accounts` | yes | 1 | — | yes | yes | — |
| `blocks` | yes | 1 | — | yes | yes | yes |
| `break_glass_grant` | yes | 1 | yes | yes | yes | — |
| `calendar_feeds` | yes | 1 | — | yes | yes | yes |
| `cancellation_requests` | yes | 1 | — | yes | yes | — |
| `canonical_entity_references` | yes | 3 | yes | yes | yes | yes |
| `capture_artifact` | yes | 1 | yes | yes | yes | yes |
| `capture_asset` | yes | 3 | yes | — | yes | yes |
| `capture_segment` | yes | 1 | yes | — | yes | yes |
| `catalog_sections` | yes | 2 | yes | — | yes | yes |
| `checkout_sessions` | yes | 1 | — | — | yes | — |
| `claims_register` | yes | 1 | — | yes | yes | — |
| `commercial_plans` | yes | 1 | — | — | yes | — |
| `commercial_prices` | yes | 1 | — | — | yes | — |
| `commercial_products` | yes | 1 | — | — | yes | — |
| `communities` | yes | 1 | yes | — | — | — |
| `community_aliases` | yes | 2 | — | yes | — | yes |
| `community_calibration_items` | yes | 3 | yes | — | yes | yes |
| `community_case_events` | yes | 1 | — | — | yes | — |
| `community_cases` | yes | 1 | yes | — | yes | — |
| `community_decisions` | yes | 1 | — | yes | — | — |
| `community_detector_rules` | yes | 2 | — | — | yes | — |
| `community_escalation_agreement_events` | yes | 1 | yes | — | yes | — |
| `community_escalation_deliveries` | yes | 1 | — | — | — | — |
| `community_escalation_policies` | yes | 1 | yes | — | yes | — |
| `community_escalations` | yes | 1 | yes | — | yes | — |
| `community_identity_grants` | yes | 1 | — | — | yes | — |
| `community_media` | yes | 1 | yes | yes | — | — |
| `community_media_blocklist` | yes | 1 | yes | — | — | — |
| `community_media_deletions` | yes | 0 | — | — | — | — |
| `community_members` | yes | 2 | — | yes | — | yes |
| `community_mutes` | yes | 1 | — | yes | yes | yes |
| `community_posts` | yes | 1 | yes | yes | — | — |
| `community_programs` | yes | 1 | yes | — | yes | — |
| `community_reports` | yes | 1 | — | yes | — | — |
| `community_restrictions` | yes | 1 | — | yes | — | — |
| `community_retention_runs` | yes | 1 | — | — | yes | — |
| `community_safety_entries` | yes | 0 | yes | yes | — | — |
| `community_session_participants` | yes | 2 | — | yes | — | yes |
| `community_sessions` | yes | 1 | — | yes | — | — |
| `community_signals` | yes | 1 | — | — | yes | — |
| `community_venues` | yes | 3 | yes | — | yes | yes |
| `community_volunteer_events` | yes | 1 | — | — | yes | — |
| `community_volunteer_tasks` | yes | 1 | — | yes | yes | — |
| `community_volunteer_votes` | yes | 1 | — | yes | — | — |
| `community_volunteers` | yes | 1 | yes | yes | yes | — |
| `compliance_controls` | yes | 1 | — | — | yes | — |
| `compliance_frameworks` | yes | 1 | — | — | yes | — |
| `concept_evidence` | yes | 1 | yes | — | yes | yes |
| `connections` | yes | 1 | — | yes | — | — |
| `consent_record` | yes | 4 | yes | yes | yes | yes |
| `console_action_record` | yes | 1 | yes | yes | yes | — |
| `console_duty` | yes | 1 | — | — | yes | — |
| `contact_channels` | yes | 1 | — | yes | yes | yes |
| `content_register` | yes | 1 | — | yes | yes | — |
| `contracts` | yes | 1 | — | yes | yes | — |
| `control_evidence` | yes | 1 | — | — | yes | — |
| `cost_plans` | yes | 1 | — | yes | yes | yes |
| `council_seat_holder` | yes | 1 | — | yes | yes | — |
| `course_ai_rules` | yes | 1 | yes | yes | yes | — |
| `course_demand_snapshots` | yes | 1 | yes | — | yes | — |
| `course_guidance` | yes | 1 | yes | yes | yes | — |
| `course_review_authors` | yes | 2 | — | yes | yes | yes |
| `course_reviews` | yes | 2 | yes | — | yes | — |
| `courses` | yes | 1 | — | yes | yes | yes |
| `credits_refunds` | yes | 1 | — | — | yes | — |
| `cta_routes` | yes | 1 | — | — | yes | — |
| `customer` | yes | 1 | yes | — | yes | — |
| `customer_commitment` | yes | 1 | — | — | yes | — |
| `customer_contract` | yes | 1 | — | — | yes | — |
| `data_classification_rules` | yes | 4 | yes | — | yes | yes |
| `data_requests` | yes | 3 | — | yes | yes | yes |
| `data_subject_request` | yes | 3 | yes | yes | yes | yes |
| `demand_consents` | yes | 1 | yes | yes | yes | — |
| `dining_hours` | yes | 1 | — | — | yes | — |
| `dining_ledger` | yes | 1 | yes | yes | yes | — |
| `dining_locations` | yes | 1 | yes | — | yes | — |
| `dining_menu_items` | yes | 1 | — | — | yes | — |
| `dining_order_events` | yes | 1 | — | yes | yes | — |
| `dining_orders` | yes | 1 | yes | yes | yes | — |
| `dining_partner_connections` | yes | 1 | yes | yes | yes | — |
| `dining_plans` | yes | 1 | yes | yes | yes | — |
| `dining_pool_claims` | yes | 1 | yes | yes | yes | — |
| `dining_pool_donations` | yes | 1 | yes | yes | yes | — |
| `dunning_actions` | yes | 1 | — | — | yes | — |
| `dunning_cases` | yes | 1 | — | — | yes | — |
| `enrollments` | yes | 4 | — | yes | yes | yes |
| `entitlement_definitions` | yes | 1 | — | — | yes | — |
| `evidence_reference` | yes | 5 | yes | yes | yes | yes |
| `family_access_events` | yes | 2 | — | yes | yes | yes |
| `family_grants` | yes | 5 | — | yes | yes | yes |
| `family_invites` | yes | 3 | — | yes | yes | yes |
| `family_shared_items` | yes | 2 | — | yes | yes | yes |
| `feature_cohort_members` | yes | 3 | yes | yes | yes | yes |
| `feature_kill_switch` | yes | 3 | yes | yes | yes | yes |
| `feedback` | yes | 3 | — | yes | yes | yes |
| `form_publications` | yes | 1 | — | — | yes | — |
| `form_responses` | yes | 3 | — | — | yes | yes |
| `forms` | yes | 4 | — | yes | yes | yes |
| `governance_config_requests` | yes | 3 | yes | yes | yes | — |
| `governance_decisions` | yes | 2 | yes | yes | yes | — |
| `governance_incident_notices` | yes | 2 | yes | yes | yes | — |
| `governance_policy_nodes` | yes | 4 | yes | yes | yes | yes |
| `governance_steward_assignments` | yes | 3 | yes | yes | yes | — |
| `grade_entries` | yes | 1 | yes | yes | yes | — |
| `grade_passbacks` | yes | 1 | yes | yes | yes | — |
| `gradebook_items` | yes | 1 | yes | yes | yes | — |
| `gradebook_operations` | yes | 1 | yes | yes | yes | — |
| `gradebook_schemes` | yes | 1 | yes | yes | yes | — |
| `graduation_scenarios` | yes | 1 | — | yes | yes | yes |
| `group_members` | yes | 3 | — | yes | yes | yes |
| `group_tasks` | yes | 4 | — | yes | yes | yes |
| `groups` | yes | 4 | — | yes | yes | yes |
| `gtm_accounts` | yes | 3 | yes | yes | yes | yes |
| `gtm_campaign_links` | yes | 3 | yes | — | yes | yes |
| `gtm_campaign_reviews` | yes | 2 | yes | yes | yes | yes |
| `gtm_campaigns` | yes | 3 | yes | yes | yes | yes |
| `gtm_communication_events` | yes | 0 | yes | — | — | — |
| `gtm_consent` | yes | 0 | yes | — | — | — |
| `gtm_conversion_events` | yes | 0 | yes | — | — | — |
| `gtm_decision_log` | yes | 3 | — | — | yes | yes |
| `gtm_pilot_metrics` | yes | 2 | — | — | yes | yes |
| `gtm_pilot_outcomes` | yes | 2 | — | — | yes | yes |
| `gtm_pilots` | yes | 3 | — | — | yes | yes |
| `gtm_prospects` | yes | 0 | yes | — | — | — |
| `gtm_report_access` | yes | 1 | yes | yes | yes | — |
| `gtm_sponsor_placements` | yes | 3 | yes | yes | yes | yes |
| `gtm_sponsor_policy` | yes | 3 | yes | — | yes | yes |
| `gtm_stakeholders` | yes | 2 | — | — | yes | yes |
| `gtm_suppression` | yes | 0 | yes | — | — | — |
| `help_destinations` | yes | 3 | yes | — | yes | yes |
| `help_request_events` | yes | 1 | — | yes | yes | — |
| `help_requests` | yes | 1 | — | yes | yes | — |
| `implementation_milestones` | yes | 1 | — | — | yes | — |
| `implementation_projects` | yes | 1 | yes | yes | yes | — |
| `institution_action_audiences` | yes | 1 | — | yes | yes | yes |
| `institution_action_offices` | yes | 1 | — | — | yes | — |
| `institution_action_progress` | yes | 1 | — | yes | yes | yes |
| `institution_actions` | yes | 1 | yes | yes | yes | — |
| `institution_identity_provider` | yes | 1 | yes | — | yes | — |
| `institution_membership` | yes | 1 | yes | yes | yes | — |
| `integration_connections` | yes | 3 | yes | yes | — | — |
| `integration_dead_letter_events` | yes | 1 | yes | yes | yes | — |
| `integration_duplicate_candidates` | yes | 2 | yes | — | yes | — |
| `integration_duplicate_resolutions` | yes | 3 | yes | yes | yes | — |
| `integration_mapping_versions` | yes | 3 | yes | yes | yes | — |
| `integration_mappings` | yes | 4 | yes | — | yes | yes |
| `integration_reconciliation_discrepancies` | yes | 2 | yes | yes | yes | — |
| `integration_reconciliation_runs` | yes | 1 | yes | — | yes | — |
| `integration_retention_runs` | yes | 1 | yes | — | yes | — |
| `integration_schema_drift_events` | yes | 2 | yes | yes | yes | — |
| `integration_schema_fingerprints` | yes | 1 | yes | — | yes | — |
| `integration_scopes` | yes | 4 | yes | yes | yes | yes |
| `integration_source_owners` | yes | 3 | yes | yes | yes | — |
| `integration_sync_errors` | yes | 1 | yes | yes | yes | — |
| `integration_sync_runs` | yes | 1 | yes | yes | yes | — |
| `integration_webhook_events` | yes | 1 | yes | — | yes | — |
| `invites` | yes | 0 | — | — | — | — |
| `invoice_lines` | yes | 1 | — | — | yes | — |
| `invoices` | yes | 1 | — | — | yes | — |
| `lti_identity` | yes | 0 | — | yes | — | — |
| `lti_line_item` | yes | 0 | — | — | — | — |
| `lti_link_ticket` | yes | 0 | — | yes | — | — |
| `lti_nonce` | yes | 0 | — | — | — | — |
| `lti_platform` | yes | 0 | yes | — | — | — |
| `mentor_requests` | yes | 1 | yes | yes | yes | — |
| `message_reactions` | yes | 3 | — | yes | yes | yes |
| `messages` | yes | 3 | — | yes | yes | yes |
| `migration_approvals` | yes | 2 | yes | yes | yes | yes |
| `migration_field_maps` | yes | 4 | yes | — | yes | yes |
| `migration_projects` | yes | 3 | yes | yes | yes | yes |
| `migration_runs` | yes | 2 | yes | yes | yes | yes |
| `mistake_evidence` | yes | 1 | yes | — | yes | yes |
| `moderation_audit_event` | yes | 1 | — | — | yes | — |
| `notes` | yes | 1 | — | yes | yes | yes |
| `onboarding_progress` | yes | 2 | — | yes | yes | yes |
| `operator_preference` | yes | 4 | — | yes | yes | yes |
| `opportunities` | yes | 3 | yes | yes | yes | yes |
| `organization_members` | yes | 1 | — | yes | yes | — |
| `organizations` | yes | 3 | — | yes | yes | yes |
| `outcome_aggregates` | yes | 1 | yes | — | yes | — |
| `payment_events` | yes | 0 | — | — | — | — |
| `peer_mentor_assignments` | yes | 3 | yes | yes | yes | yes |
| `peer_mentor_offers` | yes | 4 | yes | yes | yes | yes |
| `plan_entitlements` | yes | 1 | — | — | yes | — |
| `profiles` | yes | 4 | — | yes | yes | yes |
| `provider_evidence` | yes | 2 | — | yes | yes | — |
| `provider_registry` | yes | 3 | — | — | yes | yes |
| `provisioning_audit_event` | yes | 1 | yes | — | yes | — |
| `push_devices` | yes | 1 | — | yes | yes | yes |
| `push_queue` | yes | 1 | — | yes | yes | yes |
| `qbrs` | yes | 1 | — | — | yes | — |
| `quote_lines` | yes | 1 | — | — | yes | — |
| `quotes` | yes | 1 | — | yes | yes | — |
| `referral_codes` | yes | 2 | — | yes | yes | yes |
| `referrals` | yes | 2 | — | yes | yes | yes |
| `registration_audit_event` | yes | 1 | yes | yes | yes | — |
| `registration_completions` | yes | 0 | yes | yes | — | — |
| `registration_enrollments` | yes | 2 | yes | yes | yes | — |
| `registration_holds` | yes | 0 | yes | yes | — | — |
| `registration_overrides` | yes | 1 | yes | yes | yes | — |
| `registration_requests` | yes | 0 | yes | yes | — | — |
| `registration_sections` | yes | 1 | yes | yes | yes | — |
| `registration_terms` | yes | 1 | yes | yes | yes | — |
| `registration_time_tickets` | yes | 1 | — | yes | yes | yes |
| `registration_windows` | yes | 4 | yes | yes | yes | yes |
| `regrade_requests` | yes | 1 | yes | yes | yes | — |
| `regrade_resolutions` | yes | 1 | yes | yes | yes | — |
| `renewal_opportunities` | yes | 1 | — | yes | yes | — |
| `reports` | yes | 3 | — | yes | yes | yes |
| `role_capabilities` | yes | 1 | — | — | yes | — |
| `role_grant_audit_event` | yes | 1 | yes | — | yes | — |
| `role_grants` | yes | 1 | — | yes | yes | — |
| `schools` | yes | 2 | — | — | yes | yes |
| `scim_credential` | yes | 0 | yes | — | — | — |
| `scim_external_identity` | yes | 1 | yes | — | yes | — |
| `scim_group_mapping` | yes | 3 | yes | yes | yes | yes |
| `seat_watches` | yes | 1 | yes | yes | yes | yes |
| `site_leads` | yes | 0 | — | — | — | — |
| `sittings` | yes | 1 | — | yes | yes | yes |
| `skill_claim` | yes | 6 | yes | yes | yes | yes |
| `skill_claim_evidence` | yes | 1 | yes | — | yes | yes |
| `skill_records` | yes | 5 | — | yes | yes | yes |
| `source_freshness_events` | yes | 1 | yes | — | yes | — |
| `source_records` | yes | 1 | yes | — | yes | — |
| `source_snapshots` | yes | 1 | yes | — | yes | — |
| `state` | yes | 1 | — | yes | yes | yes |
| `student_account_closes` | yes | 2 | yes | yes | yes | yes |
| `student_account_entries` | yes | 1 | yes | yes | yes | — |
| `student_account_reconciliations` | yes | 2 | yes | yes | yes | yes |
| `student_account_requests` | yes | 3 | yes | yes | yes | yes |
| `student_account_settings` | yes | 3 | yes | yes | yes | yes |
| `student_context` | yes | 1 | yes | yes | yes | yes |
| `student_payment_plan_installments` | yes | 1 | — | — | yes | — |
| `student_payment_plans` | yes | 3 | yes | yes | yes | yes |
| `study_match_optins` | yes | 4 | yes | yes | yes | yes |
| `study_packs` | yes | 1 | yes | yes | yes | — |
| `subscription_entitlements` | yes | 1 | — | — | yes | — |
| `subscriptions` | yes | 1 | — | — | yes | — |
| `success_plans` | yes | 1 | — | yes | yes | — |
| `support_access_event` | yes | 1 | yes | — | yes | — |
| `support_access_grant` | yes | 4 | yes | yes | yes | yes |
| `support_notification_outbox` | yes | 0 | — | — | — | — |
| `support_share_events` | yes | 1 | — | yes | yes | — |
| `support_shares` | yes | 3 | yes | yes | yes | yes |
| `support_ticket_messages` | yes | 0 | — | — | — | — |
| `support_tickets` | yes | 0 | — | yes | — | — |
| `talent_profile_views` | yes | 2 | — | yes | yes | yes |
| `talent_profiles` | yes | 2 | — | yes | yes | yes |
| `tasks` | yes | 1 | — | yes | yes | yes |
| `tenant_feature_policy` | yes | 4 | yes | yes | yes | yes |
| `tenant_plan` | yes | 1 | yes | yes | yes | — |
| `tenant_plan_history` | yes | 1 | yes | yes | yes | — |
| `tenant_policy_audit_event` | yes | 1 | yes | yes | yes | — |
| `tenant_rollout` | yes | 1 | yes | yes | yes | — |
| `tenant_rollout_evidence` | yes | 1 | yes | yes | yes | — |
| `tenant_rollout_history` | yes | 1 | yes | yes | yes | — |
| `tenant_sso_policy` | yes | 3 | yes | yes | yes | yes |
| `tenant_sso_policy_history` | yes | 1 | yes | yes | yes | — |
| `term_plan_courses` | yes | 1 | yes | yes | yes | yes |
| `transfer_evaluations` | yes | 4 | yes | yes | yes | yes |
| `trust_artifact_versions` | yes | 2 | — | yes | yes | yes |
| `trust_artifacts` | yes | 3 | — | — | yes | yes |
| `trust_room_access_log` | yes | 1 | — | — | yes | — |
| `trust_room_grant_items` | yes | 1 | — | — | yes | — |
| `trust_room_grants` | yes | 1 | — | yes | — | — |
| `trust_room_requests` | yes | 3 | — | — | yes | yes |
| `usage` | yes | 1 | — | yes | yes | yes |
| `weekly_checkins` | yes | 1 | — | yes | yes | yes |

## Lineage: where a record's authority is stated

Every content or data item is meant to carry one of five source labels — `institution_verified`, `imported`, `student_entered`, `estimated`, `needs_review` (`app/src/lib/source.ts`, drift-guarded by `source.test.ts`).

- **Database-enforced** (CHECK constraint): `term_plan_courses`, `registration_time_tickets` and two other tables from `20260926150000_expansion_roles_and_features.sql`.
- **Provenance tables** for integrations: `source_records`, `source_snapshots`, `source_freshness_events`, `canonical_entity_references`, `integration_source_owners`, with per-connection classification T0–T3.
- **Not labelled:** core student tables (`notes`, `courses`, `tasks`, `appointments`) carry no per-record authority label, and no Source Card shows a record with its sync time. This is gap G-12 in [FULL-BETA-REQUIREMENTS.md](FULL-BETA-REQUIREMENTS.md); it is planned for Milestone 2 and is **not** done.
- **Two trust vocabularies** are still in use, and the display badge adds two values that never reach a row.

## Flows out of the system

Recorded elsewhere, not derived here: subprocessors in [SUBPROCESSORS.md](SUBPROCESSORS.md); exports and hand-offs in [DATA-PORTABILITY-AND-OFFBOARDING.md](DATA-PORTABILITY-AND-OFFBOARDING.md); the AI providers' terms in the AI assurance pages. Data held **only on the device** (localStorage, IndexedDB files) is by design outside this inventory and outside the server's export — see gap G-01.
