/**
 * The Security Definer and RLS remediation register: the first artifact the
 * architecture audit of 29 September 2026 asks for, "because it tells you
 * exactly where application authority currently crosses database trust
 * boundaries".
 *
 * The audit read production's Supabase advisor and found two things it would
 * not wave through at that volume: **45 tables with row-level security on and
 * no policy**, and **151 `security definer` functions a signed-in account can
 * call**. Neither is a vulnerability by itself. A table no client role can
 * reach needs no policy; a definer function that checks its own caller is how
 * a write with no policy is made safely. What the audit asked for is a
 * disposition for every one, written down, and a guard so the next one cannot
 * arrive without one. This is both.
 *
 * `docs/DEFINER-RLS-REGISTER.md` is rendered from this file by
 * `definerregister.test.ts`; edit the data, then `npm run registers` from app/.
 *
 * ## What is held to what
 *
 * - **The function set is derived, not typed.** The test reads every
 *   migration, takes the last definition of each `public` function, keeps the
 *   `security definer` ones, and intersects them with the allowlist in
 *   `supabase/grants.check.sql` — the array that decides what a signed-in
 *   account may call. That set must equal `FUNCTIONS` exactly. It came to 151
 *   on this tree, the same 151 names the advisor listed on production. A new
 *   definer function granted to clients is red here until it has a row.
 * - **Every row's gate is in its body.** Each row names the literal checks the
 *   function makes — `auth.uid()`, a `private.` capability helper, or an
 *   ownership test — and the test requires each to appear in the body of the
 *   definition that wins. Removing a check turns its row red.
 * - **Admin and moderation rows need more than identity.** A row in either
 *   category must name at least one gate that is not `auth.uid()`: knowing who
 *   is calling is not the same as knowing they may.
 * - **The tables are the reading, pinned.** Some tables here get their
 *   policies from `format()` loops a static parser cannot read, so the set of
 *   policy-less tables is not re-derived from SQL. `TABLES` is the advisor's
 *   list of 29 September; the test holds each to being created with row-level
 *   security in `migrations/`, having no `create policy` naming it, and never
 *   being granted to `anon` or `authenticated`.
 *
 * ## The reading
 *
 * Production (`lzrqvlugnawcgywkhqlz`), 29 September 2026, read-only, through
 * the advisor and `pg_catalog`:
 *
 * - all 45 policy-less tables: no SELECT, INSERT, UPDATE or DELETE for `anon`
 *   or `authenticated`. Each is deny-by-default, not open;
 * - all 151 functions: not executable by `anon` or PUBLIC, `search_path`
 *   pinned, no dynamic `execute`;
 * - two bodies named neither `auth.uid()` nor a `private.` gate:
 *   `gtm_pilot_problems`, which answered any signed-in caller about any
 *   pilot, fixed in `20260929120000_gtm_pilot_problems_visibility.sql`; and
 *   `kill_switch_engaged`, a deliberate one-boolean read recorded in
 *   `OPEN` below.
 */

/** The briefs this answers. A supplied PDF is never evidence. */
export const SOURCES: readonly { path: string; title: string; what: string }[] = [
  {
    path: 'docs/expansion/Architecture-Audit-Summary-and-Hardening-Scorecard.pdf',
    title: 'Audit summary',
    what: 'A twenty-dimension hardening scorecard (57/100), the two advisor findings, a function-category control table, a release gate, a four-layer architecture map, the connector and trust layers, flags against tenant configuration, a 90-day remediation plan and a definition of done.',
  },
  {
    path: 'docs/expansion/Strengthen-the-Architecture-Twenty-Priorities.pdf',
    title: 'What else can I do to further strengthen, improve and reinforce the existing application and architecture',
    what: 'Twenty architecture priorities — map, domains, canonical model, lineage, reconciliation, connectors, degradation, policy-as-code, privacy operations, security, observability, SLOs, resilience, design system, event bus, flags, risk-based tests, performance, the console and a sandbox — a recommended sequence and the rule every feature must answer.',
  },
];

export const READ_ON = '2026-09-29';

/**
 * The second reading of the same project, 30 September 2026, 13:46 UTC,
 * read-only through the advisor and `pg_catalog` (D-1026). The register was
 * asked to hold, and it did: the 180 functions the advisor listed are exactly
 * the 180 rows below — the first reading's 151 and the 29 whose migrations had
 * not then been applied. The tables did not: four (`private.account_ages` and
 * `public.registration_completions`, `_holds`, `_requests`) arrived with those
 * migrations and had no disposition until this reading. They have one now.
 *
 * The same reading's other advisor findings, and what became of each, are in
 * `docs/ADVISOR-RECONCILIATION-2026-09-30.md`.
 */
export const SECOND_READING = {
  on: '2026-09-30',
  functions: 180,
  tables: 49,
  /** Executable by `anon` or PUBLIC: none. Without a pinned `search_path`: none. */
  clientFunctionsOpenToAnon: 0,
} as const;

export const PROJECT = 'lzrqvlugnawcgywkhqlz';

/**
 * The audit's function categories, each with the controls it requires. The
 * wording is the audit's; `self-service` is its "student self-service".
 */
export const CATEGORIES = {
  'self-service': 'Verify auth.uid(), tenant scope, object ownership, input validation, rate limits, audit event.',
  sharing: 'Explicit consent, narrow scope, short expiry, revocation, view audit.',
  admin: 'Capability check, MFA or fresh auth for high risk, dual control where needed, immutable audit.',
  integration: 'Server-only preferred; signed workflow; replay protection; no browser service-role access.',
  financial: 'Provider webhook verification, idempotency, no client-controlled final state.',
  moderation: 'Capability check, reason required, appeals, audit trail.',
  'read-helper': 'Minimal fields, no hidden cross-tenant aggregation, pagination limit.',
} as const;

export type Category = keyof typeof CATEGORIES;

/**
 * Every `security definer` function in `public` a signed-in account can call:
 * name, category, and the literal checks its body makes. Sorted by name.
 */
