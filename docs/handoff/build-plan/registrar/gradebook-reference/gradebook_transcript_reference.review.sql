-- Review patch for gradebook_transcript_reference.sql (uploaded). Fresh local project only. NOT RUN.
begin;
-- 1. Force RLS on the five exposed tables (enabled only → owner bypass).
do $$ declare t text; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'gb\_%' and c.relrowsecurity loop
    execute format('alter table public.%I force row level security', t);
  end loop; end $$;

-- 2. One draft per student × section × assessment (two drafts could race to release).
alter table public.gb_drafts add constraint one_draft_per_assessment unique (tenant_id, section_id, student_id, assessment_id);

-- 3. A release must match its draft's student, section and assessment (today only draft_id is tied).
alter table public.gb_drafts add constraint draft_identity unique (id, tenant_id, student_id, section_id, assessment_id);
alter table public.gb_releases add constraint release_matches_draft
  foreign key (draft_id, tenant_id, student_id, section_id, assessment_id)
  references public.gb_drafts (id, tenant_id, student_id, section_id, assessment_id);

-- 4. Overrides: the approver can't be the person who released (enforce in the release command, which knows both);
--    an expired override can't back a release.
create or replace function private.gb_release_override_valid() returns trigger language plpgsql set search_path = '' as $$
declare o record;
begin
  if new.override_id is null then return new; end if;
  select * into o from private.gb_overrides where id = new.override_id;
  if o.expires_at <= now() then raise exception 'override expired' using errcode = '23514'; end if;
  if o.draft_id <> new.draft_id or o.draft_version <> new.draft_version then raise exception 'override is for a different draft version' using errcode = '23514'; end if;
  if o.approver_id = new.released_by then raise exception 'releaser cannot approve their own override' using errcode = '23514'; end if;
  return new;
end $$;
create trigger gb_release_override_valid before insert on public.gb_releases for each row execute function private.gb_release_override_valid();

-- 5. One accepted final fact per student × section × record version; facts and releases are append-only.
alter table public.gb_academic_facts add constraint one_fact_per_version unique (tenant_id, student_id, section_id, record_version);
create or replace function private.gb_append_only() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'append-only' using errcode = '55000'; end $$;
create trigger gb_releases_append_only before update or delete on public.gb_releases for each row execute function private.gb_append_only();
create trigger gb_facts_append_only before update or delete on public.gb_academic_facts for each row execute function private.gb_append_only();
create trigger gb_releases_no_truncate before truncate on public.gb_releases for each statement execute function private.gb_append_only();
create trigger gb_facts_no_truncate before truncate on public.gb_academic_facts for each statement execute function private.gb_append_only();
do $$ begin if to_regclass('private.gb_audit_events') is not null then
  execute 'create trigger gb_audit_no_truncate before truncate on private.gb_audit_events for each statement execute function private.gb_append_only()';
end if; end $$;
commit;
-- Checks (branch): two drafts same assessment → 23505 · release with another student's draft → 23503 ·
-- expired / other-version / self-approved override → 23514 · update gb_releases → 55000 · truncate gb_releases → 55000
