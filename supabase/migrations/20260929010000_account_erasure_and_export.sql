-- Deleting an account for real, and handing an account everything it holds.
--
-- ## What was wrong
--
-- "Delete my account" ran in the browser: one filtered DELETE per table in
-- `OWNED_TABLES` (app/src/lib/cloud.ts), each its own request, then a sign-out.
-- Two things followed from that, and SECURITY-GAP-ANALYSIS.md row S-2 names
-- both. The `auth.users` row — the email address, the identities, the sign-in
-- itself — was never deleted, because a browser holding a publishable key
-- cannot and must not be able to. And a failure half way left half an account,
-- with the page telling the student to email the owner.
--
-- And there was no way at all for a student to get the rows the server holds
-- about them. The Export screen writes out what is on the *device*.
--
-- ## What this adds
--
--   * `private.account_data_map()` — every column in `public` or `private`
--     holding a foreign key to `auth.users`, read off the catalog at call
--     time, with what deleting the account does to it (its `on delete` rule)
--     and whether an export carries it. It is **the one list** both halves
--     below walk. There is no second list to fall behind: a table added next
--     week with `references auth.users` is erased and exported the day it
--     lands.
--   * `public.erase_account(uuid)` — callable by the service role only. In one
--     transaction: the account's own `forget_my_*` functions (which do more
--     than a cascade would — a post a moderation case holds is withdrawn and
--     anonymised rather than deleted, a beta invitation to the address goes),
--     then every mapped row deleted or cleared by its own rule, then the pilot
--     invitation to the address, then a non-identifying `data_requests` row
--     recording that it happened. Any failure rolls all of it back. The
--     `delete-account` Edge Function calls it and then deletes the auth user.
--   * `public.export_my_data()` — callable by a signed-in account for itself.
--     Every mapped row naming it, and every row hanging off those by an
--     `on delete cascade` (the answers to its forms, its beta feedback, its
--     ticket messages), as JSON.
--
-- ## Rows other people rely on, which the auth cascade used to destroy
--
-- `KEPT_TABLES` in cloud.ts promises the privacy page's readers that a group
-- you started, the parts you added to it, and a report you filed outlive your
-- account. That was true only because the auth row was never deleted: all
-- three hang off `auth.users` with `on delete cascade`, so the first real
-- account deletion would have taken the group from every other member. Same
-- for a Trust & Safety report, for a post a case is holding (which
-- `forget_my_community` withdraws precisely so that it stays), and for a
-- moderator's decisions on a case. Each becomes `on delete set null` here, and
-- `app/src/lib/erasure.test.ts` holds every `KEPT_TABLES` entry to having no
-- cascade from `auth.users` at all.
--
-- `consent_record.recorded_by` had no rule (NO ACTION), so the auth delete of
-- anyone who had ever recorded consent on somebody else's behalf would have
-- failed outright. It clears now; the consent stays with its subject.
--
-- ## What is still not handled, and fails closed
--
-- Four history tables refuse every UPDATE (`tenant_plan_history`,
-- `tenant_sso_policy_history`, `tenant_rollout_evidence`,
-- `tenant_rollout_history`), and their actor columns are `on delete set null`.
-- A staff account that ever wrote one cannot be erased until those triggers
-- learn to allow the clear. `erase_account` raises, the transaction rolls back,
-- nothing is deleted, and the function says so. A student account never
-- writes those rows.

-- ── 1. What a real account deletion keeps ─────────────────────────────────

alter table public.groups alter column created_by drop not null;
alter table public.groups drop constraint if exists groups_created_by_fkey;
alter table public.groups add constraint groups_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.group_tasks alter column created_by drop not null;
alter table public.group_tasks drop constraint if exists group_tasks_created_by_fkey;
alter table public.group_tasks add constraint group_tasks_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

alter table public.reports alter column reporter drop not null;
alter table public.reports drop constraint if exists reports_reporter_fkey;
alter table public.reports add constraint reports_reporter_fkey
  foreign key (reporter) references auth.users(id) on delete set null;

alter table public.community_reports alter column reporter_id drop not null;
alter table public.community_reports drop constraint if exists community_reports_reporter_id_fkey;
alter table public.community_reports add constraint community_reports_reporter_id_fkey
  foreign key (reporter_id) references auth.users(id) on delete set null;

alter table public.community_posts alter column author_id drop not null;
alter table public.community_posts drop constraint if exists community_posts_author_id_fkey;
alter table public.community_posts add constraint community_posts_author_id_fkey
  foreign key (author_id) references auth.users(id) on delete set null;