export const FUNCTIONS: readonly (readonly [name: string, category: Category, gates: readonly string[]])[] = [
  ['accept_connection', 'self-service', ['auth.uid()']],
  ['accept_family_grant', 'sharing', ['auth.uid()']],
  ['activate_escalation_agreement', 'admin', ['auth.uid()', 'private.has_capability']],
  ['adopt_lti_identity', 'integration', ['auth.uid()']],
  ['answer_data_subject_request', 'admin', ['auth.uid()', 'private.has_capability', 'req.subject = me']],
  ['answer_help_request', 'admin', ['auth.uid()', 'private.answers_for']],
  ['answer_mentor_request', 'admin', ['auth.uid()', 'private.subject_has_capability']],
  ['appeal_community_decision', 'self-service', ['auth.uid()']],
  ['apply_to_organization', 'self-service', ['auth.uid()', 'private.verified_student']],
  ['apply_to_volunteer', 'self-service', ['auth.uid()', 'private.verified_student', 'private.school_of']],
  ['approve_community_pseudonymity', 'moderation', ['private.has_capability']],
  ['approve_offboarding', 'admin', ['auth.uid()', 'private.is_app_admin', 'private.has_capability']],
  ['archive_school', 'admin', ['private.offboarding_operator']],
  ['authorize_school_purge', 'admin', ['private.offboarding_operator']],
  ['available_case_supporters', 'read-helper', ['auth.uid()', 'private.subject_has_capability']],
  ['available_supporters', 'read-helper', ['auth.uid()']],
  ['begin_community_image', 'self-service', ['auth.uid()', 'private.community_role']],
  ['beta_add_cohort', 'admin', ['private.beta_manager']],
  ['beta_create_program', 'admin', ['auth.uid()', 'private.beta_manager']],
  ['beta_declare_flag', 'admin', ['private.beta_manager']],
  ['beta_feedback_queue', 'admin', ['private.beta_triager']],
  ['beta_invitation_for_me', 'read-helper', ['auth.uid()', 'private.beta_confirmed_email']],
  ['beta_invite', 'admin', ['auth.uid()', 'private.beta_manager']],
  ['beta_known_issues_for_me', 'read-helper', ['private.beta_my_membership']],
  ['beta_post_issue', 'admin', ['auth.uid()', 'private.beta_triager']],
  ['beta_revoke_invitation', 'admin', ['private.beta_manager']],
  ['beta_send_feedback', 'self-service', ['private.beta_my_membership']],
  ['beta_set_status', 'admin', ['private.beta_manager']],
  ['beta_triage_feedback', 'admin', ['private.beta_triager']],
  ['block_community_author', 'self-service', ['auth.uid()', 'private.community_role']],
  ['can_manage_escalation_agreements', 'admin', ['private.has_capability']],
  ['cancel_offboarding', 'admin', ['private.is_app_admin', 'private.has_capability']],
  ['case_author_safety', 'moderation', ['private.has_capability']],
  ['claim_abandoned_organization', 'self-service', ['auth.uid()', "mine is distinct from 'MEMBER'"]],
  ['claim_community_alias', 'self-service', ['auth.uid()', 'private.community_role']],
  ['claim_family_invite', 'sharing', ['auth.uid()']],
  ['claim_privacy_request', 'admin', ['auth.uid()', 'private.assert_fresh_mfa', 'private.privacy_case_allowed']],
  ['claim_referral', 'self-service', ['auth.uid()']],
  ['claim_school', 'self-service', ['auth.uid()']],
  ['close_break_glass', 'admin', ['auth.uid()', 'g.subject is distinct from me']],
  ['close_my_ticket', 'self-service', ['auth.uid()']],
  ['community_reviewer_standing', 'moderation', ['private.has_capability']],
  ['community_session_counts', 'read-helper', ['private.community_role']],
  ['complete_onboarding_step', 'self-service', ['auth.uid()']],
  ['connected_with', 'read-helper', ['auth.uid()']],
  ['console_act', 'admin', ['auth.uid()', 'private.has_capability', 'private.assert_fresh_mfa']],
  ['console_audit_read', 'admin', ['auth.uid()', 'private.has_capability']],
  ['console_audit_status', 'admin', ['auth.uid()', 'private.has_capability']],
  ['console_command_center', 'admin', ['auth.uid()', 'private.has_capability']],
  ['console_figures', 'admin', ['auth.uid()', 'private.has_capability']],
  ['console_integration_health', 'admin', ['auth.uid()', 'private.has_capability']],
  ['console_privacy_requests', 'admin', ['auth.uid()', 'private.account_is_held', 'private.has_capability']],
  ['console_release_incidents', 'admin', ['auth.uid()', 'private.has_capability']],
  ['console_tenant_access', 'admin', ['auth.uid()', 'private.has_capability']],
  ['console_tenant_operations', 'admin', ['auth.uid()', 'private.has_capability']],
  ['consume_handoff', 'self-service', ['auth.uid()']],
  ['contribute_course_plan', 'self-service', ['auth.uid()', 'private.school_of']],
  ['create_community', 'self-service', ['auth.uid()', 'private.has_capability', 'private.verified_student', 'private.school_of']],
  ['create_community_post', 'self-service', ['auth.uid()', 'private.community_role']],
  ['create_study_session', 'self-service', ['auth.uid()', 'private.community_role']],
  ['create_support_access', 'sharing', ['auth.uid()', 'private.subject_has_capability']],
  ['decide_alias_identity', 'moderation', ['auth.uid()', 'private.has_capability']],
  ['decide_approval', 'admin', ['auth.uid()', 'private.approver_party', 'private.assert_fresh_mfa']],
  ['decide_community_appeal', 'moderation', ['auth.uid()', 'private.has_capability']],
  ['decide_community_case', 'moderation', ['auth.uid()', 'private.has_capability']],
  ['decide_community_escalation', 'moderation', ['auth.uid()', 'private.has_capability']],
  ['decide_school_request', 'admin', ['private.has_capability']],
  ['delete_community_post', 'self-service', ['auth.uid()']],
  ['dining_advance_order', 'admin', ['auth.uid()', 'private.dining_caller_school', 'private.has_capability']],
  ['dining_cancel_order', 'financial', ['auth.uid()', 'private.dining_caller_school', 'private.has_capability']],
  ['dining_disconnect_partner', 'admin', ['auth.uid()', 'private.dining_caller_school', 'private.has_capability']],
  ['dining_donate_swipes', 'sharing', ['auth.uid()', 'private.dining_caller_school', 'private.dining_charge_gate']],
  ['dining_order_queue', 'admin', ['private.dining_caller_school', 'private.has_capability']],
  ['dining_place_order', 'financial', ['auth.uid()', 'private.dining_caller_school', 'private.dining_charge_gate']],
  ['dining_pool_summary', 'admin', ['private.dining_caller_school', 'private.has_capability']],
  ['dining_set_ordering', 'admin', ['private.dining_caller_school', 'private.has_capability']],
  ['disable_school_access', 'admin', ['private.offboarding_operator']],
  ['draft_office_action', 'admin', ['auth.uid()', 'private.may_publish']],
  ['edit_community_post', 'self-service', ['auth.uid()']],
  ['end_my_session', 'self-service', ['auth.uid()', 'user_id = $2']],
  ['export_my_data', 'self-service', ['auth.uid()']],
  ['follow_organization', 'self-service', ['auth.uid()']],
  ['forget_my_advisor_shares', 'self-service', ['auth.uid()']],
  ['forget_my_beta', 'self-service', ['auth.uid()', 'private.beta_confirmed_email']],
  ['forget_my_community', 'self-service', ['auth.uid()']],
  ['forget_my_course_demand', 'self-service', ['auth.uid()']],
  ['forget_my_help_requests', 'self-service', ['auth.uid()']],
  ['forget_my_mentor_requests', 'self-service', ['auth.uid()']],
  ['forget_my_organizations', 'self-service', ['auth.uid()']],
  ['forget_my_support_access', 'self-service', ['auth.uid()']],
  ['forget_my_support_shares', 'self-service', ['auth.uid()']],
  ['forget_my_support_tickets', 'self-service', ['auth.uid()']],
  ['gradebook_add_item', 'admin', ['auth.uid()', 'private.gradebook_require', 'private.gradebook_replay']],
  ['gradebook_enter', 'admin', ['auth.uid()', 'private.gradebook_require', 'private.subject_has_capability', 'want_student = me']],
  ['gradebook_export', 'admin', ['private.gradebook_school', 'private.gradebook_require', "g.status = 'released'"]],
  ['gradebook_file_regrade', 'self-service', ['auth.uid()', 'private.gradebook_school', "g.student_id = me and g.status = 'released'"]],
  ['gradebook_moderate', 'admin', ['auth.uid()', 'private.gradebook_require', 'cur.graded_by is not distinct from me']],
  ['gradebook_queue_passback', 'integration', ['auth.uid()', 'private.gradebook_require', "public.kill_switch_engaged('kill.writeback', school)", "e.status = 'released'"]],
  ['gradebook_release', 'admin', ['auth.uid()', 'private.gradebook_require', 'private.gradebook_replay']],
  ['gradebook_resolve_regrade', 'admin', ['auth.uid()', 'private.gradebook_require', 'r.student_id = me']],
  ['gradebook_set_scheme', 'admin', ['auth.uid()', 'private.gradebook_require', 'private.gradebook_replay']],
  ['gtm_activation_failures', 'admin', ['auth.uid()', 'private.has_capability']],
  ['gtm_audience_count', 'admin', ['private.has_capability']],
  ['gtm_campaign_report', 'admin', ['auth.uid()', 'private.has_capability']],
  ['gtm_pilot_problems', 'admin', ['private.gtm_account_visible']],
  ['help_inbox', 'admin', ['private.answers_for']],
  ['integration_approve_connection', 'integration', ['auth.uid()', 'private.has_capability']],
  ['integration_approve_scope', 'integration', ['auth.uid()', 'private.has_capability']],
  ['integration_request_replay', 'integration', ['auth.uid()', 'private.has_capability']],
  ['integration_set_paused', 'integration', ['private.has_capability']],
  ['join_beta', 'self-service', ['auth.uid()', 'private.beta_my_membership', 'private.beta_confirmed_email']],
  ['join_community', 'self-service', ['auth.uid()', 'private.verified_student', 'private.school_of']],
  ['join_study_session', 'self-service', ['auth.uid()', 'private.community_role']],
  ['kill_switch_engaged', 'read-helper', ['k.tenant_id is null or k.tenant_id = want_tenant']],
  ['leave_beta', 'self-service', ['private.beta_my_membership']],
  ['leave_organization', 'self-service', ['auth.uid()']],
  ['leave_school', 'self-service', ['auth.uid()']],
  ['list_advisor_shares', 'sharing', ['auth.uid()']],
  ['list_support_shares', 'sharing', ['auth.uid()', 'private.may_receive_support_share']],
  ['make_family_invite', 'sharing', ['auth.uid()', 'private.verified_account']],
  ['make_family_share', 'sharing', ['auth.uid()']],
  ['make_referral_code', 'self-service', ['auth.uid()']],
  ['manage_volunteer', 'moderation', ['private.has_capability']],
  ['moderate_opportunity', 'moderation', ['private.has_capability']],
  ['move_office_action', 'admin', ['auth.uid()', 'private.may_publish']],
  ['mutual_connections', 'read-helper', ['auth.uid()']],
  ['my_action_publish_scopes', 'read-helper', ['auth.uid()']],
  ['my_age_status', 'read-helper', ['auth.uid()']],
  ['my_beta', 'read-helper', ['private.beta_my_membership']],
  ['my_capabilities', 'read-helper', ['auth.uid()']],
  ['my_community_notices', 'read-helper', ['auth.uid()']],
  ['my_community_refs', 'read-helper', ['auth.uid()']],
  ['my_community_standing', 'read-helper', ['auth.uid()']],
  ['my_course_studio_courses', 'read-helper', ['auth.uid()']],
  ['my_demand_scopes', 'read-helper', ['auth.uid()']],
  ['my_dining_balances', 'read-helper', ['auth.uid()', 'private.dining_caller_school']],
  ['my_entitlements', 'read-helper', ['auth.uid()']],
  ['my_help_destinations', 'read-helper', ['private.has_capability']],
  ['my_moderation_access', 'read-helper', ['private.has_capability']],
  ['my_privacy_completion_certificates', 'read-helper', ['auth.uid()']],
  ['my_registration', 'read-helper', ['auth.uid()', 'private.school_of']],
  ['my_registration_hold', 'read-helper', ['auth.uid()', 'private.school_of']],
  ['my_sessions', 'read-helper', ['auth.uid()']],
  ['my_support_email_notices', 'read-helper', ['auth.uid()']],
  ['my_support_thread', 'read-helper', ['auth.uid()']],
  ['my_support_tickets', 'read-helper', ['auth.uid()']],
  ['my_volunteer_standing', 'read-helper', ['auth.uid()']],
  ['note_activity', 'self-service', ['auth.uid()']],
  ['offboarding_preflight', 'admin', ['private.is_app_admin', 'private.has_capability']],
  ['office_action_programs', 'read-helper', ['auth.uid()']],
  ['office_desk_actions', 'admin', ['auth.uid()', 'private.may_publish']],
  ['open_help_request', 'self-service', ['auth.uid()', 'private.answers_for']],
  ['open_support_ticket', 'self-service', ['auth.uid()']],
  ['productivity_readiness_aggregate', 'admin', ['auth.uid()', "'admin'=any(m.roles)", 'if owners<10']],
  ['propose_offboarding', 'admin', ['auth.uid()', 'private.is_app_admin', 'private.has_capability']],
  ['publish_course_guidance', 'admin', ['auth.uid()', 'private.course_publisher']],
  ['publish_course_rules', 'admin', ['auth.uid()', 'private.course_publisher']],
  ['publish_study_pack', 'admin', ['auth.uid()', 'private.course_publisher']],
  ['raise_my_data_subject_request', 'self-service', ['auth.uid()']],
  ['read_advisor_share', 'sharing', ['auth.uid()']],
  ['read_family_share', 'sharing', ['auth.uid()']],
  ['read_privacy_request_detail', 'admin', ['auth.uid()', 'private.assert_fresh_mfa', 'private.privacy_case_allowed']],
  ['read_shared_accommodation', 'sharing', ['auth.uid()']],
  ['read_support_case_signals', 'sharing', ['auth.uid()', 'private.assert_fresh_mfa', 'private.subject_has_capability', 'private.support_agent', 'private.support_consent_active', 'public.read_support_signals']],
  ['read_support_share', 'sharing', ['auth.uid()', 'private.may_receive_support_share']],
  ['read_support_signals', 'sharing', ['auth.uid()', 'private.subject_has_capability', 'private.support_consent_active']],
  ['read_tenant_projection', 'admin', ['auth.uid()', 'private.has_capability']],
  ['record_offboarding_export', 'admin', ['private.offboarding_operator']],
  ['record_offboarding_notice', 'admin', ['private.is_app_admin', 'private.has_capability']],
  ['referral_standing', 'read-helper', ['auth.uid()']],
  ['registrar_decide', 'admin', ['auth.uid()', 'private.registration_registrar', 'private.registration_gate', 'private.registration_key']],
  ['registrar_grant_override', 'admin', ['auth.uid()', 'private.registration_registrar', 'private.registration_gate', 'private.registration_key']],
  ['registrar_put_section', 'admin', ['auth.uid()', 'private.registration_registrar']],
  ['registrar_put_term', 'admin', ['auth.uid()', 'private.registration_registrar']],
  ['registration_drop', 'self-service', ['auth.uid()', 'private.registration_school', 'private.registration_gate', 'private.registration_key']],
  ['registration_enroll', 'self-service', ['auth.uid()', 'private.registration_school', 'private.registration_gate', 'private.registration_key']],
  ['registration_withdraw', 'self-service', ['auth.uid()', 'private.registration_school', 'private.registration_gate', 'private.registration_key']],
  ['remove_connection', 'self-service', ['auth.uid()']],
  ['replay_domain_event', 'admin', ['auth.uid()', 'private.has_capability', 'private.assert_fresh_mfa']],
  ['reply_to_my_ticket', 'self-service', ['auth.uid()']],
  ['report_community_post', 'self-service', ['auth.uid()', 'private.community_role']],
  ['request_alias_identity', 'moderation', ['auth.uid()', 'private.has_capability']],
  ['request_approval', 'admin', ['auth.uid()', 'private.has_capability']],
  ['request_cancellation', 'financial', ['auth.uid()']],
  ['request_community_escalation', 'moderation', ['auth.uid()', 'private.has_capability']],
  ['request_connection', 'self-service', ['auth.uid()']],
  ['request_mentor', 'self-service', ['auth.uid()', 'private.school_of', 'private.in_cohort']],
  ['request_school_membership', 'self-service', ['auth.uid()', 'private.verified_account']],
  ['resolve_privacy_request', 'admin', ['auth.uid()', 'private.assert_fresh_mfa', 'private.privacy_case_allowed', 'private.account_is_held']],
  ['restore_school', 'admin', ['private.offboarding_operator']],
  ['retire_escalation_agreement', 'admin', ['auth.uid()', 'private.has_capability']],
  ['reveal_alias_identity', 'moderation', ['auth.uid()', 'private.has_capability']],
  ['review_break_glass', 'admin', ['auth.uid()', 'private.holds_seat']],
  ['revoke_school_membership', 'admin', ['private.has_capability']],
  ['revoke_support_access', 'sharing', ['auth.uid()']],
  ['save_escalation_agreement', 'admin', ['auth.uid()', 'private.has_capability']],
  ['school_enforcement_readiness', 'admin', ['private.is_app_admin', 'private.has_capability']],
  ['school_purge_eligibility', 'admin', ['private.is_app_admin', 'private.has_capability']],
  ['school_requests_for_admin', 'admin', ['private.has_capability']],
  ['send_help_request', 'self-service', ['auth.uid()', 'private.school_of']],
  ['set_member_capabilities', 'admin', ['private.org_can']],
  ['set_member_standing', 'admin', ['auth.uid()', 'private.org_can']],
  ['set_school_enforcement', 'admin', ['private.is_app_admin']],
  ['set_support_email_notice', 'self-service', ['auth.uid()']],
  ['share_with_advisor', 'sharing', ['auth.uid()']],
  ['share_with_support', 'sharing', ['auth.uid()', 'private.may_receive_support_share']],
  ['skip_onboarding_step', 'self-service', ['auth.uid()']],
  ['start_onboarding', 'self-service', ['auth.uid()']],
  ['start_organization', 'self-service', ['auth.uid()', 'private.verified_student', 'private.school_of']],
  ['state_my_age', 'self-service', ['auth.uid()']],
  ['stop_contributing', 'self-service', ['auth.uid()']],
  ['submit_course_review', 'self-service', ['auth.uid()', 'private.verified_student', 'private.school_of']],
  ['support_access_windows', 'sharing', ['auth.uid()', 'private.subject_has_capability', 'private.support_consent_active']],
  ['support_case_access', 'sharing', ['auth.uid()', 'private.subject_has_capability', 'private.support_agent', 'private.support_consent_active']],
  ['support_reply', 'admin', ['private.support_agent']],
  ['support_ticket_queue', 'admin', ['private.support_agent']],
  ['support_ticket_thread', 'admin', ['private.support_agent']],
  ['trust_room_grant', 'sharing', ['auth.uid()', 'private.has_capability']],
  ['trust_room_revoke', 'sharing', ['auth.uid()', 'private.has_capability']],
  ['verify_data_subject_request', 'admin', ['auth.uid()', 'private.has_capability', 'req.subject = me']],
  ['verify_offboarding_export', 'admin', ['private.offboarding_operator']],
  ['verify_privacy_request', 'admin', ['auth.uid()', 'private.assert_fresh_mfa', 'private.privacy_case_allowed']],
  ['volunteer_attest', 'self-service', ['auth.uid()']],
  ['volunteer_decide', 'moderation', ['auth.uid()', 'private.volunteer_ready']],
  ['volunteer_next_tasks', 'moderation', ['auth.uid()', 'private.volunteer_ready']],
  ['volunteer_roster', 'moderation', ['private.has_capability']],
  ['withdraw_help_request', 'self-service', ['auth.uid()']],
  ['withdraw_school_request', 'self-service', ['auth.uid()']],
];

