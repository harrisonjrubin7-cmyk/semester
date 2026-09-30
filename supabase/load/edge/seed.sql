-- Students for edge.mjs, on a Supabase preview branch: never production.
--
-- They sign in with a password, so unlike ../seed.sql they need what GoTrue
-- reads: an encrypted password, a confirmed email, and the token columns as
-- empty strings rather than null (GoTrue cannot scan a null into them and
-- answers 500). Each has a state row, four courses of production's largest
-- size, and a calendar feed with a known token.
--
-- :students is set by the caller, e.g. psql -v students=200. Run teardown.sql
-- afterwards; every row here hangs off an email under @edge-load.example.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       format('student%s@edge-load.example', i),
       extensions.crypt('edge-load-' || i, extensions.gen_salt('bf', 4)), now(),
       '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()
  from generate_series(1, :students) i;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
select gen_random_uuid(), id, id::text, 'email', jsonb_build_object('sub', id::text, 'email', email), now(), now()
  from auth.users where email like '%@edge-load.example';

-- 27 KB of state and four 42 KB courses: production's largest, 29 September.
insert into public.state (user_id, data)
select id, jsonb_build_object('version', 0, 'pad', repeat('s', 27000))
  from auth.users where email like '%@edge-load.example';

insert into public.courses (user_id, id, data)
select u.id, 'course-' || c, jsonb_build_object('version', 0, 'pad', repeat('c', 42000))
  from auth.users u, generate_series(1, 4) c where u.email like '%@edge-load.example';

-- The token is the student number, zero-padded to the 48 hex the function wants.
insert into public.calendar_feeds (user_id, token, body, events)
select id, lpad(substring(email from 'student(\d+)@'), 48, '0'),
       'BEGIN:VCALENDAR' || repeat(E'\r\nBEGIN:VEVENT\r\nSUMMARY:Problem set\r\nEND:VEVENT', 40) || E'\r\nEND:VCALENDAR', 40
  from auth.users where email like '%@edge-load.example';
