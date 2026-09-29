-- supabase/load/seed.sql — a synthetic school for the load scenarios.
--
-- Applied by `supabase/load.sh` to a throwaway database after every migration,
-- never to a real one. One school, `:students` signed-in students (default
-- 2000), one configurer, a feature policy limited to a release cohort that
-- half the students are in, and forty courses with catalog sections so the
-- demand read has something to join.
--
-- `load_users(i, id)` maps pgbench's random integers to account ids. It lives
-- in `public` only because pgbench scripts run it before they drop to the
-- `authenticated` role; nothing a client can reach is granted on it.

\set ON_ERROR_STOP on

insert into public.schools (id, name, email_domains)
values ('load-u', 'Load University', array['load-u.example'])
on conflict (id) do nothing;

create table public.load_users (i integer primary key, id uuid not null unique);
revoke all on table public.load_users from anon, authenticated;

insert into public.load_users (i, id)
select g, gen_random_uuid() from generate_series(1, :students) g;

insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       format('student%s@load-u.example', i), now(), now(), now()
  from public.load_users;

insert into public.profiles (user_id, handle, school_id)
select id, format('student%s', i), 'load-u' from public.load_users;

-- The configurer, outside the student range.
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-00000000a0a0', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'admin@load-u.example', now(), now(), now());
insert into public.profiles (user_id, handle, school_id)
values ('00000000-0000-0000-0000-00000000a0a0', 'load_admin', 'load-u');
insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
values ('00000000-0000-0000-0000-00000000a0a0', 'university_admin', 'school', 'load-u', 'institution');

-- A flag on in preview, limited to a cohort, and a second one open to all.
insert into public.tenant_feature_policy (tenant_id, capability, state, permitted_cohorts)
values ('load-u', 'module.source_freshness_cards', 'preview', array['pilot-2027']),
       ('load-u', 'module.integration_dashboard', 'preview', '{}');

-- Every even-numbered student is in the pilot cohort.
insert into public.feature_cohort_members (tenant_id, cohort, user_id)
select 'load-u', 'pilot-2027', id from public.load_users where i % 2 = 0;

-- Forty courses, two sections each, for the demand join.
insert into public.catalog_sections (tenant_id, term_code, course_code, section, capacity, waitlist_count, source_system, synced_at)
select 'load-u', '2027SP', format('LOAD %s', 1000 + c), s::text, 30, 0, 'load-seed', now()
  from generate_series(1, 40) c, generate_series(1, 2) s;

analyze;
