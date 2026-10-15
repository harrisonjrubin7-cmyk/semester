-- One safe browser entry point for a person's own data-rights request.
--
-- `data_subject_request` already holds the queue and its RLS rules. The missing
-- piece was a call the app could make without asking the browser to discover
-- or assert its authoritative tenant. This function derives both the subject
-- and tenant from the authenticated account, serializes same-kind requests,
-- and returns the still-open request instead of creating duplicates.

create or replace function public.raise_my_data_subject_request(
  requested_kind text,
  requested_detail text default ''
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  mine text;
  made uuid;
  clean_detail text := pg_catalog.btrim(coalesce(requested_detail, ''));
begin
  if me is null then
    raise exception 'Sign in before filing a data-rights request.' using errcode = '42501';
  end if;
  if requested_kind is null or requested_kind not in ('export', 'erasure', 'correction', 'restriction') then
    raise exception 'Choose export, erasure, correction, or restriction.' using errcode = '23514';
  end if;
  if pg_catalog.length(clean_detail) > 1000 then
    raise exception 'Keep the request detail to 1,000 characters or fewer.' using errcode = '22001';
  end if;

  -- A transaction-scoped lock makes two rapid taps one request without adding
  -- a uniqueness constraint that could reject a deployment with old duplicate
  -- rows already present.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(me::text || ':' || requested_kind, 0)
  );

  select request.id into made
    from public.data_subject_request request
   where request.subject = me
     and request.kind = requested_kind
     and request.resolved_at is null
   order by request.received_at desc
   limit 1;
  if made is not null then return made; end if;

  select profile.school_id into mine
    from public.profiles profile
   where profile.user_id = me;

  insert into public.data_subject_request (
    subject, tenant_id, kind, requested_by, status, detail
  ) values (
    me, mine, requested_kind, 'self', 'received', clean_detail
  ) returning id into made;

  return made;
end $$;

revoke all on function public.raise_my_data_subject_request(text, text)
  from public, anon;
grant execute on function public.raise_my_data_subject_request(text, text)
  to authenticated;

comment on function public.raise_my_data_subject_request(text, text) is
  'Files or returns the caller''s open same-kind data-subject request, deriving subject and tenant from the authenticated account.';
