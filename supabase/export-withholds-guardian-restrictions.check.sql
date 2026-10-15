-- An account export must not carry a guardian restriction.
--
-- A school's staff may record, on a guardian link, that a court order applies
-- and what the front office is to do about it (`guardian_link_restrictions`).
-- Its policy gives the row to staff alone: the guardian and the student are
-- both refused (k12-guardians.check.sql, "the guardian cannot read the
-- restriction about them" and "the student cannot read it either").
--
-- `private.account_export` is `security definer`, so it is not held to that
-- policy. It follows every `on delete cascade` from the account's own rows, a
-- few levels down, and `guardian_link_restrictions.link_id` cascades from
-- `guardian_links`, which cascades from both `student_id` and `guardian_id`.
-- So the question this file asks is whether the walk hands the one person a
-- restriction is *about* the thing the policy keeps from them. The export's
-- `withheld` list names exactly three columns, and none of them is this one.
--
-- This was found by reading the SQL, not by running it, which is why the file
-- exists: it is the run. Three things hold it to account.
--
--   * It looks for the restriction's note by its text, anywhere in the file.
--     Looking for a table name would miss a restriction folded in under
--     another key; the note's words cannot be renamed.
--   * It reads the export as the student *and* as the guardian. They are
--     different files, because the walk starts from a different column.
--   * It has a control. A probe that finds nothing is also what a probe
--     looking in the wrong place finds, so each file is first shown to hold
--     what it should: the link, and the person's own handle.
--
-- LOCAL/DISPOSABLE DATABASES ONLY. Inserts synthetic users and schools, then
-- rolls everything back. Run through `supabase/check.sh
-- export-withholds-guardian-restrictions`.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  insert into public.profiles (user_id, handle) values (who, split_part(address, '@', 1));
  update public.profiles set school_id = school where user_id = who;
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  staff    uuid;
  teen     uuid;
  parent   uuid;
  link     uuid;
  note     text := 'Pick-up only by the other parent, per the order of 2026-03-02.';
  student_file  jsonb;
  guardian_file jsonb;
  n        bigint;
begin
  insert into public.schools (id, name, email_domains, edition) values
    ('export-k12-check', 'Export Check High School', array['export-check.example'], 'k12');

  staff  := pg_temp.newuser('office@export-check.example', 'export-k12-check');
  teen   := pg_temp.newuser('teen.export@export-check.example', 'export-k12-check');
  parent := pg_temp.newuser('parent.export@home-check.example', null);

  -- The fixture makes every account an adult; make the student a minor.
  update private.account_ages set minor_until = current_date + 400 where user_id = teen;

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (staff, 'university_staff', 'school', 'export-k12-check', 'institution');

  perform pg_temp.become(staff);
  insert into public.guardian_links (school_id, student_id, guardian_id, relationship, rights)
  values ('export-k12-check', teen, parent, 'parent', 'full')
  returning id into link;
  insert into public.guardian_link_restrictions (link_id, school_id, court_order, note)
  values (link, 'export-k12-check', true, note);
  reset role;

  -- The restriction exists, and the people it concerns cannot read it.
  select count(*) into n from public.guardian_link_restrictions where link_id = link and court_order and written_by = staff;
  perform pg_temp.counted('the restriction is on file', n, 1);

  perform pg_temp.become(teen);
  select count(*) into n from public.guardian_link_restrictions;
  reset role;
  perform pg_temp.counted('the student cannot read it through the table', n, 0);

  perform pg_temp.become(parent);
  select count(*) into n from public.guardian_link_restrictions;
  reset role;
  perform pg_temp.counted('the guardian cannot read it through the table', n, 0);

  -- ── Each person's export ───────────────────────────────────────────────

  perform pg_temp.become(teen);
  student_file := public.export_my_data();
  reset role;

  perform pg_temp.become(parent);
  guardian_file := public.export_my_data();
  reset role;

  -- Controls: the probe is looking in files that hold what they should.
  perform pg_temp.counted('control: the student''s file holds their own handle',
    (student_file::text like '%teen.export%')::int, 1);
  perform pg_temp.counted('control: the student''s file holds the guardian link',
    (jsonb_array_length(coalesce(student_file -> 'tables' -> 'guardian_links', '[]'::jsonb)))::bigint, 1);
  perform pg_temp.counted('control: the guardian''s file holds their own handle',
    (guardian_file::text like '%parent.export%')::int, 1);
  perform pg_temp.counted('control: the guardian''s file holds the link about them',
    (jsonb_array_length(coalesce(guardian_file -> 'tables' -> 'guardian_links', '[]'::jsonb)))::bigint, 1);

  -- The property.
  perform pg_temp.counted('the student''s export does not carry the restriction''s note',
    (student_file::text like '%Pick-up only by the other parent%')::int, 0);
  perform pg_temp.counted('the guardian''s export does not carry the restriction''s note',
    (guardian_file::text like '%Pick-up only by the other parent%')::int, 0);
  perform pg_temp.counted('the student''s export has no restriction rows at all',
    (jsonb_array_length(coalesce(student_file -> 'tables' -> 'guardian_link_restrictions', '[]'::jsonb)))::bigint, 0);
  perform pg_temp.counted('the guardian''s export has no restriction rows at all',
    (jsonb_array_length(coalesce(guardian_file -> 'tables' -> 'guardian_link_restrictions', '[]'::jsonb)))::bigint, 0);
end $$;

rollback;
