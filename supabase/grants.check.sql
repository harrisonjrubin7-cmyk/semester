-- Which functions a client may call at all.
--
-- Every other suite here asks what a signed-in account may *read*. This one
-- asks something a policy cannot answer: whether the function is reachable
-- from the browser in the first place. A `security definer` function runs as
-- its owner, so row-level security is not what stops a caller — the EXECUTE
-- grant is the only thing that does, and until this file existed nothing
-- checked it as a whole.
--
-- ## Why it is a whole-schema allowlist and not a list of cases
--
-- The fault it guards against is an omission, and a suite made of cases can
-- only catch the omissions somebody thought of. Supabase grants EXECUTE on
-- every new function in `public` to `anon` and `authenticated` explicitly, as
-- it is created — see `local.stub.sql`, which now models that — so the next
-- migration to add a function ships it **reachable by a signed-out visitor
-- unless its author remembers otherwise**. A list of named cases would stay
-- green through exactly that.
--
-- So the question is asked in the other direction: every function in `public`
-- that a client can call must be one this file names. A new one is a failure
-- until somebody decides which side of the line it belongs on, and writes it
-- down here.
--
-- That is not a hypothetical shape of bug. `20260921002428_invites.sql` was
-- applied to the live project on 21 September 2026 and `set_invite_only`
-- landed with `anon=X`: anybody holding the publishable key could have turned
-- the pilot's invite gate on or off. `20260921144011_function_grants.sql` is
-- the fix; this file is the reason the next one cannot happen quietly.
--
--   How to run it: supabase/check.sh grants

begin;

/**
 * Whether a function came with an extension rather than with this repository.
 *
 * `local.stub.sql` installs pgcrypto into `public`, because a bare Postgres
 * has no `extensions` schema and the suites need `gen_random_uuid()`. A real
 * project puts it in `extensions`, so its forty-odd functions are in `public`
 * *here and nowhere else* — and they arrive with the same default grants
 * everything else does.
 *
 * Reporting them would be the loudest possible false positive: forty names
 * this repository did not write, did not grant and cannot revoke without
 * breaking the extension, printed on every run until somebody stopped reading
 * the output. What is left after this filter is the set this directory is
 * actually responsible for.
 */
create or replace function pg_temp.from_extension(fn oid)
returns boolean language sql stable as $$
  select exists (
    select 1 from pg_depend d
     where d.objid = fn and d.classid = 'pg_proc'::regclass and d.deptype = 'e'
  );
$$;

/**
 * Every function in `public` a given role may execute.
 *
 * `prokind = 'f'` so that aggregates, window functions and procedures are not
 * counted as things a PostgREST client calls, and the identity arguments are
 * included because two overloads are two decisions.
 */
create or replace function pg_temp.callable(who text)
returns text language sql stable as $$
  select string_agg(fn, ', ' order by fn) from (
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not pg_temp.from_extension(p.oid)
       and has_function_privilege(who, p.oid, 'execute')
  ) t;
$$;

-- ── First, that this harness still models the grant at all ────────────────
--
-- The control for everything below, and without it this is the most
-- comfortable file in the directory: with no default privileges in place, no
-- function is granted to anybody, every sweep below passes, and the suite
-- reports a schema it has proved nothing about. That is the exact shape
-- `CLAUDE.md` keeps finding — a probe answering a narrower question than the
-- one being asked — and here it would be answering *no* question.
--
-- So the first thing checked is the stub, not the schema. If
-- `local.stub.sql` stops setting the default privileges Supabase sets, this
-- goes red and says why, rather than going green and meaning nothing.

do $$
declare modelled boolean;
begin
  select exists (
    select 1 from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
     where n.nspname = 'public' and d.defaclobjtype = 'f'
       and array_to_string(d.defaclacl, ',') like '%anon=X%'
  ) into modelled;

  if not modelled then
    raise exception 'FAILED: no default EXECUTE grant to anon on functions in public — '
      'local.stub.sql has stopped modelling Supabase, so every check below is vacuous';
  end if;
  raise notice 'ok  the harness grants functions the way Supabase does';
end $$;

-- ── A signed-out visitor reaches nothing ──────────────────────────────────
--
-- The strongest half, and the one that was false in production. `anon` is the
-- role the publishable key maps to, and that key is in the page source of a
-- static site: everybody has it.

do $$
declare reachable text;
begin
  reachable := pg_temp.callable('anon');
  if reachable is not null then
    raise exception 'FAILED: a signed-out visitor can call %', reachable;
  end if;
  raise notice 'ok  no function in public is callable by a signed-out visitor';
end $$;

-- ── A signed-in account reaches only what it is meant to ──────────────────

