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
   * The allowlist. Eighty-five, and each is a deliberate entry point:
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
    'claim_referral(given text)',
    'make_referral_code()',
    'note_activity(marks text[])',
    'referral_standing()',
    -- Both are security-invoker reads. Their table RLS remains the boundary:
    -- a caller can resolve only policy rows from their verified school.
    'effective_ai_policy(want_tenant text, want_user uuid)',
    'feature_state(want_capability text, want_tenant text)',
    -- A student-created, seven-day maximum grant is checked again on every
    -- aggregate support read. The deletion helper removes grants where the
    -- caller was either side; immutable pseudonymous events remain.
    'forget_my_support_access()',
    'read_support_signals(want_grant uuid)',
    -- The student surface resolves only verified same-school supporters,
    -- creates consent and its bounded grant atomically, and lists only windows
    -- in which the caller is the student or the still-authorized supporter.
    'available_supporters()',
    'create_support_access(want_supporter uuid, want_reason text, want_days integer)',
    'revoke_support_access(want_grant uuid)',
    'support_access_windows()',
    -- Sets `profiles.school_id` from the address the server confirmed. The
    -- column's own UPDATE privilege is revoked from both API roles, so this
    -- function is the only way in and has to be callable by a signed-in
    -- account. See 20260921170000_schools.sql.
    'claim_school(want text)',

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
    -- 20260928021700: the only doors to `mentor_requests` — no API role holds
    -- insert, update or delete on it. Send to an offer the caller can see;
    -- the recipient accepts or declines, the requester withdraws, capacity is
    -- checked at acceptance; either end forgets every request they are in.
    'answer_mentor_request(want uuid, want_status text)',
    'forget_my_mentor_requests()',
    'request_mentor(want_kind text, want_recipient uuid, want_cohort text, want_name text, want_topics text[], want_note text)',
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

    -- The nine in 20260928030000_support_tickets.sql. The tables have no grant,
    -- so these are the only way in. The first six act on the caller's own
    -- tickets; the last three check `support:ticket` and return no column
    -- that names the student.
    'open_support_ticket(want_category text, want_subject text, want_body text, want_context jsonb)',
    'my_support_tickets()',
    'my_support_thread(want_ticket uuid)',
    'reply_to_my_ticket(want_ticket uuid, want_body text)',
    'close_my_ticket(want_ticket uuid)',
    'forget_my_support_tickets()',
    'support_ticket_queue()',
    'support_ticket_thread(want_ticket uuid)',
    'support_reply(want_ticket uuid, want_body text, want_status text)'
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
  raise notice 'ok  and can call all fifty-five that it should';
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
-- `forms`' owner-only policies — and granted SELECT on top of the ALL that
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

rollback;
