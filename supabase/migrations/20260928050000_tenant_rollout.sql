-- Semester — where a school stands on the road from directory listing to
-- production, and the evidence that let it move.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- A school is not "on" or "off". It moves through a lifecycle — directory,
-- requested, claimed, security review, sandbox/UAT, pilot read-only, pilot
-- write-enabled, production limited, production active, expansion — and can
-- be paused, suspended, offboarded and archived from along the way. The
-- pilot-to-production tracker (docs/operating-model/PILOT-TO-PRODUCTION.md)
-- names an exit gate for each step. Until now that was a document; nothing
-- stopped a school being recorded as in production with no UAT sign-off on
-- file, which is exactly the false claim the tracker's first rule forbids.
--
-- ## What the database refuses
--
-- - A forward move of more than one step. There is no jumping from sandbox to
--   production.
-- - A forward move whose exit gates have no evidence recorded **since the
--   school entered its current state**. Evidence from an earlier pass through
--   the same state does not carry: a school that was rolled back from pilot
--   write-enabled to read-only must earn the gate again.
-- - Resuming from paused or suspended to anything but the state it was held
--   from, and without remediation evidence.
-- - Archiving without a completion certificate, or from anywhere but
--   offboarding.
-- - A transition with no reason.
--
-- Moving *down* the chain — pilot write-enabled back to read-only, say — needs
-- no evidence. Reducing a school's authority is always allowed; it is the
-- rollback the tracker requires to exist.
--
-- ## Who writes: nobody through the API
--
-- As with `tenant_plan`, a lifecycle state is an operator's record of
-- something institution and Semester agreed. A school administrator holding
-- `tenant:configure` must not be able to move their own school to production,
-- so there is no write policy. The service role writes; administrators and
-- auditors of the school read.
--
-- ## Not wired to feature state
--
-- `feature_state` does not yet read this table. The state is recorded and
-- enforced as a record; making every capability check consult it is a
-- separate decision, with its own rollout, and is not taken here.

create table if not exists public.tenant_rollout (
  tenant_id    text        primary key references public.schools (id) on delete cascade,
  state        text        not null default 'directory' check (state in (
                 'directory', 'requested', 'claimed', 'security_review', 'sandbox_uat',
                 'pilot_read_only', 'pilot_write_enabled', 'production_limited',
                 'production_active', 'expansion',
                 'paused', 'suspended', 'offboarding', 'archived')),
  -- The state a paused or suspended school returns to. Set by the trigger.
  resume_state text        check (resume_state is null or resume_state in (
                 'requested', 'claimed', 'security_review', 'sandbox_uat',
                 'pilot_read_only', 'pilot_write_enabled', 'production_limited',
                 'production_active', 'expansion')),
  entered_at   timestamptz not null default now(),
  reason       text        not null default '' check (length(reason) <= 1000),
  updated_by   uuid        references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now(),
  constraint tenant_rollout_resume_only_when_held
    check ((state in ('paused', 'suspended')) = (resume_state is not null))
);

create index if not exists tenant_rollout_by_updater on public.tenant_rollout (updated_by);

alter table public.tenant_rollout enable row level security;
revoke all on public.tenant_rollout from public;
revoke all on public.tenant_rollout from anon, authenticated;
grant select on public.tenant_rollout to authenticated;

drop policy if exists "tenant administrators and auditors read their rollout" on public.tenant_rollout;
create policy "tenant administrators and auditors read their rollout" on public.tenant_rollout
  for select to authenticated
  using (
    private.has_capability('tenant:configure', 'school', tenant_id)
    or private.has_capability('audit:read', 'school', tenant_id)
  );

-- ── Gate evidence ─────────────────────────────────────────────────────────

create table if not exists public.tenant_rollout_evidence (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools (id) on delete cascade,
  gate         text        not null check (gate in (
                 'institution_request', 'sponsor_qualified', 'security_kickoff',
                 'security_privacy_approval', 'dpa_executed',
                 'uat_signoff', 'rls_isolation_passed', 'sso_login_verified',
                 'source_reconciliation_passed', 'accessibility_review_passed', 'data_quality_adoption',
                 'workflow_reliability', 'cutover_checklist_complete', 'sponsor_go_live',
                 'expansion_decision', 'module_campus_approval',
                 'remediation', 'completion_certificate')),
  -- What was shown: a link, a document reference, a CI run.
  evidence     text        not null check (length(btrim(evidence)) between 1 and 2000),
  -- Who, at the institution or at Semester, accepted it. A name and role, not an account:
  -- the approver of a DPA is rarely a Semester user.
  approved_by  text        not null check (length(btrim(approved_by)) between 1 and 200),
  recorded_by  uuid        references auth.users (id) on delete set null,
  recorded_at  timestamptz not null default now()
);

