-- The academic-record ledger (D-145): a school's record of each student's
-- enrollment, grades, credits, requirements, transfer credit, standing and
-- degree conferral, kept the way a financial ledger is kept.
--
-- The brief of 29 September asks that every academic change answer: who
-- changed it, what changed, why, who approved it, when it became effective,
-- what the previous value was, which workflow or source caused it, and
-- whether it can be corrected without deleting history. Three tables and one
-- trigger make every one of those a column:
--
--   1. Nobody writes the ledger. A change is proposed in
--      `academic_record_changes` with a reason, an effective date and its
--      source; when someone *other than its proposer* approves it, the
--      trigger writes one row to `academic_record_entries`, capturing the
--      entry it replaces and that entry's value.
--   2. The ledger is append-only. A correction is a new entry; a reversal is
--      a `void` entry; nothing is edited or deleted, by a client or by the
--      owner.
--   3. Correcting or voiding a grade, a standing or a conferral that already
--      has an entry in effect is a registrar override, and only an approver
--      holding `record:override` may approve it. The database decides that
--      from the ledger, not from a flag the client sends.
--   4. A record belongs to the school and is keyed by the school's own
--      student identifier. `academic_record_subjects` links an account to
--      it, so a student can read their own entries; deleting the account
--      removes the link, and the school's record stays.
--
-- What this is not: an official transcript. It is the record a registrar
-- keeps; issuing a transcript or a credential is not done here.
--
-- One function is security definer — the trigger that writes the ledger,
-- because no client holds a grant on it — and it is in `private`, revoked
-- from every client role, so nothing can call it. The grants allowlist and
-- the definer register are unchanged.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('record:propose',  'Propose a change to one school''s academic record, with a reason, an effective date and its source. Never approves it.'),
  ('record:approve',  'Approve or reject a proposed change to one school''s academic record, never one they proposed, and link an account to its record.'),
  ('record:override', 'Approve a correction or reversal of a grade, standing or conferral already on one school''s record: a registrar override.'),
  ('record:read',     'Read one school''s academic record ledger and its proposed changes.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar', 'record:propose'),
  ('registrar', 'record:approve'),
  ('registrar', 'record:override'),
  ('registrar', 'record:read'),
  ('faculty',   'record:propose'),
  ('dean',      'record:approve'),
  ('dean',      'record:read')
on conflict (role, capability) do nothing;

-- ── 2. The tables ─────────────────────────────────────────────────────────

create table if not exists public.academic_record_subjects (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  student_ref  text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  -- The account that may read this record. Removed with the account; the record stays with the school.
  user_id      uuid        not null references auth.users(id) on delete cascade,
  linked_by    uuid        default auth.uid() references auth.users(id) on delete set null,
  linked_at    timestamptz not null default now(),
  unique (tenant_id, student_ref),
  unique (tenant_id, user_id)
);
create index if not exists academic_record_subjects_by_user on public.academic_record_subjects (user_id);
create index if not exists academic_record_subjects_by_linker on public.academic_record_subjects (linked_by);

create table if not exists public.academic_record_changes (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  student_ref    text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  kind           text        not null check (kind in (
                   'enrollment', 'grade', 'credit', 'requirement', 'transfer_credit', 'standing', 'conferral')),
  -- `between` spelled out: inside an AND it nests, and a dump and restore
  -- flatten it, so the constraint would not read back as written
  -- (20260929040000_round_trip_stable_checks.sql says why).
  subject_key    text        not null check (length(trim(subject_key)) >= 1 and length(trim(subject_key)) <= 120 and subject_key = trim(subject_key)),
  action         text        not null default 'set' check (action in ('set', 'void')),
  value          text        not null default '' check (length(value) <= 200),
  effective_on   date        not null,
  reason         text        not null check (length(trim(reason)) >= 10 and length(reason) <= 2000),
  source         text        not null check (source in (
                   'registrar', 'faculty', 'sis_import', 'migration', 'transfer_evaluation', 'appeal')),
  status         text        not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'withdrawn')),
  proposed_by    uuid        default auth.uid() references auth.users(id) on delete set null,
  proposed_at    timestamptz not null default clock_timestamp(),
  decided_by     uuid        references auth.users(id) on delete set null,
  decided_at     timestamptz,
  decision_note  text        not null default '' check (length(decision_note) <= 2000),
  entry_id       uuid,
  constraint academic_record_change_value check (
    (action = 'set' and length(trim(value)) >= 1) or (action = 'void' and value = '')),
  constraint academic_record_change_decided check (
    (status = 'proposed') = (decided_at is null)),
  constraint academic_record_change_entry check ((status = 'approved') = (entry_id is not null))
);
create index if not exists academic_record_changes_by_student on public.academic_record_changes (tenant_id, student_ref, status);
create index if not exists academic_record_changes_by_proposer on public.academic_record_changes (proposed_by);
create index if not exists academic_record_changes_by_decider on public.academic_record_changes (decided_by);

