-- Bounded, manually invoked projection worker boundary (CQRS backlog P1-04).
--
-- The Edge Function added with this migration has no scheduler entry and its
-- dedicated bearer secret is intentionally not provisioned here. This RPC is
-- service-role only, claims at most 25 events, and dispatches only the one
-- active handler registered in the preceding migration. Retention sweeps,
-- cron activation, additional handlers, a read API, and UI remain separate.

create or replace function private.claim_tenant_entitlement_events(
  want_limit integer default 25
)
returns setof private.domain_outbox_events
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  batch uuid := gen_random_uuid();
begin
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A projector batch limit is between 1 and 25.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from private.read_model_registry r
     where r.name = 'ops_tenant_entitlements' and r.version = 1
       and r.status = 'active' and r.scope_kind = 'school'
       and r.capability = 'tenant:configure'
  ) then
    raise exception 'The tenant entitlement projector is not registered active.' using errcode = '55000';
  end if;

  return query
  with candidates as (
    select e.id
      from private.domain_outbox_events e
     where e.event_type = 'entitlement.changed'
       and e.event_version = 1
       and e.published_at is null
       and e.dead_lettered_at is null
       and coalesce(e.next_attempt_at, e.occurred_at) <= now()
       and (e.claim_id is null or e.claimed_at < now() - interval '5 minutes')
       and not exists (
         select 1 from private.domain_event_receipts r
          where r.consumer = 'ops.tenant-entitlements.v1' and r.event_id = e.id
            and r.outcome in ('processed', 'skipped')
       )
     order by coalesce(e.next_attempt_at, e.occurred_at), e.occurred_at, e.id
     for update skip locked
     limit want_limit
  ), claimed as (
    update private.domain_outbox_events e
       set claim_id = batch,
           claimed_at = now()
      from candidates c
     where e.id = c.id
     returning e.*
  )
  select c.* from claimed c
   order by coalesce(c.next_attempt_at, c.occurred_at), c.occurred_at, c.id;
end
$$;

create or replace function public.run_ops_projector(
  want_limit integer default 25
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  consumer_name constant text := 'ops.tenant-entitlements.v1';
  event_row private.domain_outbox_events%rowtype;
  applied jsonb;
  failed jsonb;
  failure_state text;
  claimed_count integer := 0;
  processed_count integer := 0;
  skipped_count integer := 0;
  retrying_count integer := 0;
  dead_lettered_count integer := 0;
begin
  if want_limit is null or want_limit < 1 or want_limit > 25 then
    raise exception 'A projector batch limit is between 1 and 25.' using errcode = '22023';
  end if;

  for event_row in
    select * from private.claim_tenant_entitlement_events(want_limit)
  loop
    claimed_count := claimed_count + 1;
    begin
      applied := private.apply_tenant_entitlement_event(event_row.id, event_row.claim_id);
      if applied ->> 'outcome' = 'processed' then
        processed_count := processed_count + 1;
      elsif applied ->> 'outcome' in ('skipped', 'already_settled') then
        skipped_count := skipped_count + 1;
      else
        raise exception 'The registered projector returned an unsupported outcome.' using errcode = '22023';
      end if;
    exception when others then
      get stacked diagnostics failure_state = returned_sqlstate;
      failed := private.fail_domain_event(
        consumer_name,
        event_row.id,
        event_row.claim_id,
        case when failure_state in ('22023', '23514')
          then 'invalid entitlement.changed version 1 event'
          else 'tenant entitlement projector transaction failed'
        end,
        failure_state not in ('22023', '23514')
      );
      if failed ->> 'state' = 'dead_letter' then
        dead_lettered_count := dead_lettered_count + 1;
      else
        retrying_count := retrying_count + 1;
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'claimed', claimed_count,
    'processed', processed_count,
    'skipped', skipped_count,
    'retrying', retrying_count,
    'deadLettered', dead_lettered_count
  );
end
$$;

revoke all on function private.claim_tenant_entitlement_events(integer)
  from public, anon, authenticated;
revoke all on function public.run_ops_projector(integer)
  from public, anon, authenticated;
grant execute on function private.claim_tenant_entitlement_events(integer)
  to service_role;
grant execute on function public.run_ops_projector(integer)
  to service_role;

comment on function public.run_ops_projector(integer) is
  'Runs one bounded service-only batch through active registered projection handlers; it does not schedule or activate the worker.';
