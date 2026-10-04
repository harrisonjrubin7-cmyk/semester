-- PROPOSAL 06 · server-side search index with the security filter in the database
--
-- Today (verified): search is lib/find.ts over the user's own in-memory state; nothing
-- server-side exists (no tsvector, no trigram, no GIN anywhere in 171 migrations), and
-- people, listings, reviews, dining and community are not searchable at all. ADR 0006
-- says new kinds join the ONE ranker; ADR docs/architecture/multi-tenant-isolation.md
-- says retrieval must share the tenant boundary. This is that shared boundary.
--
-- Design rules (each is tested in tests/06_search.test.sql):
--   1. The index holds a title and a short, pre-reviewed `snippet_safe`. Never a body.
--   2. T3 education records are never indexed (CHECK). A grade is looked up, not searched.
--   3. Visibility is NOT baked into the index. It is decided at query time by RLS, using
--      the same helpers the base tables use, so a revoked share, a new block, a withdrawn
--      enrolment or a minor's age status takes effect on the next keystroke.
--   4. The query function is SECURITY INVOKER: RLS applies to the caller, always.
--   5. The score tiers copy lib/find.ts (100 exact, 80 prefix, 60 word, 40 substring,
--      20 text, 8 near-miss) so server and client rank alike.
-- Requires: 01. pg_trgm (available on Supabase; contrib on a plain Postgres).

create extension if not exists pg_trgm with schema public;
create schema if not exists search;
grant usage on schema search to authenticated, service_role;

create table if not exists search.document (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      text not null references public.schools(id),
  kind           text not null check (kind ~ '^[a-z_]{2,40}$'),
  source_id      text not null check (length(source_id) between 1 and 200),
  owner_user_id  uuid references auth.users(id) on delete cascade,
  audience       text not null check (audience in ('owner','tenant','course','capability','person')),
  audience_ref   text,      -- course: term || '/' || code exactly as enrollments holds them ('2026FA/zz-a/CS 101'); capability: a capability name
  classification text not null check (classification in ('T0','T1','T2')),
  title          text not null check (length(btrim(title)) between 1 and 200),
  snippet_safe   text check (snippet_safe is null or length(snippet_safe) <= 200),
  source_version text,
  indexed_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  tsv tsvector generated always as (
    setweight(to_tsvector('simple', title), 'A') || setweight(to_tsvector('simple', coalesce(snippet_safe, '')), 'B')) stored,
  unique (tenant_id, kind, source_id),
  check (audience <> 'owner' or owner_user_id is not null),
  check (audience <> 'person' or owner_user_id is not null),
  check ((audience in ('course','capability')) = (audience_ref is not null))
);
create index if not exists search_document_tsv on search.document using gin (tsv);
create index if not exists search_document_title_trgm on search.document using gin (lower(title) gin_trgm_ops);
create index if not exists search_document_tenant_kind on search.document (tenant_id, kind) where deleted_at is null;
create index if not exists search_document_owner on search.document (owner_user_id) where owner_user_id is not null;

alter table search.document enable row level security;
grant select on search.document to authenticated;                       -- indexing writes are service_role only
grant all on search.document to service_role;

drop policy if exists search_document_read on search.document;
create policy search_document_read on search.document for select to authenticated using (
  deleted_at is null
  and tenant_id = private.school_of()
  and (
       audience = 'owner'      and owner_user_id = (select auth.uid())
    or audience = 'tenant'
    or audience = 'course'     and exists (select 1 from public.enrollments e
                                            where e.user_id = (select auth.uid())
                                              and e.term || '/' || e.code = audience_ref)
    or audience = 'capability' and private.has_capability_anywhere(audience_ref)
    or audience = 'person'     and (owner_user_id = (select auth.uid())
                                    or (private.classmate(owner_user_id)
                                        and private.age_cleared(owner_user_id)
                                        and not exists (select 1 from public.blocks b
                                                         where (b.user_id = (select auth.uid()) and b.blocked = owner_user_id)
                                                            or (b.user_id = owner_user_id and b.blocked = (select auth.uid())))))
  )
);

-- One ranker's tiers, server side. Wildcards in the query are literal.
create or replace function search.query(_q text, _kinds text[] default null, _limit integer default 20)
returns table (kind text, source_id text, title text, snippet text, score integer)
language sql stable security invoker set search_path = pg_catalog, public, search as $$
  with q as (
    select btrim(_q) as raw,
           replace(replace(replace(lower(btrim(_q)), '\', '\\'), '%', '\%'), '_', '\_') as lit,
           plainto_tsquery('simple', btrim(_q)) as tsq
  ), scored as (
    select d.kind, d.source_id, d.title, d.snippet_safe,
           case
             when lower(d.title) = lower(q.raw)                               then 100
             when lower(d.title) like q.lit || '%'                            then 80
             when lower(d.title) ~ ('\m' || regexp_replace(lower(q.raw), '([\\.^$|?*+()\[\]{}])', '\\\1', 'g')) then 60
             when lower(d.title) like '%' || q.lit || '%'                     then 40
             when d.tsv @@ q.tsq                                              then 20
             when similarity(lower(d.title), lower(q.raw)) > 0.3              then 8
           end as score
      from search.document d, q
     where length(q.raw) >= 2 and (_kinds is null or d.kind = any (_kinds))
  )
  select kind, source_id, title, snippet_safe, score from scored
   where score is not null order by score desc, title limit least(greatest(_limit, 1), 50);
$$;
grant execute on function search.query(text, text[], integer) to authenticated;

-- Removal is a tombstone first (instant, hides it), a delete on the next sweep.
create or replace function search.remove(_tenant text, _kind text, _source_id text)
returns void language sql security definer set search_path = pg_catalog, search as $$
  update search.document set deleted_at = now() where tenant_id = _tenant and kind = _kind and source_id = _source_id;
$$;
revoke all on function search.remove(text, text, text) from public, anon, authenticated;
grant execute on function search.remove(text, text, text) to service_role;

insert into private.data_registry (table_schema, table_name, domain, record_class, classification, authority,
   retention_class, deletion_mode, search_indexable, review_state)
values ('search','document','governance','derived','T2','derived','account_life','erase_with_account',false,'proposed')
on conflict do nothing;
