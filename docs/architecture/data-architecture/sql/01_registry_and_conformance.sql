-- PROPOSAL 01 · data registry and convention conformance
--
-- Not a migration. Lives under docs/ so merging it applies nothing; applying it
-- to production needs the owner's approval (docs/DATA-MIGRATION-PLAN.md, "Procedure
-- for any schema change"). Validated by building every migration on PostgreSQL 16,
-- applying this file, then running tests/01_registry.test.sql. Re-run both after
-- any change to a migration this file reads.
--
-- What it adds: ONE row per table saying what the table is (domain, record class,
-- classification, authority, retention, deletion, and whether search, AI and
-- analytics may read it), and a view that fails the build when a table does not
-- meet the convention for its class. RETENTION.md remains the human statement;
-- this is the machine-checkable twin, held to it by the same two-way test.

create table if not exists private.data_registry (
  table_schema    text not null check (table_schema in ('public', 'private', 'analytics', 'search', 'ai')),
  table_name      text not null,
  domain          text not null check (domain in (
    'identity','academic','learning','productivity','campus','family','finance',
    'career','alumni','marketplace','support','governance',
    'integration','ai','commercial')),
  record_class    text check (record_class in (
    'tenant_record',        -- institution-scoped row: tenant_id NOT NULL, FK schools
    'account_record',       -- student-owned row: FK auth.users
    'tenant_config',        -- tenant-scoped configuration, versioned
    'platform_catalog',     -- same for every tenant; no personal data
    'append_only_evidence', -- audit/ledger/receipt: never updated by a client role
    'ephemeral',            -- nonce, rate window, queue: has an expiry
    'derived')),            -- rebuildable from other rows
  classification  text check (classification in ('T0','T1','T2','T3')),  -- T4+ is never stored
  authority       text check (authority in ('student','institution','provider','semester','derived')),
  retention_class text check (retention_class in (
    'until_deleted',        -- the student's promise (lib/privacy.ts): never aged out
    'account_life','fixed_term','legal_minimum','evidence','ephemeral','school_rule')),
  retention_days  integer check (retention_days > 0),
  deletion_mode   text check (deletion_mode in (
    'erase_with_account','tombstone','append_only','tenant_offboarding','school_rule')),
  search_indexable   boolean not null default false,
  ai_eligible        boolean not null default false,
  analytics_eligible boolean not null default false,
  steward         text,
  review_state    text not null default 'proposed' check (review_state in ('proposed','steward_confirmed')),
  primary key (table_schema, table_name),
  -- A confirmed row is complete. A proposed row may be partial, and is counted as such.
  check (review_state = 'proposed' or (
    record_class is not null and classification is not null and authority is not null
    and retention_class is not null and deletion_mode is not null and steward is not null)),
  -- A clock needs a number; a number needs a clock.
  check ((retention_class in ('fixed_term','legal_minimum')) = (retention_days is not null)),
  -- The student's work is never aged out, and is never an analytics or search-of-others source.
  check (not (retention_class = 'until_deleted' and deletion_mode = 'tombstone' and retention_days is not null)),
  check (not (classification = 'T3' and analytics_eligible))
);
alter table private.data_registry enable row level security;   -- no policy: definer/service only
revoke all on private.data_registry from public, anon, authenticated;

create table if not exists private.convention_exemption (
  table_schema text not null,
  table_name   text not null,
  rule         text not null,
  reason       text not null check (length(btrim(reason)) >= 10),
  review_by    date not null,
  primary key (table_schema, table_name, rule)
);
alter table private.convention_exemption enable row level security;
revoke all on private.convention_exemption from public, anon, authenticated;

-- Registry and catalog must agree in both directions (the RETENTION.md rule, in SQL).
create or replace view private.data_registry_gaps as
  select 'unregistered'::text as kind, n.nspname::text as table_schema, c.relname::text as table_name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r','p') and not c.relispartition and n.nspname in ('public','private','analytics','search','ai')
     and not exists (select 1 from private.data_registry r
                      where r.table_schema = n.nspname and r.table_name = c.relname)
  union all
  select 'orphan_registry', r.table_schema, r.table_name
    from private.data_registry r
   where not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = r.table_schema and c.relname = r.table_name
                        and c.relkind in ('r','p'))
  union all
  select 'unconfirmed', table_schema, table_name
    from private.data_registry where review_state = 'proposed';

-- One row per (table, broken rule). An exemption silences a rule only until review_by.
create or replace view private.convention_violations as
with t as (
  select r.table_schema, r.table_name, r.record_class, r.classification, c.oid,
         exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped) as has_tenant,
         exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and a.attnotnull) as tenant_nn,
         exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'f' and k.confrelid = 'public.schools'::regclass) as tenant_fk,
         exists (select 1 from pg_constraint k where k.conrelid = c.oid and k.contype = 'f' and k.confrelid = 'auth.users'::regclass) as owner_fk,
         exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname in ('created_at','occurred_at','received_at','captured_at','placed_at','detected_at') and not a.attisdropped) as has_created,
         exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped) as has_updated,
         has_table_privilege('authenticated', c.oid, 'UPDATE') as client_updatable
    from private.data_registry r
    join pg_namespace n on n.nspname = r.table_schema
    join pg_class c on c.relnamespace = n.oid and c.relname = r.table_name and c.relkind in ('r','p')
), v as (
  select table_schema, table_name, 'tenant_id_not_null' as rule from t where record_class = 'tenant_record' and not tenant_nn
  union all select table_schema, table_name, 'tenant_fk_to_schools' from t where record_class = 'tenant_record' and not tenant_fk
  union all select table_schema, table_name, 'owner_fk_to_auth_users' from t where record_class = 'account_record' and not owner_fk
  union all select table_schema, table_name, 'created_at' from t where record_class in ('tenant_record','account_record','tenant_config','append_only_evidence') and not has_created
  union all select table_schema, table_name, 'updated_at' from t where record_class in ('tenant_record','account_record','tenant_config') and not has_updated
  union all select table_schema, table_name, 'evidence_not_client_updatable' from t where record_class = 'append_only_evidence' and client_updatable
  union all select table_schema, table_name, 't3_needs_scope' from t where classification = 'T3' and not (has_tenant or owner_fk)
)
select v.* from v
 where not exists (select 1 from private.convention_exemption e
                    where e.table_schema = v.table_schema and e.table_name = v.table_name
                      and e.rule = v.rule and e.review_by >= current_date);
revoke all on private.data_registry_gaps, private.convention_violations from public, anon, authenticated;

-- The registry registers itself, or its own gap view reports it.
insert into private.data_registry (table_schema, table_name, domain, record_class, review_state) values
  ('private','data_registry','governance','tenant_config','proposed'),
  ('private','convention_exemption','governance','tenant_config','proposed')
on conflict do nothing;
