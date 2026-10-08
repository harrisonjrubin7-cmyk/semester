-- PROPOSAL 02 · provenance columns, derivation lineage, source precedence
--
-- Today (measured on the migrated schema): 41 of 348 tables carry any source
-- column, the source vocabulary differs between tables (`source_type`,
-- `source_label`, `source_of_truth`, free text), and there is NO precedence rule
-- in code: precedence is a static display label per provider domain
-- (app/src/lib/integration/catalog.ts SOURCE_OF_TRUTH). This file gives all three.
--
-- Requires: 01 (private schema objects only; no dependency on its tables).

-- ── 1. One source vocabulary ──────────────────────────────────────────────
-- The five values source_records.source_type already allows, plus the two kinds
-- of derived record the audit's "derived record uses record" edge needs.
do $$ begin
  if to_regtype('private.source_kind') is null then
    create domain private.source_kind as text check (value in (
      'connected_institutional',  -- read from SIS/LMS/IdP/ERP through a connector
      'public_university',        -- published by the institution, public
      'manual_admin',             -- typed by an authorised institution admin
      'user_entered',             -- typed by the data subject
      'external_link',            -- a link to something Semester does not hold
      'derived',                  -- computed by Semester from other rows
      'ai_generated'));           -- produced by a model; never authoritative
  end if;
end $$;