/**
 * Migrations in `SINCE_READING` that production still lacked at
 * `SECOND_READING.on`. Their functions have rows in `FUNCTIONS` but were not in
 * the reading, so the reading's count is the register's rows minus these.
 * Delete an entry when the file is applied, and the next reading's count moves.
 */
export const NOT_YET_APPLIED: readonly string[] = [
  '20260930185000_school_membership_enforcement.sql',
  '20260930200000_school_offboarding.sql',
  '20260930234000_data_subject_request_intake.sql',
  '20261004200000_answer_data_subject_requests.sql',
];

/**
 * Callable definer functions added by migrations that were **not** applied to
 * production on `READ_ON`, so were not in the advisor's first reading. They
 * have rows in `FUNCTIONS` like any other; they are named here so the first
 * reading stays the reading — the page says 151 and lists these beside it.
 * The second reading (`SECOND_READING`) finds every one of them applied except
 * the files in `NOT_YET_APPLIED`.
 */
export const SINCE_READING: readonly { file: string; functions: readonly string[] }[] = [
  {
    file: '20261004200000_answer_data_subject_requests.sql',
    functions: ['answer_data_subject_request', 'verify_data_subject_request'],
  },
  {
    file: '20260930234000_data_subject_request_intake.sql',
    functions: ['raise_my_data_subject_request'],
  },
  {
    file: '20260930200000_school_offboarding.sql',
    functions: [
      'approve_offboarding',
      'archive_school',
      'authorize_school_purge',
      'cancel_offboarding',
      'disable_school_access',
      'offboarding_preflight',
      'propose_offboarding',
      'record_offboarding_export',
      'record_offboarding_notice',
      'restore_school',
      'school_purge_eligibility',
      'verify_offboarding_export',
    ],
  },
  {
    file: '20260930185000_school_membership_enforcement.sql',
    functions: [
      'decide_school_request',
      'leave_school',
      'request_school_membership',
      'revoke_school_membership',
      'school_enforcement_readiness',
      'school_requests_for_admin',
      'set_school_enforcement',
      'withdraw_school_request',
    ],
  },
  {
    file: '20260929150000_minimum_age.sql',
    functions: ['my_age_status', 'state_my_age'],
  },
  {
    file: '20260929330000_dining.sql',
    functions: [
      'dining_advance_order',
      'dining_cancel_order',
      'dining_disconnect_partner',
      'dining_donate_swipes',
      'dining_order_queue',
      'dining_place_order',
      'dining_pool_summary',
      'dining_set_ordering',
      'my_dining_balances',
    ],
  },
  {
    file: '20260929310000_gradebook.sql',
    functions: [
      'gradebook_add_item',
      'gradebook_enter',
      'gradebook_export',
      'gradebook_file_regrade',
      'gradebook_moderate',
      'gradebook_queue_passback',
      'gradebook_release',
      'gradebook_resolve_regrade',
      'gradebook_set_scheme',
    ],
  },
  {
    file: '20260929300000_registration_transaction.sql',
    functions: [
      'my_registration',
      'my_registration_hold',
      'registrar_decide',
      'registrar_grant_override',
      'registrar_put_section',
      'registrar_put_term',
      'registration_drop',
      'registration_enroll',
      'registration_withdraw',
    ],
  },
];

