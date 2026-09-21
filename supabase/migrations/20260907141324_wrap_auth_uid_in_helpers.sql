-- The same hoist, inside the helpers.
--
-- `classmate(user_id)` takes a per-row argument, so the call itself is per-row
-- and always will be. What need not repeat is the `auth.uid()` inside it —
-- wrapped, it is an InitPlan of that function's own plan rather than a GUC
-- read on every enrollment row the exists() scans.
--
-- Applied so the live definitions match `classmates.sql` exactly. A helper
-- that reads differently in the repo than in the database is the kind of drift
-- that makes the next person distrust both.
create or replace function private.verified_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and lower(u.email) like '%@vanderbilt.edu'
  );
$$;

create or replace function private.classmate(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments mine
    join public.enrollments theirs
      on theirs.term = mine.term and theirs.code = mine.code
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other
  );
$$;

create or replace function private.in_class(want_term text, want_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = (select auth.uid()) and e.term = want_term and e.code = want_code
  );
$$;