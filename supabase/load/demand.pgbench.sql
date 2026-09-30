-- Advisors and students reading course demand for the term.
-- budget: p95_ms=40
\set u random(1, :students)
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.course_demand('2027SP');
END;
