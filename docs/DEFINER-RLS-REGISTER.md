# Security Definer and RLS remediation register

<!-- Rendered from app/src/lib/definerregister.ts by definerregister.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

The architecture audit of 29 September 2026 names this register as the
first artifact of the audit, "because it tells you exactly where
application authority currently crosses database trust boundaries". It
read production's Supabase advisor and found **45 tables with row-level
security on and no policy** and **151 `security definer` functions a
signed-in account can call**. Neither is a vulnerability by itself; the
audit asked for a disposition for every one, and a guard so the next one
cannot arrive without one. This page is both.

## Sources

- [Audit summary](expansion/Architecture-Audit-Summary-and-Hardening-Scorecard.pdf) — A twenty-dimension hardening scorecard (57/100), the two advisor findings, a function-category control table, a release gate, a four-layer architecture map, the connector and trust layers, flags against tenant configuration, a 90-day remediation plan and a definition of done.
- [What else can I do to further strengthen, improve and reinforce the existing application and architecture](expansion/Strengthen-the-Architecture-Twenty-Priorities.pdf) — Twenty architecture priorities — map, domains, canonical model, lineage, reconciliation, connectors, degradation, policy-as-code, privacy operations, security, observability, SLOs, resilience, design system, event bus, flags, risk-based tests, performance, the console and a sandbox — a recommended sequence and the rule every feature must answer.

## The reading

Production (`lzrqvlugnawcgywkhqlz`), 2026-09-29, read-only, through the advisor and `pg_catalog`:

- all 45 policy-less tables: no SELECT, INSERT, UPDATE or DELETE for `anon` or `authenticated`. Each is deny-by-default, not open;
- all 151 functions: not executable by `anon` or PUBLIC, `search_path` pinned, no dynamic `execute`;
- two bodies named neither `auth.uid()` nor a `private.` gate. `gtm_pilot_problems` answered any signed-in caller about any pilot — a student could read whether a pilot's price was agreed, who sponsored it and whether its dates fit. It is fixed in `supabase/migrations/20260929120000_gtm_pilot_problems_visibility.sql` and held by `supabase/gtm.check.sql`. `kill_switch_engaged` is a deliberate one-boolean read, kept open as DR-01.

Since the reading, 51 more, from migrations not applied to production, each with a row below: `20260930234000_data_subject_request_intake.sql` (`raise_my_data_subject_request`); `20260930173030_console_command_center.sql` (`console_command_center`); `20260930200000_school_offboarding.sql` (`approve_offboarding`, `archive_school`, `authorize_school_purge`, `cancel_offboarding`, `disable_school_access`, `offboarding_preflight`, `propose_offboarding`, `record_offboarding_export`, `record_offboarding_notice`, `restore_school`, `school_purge_eligibility`, `verify_offboarding_export`); `20260930185000_school_membership_enforcement.sql` (`decide_school_request`, `leave_school`, `request_school_membership`, `revoke_school_membership`, `school_enforcement_readiness`, `school_requests_for_admin`, `set_school_enforcement`, `withdraw_school_request`); `20260929150000_minimum_age.sql` (`my_age_status`, `state_my_age`); `20260929330000_dining.sql` (`dining_advance_order`, `dining_cancel_order`, `dining_disconnect_partner`, `dining_donate_swipes`, `dining_order_queue`, `dining_place_order`, `dining_pool_summary`, `dining_set_ordering`, `my_dining_balances`); `20260929310000_gradebook.sql` (`gradebook_add_item`, `gradebook_enter`, `gradebook_export`, `gradebook_file_regrade`, `gradebook_moderate`, `gradebook_queue_passback`, `gradebook_release`, `gradebook_resolve_regrade`, `gradebook_set_scheme`); `20260929300000_registration_transaction.sql` (`my_registration`, `my_registration_hold`, `registrar_decide`, `registrar_grant_override`, `registrar_put_section`, `registrar_put_term`, `registration_drop`, `registration_enroll`, `registration_withdraw`).

## The second reading

Production (`lzrqvlugnawcgywkhqlz`), 2026-09-30, read-only, through the advisor and `pg_catalog`. Against the register above: **49 policy-less tables** and **180 `security definer` functions** a signed-in account can call, which is the first reading's 45 and 151 plus what arrived since.

- the 180 functions are exactly the register's rows below, less the 4 migration not yet applied (20260930173030_console_command_center.sql, 20260930185000_school_membership_enforcement.sql, 20260930200000_school_offboarding.sql, 20260930234000_data_subject_request_intake.sql); none unlisted and none listed that production has; none is executable by `anon` or PUBLIC; every `search_path` is pinned; none uses dynamic `execute`. 179 name `auth.uid()` or a `private.` gate; the one that names neither is `kill_switch_engaged` (DR-01);
- all 49 policy-less tables hold no privilege of any kind for `anon` or `authenticated`, table or column. The 4 that were not in the first reading (`private.account_ages`, `public.registration_completions`, `public.registration_holds`, `public.registration_requests`) now have a disposition below. No policy was added to any of the 49, and none should be;
- the rest of that day's advisor findings, what was fixed and what was left, with the before and after: [`ADVISOR-RECONCILIATION-2026-09-30.md`](ADVISOR-RECONCILIATION-2026-09-30.md).

### After the second reading

The current register also includes 3 callable definers added after that dated catalogue snapshot: `20261001153124_productivity_workspace.sql` (`productivity_readiness_aggregate`); `20261002003000_support_notification_outbox.sql` (`my_support_email_notices`); `20261003120000_support_notification_consent_boundary.sql` (`set_support_email_notice`). They are held to their migration bodies and grant declarations below and are not retroactively counted in the 30 September reading.

## How this page is held

- The function set is derived: `definerregister.test.ts` reads every migration, takes the winning definition of each `public` function, keeps the `security definer` ones and intersects them with the allowlist in `supabase/grants.check.sql`. That set must equal the register exactly. A new definer function granted to clients is red until it has a row — the audit's release-gate line "new SECURITY DEFINER functions have an approved inventory entry", as a test.
- Every row's gates are literal checks that must appear in the winning body. Removing one turns its row red.
- An admin or moderation row must name a gate other than `auth.uid()`.
- The tables are the advisor's list, pinned: some tables get their policies from `format()` loops a static parser cannot read. Each is held to being created with row-level security, having no `create policy` naming it, and never being granted to `anon`, `authenticated` or PUBLIC.

