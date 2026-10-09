-- Hold-aware expiry for unused course re-import recovery copies.
--
-- The application row remains as bounded transition evidence, but the exact
-- prior course document is physically cleared after its 30-day rollback
-- window. This is a manually invoked service operation: no scheduler or
-- deployment is enabled here. Account, tenant and platform legal holds win.

alter table public.course_source_resolution_applications
  add column if not exists expired_at timestamptz;

alter table public.course_source_resolution_applications
  drop constraint if exists course_source_resolution_applications_state_check,
  drop constraint if exists course_source_resolution_application_state;

alter table public.course_source_resolution_applications
  add constraint course_source_resolution_applications_state_check
    check (state in ('applied', 'rolled_back', 'expired')),
  add constraint course_source_resolution_application_state check (
    (state = 'applied'
      and previous_data is not null
      and rolled_back_at is null and rolled_back_by is null and expired_at is null)
    or (state = 'rolled_back'
      and previous_data is null
      and rolled_back_at is not null and rolled_back_by is not null and expired_at is null)
    or (state = 'expired'
      and previous_data is null
      and rolled_back_at is null and rolled_back_by is null
      and expired_at is not null and expired_at >= recovery_until));

create or replace function private.prune_course_source_resolution_recovery()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  copies_expired bigint := 0;
begin
  perform private.course_source_service();

  -- Serialize the hold decision with placement and release. Those operations
  -- write legal_holds and must wait until this transaction has finished, so a
  -- hold cannot become live between the check and the scrub below.
  lock table public.legal_holds in share mode;
  if private.platform_is_held() then
    return jsonb_build_object('skipped', 'legal_hold');
  end if;

  update public.course_source_resolution_applications application
     set state = 'expired',
         previous_data = null,
         expired_at = now()
   where application.state = 'applied'
     and application.recovery_until < now()
     and not exists (
       select 1
         from public.legal_holds hold
        where hold.released_at is null
          and (
            (hold.subject_kind = 'tenant' and hold.tenant_id = application.tenant_id)
            or (hold.subject_kind = 'account' and hold.subject_id = application.owner_id::text)
          ));
  get diagnostics copies_expired = row_count;

  return jsonb_build_object('recovery_copies_expired', copies_expired);
end
$$;

revoke all on function private.prune_course_source_resolution_recovery()
  from public, anon, authenticated;
grant execute on function private.prune_course_source_resolution_recovery()
  to service_role;

comment on column public.course_source_resolution_applications.expired_at is
  'When the unused prior course document was cleared after its exact 30-day recovery window.';
comment on function private.prune_course_source_resolution_recovery() is
  'Manually clears elapsed re-import rollback documents while preserving application evidence and honoring account, tenant and platform legal holds. No scheduler is enabled.';
