-- ── `updated_at` means when the row was written, not when the request began ─
--
-- Run after schema.sql. Safe to run twice; it replaces one function.
--
-- `touch_updated_at` stamped `now()`, and `now()` in Postgres is the start of
-- the surrounding transaction — it does not move while the transaction runs,
-- and `pg_sleep` does not move it either. For a created_at default that is
-- fine. For this column it is not, because of what the column is for: the
-- comment above it in schema.sql says "sync compares timestamps to decide
-- which side is newer", and `lib/cloud.ts` reads the newest `updated_at`
-- across an account's rows as the account's watermark.
--
-- Two things follow from stamping the transaction's start.
--
--   * **Rows can be stamped earlier than a pull that already happened.** A
--     write inside a transaction that began at T commits at T+d carrying the
--     stamp T. A device that pulled at T + d/2 recorded its watermark as
--     T + d/2, asks next time for everything after it, and never sees that
--     row. The window is the length of the transaction, which is small and is
--     not zero, and the failure is silent and permanent — the row is not late,
--     it is invisible.
--
--   * **It cannot be tested.** `records.check.sql` runs in one transaction, as
--     a check script must if it is to roll itself back. Under `now()` every
--     row it writes carries the same instant, so its "a pull for everything
--     since" block could never pass: the assertion that a newly inserted row
--     comes back on an incremental pull returned 0, aborted the transaction,
--     and took the three blocks after it with it. The per-table stranger
--     checks below it have therefore never run.
--
-- `clock_timestamp()` reads the wall clock at the moment the trigger fires,
-- which is what "last written" means. It does not close the window above
-- completely — a row is still stamped when it is written rather than when it
-- commits — but it narrows it from the length of the transaction to the length
-- of the commit, and it makes the column say the thing it is named for.
--
-- Apply with:
--     psql "$DATABASE_URL" -f supabase/migrations/20260901001100_touch_clock.sql

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
-- A fixed search_path, because without one the function resolves names against
-- whatever the caller had set. Empty rather than `public`: the body calls only
-- `clock_timestamp()`, which lives in pg_catalog and is always reachable.
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
