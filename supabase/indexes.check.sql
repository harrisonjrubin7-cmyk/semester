-- Every foreign key has an index that covers it.
--
-- Asked over the whole schema rather than as a list of cases, for the reason
-- `grants.check.sql` gives about the same shape of fault: an omission, and a
-- suite made of named cases only catches the omissions somebody thought of.
--
-- ## The omission this is about actually happened, twice
--
-- `history/20260907141551_index_foreign_keys.sql` opens *"Covering indexes for
-- the five foreign keys that had none"* and fixed exactly five, on 7
-- September. `groups`, `group_members` and `group_tasks` landed on the 11th
-- and `referrals` on the 21st — both after that pass, neither covered by it,
-- and nothing re-ran it. Fourteen days later the project's linter reported
-- **five** unindexed foreign keys again, on different tables.
--
-- A one-off pass cannot hold a rule that every future migration has to obey.
-- This can.
--
-- ## What an unindexed foreign key costs, and why a test can see it
--
-- Nothing on the insert. The cost lands on the *parent*: to delete a row in
-- `auth.users`, Postgres must prove no child still references it, and without
-- an index that proof is a sequential scan of the child. That is the
-- delete-my-account path, and it is the operation nobody notices getting slow,
-- because it only does once there is data — by which time it is a timeout in
-- a deletion rather than a slow page somebody reports.
--
-- So it is checked structurally, before there is data to be slow about. This
-- asks the catalogue a question that is true or false today; it does not
-- measure anything, and it cannot be fooled by an empty table.
--
-- ## What counts as covering
--
-- An index covers a foreign key when the key's columns are a **prefix** of
-- the index's columns, in order. `referrals_pkey` on `(user_id, code)` covers
-- a foreign key on `user_id` and does *not* cover one on `code`, because an
-- index cannot be searched by its second column alone — which is exactly the
-- case that made `referrals.code` one of the five.
--
-- Partial indexes are not accepted. One with a `where` clause covers only the
-- rows it names, and the parent-side check has to prove something about every
-- row, so a partial index would leave the scan in place while looking like
-- cover in the catalogue.
--
--   How to run it: supabase/check.sh indexes

begin;

do $$
declare
  bare text;
begin
  select string_agg(format('%s(%s)', tbl, cols), ', ' order by tbl, cols)
    into bare
    from (
      select c.conrelid::regclass::text as tbl,
             (select string_agg(a.attname, ',' order by k.ord)
                from unnest(c.conkey) with ordinality k(attnum, ord)
                join pg_attribute a
                  on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
       where c.contype = 'f'
         and n.nspname = 'public'
         and not exists (
           select 1
             from pg_index x
            where x.indrelid = c.conrelid
              -- A prefix, in order: the key's columns are the first
              -- `array_length(conkey)` of the index's.
              and (x.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
              -- Not a partial index. See the header.
              and x.indpred is null
         )
    ) as uncovered;

  if bare is not null then
    raise exception
      'FAILED: foreign keys with no covering index: % — add one per column, '
      'or say here why the scan is acceptable', bare;
  end if;
  raise notice 'ok  every foreign key in public has an index covering it';
end $$;

-- ── No two indexes doing one index's work ────────────────────────────────
--
-- `20260901000800_calendar.sql` declared `token text not null unique`, which
-- builds `calendar_feeds_token_key`, and then twelve lines later created
-- `calendar_feeds_token_idx` on the same column. Two identical unique indexes
-- on one column, in one file, both maintained on every insert and every token
-- rotation, and neither author of a later migration had any way to notice.
--
-- Compared on the columns and the predicate rather than the name, because the
-- names are exactly what does *not* match when this happens.

do $$
declare
  dupes text;
begin
  select string_agg(format('%s: %s', tbl, names), ', ' order by tbl)
    into dupes
    from (
      select x.indrelid::regclass::text as tbl,
             string_agg(i.relname, ' = ' order by i.relname) as names
        from pg_index x
        join pg_class i on i.oid = x.indexrelid
        join pg_class t on t.oid = x.indrelid
        join pg_namespace n on n.oid = t.relnamespace
       where n.nspname = 'public'
       group by x.indrelid, x.indkey::text,
                coalesce(pg_get_expr(x.indpred, x.indrelid), ''),
                x.indisunique
      having count(*) > 1
    ) as pairs;

  if dupes is not null then
    raise exception 'FAILED: identical indexes, one of each pair is dead weight: %', dupes;
  end if;
  raise notice 'ok  no table carries two indexes doing one index''s work';
end $$;

rollback;
