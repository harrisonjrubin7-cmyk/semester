-- Two devices, one student: every client pushes to one of three students, so
-- most compare-and-swaps race. A write that wins records the counter it wrote
-- in load_won, after the student's role is dropped; one that loses changes
-- nothing, the app's Stale case (it pulls, merges and pushes again).
-- invariants.sql then asks whether any win was built on a state another win
-- had already replaced: a lost update. run.sh also runs this race with the
-- compare-and-swap removed, which must lose some, or the check could not see one.
-- budget: p95_ms=200
\set u random(1, 3)
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT (extract(epoch FROM updated_at) * 1000000)::bigint AS seen, coalesce((data ->> 'n')::int, 0) AS k FROM public.state WHERE user_id = (SELECT auth.uid()) \gset
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
WITH w AS (
  UPDATE public.state SET data = jsonb_set(data, '{n}', to_jsonb(:k + 1))
   WHERE user_id = (SELECT auth.uid()) AND updated_at = to_timestamp(0) + :seen * interval '1 microsecond'
  RETURNING 1)
SELECT count(*) AS won FROM w \gset
RESET ROLE;
INSERT INTO public.load_won SELECT id, :k + 1 FROM public.load_users WHERE i = :u AND :won = 1;
END;