create table if not exists public.academic_record_entries (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          text        not null references public.schools(id) on delete cascade,
  student_ref        text        not null,
  kind               text        not null,
  subject_key        text        not null,
  action             text        not null,
  value              text        not null,
  -- The entry this one replaced on its effective date, and that entry's value
  -- ('' if it was a removal). Both null for the first entry on a key.
  previous_entry_id  uuid        references public.academic_record_entries(id),
  previous_value     text,
  effective_on       date        not null,
  reason             text        not null,
  source             text        not null,
  change_id          uuid        not null unique references public.academic_record_changes(id),
  proposed_by        uuid        references auth.users(id) on delete set null,
  approved_by        uuid        references auth.users(id) on delete set null,
  override           boolean     not null,
  recorded_at        timestamptz not null default clock_timestamp()
);
create index if not exists academic_record_entries_by_key on public.academic_record_entries
  (tenant_id, student_ref, kind, subject_key, effective_on, recorded_at);
create index if not exists academic_record_entries_by_previous on public.academic_record_entries (previous_entry_id);
create index if not exists academic_record_entries_by_proposer on public.academic_record_entries (proposed_by);
create index if not exists academic_record_entries_by_approver on public.academic_record_entries (approved_by);

-- The change's entry, once it has one. Added after both tables exist.
alter table public.academic_record_changes drop constraint if exists academic_record_changes_entry_fk;
alter table public.academic_record_changes
  add constraint academic_record_changes_entry_fk foreign key (entry_id) references public.academic_record_entries(id);
create index if not exists academic_record_changes_by_entry on public.academic_record_changes (entry_id);

-- ── 3. The rules ──────────────────────────────────────────────────────────

-- The entry in effect for a key on a date: the one the ledger's order puts
-- last among those effective by then (`inEffect` in lib/record/ledger.ts).
create or replace function private.academic_record_in_effect(
  want_tenant text, want_student text, want_kind text, want_key text, on_date date)
returns public.academic_record_entries language sql stable set search_path = '' as $$
  select e.* from public.academic_record_entries e
   where e.tenant_id = want_tenant and e.student_ref = want_student
     and e.kind = want_kind and e.subject_key = want_key and e.effective_on <= on_date
   order by e.effective_on desc, e.recorded_at desc, e.id desc
   limit 1;
$$;
revoke all on function private.academic_record_in_effect(text, text, text, text, date) from public, anon, authenticated;

-- Proposed as the caller, decided by someone else, and on approval written to
-- the ledger. Definer rights only so it can write the ledger, which no client
-- can; every rule about *who* is checked here, against the caller.
create or replace function private.academic_record_change_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  prior public.academic_record_entries;
  is_override boolean;
  written uuid;
