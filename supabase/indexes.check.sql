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
-- ## It asks about `private` as well as `public`
--
-- It used to ask only about `public`. On 30 September 2026 the live linter
-- reported four unindexed foreign keys, all `tenant_id` references from
-- tables in `private` (`domain_outbox_events`, `gateway_intelligence_action`,
-- `gateway_intelligence_audit`, `gateway_review`), and this file was green
-- throughout: the schema it was asked about had none. Deleting a school
-- scans a child table once per row without one, and `private` is where the
-- gateway and outbox tables live. `20260930232000_advisor_reconciliation.sql`
-- covers the four; the rule now sees both schemas.
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
-- Partial indexes are not accepted, with one exception. One with a `where`
-- clause covers only the rows it names, and the parent-side check has to prove
-- something about every row, so a partial index would leave the scan in place
-- while looking like cover in the catalogue.
--
-- The exception is an index whose predicate is exactly "the key's columns are
-- not null". The parent-side check is `where fk = $1`, `=` is strict, and a
-- null key references nothing, so every row the check can ever need is in such
-- an index. `private.direct_rate_limit` has two foreign keys, each covered
-- that way, because a row carries one subject or the other. The live linter
-- counts them as covered and this file used to disagree with it. The last
-- block below does not take that on trust: it builds the shape and asks the
-- planner whether it uses the index.
--
--   How to run it: supabase/check.sh indexes

begin;

-- The predicate Postgres deparses for "all of these columns are not null", in
-- key order: `(a IS NOT NULL)` for one column, `((a IS NOT NULL) AND (b IS NOT NULL))` for more.
create or replace function pg_temp.not_null_predicate(rel oid, cols int2[])
returns text language sql stable as $$
  select case when array_length(cols, 1) = 1 then '(' || max(t.term) || ')'
              else '(' || string_agg('(' || t.term || ')', ' AND ' order by t.ord) || ')' end
    from (
      select k.ord, a.attname || ' IS NOT NULL' as term
        from unnest(cols) with ordinality k(attnum, ord)
        join pg_attribute a on a.attrelid = rel and a.attnum = k.attnum
    ) t;
$$;

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
         and n.nspname in ('public', 'private')
         and not exists (
           select 1
             from pg_index x
            where x.indrelid = c.conrelid
              -- A prefix, in order: the key's columns are the first
              -- `array_length(conkey)` of the index's.
              and (x.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
              -- Not a partial index, unless the predicate is only that the
              -- key is not null. See the header.
              and (x.indpred is null
                   or pg_get_expr(x.indpred, x.indrelid) = pg_temp.not_null_predicate(c.conrelid, c.conkey))
         )
    ) as uncovered;

  if bare is not null then
    raise exception
      'FAILED: foreign keys with no covering index: % — add one per column, '
      'or say here why the scan is acceptable', bare;
  end if;
  raise notice 'ok  every foreign key in public and private has an index covering it';
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
       where n.nspname in ('public', 'private')
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

-- ── Every table has a primary key ────────────────────────────────────────
--
-- The linter's `no_primary_key`. A table without one cannot be replicated by
-- logical decoding with row identity, cannot be deduplicated by a tool that
-- needs a row's name, and gives a support engineer nothing to point at. The
-- live project had two on 30 September (`private.site_lead_hits`,
-- `private.console_audit_verification`), both tables whose writers never
-- needed to name a row, which is how a table ends up without one.
--
-- Asked over both schemas and every ordinary or partitioned table, for the
-- reason this whole file gives: the fault is an omission.

do $$
declare
  bare text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by n.nspname, c.relname)
    into bare
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and n.nspname in ('public', 'private')
     -- A partition takes its key from its parent.
     and not c.relispartition
     and not exists (select 1 from pg_index x where x.indrelid = c.oid and x.indisprimary)
     -- Tables an extension owns are the extension's business.
     and not exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'e');

  if bare is not null then
    raise exception 'FAILED: tables with no primary key: % — add an identity column, or say here why the table is keyless', bare;
  end if;
  raise notice 'ok  every table in public and private has a primary key';
end $$;

-- ── The exception is true, not assumed ───────────────────────────────────
--
-- Build the shape (a nullable foreign key covered by a `where … is not null`
-- index), give it enough rows that a scan is the wrong plan, and ask for the
-- generic plan of the parent-side check. It must use the partial index.

do $$
declare
  plan text := '';
  line text;
begin
  create table public.zz_fk_parent (id int primary key);
  create table public.zz_fk_child (
    id int primary key,
    parent int references public.zz_fk_parent (id) on delete cascade
  );
  create index zz_fk_child_by_parent on public.zz_fk_child (parent) where parent is not null;
  insert into public.zz_fk_parent select g from generate_series(1, 200) g;
  insert into public.zz_fk_child select g, 1 + g % 200 from generate_series(1, 20000) g;
  analyze public.zz_fk_parent;
  analyze public.zz_fk_child;

  set local plan_cache_mode = force_generic_plan;
  prepare zz_ri(int) as select 1 from only public.zz_fk_child where parent = $1;
  for line in execute 'explain (costs off) execute zz_ri(7)' loop
    plan := plan || line || E'\n';
  end loop;
  deallocate zz_ri;

  drop table public.zz_fk_child;
  drop table public.zz_fk_parent;

  if plan !~ 'zz_fk_child_by_parent' then
    raise exception 'FAILED: the parent-side check did not use the partial not-null index, so the exception in the header is wrong:%', E'\n' || plan;
  end if;
  raise notice 'ok  a foreign key covered by a where-not-null partial index is searched by it';
end $$;

rollback;
