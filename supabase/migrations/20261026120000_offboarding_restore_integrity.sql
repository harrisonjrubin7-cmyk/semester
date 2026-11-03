-- Fail closed before restoring an offboarded school when any recorded undo
-- target is missing, belongs to another tenant, or no longer has the state
-- created by disable_school_access(). The original workflow counted attempted
-- updates, so a deleted or changed target could be reported as restored and
-- the case closed after a partial no-op.

create or replace function public.restore_school(want uuid, why text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  u record;
  affected integer;
  n_grants integer := 0;
  n_conns integer := 0;
  resumed boolean := false;
begin
  c := private.offboarding_case(want, array['access_disabled', 'export_verified', 'archived']);
  if c.purge_authorized_by is not null then
    raise exception 'A purge has been authorized; this case cannot be restored.' using errcode = '23514';
  end if;
  if why is null or length(btrim(why)) = 0 then
    raise exception 'A restoration needs its reason.' using errcode = '22023';
  end if;
  if me = c.access_disabled_by then
    raise exception 'A school is restored by a different operator from the one who disabled it.' using errcode = '42501';
  end if;

  -- Validate the complete undo set before changing any target. The case row is
  -- already locked by offboarding_case(), and each target is locked here so a
  -- concurrent writer cannot change the answer between validation and restore.
  for u in
    select * from public.school_offboarding_undo
     where case_id = want
     order by kind, object_id
  loop
    if u.kind = 'role_grant' then
      perform 1 from public.role_grants g
       where g.id = u.object_id::uuid
         and g.scope_kind = 'school'
         and g.scope_id = c.tenant_id
         and g.subject::text = u.prior ->> 'subject'
         and g.role = u.prior ->> 'role'
         and g.revoked_at is not null
       for update;
      if not found then
        raise exception 'Restore paused: a recorded role grant is missing or no longer matches this school; no restoration was applied.'
          using errcode = '55000';
      end if;
    elsif u.kind = 'connection' then
      perform 1 from public.integration_connections i
       where i.id = u.object_id::uuid
         and i.tenant_id = c.tenant_id
         and i.status = 'disconnected'
         and i.credentials_reference is null
       for update;
      if not found then
        raise exception 'Restore paused: a recorded connection is missing or no longer matches this school; no restoration was applied.'
          using errcode = '55000';
      end if;
    elsif u.kind = 'rollout' then
      if u.object_id <> c.tenant_id then
        raise exception 'Restore paused: the recorded roll-out does not belong to this school; no restoration was applied.'
          using errcode = '55000';
      end if;
      perform 1 from public.tenant_rollout r
       where r.tenant_id = c.tenant_id and r.state = 'suspended'
       for update;
      if not found then
        raise exception 'Restore paused: the recorded roll-out is missing or no longer suspended; no restoration was applied.'
          using errcode = '55000';
      end if;
    else
      raise exception 'Restore paused: the case contains an unsupported undo target; no restoration was applied.'
        using errcode = '55000';
    end if;
  end loop;

  perform set_config('semester.offboarding_restore', 'on', true);

  for u in
    select * from public.school_offboarding_undo
     where case_id = want and kind = 'role_grant'
     order by object_id
  loop
    update public.role_grants
       set revoked_at = null
     where id = u.object_id::uuid
       and scope_kind = 'school'
       and scope_id = c.tenant_id
       and subject::text = u.prior ->> 'subject'
       and role = u.prior ->> 'role'
       and revoked_at is not null;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Restore paused: a recorded role grant changed during restoration; no restoration was applied.'
        using errcode = '40001';
    end if;
    n_grants := n_grants + 1;
  end loop;

  for u in
    select * from public.school_offboarding_undo
     where case_id = want and kind = 'connection'
     order by object_id
  loop
    update public.integration_connections
       set status = u.prior ->> 'status',
           credentials_reference = u.prior ->> 'credentials_reference'
     where id = u.object_id::uuid
       and tenant_id = c.tenant_id
       and status = 'disconnected'
       and credentials_reference is null;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Restore paused: a recorded connection changed during restoration; no restoration was applied.'
        using errcode = '40001';
    end if;
    n_conns := n_conns + 1;
  end loop;

  if exists (
    select 1 from public.school_offboarding_undo
     where case_id = want and kind = 'rollout'
  ) then
    insert into public.tenant_rollout_evidence (tenant_id, gate, evidence, approved_by, recorded_by)
    values (c.tenant_id, 'remediation', 'Offboarding case ' || want::text || ' restored: ' || why, 'platform operator', me);
    update public.tenant_rollout
       set state = (
             select u2.prior ->> 'state'
               from public.school_offboarding_undo u2
              where u2.case_id = want and u2.kind = 'rollout'
           ),
           reason = 'Offboarding case ' || want::text || ' restored',
           updated_by = me
     where tenant_id = c.tenant_id and state = 'suspended';
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Restore paused: the recorded roll-out changed during restoration; no restoration was applied.'
        using errcode = '40001';
    end if;
    resumed := true;
  end if;

  perform set_config('semester.offboarding_restore', 'off', true);
  update public.school_offboarding
     set status = 'restored', restored_by = me, restored_at = now(), restore_reason = why
   where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_restored', 'school_offboarding', want::text, 'allowed',
                               null, jsonb_build_object('grants', n_grants, 'connections', n_conns));
  return jsonb_build_object('grants', n_grants, 'connections', n_conns, 'rollout_resumed', resumed);
end $$;

revoke all on function public.restore_school(uuid, text) from public, anon;
grant execute on function public.restore_school(uuid, text) to authenticated;

comment on function public.restore_school(uuid, text) is
  'Restores one school offboarding case atomically after validating every immutable undo target still belongs to the school and remains in the disabled state.';