do $$
declare
  /*
   * The allowlist. Each is a deliberate entry point, among them:
   *   make_referral_code  — mints this account's own code
   *   claim_referral      — records that this account arrived on somebody's
   *   referral_standing   — two integers and a boolean about the caller
   *   note_activity       — the caller says which of three things are true of
   *                         it today. It is here rather than behind the
   *                         service key because the caller is a browser, and
   *                         it is safe to be here because it takes neither an
   *                         account nor a date: `activity.check.sql` holds
   *                         that signature structurally, which is the only
   *                         thing standing between this entry and handing the
   *                         table to anybody with the publishable key.
   *   accept_family_grant — the recipient of a family grant accepts it, which
   *                         is the one write they have on `family_grants`;
   *                         `authenticated` only, never `anon`
   *   adopt_lti_identity  — attaches a Brightspace launch to the caller's own
   *                         account. Callable by a signed-in account *because*
   *                         that is half the security argument: it needs a
   *                         launch ticket the server minted AND a session the
   *                         caller proved, and neither alone will move an
   *                         account. See 20260921160100_lti_identity.sql.
   *
   * Adding a line here is the decision. If a new function needs to be callable
   * it belongs in this array with its own migration granting it; if it does
   * not, the migration revokes it and this array does not change.
   */
  allowed constant text[] := array[
    'accept_family_grant(grant_id uuid)',
    'adopt_lti_identity(want_ticket text)',
    -- The share-code pair from 20260928306000_family_invites.sql. Minting is
    -- how a student writes to a table with no insert policy; claiming is how
    -- somebody holding eight characters turns them into accepted grants.
    'claim_family_invite(given text)',
    'claim_referral(given text)',
    'make_referral_code()',
    'make_family_invite(want_categories text[], want_access text, want_resources text[], want_days integer)',
    -- 20260928307000_family_shared_items.sql: a code and the confirmed copies
    -- of what it names, in one transaction; and the supporter's one read path,
    -- which re-checks every grant and logs the read.
    'make_family_share(want_categories text[], want_resources text[], want_days integer, want_items jsonb, want_shown_as text)',
    'read_family_share()',
    -- 20261009230000_guardian_projection_foundation.sql: an online-only,
    -- minimized calendar read that rechecks a verified guardian link and the
    -- student's exact live consent before recording the decision. The second
    -- entry returns only the caller-student's bounded access history.
    'read_guardian_calendar_projection(wanted_student uuid, wanted_purpose text)',
    'read_guardian_projection_access_history()',
    -- 20260928308000_support_shares.sql: an athlete shares with one person
    -- holding athletic_academic_support at their school; staff list and read
    -- through functions that re-check that role on every call and log reads.
    'share_with_support(staff_email text, share_payload jsonb, share_expires timestamp with time zone)',
    'list_support_shares()',
    'read_support_share(want_share uuid)',
    'note_activity(marks text[])',
    'referral_standing()',
    -- 20260929150000_minimum_age.sql: an account that never stated an age
    -- states it once, and reads back only its standing, never a date.
    'state_my_age(want_birth_date date)',
    'my_age_status()',
    -- Both are security-invoker reads. Their table RLS remains the boundary:
    -- a caller can resolve only policy rows from their verified school.
    'effective_ai_policy(want_tenant text, want_user uuid)',
    'feature_state(want_capability text, want_tenant text)',
    -- 20260929340000_feature_cohorts.sql: security invoker, no user parameter;
    -- it answers for the caller from rows their own RLS already shows them.
    'feature_cohort_allows(want_capability text, want_tenant text)',
    -- 20260929370000_feature_policy_narrowing.sql: security invoker, no user
    -- parameter; a flag's role and cohort lists and which of them the caller
    -- holds, from the rows the caller's own RLS shows it.
    'feature_narrowing(want_capability text, want_tenant text)',
    -- A student-created, seven-day maximum grant is checked again on every
    -- aggregate support read. The deletion helper removes grants where the
    -- caller was either side; immutable pseudonymous events remain.
    'forget_my_support_access()',
    'read_support_signals(want_grant uuid)',
    -- The student surface resolves only verified same-school supporters,
    -- creates consent and its bounded grant atomically, and lists only windows
    -- in which the caller is the student or the still-authorized supporter.
    'available_supporters()',
    'available_case_supporters()',
    'create_support_access(want_supporter uuid, want_reason text, want_days integer, want_ticket uuid)',
    'read_support_case_signals(want_ticket uuid)',
    'revoke_support_access(want_grant uuid)',
    'support_access_windows()',
    'support_case_access(want_ticket uuid)',
    -- Sets `profiles.school_id` from the address the server confirmed. The
    -- column's own UPDATE privilege is revoked from both API roles, so this
    -- function is the only way in and has to be callable by a signed-in
    -- account. See 20260921170000_schools.sql.
    'claim_school(want text)',
    -- Course rooms limited to one university (20260930180000). Each is gated
    -- inside its body; `school-membership.check.sql` walks the refusals.
    'request_school_membership(want text, why text)',
    'withdraw_school_request(req uuid)',
    'decide_school_request(req uuid, approve boolean, why text)',
    'leave_school()',
    'revoke_school_membership(target uuid, why text)',
    'school_enforcement_readiness(want text)',
    'school_requests_for_admin(want text)',
    'set_school_enforcement(want text, on_ boolean, acknowledge_locked_out integer)',
    -- A school leaves in steps (20260930200000). Each is gated inside its body;
    -- `school-offboarding.check.sql` walks the refusals.
    'propose_offboarding(want_school text, why text, as_side text)',
    'offboarding_preflight(want uuid)',
    'approve_offboarding(want uuid)',
    'cancel_offboarding(want uuid, why text)',
    'record_offboarding_notice(want uuid, given_on date)',
    'disable_school_access(want uuid)',
    'record_offboarding_export(want uuid, manifest_sha256 text, counts jsonb, delivered_to text)',
    'verify_offboarding_export(want uuid)',
    'archive_school(want uuid, retain_days integer)',
    'restore_school(want uuid, why text)',
    'school_purge_eligibility(want uuid)',
    'authorize_school_purge(want uuid, why text)',

    /*
     * Community (20260928032000_community.sql). Seventeen, because every write
     * to a community table goes through one: members never learn another
     * member's account id, so posting, blocking and reporting have to resolve
     * it server-side; triage runs inside the report; and decisions and
     * appeals check `community:review`, seniority and reviewer independence
     * before they touch anything; `community_reviewer_standing` and
     * `my_community_refs` answer only for the caller, and
     * `forget_my_community` removes only the caller's rows. `community.check.sql` attempts each refusal
     * as the account that should be refused.
     */
    'appeal_community_decision(want_post uuid)',
    'block_community_author(want_post uuid)',
    'community_reviewer_standing()',
    'community_session_counts(want_community uuid)',
    'create_community(want_kind text, want_name text, want_purpose text, want_integrity_policy text)',
    'create_community_post(want_community uuid, want_body text, want_confirmed_own boolean, want_as_alias boolean, want_media uuid)',
    'create_study_session(want_community uuid, want_venue uuid, want_title text, want_starts timestamp with time zone, want_ends timestamp with time zone, want_capacity integer)',
    'decide_community_appeal(want_case uuid, want_uphold boolean, want_reason text)',
    'decide_community_case(want_case uuid, want_action text, want_reason text)',
    'delete_community_post(want_post uuid)',
    'edit_community_post(want_post uuid, want_body text, want_confirmed_own boolean)',
    'forget_my_community()',
    'join_community(want_community uuid)',
    'join_study_session(want_session uuid)',
    'my_community_notices()',
    'my_community_refs()',
    'report_community_post(want_post uuid, want_category text, want_imminent boolean, want_details text)',

    /*
     * Scoped pseudonyms and volunteer moderation. Eight, and every one first
     * asks community_programs whether that school has switched the programme
     * on — a row only the service role can write — so at every school today
     * each of them refuses. The volunteer functions then check eligibility,
     * training, agreements, calibration status, caps and recusal before they
     * hand out or accept anything; manage_volunteer needs a senior reviewer.
     * community.check.sql attempts each refusal.
     */
    'apply_to_volunteer()',
    'approve_community_pseudonymity(want_community uuid, want_on boolean)',
    'claim_community_alias(want_community uuid, want_name text)',
    'manage_volunteer(want_volunteer uuid, want_action text, want_reason text)',
    'my_volunteer_standing()',
    'volunteer_attest(want_kind text)',
    'volunteer_decide(want_task uuid, want_action text, want_reason text)',
    'volunteer_next_tasks()',
    'volunteer_roster()',

    /*
     * Institution escalation and the private safety state, both off unless
     * the school's community_programs row says otherwise. An escalation needs
     * an agreement two senior staff recorded (section 14a), a P0 or P1 case in a covered
     * category, and two different reviewers; case_author_safety needs a
     * reviewer and a written reason, and logs every read;
     * my_community_standing answers in words for the caller alone.
     */
    'activate_escalation_agreement(want_tenant text, want_reason text)',
    'can_manage_escalation_agreements()',
    'retire_escalation_agreement(want_tenant text, want_reason text)',
    'save_escalation_agreement(want_tenant text, want_agreement_ref text, want_categories text[], want_identity_required boolean, want_channel text, want_contact text, want_expires_on date)',
    'begin_community_image(want_community uuid, want_kind text, want_alt text)',
    'case_author_safety(want_case uuid, want_reason text)',
    'decide_alias_identity(want_grant uuid, want_approve boolean, want_reason text)',
    'request_alias_identity(want_case uuid, want_reason text)',
    'reveal_alias_identity(want_grant uuid)',
    'decide_community_escalation(want_escalation uuid, want_approve boolean, want_reason text)',
    'my_community_standing()',
    'request_community_escalation(want_case uuid, want_reason text)',

    /*
     * The six ways into `organization_members`, and the reason there are six
     * rather than a policy. Both API roles are off INSERT, UPDATE and DELETE
     * on that table outright — it holds one person's rank as decided by
     * another, so there is no column a client may write and no row it may add.
     * Each of these asks what the caller is to that organization before it
     * writes anything, and `organizations.check.sql` attempts every refusal as
     * the account that should be refused.
     *
     * `start_organization` is also the only insert into `public.organizations`,
     * which has no insert policy: creating one and being its first
     * administrator have to be a single statement.
     *
     * `anon` is off all six. A signed-out visitor has no standing anywhere by
     * definition, and every one of them begins by asking what the caller's is.
     * See 20260921230000_organizations.sql.
     */
    'apply_to_organization(org uuid)',
    'follow_organization(org uuid, want boolean)',
    'leave_organization(org uuid)',
    'set_member_capabilities(org uuid, who uuid, want text[])',
    'set_member_standing(org uuid, who uuid, want text)',
    'start_organization(want_slug text, want_name text, want_about text)',

    /*
     * And the two that answer what happens when somebody stops existing.
     *
     * `forget_my_organizations` is the only delete path into
     * `organization_members` from a client, and it exists because there is no
     * other one: `lib/cloud.ts` empties an account by sending one filtered
     * DELETE per table, and DELETE on that table is revoked from both roles.
     *
     * `claim_abandoned_organization` is how an organization gets out of the
     * state the first one can leave it in. Callable by a signed-in account and
     * refused unless the caller is already a member of that organization and
     * nobody in it holds ADMIN. See 20260921234500_organization_succession.sql.
     */
    'claim_abandoned_organization(org uuid)',
    'forget_my_organizations()',

    -- The five in 20260922003000_connections.sql. `public.connections` is
    -- revoked from both API roles and has no write policy, so these are not a
    -- convenience over a table a signed-in account could otherwise reach —
    -- they are the only door, and each carries a rule a policy on an INSERT
    -- cannot express: the reverse request may already exist, either account
    -- may have blocked the other, and only the addressee may accept.
    --
    -- The two readers are here for the same reason and a narrower one: the
    -- select policy scopes the table to the two ends of an edge, and a mutual
    -- count is a question about pairs the caller is not in. They return a
    -- boolean and an integer, never a roster.
    'accept_connection(who uuid)',
    'connected_with(who uuid)',
    'mutual_connections(who uuid)',
    'remove_connection(who uuid)',
    'request_connection(who uuid)',

    -- The two in 20260926150000_expansion_roles_and_features.sql.
    -- `read_shared_accommodation` is the only way an instructor reads a
    -- passport: it checks the share is live and addressed to the caller, and
    -- writes an access event the student can see. `submit_course_review`
    -- writes a review and its separate authorship row in one statement, so
    -- the published review never carries who wrote it.
    'read_shared_accommodation(want_share uuid)',
    'submit_course_review(want_course text, want_term text, want_workload integer, want_difficulty integer, want_usefulness integer, want_body text)',

    -- The six in 20260927230000_help_requests.sql, and the only doors to
    -- `help_requests`: no API role holds INSERT, UPDATE or DELETE on it.
    -- A student sends, withdraws and forgets their own; staff holding
    -- `help_request:respond` for that destination list, open and answer,
    -- and every open writes an event the student reads.
    'answer_help_request(want uuid, want_status text, want_reply text)',
    'forget_my_help_requests()',
    'help_inbox(want_destination uuid)',
    -- 20260927230000's companion: which of those inboxes are the caller's.
    'my_help_destinations()',
    -- 20260928000000: the caller's own report:read and moderation:action, so
    -- the moderation screen can tell an empty queue from no queue.
    'my_moderation_access()',
    -- 20260928010000: the caller's own live capabilities, same predicate as
    -- private.has_capability, so staff screens can open for staff.
    'my_capabilities()',
    -- 20260929070000: click-to-cancel. The owner of an individual
    -- subscription ends it at the period end in one call, reason optional;
    -- cancelling must be as easy as signing up. Refuses anyone else's.
    'request_cancellation(want_subscription uuid, want_reason text)',
    -- 20260929070000: the caller's own entitlements, to show paid features.
    -- Presentation only; never consulted by a policy on student data.
    'my_entitlements()',
    -- 20260928021700: the only doors to `mentor_requests` — no API role holds
    -- insert, update or delete on it. Send to an offer the caller can see;
    -- the recipient accepts or declines, the requester withdraws, capacity is
    -- checked at acceptance; either end forgets every request they are in.
    'answer_mentor_request(want uuid, want_status text)',
    'forget_my_mentor_requests()',
    'request_mentor(want_kind text, want_recipient uuid, want_cohort text, want_name text, want_topics text[], want_note text)',
    -- 20260928110700: the only way a moderator touches a listing. Writes
    -- `status` alone (published or removed), for a caller holding
    -- opportunity:moderate; the moderator's unrestricted update policy is gone.
    'moderate_opportunity(want uuid, want_status text)',
    'open_help_request(want uuid)',
    'send_help_request(want_destination uuid, want_question text, want_context jsonb)',
    'withdraw_help_request(want uuid)',

    -- The five in 20260927170000_integration_control_plane.sql. The first four
    -- are the only way a connection's status or approval, a scope's approval,
    -- or a replay request moves: those columns are off the API roles' column
    -- grants, and each function checks its own capability over the row's
    -- school, refuses the unsafe case (self-approval, no reason, a replay under
    -- a kill switch) and is audited by trigger. `kill_switch_engaged` answers a
    -- boolean about a switch key and a school and returns no row.
    'integration_approve_connection(want_connection text, want_direction text)',
    'integration_approve_scope(want_scope uuid)',
    'integration_request_replay(want_dead_letter uuid, want_reason text)',
    'integration_set_paused(want_connection text, want_paused boolean, want_reason text)',
    'kill_switch_engaged(want_switch text, want_tenant text)',

    -- The two in 20260930010000_module_mode.sql (D-152). Both are security
    -- invoker, so a caller reads only their own school's rows: a school they
    -- are not in reads all-Connect. `core_modules()` is the constant list of
    -- fourteen; `effective_module_modes` is what the app asks for a school's
    -- modes, with `kill.core_modules` applied. `module_mode.check.sql` walks
    -- both, including the outsider.
    'core_modules()',
    'effective_module_modes(want_tenant text)',

    -- The sixteen in 20260928220000_private_beta.sql. Every beta table has
    -- RLS on, no policy and no grant, so these are the only way in. The first
    -- nine check `beta:manage` or `beta:triage` themselves; the queue returns
    -- feedback with no sender identity. The last seven act on the caller's
    -- own confirmed address or live membership and nothing else.
    'beta_create_program(want_id text, want_name text, want_school text, want_support_contact text)',
    'beta_add_cohort(want_program text, want_kind text, want_capacity integer)',
    'beta_invite(want_cohort uuid, want_email text)',
    'beta_revoke_invitation(want_invitation uuid)',
    'beta_set_status(want_program text, want_status text)',
    'beta_declare_flag(want_program text, want_flag text, want_about text)',
    'beta_post_issue(want_id uuid, want_program text, want_title text, want_detail text, want_workaround text, want_status text, want_published boolean)',
    'beta_feedback_queue(want_program text)',
    'beta_triage_feedback(want_feedback uuid, want_status text)',
    'beta_invitation_for_me()',
    'join_beta(want_invitation uuid)',
    'my_beta()',
    'beta_known_issues_for_me()',
    'beta_send_feedback(want_kind text, want_body text, want_route text)',
    'leave_beta(want_reason text, want_keeps_account boolean)',
    'forget_my_beta()',

    -- The support-ticket RPCs. The tables have no grant, so these are the only
    -- way in. Student routes act only on the caller's own tickets; the last
    -- three check `support:ticket` and return no column
    -- that names the student.
    'open_support_ticket(want_category text, want_subject text, want_body text, want_context jsonb, want_email_notice boolean)',
    'my_support_tickets()',
    'my_support_email_notices()',
    'my_support_thread(want_ticket uuid)',
    'reply_to_my_ticket(want_ticket uuid, want_body text)',
    'close_my_ticket(want_ticket uuid)',
    'forget_my_support_tickets()',
    'set_support_email_notice(want_ticket uuid, want_enabled boolean)',
    'support_ticket_queue()',
    'support_ticket_thread(want_ticket uuid)',
    'support_reply(want_ticket uuid, want_body text, want_status text, want_operation uuid)',

    -- The four in 20260928090000_gtm_foundation.sql. Contacts, consent and
    -- sends have no API grant at all, so these are the only way a school's
    -- staff learn anything about them, and each checks its capability over the
    -- campaign's school. `gtm_campaign_report` returns counts suppressed below
    -- ten and logs the read; `gtm_audience_count` returns one number; the two
    -- gate functions return the names of unmet checks, never a row.
    'gtm_activation_failures(want_campaign uuid)',
    'gtm_audience_count(want_campaign uuid)',
    'gtm_campaign_report(want_campaign uuid)',
    'gtm_pilot_problems(want_pilot uuid)',

    -- The two in 20260928100000_trust_room.sql. Each checks account:manage at
    -- platform scope before it writes. `trust_room_grant` returns a link
    -- token once and stores its hash; `trust_room_revoke` ends a grant.
    -- `trust_room_open`, which a link actually reaches, is service_role only
    -- and so is not here.
    'trust_room_grant(want_request uuid, want_artifacts text[], want_packet_commit text, want_days integer)',
    'trust_room_revoke(want_grant uuid, want_reason text)',

    -- The three in 20260928301000_advisor_shares.sql (Phase G, D-016).
    -- `share_with_advisor` finds the advisor only among the student's own
    -- school's `academic_advisor` grants, and every miss reads the same.
    -- `list_advisor_shares` returns shares addressed to the caller, titles and
    -- dates only. `read_advisor_share` checks the share is live and addressed
    -- to the caller, and logs the read for the student. `advisor.check.sql`
    -- holds each of those as the account refused.
    'list_advisor_shares()',
    'read_advisor_share(want_share uuid)',
    'share_with_advisor(advisor_email text, share_title text, share_payload jsonb, share_expires timestamp with time zone)',

    -- The six in 20260928302000_office_action_feed.sql (Phase J, D-048).
    -- The feed returns only published rows that reach the caller; the desk
    -- only rows in the caller's own office scope, with a count that is null
    -- below ten; the two writers check office, role and scope themselves.
    -- `officeactions.check.sql` holds each as the account refused.
    'draft_office_action(want_office text, want_scope_kind text, want_scope_id text, want_type text, want_audience text, want_target text, want_title text, want_why text, want_due timestamp with time zone, want_url text, want_source text)',
    'move_office_action(want_id uuid, want_step text, want_note text)',
    'my_action_publish_scopes()',
    'my_office_actions()',
    'office_action_programs()',
    'office_desk_actions()',

    -- The five in 20260928305000_course_demand_forecasting.sql (Phase K,
    -- D-051). A student contributes, stops and reads their own contribution,
    -- always at their own school; staff read their demand:read scopes and the
    -- snapshot rows those scopes allow, which the table's constraints keep at
    -- ten or more. None returns a person. `demand.check.sql` holds each.
    -- The refresh wrapper is the service role's alone and is not here.
    'contribute_course_plan(want_term text, want_courses jsonb)',
    'course_demand(want_term text)',
    'my_demand_contribution(want_term text)',
    'my_demand_scopes()',
    'stop_contributing(want_term text)',

    -- 20260928309000_course_studio.sql (D-101): faculty publish course rules,
    -- guidance and packs, each checked against a live course-scoped grant;
    -- the last lists which courses that is, and nothing about students.
    'publish_course_rules(want_course text, want_term text, want_blanket text, want_uses jsonb, want_words text, want_link text, want_effective date)',
    'publish_course_guidance(want_course text, want_term text, want_body text)',
    'publish_study_pack(want_course text, want_term text, want_pack uuid, want_title text, want_note text, want_items jsonb, want_retired boolean)',
    'my_course_studio_courses()',
    -- 20261009001500_course_material_retention_policy.sql: consumes one
    -- independently approved tenant-policy request. The function rechecks
    -- console:operate, fresh MFA, exact tenant/target/detail, request status,
    -- expiry and actor participation before fail-closed audit plus append.
    'publish_course_material_retention_policy(want_request uuid, want_correlation text)',

    -- 20260929310000_gradebook.sql: the gradebook of record. Each checks
    -- auth.uid(), the caller's own school and a course-scoped grades:*
    -- capability (or, filing a regrade, that the grade is the caller's own
    -- and released). `gradebook_record_passback` is the sender's, service
    -- role only, and is deliberately not here.
    'gradebook_set_scheme(want_course text, want_term text, want_categories jsonb, want_letters jsonb, want_moderation boolean, want_key text)',
    'gradebook_add_item(want_course text, want_term text, want_category text, want_title text, want_points numeric, want_line_item text, want_key text)',
    'gradebook_enter(want_item uuid, want_student uuid, want_score numeric, want_mark text, want_comment text, want_reason text, want_key text)',
    'gradebook_moderate(want_item uuid, want_student uuid, want_key text)',
    'gradebook_release(want_item uuid, want_key text)',
    'gradebook_file_regrade(want_item uuid, want_reason text, want_key text)',
    'gradebook_resolve_regrade(want_request uuid, want_outcome text, want_score numeric, want_mark text, want_note text, want_key text)',
    'gradebook_export(want_course text, want_term text)',
    'gradebook_queue_passback(want_item uuid, want_key text)',

    -- The two in 20260928310000_expansion_review_fixes.sql. Each deletes only
    -- rows naming the caller, for "Delete my account": demand contributions
    -- and consents, and advisor shares at either end. `demand.check.sql` and
    -- `advisor.check.sql` hold that neither reaches another account's rows.
    'forget_my_advisor_shares()',
    -- 20260928308000_support_shares.sql: shares naming the caller at either end.
    'forget_my_support_shares()',
    'forget_my_course_demand()',

    -- The one in 20260929010000_account_erasure_and_export.sql. Returns every
    -- row naming the caller and nobody else, keyed on auth.uid() with no
    -- argument to aim it elsewhere; `deletion.check.sql` proves both. Its
    -- sibling `erase_account(uuid)` takes an account id and so is
    -- service_role only, and is not here.
    'export_my_data()',
    -- 20260930234000_data_subject_request_intake.sql: derives both subject and
    -- tenant from auth.uid(), accepts only the four bounded request kinds, and
    -- returns an existing open same-kind request instead of duplicating it.
    -- `audit-and-subject-requests.check.sql` proves the caller and tenant
    -- boundaries and that anon cannot execute it.
    'raise_my_data_subject_request(requested_kind text, requested_detail text)',
    -- 20261004200000_answer_data_subject_requests.sql: the two ways a rights
    -- request is answered. Each refuses 42501 unless the caller holds
    -- `data_request:handle` (the data_steward role) and is not the requester,
    -- and each refuses an illegal move with 23514.
    -- `answer-rights-requests.check.sql` attempts every refusal by code.
    'verify_data_subject_request(request_id uuid, rung text)',
    'answer_data_subject_request(request_id uuid, new_status text, resolution_text text)',

    -- The three in 20260929100000_console_control_plane.sql. Each checks
    -- `console:operate` itself and raises 42501 without it (never
    -- `audit:read`, which is a tenant's word for its own events). `console_audit_read` is the only client
    -- path to `private.console_audit_event`, and writes an `audit.read` event
    -- through the writer role before it returns a row; the writer itself,
    -- the sealer and the verifier are service_role only and are not here.
    -- `console_figures` returns figures with their provenance and leaves
    -- demo tenants out unless asked. `console-control-plane.check.sql`
    -- attempts each refusal.
    'console_audit_read(since timestamp with time zone, want_limit integer)',
    'console_audit_status()',
    'console_figures(include_demo boolean)',

    -- The read-only exception queue in 20260930180000. It checks
    -- console:operate at platform scope inside the definer function, excludes
    -- demo tenants by default, and is negatively tested in
    -- console-command-center.check.sql.
    'console_command_center(include_demo boolean)',

    -- The bounded tenant access inventory in 20261005120000. The tenant and
    -- optional subject are filters, not authority: the function checks a live
    -- platform or exact-tenant capability before reading. Demo inclusion has
    -- the separate tenant:implement gate. Its feature suite attempts no grant,
    -- wrong tenant, expired grant, cross-tenant subject and demo escalation.
    'console_tenant_access(want_tenant text, want_subject uuid, after_granted_at timestamp with time zone, after_id uuid, want_limit integer, include_demo boolean)',

    -- Metadata-only tenant operations. It requires the platform console shell,
    -- derives rows from live exact-school tenant:implement grants, excludes
    -- demos by default and never accepts a tenant id from the caller.
    'console_tenant_operations(include_demo boolean)',

    -- The first query-side contract over the private tenant projections. It
    -- checks platform console or exact-school tenant configuration authority,
    -- bounds entitlement pagination, and computes freshness from private
    -- watermarks without exposing either projection table.
    'read_tenant_projection(want_tenant text, after_capability text, want_limit integer)',

    -- Credential-free connector health. It requires the platform console
    -- shell, derives tenants from exact-school integration:view grants,
    -- excludes demos by default, and returns no credential, cursor, payload,
    -- external-record or provider-message field.
    'console_integration_health(include_demo boolean)',

    -- Evidence-derived release and incident operations. It requires both the
    -- platform console shell and platform incident:communicate, excludes demo
    -- tenants without exact implementation scope, and performs no mutation.
    'console_release_incidents(include_demo boolean)',

    -- Identity-minimized privacy queue. It requires the platform console
    -- shell, derives tenants from exact-school data_request:handle grants and
    -- keeps subject ids and request content out of its result.
    'console_privacy_requests(include_demo boolean)',

    -- The privacy lifecycle in 20261005124000. Claim, sensitive-detail read,
    -- identity verification and resolution all require fresh MFA, the
    -- platform console shell and an exact-school data_request:handle grant.
    -- Completed erasure additionally requires no legal hold and an executed
    -- data-deletion approval for the exact tenant and request. The final
    -- reader exposes only the signed-in subject's immutable certificates.
    'claim_privacy_request(want_request uuid)',
    'read_privacy_request_detail(want_request uuid)',
    'verify_privacy_request(want_request uuid, want_basis text, want_evidence text)',
    'resolve_privacy_request(want_request uuid, want_outcome text, want_resolution text, want_evidence text, want_approval uuid)',
    'my_privacy_completion_certificates()',

    -- The eight in 20260929110000_console_approvals_and_break_glass.sql.
    -- Three writers on the approval path: requesting checks the duty's
    -- requester party, deciding checks fresh MFA, refuses self-approval and
    -- needs an approver party, acting needs console:operate, fresh MFA, an
    -- approved request and the caller to be its requester or an approver —
    -- and writes its audit event through the writer role before anything
    -- else, raising if it cannot. Two on break-glass: the subject closes,
    -- somebody else with the security or founder seat reviews. Three
    -- readers, `security invoker`, so the tables' own policies decide the
    -- rows and the function adds only the demo exclusion.
    -- `console-approvals.check.sql` attempts each refusal, and the
    -- fail-closed one with the writer's INSERT revoked.
    'request_approval(want_duty text, want_tenant text, want_target text, want_detail jsonb, want_evidence text, want_ticket text, want_correlation text)',
    'decide_approval(want_request uuid, want_decision text)',
    'console_act(want_request uuid, want_correlation text)',
    'close_break_glass(want_id uuid)',
    'review_break_glass(want_id uuid, want_note text)',
    'console_approvals(include_demo boolean)',
    'console_break_glass(include_demo boolean)',
    'console_customers(include_demo boolean)',

    -- The approval-bound dead-letter operation in 20261008190000. It requires
    -- console:operate, fresh MFA and a current two-person projection-replay
    -- approval bound to the exact tenant, event and consumer. Its focused
    -- suite proves wrong tenant/consumer, stale MFA and audit failure refuse
    -- the reset. This is the human control path; worker transitions stay in
    -- `private` and service-role only.
    'replay_domain_event(want_event uuid, want_consumer text, want_approval uuid, want_correlation text)',

    -- The nine in 20260929300000_registration_transaction.sql. The three
    -- student writers act only on the caller's own enrollment at the
    -- caller's own school, behind writeback.registration_submit and
    -- kill.writeback, each with an idempotency key. The two readers return
    -- the caller's own rows, and a hold as whether, office and link — never
    -- the reason. The four registrar writers each raise without
    -- registration:administer over the caller's school.
    -- `registration_transaction.check.sql` attempts each refusal.
    'registration_enroll(want_section uuid, want_key text, want_expect text)',
    'registration_drop(want_section uuid, want_key text)',
    'registration_withdraw(want_section uuid, want_key text)',
    'my_registration(want_term text)',
    'my_registration_hold()',
    'registrar_put_term(want_term text, want_opens timestamp with time zone, want_add_drop_ends timestamp with time zone, want_withdraw_ends timestamp with time zone, want_max_credits numeric)',
    'registrar_put_section(want_term text, want_course text, want_section text, want_title text, want_credits numeric, want_capacity integer, want_waitlist integer, want_meetings jsonb, want_prerequisites text[], want_requires_approval boolean)',
    'registrar_grant_override(want_student uuid, want_section uuid, want_waives text[], want_reason text, want_key text)',
    'registrar_decide(want_enrollment uuid, want_approve boolean, want_reason text, want_key text)',

    -- The two productivity workspace functions recovered from production.
    -- Saving is security invoker and can only mutate the caller's RLS-owned
    -- row. The aggregate is security definer, but it first requires an active
    -- admin membership for the requested tenant and returns counts only after
    -- the consenting cohort reaches ten; it never returns workspace content.
    'save_productivity_workspace(p_expected bigint, p_data jsonb, p_tenant text, p_aggregate boolean)',
    'productivity_readiness_aggregate(p_tenant text)',

    -- The nine in 20260929330000_dining.sql. Each takes the caller from
    -- auth.uid() and their school from profiles.school_id, never a
    -- parameter. The three that charge (placing, giving) also check the flag,
    -- both money kill switches and a live card-office connection; the order
    -- queue and pool functions staff use check `dining:operate` over the school;
    -- disconnecting checks `integration:configure`; the balance read returns
    -- the caller's own rows. `dining.check.sql` attempts each refusal.
    'dining_place_order(want_location uuid, want_items uuid[], want_pay text, want_key text)',
    'dining_cancel_order(want_order uuid, want_reason text)',
    'dining_advance_order(want_order uuid, want_status text)',
    'dining_set_ordering(want_location uuid, want_enabled boolean)',
    'dining_donate_swipes(want_swipes integer, want_consent text, want_key text)',
    'dining_pool_summary()',
    'dining_order_queue()',
    'dining_disconnect_partner()',
    'my_dining_balances()',
    -- Private, owner-scoped productivity sync and consented cohort reporting.
    -- The save RPC derives the owner from auth.uid(); the aggregate RPC
    -- requires an active tenant administrator and suppresses cohorts below 10.
    -- `productivity_workspace.sql` exercises both authorization boundaries.
    'save_productivity_workspace(p_expected bigint, p_data jsonb, p_tenant text, p_aggregate boolean)',
    'productivity_readiness_aggregate(p_tenant text)',
    -- The four in 20261006000000_onboarding_journeys_and_handoff.sql. Each
    -- reads the caller from auth.uid() and raises without one; none takes a
    -- tenant, a role or a user. The three onboarding writers act only on the
    -- caller's own assignment and check the step against the journey version it
    -- was made under; `consume_handoff` answers null for every way of failing.
    -- `onboarding-journeys.check.sql` attempts each refusal.
    'start_onboarding(p_journey text, p_entry jsonb, p_channel text)',
    'complete_onboarding_step(p_assignment uuid, p_step text, p_step_version integer, p_channel text)',
    'skip_onboarding_step(p_assignment uuid, p_step text, p_step_version integer, p_reason text, p_channel text)',
    'consume_handoff(p_id uuid, p_nonce text)',
    -- The two in 20261006160000_my_sessions.sql. Each reads the caller from
    -- auth.uid() and takes no user; `end_my_session` deletes only the caller's
    -- own other session and says "no such session" for anyone else's.
    -- `my-sessions.check.sql` attempts each refusal as the account refused.
    'my_sessions()',
    'end_my_session(want uuid)'
  ];
  extra text;
  missing text;
begin
  select string_agg(fn, ', ' order by fn) into extra from (
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f'
       and not pg_temp.from_extension(p.oid)
       and has_function_privilege('authenticated', p.oid, 'execute')
  ) t where not (t.fn = any(allowed));

  if extra is not null then
    raise exception 'FAILED: a signed-in account can call % — grant it deliberately or revoke it', extra;
  end if;
  raise notice 'ok  a signed-in account can call nothing outside the allowlist';

  /*
   * The control, and it is the half that keeps this file honest. Both checks
   * above pass perfectly against a schema with no functions in it at all, or
   * against a probe whose `has_function_privilege` call has stopped matching
   * anything — which is the failure `CLAUDE.md` keeps finding in this
   * repository's own instruments. So: the allowlist must be reachable too.
   */
  select string_agg(want, ', ' order by want) into missing from unnest(allowed) as want
   where not exists (
     select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
        and p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = want
        and has_function_privilege('authenticated', p.oid, 'execute')
   );

  if missing is not null then
    raise exception 'FAILED: the allowlist names %, which a signed-in account cannot call', missing;
  end if;
  raise notice 'ok  and can call every function it should';
end $$;

-- ── The gate's own switch, named because it is the one that was open ──────
--
-- Covered by the sweep above, and written out as well: a check that fails with
-- "a signed-out visitor can call set_invite_only(on_off boolean)" is read at a
-- glance, and this is the function whose exposure would hand a stranger the
-- pilot's front door.

do $$
begin
  if has_function_privilege('anon', 'public.set_invite_only(boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.set_invite_only(boolean)', 'execute') then
    raise exception 'FAILED: the invite gate can be flipped through the API';
  end if;
  raise notice 'ok  the invite gate cannot be flipped through the API';
end $$;

-- ── And now the same question about relations ─────────────────────────────
--
-- Everything above is about functions, because a function is the case where
-- the grant is the only gate. A table is not: row-level security is underneath
-- it, and a table over-granted to `anon` still yields no rows to a policy that
-- does not match. That is why this file began by asking only about functions.
--
-- A **view** is the case in between, and it is the one that got through.
--
-- A view in `public` is created with the definer's rights unless somebody
-- writes `security_invoker = true`, and it is auto-updatable whenever it is a
-- plain select of plain columns from one relation. Those two together mean a
-- write grant on a view is a write that runs as the view's owner and never
-- meets the base table's policies at all. Row-level security is not
-- underneath it; nothing is.
--
-- `20260921143455_forms.sql` created `public.published_forms` exactly that way
-- — definer's rights on purpose, so its WHERE clause could stand in front of
-- `forms`' owner-only policies (since `20260929000000` it runs as the caller,
-- and the sweep after this one holds every view to that) — and granted SELECT on top of the ALL that
-- Supabase's default privileges had already given `anon`. Applied to the live
-- project on 21 September 2026, a signed-out visitor could
--
--     delete from public.published_forms;
--
-- and take out every form that was open for answers.

