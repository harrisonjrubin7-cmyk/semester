-- Releasing a platform kill switch goes through the approval pattern.
--
-- F-1 in docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md: a `killswitch:engage`
-- holder could set any switch back to released with a direct UPDATE — no
-- request, no second person, no console action record. Engaging a switch is
-- the safety stop and stays immediate; letting a platform-wide stop go is the
-- decision that needs a second pair of eyes.
--
--   engage   platform or school scope   direct write, as before
--   release  school scope               direct write, as before (a school
--                                        administering its own tenant)
--   release  PLATFORM scope             duty `killswitch-release`:
--                                        request_approval -> two approvers
--                                        -> console_act, which writes the
--                                        console action record, which runs
--                                        the release below
--
-- Why a trigger on `console_action_record` and not a branch in `console_act`:
-- `console_act` already writes that record for every duty without an executor
-- and has been redefined across several migrations, so copying its body into
-- a fourth one would be the larger risk. The record is insert-only to nobody
-- but `console_act` (no client holds INSERT on it), so the trigger can only
-- fire for an approved, audited request.

-- ── 1. The duty ─────────────────────────────────────────────────────────────

insert into public.console_duty (id, action, requester, approvers, two_person, evidence) values
  ('killswitch-release',
   'Release a platform-wide kill switch',
   'engineering', array['security', 'founder'], true,
   'The incident ticket, why the cause is closed, and how the switch will be re-engaged if it recurs')
on conflict (id) do update
  set action = excluded.action, requester = excluded.requester,
      approvers = excluded.approvers, two_person = excluded.two_person,
      evidence = excluded.evidence;

-- ── 2. What a request must say ──────────────────────────────────────────────

create or replace function private.check_killswitch_release_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.duty_id <> 'killswitch-release' then
    return new;
  end if;
  if new.tenant_id is not null then
    raise exception 'A platform kill-switch release names no tenant.' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    if not private.has_capability('killswitch:engage', 'platform', '') then
      raise exception 'killswitch:engage at platform scope is required.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.feature_kill_switch k
       where k.tenant_id is null and k.switch_key = new.target and k.engaged
    ) then
      raise exception 'The target must be a platform kill switch that is engaged.' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

revoke all on function private.check_killswitch_release_request() from public, anon, authenticated;
drop trigger if exists approval_request_killswitch_release on public.approval_request;
create trigger approval_request_killswitch_release
  before insert or update on public.approval_request
  for each row execute function private.check_killswitch_release_request();

-- ── 3. The executor ─────────────────────────────────────────────────────────

create or replace function private.execute_killswitch_release()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.duty_id <> 'killswitch-release' then
    return new;
  end if;
  update public.feature_kill_switch
     set engaged = false,
         reason = left(format('Released by console request %s', new.request_id), 1000),
         updated_at = now()
   where tenant_id is null and switch_key = new.target and engaged;
  if not found then
    raise exception 'Platform kill switch % is not engaged, so there is nothing to release.', new.target;
  end if;
  return new;
end $$;

revoke all on function private.execute_killswitch_release() from public, anon, authenticated;
drop trigger if exists console_action_record_killswitch_release on public.console_action_record;
create trigger console_action_record_killswitch_release
  after insert on public.console_action_record
  for each row execute function private.execute_killswitch_release();

-- ── 4. Close the direct path ────────────────────────────────────────────────
-- A platform row may still be engaged or re-reasoned directly; it may not be
-- left released. The executor above is a security definer owned by the table
-- owner, so row-level security does not apply to it.

drop policy if exists "switch holders change switches" on public.feature_kill_switch;
create policy "switch holders change switches" on public.feature_kill_switch
  for update to authenticated
  using (case when tenant_id is null
              then private.has_capability('killswitch:engage', 'platform', '')
              else private.has_capability('killswitch:engage', 'school', tenant_id) end)
  with check (case when tenant_id is null
                   then private.has_capability('killswitch:engage', 'platform', '') and engaged
                   else private.has_capability('killswitch:engage', 'school', tenant_id) end);
