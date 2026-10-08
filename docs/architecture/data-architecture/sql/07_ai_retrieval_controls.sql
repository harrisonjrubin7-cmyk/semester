-- PROPOSAL 07 · AI retrieval controls
--
-- What the research found (verified against code, see 09-ai-data-access.md):
--   * the T0-T6 `data_classification_rules` are NEVER consulted when context is assembled;
--   * `approved_source` has no classification and no per-person scope: any tenant user who
--     knows a source UUID can ask for it (subject to role/mode/course-policy checks);
--   * `consentIds: []` is hard-coded and `consent_record` is never read by the gateway;
--   * nothing in the AI path mentions age, minor or guardian;
--   * no embeddings, chunking, per-chunk ACL or ranking exists anywhere.
--
-- The rule this file enforces: RETRIEVAL RUNS IN THE CALLER'S SECURITY CONTEXT. The
-- gateway executes `ai.retrieve` on a connection that carries the user's JWT, so the
-- same row-level security that governs search governs what a model may be shown. A
-- service_role retrieval is a bypass and is not offered. (A SECURITY DEFINER retrieval
-- keyed on a subject id would have to re-implement private.classmate(), which reads
-- auth.uid() internally; re-implementing an ACL is how two engines drift apart.)
-- Requires: 01, 06.

create schema if not exists ai;
grant usage on schema ai to authenticated, service_role;

-- What a model may be asked to do with retrieved text, per purpose.
create table if not exists ai.purpose (
  purpose           text primary key check (purpose ~ '^[a-z][a-z_]{2,40}$'),
  max_tier          text not null check (max_tier in ('T0','T1','T2')),   -- T3 never; matches data_classification_rules
  allowed_audiences text[] not null check (allowed_audiences <@ array['owner','tenant','course','capability','person']),
  allows_minor      boolean not null default false,
  requires_course   boolean not null default false,
  status            text not null default 'draft' check (status in ('draft','approved','retired')),
  check (not ('person' = any (allowed_audiences)))   -- a model is never shown another person's profile
);
alter table ai.purpose enable row level security;
grant select on ai.purpose to authenticated;
drop policy if exists ai_purpose_read on ai.purpose;
create policy ai_purpose_read on ai.purpose for select to authenticated using (status = 'approved');

-- Embeddings only from models whose hosting the tenant can approve. meet.ts already refuses
-- third-party embeddings because the data would leave the device; this makes that a constraint.
create table if not exists ai.embedding_model (
  name       text primary key,
  hosting    text not null check (hosting in ('on_device','tenant_approved_region')),
  data_zone  text,
  dimensions integer not null check (dimensions between 64 and 4096),
  status     text not null default 'draft' check (status in ('draft','approved','retired')),
  check (hosting <> 'tenant_approved_region' or data_zone is not null)
);
alter table ai.embedding_model enable row level security;
grant select on ai.embedding_model to service_role;