do $$
declare modelled boolean;
begin
  select exists (
    select 1 from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
     where n.nspname = 'public' and d.defaclobjtype = 'r'
       and array_to_string(d.defaclacl, ',') like '%anon=%'
  ) into modelled;

  if not modelled then
    raise exception 'FAILED: no default table grant to anon in public — '
      'local.stub.sql has stopped modelling Supabase, so the relation checks below are vacuous';
  end if;
  raise notice 'ok  the harness grants tables the way Supabase does';
end $$;

do $$
declare writable text;
begin
  /*
   * Every view in `public` that either client role may write through.
   *
   * Asked as a sweep rather than about `published_forms` by name, for the
   * reason the function allowlist is a sweep: the fault is an omission, and
   * the next view added to this schema will arrive writable by a signed-out
   * visitor unless its author remembers a line nobody remembered this time.
   *
   * There is no allowlist beside it because there is no view here that should
   * be writable, and a view that genuinely needs to be takes an INSTEAD OF
   * trigger — which is a thing somebody writes on purpose and can be named
   * here when it exists.
   */
  select string_agg(who || ' → ' || rel, ', ' order by who || rel) into writable from (
    select r.rolname as who, c.relname as rel
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      cross join (values ('anon'), ('authenticated')) as r(rolname)
     where n.nspname = 'public' and c.relkind = 'v'
       and (has_table_privilege(r.rolname, c.oid, 'insert')
         or has_table_privilege(r.rolname, c.oid, 'update')
         or has_table_privilege(r.rolname, c.oid, 'delete'))
  ) t;

  if writable is not null then
    raise exception 'FAILED: a view in public is writable from the API (%) — '
      'a view runs with its owner''s rights, so this write meets no policy', writable;
  end if;
  raise notice 'ok  no view in public can be written through';
