-- Payment plans on student accounts (D-146): a student asks their school to
-- spread what they owe today over monthly payments, and the school agrees.
--
--   1. A plan is asked for by the student it concerns — through the link the
--      registrar made (`academic_record_subjects`) — or by staff holding
--      `finance:request`. The database, not the asker, reads the balance
--      owed today from the ledger and writes the schedule, by the school's
--      rules (`student_account_settings`): at least the minimum share first,
--      then equal monthly payments, the last one absorbing the rounding so
--      the plan sums to the balance to the cent. `lib/finance/accounts.ts`
--      `paymentPlan` is the same arithmetic, and the check suite holds the
--      two to the same schedule.
--   2. Someone holding `finance:approve` who did not ask decides it. A plan
--      is approved only while the balance is still the one it was asked for
--      and its first payment is not yet past; otherwise it is asked for again.
--   3. One plan at a time per student: asked for or agreed. An approver may
--      cancel an agreed plan, with a reason; the asker may withdraw one not
--      yet decided. Nothing else about a plan changes, and its schedule never
--      does.
--   4. No money moves. A plan is an agreement about when the student pays on
--      the school's own page; payments reach the ledger as before, and whether
--      a plan is kept is read from the ledger (`planStanding`). A plan kept
--      lifts the financial hold; one behind does not.
--
-- The two functions that write — the guard that stamps a plan, and the one
-- that writes its schedule, which no client can — are security definer, in
-- `private` and revoked from every client role. The grants allowlist and the
-- definer register are unchanged.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. The school's rules ─────────────────────────────────────────────────

alter table public.student_account_settings
  add column if not exists plans_offered              boolean  not null default true,
  add column if not exists plan_min_down_percent      smallint not null default 10 check (plan_min_down_percent >= 1 and plan_min_down_percent <= 100),
  add column if not exists plan_max_installments      smallint not null default 6 check (plan_max_installments >= 2 and plan_max_installments <= 24),
  add column if not exists plan_min_installment_cents bigint   not null default 5000 check (plan_min_installment_cents >= 1);

-- ── 2. The tables ─────────────────────────────────────────────────────────

create table if not exists public.student_payment_plans (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  student_ref     text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  installments    smallint    not null check (installments >= 2 and installments <= 24),
  first_due       date        not null,
  -- What the ledger said was owed when the plan was asked for. Written by the guard.
  balance_cents   bigint      not null default 0,
  status          text        not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'withdrawn', 'cancelled')),
  requested_by    uuid        default auth.uid() references auth.users(id) on delete set null,
  requested_at    timestamptz not null default clock_timestamp(),
  decided_by      uuid        references auth.users(id) on delete set null,
  decided_at      timestamptz,
  decision_note   text        not null default '' check (length(decision_note) <= 2000),
  cancelled_by    uuid        references auth.users(id) on delete set null,
  cancelled_at    timestamptz,
  cancel_note     text        not null default '' check (length(cancel_note) <= 2000),
  constraint student_payment_plan_no_pan check (
    decision_note !~ '[0-9]([ -]?[0-9]){12,18}' and cancel_note !~ '[0-9]([ -]?[0-9]){12,18}'),
  constraint student_payment_plan_decided check ((status in ('proposed', 'withdrawn')) = (decided_at is null)),
  constraint student_payment_plan_cancelled check ((status = 'cancelled') = (cancelled_at is not null)),
  constraint student_payment_plan_cancel_reason check (status <> 'cancelled' or length(trim(cancel_note)) >= 3)
);
create index if not exists student_payment_plans_by_student on public.student_payment_plans (tenant_id, student_ref, requested_at desc);
create unique index if not exists student_payment_plans_one_live on public.student_payment_plans (tenant_id, student_ref)
  where status in ('proposed', 'approved');