create table if not exists ai.chunk (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references search.document(id) on delete cascade,   -- ACL, tenant, classification, lifetime are the document's
  chunk_ix       integer not null check (chunk_ix >= 0),
  content        text not null check (length(content) between 1 and 2000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  ai_eligible    boolean not null default false,   -- registry.ai_eligible AND, for owner documents, the student's own per-source choice
  embedding_model text references ai.embedding_model(name),
  embedded_at    timestamptz,
  content_tsv    tsvector generated always as (to_tsvector('simple', content)) stored,
  unique (document_id, chunk_ix),
  check ((embedding_model is null) = (embedded_at is null))
);
create index if not exists ai_chunk_tsv on ai.chunk using gin (content_tsv);
-- Dense retrieval, to be added when pgvector is enabled. NOT TESTED in this sandbox (the extension is not
-- in its contrib set), so it is a statement of intent, not a verified artifact:
--   create extension if not exists vector with schema extensions;
--   alter table ai.chunk add column embedding extensions.vector(1024);
--   create index ai_chunk_embedding on ai.chunk using hnsw (embedding extensions.vector_cosine_ops);
alter table ai.chunk enable row level security;
grant select on ai.chunk to authenticated;
grant all on ai.chunk to service_role;
drop policy if exists ai_chunk_read on ai.chunk;
-- Visible exactly when its document is: the subquery runs under the caller's RLS on search.document.
create policy ai_chunk_read on ai.chunk for select to authenticated using (
  ai_eligible and exists (select 1 from search.document d where d.id = document_id));

-- The gate. Definer so it can read policy tables the caller cannot; it reads only the caller's own tenant.
create or replace function ai.retrieval_gate(_purpose text)
returns table (allowed boolean, reason text)
language plpgsql stable security definer set search_path = pg_catalog, public, private, ai as $$
declare who uuid := (select auth.uid()); school text; p ai.purpose;
begin
  select * into p from ai.purpose where purpose = _purpose and status = 'approved';
  if not found then return query select false, 'no_such_purpose'; return; end if;
  school := private.school_of();
  if school is null then return query select false, 'no_tenant'; return; end if;
  if exists (select 1 from public.feature_kill_switch k
              where k.engaged and k.switch_key = 'kill.ai_generation' and (k.tenant_id is null or k.tenant_id = school)) then
    return query select false, 'kill_switch'; return; end if;
  if not exists (select 1 from public.tenant_feature_policy t
                  where t.tenant_id = school and t.capability = 'semester_intelligence' and t.state <> 'off') then
    return query select false, 'policy_off'; return; end if;
  if not p.allows_minor and not private.age_cleared(who) then
    return query select false, 'age_not_cleared'; return; end if;
  return query select true, 'ok';
end $$;
grant execute on function ai.retrieval_gate(text) to authenticated;

-- Retrieval. INVOKER: every table read below is read as the caller, under RLS.
create or replace function ai.retrieve(_purpose text, _q text, _course text default null, _limit integer default 8)
returns table (chunk_id uuid, document_id uuid, kind text, title text, content text,
               classification text, source_version text, score real)
language plpgsql stable security invoker set search_path = pg_catalog, public, ai, search as $$
declare p ai.purpose; ok boolean; why text; tiers constant text[] := array['T0','T1','T2','T3'];
begin
  select g.allowed, g.reason into ok, why from ai.retrieval_gate(_purpose) g;
  if not ok then return; end if;
  select * into p from ai.purpose where purpose = _purpose;
  if p.requires_course and _course is null then return; end if;
  return query
    select c.id, d.id, d.kind, d.title, c.content, d.classification, d.source_version,
           ts_rank_cd(c.content_tsv, plainto_tsquery('simple', _q))::real
      from ai.chunk c join search.document d on d.id = c.document_id
     where c.ai_eligible
       and d.classification = any (tiers[1:array_position(tiers, p.max_tier)])
       and d.audience = any (p.allowed_audiences)
       and (_course is null or d.audience <> 'course' or d.audience_ref = _course)
       and c.content_tsv @@ plainto_tsquery('simple', _q)
     order by 8 desc, d.title, c.chunk_ix
     limit least(greatest(_limit, 1), 20);
end $$;
grant execute on function ai.retrieve(text, text, text, integer) to authenticated;

-- What retrieval returned, as metadata. Written by the gateway (service role) after each call;
-- never text, never ids a person could be re-identified from. Same 180-day clock as gateway_audit.
create table if not exists ai.retrieval_log (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         text not null references public.schools(id),
  request_id        text not null check (request_id ~ '^[A-Za-z0-9._:-]{8,128}$'),   -- the gateway's correlation id
  actor_sha256      text not null check (actor_sha256 ~ '^[0-9a-f]{64}$'),           -- as audit_event: survives erasure, identifies no one
  purpose           text not null,
  policy_version    text,
  gate_reason       text not null,
  chunks_returned   integer not null check (chunks_returned >= 0),
  max_tier_returned text check (max_tier_returned in ('T0','T1','T2')),
  kinds_returned    text[] not null default '{}',
  at                timestamptz not null default now()
);
create index if not exists ai_retrieval_log_by_tenant_at on ai.retrieval_log (tenant_id, at desc);
alter table ai.retrieval_log enable row level security;
revoke all on ai.retrieval_log from public, anon, authenticated;
grant select, insert, delete on ai.retrieval_log to service_role;

insert into private.data_registry (table_schema, table_name, domain, record_class, classification, authority,
   retention_class, retention_days, deletion_mode, review_state) values
 ('ai','purpose','ai','platform_catalog','T0','semester','evidence',null,'append_only','proposed'),
 ('ai','embedding_model','ai','platform_catalog','T0','semester','evidence',null,'append_only','proposed'),
 ('ai','chunk','ai','derived','T2','derived','account_life',null,'erase_with_account','proposed'),
 ('ai','retrieval_log','ai','append_only_evidence','T1','semester','fixed_term',180,'append_only','proposed')
on conflict do nothing;