create index if not exists tenant_rollout_evidence_by_tenant_gate
  on public.tenant_rollout_evidence (tenant_id, gate, recorded_at desc);
create index if not exists tenant_rollout_evidence_by_recorder
  on public.tenant_rollout_evidence (recorded_by);

alter table public.tenant_rollout_evidence enable row level security;
revoke all on public.tenant_rollout_evidence from public;
revoke all on public.tenant_rollout_evidence from anon, authenticated;
grant select on public.tenant_rollout_evidence to authenticated;

drop policy if exists "tenant administrators and auditors read rollout evidence" on public.tenant_rollout_evidence;
create policy "tenant administrators and auditors read rollout evidence" on public.tenant_rollout_evidence
  for select to authenticated
  using (
    private.has_capability('tenant:configure', 'school', tenant_id)
    or private.has_capability('audit:read', 'school', tenant_id)
  );

-- ── Every transition, kept ────────────────────────────────────────────────

create table if not exists public.tenant_rollout_history (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools (id) on delete cascade,
  from_state  text,
  to_state    text        not null,
  reason      text        not null,
  changed_by  uuid        references auth.users (id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists tenant_rollout_history_by_tenant_time
  on public.tenant_rollout_history (tenant_id, changed_at desc);
create index if not exists tenant_rollout_history_by_changer
  on public.tenant_rollout_history (changed_by);

alter table public.tenant_rollout_history enable row level security;
revoke all on public.tenant_rollout_history from public;
revoke all on public.tenant_rollout_history from anon, authenticated;
grant select on public.tenant_rollout_history to authenticated;

drop policy if exists "tenant auditors read rollout history" on public.tenant_rollout_history;
create policy "tenant auditors read rollout history" on public.tenant_rollout_history
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id));

-- ── The rules ─────────────────────────────────────────────────────────────
--
-- One line per state, so app/src/lib/governance/rollout.test.ts can read this
-- file and hold it equal to ROLLOUT_STATES in rollout.ts. Change both or
-- neither.

create or replace function private.rollout_exit_gates(from_state text)
returns text[] language sql immutable set search_path = '' as $$
  select case from_state
    when 'directory' then array['institution_request']
    when 'requested' then array['sponsor_qualified']
    when 'claimed' then array['security_kickoff']
    when 'security_review' then array['security_privacy_approval', 'dpa_executed']
    when 'sandbox_uat' then array['uat_signoff', 'rls_isolation_passed', 'sso_login_verified']
    when 'pilot_read_only' then array['source_reconciliation_passed', 'accessibility_review_passed', 'data_quality_adoption']
    when 'pilot_write_enabled' then array['workflow_reliability', 'cutover_checklist_complete', 'sponsor_go_live']
    when 'production_limited' then array['expansion_decision']
    when 'production_active' then array['module_campus_approval']
    when 'expansion' then array[]::text[]
    when 'paused' then array['remediation']
    when 'suspended' then array['remediation']
    when 'offboarding' then array['completion_certificate']
    when 'archived' then array[]::text[]
  end
$$;

create or replace function private.rollout_rank(s text)
returns int language sql immutable set search_path = '' as $$
  select array_position(array[
    'directory', 'requested', 'claimed', 'security_review', 'sandbox_uat',
    'pilot_read_only', 'pilot_write_enabled', 'production_limited',
    'production_active', 'expansion'], s)
$$;

create or replace function private.guard_tenant_rollout()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  missing text[];
  old_rank int;
  new_rank int;
