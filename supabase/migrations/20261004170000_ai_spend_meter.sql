-- Semester — a dollar meter beside the call meter on the shared key.
--
-- Safe to run again; each statement changes nothing once it has run.
--
-- ## Why
--
-- `count_call` caps the shared key at sixty calls a month, and the bill counts
-- tokens: at the cap on the app's default model one account costs about as
-- much as Plus's monthly price, and on the dearest model several times it
-- (docs/commercial/PRICING-UNIT-ECONOMICS-ARCHITECTURE.md, F1). A plan now
-- names the models it may use, which narrows that. This is the other half: a
-- monthly allowance in *money*, so the most an account can cost the key no
-- longer depends on which model, or how long an answer, it asks for.
--
-- ## How
--
-- One column on the row `count_call` already keeps per account and month, and
-- one function that adds to it. Money is whole micro-dollars (a millionth of a
-- dollar), so a token price in dollars per million tokens *is* micro-dollars
-- per token and nothing is ever a float.
--
-- `add_spend` does its arithmetic inside one statement for the reason
-- `count_call` does (20260921142822_usage_atomic.sql): a read, a decision and
-- a write with a network round trip in between is a lost update, and the app
-- fires several generations at once when a syllabus is imported.
--
--   reserve  p_delta > 0, p_cap set   adds only if the total stays within the
--                                     cap; otherwise changes nothing and
--                                     answers -1
--   settle   p_delta < 0              gives back what a reservation held that
--                                     the answer did not use; never below zero
--   charge   p_delta > 0, p_cap null  adds unconditionally: an answer that cost
--                                     more than was reserved is spent, and
--                                     refusing to record it would hide it
--
-- It answers the new total, or -1 when a reservation did not fit. -1 is never
-- a total, so a caller cannot mistake one for the other.

alter table public.usage
  add column if not exists cost_micros bigint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.usage'::regclass and conname = 'usage_cost_micros_not_negative'
  ) then
    alter table public.usage
      add constraint usage_cost_micros_not_negative check (cost_micros >= 0);
  end if;
end $$;

create or replace function public.add_spend(
  p_user  uuid,
  p_month text,
  p_delta bigint,
  p_cap   bigint
)
returns bigint
language plpgsql
-- `security definer` so the function may write `usage`, which has row-level
-- security and no insert or update policy; a fixed `search_path` for the
-- reason written above `count_call`.
security definer
set search_path = ''
as $$
declare
  total bigint;
begin
  if p_user is null or p_month is null or p_delta is null then
    raise exception 'add_spend needs an account, a month and an amount';
  end if;

  -- A reservation larger than the whole allowance can never fit. Answered
  -- before the insert so that no row is written for an account that spent
  -- nothing.
  if p_delta > 0 and p_cap is not null and p_delta > p_cap then
    return -1;
  end if;

  insert into public.usage as u (user_id, month, cost_micros)
  values (p_user, p_month, greatest(p_delta, 0))
  on conflict (user_id, month)
    do update set cost_micros = greatest(0, u.cost_micros + p_delta),
                  updated_at  = now()
    where p_delta <= 0 or p_cap is null or u.cost_micros + p_delta <= p_cap
  returning u.cost_micros into total;

  -- No row came back only when the `where` above refused the update: the
  -- reservation did not fit, and nothing was changed.
  return coalesce(total, -1);
end;
$$;

-- Callable only by the service role, which is the Edge Function and nothing
-- else. It names the account it is charging, so a signed-in caller able to
-- reach it could spend, or refund, somebody else's allowance.
revoke all on function public.add_spend(uuid, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.add_spend(uuid, text, bigint, bigint) to service_role;