alter table public.community_decisions alter column actor_id drop not null;
alter table public.community_decisions drop constraint if exists community_decisions_actor_id_fkey;
alter table public.community_decisions add constraint community_decisions_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

alter table public.consent_record alter column recorded_by drop not null;
alter table public.consent_record drop constraint if exists consent_record_recorded_by_fkey;
alter table public.consent_record add constraint consent_record_recorded_by_fkey
  foreign key (recorded_by) references auth.users(id) on delete set null;

-- ── 2. Who started a group stays pinned — except when they leave ──────────
--
-- `groups_pinned` and `group_tasks_pinned` refuse any change to `created_by`,
-- which is right against a member rewriting who started a group (members may
-- UPDATE a group) and wrong against the set-null above, which is an UPDATE
-- too and would be refused. So `created_by` moves to a trigger of its own that
-- allows exactly one change: to null, for an account that is being erased
-- (`erase_account` says so for its own transaction) or is already gone.

create or replace function private.account_is_leaving(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select who is not null and (
    coalesce(current_setting('semester.erasing_account', true), '') = who::text
    or not exists (select 1 from auth.users u where u.id = who)
  );
$$;
revoke all on function private.account_is_leaving(uuid) from public, anon, authenticated;

create or replace function private.person_pinned_unless_leaving()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  col text;
  was text;
  now_is text;
begin
  foreach col in array tg_argv loop
    was := to_jsonb(old) ->> col;
    now_is := to_jsonb(new) ->> col;
    if now_is is distinct from was then
      if now_is is null and private.account_is_leaving(was::uuid) then
        continue;
      end if;
      raise exception '% cannot be changed after the row is created', col
        using errcode = 'restrict_violation';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.person_pinned_unless_leaving() from public, anon, authenticated;

drop trigger if exists groups_pinned on public.groups;
create trigger groups_pinned before update on public.groups
  for each row execute function private.refuse_column_change('id', 'term', 'code', 'created_at');
drop trigger if exists groups_starter_pinned on public.groups;
create trigger groups_starter_pinned before update on public.groups
  for each row execute function private.person_pinned_unless_leaving('created_by');

drop trigger if exists group_tasks_pinned on public.group_tasks;
create trigger group_tasks_pinned before update on public.group_tasks
  for each row execute function private.refuse_column_change('id', 'group_id', 'created_at');
drop trigger if exists group_tasks_author_pinned on public.group_tasks;
create trigger group_tasks_author_pinned before update on public.group_tasks
  for each row execute function private.person_pinned_unless_leaving('created_by');

-- ── 3. The one list ───────────────────────────────────────────────────────
--
-- Read off the catalog, never written down. `on_delete` is the column's own
-- rule: `delete` for `on delete cascade`, `clear` for `on delete set null`.
-- Anything else (`refuse`) is a column the auth delete would trip over, and
-- `erase_account` stops on it before touching a row.
--
-- `exported` is false for exactly three columns, each because the row is
-- somebody else's record *about* this account and handing it over would hand
-- over who they are:
--
--   * `blocks.blocked`   — a block another student placed on you. The row is
--                          their protection from you, and names them.
--   * `reports.about`    — a report somebody filed about you, with their id
--                          as `reporter`. Trust & Safety's to act on.
--   * `community_safety_entries.user_id` — the per-case safety deltas
--                          Trust & Safety keeps. The community migration's
--                          own rule is that "the student gets a sentence,
--                          never the number", and an export is not a way
--                          round that.
--
-- They are still erased. The export says, in its `withheld` field, that these
-- exist and why they are not in the file.

create or replace function private.account_data_map()
returns table (table_schema text, table_name text, column_name text, on_delete text, exported boolean)
language sql
stable
set search_path = ''
as $$
  select n.nspname::text,
         c.relname::text,
         a.attname::text,
         case k.confdeltype when 'c' then 'delete' when 'n' then 'clear' else 'refuse' end,
         (c.relname::text, a.attname::text) not in (
           ('blocks', 'blocked'),
           ('reports', 'about'),
           ('community_safety_entries', 'user_id')
         ) or n.nspname <> 'public'
    from pg_catalog.pg_constraint k
    join pg_catalog.pg_class c on c.oid = k.conrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
   where k.contype = 'f'
     and k.confrelid = 'auth.users'::regclass
     and cardinality(k.conkey) = 1
     and n.nspname in ('public', 'private')
   order by 2, 3;
$$;
revoke all on function private.account_data_map() from public, anon, authenticated;

-- ── 4. Erasure ────────────────────────────────────────────────────────────

create or replace function public.erase_account(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  n bigint;
  address text;
  removed jsonb := '{}'::jsonb;
  cleared jsonb := '{}'::jsonb;
  rows_removed bigint := 0;
  rows_cleared bigint := 0;
  left_over text := '';
  claims text := current_setting('request.jwt.claims', true);
  claim_sub text := current_setting('request.jwt.claim.sub', true);
  receipt uuid;
begin
  if target is null then
    raise exception 'No account was named.' using errcode = '22004';
  end if;
  select u.email into address from auth.users u where u.id = target;
  if not found then
    raise exception 'There is no such account.' using errcode = 'P0002';
  end if;

  -- Refuse before touching anything, rather than half way through.
  for m in select * from private.account_data_map() where on_delete = 'refuse' loop
    raise exception '%.% names accounts with no delete rule, so nothing was erased.',
      m.table_name, m.column_name using errcode = '55000';
  end loop;

  -- Lets the pinned-creator triggers allow the one change this makes.
  perform set_config('semester.erasing_account', target::text, true);

  -- The account's own ways out, run as the account, because each reads
  -- auth.uid(). They carry decisions a bare cascade does not: a post a case
  -- holds is withdrawn and anonymised, an organization left empty goes, a
  -- beta invitation to the confirmed address goes.
  perform set_config('request.jwt.claims',
                     json_build_object('sub', target::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', target::text, true);
  perform public.forget_my_community();
  perform public.forget_my_beta();
  perform public.forget_my_support_access();
  perform public.forget_my_organizations();
  perform public.forget_my_help_requests();
  perform public.forget_my_mentor_requests();
  perform public.forget_my_support_tickets();
  perform public.forget_my_advisor_shares();
  perform public.forget_my_support_shares();
  perform public.forget_my_course_demand();
  perform set_config('request.jwt.claims', coalesce(claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(claim_sub, ''), true);

  -- A request's free text can say anything about the person who wrote it.
  -- The row itself stays, cleared of them, below.
  update public.data_requests set details = '' where user_id = target;

  -- Everything else, by each column's own rule — which is what the auth
  -- delete would do, done here so it is one transaction with the above and
  -- so a refusal anywhere leaves everything where it was.
  for m in select * from private.account_data_map() loop
    if m.on_delete = 'delete' then
      execute format('delete from %I.%I where %I = $1', m.table_schema, m.table_name, m.column_name)
        using target;
      get diagnostics n = row_count;
      if n > 0 then
        removed := removed || jsonb_build_object(m.table_name,
          coalesce((removed ->> m.table_name)::bigint, 0) + n);
        rows_removed := rows_removed + n;
      end if;
    else
      execute format('update %I.%I set %I = null where %I = $1',
                     m.table_schema, m.table_name, m.column_name, m.column_name)
        using target;
      get diagnostics n = row_count;
      if n > 0 then
        cleared := cleared || jsonb_build_object(m.table_name || '.' || m.column_name, n);
        rows_cleared := rows_cleared + n;
      end if;
    end if;
  end loop;

  -- Keyed on the address rather than the account.
  if address is not null then
    delete from public.invites where lower(email) = lower(address);
    get diagnostics n = row_count;
    if n > 0 then
      removed := removed || jsonb_build_object('invites', n);
      rows_removed := rows_removed + n;
    end if;
  end if;

  -- Proved rather than assumed: a trigger that re-inserted a row naming the
  -- account would otherwise be a row the auth delete then trips over.
  for m in select * from private.account_data_map() loop
    execute format('select count(*) from %I.%I where %I = $1', m.table_schema, m.table_name, m.column_name)
      into n using target;
    if n > 0 then
      left_over := left_over || format(' %s.%s', m.table_name, m.column_name);
    end if;
  end loop;
  if left_over <> '' then
    raise exception 'Rows still name the account after erasure:%', left_over using errcode = '55000';
  end if;

  -- The record that it was done. No account, no address, no free text: the
  -- kind, the dates and the counts are what show a deletion was honoured.
  insert into public.data_requests (user_id, kind, details, status, completed_at)
  values (null, 'delete',
          format('Erased by the account holder: %s rows removed from %s tables, %s references cleared.',
                 rows_removed, (select count(*) from jsonb_object_keys(removed)), rows_cleared),
          'completed', now())
  returning id into receipt;

  return jsonb_build_object('removed', removed, 'cleared', cleared, 'receipt', receipt);
end $$;
revoke all on function public.erase_account(uuid) from public, anon, authenticated;
grant execute on function public.erase_account(uuid) to service_role;

-- ── 5. Export ─────────────────────────────────────────────────────────────

create or replace function private.account_export(who uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  fk record;
  rels regclass[] := '{}';
  preds text[] := '{}';
  follows boolean[] := '{}';
  depths int[] := '{}';
  i int := 1;
  rel regclass;
  rows jsonb;
  tables jsonb := '{}'::jsonb;
  address text;
  account jsonb;
begin
  -- The account's own columns: each a set of rows.
  for m in select * from private.account_data_map() where exported loop
    rels := rels || format('%I.%I', m.table_schema, m.table_name)::regclass;
    preds := preds || format('%I = %L::uuid', m.column_name, who);
    -- A cascade column means the row is the account's, so what hangs off it by
    -- a cascade of its own is too. A cleared column means only that the
    -- account once touched the row — an organization it founded — and the
    -- rows hanging off that are other people's.
    follows := follows || (m.on_delete = 'delete');
    depths := depths || 0;
  end loop;

  -- And down every `on delete cascade` from those, a few levels deep.
  while i <= cardinality(rels) loop
    if follows[i] and depths[i] < 4 then
      for fk in
        select k.conrelid::regclass as child,
               (select string_agg(format('%I', a.attname), ', ' order by x.ord)
                  from unnest(k.conkey) with ordinality x(num, ord)
                  join pg_catalog.pg_attribute a on a.attrelid = k.conrelid and a.attnum = x.num) as child_cols,
               (select string_agg(format('%I', a.attname), ', ' order by x.ord)
                  from unnest(k.confkey) with ordinality x(num, ord)
                  join pg_catalog.pg_attribute a on a.attrelid = k.confrelid and a.attnum = x.num) as parent_cols
          from pg_catalog.pg_constraint k
          join pg_catalog.pg_class c on c.oid = k.conrelid
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where k.contype = 'f' and k.confrelid = rels[i] and k.confdeltype = 'c'
           and k.conrelid <> rels[i] and n.nspname in ('public', 'private')
      loop
        rels := rels || fk.child;
        preds := preds || format('(%s) in (select %s from %s where %s)',
                                 fk.child_cols, fk.parent_cols, rels[i], preds[i]);
        follows := follows || true;
        depths := depths || (depths[i] + 1);
      end loop;
    end if;
    i := i + 1;
  end loop;

  for rel in select distinct r from unnest(rels) r loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from %s t where %s',
                   rel,
                   (select string_agg('(' || p || ')', ' or ')
                      from unnest(rels, preds) as x(r, p) where x.r = rel))
      into rows;
    if jsonb_array_length(rows) > 0 then
      tables := tables || jsonb_build_object(
        regexp_replace(rel::text, '^public\.', ''), rows);
    end if;
  end loop;

  -- Keyed on the address rather than the account.
  select u.email into address from auth.users u where u.id = who;
  if address is not null then
    select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) into rows
      from public.invites v where lower(v.email) = lower(address);
    if jsonb_array_length(rows) > 0 then tables := tables || jsonb_build_object('invites', rows); end if;
    select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) into rows
      from public.beta_invitations b where b.email = lower(address);
    if jsonb_array_length(rows) > 0 then tables := tables || jsonb_build_object('beta_invitations', rows); end if;
  end if;

  -- The sign-in record, without anything that is a credential.
  select jsonb_strip_nulls(jsonb_build_object(
           'id', j -> 'id', 'email', j -> 'email', 'phone', j -> 'phone',
           'created_at', j -> 'created_at', 'updated_at', j -> 'updated_at',
           'email_confirmed_at', j -> 'email_confirmed_at',
           'last_sign_in_at', j -> 'last_sign_in_at',
           'user_metadata', j -> 'raw_user_meta_data',
           'app_metadata', j -> 'raw_app_meta_data'))
    into account
    from (select to_jsonb(u) as j from auth.users u where u.id = who) s;

  return jsonb_build_object(
    'format', 'semester.account-export',
    'version', 1,
    'generated_at', now(),
    'account', account,
    'tables', tables,
    'withheld', jsonb_build_array(
      'Blocks another person placed on you: the row is their protection from you, and names them.',
      'Reports another person filed about you: the row names who filed it.',
      'Trust & Safety''s per-case safety scores: you are told what a decision means, never the number.'
    )
  );
end $$;
revoke all on function private.account_export(uuid) from public, anon, authenticated;

create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  -- Recorded first, so the file includes the record of its own making.
  insert into public.data_requests (user_id, kind, details, status, completed_at)
  values (me, 'export', 'Downloaded by the account holder from the Privacy page.', 'completed', now());
  return private.account_export(me);
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