begin
  if tg_op = 'INSERT' then
    if new.state not in ('directory', 'requested') then
      raise exception 'A school enters the rollout at directory or requested, not %.', new.state;
    end if;
    new.resume_state := null;
    new.entered_at := clock_timestamp();
    new.updated_at := clock_timestamp();
    return new;
  end if;

  -- Only the state machine moves these.
  new.entered_at := old.entered_at;
  new.resume_state := old.resume_state;
  new.updated_at := clock_timestamp();

  if new.state = old.state then
    return new;
  end if;

  if length(btrim(new.reason)) = 0 or new.reason = old.reason then
    raise exception 'A rollout transition needs its own reason.';
  end if;

  old_rank := private.rollout_rank(old.state);
  new_rank := private.rollout_rank(new.state);

  if old.state = 'archived' then
    raise exception 'An archived school does not move.';

  elsif new.state in ('paused', 'suspended') then
    if old.state = 'paused' and new.state = 'suspended' then
      null; -- escalation keeps where it was held from
    elsif old_rank is null or old.state = 'directory' then
      raise exception 'Only a school in the rollout can be %, not one in %.', new.state, old.state;
    else
      new.resume_state := old.state;
    end if;

  elsif new.state = 'offboarding' then
    if old.state = 'directory' then
      raise exception 'A directory listing has nothing to offboard.';
    end if;
    new.resume_state := null;

  elsif new.state = 'archived' then
    if old.state <> 'offboarding' then
      raise exception 'A school is archived from offboarding, not from %.', old.state;
    end if;

  elsif old.state in ('paused', 'suspended') then
    if new.state is distinct from old.resume_state then
      raise exception 'A % school resumes to %, where it was held, not %.', old.state, old.resume_state, new.state;
    end if;
    new.resume_state := null;

  elsif old.state = 'offboarding' then
    raise exception 'An offboarding school is archived, not moved to %.', new.state;

  elsif new_rank < old_rank then
    null; -- stepping down reduces authority and needs no evidence

  elsif new_rank <> old_rank + 1 then
    raise exception 'A school moves one step at a time: % is not next after %.', new.state, old.state;
  end if;

  -- Moving down the chain, into a hold, or into offboarding needs no evidence.
  -- Everything else must show the exit gates of the state it is leaving,
  -- recorded since it entered that state.
  if not (new_rank is not null and old_rank is not null and new_rank < old_rank)
     and new.state not in ('paused', 'suspended', 'offboarding') then
    select coalesce(array_agg(g order by g), array[]::text[]) into missing
      from unnest(private.rollout_exit_gates(old.state)) g
     where not exists (
       select 1 from public.tenant_rollout_evidence e
        where e.tenant_id = old.tenant_id and e.gate = g and e.recorded_at >= old.entered_at);
    if cardinality(missing) > 0 then
      raise exception 'Leaving % needs evidence for: %.', old.state, array_to_string(missing, ', ');
    end if;
  end if;

  new.entered_at := clock_timestamp();
  return new;
end $$;

-- Clock time, not transaction time, and never the caller's: "recorded since the
-- school entered its state" has to order an evidence row and a transition made
-- in the same transaction, and a supplied timestamp could date evidence ahead.
create or replace function private.stamp_tenant_rollout_evidence()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.recorded_at := clock_timestamp();
  return new;
end $$;

create or replace function private.record_tenant_rollout_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.state is distinct from old.state then
    insert into public.tenant_rollout_history (tenant_id, from_state, to_state, reason, changed_by)
    values (new.tenant_id, case when tg_op = 'UPDATE' then old.state end, new.state, new.reason, new.updated_by);
  end if;
  return new;
end $$;

create or replace function private.refuse_tenant_rollout_record_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Rollout evidence and history are immutable.';
end $$;

revoke all on function private.rollout_exit_gates(text) from public, anon, authenticated;
revoke all on function private.rollout_rank(text) from public, anon, authenticated;
revoke all on function private.guard_tenant_rollout() from public, anon, authenticated;
revoke all on function private.stamp_tenant_rollout_evidence() from public, anon, authenticated;
revoke all on function private.record_tenant_rollout_change() from public, anon, authenticated;
revoke all on function private.refuse_tenant_rollout_record_change() from public, anon, authenticated;

drop trigger if exists tenant_rollout_guarded on public.tenant_rollout;
create trigger tenant_rollout_guarded
before insert or update on public.tenant_rollout
for each row execute function private.guard_tenant_rollout();

drop trigger if exists tenant_rollout_recorded on public.tenant_rollout;
create trigger tenant_rollout_recorded
after insert or update on public.tenant_rollout
for each row execute function private.record_tenant_rollout_change();

drop trigger if exists tenant_rollout_evidence_stamped on public.tenant_rollout_evidence;
create trigger tenant_rollout_evidence_stamped
before insert on public.tenant_rollout_evidence
for each row execute function private.stamp_tenant_rollout_evidence();

drop trigger if exists tenant_rollout_evidence_immutable on public.tenant_rollout_evidence;
create trigger tenant_rollout_evidence_immutable
before update or delete on public.tenant_rollout_evidence
for each row execute function private.refuse_tenant_rollout_record_change();

drop trigger if exists tenant_rollout_history_immutable on public.tenant_rollout_history;
create trigger tenant_rollout_history_immutable
before update or delete on public.tenant_rollout_history
for each row execute function private.refuse_tenant_rollout_record_change();

comment on table public.tenant_rollout is
  'Where one school stands in the pilot-to-production lifecycle. Written only by the service role; transitions are refused unless one step forward with the leaving state''s exit-gate evidence, a step down, a hold, or offboarding.';
comment on table public.tenant_rollout_evidence is
  'Immutable evidence that a rollout exit gate was met: what was shown and who accepted it. Only evidence recorded since the school entered its current state counts.';
comment on table public.tenant_rollout_history is
  'Immutable record of every tenant_rollout state change.';