create index if not exists student_payment_plans_by_status on public.student_payment_plans (tenant_id, status);
create index if not exists student_payment_plans_by_requester on public.student_payment_plans (requested_by);
create index if not exists student_payment_plans_by_decider on public.student_payment_plans (decided_by);
create index if not exists student_payment_plans_by_canceller on public.student_payment_plans (cancelled_by);

create table if not exists public.student_payment_plan_installments (
  plan_id  uuid   not null references public.student_payment_plans(id) on delete cascade,
  seq      smallint not null check (seq >= 1),
  due_on   date   not null,
  cents    bigint not null check (cents > 0),
  primary key (plan_id, seq)
);

-- ── 3. The rules ──────────────────────────────────────────────────────────

-- What a student owes today by the ledger. Definer rights: the guard reads it
-- for whoever asks, and it answers only the one sum.
create or replace function private.student_account_owed_today(school text, student text)
returns bigint language sql stable security definer set search_path = '' as $$
  select coalesce(sum(e.amount_cents), 0)::bigint
    from public.student_account_entries e
   where e.tenant_id = school and e.student_ref = student and e.effective_on <= current_date
$$;
revoke all on function private.student_account_owed_today(text, text) from public, anon, authenticated;

create or replace function private.student_payment_plan_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  offered boolean;
  down_pct smallint;
  max_n smallint;
  min_each bigint;
  owed bigint;
  down bigint;
  per bigint;
begin
  if tg_op = 'INSERT' then
    if caller is not null
       and not private.has_capability('finance:request', 'school', new.tenant_id)
       and not exists (select 1 from public.academic_record_subjects s
                        where s.tenant_id = new.tenant_id and s.student_ref = new.student_ref and s.user_id = caller) then
      raise exception 'Only the student, or Student Accounts, asks for a plan on this account.' using errcode = '42501';
    end if;
    select coalesce(st.plans_offered, true), coalesce(st.plan_min_down_percent, 10::smallint),
           coalesce(st.plan_max_installments, 6::smallint), coalesce(st.plan_min_installment_cents, 5000)
      into offered, down_pct, max_n, min_each
      from (select 1) one left join public.student_account_settings st on st.tenant_id = new.tenant_id;
    if not offered then
      raise exception 'This school does not offer payment plans here; ask Student Accounts.' using errcode = '23514';
    end if;
    if new.installments < 2 or new.installments > max_n then
      raise exception 'A plan here has between 2 and % payments.', max_n using errcode = '23514';
    end if;
    if new.first_due < current_date or new.first_due > current_date + 30 then
      raise exception 'The first payment is due between today and 30 days from now.' using errcode = '23514';
    end if;
    owed := private.student_account_owed_today(new.tenant_id, new.student_ref);
    if owed <= 0 then
      raise exception 'There is nothing owed to spread over a plan.' using errcode = '23514';
    end if;
    down := (owed * down_pct + 99) / 100;
    per := (owed - down) / (new.installments - 1);
    -- Never a payment of nothing: a first payment rounds up from at least 1%,
    -- and the rules keep the monthly minimum at a cent or more.
    if per < greatest(min_each, 1) then
      raise exception 'Each monthly payment would be under the school''s minimum; choose fewer payments.' using errcode = '23514';
    end if;
    new.balance_cents := owed;
    new.status := 'proposed';
    new.requested_by := caller;
    new.requested_at := clock_timestamp();
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := '';
    new.cancelled_by := null;
    new.cancelled_at := null;
    new.cancel_note := '';
    return new;
  end if;

  -- Account deletion clearing a person reference is not a change to the plan.
  if (to_jsonb(new) - array['requested_by', 'decided_by', 'cancelled_by']) = (to_jsonb(old) - array['requested_by', 'decided_by', 'cancelled_by'])
     and (new.requested_by is null or new.requested_by = old.requested_by)
     and (new.decided_by is null or new.decided_by = old.decided_by)
     and (new.cancelled_by is null or new.cancelled_by = old.cancelled_by) then
    return new;
  end if;
  if (to_jsonb(new) - array['status', 'decided_by', 'decided_at', 'decision_note', 'cancelled_by', 'cancelled_at', 'cancel_note'])
     <> (to_jsonb(old) - array['status', 'decided_by', 'decided_at', 'decision_note', 'cancelled_by', 'cancelled_at', 'cancel_note']) then
    raise exception 'A plan is not edited; withdraw it or ask for another.' using errcode = '42501';
  end if;

  if old.status = 'proposed' and new.status = 'withdrawn' then
    if old.requested_by is distinct from caller then
      raise exception 'Only the person who asked for a plan withdraws it.' using errcode = '42501';
    end if;
    new.decided_by := null;
    new.decided_at := null;
    new.decision_note := old.decision_note;
  elsif old.status = 'proposed' and new.status in ('approved', 'rejected') then
    if not private.has_capability('finance:approve', 'school', old.tenant_id) then
      raise exception 'Your account cannot decide payment plans at this school.' using errcode = '42501';
    end if;
    if old.requested_by = caller then
      raise exception 'The person who asked for a plan does not decide it.' using errcode = '42501';
    end if;
    if new.status = 'approved' then
      if private.student_account_owed_today(old.tenant_id, old.student_ref) <> old.balance_cents then
        raise exception 'The balance has changed since this plan was asked for; it is asked for again.' using errcode = '23514';
      end if;
      if old.first_due < current_date then
        raise exception 'This plan''s first payment date has passed; it is asked for again.' using errcode = '23514';
      end if;
    end if;
    new.decided_by := caller;
    new.decided_at := clock_timestamp();
  elsif old.status = 'approved' and new.status = 'cancelled' then
    if not private.has_capability('finance:approve', 'school', old.tenant_id) then
      raise exception 'Your account cannot cancel payment plans at this school.' using errcode = '42501';
    end if;
    new.decided_by := old.decided_by;
    new.decided_at := old.decided_at;
    new.decision_note := old.decision_note;
    new.cancelled_by := caller;
    new.cancelled_at := clock_timestamp();
  else
    raise exception 'A plan asked for is approved, rejected or withdrawn; an agreed one may be cancelled. Nothing else changes.' using errcode = '42501';
  end if;
  if new.status <> 'cancelled' then
    new.cancelled_by := null;
    new.cancelled_at := null;
    new.cancel_note := '';
  end if;
  return new;