/**
 * Callable definers added after the dated second advisor reading. They remain
 * part of the exact register but are not retroactively counted in that
 * historical snapshot.
 */
export const AFTER_SECOND_READING: readonly { file: string; functions: readonly string[] }[] = [
  {
    file: '20261008233000_tenant_projection_read.sql',
    functions: ['read_tenant_projection'],
  },
  {
    file: '20261008190500_projection_outbox_operations.sql',
    functions: ['replay_domain_event'],
  },
  {
    file: '20261008190000_console_postmerge_safety.sql',
    functions: ['console_command_center', 'console_release_incidents'],
  },
  {
    file: '20261005125000_console_integration_health.sql',
    functions: ['console_integration_health'],
  },
  {
    file: '20261005124000_privacy_case_actions.sql',
    functions: ['claim_privacy_request', 'my_privacy_completion_certificates', 'read_privacy_request_detail', 'resolve_privacy_request', 'verify_privacy_request'],
  },
  {
    file: '20261005123000_privacy_case_workspace.sql',
    functions: ['console_privacy_requests'],
  },
  {
    file: '20261001153124_productivity_workspace.sql',
    functions: ['productivity_readiness_aggregate'],
  },
  {
    file: '20261002003000_support_notification_outbox.sql',
    functions: ['my_support_email_notices'],
  },
  {
    file: '20261005120000_console_scoped_tenant_access.sql',
    functions: ['console_tenant_access'],
  },
  {
    file: '20261005121000_console_tenant_operations.sql',
    functions: ['console_tenant_operations'],
  },
  {
    file: '20261005122000_support_case_access.sql',
    functions: ['available_case_supporters', 'read_support_case_signals', 'support_case_access'],
  },
  {
    file: '20261003120000_support_notification_consent_boundary.sql',
    functions: ['set_support_email_notice'],
  },  {
    file: '20261006000000_onboarding_journeys_and_handoff.sql',
    functions: ['complete_onboarding_step', 'consume_handoff', 'skip_onboarding_step', 'start_onboarding'],
  },
  {
    file: '20261006160000_my_sessions.sql',
    functions: ['end_my_session', 'my_sessions'],
  },
];

