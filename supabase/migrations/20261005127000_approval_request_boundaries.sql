-- Keep approval request boundaries effective on projects that already applied
-- the original approval migration. The browser cannot bypass these checks by
-- calling the RPC directly with an unsupported operation.

create or replace function private.check_approval_request_boundaries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  detail jsonb := coalesce(new.detail, '{}'::jsonb);
begin
  -- Administrative fixtures and restore tooling do not carry a user claim.
  -- Authenticated callers reach this trigger through request_approval().
  if auth.uid() is null then
    return new;
  end if;

  if new.duty_id = 'integration-config' then
    if new.tenant_id is null
       or not private.has_capability('integration:configure', 'school', new.tenant_id) then
      raise exception 'integration:configure over this exact school is required.' using errcode = '42501';
    end if;
    if coalesce(detail ->> 'requested_change', '') not in (
      'configure', 'rotate-credential-reference', 'disable'
    ) then
      raise exception 'requested_change must be configure, rotate-credential-reference or disable.'
        using errcode = '22023';
    end if;
    if detail ->> 'requested_change' <> 'disable' then
      if coalesce(detail ->> 'credential_expiry', '') !~ '^\d{4}-\d{2}-\d{2}$'
         or (detail ->> 'credential_expiry')::date <= current_date then
        raise exception 'A future credential expiry date is required.' using errcode = '22023';
      end if;
    end if;
  end if;

  if new.duty_id = 'release' and detail ->> 'action' = 'release' then
    if new.tenant_id is not null or new.target is distinct from 'platform'
       or coalesce(detail ->> 'release_commit', '') !~ '^[0-9a-f]{40}$' then
      raise exception 'A platform release request must name its exact 40-character commit.' using errcode = '22023';
    end if;
    if detail ->> 'release_commit' is distinct from (
      select e.commit_sha
        from public.platform_release_evidence e
       where e.gate = 'production_migrations'
       order by e.observed_at desc, e.recorded_at desc, e.id desc
       limit 1
    ) then
      raise exception 'The release request commit does not match current migration evidence.' using errcode = '23514';
    end if;
    if exists (
      with required(gate, max_age, needs_commit) as (values
        ('production_restore', interval '90 days', false),
        ('legal_approval', interval '365 days', false),
        ('paid_infrastructure', interval '30 days', false),
        ('domain_tls', interval '30 days', false),
        ('production_migrations', interval '14 days', true)
      ), latest as (
        select distinct on (e.gate) e.gate, e.status, e.source, e.commit_sha,
               e.observed_at, e.expires_at
          from public.platform_release_evidence e
         order by e.gate, e.observed_at desc, e.recorded_at desc, e.id desc
      )
      select 1 from required r left join latest l on l.gate = r.gate
       where l.gate is null or l.status <> 'pass' or l.observed_at > now()
          or coalesce(l.expires_at, l.observed_at + r.max_age) <= now()
          or coalesce(length(trim(l.source)), 0) < 3
          or (r.needs_commit and coalesce(l.commit_sha, '') !~ '^[0-9a-f]{40}$')
    ) then
      raise exception 'Every release prerequisite must be current before requesting approval.' using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

revoke all on function private.check_approval_request_boundaries() from public, anon, authenticated;
drop trigger if exists approval_request_boundaries on public.approval_request;
create trigger approval_request_boundaries
  before insert on public.approval_request
  for each row execute function private.check_approval_request_boundaries();