end $$;
revoke all on function private.student_payment_plan_guard() from public, anon, authenticated;
drop trigger if exists student_payment_plan_guard on public.student_payment_plans;
create trigger student_payment_plan_guard before insert or update on public.student_payment_plans
  for each row execute function private.student_payment_plan_guard();

-- The schedule, written once when the plan is asked for, from the balance the
-- guard read. Month steps are from the first due date, so the 31st falls on
-- the last day of a shorter month and returns to the 31st after it.
create or replace function private.student_payment_plan_schedule()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  down_pct smallint;
  down bigint;
  rest bigint;
  per bigint;
  i int;
begin
  select coalesce(st.plan_min_down_percent, 10::smallint) into down_pct
    from (select 1) one left join public.student_account_settings st on st.tenant_id = new.tenant_id;
  down := (new.balance_cents * down_pct + 99) / 100;
  rest := new.balance_cents - down;
  per := rest / (new.installments - 1);
  insert into public.student_payment_plan_installments (plan_id, seq, due_on, cents) values (new.id, 1, new.first_due, down);
  for i in 1 .. new.installments - 1 loop
    insert into public.student_payment_plan_installments (plan_id, seq, due_on, cents)
    values (new.id, i + 1, (new.first_due + make_interval(months => i))::date,
            case when i = new.installments - 1 then rest - per * (new.installments - 2) else per end);
  end loop;
  return new;
end $$;
revoke all on function private.student_payment_plan_schedule() from public, anon, authenticated;
drop trigger if exists student_payment_plan_schedule on public.student_payment_plans;
create trigger student_payment_plan_schedule after insert on public.student_payment_plans
  for each row execute function private.student_payment_plan_schedule();