end $$;

-- The control for the sweep above, and it matters more here than anywhere else
-- in this file. `relkind = 'v'` matching nothing, a schema with no views in it,
-- or a `has_table_privilege` call that has stopped lining up would all leave
-- that check passing while proving nothing — and this is a suite whose whole
-- subject is a privilege that was there and was not seen.
--
-- So: the view this is about must exist, and must be readable by the role the
-- feature exists for. A respondent with the link is signed out.

do $$
begin
  if to_regclass('public.published_forms') is null then
    raise exception 'FAILED: public.published_forms is gone — the sweep above proved nothing';
  end if;
  if not has_table_privilege('anon', 'public.published_forms', 'select') then
    raise exception 'FAILED: a signed-out respondent cannot read published_forms — '
      'the revoke took the feature with it';
  end if;
  raise notice 'ok  published_forms exists and is readable by a signed-out respondent';
end $$;

-- ── Every view answers to the caller ──────────────────────────────────────
--
-- The write sweep above asks whether a view can be written through. This asks
-- the question underneath it: whether a view runs as the person asking at
-- all. A view created without `security_invoker = true` runs with its owner's
-- rights, so the base tables' row-level security never sees the caller —
-- whatever its WHERE lets through, it lets through to everybody holding the
-- grant. That is Supabase's lint 0010, level ERROR, and `published_forms` was
-- the one finding on the live project on 28 September 2026 until
-- `20260929000000_published_forms_invoker.sql`.
--
-- No allowlist, for the reason the write sweep has none: there is no view
-- here that should run as its owner. One that genuinely must is a decision,
-- and gets written down here when it exists.