## Functions by category

| Category | Functions | Controls the audit requires |
| --- | --- | --- |
| self-service | 60 | Verify auth.uid(), tenant scope, object ownership, input validation, rate limits, audit event. |
| sharing | 19 | Explicit consent, narrow scope, short expiry, revocation, view audit. |
| admin | 74 | Capability check, MFA or fresh auth for high risk, dual control where needed, immutable audit. |
| integration | 6 | Server-only preferred; signed workflow; replay protection; no browser service-role access. |
| financial | 3 | Provider webhook verification, idempotency, no client-controlled final state. |
| moderation | 15 | Capability check, reason required, appeals, audit trail. |
| read-helper | 28 | Minimal fields, no hidden cross-tenant aggregation, pagination limit. |
| **total** | 205 | |

### self-service (60)

| Function | Gates in its body | Defined in |
| --- | --- | --- |
| `accept_connection` | `auth.uid()` | `20260922003000_connections.sql` |
| `appeal_community_decision` | `auth.uid()` | `20261004130000_community_appeal_window.sql` |
| `apply_to_organization` | `auth.uid()`, `private.verified_student` | `20260921230000_organizations.sql` |
| `apply_to_volunteer` | `auth.uid()`, `private.verified_student`, `private.school_of` | `20260928032000_community.sql` |
| `begin_community_image` | `auth.uid()`, `private.community_role` | `20260928032000_community.sql` |
| `beta_send_feedback` | `private.beta_my_membership` | `20260928220000_private_beta.sql` |
| `block_community_author` | `auth.uid()`, `private.community_role` | `20260928032000_community.sql` |
| `claim_abandoned_organization` | `auth.uid()`, `mine is distinct from 'MEMBER'` | `20260921234500_organization_succession.sql` |
| `claim_community_alias` | `auth.uid()`, `private.community_role` | `20260928032000_community.sql` |
| `claim_referral` | `auth.uid()` | `20260921002623_referrals.sql` |
| `claim_school` | `auth.uid()` | `20260930185000_school_membership_enforcement.sql` |
| `close_my_ticket` | `auth.uid()` | `20260928210000_support_tickets.sql` |
| `contribute_course_plan` | `auth.uid()`, `private.school_of` | `20261002091500_set_based_course_plan_contribution.sql` |
| `create_community` | `auth.uid()`, `private.has_capability`, `private.verified_student`, `private.school_of` | `20260928032000_community.sql` |
| `create_community_post` | `auth.uid()`, `private.community_role` | `20260928032000_community.sql` |
| `create_study_session` | `auth.uid()`, `private.community_role` | `20260928032000_community.sql` |
| `delete_community_post` | `auth.uid()` | `20260928032000_community.sql` |
| `edit_community_post` | `auth.uid()` | `20260928032000_community.sql` |
| `export_my_data` | `auth.uid()` | `20260930000000_audit_and_subject_requests.sql` |
| `follow_organization` | `auth.uid()` | `20260921230000_organizations.sql` |
| `forget_my_advisor_shares` | `auth.uid()` | `20260928310000_expansion_review_fixes.sql` |
| `forget_my_beta` | `auth.uid()`, `private.beta_confirmed_email` | `20260928220000_private_beta.sql` |
| `forget_my_community` | `auth.uid()` | `20260928032000_community.sql` |
| `forget_my_course_demand` | `auth.uid()` | `20260928310000_expansion_review_fixes.sql` |
| `forget_my_help_requests` | `auth.uid()` | `20260927230000_help_requests.sql` |
| `forget_my_mentor_requests` | `auth.uid()` | `20260928021700_mentor_rosters.sql` |
| `forget_my_organizations` | `auth.uid()` | `20260921234500_organization_succession.sql` |
| `forget_my_support_access` | `auth.uid()` | `20260925103000_support_access.sql` |
| `forget_my_support_shares` | `auth.uid()` | `20260928308000_support_shares.sql` |
| `forget_my_support_tickets` | `auth.uid()` | `20260928210000_support_tickets.sql` |
| `gradebook_file_regrade` | `auth.uid()`, `private.gradebook_school`, `g.student_id = me and g.status = 'released'` | `20260929310000_gradebook.sql` |
| `join_beta` | `auth.uid()`, `private.beta_my_membership`, `private.beta_confirmed_email` | `20260928220000_private_beta.sql` |
| `join_community` | `auth.uid()`, `private.verified_student`, `private.school_of` | `20260928032000_community.sql` |
| `join_study_session` | `auth.uid()`, `private.community_role` | `20260928032000_community.sql` |
| `leave_beta` | `private.beta_my_membership` | `20260928220000_private_beta.sql` |
| `leave_organization` | `auth.uid()` | `20260921230000_organizations.sql` |
| `leave_school` | `auth.uid()` | `20260930185000_school_membership_enforcement.sql` |
| `make_referral_code` | `auth.uid()` | `20260921002623_referrals.sql` |
| `note_activity` | `auth.uid()` | `20260921151000_activity.sql` |
| `open_help_request` | `auth.uid()`, `private.answers_for` | `20260927234000_help_request_reply_on_open.sql` |
| `open_support_ticket` | `auth.uid()` | `20261002003000_support_notification_outbox.sql` |
| `raise_my_data_subject_request` | `auth.uid()` | `20260930234000_data_subject_request_intake.sql` |
| `registration_drop` | `auth.uid()`, `private.registration_school`, `private.registration_gate`, `private.registration_key` | `20260929300000_registration_transaction.sql` |
| `registration_enroll` | `auth.uid()`, `private.registration_school`, `private.registration_gate`, `private.registration_key` | `20260929300000_registration_transaction.sql` |
| `registration_withdraw` | `auth.uid()`, `private.registration_school`, `private.registration_gate`, `private.registration_key` | `20260929300000_registration_transaction.sql` |
| `remove_connection` | `auth.uid()` | `20260922003000_connections.sql` |
| `reply_to_my_ticket` | `auth.uid()` | `20260928210000_support_tickets.sql` |
| `report_community_post` | `auth.uid()`, `private.community_role` | `20260928032000_community.sql` |
| `request_connection` | `auth.uid()` | `20260922003000_connections.sql` |
| `request_mentor` | `auth.uid()`, `private.school_of`, `private.in_cohort` | `20260928021700_mentor_rosters.sql` |
| `request_school_membership` | `auth.uid()`, `private.verified_account` | `20260930185000_school_membership_enforcement.sql` |
| `send_help_request` | `auth.uid()`, `private.school_of` | `20260927233000_help_request_review_fixes.sql` |
| `set_support_email_notice` | `auth.uid()` | `20261003120000_support_notification_consent_boundary.sql` |
| `start_organization` | `auth.uid()`, `private.verified_student`, `private.school_of` | `20260921230000_organizations.sql` |
| `state_my_age` | `auth.uid()` | `20260929150000_minimum_age.sql` |
| `stop_contributing` | `auth.uid()` | `20260929350000_plan_save_serialized.sql` |
| `submit_course_review` | `auth.uid()`, `private.verified_student`, `private.school_of` | `20260926150000_expansion_roles_and_features.sql` |
| `volunteer_attest` | `auth.uid()` | `20260928032000_community.sql` |
| `withdraw_help_request` | `auth.uid()` | `20260927233000_help_request_review_fixes.sql` |
| `withdraw_school_request` | `auth.uid()` | `20260930185000_school_membership_enforcement.sql` |