-- A schedule never changes; it goes only with its plan, and a plan only with
-- its school.
create or replace function private.student_payment_plan_installment_fixed()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.student_payment_plans p where p.id = old.plan_id) then
    return old;
  end if;
  raise exception 'A plan''s schedule does not change; the plan is withdrawn or cancelled and another asked for.' using errcode = '42501';
end $$;
revoke all on function private.student_payment_plan_installment_fixed() from public, anon, authenticated;
drop trigger if exists student_payment_plan_installments_append_only on public.student_payment_plan_installments;
create trigger student_payment_plan_installments_append_only before update or delete on public.student_payment_plan_installments
  for each row execute function private.student_payment_plan_installment_fixed();

-- ── 4. Row-level security ─────────────────────────────────────────────────

alter table public.student_payment_plans             enable row level security;
alter table public.student_payment_plan_installments enable row level security;

revoke all on table public.student_payment_plans, public.student_payment_plan_installments from public, anon, authenticated;
grant select, insert, update on table public.student_payment_plans to authenticated;
grant select on table public.student_payment_plan_installments to authenticated;

drop policy if exists "finance staff and the student read plans" on public.student_payment_plans;
create policy "finance staff and the student read plans" on public.student_payment_plans
  for select to authenticated
  using (private.has_capability('finance:read', 'school', tenant_id)
         or private.has_capability('finance:approve', 'school', tenant_id)
         or private.has_capability('finance:close', 'school', tenant_id)
         or private.has_capability('finance:request', 'school', tenant_id)
         or exists (select 1 from public.academic_record_subjects s
                     where s.tenant_id = student_payment_plans.tenant_id
                       and s.student_ref = student_payment_plans.student_ref
                       and s.user_id = (select auth.uid())));
drop policy if exists "the student or a requester asks for a plan" on public.student_payment_plans;
create policy "the student or a requester asks for a plan" on public.student_payment_plans
  for insert to authenticated
  with check (private.has_capability('finance:request', 'school', tenant_id)
              or exists (select 1 from public.academic_record_subjects s
                          where s.tenant_id = student_payment_plans.tenant_id
                            and s.student_ref = student_payment_plans.student_ref
                            and s.user_id = (select auth.uid())));
drop policy if exists "approvers decide plans and askers withdraw them" on public.student_payment_plans;
create policy "approvers decide plans and askers withdraw them" on public.student_payment_plans
  for update to authenticated
  using (private.has_capability('finance:approve', 'school', tenant_id) or requested_by = (select auth.uid()))
  with check (private.has_capability('finance:approve', 'school', tenant_id) or requested_by = (select auth.uid()));

drop policy if exists "whoever reads a plan reads its schedule" on public.student_payment_plan_installments;
create policy "whoever reads a plan reads its schedule" on public.student_payment_plan_installments
  for select to authenticated
  using (exists (select 1 from public.student_payment_plans p where p.id = student_payment_plan_installments.plan_id));

-- ── 5. Audit ──────────────────────────────────────────────────────────────

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
    'academic_record_changes', 'academic_record_subjects',
    'student_account_requests', 'student_account_settings', 'student_account_reconciliations', 'student_account_closes',
    'student_payment_plans'
  ));

drop trigger if exists audit_student_payment_plans on public.student_payment_plans;
create trigger audit_student_payment_plans after insert or update on public.student_payment_plans
  for each row execute function private.audit_student_account_change();

-- ── 6. Descriptions ───────────────────────────────────────────────────────

comment on table public.student_payment_plans is
  'Payment plans on student accounts (D-146). Asked for by the student or Student Accounts, the balance read from the ledger by the database, decided by someone else, one live at a time. An agreement about when the student pays on the school''s own page; no money moves here.';
comment on table public.student_payment_plan_installments is
  'A plan''s schedule, written by the database when the plan is asked for, summing to its balance to the cent. Never changed.';
