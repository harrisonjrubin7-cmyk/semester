-- A push, 2.5 s after an edit settles (lib/cloud.ts push): a compare-and-swap
-- on the state row, then one on the course the student edited. A course the
-- database already holds unchanged is not sent (`acked` in lib/cloud.ts); a
-- push used to rewrite all four, and that was the slowest thing a student did.
-- Each write is conditioned on the updated_at last seen, read here first;
-- pgbench cannot quote a variable, so it travels as microseconds. run.sh
-- counts the rows each table actually wrote, because a compare-and-swap that
-- matches nothing still succeeds. The budget is set, like the others, to
-- catch a path an order of magnitude slower than a quiet machine's p95.
-- budget: p95_ms=1000
\set u random(1, :students)
\set k random(1, 4)
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
SELECT (extract(epoch FROM updated_at) * 1000000)::bigint AS c FROM public.courses WHERE user_id = (SELECT auth.uid()) AND id = 'course-' || :k \gset
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
UPDATE public.courses SET data = jsonb_set(data, '{version}', to_jsonb(:u))
 WHERE user_id = (SELECT auth.uid()) AND id = 'course-' || :k AND updated_at = to_timestamp(0) + :c * interval '1 microsecond' RETURNING id, updated_at;
END;
