-- PROPOSAL 05 · analytics boundary that cannot become a shadow system of record
--
-- Keeps the property supabase/analytics.sql already argues for ("every query reads
-- that one table and nothing else") and makes it structural instead of a habit:
--   * analytics objects live in their own schema, are DERIVED, and are readable by a
--     role that has no privilege anywhere else;
--   * a subject is a pseudonym that changes every epoch, so a metric cannot be joined
--     across epochs to rebuild a person;
--   * a count under k is withheld, not rounded;
--   * a guard fails the build if an analytics object exposes an identifier-shaped
--     column, or is a base table that is not registered as `derived`.
-- Requires: 01 (data_registry) and pgcrypto (already installed).

create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'analytics_reader') then
    create role analytics_reader nologin;
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'analytics_institution_reader') then
    create role analytics_institution_reader nologin;
  end if;
end $$;
grant usage on schema analytics to analytics_reader, analytics_institution_reader;

-- Epoch salt: one active row; rotating it makes every earlier pseudonym unlinkable to later ones.
create table if not exists private.analytics_salt (
  epoch      text primary key check (epoch ~ '^[0-9]{4}-(T[1-4]|S[12]|FA|SP|SU)$'),
  salt       bytea not null default gen_random_bytes(32),
  active     boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists analytics_salt_one_active on private.analytics_salt (active) where active;
alter table private.analytics_salt enable row level security;
revoke all on private.analytics_salt from public, anon, authenticated;

create or replace function analytics.subject_key(_subject uuid)
returns text language sql stable security definer set search_path = pg_catalog, public, private as $$
  select encode(hmac(_subject::text::bytea, s.salt, 'sha256'), 'hex')
    from private.analytics_salt s where s.active;
$$;
revoke all on function analytics.subject_key(uuid) from public, anon, authenticated;

-- A small count is withheld (null), never rounded: rounding leaks by subtraction.
create or replace function analytics.suppress_small(_n bigint, _k integer default 10)
returns bigint language sql immutable as $$ select case when _n >= _k then _n end $$;
grant execute on function analytics.suppress_small(bigint, integer) to analytics_reader;

create table if not exists analytics.metric_definition (
  metric_id      text primary key check (metric_id ~ '^[a-z][a-z0-9_]{2,60}$'),
  owner_role     text not null,
  meaning        text not null check (length(meaning) >= 20),
  grain          text not null check (grain in ('day','week','term','tenant_term')),
  audience       text not null default 'institution' check (audience in ('owner','institution')),
  -- The floor of ten binds what a UNIVERSITY can read (MIN_COHORT = 10; cohortfloor.test.ts holds every SQL
  -- floor to it). The owner's own pilot figures are read unsuppressed on purpose: ANALYTICS.md says the pilot
  -- is 5-10 people and supabase/analytics.sql already counts them directly. Suppressing there would blank the
  -- instrument without protecting anyone.
  min_cohort     integer not null default 10 check (min_cohort >= 1),
  check (audience <> 'institution' or min_cohort >= 10),
  max_tier       text not null default 'T2' check (max_tier in ('T0','T1','T2')),  -- T3 never reaches analytics
  source_events  text[] not null default '{}',   -- event types, or table names for pre-event metrics
  status         text not null default 'draft' check (status in ('draft','approved','retired')),
  reviewed_at    timestamptz,
  check (status <> 'approved' or reviewed_at is not null),
  -- Mirrors FORBIDDEN in app/src/lib/institution-ops.ts, which defineMetric() enforces in TypeScript.
  -- A parity test must hold the two lists equal (the same way cohortfloor.test.ts holds the floors).
  check (not (metric_id || '|' || array_to_string(source_events, '|') ~
    '(^|\|)(risk_score|reading_time|mouse|attention|ai_usage|integrity_flag|wellbeing_score|location)($|\|)'))
);
grant select on analytics.metric_definition to analytics_reader;

-- Worked examples over the table ANALYTICS.md already reads. The view runs with its owner's rights, so
-- neither reader needs any access to public.activity.
--   owner audience: the pilot's figure as it is today, unsuppressed (a pilot is 5-10 people).
--   institution audience: the same figure under the floor of ten; the only one an institution role may read.
create or replace view analytics.v_weekly_active_owner as
  select date_trunc('week', a.day)::date as week, count(distinct a.user_id)::bigint as active_accounts
    from public.activity a group by 1;
create or replace view analytics.v_weekly_active_institution as
  select date_trunc('week', a.day)::date as week,
         analytics.suppress_small(count(distinct a.user_id), 10) as active_accounts
    from public.activity a group by 1;
grant select on analytics.v_weekly_active_owner to analytics_reader;
grant select on analytics.v_weekly_active_institution to analytics_reader, analytics_institution_reader;
grant execute on function analytics.suppress_small(bigint, integer) to analytics_institution_reader;

-- Guard 1: identifier-shaped columns exposed by anything in analytics.
create or replace function analytics.identifier_leaks()
returns table (object_name text, column_name text, why text) language sql stable as $$
  select c.relname::text, a.attname::text,
         case when a.atttypid = 'uuid'::regtype then 'uuid column'
              else 'name matches identifier pattern' end
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'analytics' and c.relkind in ('r','v','m','p')
     and (a.atttypid = 'uuid'::regtype
          or a.attname ~* '(email|first_name|last_name|full_name|phone|user_id|person_id|account_id|student_id|ip_addr|device_id|handle)')
     and a.attname <> 'subject_key';
$$;

-- Guard 2: a base table in analytics must be registered as `derived` (rebuildable) or
-- `platform_catalog` (definitions, no personal data), so the warehouse can be dropped and
-- refilled without losing a fact. Any other class is a second system of record.
create or replace function analytics.non_derived_tables()
returns table (table_name text, registered_as text) language sql stable as $$
  select c.relname::text, r.record_class
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    left join private.data_registry r on r.table_schema = 'analytics' and r.table_name = c.relname
   where n.nspname = 'analytics' and c.relkind in ('r','p')
     and not (coalesce(r.record_class, '') = any (array['derived','platform_catalog']));
$$;

-- Guard 3: an analytics view may depend only on tables the registry marks analytics_eligible.
-- This is supabase/analytics.sql's founding rule ("a report that needs to read a student's work to
-- count how many students there are is a report that gets run less carefully each month") made
-- structural: the dependency is read from the catalog, so a view cannot quietly widen its reads.
create or replace function analytics.ineligible_sources()
returns table (view_name text, source_table text, registered_eligible boolean)
language sql stable as $$
  with recursive dep(view_oid, rel_oid) as (
    select v.oid, d.refobjid
      from pg_class v join pg_namespace vn on vn.oid = v.relnamespace and vn.nspname = 'analytics' and v.relkind in ('v','m')
      join pg_rewrite rw on rw.ev_class = v.oid
      join pg_depend d on d.objid = rw.oid and d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass and d.refobjid <> v.oid
    union
    select dep.view_oid, d.refobjid
      from dep join pg_class r on r.oid = dep.rel_oid and r.relkind in ('v','m')
      join pg_rewrite rw on rw.ev_class = r.oid
      join pg_depend d on d.objid = rw.oid and d.classid = 'pg_rewrite'::regclass and d.refclassid = 'pg_class'::regclass and d.refobjid <> r.oid)
  select v.relname::text, n.nspname || '.' || c.relname,
         coalesce(g.analytics_eligible, false)
    from dep join pg_class v on v.oid = dep.view_oid
    join pg_class c on c.oid = dep.rel_oid and c.relkind in ('r','p')
    join pg_namespace n on n.oid = c.relnamespace
    left join private.data_registry g on g.table_schema = n.nspname and g.table_name = c.relname
   where not coalesce(g.analytics_eligible, false)
     and n.nspname <> 'analytics';     -- reading other analytics tables is the guard above's business
$$;

-- The one source the pilot's three figures read today.
insert into private.data_registry (table_schema, table_name, domain, record_class, classification, authority,
   retention_class, retention_days, deletion_mode, analytics_eligible, review_state)
values ('public','activity','governance','append_only_evidence','T1','semester','fixed_term',400,'erase_with_account',true,'proposed')
on conflict (table_schema, table_name) do update set analytics_eligible = true, classification = 'T1';

insert into private.data_registry (table_schema, table_name, domain, record_class, review_state)
values ('analytics','metric_definition','governance','platform_catalog','proposed') on conflict do nothing;
insert into private.data_registry (table_schema, table_name, domain, record_class, classification, authority,
   retention_class, deletion_mode, analytics_eligible, review_state)
values ('private','analytics_salt','governance','tenant_config','T0','semester','evidence','append_only',false,'proposed')
on conflict do nothing;