### sharing (19)

| Function | Gates in its body | Defined in |
| --- | --- | --- |
| `accept_family_grant` | `auth.uid()` | `20260921161500_roles.sql` |
| `claim_family_invite` | `auth.uid()` | `20260928306000_family_invites.sql` |
| `create_support_access` | `auth.uid()`, `private.subject_has_capability` | `20260925160000_support_access_ui.sql` |
| `dining_donate_swipes` | `auth.uid()`, `private.dining_caller_school`, `private.dining_charge_gate` | `20260929330000_dining.sql` |
| `list_advisor_shares` | `auth.uid()` | `20260928301000_advisor_shares.sql` |
| `list_support_shares` | `auth.uid()`, `private.may_receive_support_share` | `20260928308000_support_shares.sql` |
| `make_family_invite` | `auth.uid()`, `private.verified_account` | `20260929150000_minimum_age.sql` |
| `make_family_share` | `auth.uid()` | `20260928307000_family_shared_items.sql` |
| `read_advisor_share` | `auth.uid()` | `20260928301000_advisor_shares.sql` |
| `read_family_share` | `auth.uid()` | `20260928307000_family_shared_items.sql` |
| `read_shared_accommodation` | `auth.uid()` | `20260926150000_expansion_roles_and_features.sql` |
| `read_support_share` | `auth.uid()`, `private.may_receive_support_share` | `20260928308000_support_shares.sql` |
| `read_support_signals` | `auth.uid()`, `private.subject_has_capability`, `private.support_consent_active` | `20260925103000_support_access.sql` |
| `revoke_support_access` | `auth.uid()` | `20260925160000_support_access_ui.sql` |
| `share_with_advisor` | `auth.uid()` | `20260928301000_advisor_shares.sql` |
| `share_with_support` | `auth.uid()`, `private.may_receive_support_share` | `20260928308000_support_shares.sql` |
| `support_access_windows` | `auth.uid()`, `private.subject_has_capability`, `private.support_consent_active` | `20260925160000_support_access_ui.sql` |
| `trust_room_grant` | `auth.uid()`, `private.has_capability` | `20260928100000_trust_room.sql` |
| `trust_room_revoke` | `auth.uid()`, `private.has_capability` | `20260928100000_trust_room.sql` |

### admin (74)