create or replace function pg_temp.definer_views()
returns text language sql stable as $$
  select string_agg(c.relname, ', ' order by c.relname)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('v', 'm')
     and not ('security_invoker=true' = any(coalesce(c.reloptions, '{}'))
           or 'security_invoker=on'   = any(coalesce(c.reloptions, '{}')));
$$;

do $$
declare got text;
begin
  -- The control. A sweep whose `relkind` or `reloptions` test had stopped
  -- lining up would pass against any schema; this one has to name a definer
  -- view it was just handed.
  create view public.grants_probe_definer_view as select 1 as one;
  got := pg_temp.definer_views();
  if got is null or got not like '%grants_probe_definer_view%' then
    raise exception 'FAILED: a definer view was planted and the sweep did not name it (got %)', got;
  end if;
  raise notice 'ok  the definer-view sweep names a planted view';
  drop view public.grants_probe_definer_view;

  got := pg_temp.definer_views();
  if got is not null then
    raise exception 'FAILED: views in public that run with their owner''s rights: % — '
                    'create them `with (security_invoker = true)` and let the base '
                    'tables'' policies decide', got;
  end if;
  raise notice 'ok  every view in public runs as the caller';
end $$;

-- And the owner-only table underneath it, named for the same reason
-- `set_invite_only` is named above: a failure that says `anon can read forms`
-- is read at a glance, and `forms.marking` is the answer key to every quiz in
-- the app.

