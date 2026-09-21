-- What removing a university does to the people who studied there.
--
-- `tenancy.check.sql` already covers most of the schools table, and covers it
-- well: that `claim_school()` refuses an address the school does not publish,
-- that an unconfirmed address claims nothing, that the domain compare ignores
-- case on both sides and reads from the last `@` rather than the first, that a
-- school publishing no domains admits nobody, and that `school_id` is pinned
-- against both UPDATE and INSERT so the column records a fact rather than a
-- claim. None of that is repeated here.
--
-- Three things about the table are left, and the third is why this file exists.
-- **Nothing in this directory deletes a school.**
--
--   * It is readable signed out. The client's first launch has no session and
--     `data/schools/index.ts` guarantees the whole app offline, so a school
--     profile the server hides is a first launch that silently loses the
--     university the app was built for.
--   * An administrator can write one. Every refusal `tenancy.check.sql` proves
--     would also pass against a table nobody can maintain at all, which is the
--     same green-for-the-wrong-reason this repository keeps finding in its own
--     instruments.
--   * **Removing a school keeps its students.** `profiles.school_id` is
--     `on delete set null`, so closing a university clears a column. Under
--     `on delete cascade` — one word away, and the more obvious spelling — it
--     deletes the profile of every student who ever attended, because somebody
--     tidied a campus record.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

do $$
declare
  admin  uuid;
  person uuid;
  n      bigint;
  got    text;
begin
  set local role postgres;
  admin  := pg_temp.newuser('ada@vanderbilt.edu');
  person := pg_temp.newuser('bo@vanderbilt.edu');
  insert into public.app_admins (user_id, note) values (admin, 'founder');
  insert into public.profiles (user_id, handle) values (admin, 'ada'), (person, 'bo');

  insert into public.schools (id, name, short_name, email_domains)
  values ('vanderbilt', 'Vanderbilt University', 'Vanderbilt', array['vanderbilt.edu']);

  -- ── Readable signed out ─────────────────────────────────────────────────

  perform pg_temp.become_anon();
  select count(*) into n from public.schools;
  perform pg_temp.counted('a signed-out visitor reads the school', n, 1);
  select name into got from public.schools where id = 'vanderbilt';
  perform pg_temp.said('and gets the name, not a stub', got, 'Vanderbilt University');

  -- ── An administrator can maintain it ────────────────────────────────────
  --
  -- The control for every refusal in `tenancy.check.sql`. Without somebody able
  -- to write this table, all of those pass against a table that is simply
  -- read-only to everyone, and prove nothing about who was told apart.

  perform pg_temp.become(admin);
  insert into public.schools (id, name) values ('rice', 'Rice University');
  select count(*) into n from public.schools;
  perform pg_temp.counted('while an administrator can add one', n, 2);
  delete from public.schools where id = 'rice';

  -- ── Removing a school keeps its students ────────────────────────────────
  --
  -- The one nothing else in this directory does: no other check deletes a
  -- school, so `on delete set null` is unproven everywhere else. The claim is
  -- about the *students*, so the profiles are counted rather than the column
  -- read — a cascade would leave the column consistent by removing the row that
  -- held it, and reading the column alone would not notice.

  set local role postgres;
  update public.profiles set school_id = 'vanderbilt' where user_id = person;
  select count(*) into n from public.profiles;
  perform pg_temp.counted('two profiles, one of them at this school', n, 2);

  delete from public.schools where id = 'vanderbilt';

  select count(*) into n from public.profiles;
  perform pg_temp.counted('removing the school keeps its students', n, 2);
  select school_id into got from public.profiles where user_id = person;
  perform pg_temp.said('and only clears the column', got, null);
end $$;

rollback;
