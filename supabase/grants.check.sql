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
   * The allowlist. Twenty, and each is a deliberate entry point:
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
    -- Sets `profiles.school_id` from the address the server confirmed. The
    -- column's own UPDATE privilege is revoked from both API roles, so this
    -- function is the only way in and has to be callable by a signed-in
    -- account. See 20260921170000_schools.sql.
    'claim_school(want text)',

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
    'request_connection(who uuid)'
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
  raise notice 'ok  and can call all twenty that it should';
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
