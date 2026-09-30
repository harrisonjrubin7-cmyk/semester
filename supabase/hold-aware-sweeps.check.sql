-- School and account holds reaching the AI-runtime and Community sweeps: that a
-- school hold keeps that school's AI metadata and every account's Community rows
-- in it; that an account hold keeps that account's rows and no one else's; that
-- an unheld school and account still lose theirs in the same sweep (a sweep that
-- deletes nothing passes a check that only looks for survivors); and that
-- releasing the hold lets the next sweep remove them. Exercised on the tables
-- with the simplest fixtures — AI reservations and monthly spend, Community
-- restrictions and safety entries. The other account-keyed deletes in the
-- Community sweep carry the same one-line clause and are held to it by
-- retention.test.ts, not exercised here.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh hold-aware-sweeps

begin;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, 'u_' || replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

-- One old restriction and one old safety entry for an account.
create or replace function pg_temp.old_rows(who uuid, school text)
returns void language plpgsql as $$
begin
  insert into public.community_restrictions (user_id, case_id, until)
    values (who, gen_random_uuid(), now() - interval '200 days');
  insert into public.community_safety_entries (user_id, tenant_id, case_id, severity, delta, reason_code, actor_sha256, created_at)
    values (who, school, gen_random_uuid(), 'P2', -1, 'x', repeat('a', 64), now() - interval '2 years');
end $$;

create or replace function pg_temp.rows_of(who uuid)
returns integer language sql as $$
  select (select count(*) from public.community_restrictions where user_id = who)::int
       + (select count(*) from public.community_safety_entries where user_id = who)::int;
$$;

create or replace function pg_temp.ai_rows(school text)
returns integer language sql as $$
  select (select count(*) from private.ai_usage_reservation where tenant_id = school)::int
       + (select count(*) from private.ai_usage_month where tenant_id = school)::int;
$$;

do $$
declare
  a1 uuid; a2 uuid; b1 uuid; b2 uuid; school_hold uuid; account_hold uuid; op uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains) values
    ('ha-a', 'Held School', array['ha-a.example']),
    ('ha-b', 'Free School', array['ha-b.example']);
  insert into public.ai_policy (tenant_id, retention_days) values ('ha-a', 30), ('ha-b', 30);

  a1 := pg_temp.newuser('a1@ha-a.example', 'ha-a');
  a2 := pg_temp.newuser('a2@ha-a.example', 'ha-a');
  b1 := pg_temp.newuser('b1@ha-b.example', 'ha-b');
  b2 := pg_temp.newuser('b2@ha-b.example', 'ha-b');
  perform set_config('request.jwt.claims', '', true);

  perform pg_temp.old_rows(a1, 'ha-a'); perform pg_temp.old_rows(a2, 'ha-a');
  perform pg_temp.old_rows(b1, 'ha-b'); perform pg_temp.old_rows(b2, 'ha-b');

  insert into private.ai_usage_reservation (id, tenant_id, period_start, reserved_cents, status, settled_at, created_at, expires_at) values
    (gen_random_uuid(), 'ha-a', '2020-01-01', 1, 'released', now(), now() - interval '100 days', now() - interval '100 days'),
    (gen_random_uuid(), 'ha-b', '2020-01-01', 1, 'released', now(), now() - interval '100 days', now() - interval '100 days');
  insert into private.ai_usage_month (tenant_id, period_start) values ('ha-a', '2020-01-01'), ('ha-b', '2020-01-01');

  perform pg_temp.must('before any hold, every account has an old restriction and an old safety entry, and each school has AI rows',
    pg_temp.rows_of(a1) = 2 and pg_temp.rows_of(b1) = 2 and pg_temp.ai_rows('ha-a') = 2 and pg_temp.ai_rows('ha-b') = 2);

  -- ── a school hold ──────────────────────────────────────────────────────
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('tenant', 'ha-a', 'ha-a', 'The school is under preservation.', 'MATTER-600', op) returning id into school_hold;
  perform private.sweep_community_retention();
  perform private.sweep_ai_runtime_metadata();
  perform pg_temp.must('a school hold keeps every account''s Community rows in that school',
    pg_temp.rows_of(a1) = 2 and pg_temp.rows_of(a2) = 2);
  perform pg_temp.must('and that school''s AI reservations and monthly spend',
    pg_temp.ai_rows('ha-a') = 2);
  perform pg_temp.must('while the school with no hold loses its old rows in the same sweep',
    pg_temp.rows_of(b1) = 0 and pg_temp.rows_of(b2) = 0 and pg_temp.ai_rows('ha-b') = 0);

  -- ── released: the next sweep removes them ──────────────────────────────
  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id = school_hold;
  perform private.sweep_community_retention();
  perform private.sweep_ai_runtime_metadata();
  perform pg_temp.must('once the school hold is released, the next sweep removes what it kept',
    pg_temp.rows_of(a1) = 0 and pg_temp.rows_of(a2) = 0 and pg_temp.ai_rows('ha-a') = 0);

  -- ── an account hold, in a school with none ─────────────────────────────
  perform pg_temp.old_rows(b1, 'ha-b'); perform pg_temp.old_rows(b2, 'ha-b');
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
    values ('account', b1::text, 'ha-b', 'Preserve this account.', 'MATTER-601', op) returning id into account_hold;
  perform private.sweep_community_retention();
  perform pg_temp.must('an account hold keeps that account''s rows',
    pg_temp.rows_of(b1) = 2);
  perform pg_temp.must('and no one else''s in the same school',
    pg_temp.rows_of(b2) = 0);
  update public.legal_holds set released_by = gen_random_uuid(), release_reason = 'Closed.' where id = account_hold;
  perform private.sweep_community_retention();
  perform pg_temp.must('once released, the account''s rows go at the next sweep',
    pg_temp.rows_of(b1) = 0);

  -- ── the sweep still records that it ran ────────────────────────────────
  perform pg_temp.must('the Community sweep still writes its run record while holds are live',
    (select count(*) from public.community_retention_runs) >= 3);
end $$;

rollback;