do $$
begin
  if has_table_privilege('anon', 'public.forms', 'select') then
    raise exception 'FAILED: a signed-out visitor holds SELECT on public.forms, which carries the answer keys';
  end if;
  raise notice 'ok  the answer keys are not reachable by a signed-out visitor';
end $$;

-- ── A definer function outside `public` is callable only because a policy needs it
--
-- `public` is swept above against an allowlist, because PostgREST publishes
-- it. `private` is not published, and that is the only reason its definer
-- helpers being executable by `anon` and `authenticated` has not been a
-- finding: a `security definer` function runs as its owner whoever calls it,
-- so the grant is the whole of its fence, and "nobody can reach it" is a fact
-- about today's API settings rather than about the function.
--
-- The rule: a client role may execute a definer function outside `public`
-- only when something evaluated *as that role* calls it — a row-level
-- security policy, or a view (which, being invoker now, runs as its reader).
-- Both are recorded in `pg_depend`, so this asks the catalogue rather than
-- reading bodies. A definer function called only by other definer functions
-- needs no client grant at all, since those run as the owner.
--
-- This is also the whole of what makes a *new* definer helper default to
-- closed. Postgres still grants EXECUTE to PUBLIC on every function as it is
-- created — `20260929050000` explains why it does not change that default —
-- so a migration that forgets its revoke ships a callable helper, and this is
-- the check that refuses it until the revoke is written or the reason is.
--
-- Two exceptions, named because a text search is not a dependency:
--   same_school            — reserved for the classmate policies when they
--                            tighten; tenancy.check.sql exercises it as a
--                            signed-in account today
--   gtm_reviews_outstanding — called by private.gtm_campaign_guard, an
--                            *invoker* trigger, which runs as whoever updated
--                            the campaign

