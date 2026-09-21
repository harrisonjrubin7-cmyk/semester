-- `access_log.sql` argues for a pinned search_path above `count_call` and
-- above `form_open`, and then does not pin one on either of its own two
-- functions. Both reference every relation and function schema-qualified
-- already, so an empty path costs nothing and closes the usual hole: a body
-- that resolves `access_log` against whatever the caller had set is a body the
-- caller chooses the meaning of. `pg_catalog` stays implicitly searched, which
-- is what `now()`, `coalesce()` and the type names rely on.

create or replace function public.note_access(
  who    uuid,
  kind   text,
  family text default 'unknown'
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.access_log as a (user_id, day, what, client, hits, last_at)
  values (who, (now() at time zone 'utc')::date, kind, coalesce(family, 'unknown'), 1, now())
  on conflict (user_id, day, what, client) do update
    set hits = a.hits + 1, last_at = now();

  delete from public.access_log
   where user_id = who
     and day < ((now() at time zone 'utc')::date - 90);
end $$;

create or replace function public.read_feed(feed_token text, family text default 'unknown')
returns table (body text, name text, updated_at timestamptz)
language plpgsql
set search_path = ''
as $$
declare owner uuid;
begin
  select f.user_id, f.body, f.name, f.updated_at
    into owner, body, name, updated_at
    from public.calendar_feeds f
   where f.token = feed_token;

  if owner is null then
    return;
  end if;

  perform public.note_access(owner, 'calendar_feed', family);
  return next;
end $$;

-- `create or replace function` resets the ACL to the default for a new
-- function, which on this project means the default privileges hand EXECUTE
-- straight back to anon and authenticated. Re-closing both spellings here
-- rather than leaving it to a later re-run.
revoke all on function public.note_access(uuid, text, text) from public, anon, authenticated;
grant execute on function public.note_access(uuid, text, text) to service_role;

revoke all on function public.read_feed(text, text) from public, anon, authenticated;
grant execute on function public.read_feed(text, text) to service_role;