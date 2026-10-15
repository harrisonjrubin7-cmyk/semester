-- PROPOSAL 09 · data-quality rules as data, with results kept
--
-- What exists (verified): integration reconciliation runs/discrepancies (per connector),
-- schema fingerprints and drift events (per connector), source freshness events, roster
-- import validation. What does not: a rule layer for Semester's OWN tables, and any record
-- of whether a rule held yesterday. Two facts motivate it: 35 single-column foreign keys between
-- tenant-scoped tables let a row reference another tenant's parent (generated rules detect it),
-- and the freshness SLAs live in two unlinked places (data-contracts.ts hours vs
-- integration_source_owners minutes).
--
-- Rules are rows. A run evaluates one rule and records the observation, so a trend and an
-- owner exist. Rule kinds are a closed list evaluated by this function; arbitrary SQL is not
-- accepted from a table (a rule table that can run SQL is a privilege-escalation path).
-- Requires: 01.

create table if not exists private.dq_rule (
  rule_id      text primary key check (rule_id ~ '^[a-z][a-z0-9_.]{3,80}$'),
  table_schema text not null check (table_schema in ('public','private','search','ai')),
  table_name   text not null,
  kind         text not null check (kind in ('null_rate','unique','orphan','stale','row_count','tenant_mismatch')),
  params       jsonb not null check (jsonb_typeof(params) = 'object'),
  severity     text not null check (severity in ('info','warn','block')),   -- block = fails a release or an import
  steward      text not null check (length(btrim(steward)) >= 2),
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);
create table if not exists private.dq_result (
  id          uuid primary key default gen_random_uuid(),
  rule_id     text not null references private.dq_rule(rule_id),
  observed    numeric not null,      -- the measurement: rate, count, age in seconds
  threshold   numeric not null,
  passed      boolean not null,
  detail      text,
  observed_at timestamptz not null default clock_timestamp()   -- not now(): two runs in one transaction must still order
);
create index if not exists dq_result_by_rule on private.dq_result (rule_id, observed_at desc);
alter table private.dq_rule   enable row level security;
alter table private.dq_result enable row level security;
revoke all on private.dq_rule, private.dq_result from public, anon, authenticated;

-- params by kind:
--   null_rate       {"column":"c","max_rate":0.01}
--   unique          {"columns":["a","b"]}                     observed = duplicate groups, threshold 0
--   orphan          {"column":"c","parent":"public.t","parent_column":"id"}   observed = child rows with no parent
--   stale           {"column":"ts","max_age_seconds":86400}   observed = age of newest row
--   row_count       {"min":1,"max":1000000}
--   tenant_mismatch {"column":"c","parent":"public.t","parent_column":"id","parent_tenant_column":"tenant_id"}   child tenant <> parent tenant
create or replace function private.dq_run_rule(_rule_id text)
returns private.dq_result language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare r private.dq_rule; obs numeric; thr numeric; ok boolean; tbl text; res private.dq_result;
begin
  select * into r from private.dq_rule where rule_id = _rule_id and enabled;
  if not found then raise exception 'no enabled rule %', _rule_id using errcode = 'P0002'; end if;
  tbl := format('%I.%I', r.table_schema, r.table_name);
  if r.kind = 'null_rate' then
    thr := (r.params ->> 'max_rate')::numeric;
    execute format('select coalesce(avg((%I is null)::int), 0) from %s', r.params ->> 'column', tbl) into obs;
    ok := obs <= thr;
  elsif r.kind = 'unique' then
    thr := 0;
    execute format('select count(*) from (select 1 from %s group by %s having count(*) > 1) d', tbl,
      (select string_agg(format('%I', c), ', ') from jsonb_array_elements_text(r.params -> 'columns') c)) into obs;
    ok := obs = 0;
  elsif r.kind = 'orphan' then
    thr := 0;
    execute format('select count(*) from %s c where c.%I is not null and not exists (select 1 from %s p where p.%I = c.%I)',
      tbl, r.params ->> 'column', r.params ->> 'parent', r.params ->> 'parent_column', r.params ->> 'column') into obs;
    ok := obs = 0;
  elsif r.kind = 'stale' then
    thr := (r.params ->> 'max_age_seconds')::numeric;
    execute format('select coalesce(extract(epoch from now() - max(%I)), %s) from %s', r.params ->> 'column', thr + 1, tbl) into obs;
    ok := obs <= thr;
  elsif r.kind = 'row_count' then
    thr := coalesce((r.params ->> 'max')::numeric, 9e18);
    execute format('select count(*) from %s', tbl) into obs;
    ok := obs >= coalesce((r.params ->> 'min')::numeric, 0) and obs <= thr;
  elsif r.kind = 'tenant_mismatch' then
    thr := 0;
    execute format('select count(*) from %s c join %s p on p.%I = c.%I where c.tenant_id is distinct from p.%I',
      tbl, r.params ->> 'parent', r.params ->> 'parent_column', r.params ->> 'column', r.params ->> 'parent_tenant_column') into obs;
    ok := obs = 0;
  end if;
  insert into private.dq_result(rule_id, observed, threshold, passed) values (r.rule_id, obs, thr, ok) returning * into res;
  return res;
end $$;
revoke all on function private.dq_run_rule(text) from public, anon, authenticated;
grant execute on function private.dq_run_rule(text) to service_role;

-- A release or an import is blocked by the latest result of any enabled `block` rule that failed.
create or replace view private.dq_blocking as
  select distinct on (r.rule_id) r.rule_id, r.table_schema, r.table_name, r.steward, x.observed, x.threshold, x.observed_at
    from private.dq_rule r join private.dq_result x on x.rule_id = r.rule_id
   where r.enabled and r.severity = 'block'
   order by r.rule_id, x.observed_at desc;
create or replace view private.dq_blocking_failed as
  select b.* from private.dq_blocking b
   where exists (select 1 from private.dq_result x where x.rule_id = b.rule_id and x.observed_at = b.observed_at and not x.passed);
revoke all on private.dq_blocking, private.dq_blocking_failed from public, anon, authenticated;

insert into private.data_registry (table_schema, table_name, domain, record_class, review_state) values
 ('private','dq_rule','governance','tenant_config','proposed'),
 ('private','dq_result','governance','append_only_evidence','proposed')
on conflict do nothing;