| Function | Gates in its body | Defined in |
| --- | --- | --- |
| `activate_escalation_agreement` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `answer_help_request` | `auth.uid()`, `private.answers_for` | `20260927230000_help_requests.sql` |
| `answer_mentor_request` | `auth.uid()`, `private.subject_has_capability` | `20260928110700_consent_and_moderation_narrowing.sql` |
| `approve_offboarding` | `auth.uid()`, `private.is_app_admin`, `private.has_capability` | `20260930200000_school_offboarding.sql` |
| `archive_school` | `private.offboarding_operator` | `20260930200000_school_offboarding.sql` |
| `authorize_school_purge` | `private.offboarding_operator` | `20260930200000_school_offboarding.sql` |
| `beta_add_cohort` | `private.beta_manager` | `20260928220000_private_beta.sql` |
| `beta_create_program` | `auth.uid()`, `private.beta_manager` | `20260928220000_private_beta.sql` |
| `beta_declare_flag` | `private.beta_manager` | `20260928220000_private_beta.sql` |
| `beta_feedback_queue` | `private.beta_triager` | `20260928220000_private_beta.sql` |
| `beta_invite` | `auth.uid()`, `private.beta_manager` | `20260928220000_private_beta.sql` |
| `beta_post_issue` | `auth.uid()`, `private.beta_triager` | `20260928220000_private_beta.sql` |
| `beta_revoke_invitation` | `private.beta_manager` | `20260928220000_private_beta.sql` |
| `beta_set_status` | `private.beta_manager` | `20260928220000_private_beta.sql` |
| `beta_triage_feedback` | `private.beta_triager` | `20260928220000_private_beta.sql` |
| `can_manage_escalation_agreements` | `private.has_capability` | `20260928032000_community.sql` |
| `cancel_offboarding` | `private.is_app_admin`, `private.has_capability` | `20260930200000_school_offboarding.sql` |
| `close_break_glass` | `auth.uid()`, `g.subject is distinct from me` | `20260929110000_console_approvals_and_break_glass.sql` |
| `console_act` | `auth.uid()`, `private.has_capability`, `private.assert_fresh_mfa` | `20260929110000_console_approvals_and_break_glass.sql` |
| `console_audit_read` | `auth.uid()`, `private.has_capability` | `20260929100000_console_control_plane.sql` |
| `console_audit_status` | `auth.uid()`, `private.has_capability` | `20260929100000_console_control_plane.sql` |
| `console_command_center` | `auth.uid()`, `private.has_capability` | `20260930173030_console_command_center.sql` |
| `console_figures` | `auth.uid()`, `private.has_capability` | `20260929110000_console_approvals_and_break_glass.sql` |
| `decide_approval` | `auth.uid()`, `private.approver_party`, `private.assert_fresh_mfa` | `20260929110000_console_approvals_and_break_glass.sql` |
| `decide_school_request` | `private.has_capability` | `20260930185000_school_membership_enforcement.sql` |
| `dining_advance_order` | `auth.uid()`, `private.dining_caller_school`, `private.has_capability` | `20260929330000_dining.sql` |
| `dining_disconnect_partner` | `auth.uid()`, `private.dining_caller_school`, `private.has_capability` | `20260929330000_dining.sql` |
| `dining_order_queue` | `private.dining_caller_school`, `private.has_capability` | `20260929330000_dining.sql` |
| `dining_pool_summary` | `private.dining_caller_school`, `private.has_capability` | `20260929330000_dining.sql` |
| `dining_set_ordering` | `private.dining_caller_school`, `private.has_capability` | `20260929330000_dining.sql` |
| `disable_school_access` | `private.offboarding_operator` | `20260930200000_school_offboarding.sql` |
| `draft_office_action` | `auth.uid()`, `private.may_publish` | `20260928302000_office_action_feed.sql` |
| `gradebook_add_item` | `auth.uid()`, `private.gradebook_require`, `private.gradebook_replay` | `20260929310000_gradebook.sql` |
| `gradebook_enter` | `auth.uid()`, `private.gradebook_require`, `private.subject_has_capability`, `want_student = me` | `20260929310000_gradebook.sql` |
| `gradebook_export` | `private.gradebook_school`, `private.gradebook_require`, `g.status = 'released'` | `20260929310000_gradebook.sql` |
| `gradebook_moderate` | `auth.uid()`, `private.gradebook_require`, `cur.graded_by is not distinct from me` | `20260929310000_gradebook.sql` |
| `gradebook_release` | `auth.uid()`, `private.gradebook_require`, `private.gradebook_replay` | `20260929310000_gradebook.sql` |
| `gradebook_resolve_regrade` | `auth.uid()`, `private.gradebook_require`, `r.student_id = me` | `20260929310000_gradebook.sql` |
| `gradebook_set_scheme` | `auth.uid()`, `private.gradebook_require`, `private.gradebook_replay` | `20260929310000_gradebook.sql` |
| `gtm_activation_failures` | `auth.uid()`, `private.has_capability` | `20260928090000_gtm_foundation.sql` |
| `gtm_audience_count` | `private.has_capability` | `20260928090000_gtm_foundation.sql` |
| `gtm_campaign_report` | `auth.uid()`, `private.has_capability` | `20260928090000_gtm_foundation.sql` |
| `gtm_pilot_problems` | `private.gtm_account_visible` | `20260929140000_gtm_pilot_26_weeks.sql` |
| `help_inbox` | `private.answers_for` | `20260927230000_help_requests.sql` |
| `move_office_action` | `auth.uid()`, `private.may_publish` | `20260928302000_office_action_feed.sql` |
| `offboarding_preflight` | `private.is_app_admin`, `private.has_capability` | `20260930200000_school_offboarding.sql` |
| `office_desk_actions` | `auth.uid()`, `private.may_publish` | `20260928302000_office_action_feed.sql` |
| `productivity_readiness_aggregate` | `auth.uid()`, `'admin'=any(m.roles)`, `if owners<10` | `20261001153124_productivity_workspace.sql` |
| `propose_offboarding` | `auth.uid()`, `private.is_app_admin`, `private.has_capability` | `20260930200000_school_offboarding.sql` |
| `publish_course_guidance` | `auth.uid()`, `private.course_publisher` | `20260928309000_course_studio.sql` |
| `publish_course_rules` | `auth.uid()`, `private.course_publisher` | `20260928309000_course_studio.sql` |
| `publish_study_pack` | `auth.uid()`, `private.course_publisher` | `20260928309000_course_studio.sql` |
| `record_offboarding_export` | `private.offboarding_operator` | `20260930200000_school_offboarding.sql` |
| `record_offboarding_notice` | `private.is_app_admin`, `private.has_capability` | `20260930200000_school_offboarding.sql` |
| `registrar_decide` | `auth.uid()`, `private.registration_registrar`, `private.registration_gate`, `private.registration_key` | `20260929300000_registration_transaction.sql` |
| `registrar_grant_override` | `auth.uid()`, `private.registration_registrar`, `private.registration_gate`, `private.registration_key` | `20260929300000_registration_transaction.sql` |
| `registrar_put_section` | `auth.uid()`, `private.registration_registrar` | `20260929300000_registration_transaction.sql` |
| `registrar_put_term` | `auth.uid()`, `private.registration_registrar` | `20260929300000_registration_transaction.sql` |
| `request_approval` | `auth.uid()`, `private.has_capability` | `20260929110000_console_approvals_and_break_glass.sql` |
| `restore_school` | `private.offboarding_operator` | `20260930200000_school_offboarding.sql` |
| `retire_escalation_agreement` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `review_break_glass` | `auth.uid()`, `private.holds_seat` | `20260929110000_console_approvals_and_break_glass.sql` |
| `revoke_school_membership` | `private.has_capability` | `20260930185000_school_membership_enforcement.sql` |
| `save_escalation_agreement` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `school_enforcement_readiness` | `private.is_app_admin`, `private.has_capability` | `20260930185000_school_membership_enforcement.sql` |
| `school_purge_eligibility` | `private.is_app_admin`, `private.has_capability` | `20260930200000_school_offboarding.sql` |
| `school_requests_for_admin` | `private.has_capability` | `20260930185000_school_membership_enforcement.sql` |
| `set_member_capabilities` | `private.org_can` | `20260921230000_organizations.sql` |
| `set_member_standing` | `auth.uid()`, `private.org_can` | `20260921230000_organizations.sql` |
| `set_school_enforcement` | `private.is_app_admin` | `20260930185000_school_membership_enforcement.sql` |
| `support_reply` | `private.support_agent` | `20261003120000_support_notification_consent_boundary.sql` |
| `support_ticket_queue` | `private.support_agent` | `20260928210000_support_tickets.sql` |
| `support_ticket_thread` | `private.support_agent` | `20260928210000_support_tickets.sql` |
| `verify_offboarding_export` | `private.offboarding_operator` | `20260930200000_school_offboarding.sql` |

