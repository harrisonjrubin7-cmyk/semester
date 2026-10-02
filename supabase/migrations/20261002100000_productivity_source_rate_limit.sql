-- A source check is an authenticated, user-triggered outbound request. Keep
-- its spend and egress budget in the shared database so horizontally scaled
-- Edge Function instances cannot each grant a fresh local allowance.
--
-- The caller supplies no subject, bucket, limit or window. The database
-- derives the subject from the verified JWT and owns every policy value.

create or replace function public.take_productivity_source_rate_limit()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  perform private.take_direct_rate_limit(
    me,
    null,
    'productivity_source',
    10,
    60
  );
end $$;

revoke all on function public.take_productivity_source_rate_limit()
  from public, anon, authenticated;
grant execute on function public.take_productivity_source_rate_limit()
  to authenticated;

comment on function public.take_productivity_source_rate_limit() is
  'Consumes one of ten per-account productivity source checks per rolling minute; subject and policy are server-derived.';
