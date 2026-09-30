-- Every screen that shows a flagged module asks two questions: is it on for
-- this school, and does the cohort list admit me. The read path under load.
-- budget: p95_ms=25
\set u random(1, :students)
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT public.feature_state('module.source_freshness_cards', 'load-u');
SELECT public.feature_cohort_allows('module.source_freshness_cards', 'load-u');
SELECT public.feature_cohort_allows('module.integration_dashboard', 'load-u');
END;