### integration (6)

| Function | Gates in its body | Defined in |
| --- | --- | --- |
| `adopt_lti_identity` | `auth.uid()` | `20260921160100_lti_identity.sql` |
| `gradebook_queue_passback` | `auth.uid()`, `private.gradebook_require`, `public.kill_switch_engaged('kill.writeback', school)`, `e.status = 'released'` | `20260929310000_gradebook.sql` |
| `integration_approve_connection` | `auth.uid()`, `private.has_capability` | `20260927170000_integration_control_plane.sql` |
| `integration_approve_scope` | `auth.uid()`, `private.has_capability` | `20260927170000_integration_control_plane.sql` |
| `integration_request_replay` | `auth.uid()`, `private.has_capability` | `20260927170000_integration_control_plane.sql` |
| `integration_set_paused` | `private.has_capability` | `20260927170000_integration_control_plane.sql` |

### financial (3)

| Function | Gates in its body | Defined in |
| --- | --- | --- |
| `dining_cancel_order` | `auth.uid()`, `private.dining_caller_school`, `private.has_capability` | `20260929330000_dining.sql` |
| `dining_place_order` | `auth.uid()`, `private.dining_caller_school`, `private.dining_charge_gate` | `20260929330000_dining.sql` |
| `request_cancellation` | `auth.uid()` | `20260929070000_commercial_core.sql` |

### moderation (15)

| Function | Gates in its body | Defined in |
| --- | --- | --- |
| `approve_community_pseudonymity` | `private.has_capability` | `20260928032000_community.sql` |
| `case_author_safety` | `private.has_capability` | `20260928032000_community.sql` |
| `community_reviewer_standing` | `private.has_capability` | `20260928032000_community.sql` |
| `decide_alias_identity` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `decide_community_appeal` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `decide_community_case` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `decide_community_escalation` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `manage_volunteer` | `private.has_capability` | `20260928032000_community.sql` |
| `moderate_opportunity` | `private.has_capability` | `20260928110700_consent_and_moderation_narrowing.sql` |
| `request_alias_identity` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `request_community_escalation` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `reveal_alias_identity` | `auth.uid()`, `private.has_capability` | `20260928032000_community.sql` |
| `volunteer_decide` | `auth.uid()`, `private.volunteer_ready` | `20260928032000_community.sql` |
| `volunteer_next_tasks` | `auth.uid()`, `private.volunteer_ready` | `20260928032000_community.sql` |
| `volunteer_roster` | `private.has_capability` | `20260928032000_community.sql` |

### read-helper (28)

| Function | Gates in its body | Defined in |
| --- | --- | --- |
| `available_supporters` | `auth.uid()` | `20260925160000_support_access_ui.sql` |
| `beta_invitation_for_me` | `auth.uid()`, `private.beta_confirmed_email` | `20260928220000_private_beta.sql` |
| `beta_known_issues_for_me` | `private.beta_my_membership` | `20260928220000_private_beta.sql` |
| `community_session_counts` | `private.community_role` | `20260928032000_community.sql` |
| `connected_with` | `auth.uid()` | `20260922003000_connections.sql` |
| `kill_switch_engaged` | `k.tenant_id is null or k.tenant_id = want_tenant` | `20260927170000_integration_control_plane.sql` |
| `mutual_connections` | `auth.uid()` | `20260922003000_connections.sql` |
| `my_action_publish_scopes` | `auth.uid()` | `20260928302000_office_action_feed.sql` |
| `my_age_status` | `auth.uid()` | `20260929150000_minimum_age.sql` |
| `my_beta` | `private.beta_my_membership` | `20260928220000_private_beta.sql` |
| `my_capabilities` | `auth.uid()` | `20260928010000_my_capabilities.sql` |
| `my_community_notices` | `auth.uid()` | `20261004130000_community_appeal_window.sql` |
| `my_community_refs` | `auth.uid()` | `20260928032000_community.sql` |
| `my_community_standing` | `auth.uid()` | `20260928032000_community.sql` |
| `my_course_studio_courses` | `auth.uid()` | `20260928309000_course_studio.sql` |
| `my_demand_scopes` | `auth.uid()` | `20260928305000_course_demand_forecasting.sql` |
| `my_dining_balances` | `auth.uid()`, `private.dining_caller_school` | `20260929330000_dining.sql` |
| `my_entitlements` | `auth.uid()` | `20260929070000_commercial_core.sql` |
| `my_help_destinations` | `private.has_capability` | `20260928030000_help_inbox_closed_history.sql` |
| `my_moderation_access` | `private.has_capability` | `20260928000000_moderation_queue_access.sql` |
| `my_registration` | `auth.uid()`, `private.school_of` | `20260929300000_registration_transaction.sql` |
| `my_registration_hold` | `auth.uid()`, `private.school_of` | `20260929300000_registration_transaction.sql` |
| `my_support_email_notices` | `auth.uid()` | `20261002003000_support_notification_outbox.sql` |
| `my_support_thread` | `auth.uid()` | `20260928210000_support_tickets.sql` |
| `my_support_tickets` | `auth.uid()` | `20260928210000_support_tickets.sql` |
| `my_volunteer_standing` | `auth.uid()` | `20260928032000_community.sql` |
| `office_action_programs` | `auth.uid()` | `20260928302000_office_action_feed.sql` |
| `referral_standing` | `auth.uid()` | `20260921002623_referrals.sql` |

## Policy-less tables

`private-internal`: in `private`, which PostgREST does not expose. `server-only`: in `public` with every client privilege revoked, reached only through a definer function above or an Edge Function holding the service key.