/** How many functions the advisor listed on production on `READ_ON`. */
export const READ_COUNT = 151;

/** How many policy-less tables it listed the same day. */
export const READ_TABLES = 45;

/**
 * The advisor's `rls_enabled_no_policy` tables: 45 on `READ_ON`, 49 on
 * `SECOND_READING.on`. `private-internal` is a
 * table in `private`, which PostgREST does not expose; `server-only` is a
 * `public` table with every client privilege revoked, reached only through a
 * definer function in `FUNCTIONS` or an Edge Function holding the service key.
 * `writer` is what writes it.
 */
export type Disposition = 'private-internal' | 'server-only';

export const TABLES: readonly (readonly [table: string, disposition: Disposition, writer: string])[] = [
  ['private.account_ages', 'private-internal', 'the sign-up age trigger and state_my_age (20260929150000_minimum_age.sql)'],
  ['private.ai_usage_month', 'private-internal', 'the AI gateway meter'],
  ['private.ai_usage_reservation', 'private-internal', 'the AI gateway meter'],
  ['private.approved_source_content', 'private-internal', 'the intelligence gateway'],
  ['private.console_audit_key', 'private-internal', 'the console audit chain'],
  ['private.console_audit_manifest', 'private-internal', 'the console audit chain'],
  ['private.console_audit_verification', 'private-internal', 'the console audit integrity job'],
  ['private.direct_rate_limit', 'private-internal', 'the direct rate-limit trigger'],
  ['private.domain_event_receipts', 'private-internal', 'the domain outbox consumer'],
  ['private.domain_outbox_events', 'private-internal', 'the domain outbox'],
  ['private.gateway_audit', 'private-internal', 'the university gateway'],
  ['private.gateway_health_probe', 'private-internal', 'the university gateway'],
  ['private.gateway_intelligence_action', 'private-internal', 'the intelligence gateway'],
  ['private.gateway_intelligence_audit', 'private-internal', 'the intelligence gateway'],
  ['private.gateway_rate_limit', 'private-internal', 'the university gateway'],
  ['private.gateway_review', 'private-internal', 'the university gateway'],
  ['private.integration_simulation_runs', 'private-internal', 'the sync simulation sandbox'],
  ['private.site_lead_hits', 'private-internal', 'submit_site_lead rate limiting'],
  ['public.access_gate', 'server-only', 'the invite-gate definer functions (20260921002428_invites.sql)'],
  ['public.app_admins', 'server-only', 'the service key; read by private admin helpers'],
  ['public.beta_cohorts', 'server-only', 'the beta_* definer functions'],
  ['public.beta_exit_requests', 'server-only', 'the beta_* definer functions'],
  ['public.beta_feature_flags', 'server-only', 'the beta_* definer functions'],
  ['public.beta_feedback', 'server-only', 'the beta_* definer functions'],
  ['public.beta_invitations', 'server-only', 'the beta_* definer functions'],
  ['public.beta_known_issues', 'server-only', 'the beta_* definer functions'],
  ['public.beta_memberships', 'server-only', 'the beta_* definer functions'],
  ['public.beta_programs', 'server-only', 'the beta_* definer functions'],
  ['public.community_media_deletions', 'server-only', 'the private.queue_media_deletion trigger'],
  ['public.community_safety_entries', 'server-only', 'the community moderation functions'],
  ['public.gtm_communication_events', 'server-only', 'the GTM Edge Functions, holding consent-bearing contact data'],
  ['public.gtm_consent', 'server-only', 'the GTM Edge Functions, holding consent-bearing contact data'],
  ['public.gtm_conversion_events', 'server-only', 'the GTM Edge Functions, holding consent-bearing contact data'],
  ['public.gtm_prospects', 'server-only', 'the GTM Edge Functions, holding consent-bearing contact data'],
  ['public.gtm_suppression', 'server-only', 'the GTM Edge Functions, holding consent-bearing contact data'],
  ['public.invites', 'server-only', 'the invite functions'],
  ['public.lti_identity', 'server-only', 'the LTI launch function and adopt_lti_identity'],
  ['public.lti_line_item', 'server-only', 'the LTI AGS function'],
  ['public.lti_link_ticket', 'server-only', 'the LTI launch function'],
  ['public.lti_nonce', 'server-only', 'the LTI launch function'],
  ['public.lti_platform', 'server-only', 'the LTI launch function'],
  ['public.payment_events', 'server-only', 'the verified Stripe webhook'],
  ['public.registration_completions', 'server-only', 'the registration definer functions (20260929300000_registration_transaction.sql)'],
  ['public.registration_holds', 'server-only', 'the registration definer functions (20260929300000_registration_transaction.sql)'],
  ['public.registration_requests', 'server-only', 'the registration idempotency ledger, private.registration_replay and registration_commit'],
  ['public.scim_credential', 'server-only', 'the SCIM gateway'],
  ['public.site_leads', 'server-only', 'submit_site_lead, called by the lead-intake Edge Function with the service key'],
  ['public.support_ticket_messages', 'server-only', 'the support ticket functions'],
  ['public.support_tickets', 'server-only', 'the support ticket functions'],
];

