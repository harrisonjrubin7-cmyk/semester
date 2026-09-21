-- ── Counting a call so that two of them cannot count as one ───────────────
--
-- The Claude Edge Function meters generations per account, and the whole point
-- of the meter is that one person cannot spend the whole budget. It did not
-- hold. The function read the month's count, compared it to the cap, and later
-- wrote `calls = used + 1` — a read, a decision and a write with a network
-- round trip to Anthropic in between:
--
--     request A  reads calls = 59 ─┐
--     request B  reads calls = 59 ─┤ both under the cap of 60
--     request A  writes calls = 60 ─┤ both write the same number
--     request B  writes calls = 60 ─┘ two calls, counted as one
--
-- That is a lost update, and it is not a rare interleaving: the app fires
-- several generations at once when a syllabus is imported, so the ordinary
-- path through the app is the one that loses counts. Twenty parallel requests
-- cost twenty calls and advance the meter by one, which makes the cap a
-- suggestion and the bill somebody else's problem.
--
-- The fix is to let the database do the arithmetic. `INSERT … ON CONFLICT DO
-- UPDATE` takes a row lock on the conflicting row, so concurrent callers queue
-- behind each other and each one reads back the count *it* produced. There is
-- no window between the read and the write because there is no separate read.
--
-- Apply with:
--     psql "$DATABASE_URL" -f supabase/migrations/20260921142822_usage_atomic.sql

create or replace function public.count_call(p_user uuid, p_month text)
returns int
language plpgsql
-- `security definer` so the function may write `usage`, which has row-level
-- security and neither an insert nor an update policy — the table is readable
-- by its owner and writable by nothing that goes through a policy.
security definer
-- A fixed search_path, for the reason written above `touch_updated_at`: without
-- one the body resolves names against whatever the caller had set.
set search_path = ''
as $$
declare
  n int;
begin
  insert into public.usage as u (user_id, month, calls)
  values (p_user, p_month, 1)
  on conflict (user_id, month)
    do update set calls = u.calls + 1, updated_at = now()
  returning u.calls into n;

  return n;
end;
$$;

-- Callable only by the service role, which is the Edge Function and nothing
-- else. It names the account it is counting against, so a signed-in caller
-- able to reach it could spend somebody else's allowance — the account comes
-- from the JWT the function has already verified, and never from a browser.
revoke all on function public.count_call(uuid, text) from public, anon, authenticated;
grant execute on function public.count_call(uuid, text) to service_role;