| Table | Disposition | Written by |
| --- | --- | --- |
| `private.account_ages` | private-internal | the sign-up age trigger and state_my_age (20260929150000_minimum_age.sql) |
| `private.ai_usage_month` | private-internal | the AI gateway meter |
| `private.ai_usage_reservation` | private-internal | the AI gateway meter |
| `private.approved_source_content` | private-internal | the intelligence gateway |
| `private.console_audit_key` | private-internal | the console audit chain |
| `private.console_audit_manifest` | private-internal | the console audit chain |
| `private.console_audit_verification` | private-internal | the console audit integrity job |
| `private.direct_rate_limit` | private-internal | the direct rate-limit trigger |
| `private.domain_event_receipts` | private-internal | the domain outbox consumer |
| `private.domain_outbox_events` | private-internal | the domain outbox |
| `private.gateway_audit` | private-internal | the university gateway |
| `private.gateway_health_probe` | private-internal | the university gateway |
| `private.gateway_intelligence_action` | private-internal | the intelligence gateway |
| `private.gateway_intelligence_audit` | private-internal | the intelligence gateway |
| `private.gateway_rate_limit` | private-internal | the university gateway |
| `private.gateway_review` | private-internal | the university gateway |
| `private.integration_simulation_runs` | private-internal | the sync simulation sandbox |
| `private.site_lead_hits` | private-internal | submit_site_lead rate limiting |
| `public.access_gate` | server-only | the invite-gate definer functions (20260921002428_invites.sql) |
| `public.app_admins` | server-only | the service key; read by private admin helpers |
| `public.beta_cohorts` | server-only | the beta_* definer functions |
| `public.beta_exit_requests` | server-only | the beta_* definer functions |
| `public.beta_feature_flags` | server-only | the beta_* definer functions |
| `public.beta_feedback` | server-only | the beta_* definer functions |
| `public.beta_invitations` | server-only | the beta_* definer functions |
| `public.beta_known_issues` | server-only | the beta_* definer functions |
| `public.beta_memberships` | server-only | the beta_* definer functions |
| `public.beta_programs` | server-only | the beta_* definer functions |
| `public.community_media_deletions` | server-only | the private.queue_media_deletion trigger |
| `public.community_safety_entries` | server-only | the community moderation functions |
| `public.gtm_communication_events` | server-only | the GTM Edge Functions, holding consent-bearing contact data |
| `public.gtm_consent` | server-only | the GTM Edge Functions, holding consent-bearing contact data |
| `public.gtm_conversion_events` | server-only | the GTM Edge Functions, holding consent-bearing contact data |
| `public.gtm_prospects` | server-only | the GTM Edge Functions, holding consent-bearing contact data |
| `public.gtm_suppression` | server-only | the GTM Edge Functions, holding consent-bearing contact data |
| `public.invites` | server-only | the invite functions |
| `public.lti_identity` | server-only | the LTI launch function and adopt_lti_identity |
| `public.lti_line_item` | server-only | the LTI AGS function |
| `public.lti_link_ticket` | server-only | the LTI launch function |
| `public.lti_nonce` | server-only | the LTI launch function |
| `public.lti_platform` | server-only | the LTI launch function |
| `public.payment_events` | server-only | the verified Stripe webhook |
| `public.registration_completions` | server-only | the registration definer functions (20260929300000_registration_transaction.sql) |
| `public.registration_holds` | server-only | the registration definer functions (20260929300000_registration_transaction.sql) |
| `public.registration_requests` | server-only | the registration idempotency ledger, private.registration_replay and registration_commit |
| `public.scim_credential` | server-only | the SCIM gateway |
| `public.site_leads` | server-only | submit_site_lead, called by the lead-intake Edge Function with the service key |
| `public.support_ticket_messages` | server-only | the support ticket functions |
| `public.support_tickets` | server-only | the support ticket functions |

## Both briefs, item by item

Read against main on 2026-09-29. `held` cites a test or check that guards it; `partial` cites what exists and names what does not; `owed` cites only prose. A01–A20 are the architecture brief's twenty priorities; B01–B15 are the audit's named artifacts and remediation items. held 7, partial 28, owed 0.