/**
 * What the register leaves open, each with its severity on the scale
 * SECURITY.md defines and what would close it.
 */
export const OPEN: readonly { id: string; severity: 'low' | 'medium' | 'high'; what: string; closes: string; closedBy?: string }[] = [
  {
    id: 'DR-01',
    severity: 'low',
    what: '`kill_switch_engaged(switch, tenant)` answers for any tenant, where the read policy on `feature_kill_switch` shows a signed-in account only the platform-wide rows, its own school\'s and those it holds `integration:view` over. The one bit it discloses is whether another school has a named switch engaged. `grants.check.sql` records it as deliberate: one boolean, no row. It is the only one of the 180 whose body names neither `auth.uid()` nor a `private.` gate (checked on production, 30 September).',
    closes: 'Not by revoking `EXECUTE` from `authenticated`, as the 30 September reconciliation first considered: production has three callers that run with the signed-in caller\'s rights, not the owner\'s — `public.effective_module_modes`, `private.gtm_placement_guard` and `private.gtm_send_guard` (SECURITY INVOKER) — and each would fail for every signed-in user. Scope the answer to the policy\'s tenants for a client caller, and give those three a definer wrapper first, or accept the disclosure in SECURITY.md. The definer callers (`tenant_plan`, `tenant_sso_policy`, the LTI entitlement facts, the trust room) run as the owner and are unaffected either way.',
  },
  {
    id: 'DR-02',
    severity: 'medium',
    what: 'The gates here are structural: this register proves each check is present in the body, not that it is correct. Behaviour is proved per function by the `supabase/*.check.sql` suites, and not every one of the 151 had a suite that calls it as a second account.',
    closes: 'Closed by `supabase/definer-sweep.check.sql`: a signed-in account holding nothing calls every callable definer function with neutral arguments and must be refused or told nothing, except seventeen that act only on the caller\'s own account, each named with the answer it may give; a victim\'s id, email, referral code and ticket may appear in no answer. Shown red on a function stripped of its owner filter, a self-service function taken off the list and a stale list entry; two planted probes are named on every run. Left to the feature suites: a caller holding a real id of somebody else\'s object, which neutral arguments cannot name.',
    closedBy: 'supabase/definer-sweep.check.sql',
  },
  {
    id: 'DR-03',
    severity: 'low',
    what: 'The 49 tables are pinned to the reading of 30 September (45 on 29 September, and the four that arrived between). A table that gains or loses its last policy through a `format()` loop is not noticed here. `supabase/advisor-reconciliation.check.sql` now asks the schema directly whether any table with row-level security and no policy is open to a client role, which is the fact that makes the notice benign; what it cannot see is a table whose policy count changes by a loop, or whether its intended writer exists.',
    closes: 'Re-read the advisor at each quarterly architecture review and compare; or move the loops\' table lists into data the test can read.',
  },
  {
    id: 'DR-04',
    severity: 'low',
    what: '`anon` holds table privileges it cannot use on 26 `public` tables, found by the 30 September reading: INSERT, UPDATE, DELETE and TRUNCATE on the caller-owned tables (`appointments`, `blocks`, `calendar_feeds`, `courses`, `enrollments`, `family_grants`, `group_members`, `group_tasks`, `groups`, `message_reactions`, `messages`, `notes`, `push_devices`, `push_queue`, `referral_codes`, `referrals`, `schools`, `sittings`, `state`, `tasks`, `usage`, and a part of `form_responses`, `organizations`, `organization_members`, `profiles`, `reports`). Supabase\'s default privileges grant them. All 26 have row-level security on, and every policy that could let `anon` write requires `auth.uid()` or an admin/capability check except one: `answer an open form` on `form_responses`, which lets anyone answer a form its owner opened, and is deliberate (`20260921143455_forms.sql`). So nothing is exposed today. TRUNCATE is not subject to row-level security, but PostgREST has no verb for it.',
    closes: 'Revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER from `anon` on those tables, keeping INSERT on `form_responses`, and extend `supabase/grants.check.sql`, which asks about function `EXECUTE` and not about table privileges, to hold the rule. Not done in the 30 September reconciliation: it is a grant change across twenty-six core-app tables that the advisor did not flag, and wants its own review.',
  },
];

