-- Where a student is signed in, and ending one place without ending the rest.
--
-- Stream 02. The account screen could sign out every other device at once
-- (`auth.signOut({ scope: 'others' })`) and say nothing about which they were.
-- Supabase Auth has no client call to list a person's sessions, but GoTrue
-- keeps them in `auth.sessions`, and school offboarding already reaches into
-- that table from a definer function. This does the same two narrow things
-- for the caller's own rows and nothing else: list them, and end one.
--
-- No new table. Both functions read `auth.uid()` and never take a user id, so
-- there is no argument a client could point at somebody else.
--
--   * `my_sessions()` returns when each session began and was last used, the
--     browser's own `user_agent` string and whether it is the one asking. It
--     does not return the address a session came from: a student does not need
--     it to tell a laptop from a phone, and it is somebody's whereabouts.
--   * `end_my_session(want)` ends one of the caller's other sessions. It
--     refuses the session making the call (ending that is signing out, which
--     has its own button) and, for a session that is not the caller's, says
--     "no such session" the way a missing one does.
--
-- Deleting a session row deletes its refresh tokens, so that device cannot
-- renew. The access token it already holds stays valid until it expires, which
-- GoTrue sets to at most an hour; the screen says so.
--
-- The functions use dynamic SQL behind `to_regclass`, as the offboarding
-- function does, because the disposable check database has no GoTrue and these
-- migrations must apply there. On a real project the table is always present.
--
-- Additive: two functions. NOT APPLIED to production; merging to main applies
-- it through Supabase Branching and needs owner approval.
--
-- To remove:
--   drop function if exists public.my_sessions();
--   drop function if exists public.end_my_session(uuid);

create or replace function public.my_sessions()
returns table (id uuid, created_at timestamptz, last_active timestamptz, user_agent text, is_current boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  here uuid;
begin
  if me is null then
    raise exception 'Sign in to see where you are signed in.' using errcode = '28000';
  end if;
  if to_regclass('auth.sessions') is null then
    return;
  end if;
  here := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  return query execute
    'select s.id,
            s.created_at,
            coalesce(s.refreshed_at at time zone ''UTC'', s.updated_at, s.created_at),
            s.user_agent,
            coalesce(s.id = $2, false)
       from auth.sessions s
      where s.user_id = $1
        and (s.not_after is null or s.not_after > now())
      order by 3 desc'
    using me, here;
end;
$$;

revoke all on function public.my_sessions() from public, anon, authenticated;
grant execute on function public.my_sessions() to authenticated;

create or replace function public.end_my_session(want uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  here uuid;
  n bigint := 0;
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if want is null then
    return false;
  end if;
  here := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
  if want = here then
    raise exception 'That is the device you are using. Sign out instead.' using errcode = '22023';
  end if;
  if to_regclass('auth.sessions') is null then
    return false;
  end if;
  execute 'delete from auth.sessions where id = $1 and user_id = $2' using want, me;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.end_my_session(uuid) from public, anon, authenticated;
grant execute on function public.end_my_session(uuid) to authenticated;