| ID | Item | Status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| A01 | A formal architecture map: layers, and per module an owner, source of truth, classification, APIs and events, flags, dashboards and failure behaviour | partial | `docs/ARCHITECTURE.md`<br>`docs/UNIVERSITY-OS-ARCHITECTURE.md`<br>`app/src/lib/governance/charters.ts`<br>`app/src/lib/governance/charters.test.ts` | Layer maps and per-module charters exist; no single map gives each module all of those fields together. |
| A02 | Domain boundaries with explicit APIs and prohibited cross-domain access | partial | `docs/architecture/0003-no-application-server.md`<br>`app/server/institution/gateway.ts`<br>`packages/institution/src/index.ts` | No document names the bounded contexts and their owners, and no lint rule or test forbids a cross-domain import or table read. |
| A03 | A canonical data model with standard metadata on every object | partial | `supabase/migrations/20260927170000_integration_control_plane.sql`<br>`supabase/integration-control-plane.check.sql`<br>`app/src/lib/integration/catalog.ts`<br>`packages/contract/src/index.ts` | canonical_entity_references carries tenant, source, classification and freshness, but not version or retention policy, and the domain tables carry none of it. |
| A04 | Source lineage everywhere: a Source Card and one set of source states | partial | `app/src/components/SourceBadge.tsx`<br>`app/src/components/SourceBadge.test.tsx`<br>`app/src/lib/source.test.ts` | A source badge exists; no Source Card shows the record and its sync time, and two trust vocabularies are still in use. |
| A05 | Reconciliation and drift detection | partial | `app/src/lib/integration/drift.ts`<br>`app/src/lib/integration/reconcile.ts`<br>`app/src/lib/integration/quality.test.ts`<br>`supabase/migrations/20260928040000_integration_quality.sql` | Drift detection, reconciliation reports and mapping versions are tested; there is no quarantine queue or review workflow for held records. |
| A06 | A connector framework with one contract and lifecycle | partial | `app/src/lib/integration/adapter.ts`<br>`app/server/integration/registry.ts`<br>`app/server/integration/registry.test.ts` | The contract and registry exist but the registry holds mocks only, and connection status is an enum with no enforced state machine. |
| A07 | Graceful degradation when a source is stale, unavailable or revoked | partial | `app/src/lib/integration/freshness.ts`<br>`app/src/lib/integration/pipeline.test.ts` | Freshness classes exist; no screen defines its fallback for each state. |
| A08 | Policy as code: RBAC, ABAC, object-level authorization, a permission simulator, default deny | partial | `packages/institution/src/policy.ts`<br>`packages/institution/src/policy.test.ts`<br>`app/src/lib/governance/policysim.ts`<br>`supabase/rls-coverage.check.sql`<br>`supabase/grants.check.sql` | A default-deny decision point, a simulator and RLS exist; routes adopt the decision point gradually (ADR 0007) and flags are evaluated on the client. |
| A09 | Privacy operations: export, deletion, consent revocation, a request workflow | partial | `supabase/migrations/20260929010000_account_erasure_and_export.sql`<br>`supabase/deletion.check.sql`<br>`app/src/lib/erasure.test.ts` | Self-service export and erasure are tested; there is no data-subject-request queue with verification and a deadline. |
| A10 | A security programme: threat modelling, secret and dependency scanning, SBOM, branch protection, incident response, disclosure | partial | `.github/workflows/ci.yml`<br>`SECURITY.md`<br>`app/src/lib/supplychain.test.ts`<br>`app/src/lib/branchprotection.test.ts` | All present except a platform-wide threat model; the dependency audit is non-blocking by a decision recorded in ci.yml. |
| A11 | Observability across frontend, backend, queues, auth and sync | partial | `MONITORING.md`<br>`supabase/health.sql`<br>`.github/workflows/production-smoke.yml` | Database health queries and synthetic probes only; no frontend error capture, latency, queue or sync telemetry in the tree. |
| A12 | Service objectives | partial | `app/src/lib/governance/error-budgets.ts`<br>`app/src/lib/governance/error-budgets.test.ts`<br>`docs/operating-model/SLOS-AND-ERROR-BUDGETS.md` | Journey SLOs and error budgets are defined and held; no indicator is measured against them. |
| A13 | Resilience: queues, idempotency, dead letters, circuit breakers, rate limits, kill switches, offline | partial | `app/src/lib/integration/retry.ts`<br>`supabase/functions/_shared/killswitch.ts`<br>`app/src/lib/aikillswitch.test.ts`<br>`app/src/lib/offline-mode.test.ts` | No circuit breaker, no general job queue or retry console. |
| A14 | A design-system package with accessibility and visual regression tests | partial | `app/src/styles/tokens.css`<br>`app/src/styles/tokens.test.ts`<br>`app/src/a11y/axe.test.tsx` | Tokens and axe tests exist; no separate package, component catalogue or visual regression. |
| A15 | A platform event bus with a standard envelope | partial | `packages/institution/src/events.ts`<br>`packages/institution/src/events.test.ts`<br>`supabase/outbox.check.sql`<br>`docs/architecture/0008-event-envelope-and-outbox.md` | The envelope and outbox are tested; no producer writes to the outbox and no publisher runs. |
| A16 | First-class feature flags | partial | `app/src/lib/flags.ts`<br>`app/src/lib/flags.test.ts`<br>`docs/FEATURE-FLAG-REGISTRY.md` | Owner, review date, expiry, kill switch, tenant and role scope exist; no cohort scope, and evaluation is client-side. |
| A17 | Tests by risk: tenant isolation, contracts, critical journeys, accessibility, visual, load | partial | `supabase/integration-rls-matrix.check.sql`<br>`supabase/tenancy.check.sql`<br>`app/scripts/golden-path.mjs`<br>`app/src/a11y/axe.test.tsx` | No visual regression or load tests. |
| A18 | Performance budgets | partial | `app/src/lib/perfbudget.ts`<br>`app/src/lib/perfbudget.test.ts`<br>`app/perf-budgets.json`<br>`docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md` | Bundle budgets are a CI gate: first load, each of 90 screens and the largest file, in gzip bytes, set from a measurement. The first load they were set from is 395 KB, well above common mobile guidance, and nothing measures Core Web Vitals in the field yet. |
| A19 | The console as an operations command centre | partial | `app/src/screens/Console.tsx`<br>`app/src/screens/console.test.tsx`<br>`app/src/lib/ops/console.ts` | Approvals, break-glass, audit and figures exist; no integration-health, flag-status, permission-simulator or data-request tabs. |
| A20 | A safe sandbox tenant | partial | `app/server/institution/sandbox.ts`<br>`app/server/institution/sandbox.test.ts`<br>`docs/SYNC-SIMULATION-SANDBOX.md` | A fictional-institution sandbox exists; no sandbox tenant with role switching and no promotion path. |
| B01 | THREAT-MODEL | partial | `docs/INTEGRATION-THREAT-MODEL.md`<br>`docs/ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md` | Integration and AI-toolkit threat models only; no platform-wide one. |
| B02 | DATA-INVENTORY | partial | `supabase/migrations/20260929010000_account_erasure_and_export.sql`<br>`app/src/lib/governance/pia.ts`<br>`app/src/lib/governance/pia.test.ts`<br>`RETENTION.md` | account_data_map, the PIA register and the retention schedule exist; no inventory of every table and field with its classification. |
| B03 | INTEGRATION-CATALOG | held | `app/src/lib/integration/catalog.ts`<br>`app/src/lib/integration/catalog.test.ts` | catalog.ts is the catalogue and catalog.test.ts holds its four constrained lists to the database, value for value; there is no separate prose document, and freshness and the sync classes have no constraint to hold them to. |
| B04 | RISK-REGISTER | held | `app/src/lib/governance/risk.ts`<br>`app/src/lib/governance/risk.test.ts`<br>`docs/operating-model/RISK-GOVERNANCE.md` | - |
| B05 | CI checks: secrets, dependencies, migrations, types, tests, RLS regression | held | `.github/workflows/ci.yml`<br>`.gitleaks.toml`<br>`supabase/check.sh`<br>`supabase/rls-coverage.check.sql`<br>`app/src/lib/definerregister.test.ts` | The dependency audit annotates rather than fails, by the decision in ci.yml. |
| B06 | Severity levels and incident response | held | `SECURITY.md`<br>`app/src/lib/security.test.ts` | - |
| B07 | Production and staging separation | partial | `STAGING.md`<br>`app/src/lib/environment.ts`<br>`app/src/lib/environment.test.ts` | Environments are told apart at build time and previews exist; no standing staging environment shown to match production. |
| B08 | A release gate in the pull-request template | held | `.github/pull_request_template.md`<br>`app/src/lib/ops/operatingsystem.test.ts` | - |
| B09 | Rate limits on forms, sign-in, AI and invites | partial | `supabase/migrations/20260928230000_direct_rate_limits.sql`<br>`supabase/rate-limits.check.sql`<br>`app/server/institution/rate-limit.test.ts` | Sign-in limits are Supabase Auth defaults outside the tree; invite creation has no explicit limit. |
| B10 | Consent and sharing-expiry enforcement | held | `supabase/supportshares.check.sql`<br>`supabase/support-access.check.sql`<br>`supabase/familyshare.check.sql` | - |
| B11 | Standard audit events for login, privilege, share, export, delete, integration, AI | partial | `supabase/migrations/20260928320000_audit_correlation_and_outbox.sql`<br>`supabase/role-grant-audit.check.sql`<br>`supabase/gateway-journal.check.sql` | Separate audit tables with no single schema; sign-ins and shares are not in a common trail. |
| B12 | Webhook intake: signatures, idempotency, replay protection, dead letters | partial | `supabase/functions/_shared/billingwebhook.ts`<br>`app/src/lib/billing/webhook.test.ts`<br>`supabase/integration-hardening.check.sql` | Billing verifies signature, age and idempotency; no inbound integration endpoint exists yet, and billing has no dead letter. |
| B13 | Restore drills and rollback | held | `supabase/restore.sh`<br>`RESTORE.md`<br>`ROLLBACK.md`<br>`app/src/lib/rehearsal.test.ts` | The production restore drill has not run (D-126). |
| B14 | Load and capacity tests | partial | `supabase/load.sh`<br>`supabase/load/run.sh`<br>`supabase/load/sync-open.pgbench.sql`<br>`supabase/load/sync-push.pgbench.sql`<br>`supabase/load/sync-same-student.pgbench.sql`<br>`docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md` | A CI gate for the database: registration-week reads and plan saves, and the open and sync every student makes, each against a latency budget, with invariants after (no lost update when two devices push, no plan counted twice). The database only: PostgREST, Supavisor, GoTrue and the network are the preview-branch run still owed, and assessment and gradebook have no load because they do not exist. |
| B15 | A quarterly architecture review | partial | `docs/operating-model/RISK-GOVERNANCE.md`<br>`docs/operating-model/OPERATING-RHYTHM.md` | A monthly review board is defined without named members; no review is recorded. This register's next review is quarterly. |