/**
 * Both briefs, item by item, held to what the tree has. `held` cites a test
 * or check that guards it; `partial` cites what exists and says what does
 * not; `owed` cites only prose. Read on 29 September against main at 9bd492d.
 */
export type BriefStatus = 'held' | 'partial' | 'owed';

export const BRIEF: readonly { id: string; item: string; status: BriefStatus; paths: readonly string[]; gap: string }[] = [
  { id: 'A01', item: 'A formal architecture map: layers, and per module an owner, source of truth, classification, APIs and events, flags, dashboards and failure behaviour', status: 'partial', paths: ['docs/ARCHITECTURE.md', 'docs/UNIVERSITY-OS-ARCHITECTURE.md', 'app/src/lib/governance/charters.ts', 'app/src/lib/governance/charters.test.ts'], gap: 'Layer maps and per-module charters exist; no single map gives each module all of those fields together.' },
  { id: 'A02', item: 'Domain boundaries with explicit APIs and prohibited cross-domain access', status: 'partial', paths: ['docs/architecture/0003-no-application-server.md', 'app/server/institution/gateway.ts', 'packages/institution/src/index.ts'], gap: 'No document names the bounded contexts and their owners, and no lint rule or test forbids a cross-domain import or table read.' },
  { id: 'A03', item: 'A canonical data model with standard metadata on every object', status: 'partial', paths: ['supabase/migrations/20260927170000_integration_control_plane.sql', 'supabase/integration-control-plane.check.sql', 'app/src/lib/integration/catalog.ts', 'packages/contract/src/index.ts'], gap: 'canonical_entity_references carries tenant, source, classification and freshness, but not version or retention policy, and the domain tables carry none of it.' },
  { id: 'A04', item: 'Source lineage everywhere: a Source Card and one set of source states', status: 'partial', paths: ['app/src/components/SourceBadge.tsx', 'app/src/components/SourceBadge.test.tsx', 'app/src/lib/source.test.ts'], gap: 'A source badge exists; no Source Card shows the record and its sync time, and two trust vocabularies are still in use.' },
  { id: 'A05', item: 'Reconciliation and drift detection', status: 'partial', paths: ['app/src/lib/integration/drift.ts', 'app/src/lib/integration/reconcile.ts', 'app/src/lib/integration/quality.test.ts', 'supabase/migrations/20260928040000_integration_quality.sql'], gap: 'Drift detection, reconciliation reports and mapping versions are tested; there is no quarantine queue or review workflow for held records.' },
  { id: 'A06', item: 'A connector framework with one contract and lifecycle', status: 'partial', paths: ['app/src/lib/integration/adapter.ts', 'app/server/integration/registry.ts', 'app/server/integration/registry.test.ts'], gap: 'The contract and registry exist but the registry holds mocks only, and connection status is an enum with no enforced state machine.' },
  { id: 'A07', item: 'Graceful degradation when a source is stale, unavailable or revoked', status: 'partial', paths: ['app/src/lib/integration/freshness.ts', 'app/src/lib/integration/pipeline.test.ts'], gap: 'Freshness classes exist; no screen defines its fallback for each state.' },
  { id: 'A08', item: 'Policy as code: RBAC, ABAC, object-level authorization, a permission simulator, default deny', status: 'partial', paths: ['packages/institution/src/policy.ts', 'packages/institution/src/policy.test.ts', 'app/src/lib/governance/policysim.ts', 'supabase/rls-coverage.check.sql', 'supabase/grants.check.sql'], gap: 'A default-deny decision point, a simulator and RLS exist; routes adopt the decision point gradually (ADR 0007) and flags are evaluated on the client.' },
  { id: 'A09', item: 'Privacy operations: export, deletion, consent revocation, a request workflow', status: 'partial', paths: ['supabase/migrations/20260929010000_account_erasure_and_export.sql', 'supabase/deletion.check.sql', 'app/src/lib/erasure.test.ts'], gap: 'Self-service export and erasure are tested; there is no data-subject-request queue with verification and a deadline.' },
  { id: 'A10', item: 'A security programme: threat modelling, secret and dependency scanning, SBOM, branch protection, incident response, disclosure', status: 'partial', paths: ['.github/workflows/ci.yml', 'SECURITY.md', 'app/src/lib/supplychain.test.ts', 'app/src/lib/branchprotection.test.ts'], gap: 'All present except a platform-wide threat model; the dependency audit is non-blocking by a decision recorded in ci.yml.' },
  { id: 'A11', item: 'Observability across frontend, backend, queues, auth and sync', status: 'partial', paths: ['MONITORING.md', 'supabase/health.sql', '.github/workflows/production-smoke.yml'], gap: 'Database health queries and synthetic probes only; no frontend error capture, latency, queue or sync telemetry in the tree.' },
  { id: 'A12', item: 'Service objectives', status: 'partial', paths: ['app/src/lib/governance/error-budgets.ts', 'app/src/lib/governance/error-budgets.test.ts', 'docs/operating-model/SLOS-AND-ERROR-BUDGETS.md'], gap: 'Journey SLOs and error budgets are defined and held; no indicator is measured against them.' },
  { id: 'A13', item: 'Resilience: queues, idempotency, dead letters, circuit breakers, rate limits, kill switches, offline', status: 'partial', paths: ['app/src/lib/integration/retry.ts', 'supabase/functions/_shared/killswitch.ts', 'app/src/lib/aikillswitch.test.ts', 'app/src/lib/offline-mode.test.ts'], gap: 'No circuit breaker, no general job queue or retry console.' },
  { id: 'A14', item: 'A design-system package with accessibility and visual regression tests', status: 'partial', paths: ['app/src/styles/tokens.css', 'app/src/styles/tokens.test.ts', 'app/src/a11y/axe.test.tsx'], gap: 'Tokens and axe tests exist; no separate package, component catalogue or visual regression.' },
  { id: 'A15', item: 'A platform event bus with a standard envelope', status: 'partial', paths: ['packages/institution/src/events.ts', 'packages/institution/src/events.test.ts', 'supabase/outbox.check.sql', 'supabase/ops-projector-worker.check.sql'], gap: 'The envelope, outbox, one SQL-native producer and one bounded projector endpoint are tested; the endpoint is dormant and unscheduled, and no publisher runs.' },
  { id: 'A16', item: 'First-class feature flags', status: 'partial', paths: ['app/src/lib/flags.ts', 'app/src/lib/flags.test.ts', 'docs/FEATURE-FLAG-REGISTRY.md'], gap: 'Owner, review date, expiry, kill switch, tenant and role scope exist; no cohort scope, and evaluation is client-side.' },
  { id: 'A17', item: 'Tests by risk: tenant isolation, contracts, critical journeys, accessibility, visual, load', status: 'partial', paths: ['supabase/integration-rls-matrix.check.sql', 'supabase/tenancy.check.sql', 'app/scripts/golden-path.mjs', 'app/src/a11y/axe.test.tsx'], gap: 'No visual regression or load tests.' },
  { id: 'A18', item: 'Performance budgets', status: 'partial', paths: ['app/src/lib/perfbudget.ts', 'app/src/lib/perfbudget.test.ts', 'app/perf-budgets.json', 'docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md'], gap: 'Bundle budgets are a CI gate: first load, each of 90 screens and the largest file, in gzip bytes, set from a measurement. The first load they were set from is 395 KB, well above common mobile guidance, and nothing measures Core Web Vitals in the field yet.' },
  { id: 'A19', item: 'The console as an operations command centre', status: 'partial', paths: ['app/src/screens/Console.tsx', 'app/src/screens/console.test.tsx', 'app/src/lib/ops/console.ts'], gap: 'Approvals, break-glass, audit and figures exist; no integration-health, flag-status, permission-simulator or data-request tabs.' },
  { id: 'A20', item: 'A safe sandbox tenant', status: 'partial', paths: ['app/server/institution/sandbox.ts', 'app/server/institution/sandbox.test.ts', 'docs/SYNC-SIMULATION-SANDBOX.md'], gap: 'A fictional-institution sandbox exists; no sandbox tenant with role switching and no promotion path.' },
  { id: 'B01', item: 'THREAT-MODEL', status: 'partial', paths: ['docs/INTEGRATION-THREAT-MODEL.md', 'docs/ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md'], gap: 'Integration and AI-toolkit threat models only; no platform-wide one.' },
  { id: 'B02', item: 'DATA-INVENTORY', status: 'partial', paths: ['supabase/migrations/20260929010000_account_erasure_and_export.sql', 'app/src/lib/governance/pia.ts', 'app/src/lib/governance/pia.test.ts', 'RETENTION.md'], gap: 'account_data_map, the PIA register and the retention schedule exist; no inventory of every table and field with its classification.' },
  { id: 'B03', item: 'INTEGRATION-CATALOG', status: 'held', paths: ['app/src/lib/integration/catalog.ts', 'app/src/lib/integration/catalog.test.ts'], gap: 'catalog.ts is the catalogue and catalog.test.ts holds its four constrained lists to the database, value for value; there is no separate prose document, and freshness and the sync classes have no constraint to hold them to.' },
  { id: 'B04', item: 'RISK-REGISTER', status: 'held', paths: ['app/src/lib/governance/risk.ts', 'app/src/lib/governance/risk.test.ts', 'docs/operating-model/RISK-GOVERNANCE.md'], gap: '-' },
  { id: 'B05', item: 'CI checks: secrets, dependencies, migrations, types, tests, RLS regression', status: 'held', paths: ['.github/workflows/ci.yml', '.gitleaks.toml', 'supabase/check.sh', 'supabase/rls-coverage.check.sql', 'app/src/lib/definerregister.test.ts'], gap: 'The dependency audit annotates rather than fails, by the decision in ci.yml.' },
  { id: 'B06', item: 'Severity levels and incident response', status: 'held', paths: ['SECURITY.md', 'app/src/lib/security.test.ts'], gap: '-' },
  { id: 'B07', item: 'Production and staging separation', status: 'partial', paths: ['STAGING.md', 'app/src/lib/environment.ts', 'app/src/lib/environment.test.ts'], gap: 'Environments are told apart at build time and previews exist; no standing staging environment shown to match production.' },
  { id: 'B08', item: 'A release gate in the pull-request template', status: 'held', paths: ['.github/pull_request_template.md', 'app/src/lib/ops/operatingsystem.test.ts'], gap: '-' },
  { id: 'B09', item: 'Rate limits on forms, sign-in, AI and invites', status: 'partial', paths: ['supabase/migrations/20260928230000_direct_rate_limits.sql', 'supabase/rate-limits.check.sql', 'app/server/institution/rate-limit.test.ts'], gap: 'Sign-in limits are Supabase Auth defaults outside the tree; invite creation has no explicit limit.' },
  { id: 'B10', item: 'Consent and sharing-expiry enforcement', status: 'held', paths: ['supabase/supportshares.check.sql', 'supabase/support-access.check.sql', 'supabase/familyshare.check.sql'], gap: '-' },
  { id: 'B11', item: 'Standard audit events for login, privilege, share, export, delete, integration, AI', status: 'partial', paths: ['supabase/migrations/20260928320000_audit_correlation_and_outbox.sql', 'supabase/role-grant-audit.check.sql', 'supabase/gateway-journal.check.sql'], gap: 'Separate audit tables with no single schema; sign-ins and shares are not in a common trail.' },
  { id: 'B12', item: 'Webhook intake: signatures, idempotency, replay protection, dead letters', status: 'partial', paths: ['supabase/functions/_shared/billingwebhook.ts', 'app/src/lib/billing/webhook.test.ts', 'supabase/integration-hardening.check.sql'], gap: 'Billing verifies signature, age and idempotency; no inbound integration endpoint exists yet, and billing has no dead letter.' },
  { id: 'B13', item: 'Restore drills and rollback', status: 'held', paths: ['supabase/restore.sh', 'RESTORE.md', 'ROLLBACK.md', 'app/src/lib/rehearsal.test.ts'], gap: 'The production restore drill has not run (D-126).' },
  { id: 'B14', item: 'Load and capacity tests', status: 'partial', paths: ['supabase/load.sh', 'supabase/load/run.sh', 'supabase/load/sync-open.pgbench.sql', 'supabase/load/sync-push.pgbench.sql', 'supabase/load/sync-same-student.pgbench.sql', 'docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md'], gap: 'A CI gate for the database: registration-week reads and plan saves, and the open and sync every student makes, each against a latency budget, with invariants after (no lost update when two devices push, no plan counted twice). The database only: PostgREST, Supavisor, GoTrue and the network are the preview-branch run still owed, and assessment and gradebook have no load because they do not exist.' },
  { id: 'B15', item: 'A quarterly architecture review', status: 'partial', paths: ['docs/operating-model/RISK-GOVERNANCE.md', 'docs/operating-model/OPERATING-RHYTHM.md'], gap: 'A monthly review board is defined without named members; no review is recorded. This register\'s next review is quarterly.' },
];
