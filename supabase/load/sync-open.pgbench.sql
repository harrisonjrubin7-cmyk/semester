-- Every student, every visit: what the app sends when it opens, each request
-- its own transaction with the student's claims and role, as PostgREST runs
-- it. The pull (lib/cloud.ts), the daily activity mark (lib/activity.ts), the
-- classmates card (components/Waiting.tsx) and the Plus card's reads
-- (components/PlusPrompt.tsx). Latency is the whole journey, nine requests.
-- The app filters by its own id; `auth.uid()` names the same row, since the
-- claims are that id.
-- budget: p95_ms=400
\set u random(1, :students)
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT data, updated_at FROM public.state WHERE user_id = (SELECT auth.uid());
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT id, data, updated_at FROM public.courses WHERE user_id = (SELECT auth.uid());
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT public.note_activity(array['opened', 'course']);
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT user_id, handle, about FROM public.profiles WHERE user_id = (SELECT auth.uid());
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT code FROM public.enrollments WHERE user_id = (SELECT auth.uid()) AND term = '2026FA';
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT school_id FROM public.profiles WHERE user_id = (SELECT auth.uid());
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT * FROM public.commercial_prices WHERE plan_code = 'plus';
END;
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', id::text, 'role', 'authenticated')::text, true) FROM public.load_users WHERE i = :u;
SET LOCAL ROLE authenticated;
SELECT s.* FROM public.subscriptions s JOIN public.billing_accounts b ON b.id = s.billing_account_id
 WHERE b.kind = 'individual' AND b.user_id = (SELECT auth.uid());
END;