create or replace function pg_temp.unneeded_definers()
returns text language sql stable as $$
  select string_agg(fn, ', ' order by fn) from (
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname not in ('public', 'pg_catalog', 'information_schema')
       and n.nspname not like 'pg_temp%'
       and p.prosecdef
       and not pg_temp.from_extension(p.oid)
       and (has_function_privilege('anon', p.oid, 'execute')
         or has_function_privilege('authenticated', p.oid, 'execute'))
       and not exists (
         select 1 from pg_depend d
          where d.refclassid = 'pg_proc'::regclass and d.refobjid = p.oid
            and d.classid in ('pg_policy'::regclass, 'pg_rewrite'::regclass))
  ) t where not (t.fn = any(array[
    'private.gtm_reviews_outstanding(want_campaign uuid)',
    'private.same_school(other uuid)'
  ]));
$$;

do $$
declare
  extra text;
  needed int;
begin
  extra := pg_temp.unneeded_definers();
  if extra is not null then
    raise exception 'FAILED: a client role can execute %, a definer function no policy or view calls — '
      'revoke it, or name it here with the reason', extra;
  end if;

  -- Control one: the exemption must be doing work. If `pg_depend` stopped
  -- recording policy dependencies, or the join stopped matching, every
  -- definer helper would look unneeded and the check above would fail on all
  -- of them — loud, but let it say why. The count is printed so a run shows
  -- what the rule is standing on.
  select count(distinct p.oid) into needed
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_depend d on d.refobjid = p.oid and d.refclassid = 'pg_proc'::regclass
                    and d.classid = 'pg_policy'::regclass
   where n.nspname = 'private' and p.prosecdef;
  if needed < 10 then
    raise exception 'FAILED: only % private definer function(s) are called by a policy — the dependency probe has stopped matching', needed;
  end if;

  -- Control two: the case this exists for. A migration adds a definer helper
  -- to `private` and writes no grant at all, so it has PUBLIC's EXECUTE from
  -- the moment it exists. The sweep must name it. Rolled back by the
  -- deliberate raise.
  begin
    create function private.grants_check_probe() returns int
      language sql security definer set search_path = '' as 'select 1';
    extra := pg_temp.unneeded_definers();
    raise exception using errcode = 'P0001', message = 'control:' || coalesce(extra, '');
  exception when raise_exception then
    if sqlerrm not like 'control:%private.grants_check_probe()%' then
      raise exception 'FAILED: a new definer helper with only its default grant was not seen (%)', sqlerrm;
    end if;
  end;
  raise notice 'ok  no definer function outside public is executable by a client role without a policy or view needing it (% policy helpers), and a new one with the default grant is refused', needed;
