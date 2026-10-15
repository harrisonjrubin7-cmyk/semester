-- Raising a provider's maturity to a syncing level goes through the approval
-- pattern.
--
-- F-1 in docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md: a `platform:configure`
-- holder could set any row of `provider_registry` to `authorized_writeback`
-- with a direct INSERT or UPDATE — no request, no second person, no console
-- action record. The registry is what the in-app provider list tells every
-- school about a vendor, so "this connector writes back" is a claim Semester
-- makes to customers, and one account could make it alone.
--
--   planned / manual / read_only        direct write, as before
--   any demotion                        direct write, as before (claiming
--                                        less than is true is the safe way
--                                        to be wrong)
--   incremental / event_driven /
--   authorized_writeback, RAISED to     duty `provider-maturity`:
--                                        request_approval -> two approvers
--                                        -> console_act, which writes the
--                                        console action record, which runs
--                                        the raise below
--
-- Why a guard trigger and not a policy: a policy sees only the new row, and
-- "raised" is a comparison with the old one. Why an executor on
-- `console_action_record` and not a branch in `console_act`: the same reason
-- as 20261012050000 — `console_act` has been redefined across several
-- migrations and the record is insert-only to nobody but `console_act`.
--
-- The guard binds the client roles (`authenticated`, `anon`). The executor is
-- a security definer owned by the table owner, so it is not one of them;
-- server code holding the service key is not either, and is trusted as it is
-- for every other table.

-- ── 1. The duty ─────────────────────────────────────────────────────────────

insert into public.console_duty (id, action, requester, approvers, two_person, evidence) values
  ('provider-maturity',
   'Raise a connector provider to incremental, event-driven or write-back',
   'engineering', array['security', 'product'], true,
   'The validation run for the connector, its connector and support owners, and the compatibility version it was tested against')
on conflict (id) do update
  set action = excluded.action, requester = excluded.requester,
      approvers = excluded.approvers, two_person = excluded.two_person,
      evidence = excluded.evidence;

-- ── 2. The ladder ───────────────────────────────────────────────────────────

create or replace function private.provider_maturity_rank(m text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case m
    when 'planned' then 0
    when 'manual' then 1
    when 'read_only' then 2
    when 'incremental' then 3
    when 'event_driven' then 4
    when 'authorized_writeback' then 5
  end
$$;

revoke all on function private.provider_maturity_rank(text) from public, anon, authenticated;

-- ── 3. What a request must say ──────────────────────────────────────────────

create or replace function private.check_provider_maturity_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.provider_registry;
  want text;
begin
  if new.duty_id <> 'provider-maturity' then
    return new;
  end if;
  if new.tenant_id is not null then
    raise exception 'A provider maturity change names no tenant.' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    if not private.has_capability('platform:configure', 'platform', '') then
      raise exception 'platform:configure at platform scope is required.' using errcode = '42501';
    end if;
    select * into p from public.provider_registry where id = new.target;
    if not found then
      raise exception 'The target must be a provider in the registry.' using errcode = '23514';
    end if;
    want := new.detail ->> 'maturity';
    if private.provider_maturity_rank(want) is null
       or private.provider_maturity_rank(want) < private.provider_maturity_rank('incremental') then
      raise exception 'detail.maturity must be incremental, event_driven or authorized_writeback.' using errcode = '23514';
    end if;
    if private.provider_maturity_rank(want) <= private.provider_maturity_rank(p.maturity) then
      raise exception 'detail.maturity must be higher than the provider''s current maturity (%).', p.maturity
        using errcode = '23514';
    end if;
    if length(trim(p.connector_owner)) = 0 or length(trim(p.support_owner)) = 0 then
      raise exception 'The provider needs a connector owner and a support owner before it can be raised.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

revoke all on function private.check_provider_maturity_request() from public, anon, authenticated;
drop trigger if exists approval_request_provider_maturity on public.approval_request;
create trigger approval_request_provider_maturity
  before insert or update on public.approval_request
  for each row execute function private.check_provider_maturity_request();

-- ── 4. The executor ─────────────────────────────────────────────────────────

create or replace function private.execute_provider_maturity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.approval_request;
begin
  if new.duty_id <> 'provider-maturity' then
    return new;
  end if;
  select * into req from public.approval_request where id = new.request_id;
  -- The approval is the validation: the evidence the approvers read is the
  -- validation run, so `last_validated_at` is the moment they said yes.
  update public.provider_registry
     set maturity = req.detail ->> 'maturity',
         compatibility_version = coalesce(nullif(req.detail ->> 'compatibility_version', ''), compatibility_version),
         last_validated_at = now(),
         updated_at = now()
   where id = new.target
     and private.provider_maturity_rank(maturity) < private.provider_maturity_rank(req.detail ->> 'maturity');
  if not found then
    raise exception 'Provider % is not below %, so there is nothing to raise.', new.target, req.detail ->> 'maturity';
  end if;
  return new;
end $$;

revoke all on function private.execute_provider_maturity() from public, anon, authenticated;
drop trigger if exists console_action_record_provider_maturity on public.console_action_record;
create trigger console_action_record_provider_maturity
  after insert on public.console_action_record
  for each row execute function private.execute_provider_maturity();

-- ── 5. Close the direct path ────────────────────────────────────────────────
-- Not security definer: `current_user` here is the role running the
-- statement, which is `authenticated` for a signed-in client and the table
-- owner inside the executor above.

create or replace function private.guard_provider_maturity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ladder constant text[] := array['planned', 'manual', 'read_only', 'incremental', 'event_driven', 'authorized_writeback'];
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- The ladder is inline: this runs as the client role, which cannot call the
  -- private helper the definer functions use.
  if array_position(ladder, new.maturity) >= array_position(ladder, 'incremental')
     and (tg_op = 'INSERT' or array_position(ladder, new.maturity) > array_position(ladder, old.maturity)) then
    raise exception 'Raising a provider to % goes through the provider-maturity duty (request_approval, two approvers, console_act).',
      new.maturity using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.guard_provider_maturity() from public, anon, authenticated;
drop trigger if exists provider_registry_maturity_guard on public.provider_registry;
create trigger provider_registry_maturity_guard
  before insert or update on public.provider_registry
  for each row execute function private.guard_provider_maturity();