-- ── 2. The provenance column set, applied the same way everywhere ─────────
-- Additive and nullable, so the previous app build still loads (ROLLBACK.md rule).
create or replace function private.add_provenance(_tbl regclass)
returns void language plpgsql as $$
begin
  execute format('alter table %s
    add column if not exists source_kind        private.source_kind,
    add column if not exists source_ref         text check (source_ref is null or length(source_ref) between 1 and 300),
    add column if not exists source_observed_at timestamptz,
    add column if not exists ingested_at        timestamptz,
    add column if not exists mapping_version    integer check (mapping_version is null or mapping_version > 0)', _tbl);
  -- A row from a connector must say which record, and when the source said so.
  execute format('alter table %s drop constraint if exists provenance_connected_complete', _tbl);
  execute format('alter table %s add constraint provenance_connected_complete
    check (source_kind is distinct from ''connected_institutional''
           or (source_ref is not null and source_observed_at is not null and ingested_at is not null))
    not valid', _tbl);   -- NOT VALID: existing rows are not rewritten; new writes are held to it
end $$;
revoke all on function private.add_provenance(regclass) from public, anon, authenticated;

-- ── 3. Derivation lineage: "derived record uses record" ───────────────────
-- One row per (derived, input) edge, not per value. A grade rollup, a Today
-- action, an AI answer, a recommendation each point at the exact input
-- versions that produced them, so a correction at the source can find
-- everything downstream of it (and a deletion can find what must be rebuilt).
create table if not exists public.lineage_edge (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          text not null references public.schools(id),
  derived_kind       text not null check (derived_kind ~ '^[a-z_]{1,60}$'),
  derived_id         text not null check (length(derived_id) between 1 and 200),
  input_kind         text not null check (input_kind ~ '^[a-z_]{1,60}$'),
  input_id           text not null check (length(input_id) between 1 and 200),
  input_version      text,             -- row_version, etag or content hash at read time
  derivation         text not null check (derivation ~ '^[a-z_.]{1,80}$'),
  derivation_version integer not null check (derivation_version > 0),
  created_at         timestamptz not null default now(),
  unique (tenant_id, derived_kind, derived_id, input_kind, input_id, derivation, derivation_version)
);
create index if not exists lineage_edge_by_input on public.lineage_edge (tenant_id, input_kind, input_id);
create index if not exists lineage_edge_by_derived on public.lineage_edge (tenant_id, derived_kind, derived_id);
alter table public.lineage_edge enable row level security;   -- deny by default; read through definer functions
revoke all on public.lineage_edge from anon, authenticated;

-- Everything downstream of one input, transitively, cycle-safe, depth-bounded.
create or replace function private.downstream_of(_tenant text, _kind text, _id text, _max_depth int default 6)
returns table (derived_kind text, derived_id text, depth int)
language sql stable security definer set search_path = pg_catalog, public as $$
  with recursive walk(derived_kind, derived_id, depth, path) as (
    select e.derived_kind, e.derived_id, 1, array[e.derived_kind || ':' || e.derived_id]
      from public.lineage_edge e
     where e.tenant_id = _tenant and e.input_kind = _kind and e.input_id = _id
    union
    select e.derived_kind, e.derived_id, w.depth + 1, w.path || (e.derived_kind || ':' || e.derived_id)
      from walk w
      join public.lineage_edge e on e.tenant_id = _tenant
       and e.input_kind = w.derived_kind and e.input_id = w.derived_id
     where w.depth < _max_depth and not (e.derived_kind || ':' || e.derived_id) = any (w.path))
  select distinct on (derived_kind, derived_id) derived_kind, derived_id, depth from walk order by derived_kind, derived_id, depth;
$$;
revoke all on function private.downstream_of(text, text, text, int) from public, anon, authenticated;

-- ── 4. Source precedence, as data, per tenant, per field group ────────────
-- Rank 1 wins. A tenant may reorder only among sources its contract allows;
-- the platform rows (tenant_id is null) are the floor and cannot be loosened.
create table if not exists private.source_precedence (
  tenant_id    text references public.schools(id),     -- null = platform default
  entity_type  text not null check (entity_type ~ '^[a-z_]{1,60}$'),
  field_group  text not null check (field_group ~ '^[a-z_]{1,60}$'),
  rank         integer not null check (rank between 1 and 7),
  source_kind  private.source_kind not null,
  student_owned boolean not null default false,  -- if true, no outranking source may overwrite; it may only raise a conflict
  created_at   timestamptz not null default now()
);
create unique index if not exists source_precedence_rank on private.source_precedence
  (coalesce(tenant_id, ''), entity_type, field_group, rank);
create unique index if not exists source_precedence_kind on private.source_precedence
  (coalesce(tenant_id, ''), entity_type, field_group, source_kind);
alter table private.source_precedence enable row level security;
revoke all on private.source_precedence from public, anon, authenticated;

-- Winning source among those that have a value. Tenant rows replace the platform
-- ranking for that (entity, field group) wholesale, never row-by-row, so a partial
-- override cannot silently promote one source above the floor.
create or replace function private.winning_source(_tenant text, _entity text, _group text, _have private.source_kind[])
returns private.source_kind language sql stable as $$
  with scope as (
    select case when exists (select 1 from private.source_precedence p
                              where p.tenant_id = _tenant and p.entity_type = _entity and p.field_group = _group)
                then _tenant else null end as t)
  select p.source_kind
    from private.source_precedence p, scope
   where p.entity_type = _entity and p.field_group = _group
     and p.tenant_id is not distinct from scope.t
     and p.source_kind = any (_have)
   order by p.rank limit 1;
$$;

-- Platform floor. Mirrors the authority table in 02-source-of-truth-matrix.md.
insert into private.source_precedence (tenant_id, entity_type, field_group, rank, source_kind, student_owned) values
  (null,'person','legal_identity',1,'connected_institutional',false),
  (null,'person','legal_identity',2,'manual_admin',false),
  (null,'person','legal_identity',3,'user_entered',false),
  (null,'person','preferences',1,'user_entered',true),
  (null,'enrollment','official_record',1,'connected_institutional',false),
  (null,'enrollment','official_record',2,'manual_admin',false),
  (null,'enrollment','official_record',3,'user_entered',false),
  (null,'course_section','schedule',1,'connected_institutional',false),
  (null,'course_section','schedule',2,'manual_admin',false),
  (null,'course_section','schedule',3,'public_university',false),
  (null,'course_section','schedule',4,'user_entered',false),
  (null,'assignment','due_date',1,'connected_institutional',false),
  (null,'assignment','due_date',2,'manual_admin',false),
  (null,'assignment','due_date',3,'derived',false),      -- syllabus-derived, shown as unverified
  (null,'assignment','due_date',4,'user_entered',false),
  (null,'personal_work','content',1,'user_entered',true),
  (null,'grade','official_grade',1,'connected_institutional',false),
  (null,'grade','official_grade',2,'manual_admin',false)  -- user_entered grades are estimates, never ranked here
on conflict do nothing;

-- ── 5. One reading of "is this student enrolled?" over today's representations ──
-- Three things are called enrollment (finding 4): `enrollments` (student-declared; drives
-- classmate visibility; no tenant, no source), `registration_enrollments` (registrar workflow;
-- Core mode), and `canonical_entity_references` type 'enrollment' (SIS twin; Connect mode).
-- This view reconciles the first two. The third joins the same shape when a connector is live:
-- it is a third `union all` branch with source_kind 'connected_institutional', and nothing else
-- here changes. It does not replace either table and changes no existing behaviour.
--
--   official_enrolled      registrar says enrolled
--   official_pending       registrar says waitlisted or pending_approval
--   official_not_enrolled  registrar says dropped, withdrawn, denied or left_waitlist
--   unverified             only the student says so (stays usable for classmate matching, never as official)
-- `conflict` is true when the student declares a course the registrar says they are not in.
-- Student-declared data is never rewritten by this view: the student keeps what they entered
-- and sees the official status beside it (02-source-of-truth-matrix.md, conflict outcomes).
create or replace view private.enrollment_reconciled as
with declared as (
  select e.user_id, split_part(e.code, '/', 1) as tenant_id, e.term, split_part(e.code, '/', 2) as course_code
    from public.enrollments e
), registrar as (
  select re.student as user_id, rs.tenant_id, rs.term, rs.course_code, re.state, re.updated_at
    from public.registration_enrollments re
    join public.registration_sections rs on rs.id = re.section_id
), keys as (
  select user_id, tenant_id, term, course_code from declared
  union
  select user_id, tenant_id, term, course_code from registrar
)
select k.user_id, k.tenant_id, k.term, k.course_code,
       (d.user_id is not null)                                         as declared,
       r.state                                                         as registrar_state,
       r.updated_at                                                    as registrar_updated_at,
       private.winning_source(k.tenant_id, 'enrollment', 'official_record',
         array_remove(array[case when r.user_id is not null then 'connected_institutional' end,
                            case when d.user_id is not null then 'user_entered' end], null)::private.source_kind[]) as winning_source,
       case when r.state = 'enrolled'                                              then 'official_enrolled'
            when r.state in ('waitlisted', 'pending_approval')                     then 'official_pending'
            when r.state in ('dropped', 'withdrawn', 'denied', 'left_waitlist')    then 'official_not_enrolled'
            else 'unverified' end                                                  as status,
       coalesce(d.user_id is not null and r.state in ('dropped', 'withdrawn', 'denied', 'left_waitlist'), false) as conflict   -- never null: a NULL here would vanish from `where not conflict`
  from keys k
  left join declared d on d.user_id = k.user_id and d.tenant_id = k.tenant_id and d.term = k.term and d.course_code = k.course_code
  left join registrar r on r.user_id = k.user_id and r.tenant_id = k.tenant_id and r.term = k.term and r.course_code = k.course_code;
revoke all on private.enrollment_reconciled from public, anon, authenticated;

-- ── 6. Crosswalk from the vocabularies that already exist ─────────────────────
-- Two source vocabularies are already in the schema and in use: `source_label` (institution_verified, imported,
-- student_entered, estimated, needs_review; on 8 tables) and `source_type` on source_records (connected_institutional,
-- public_university, manual_admin, user_entered, external_link). The CTO target-architecture pack calls the first
-- "SourceKind". `private.source_kind` above is a third only in the sense that it is the set a precedence rule needs;
-- this table says how each existing value maps, honestly marking the two that cannot be decided from the label alone.
-- A guard fails if either existing CHECK constraint gains a value this table does not know.
create table if not exists private.source_vocabulary (
  vocabulary text not null check (vocabulary in ('source_label', 'source_type')),
  value      text not null,
  tier       text not null check (tier in ('institutional', 'public', 'derived', 'user', 'link', 'none', 'ambiguous')),
  kind       private.source_kind,          -- null when the value alone cannot decide
  note       text,
  primary key (vocabulary, value)
);
alter table private.source_vocabulary enable row level security;
revoke all on private.source_vocabulary from public, anon, authenticated;
insert into private.source_vocabulary(vocabulary, value, tier, kind, note) values
  ('source_label','institution_verified','institutional', null,                       'a connector or an authorised admin; the provenance columns decide which'),
  ('source_label','imported',             'ambiguous',     null,                       'imported from an institution feed (institutional) or from the student''s own file (user)? OWNER DECISION'),
  ('source_label','student_entered',      'user',          'user_entered',             null),
  ('source_label','estimated',            'derived',       'derived',                  'always displayed as an estimate'),
  ('source_label','needs_review',         'none',          null,                       'carries no authority until reviewed'),
  ('source_type','connected_institutional','institutional','connected_institutional',  null),
  ('source_type','public_university',     'public',        'public_university',        null),
  ('source_type','manual_admin',          'institutional', 'manual_admin',             null),
  ('source_type','user_entered',          'user',          'user_entered',             null),
  ('source_type','external_link',         'link',          'external_link',            null)
on conflict do nothing;

create or replace function private.source_vocabulary_gaps()
returns table (vocabulary text, value text) language sql stable as $$
  select distinct a.attname::text, m[1]
    from pg_constraint k
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
    cross join lateral regexp_matches(pg_get_constraintdef(k.oid), '''([a-z_]+)''::text', 'g') m
   where k.contype = 'c' and k.connamespace in ('public'::regnamespace, 'private'::regnamespace)
     and a.attname in ('source_label', 'source_type')
     and not exists (select 1 from private.source_vocabulary v where v.vocabulary = a.attname and v.value = m[1]);
$$;
revoke all on function private.source_vocabulary_gaps() from public, anon, authenticated;
