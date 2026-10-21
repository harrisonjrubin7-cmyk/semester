-- Two defects in 20261006180000_access_saga_store, found in review after it merged.
-- Forward fix: nothing calls the store yet, so no row can be affected.
--
-- 1. `recovery_code` accepted only lowercase letters, but the runner passes its own
--    reason codes to `flagRecovery`: `RECOVERY_THRESHOLD_EXCEEDED`, `ENFORCEMENT_UNKNOWN`.
--    The flag call failed before `save`, so a saga past `escalateAfter` could never be
--    escalated. It now takes the same code shape as `last_error`.
-- 2. `wake` built its event id as 'wake:' || saga id || ':' || event id. Each part is valid
--    up to 200 characters, so the whole could pass the 200-character limit on
--    `access_saga_events.event_id` and roll back a valid wake. It now hashes the pair.
--
-- Rollback: a forward migration restoring the earlier constraint and function.

alter table public.access_sagas drop constraint if exists access_sagas_recovery_code_check;
alter table public.access_sagas add constraint access_sagas_recovery_code_check
  check (recovery_code is null or recovery_code ~ '^[A-Za-z][A-Za-z0-9_:. -]{0,119}$');

create or replace function public.access_saga_wake(p_id text, p_event_id text, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  cur public.access_sagas;
  to_state text;
  seen int;
begin
  select * into cur from public.access_sagas where id = p_id for update;
  if not found then raise exception 'No such access saga.' using errcode = 'SC404'; end if;
  insert into public.access_saga_signals (saga_id, event_id, kind) values (p_id, p_event_id, p_kind) on conflict do nothing;
  get diagnostics seen = row_count;
  if seen = 0 then return; end if;

  to_state := case
    when p_kind = 'requirements_changed' and cur.state in ('WAITING_STEP_UP', 'WAITING_APPROVAL') then 'VALIDATING'
    when p_kind = 'revoke' and cur.state not in ('RECEIVED', 'DENIED', 'EXPIRED', 'REVOKING', 'RECOVERY_REQUIRED', 'REVOKED') then 'REVOKING'
    when p_kind = 'recover' and cur.state = 'RECOVERY_REQUIRED' then 'REVOKING'
  end;
  if to_state is null then return; end if;

  update public.access_sagas set
    state = to_state,
    revision = cur.revision + 1,
    generation = case when to_state = 'VALIDATING' then cur.generation + 1 else cur.generation end,
    attempts = 0,
    next_attempt_at = (extract(epoch from clock_timestamp()) * 1000)::bigint
  where id = p_id;
  -- Bounded whatever the two ids' lengths: a digest of the (saga, signal) pair.
  insert into public.access_saga_events (event_id, saga_id, tenant_id, revision, type, occurred_at, reason_code)
  values ('wake:' || md5(p_id || chr(31) || p_event_id), p_id, cur.tenant_id, cur.revision + 1, 'access.state.changed', clock_timestamp(), 'signal_' || p_kind);
end $$;

revoke all on function public.access_saga_wake(text, text, text) from public, anon, authenticated;
grant execute on function public.access_saga_wake(text, text, text) to service_role;
