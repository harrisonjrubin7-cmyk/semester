-- The first SQL-native domain-event producer (CQRS backlog P1-04).
--
-- A tenant feature-policy change already writes an append-only audit row in
-- the same transaction. That audit row is the stable idempotency boundary for
-- the corresponding event: one committed audit fact produces one outbox fact,
-- and a rollback removes both. The payload contains only identifiers, the
-- bounded state and the names of fields that changed. It deliberately omits
-- the free-text reason, roles, cohorts and actor details.
--
-- `entitlement.changed` is the existing v1 catalogue event for changes to
-- tenant-controlled capability exposure. Nothing consumes it yet. This
-- migration does not enable a worker, cron, projection or read model.

create or replace function private.audit_tenant_policy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  event_id text := coalesce(row_data ->> 'id', event_tenant || ':' || coalesce(row_data ->> 'capability', 'policy'));
  caller uuid := auth.uid();
  grant_id uuid;
  audit_id uuid;
  changed_fields text[] := '{}';
begin
  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('tenant:configure', 'ai:configure', 'source:approve', 'audit:read')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;

  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, event_id, lower(tg_op), before_row, after_row, caller, grant_id)
  returning id into audit_id;

  if tg_table_name = 'tenant_feature_policy' then
    if tg_op = 'INSERT' then
      changed_fields := array['capability', 'state', 'permitted_roles', 'permitted_cohorts', 'effective_at'];
    elsif tg_op = 'DELETE' then
      changed_fields := array['deleted'];
    else
      if old.capability is distinct from new.capability then changed_fields := array_append(changed_fields, 'capability'); end if;
      if old.state is distinct from new.state then changed_fields := array_append(changed_fields, 'state'); end if;
      if old.permitted_roles is distinct from new.permitted_roles then changed_fields := array_append(changed_fields, 'permitted_roles'); end if;
      if old.permitted_cohorts is distinct from new.permitted_cohorts then changed_fields := array_append(changed_fields, 'permitted_cohorts'); end if;
      if old.effective_at is distinct from new.effective_at then changed_fields := array_append(changed_fields, 'effective_at'); end if;
    end if;

    perform private.emit_domain_event(
      'tenant_feature_policy',
      event_id,
      'entitlement.changed',
      1,
      event_tenant,
      'tenant_policy',
      'tenant-policy:' || audit_id::text,
      'tenant-policy-audit:' || audit_id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'policyId', event_id,
        'capability', row_data ->> 'capability',
        'action', lower(tg_op),
        'state', case when tg_op = 'DELETE' then null else row_data ->> 'state' end,
        'changedFields', to_jsonb(changed_fields)
      )),
      'internal',
      'commercial'
    );
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke all on function private.audit_tenant_policy_change() from public, anon, authenticated;

comment on function private.audit_tenant_policy_change() is
  'Writes the policy audit row and, for tenant feature policy only, one bounded entitlement.changed outbox event in the same transaction.';
