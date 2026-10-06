-- No company role reads a student's rows.
--
-- The product rule, from the handoff and from `docs/ROLE-PERMISSION-MATRIX.md`:
-- the fourteen *global* roles (`app_roles.global` — the company's own staff,
-- granted at platform scope) do not read what a student owns. `rls-coverage`
-- asks whether every table has row-level security; `capabilities` and
-- `rolegrants` ask what each capability and grant means. Nothing asked the
-- question this rule is actually about, from the other side: put a row of
-- student data in a table, become each company role, and look.
--
-- ## What it does
--
-- For every table in `public` that names its owner in a uuid column called
-- `user_id`, `student_id`, `student`, `subject_user_id`, `person_id`, `author`,
-- `author_id`, `owner`, `recipient`, `requester`, `donor`, `target_student`,
-- `auth_user_id`, `person_account` or `reader_id` (`owner_columns` below), it
--
--   1. writes one row owned by a synthetic student (foreign keys and triggers
--      are off for that insert, so the row can stand alone; NOT NULL and CHECK
--      constraints are not, so a value is chosen for each — from the
--      constraint itself where it is a list or a minimum length);
--   2. becomes the student and reads it back — the **control**. A table the
--      owner cannot read back says nothing about anyone else, so it is not
--      counted as probed, and is named below instead of being passed;
--   3. becomes each of the fourteen company roles in turn, with a live
--      platform-scope grant, and counts what it can read of that student's.
--
-- The answer must equal `exceptions` below, exactly. A company role reading a
-- student's row that is not on the list fails; an entry on the list that is no
-- longer true fails too. The list can only shrink, and each entry says why it
-- is there — it is the written record of where a company role may read student
-- data, which until this file nobody had.
--
-- ## What it does not do
--
--   * It reads through the table, as `authenticated`. A `security definer`
--     function a company role may call is a different path and is not walked
--     here (`rls-coverage` pins the definers' search_path; what each returns is
--     the job of the suite for its feature).
--   * It does not cover tables that name their owner some other way
--     (`created_by`, `subject`, `owner_id`, `account_id`: mostly the staff who
--     wrote a row, not the person it is about). The probed count only goes up.
--   * Where a table has several owner columns they are all set to the one
--     student, so a policy that reads through any of them is found; a
--     fixture may override one (`mentor_requests.requester`) where the table
--     forbids two of them being the same person.
--   * A table that needs related rows before its owner can read it (a message
--     needs a room) is inconclusive, not safe. They are counted and named.
--
-- ## Controls
--
--   * Each company role's grant is live: it holds a capability its role
--     carries. A fixture that granted nothing would make every count zero.
--   * The owner reads their own row back, on every probed table.
--   * The sweep finds something. It is not a probe that answers nothing for
--     everyone — the exceptions below are rows it saw.
--
--   How to run it: supabase/check.sh company-roles-student-data

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.answered_count(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- A literal of the column's type that most constraints accept.
create or replace function pg_temp.literal_for(dt text, ut text, ordinal int)
returns text language plpgsql as $$
begin
  return case
    when dt = 'uuid' then 'gen_random_uuid()'
    when dt in ('text', 'character varying', 'character') then '''xxxxxxxx'''
    when dt in ('integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real') then '1'
    when dt = 'boolean' then 'false'
    -- Later columns get later instants, which is what "expires_at > verified_at" asks.
    when dt in ('timestamp with time zone', 'timestamp without time zone')
      then format('now() + interval ''%s seconds''', ordinal)
    when dt = 'date' then 'current_date'
    when dt in ('jsonb', 'json') then '''{}'''
    when dt = 'ARRAY' then '''{}'''
    when dt = 'bytea' then '''\x00'''
    when dt = 'interval' then '''1 second'''
    when dt = 'time without time zone' then 'now()::time'
    when dt = 'USER-DEFINED' then
      (select quote_literal(e.enumlabel) from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = ut order by e.enumsortorder limit 1)
    else null end;
end $$;

do $$
declare
  -- Where a company role may read a student's row, and why. Empty is the goal.
  -- Keys are 'table/role'. Every entry is a decision somebody should be able
  -- to defend; an entry nobody can defend is a bug waiting for a migration.
  console_reason constant text :=
    'Intended, and not student data in practice. console:operate reads every approval request (20260929110000, "operators, requesters and approvers read requests"); `requester` is the company staff member who asked for the approval, so the sweep finding its own fixture student there is a column-name match, not a student record.';
  exceptions jsonb := jsonb_build_object(
    'approval_request/data_steward', console_reason,
    'approval_request/incident_responder', console_reason,
    'approval_request/platform_admin', console_reason,
    'approval_request/support_agent', console_reason,
    'approval_request/trust_officer', console_reason,
    'course_review_authors/moderator',
      'Intended read, enforcement open. The policy admits review:moderate to see who wrote a course review, and docs/ROLE-LAUNCH-REGISTER.md says moderators get "author access strictly audited". The read itself writes no audit row, so "strictly audited" is a claim the table does not enforce. Needs the privacy owner: audit each authorship read, or return authorship through a definer function that does.',
    'billing_accounts/finance_operator',
      'Intended. billing:operate at platform scope is the company''s own billing duty (private.can_read_billing, docs/COMMERCIAL-CORE.md). The row is the subscription account, not an education record; an individual subscriber''s row points at them through user_id, which is on delete set null.',
    'data_requests/data_steward',
      'Intended. The policy is "a data steward works a request": a data steward reads the access, export, correction and deletion requests they are asked to process (data_request:handle).',
    'community_volunteers/trust_safety_senior',
      'Intended. Senior reviewers run the volunteer program from the Volunteers screen (docs/VOLUNTEER-MODERATOR-PROGRAM.md): record training, send back to calibration, revoke.',
    'community_volunteers/trust_safety_reviewer',
      'TO NARROW. The policy admits community:review, which a plain reviewer holds, but the program is the senior reviewer''s (docs/SUPPORT-AND-TRUST-SAFETY-OPERATING-MODEL.md, volunteer program). The row holds status, training dates and a free-text revoked_reason, across every school. Needs the privacy owner: narrow to community:review_senior, or write down why plain reviewers need the roster.');
  floor_probed int := 79;     -- the sweep may probe more over time, never fewer

  -- Tables the generic row builder cannot fill: a value only the table's own
  -- rules accept. `set` overrides a column; `before` is SQL run first (a
  -- parent row); `no_owner_read` is for a table a student is deliberately not
  -- allowed to read, where the owner read-back is replaced by a row-exists check.
  fixtures jsonb := jsonb_build_object(
    'enrollments', jsonb_build_object('set', jsonb_build_object('term', '''2026FA''', 'code', '''vanderbilt/ECON 2001''')),
    'messages', jsonb_build_object('set', jsonb_build_object('term', '''2026FA''', 'code', '''vanderbilt/ECON 2000''')),
    'message_reactions', jsonb_build_object('set', jsonb_build_object('term', '''2026FA''', 'code', '''vanderbilt/ECON 2000''')),
    'group_members', jsonb_build_object('set', jsonb_build_object('group_id', '''00000000-0000-0000-0000-00000000f001''')),
    'grade_entries', jsonb_build_object('set', jsonb_build_object('status', '''released''', 'action', '''entered''', 'score', '1', 'version', '1')),
    'family_invites', jsonb_build_object('set', jsonb_build_object('code', '''ABCDEFGH''', 'access', '''selected''',
      'categories', '''{finances}''', 'resource_ids', '''{x}''', 'institution_id', '''vanderbilt''')),
    'referral_codes', jsonb_build_object('set', jsonb_build_object('code', '''ABCDEFGH''')),
    'grade_passbacks', jsonb_build_object('no_owner_read', true),
    'dining_ledger', jsonb_build_object('set', jsonb_build_object('term', '''card''', 'kind', '''campus_cents''')),
    'dining_orders', jsonb_build_object('set', jsonb_build_object('items', '''{00000000-0000-0000-0000-00000000f003}''')),
    'dining_plans', jsonb_build_object('set', jsonb_build_object('swipe_kind', '''weekly''', 'swipes_per_week', '5', 'term', '''2026FA''', 'time_zone', '''America/Chicago''')),
    'dining_pool_donations', jsonb_build_object('set', jsonb_build_object('consent_version', '''dining-share-v1''')),
    'institution_actions', jsonb_build_object('set', jsonb_build_object('audience_kind', '''student''')),
    'mentor_requests', jsonb_build_object('set', jsonb_build_object('requester', '''00000000-0000-0000-0000-00000000f002''')),
    'registration_overrides', jsonb_build_object('set', jsonb_build_object('waives', '''{capacity}''')));

  -- Where a table says whose row it is. `user_id` and `student_id` are the
  -- plain cases; the rest are what other tables call the same thing.
  owner_columns constant text[] := array['user_id', 'student_id', 'student', 'subject_user_id',
    'person_id', 'author', 'author_id', 'owner', 'recipient', 'requester', 'donor', 'target_student',
    'auth_user_id', 'person_account', 'reader_id'];
  extra text[]; why text;
  roles text[]; r text; t record; col record;
  stu uuid; owner_col text;
  users jsonb := '{}';
  cols text; vals text; lit text; over jsonb; attempt int; ok boolean;
  cn text; cd text; m text[]; n bigint; cap text; has boolean;
  probed int := 0; no_read int := 0; inconclusive int := 0;
  seen jsonb := '{}';          -- 'table/role' => rows read
  unprobed text := '';
  k text; stale text := ''; unlisted text := '';
begin
  select array_agg(role order by role) into roles from public.app_roles where global;
  perform pg_temp.answered_count('there are fourteen company roles', cardinality(roles), 14);

  stu := pg_temp.newuser('student@company-roles.test');
  -- A student the class rooms will show to their owner: an adult by their own
  -- sign-up answer, and enrolled in a class that has a group in it.
  insert into private.account_ages (user_id, source) values (stu, 'sign_up')
  on conflict (user_id) do update set minor_until = null, under_minimum = false;
  insert into public.enrollments (user_id, term, code) values (stu, '2026FA', 'vanderbilt/ECON 2000');
  insert into public.groups (id, term, code, name, created_by)
  values ('00000000-0000-0000-0000-00000000f001', '2026FA', 'vanderbilt/ECON 2000', 'fixture', stu);
  foreach r in array roles loop
    users := users || jsonb_build_object(r, pg_temp.newuser(r || '@company-roles.test'));
    insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
    values ((users->>r)::uuid, r, 'platform', '', 'platform');
  end loop;

  -- ── Control: every company role's grant is live ─────────────────────────
  foreach r in array roles loop
    select min(capability) into cap from public.role_capabilities where role = r;
    if cap is null then
      raise exception 'FAILED: % carries no capability, so its fixture proves nothing', r;
    end if;
    perform pg_temp.become((users->>r)::uuid);
    select private.has_capability(cap) into has;
    execute 'reset role';
    if has is distinct from true then
      raise exception 'FAILED: a live platform grant of % does not answer true for %', r, cap;
    end if;
  end loop;
  raise notice 'ok  each of the % company roles holds a live grant (checked by capability)', cardinality(roles);

  -- ── The sweep ───────────────────────────────────────────────────────────
  for t in
    select c.table_name,
           -- The first column named is the one read back; the rest are set to the
           -- same student, so a policy that reads through any of them is found.
           (array_agg(c.column_name::text order by (c.column_name = 'user_id') desc,
                      (c.column_name = 'student_id') desc, c.column_name))[1] as owner_col,
           array_agg(c.column_name::text order by c.column_name) as owner_cols
      from information_schema.columns c
      join pg_tables p on p.tablename = c.table_name and p.schemaname = 'public'
     where c.table_schema = 'public' and c.data_type = 'uuid'
       and c.column_name = any (owner_columns)
     group by c.table_name
     order by 1
  loop
    owner_col := t.owner_col; extra := array_remove(t.owner_cols, owner_col);

    -- A table no signed-in client may select from has no path to read here.
    if not has_table_privilege('authenticated', format('public.%I', t.table_name), 'select') then
      no_read := no_read + 1; continue;
    end if;

    over := coalesce(fixtures->t.table_name->'set', '{}'::jsonb); ok := false; why := null;
    for attempt in 1..6 loop
      cols := quote_ident(owner_col); vals := quote_literal(stu::text) || '::uuid'; ok := true;
      foreach k in array extra loop
        cols := cols || ', ' || quote_ident(k);
        vals := vals || ', ' || coalesce(over->>k, quote_literal(stu::text) || '::uuid');
      end loop;
      for col in select column_name, data_type, udt_name, ordinal_position
                   from information_schema.columns
                  where table_schema = 'public' and table_name = t.table_name and column_name <> all (t.owner_cols)
                    and ((is_nullable = 'NO' and column_default is null and is_identity = 'NO' and is_generated = 'NEVER')
                         or over ? column_name)
                  order by ordinal_position loop
        lit := coalesce(over->>col.column_name, pg_temp.literal_for(col.data_type, col.udt_name, col.ordinal_position));
        if lit is null then ok := false; unprobed := unprobed || format(' %s(no value for %s)', t.table_name, col.column_name); exit; end if;
        cols := cols || ', ' || quote_ident(col.column_name); vals := vals || ', ' || lit;
      end loop;
      exit when not ok;
      begin
        execute 'set local session_replication_role = replica';
        execute format('insert into public.%I (%s) values (%s)', t.table_name, cols, vals);
        execute 'set local session_replication_role = origin';
        ok := true; exit;
      exception when check_violation then
        get stacked diagnostics cn = constraint_name;
        execute 'set local session_replication_role = origin';
        select pg_get_constraintdef(oid) into cd from pg_constraint
         where conname = cn and conrelid = format('public.%I', t.table_name)::regclass;
        ok := false; why := 'check ' || coalesce(cn, '?');
        -- col = ANY (ARRAY['a', 'b', ...]): take the first.
        m := regexp_match(cd, '\(?(\w+) = ANY \(\(?ARRAY\[''([^'']*)''');
        if m is not null then over := over || jsonb_build_object(m[1], quote_literal(m[2])); continue; end if;
        -- length(col) >= n, with or without TRIM: n characters.
        m := regexp_match(cd, 'length\((?:TRIM\(BOTH FROM )?(\w+)\)+ >= (\d+)');
        if m is not null then over := over || jsonb_build_object(m[1], quote_literal(repeat('x', m[2]::int))); continue; end if;
        exit;
      when others then
        execute 'set local session_replication_role = origin';
        why := left(sqlerrm, 90);
        ok := false; exit;
      end;
    end loop;
    if not ok then
      inconclusive := inconclusive + 1;
      unprobed := unprobed || ' ' || t.table_name || coalesce('(' || why || ')', ''); continue;
    end if;

    -- Control: the owner reads it back.
    perform pg_temp.become(stu);
    begin
      execute format('select count(*) from public.%I where %I = %L', t.table_name, owner_col, stu) into n;
    exception when insufficient_privilege then n := 0;
    end;
    execute 'reset role';
    -- A table the owner is deliberately not let read: the row must exist instead.
    if n < 1 and coalesce((fixtures->t.table_name->>'no_owner_read')::boolean, false) then
      execute format('select count(*) from public.%I where %I = %L', t.table_name, owner_col, stu) into n;
    end if;
    if n < 1 then inconclusive := inconclusive + 1; unprobed := unprobed || ' ' || t.table_name || '(owner cannot read it back)'; continue; end if;
    probed := probed + 1;

    foreach r in array roles loop
      perform pg_temp.become((users->>r)::uuid);
      begin
        execute format('select count(*) from public.%I where %I = %L', t.table_name, owner_col, stu) into n;
      exception when insufficient_privilege then n := 0;
      end;
      execute 'reset role';
      if n > 0 then seen := seen || jsonb_build_object(t.table_name || '/' || r, n); end if;
    end loop;
  end loop;

  -- ── Held to the list, in both directions ───────────────────────────────
  for k in select jsonb_object_keys(seen) loop
    if not exceptions ? k then unlisted := unlisted || ' ' || k; end if;
  end loop;
  if unlisted <> '' then
    raise exception 'FAILED: a company role reads a student''s row, and it is not on the list:%', unlisted;
  end if;
  for k in select jsonb_object_keys(exceptions) loop
    if not seen ? k then stale := stale || ' ' || k; end if;
  end loop;
  if stale <> '' then
    raise exception 'FAILED: on the list but no longer true — remove it:%', stale;
  end if;
  raise notice 'ok  % company-role reads of a student''s row, each one on the list with its reason', (select count(*) from jsonb_object_keys(seen));

  -- ── The probe is wide enough, and says what it missed ──────────────────
  if probed < floor_probed then
    raise exception 'FAILED: only % tables probed, the floor is % — the row builder lost ground. Not probed:%',
      probed, floor_probed, unprobed;
  end if;
  raise notice 'ok  % tables probed with a student row and read back by its owner; % have no select grant for a signed-in client; % inconclusive:%',
    probed, no_read, inconclusive, unprobed;
end $$;

rollback;