begin
  if tg_op = 'INSERT' then
    if caller is not null and not private.has_capability('record:propose', 'school', new.tenant_id) then
      raise exception 'Your account cannot propose a change to this school''s record.' using errcode = '42501';
    end if;
    new.status := 'proposed';
    new.proposed_by := caller;
    new.proposed_at := clock_timestamp();
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := '';
    new.entry_id := null;
    return new;
  end if;

  -- Account deletion clearing a person reference is not a change to the record.
  if (to_jsonb(new) - array['proposed_by', 'decided_by']) = (to_jsonb(old) - array['proposed_by', 'decided_by'])
     and (new.proposed_by is null or new.proposed_by = old.proposed_by)
     and (new.decided_by is null or new.decided_by = old.decided_by) then
    return new;
  end if;

  if old.status <> 'proposed' then
    raise exception 'A decided change is part of the record and does not change; propose a new one.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['status', 'decided_by', 'decided_at', 'decision_note', 'entry_id'])
     <> (to_jsonb(old) - array['status', 'decided_by', 'decided_at', 'decision_note', 'entry_id']) then
    raise exception 'A proposed change is not edited; withdraw it and propose another.' using errcode = '42501';
  end if;

  if new.status = 'withdrawn' then
    if old.proposed_by is distinct from caller then
      raise exception 'Only the person who proposed a change withdraws it.' using errcode = '42501';
    end if;
  elsif new.status in ('approved', 'rejected') then
    if not private.has_capability('record:approve', 'school', old.tenant_id) then
      raise exception 'Your account cannot decide changes to this school''s record.' using errcode = '42501';
    end if;
    if old.proposed_by = caller then
      raise exception 'The person who proposed a change does not decide it.' using errcode = '42501';
    end if;
  else
    raise exception 'A proposed change is approved, rejected or withdrawn.' using errcode = '23514';
  end if;

  new.decided_by := caller;
  new.decided_at := clock_timestamp();
  new.entry_id := null;

  if new.status = 'approved' then
    -- One approval at a time per record line: two approved together must not
    -- both read the same entry in effect, so each names what it replaced and
    -- the second is an override. Read committed, so the read after the lock
    -- sees the first's entry.
    perform pg_advisory_xact_lock(hashtextextended(
      'academic_record:' || old.tenant_id || ':' || old.student_ref || ':' || old.kind || ':' || old.subject_key, 0));
    prior := private.academic_record_in_effect(old.tenant_id, old.student_ref, old.kind, old.subject_key, old.effective_on);
    if old.action = 'void' and (prior.id is null or prior.action = 'void') then
      raise exception 'There is nothing in effect on % to remove.', old.effective_on using errcode = '23514';
    end if;
    is_override := old.kind in ('grade', 'standing', 'conferral') and prior.id is not null;
    if is_override and not private.has_capability('record:override', 'school', old.tenant_id) then
      raise exception 'Correcting a % already on the record is a registrar override.', replace(old.kind, '_', ' ')
        using errcode = '42501';
    end if;
    insert into public.academic_record_entries
      (tenant_id, student_ref, kind, subject_key, action, value, previous_entry_id, previous_value,
       effective_on, reason, source, change_id, proposed_by, approved_by, override)
    values
      (old.tenant_id, old.student_ref, old.kind, old.subject_key, old.action, old.value, prior.id, prior.value,
       old.effective_on, old.reason, old.source, old.id, old.proposed_by, caller, is_override)
    returning id into written;
    new.entry_id := written;
  end if;
  return new;
end $$;
revoke all on function private.academic_record_change_guard() from public, anon, authenticated;
drop trigger if exists academic_record_change_guard on public.academic_record_changes;
create trigger academic_record_change_guard before insert or update on public.academic_record_changes
  for each row execute function private.academic_record_change_guard();

-- The ledger: append-only, for everyone including the owner, except for the
-- person references account deletion clears.
create or replace function private.academic_record_entries_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(new) - array['proposed_by', 'approved_by']) = (to_jsonb(old) - array['proposed_by', 'approved_by'])
     and (new.proposed_by is null or new.proposed_by = old.proposed_by)
     and (new.approved_by is null or new.approved_by = old.approved_by) then
    return new;
  end if;
  -- A school's removal takes its record with it; nothing else deletes an entry.
  if tg_op = 'DELETE' and not exists (select 1 from public.schools s where s.id = old.tenant_id) then
    return old;
  end if;
  raise exception 'The academic record is append-only; a correction is a new entry.' using errcode = '42501';
end $$;
revoke all on function private.academic_record_entries_append_only() from public, anon, authenticated;
drop trigger if exists academic_record_entries_append_only on public.academic_record_entries;
create trigger academic_record_entries_append_only before update or delete on public.academic_record_entries
  for each row execute function private.academic_record_entries_append_only();

-- A link is made by an approver, not claimed by the student.
create or replace function private.academic_record_subject_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.linked_by := auth.uid();
  new.linked_at := now();
  return new;
end $$;
revoke all on function private.academic_record_subject_stamp() from public, anon, authenticated;
drop trigger if exists academic_record_subject_stamp on public.academic_record_subjects;
create trigger academic_record_subject_stamp before insert on public.academic_record_subjects
  for each row execute function private.academic_record_subject_stamp();

-- ── 4. Row-level security ─────────────────────────────────────────────────

alter table public.academic_record_subjects enable row level security;
alter table public.academic_record_changes  enable row level security;
alter table public.academic_record_entries  enable row level security;

revoke all on table public.academic_record_subjects, public.academic_record_changes, public.academic_record_entries
  from anon, authenticated;
grant select, insert, delete on table public.academic_record_subjects to authenticated;
grant select, insert, update on table public.academic_record_changes to authenticated;
grant select on table public.academic_record_entries to authenticated;

drop policy if exists "record staff and the student read the link" on public.academic_record_subjects;
create policy "record staff and the student read the link" on public.academic_record_subjects
  for select to authenticated
  using (user_id = (select auth.uid())
         or private.has_capability('record:read', 'school', tenant_id)
         or private.has_capability('record:approve', 'school', tenant_id));
