-- The race: a handful of students each saving from several devices at once.
-- Nothing about the latency matters here; the invariants afterwards do.
-- budget: p95_ms=200
\set u random(1, 8)
\set a random(1000, 1004)
\set b random(1000, 1004)
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT public.contribute_course_plan('2027SP', jsonb_build_array(
  jsonb_build_object('course', 'LOAD ' || :a, 'role', 'primary'),
  jsonb_build_object('course', 'LOAD ' || :b, 'role', 'backup', 'rank', 1)));
END;