## Open

| ID | Severity | State | What | What closes it |
| --- | --- | --- | --- | --- |
| DR-01 | low | open | `kill_switch_engaged(switch, tenant)` answers for any tenant, where the read policy on `feature_kill_switch` shows a signed-in account only the platform-wide rows, its own school's and those it holds `integration:view` over. The one bit it discloses is whether another school has a named switch engaged. `grants.check.sql` records it as deliberate: one boolean, no row. It is the only one of the 180 whose body names neither `auth.uid()` nor a `private.` gate (checked on production, 30 September). | Not by revoking `EXECUTE` from `authenticated`, as the 30 September reconciliation first considered: production has three callers that run with the signed-in caller's rights, not the owner's — `public.effective_module_modes`, `private.gtm_placement_guard` and `private.gtm_send_guard` (SECURITY INVOKER) — and each would fail for every signed-in user. Scope the answer to the policy's tenants for a client caller, and give those three a definer wrapper first, or accept the disclosure in SECURITY.md. The definer callers (`tenant_plan`, `tenant_sso_policy`, the LTI entitlement facts, the trust room) run as the owner and are unaffected either way. |
| DR-02 | medium | closed by `supabase/definer-sweep.check.sql` | The gates here are structural: this register proves each check is present in the body, not that it is correct. Behaviour is proved per function by the `supabase/*.check.sql` suites, and not every one of the 151 had a suite that calls it as a second account. | Closed by `supabase/definer-sweep.check.sql`: a signed-in account holding nothing calls every callable definer function with neutral arguments and must be refused or told nothing, except seventeen that act only on the caller's own account, each named with the answer it may give; a victim's id, email, referral code and ticket may appear in no answer. Shown red on a function stripped of its owner filter, a self-service function taken off the list and a stale list entry; two planted probes are named on every run. Left to the feature suites: a caller holding a real id of somebody else's object, which neutral arguments cannot name. |
| DR-03 | low | open | The 49 tables are pinned to the reading of 30 September (45 on 29 September, and the four that arrived between). A table that gains or loses its last policy through a `format()` loop is not noticed here. `supabase/advisor-reconciliation.check.sql` now asks the schema directly whether any table with row-level security and no policy is open to a client role, which is the fact that makes the notice benign; what it cannot see is a table whose policy count changes by a loop, or whether its intended writer exists. | Re-read the advisor at each quarterly architecture review and compare; or move the loops' table lists into data the test can read. |
| DR-04 | low | open | `anon` holds table privileges it cannot use on 26 `public` tables, found by the 30 September reading: INSERT, UPDATE, DELETE and TRUNCATE on the caller-owned tables (`appointments`, `blocks`, `calendar_feeds`, `courses`, `enrollments`, `family_grants`, `group_members`, `group_tasks`, `groups`, `message_reactions`, `messages`, `notes`, `push_devices`, `push_queue`, `referral_codes`, `referrals`, `schools`, `sittings`, `state`, `tasks`, `usage`, and a part of `form_responses`, `organizations`, `organization_members`, `profiles`, `reports`). Supabase's default privileges grant them. All 26 have row-level security on, and every policy that could let `anon` write requires `auth.uid()` or an admin/capability check except one: `answer an open form` on `form_responses`, which lets anyone answer a form its owner opened, and is deliberate (`20260921143455_forms.sql`). So nothing is exposed today. TRUNCATE is not subject to row-level security, but PostgREST has no verb for it. | Revoke INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER from `anon` on those tables, keeping INSERT on `form_responses`, and extend `supabase/grants.check.sql`, which asks about function `EXECUTE` and not about table privileges, to hold the rule. Not done in the 30 September reconciliation: it is a grant change across twenty-six core-app tables that the advisor did not flag, and wants its own review. |
