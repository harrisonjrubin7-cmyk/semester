-- PROPOSAL 10 · row stamping and one append-only guard
--
-- Measured: 88 tables carry `updated_at`; 53 have no BEFORE UPDATE trigger, 21 of those are
-- writable by a signed-in client. For those, `updated_at` is whatever the client or the insert
-- default said, so it cannot serve as a sync cursor or a freshness signal. `public.touch_updated_at()`
-- exists and is attached to 12 triggers. Separately there are seven independently written
-- append-only guards (academic_record_entries_append_only, dining_ledger_append_only,
-- gtm_append_only, human_overrides_append_only, migration_append_only, student_account_append_only,
-- ledger_chain_immutable) and about twenty one-off `stamp_*` functions.
--
-- This file adds ONE stamp and ONE guard. It replaces nothing: existing triggers stay until each is
-- retired by its own change. Requires nothing.

-- Server-owned bookkeeping. The client can neither forge nor skip it.
--   INSERT  row_version = 1, created_at/updated_at stamped when the columns exist.
--   UPDATE  updated_at = now, row_version + 1, created_at kept, and any column named in
--           TG_ARGV (typically tenant_id, user_id) may not change: a row never moves tenant or owner.
create or replace function private.stamp_row() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare patch jsonb; col text; o jsonb; n jsonb; ts timestamptz := clock_timestamp();
begin
  if tg_op = 'INSERT' then
    patch := jsonb_build_object('updated_at', ts, 'row_version', 1);
    if to_jsonb(new) ->> 'created_at' is null then patch := patch || jsonb_build_object('created_at', ts); end if;
  else
    o := to_jsonb(old); n := to_jsonb(new);
    foreach col in array tg_argv loop
      if o -> col is distinct from n -> col then
        raise exception '% of % is immutable', col, tg_table_name using errcode = '23514';
      end if;
    end loop;
    patch := jsonb_build_object('updated_at', ts, 'created_at', o -> 'created_at',
                                'row_version', coalesce((o ->> 'row_version')::bigint, 0) + 1);
  end if;
  -- jsonb_populate_record ignores keys the row has no column for, so one function serves every shape.
  new := jsonb_populate_record(new, to_jsonb(new) || patch);
  return new;
end $$;

-- One append-only guard. Argument: 'update', 'delete' or 'both' (default both).
-- An append-only table must not reference people by a foreign key to auth.users, or account erasure
-- would be refused by its own guard (the four tenant history tables show this today); evidence tables
-- key people by `*_sha256` or `student_ref` instead, and 01's conformance view flags the rest.
create or replace function private.refuse_mutation() returns trigger
language plpgsql as $$
declare scope text := coalesce(tg_argv[0], 'both');
begin
  if (tg_op = 'UPDATE' and scope in ('update','both')) or (tg_op = 'DELETE' and scope in ('delete','both')) then
    raise exception '% is append-only: % refused', tg_table_name, lower(tg_op) using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Retrofit helper. Legacy rows keep created_at NULL = "unknown", which is true; stamping them with the
-- migration time would be a lie that every later "age of record" report would repeat. New rows get now().
create or replace function private.add_row_conventions(_tbl regclass, _immutable text[] default '{}')
returns void language plpgsql as $$
begin
  execute format('alter table %s add column if not exists created_at timestamptz, add column if not exists updated_at timestamptz,
                  add column if not exists row_version bigint', _tbl);
  execute format('alter table %s alter column created_at set default now(), alter column updated_at set default now(),
                  alter column row_version set default 1', _tbl);
  execute format('drop trigger if exists zz_stamp_row on %s', _tbl);
  execute format('create trigger zz_stamp_row before insert or update on %s for each row execute function private.stamp_row(%s)',
                 _tbl, coalesce((select string_agg(quote_literal(c), ',') from unnest(_immutable) c), ''));
end $$;
revoke all on function private.stamp_row(), private.refuse_mutation(), private.add_row_conventions(regclass, text[]) from public, anon, authenticated;
