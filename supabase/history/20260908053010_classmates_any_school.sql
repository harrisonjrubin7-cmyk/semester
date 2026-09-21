-- Classmates, for any university. See supabase/classmates-schools.sql and
-- supabase/CLASSMATES-SCHOOLS-REVIEW.md for the reasoning and the cost.

-- 1. Eligibility: confirmed, not Vanderbilt. `private`, not `public` — in
-- `public` this would also be a PostgREST endpoint no policy reads.
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
  );
$$;

revoke all on function private.verified_student() from public;
grant execute on function private.verified_student() to anon, authenticated;

-- 2. The constraint comes off before the data is rewritten, or the update
-- fails on its own first row.
alter table public.enrollments drop constraint if exists enrollments_code_check;

-- 3. Only rows with no prefix yet, so a second run changes nothing.
update public.enrollments
   set code = 'vanderbilt/' || code
 where code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$';

update public.messages
   set code = 'vanderbilt/' || code
 where code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$';

-- 4. Back on, in its new shape. A malformed course code is still refused.
alter table public.enrollments
  add constraint enrollments_code_check
  check (code ~ '^[a-z0-9][a-z0-9-]{0,60}/[A-Z]{2,4} [0-9]{3,4}[A-Z]?$');

reindex index enrollments_by_class;
reindex index messages_by_room;