drop policy if exists "record approvers link an account" on public.academic_record_subjects;
create policy "record approvers link an account" on public.academic_record_subjects
  for insert to authenticated
  with check (private.has_capability('record:approve', 'school', tenant_id));
drop policy if exists "record approvers unlink an account" on public.academic_record_subjects;
create policy "record approvers unlink an account" on public.academic_record_subjects
  for delete to authenticated
  using (private.has_capability('record:approve', 'school', tenant_id));

drop policy if exists "record staff and the proposer read changes" on public.academic_record_changes;
create policy "record staff and the proposer read changes" on public.academic_record_changes
  for select to authenticated
  using (proposed_by = (select auth.uid())
         or private.has_capability('record:read', 'school', tenant_id)
         or private.has_capability('record:approve', 'school', tenant_id));
drop policy if exists "record proposers propose" on public.academic_record_changes;
create policy "record proposers propose" on public.academic_record_changes
  for insert to authenticated
  with check (private.has_capability('record:propose', 'school', tenant_id));
-- Approvers decide and proposers withdraw; the trigger says which move is whose.
drop policy if exists "record approvers decide and proposers withdraw" on public.academic_record_changes;
create policy "record approvers decide and proposers withdraw" on public.academic_record_changes
  for update to authenticated
  using (proposed_by = (select auth.uid()) or private.has_capability('record:approve', 'school', tenant_id))
  with check (proposed_by = (select auth.uid()) or private.has_capability('record:approve', 'school', tenant_id));

drop policy if exists "record staff and the student read the ledger" on public.academic_record_entries;
create policy "record staff and the student read the ledger" on public.academic_record_entries
  for select to authenticated
  using (private.has_capability('record:read', 'school', tenant_id)
         or private.has_capability('record:approve', 'school', tenant_id)
         or exists (select 1 from public.academic_record_subjects s
                     where s.tenant_id = academic_record_entries.tenant_id
                       and s.student_ref = academic_record_entries.student_ref
                       and s.user_id = (select auth.uid())));

-- ── 5. Audit ──────────────────────────────────────────────────────────────
-- The ledger is its own audit trail. The proposals and the links are
-- audited, so a rejected or withdrawn change and an account's access to a
-- record are attributed to the grant that allowed them.

alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record',
    'feature_kill_switch', 'data_classification_rules', 'integration_connections',
    'integration_scopes', 'integration_mappings', 'integration_dead_letter_events',
    'governance_policy_nodes', 'governance_steward_assignments', 'governance_config_requests',
    'gtm_campaigns', 'gtm_campaign_reviews', 'gtm_sponsor_policy', 'gtm_sponsor_placements',
    'migration_projects', 'migration_field_maps', 'migration_runs', 'migration_approvals',
    'academic_record_changes', 'academic_record_subjects'
  ));

create or replace function private.audit_academic_record_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data   jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  caller uuid := auth.uid();
  grant_id uuid;
begin
  if tg_op = 'UPDATE'
     and (before_row - array['proposed_by', 'decided_by', 'linked_by']) = (after_row - array['proposed_by', 'decided_by', 'linked_by']) then
    return new;
  end if;
  if not exists (select 1 from public.schools s where s.id = event_tenant) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- A link removed with its account is the account's deletion, recorded there.
  if tg_op = 'DELETE' and tg_table_name = 'academic_record_subjects'
     and not exists (select 1 from auth.users u where u.id = (before_row ->> 'user_id')::uuid) then
    return old;
  end if;

  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('record:propose', 'record:approve', 'record:override')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;

  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, coalesce(row_data ->> 'id', event_tenant), lower(tg_op),
     before_row, after_row, caller, grant_id);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.audit_academic_record_change() from public, anon, authenticated;

drop trigger if exists audit_academic_record_changes on public.academic_record_changes;
create trigger audit_academic_record_changes after insert or update on public.academic_record_changes
  for each row execute function private.audit_academic_record_change();
drop trigger if exists audit_academic_record_subjects on public.academic_record_subjects;
create trigger audit_academic_record_subjects after insert or delete on public.academic_record_subjects
  for each row execute function private.audit_academic_record_change();

-- ── 6. Descriptions ───────────────────────────────────────────────────────

comment on table public.academic_record_entries is
  'The academic-record ledger (D-145). Append-only; written only by private.academic_record_change_guard when a change is approved by someone other than its proposer. Each row names the entry and value it replaced. Not an official transcript.';
comment on table public.academic_record_changes is
  'Proposed changes to a school''s academic record, each with a reason, an effective date and its source. Approved, rejected or withdrawn once, then fixed.';
comment on table public.academic_record_subjects is
  'Which account may read which student''s record, linked by an approver. Removed with the account; the record stays with the school.';
