-- Semester — require a tenant binding before LTI grade passback.
--
-- This is a fail-closed replacement of the existing service-only decision
-- function. It keeps the exact signature, volatility, security-definer
-- setting, empty search_path, gate order, and grants. The only behavioral
-- change is that an otherwise valid but unbound registration is refused
-- instead of being authorized.
--
-- Idempotent. No begin/commit — the runner owns the transaction.

create or replace function public.lti_passback_decision(want_issuer text, want_client text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.lti_platform;
  n integer;
  c public.integration_connections;
begin
  select count(*) into n from public.lti_platform
   where issuer = want_issuer and client_id = want_client;
  if n = 0 then return 'no-registration'; end if;
  if n > 1 then return 'registration-ambiguous'; end if;
  select * into p from public.lti_platform
   where issuer = want_issuer and client_id = want_client;

  -- Global stops still take precedence, including for a registration that has
  -- not yet been bound to a school.
  if public.kill_switch_engaged('kill.writeback', p.tenant_id)
     or public.kill_switch_engaged('kill.integration_sync', p.tenant_id) then
    return 'kill-switch';
  end if;

  if p.tenant_id is null then return 'registration-unbound'; end if;

  if public.feature_state('integration.lms_lti', p.tenant_id) <> 'production' then
    return 'module-off';
  end if;
  if public.feature_state('writeback.lms_grade_passback', p.tenant_id) <> 'production' then
    return 'flag-off';
  end if;

  if p.connection_id is null then return 'no-connection'; end if;
  select * into c from public.integration_connections where id = p.connection_id;
  if c.approved_at is null then return 'connection-not-approved'; end if;
  if c.status not in ('healthy', 'degraded') then return 'connection-' || c.status; end if;
  -- A score is a write. A connection approved read-only was not approved for it.
  if c.sync_direction = 'read' then return 'connection-read-only'; end if;
  if public.kill_switch_engaged('kill.connection.' || c.public_id, p.tenant_id) then
    return 'kill-switch';
  end if;

  if not exists (
    select 1 from public.integration_scopes s
     where s.connection_id = c.id
       and s.scope_key = 'scope.lms.score_publish'
       and s.approved
       and (s.expires_at is null or s.expires_at > now())
  ) then
    return 'scope-not-approved';
  end if;

  return 'allowed';
end $$;

revoke all on function public.lti_passback_decision(text, text) from public;
revoke all on function public.lti_passback_decision(text, text) from anon, authenticated;
grant execute on function public.lti_passback_decision(text, text) to service_role;
