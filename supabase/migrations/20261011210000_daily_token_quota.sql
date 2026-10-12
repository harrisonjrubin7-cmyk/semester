-- Semester — a daily token quota per account on the shared key, off by default.
--
-- Safe to run again; each statement changes nothing once it has run.
--
-- ## Why
--
-- The shared key is metered twice already: sixty calls a month (`count_call`,
-- 20260921142822_usage_atomic.sql) and a dollar allowance per plan
-- (`add_spend`, 20261004170000_ai_spend_meter.sql). Both are monthly. This is
-- the third meter, in tokens per account per UTC day, and it ships with **no
-- quota**: `TOKEN_QUOTA_DAILY` on the `claude` function is unset, and while it
-- is unset the function never calls this. The owner asked for the setting to
-- exist and for its default to be unlimited; an operator who later wants a
-- ceiling sets the variable and the meter starts counting on the next request.
--
-- ## How
--
-- One row per account and day, and one function that adds to it. The shape is
-- `add_spend`'s, because the fault it guards against is the same: a read, a
-- decision and a write with a network round trip in between is a lost update,
-- and the app fires several generations at once when a syllabus is imported.
--
--   reserve  p_delta > 0, p_cap set   adds only if the total stays within the
--                                     cap; otherwise changes nothing and
--                                     answers -1
--   settle   p_delta < 0              gives back what a reservation held that
--                                     the answer did not use; never below zero
--   charge   p_delta > 0, p_cap null  adds unconditionally: an answer that used
--                                     more than was reserved is spent, and
--                                     refusing to record it would hide it
--
-- It answers the new total, or -1 when a reservation did not fit. -1 is never
-- a total, so a caller cannot mistake one for the other.
--
-- A separate table rather than more columns on `usage`, because that table is
-- keyed by month and its `month` column is documented as 'YYYY-MM'; a day row
-- in it would be a second meaning for the same column.

create table if not exists public.usage_daily (
  user_id    uuid        not null references auth.users on delete cascade,
  day        text        not null,            -- 'YYYY-MM-DD', UTC
  tokens     bigint      not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day),
  constraint usage_daily_tokens_not_negative check (tokens >= 0)
);

-- Readable by its owner, writable by nothing that goes through a policy: the
-- Edge Function writes it through `add_tokens` as the service role.
alter table public.usage_daily enable row level security;

drop policy if exists "usage_daily is readable by its owner" on public.usage_daily;
create policy "usage_daily is readable by its owner"
  on public.usage_daily for select
  using ((select auth.uid()) = user_id);

-- Supabase's default privileges hand `anon` every privilege on a new table
-- in `public`; 20261005200000 revoked them for the tables of its day and
-- asks each later migration to say so for its own. Without this line the
-- first pass leaves a visitor holding select, insert, update and delete
-- here, and the reapply pass, which runs that revoke again, takes them
-- away: two schemas from one migration set.
revoke all on table public.usage_daily from public, anon, authenticated;
grant select on public.usage_daily to authenticated;
grant all on public.usage_daily to service_role;

create or replace function public.add_tokens(
  p_user  uuid,
  p_day   text,
  p_delta bigint,
  p_cap   bigint
)
returns bigint
language plpgsql
-- `security definer` so the function may write `usage_daily`, which has
-- row-level security and no insert or update policy; a fixed `search_path`
-- for the reason written above `count_call`.
security definer
set search_path = ''
as $$
declare
  total bigint;
begin
  if p_user is null or p_day is null or p_delta is null then
    raise exception 'add_tokens needs an account, a day and an amount';
  end if;

  -- A reservation larger than the whole quota can never fit. Answered before
  -- the insert so that no row is written for an account that used nothing.
  if p_delta > 0 and p_cap is not null and p_delta > p_cap then
    return -1;
  end if;

  insert into public.usage_daily as u (user_id, day, tokens)
  values (p_user, p_day, greatest(p_delta, 0))
  on conflict (user_id, day)
    do update set tokens     = greatest(0, u.tokens + p_delta),
                  updated_at = now()
    where p_delta <= 0 or p_cap is null or u.tokens + p_delta <= p_cap
  returning u.tokens into total;

  -- No row came back only when the `where` above refused the update: the
  -- reservation did not fit, and nothing was changed.
  return coalesce(total, -1);
end;
$$;

-- Callable only by the service role, which is the Edge Function and nothing
-- else. It names the account it is charging, so a signed-in caller able to
-- reach it could spend, or refund, somebody else's quota.
revoke all on function public.add_tokens(uuid, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.add_tokens(uuid, text, bigint, bigint) to service_role;
