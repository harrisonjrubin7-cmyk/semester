-- Semester — what an imported fact says, stored beside where it came from.
--
-- Phase 5. `canonical_entity_references` recorded provenance and freshness but
-- not the fact itself, so a student could not be shown "Registration opens 2
-- November" with its source. `display` is the pipeline's mapped values for one
-- reference: only fields a mapping declared, flat, small, and never a name on
-- the never-ingest list, a reason, an amount, a balance or notes. RLS on the table is unchanged: a student's own row is
-- theirs alone; a tenant-wide T0/T1 row is readable in the school.
--
-- And a student may delete their own imported records. Revoking consent stops
-- the next sync from bringing them back (the pipeline checks consent per
-- personal record); deleting is how the ones already here go, now, without
-- waiting for a retention job. Nobody else — not the integration or university
-- administrator — may delete a student's row.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

alter table public.canonical_entity_references
  add column if not exists display jsonb not null default '{}'::jsonb;

alter table public.canonical_entity_references
  drop constraint if exists canonical_display_is_small_flat_object;
alter table public.canonical_entity_references
  add constraint canonical_display_is_small_flat_object check (
    jsonb_typeof(display) = 'object'
    and pg_column_size(display) <= 4096
    and not jsonb_path_exists(display, 'strict $.* ? (@.type() == "object" || @.type() == "array")')
  );

-- The same list the pipeline and the scope-key check refuse, applied to keys.
create or replace function private.refuse_never_ingest_keys()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare k text;
begin
  for k in select jsonb_object_keys(new.display) loop
    if lower(k) ~ '(^|_)(grades?|gpa|gradebook|roster|submissions?|accommodations?|health|counseling|conduct|instructor_notes|financial_aid|aid_award|reason|amount|balance|notes)(_|$)' then
      raise exception 'canonical display may not carry %', k using errcode = '23514';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.refuse_never_ingest_keys() from public, anon, authenticated;

drop trigger if exists refuse_never_ingest_keys on public.canonical_entity_references;
create trigger refuse_never_ingest_keys
  before insert or update of display on public.canonical_entity_references
  for each row execute function private.refuse_never_ingest_keys();

grant delete on table public.canonical_entity_references to authenticated;
drop policy if exists "students delete their own references" on public.canonical_entity_references;
create policy "students delete their own references" on public.canonical_entity_references
  for delete to authenticated using (subject_user_id = (select auth.uid()));

comment on column public.canonical_entity_references.display is
  'The mapped values of this fact, as the pipeline produced them: flat, at most 4 KB, never a never-ingest key, a reason, an amount or a balance.';
