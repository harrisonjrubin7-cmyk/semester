-- An account export must not carry a guardian restriction.
--
-- `guardian_link_restrictions` is a school's record on a guardian link: whether
-- a court order applies and what the front office is to do about it. Its
-- policy gives the row to the school's staff alone; the guardian and the
-- student are both refused (k12-guardians.check.sql).
--
-- `private.account_export` is `security definer`, so it was not held to that
-- policy, and it follows every `on delete cascade` below the account's own
-- rows. `guardian_link_restrictions.link_id` cascades from `guardian_links`,
-- which cascades from both ends of a link, so the walk reached the restriction
-- and put its note in the student's file, and in the guardian's.
-- `export-withholds-guardian-restrictions.check.sql` is the run that showed it.
--
-- The three columns the export already withholds are columns of tables that
-- are otherwise the person's own. This is a whole table, so it is a second,
-- smaller list: `private.export_withheld_tables()`, read in the two places the
-- export gathers rows (the account's own columns, and the cascade below them).
-- The function is otherwise `20260929010000_account_erasure_and_export.sql`
-- byte for byte, plus the fourth sentence in `withheld`, because the file must
-- say what it leaves out.
--
-- Erasure is not touched: `erase_account` still removes the restriction with
-- the link, as it did.

create or replace function private.export_withheld_tables()
returns oid[]
language sql
immutable
set search_path = ''
as $$
  select array['public.guardian_link_restrictions'::regclass::oid];
$$;
revoke all on function private.export_withheld_tables() from public, anon, authenticated;

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
  for m in select * from private.account_data_map()
            where exported
              and format('%I.%I', table_schema, table_name)::regclass::oid <> all (private.export_withheld_tables())
  loop
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
           and k.conrelid <> all (private.export_withheld_tables())
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
      'Trust & Safety''s per-case safety scores: you are told what a decision means, never the number.',
      'Restrictions a school recorded on a guardian link: they are the school''s record, readable by its staff alone, and about the other person as much as about you.'
    )
  );
end $$;
revoke all on function private.account_export(uuid) from public, anon, authenticated;
