-- Registration week: students save their term plan (three primaries, two
-- backups from forty courses) while others read the demand it feeds.
-- budget: p95_ms=60
\set u random(1, :students)
\set a random(1000, 1039)
\set b random(1000, 1039)
\set c random(1000, 1039)
\set d random(1000, 1039)
\set e random(1000, 1039)
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT public.contribute_course_plan('2027SP', jsonb_build_array(
  jsonb_build_object('course', 'LOAD ' || :a, 'role', 'primary'),
  jsonb_build_object('course', 'LOAD ' || :b, 'role', 'primary'),
  jsonb_build_object('course', 'LOAD ' || :c, 'role', 'primary'),
  jsonb_build_object('course', 'LOAD ' || :d, 'role', 'backup', 'rank', 1),
  jsonb_build_object('course', 'LOAD ' || :e, 'role', 'backup', 'rank', 2)));
END;