end $$;

-- ── And every function a policy calls can be executed by the role it applies to
--
-- The other half of the rule above, and what makes it safe to push on. The
-- sweep above says "revoke it"; this is what stops a revoke going one helper
-- too far. A policy is evaluated as the querying role, so a helper that role
-- cannot execute is not a closed door but a broken one: "permission denied
-- for function" on an ordinary select, for every account, on a table that was
-- working. This finds it at build time, for every policy, without waiting for
-- a suite to happen to query that table as that role.
--
-- Only where the role can reach the table with the policy's verb: a policy
-- `to public` on a table `anon` holds no grant on is never evaluated for
-- `anon`, and demanding the helper be executable there would be asking for a
-- grant nothing uses.

create or replace function pg_temp.policies_that_cannot_run()
returns text language sql stable as $$
  select string_agg(r.rolname || ' → ' || pol.polrelid::regclass || ' "' || pol.polname || '" → '
                    || d.refobjid::regprocedure, '; ' order by 1)
    from pg_policy pol
    join pg_depend d on d.classid = 'pg_policy'::regclass and d.objid = pol.oid
                    and d.refclassid = 'pg_proc'::regclass
    cross join (values ('anon'), ('authenticated')) as r(rolname)
   where (0::oid = any(pol.polroles)
          or (select oid from pg_roles where rolname = r.rolname) = any(pol.polroles))
     and has_table_privilege(r.rolname, pol.polrelid,
           case pol.polcmd when 'a' then 'insert' when 'w' then 'update'
                           when 'd' then 'delete' else 'select' end)
     and not has_function_privilege(r.rolname, d.refobjid, 'execute');
$$;

do $$
declare broken text;
begin
  broken := pg_temp.policies_that_cannot_run();
  if broken is not null then
    raise exception 'FAILED: a policy calls a function its role cannot execute: %', broken;
  end if;

  -- The control: take away the grant the forms insert policy depends on, and
  -- the sweep must name it. Rolled back by the deliberate raise.
  begin
    revoke execute on function private.form_open(uuid) from anon;
    broken := pg_temp.policies_that_cannot_run();
    raise exception using errcode = 'P0001', message = 'control:' || coalesce(broken, '');
  exception when raise_exception then
    if sqlerrm not like 'control:%anon%form_responses%form_open%' then
      raise exception 'FAILED: the policy sweep did not see form_open revoked from anon (%)', sqlerrm;
    end if;
  end;
  raise notice 'ok  every policy can execute the functions it calls, and the sweep sees one that cannot';
end $$;


rollback;
