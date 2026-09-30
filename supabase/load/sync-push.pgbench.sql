-- A push, 2.5 s after an edit settles (lib/cloud.ts push): a compare-and-swap
-- on the state row, then one per course, changed or not, which is what the
-- app does today. Each is conditioned on the updated_at last seen, read here
-- first; pgbench cannot quote a variable, so it travels as microseconds.
-- run.sh counts the rows each table actually wrote, because a
-- compare-and-swap that matches nothing still succeeds. The budget is high
-- because every client pushes flat out: five writes of up to 42 KB each, and
-- a quiet machine's p95 saturates near 230 ms. It is set, like the others,
-- to catch a path an order of magnitude slower.
-- budget: p95_ms=2000
\set u random(1, :students)
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT (extract(epoch FROM updated_at) * 1000000)::bigint AS s0 FROM public.state WHERE user_id = (SELECT auth.uid()) \gset
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
UPDATE public.state SET data = jsonb_set(data, '{version}', to_jsonb(:u))
 WHERE user_id = (SELECT auth.uid()) AND updated_at = to_timestamp(0) + :s0 * interval '1 microsecond' RETURNING updated_at;
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT max((extract(epoch FROM updated_at) * 1000000)::bigint) FILTER (WHERE id = 'course-1') AS c1, max((extract(epoch FROM updated_at) * 1000000)::bigint) FILTER (WHERE id = 'course-2') AS c2,
       max((extract(epoch FROM updated_at) * 1000000)::bigint) FILTER (WHERE id = 'course-3') AS c3, max((extract(epoch FROM updated_at) * 1000000)::bigint) FILTER (WHERE id = 'course-4') AS c4
  FROM public.courses WHERE user_id = (SELECT auth.uid()) \gset
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
UPDATE public.courses SET data = jsonb_set(data, '{version}', to_jsonb(:u))
 WHERE user_id = (SELECT auth.uid()) AND id = 'course-1' AND updated_at = to_timestamp(0) + :c1 * interval '1 microsecond' RETURNING id, updated_at;
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
UPDATE public.courses SET data = jsonb_set(data, '{version}', to_jsonb(:u))
 WHERE user_id = (SELECT auth.uid()) AND id = 'course-2' AND updated_at = to_timestamp(0) + :c2 * interval '1 microsecond' RETURNING id, updated_at;
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
UPDATE public.courses SET data = jsonb_set(data, '{version}', to_jsonb(:u))
 WHERE user_id = (SELECT auth.uid()) AND id = 'course-3' AND updated_at = to_timestamp(0) + :c3 * interval '1 microsecond' RETURNING id, updated_at;
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
UPDATE public.courses SET data = jsonb_set(data, '{version}', to_jsonb(:u))
 WHERE user_id = (SELECT auth.uid()) AND id = 'course-4' AND updated_at = to_timestamp(0) + :c4 * interval '1 microsecond' RETURNING id, updated_at;
END;
