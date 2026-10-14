-- 065_readiness_wedge.sql — PROPOSED. Pilot wedge registration_readiness_v1 (from the "continue" PDF, 13 Oct).
-- Run after 060_bespoke_core.sql + student_tasks_policies.sql + registration_policies.sql. Not run.
-- Changes vs. 060: readiness becomes a 7-state machine enforced by trigger; checks carry per-check source + authority;
-- a separate readiness_receipts table states plainly that readiness is NOT enrollment (registration_receipts stays for
-- request outcomes); evaluation is one idempotent, fail-closed function. RLS uses auth.uid() helpers, not current_setting().

create type semester_core.readiness_state as enum ('unknown','ready','blocked','needs_review','stale','referred','resolved');

drop table if exists semester_core.readiness_checks, semester_core.readiness_cases cascade;

create table semester_core.readiness_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  student_id uuid not null,
  term_code text not null,
  goal jsonb not null default '{}'::jsonb,
  goal_version int not null default 1,
  state semester_core.readiness_state not null default 'unknown',
  reason_code text,
  source_freshness_state semester_core.freshness_state not null default 'unknown',
  evaluation_version int not null default 1,
  evaluated_at timestamptz, resolved_at timestamptz,
  assigned_office text,
  idempotency_key text not null,
  created_by_account_id uuid references semester_core.accounts(id),
  updated_by_account_id uuid references semester_core.accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id) on delete cascade,
  unique (tenant_id, id),
  unique (tenant_id, idempotency_key),
  unique (tenant_id, student_id, term_code, evaluation_version),
  check (state <> 'ready' or source_freshness_state = 'current'),          -- stale data can never say "ready"
  check ((state = 'resolved') = (resolved_at is not null)),
  check (state <> 'referred' or assigned_office is not null)
);

create table semester_core.readiness_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  case_id uuid not null,
  check_key text not null check (check_key in ('hold','time_ticket','prerequisite','plan_approval','balance')),
  check_label text not null,
  state semester_core.readiness_state not null,
  source_type semester_core.source_type not null,
  record_authority semester_core.record_authority not null default 'institution',
  source_ref text, source_observed_at timestamptz,
  source_freshness_state semester_core.freshness_state not null default 'unknown',
  details jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  foreign key (tenant_id, case_id) references semester_core.readiness_cases (tenant_id, id) on delete cascade,
  unique (tenant_id, id), unique (tenant_id, case_id, check_key)
);

create table semester_core.readiness_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  student_id uuid not null,
  case_id uuid,
  receipt_type text not null check (receipt_type in ('readiness_evaluation','refresh_requested','referral_created')),
  status text not null check (status in ('accepted','completed','failed','needs_review')),
  statement text not null check (statement ilike '%not enrollment%' or receipt_type <> 'readiness_evaluation'),
  consequence_summary text,
  correlation_id uuid not null,
  issued_at timestamptz not null default now(), expires_at timestamptz,
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id) on delete cascade,
  foreign key (tenant_id, case_id) references semester_core.readiness_cases (tenant_id, id) on delete set null,
  unique (tenant_id, id)
);

-- legal transitions only (from the PDF's state machine); anything else raises
create table semester_core.readiness_transitions (
  from_state semester_core.readiness_state not null,
  to_state semester_core.readiness_state not null,
  primary key (from_state, to_state)
);
insert into semester_core.readiness_transitions values
 ('unknown','ready'),('unknown','blocked'),('unknown','needs_review'),('unknown','stale'),
 ('stale','unknown'),('stale','ready'),('stale','blocked'),('stale','needs_review'),
 ('needs_review','referred'),('needs_review','ready'),('needs_review','blocked'),
 ('referred','resolved'),('referred','blocked'),('referred','ready'),
 ('blocked','unknown'),('blocked','needs_review'),
 ('ready','unknown'),
 ('resolved','unknown');
-- any state may move to stale when a required source exceeds its threshold
insert into semester_core.readiness_transitions select s, 'stale' from unnest(enum_range(null::semester_core.readiness_state)) s on conflict do nothing;

create or replace function semester_core.readiness_guard() returns trigger language plpgsql as $$
begin
  if new.state is distinct from old.state and not exists (
    select 1 from semester_core.readiness_transitions t where t.from_state = old.state and t.to_state = new.state) then
    raise exception 'illegal readiness transition % -> %', old.state, new.state using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger readiness_guard before update on semester_core.readiness_cases for each row execute function semester_core.readiness_guard();

-- readiness.evaluate — the only way cases are created. Service role only (called by the command edge function after
-- the 14-step chain). Idempotency key per PDF: {tenant}:{student}:{term}:{goal_version}. Fails closed.
create or replace function semester_core.readiness_evaluate(
  p_tenant uuid, p_actor uuid, p_student uuid, p_term text, p_goal jsonb, p_goal_version int, p_correlation uuid,
  p_freshness_budget interval default interval '4 hours'  -- operational class, source-freshness-policy.yaml)
returns semester_core.readiness_receipts language plpgsql security definer set search_path = semester_core, pg_temp as $$
declare k text := p_tenant||':'||p_student||':'||p_term||':'||p_goal_version;
        c semester_core.readiness_cases; r semester_core.readiness_receipts;
        hold_ct int; tt semester_core.time_tickets; fresh semester_core.freshness_state; st semester_core.readiness_state; why text;
begin
  select * into c from semester_core.readiness_cases where tenant_id = p_tenant and idempotency_key = k;
  if found then   -- duplicate command: return the existing receipt
    select * into r from semester_core.readiness_receipts where tenant_id = p_tenant and case_id = c.id and receipt_type = 'readiness_evaluation' order by issued_at limit 1;
    return r;
  end if;
  if not exists (select 1 from semester_core.students where tenant_id = p_tenant and id = p_student) then
    raise exception 'no authorized student context' using errcode = '42501';
  end if;

  select count(*) into hold_ct from semester_core.holds where tenant_id = p_tenant and student_id = p_student and status = 'active' and 'registration' = any(blocks);
  select * into tt from semester_core.time_tickets where tenant_id = p_tenant and student_id = p_student and term_code = p_term;
  -- freshness = oldest observation among the inputs we relied on; unknown if any input missing
  select case
    when tt.id is null then 'unknown'
    when least(tt.observed_at, coalesce((select min(observed_at) from semester_core.holds where tenant_id = p_tenant and student_id = p_student), tt.observed_at)) < now() - p_freshness_budget then 'stale'
    else 'current' end::semester_core.freshness_state into fresh;

  if fresh = 'stale' then st := 'stale'; why := 'source_exceeds_freshness_threshold';
  elsif tt.id is null then st := 'needs_review'; why := 'missing_time_ticket';
  elsif hold_ct > 0 then st := 'blocked'; why := 'active_hold';
  else st := 'ready'; why := null; end if;

  insert into semester_core.readiness_cases (tenant_id, student_id, term_code, goal, goal_version, state, reason_code, source_freshness_state, evaluated_at, idempotency_key, created_by_account_id, assigned_office)
    values (p_tenant, p_student, p_term, coalesce(p_goal,'{}'), p_goal_version, st, why, fresh, now(), k, p_actor, case when st = 'blocked' then (select owning_office from semester_core.holds where tenant_id = p_tenant and student_id = p_student and status = 'active' limit 1) end)
    returning * into c;
  insert into semester_core.readiness_checks (tenant_id, case_id, check_key, check_label, state, source_type, source_ref, source_observed_at, source_freshness_state)
    values (p_tenant, c.id, 'hold', 'Registration holds', case when hold_ct > 0 then 'blocked' else 'ready' end, 'institution_verified', 'SIS:holds', (select max(observed_at) from semester_core.holds where tenant_id = p_tenant and student_id = p_student), fresh),
           (p_tenant, c.id, 'time_ticket', 'Registration time ticket', case when tt.id is null then 'needs_review' else 'ready' end, 'institution_verified', tt.source_ref, tt.observed_at, fresh);
  insert into semester_core.readiness_receipts (tenant_id, student_id, case_id, receipt_type, status, statement, consequence_summary, correlation_id)
    values (p_tenant, p_student, c.id, 'readiness_evaluation', case when st in ('ready','blocked') then 'completed' else 'needs_review' end,
      'Readiness check for '||p_term||': '||st::text||'. This is not enrollment — register in the student information system when your window opens.',
      why, p_correlation) returning * into r;
  insert into semester_core.audit_events (tenant_id, actor_account_id, event_type, entity_type, entity_id, correlation_id)
    values (p_tenant, p_actor, 'readiness.evaluated', 'readiness_case', c.id::text, p_correlation);
  insert into public.live_outbox (institution_id, aggregate, event, payload)
    values (p_tenant, 'readiness', 'readiness.evaluated', jsonb_build_object('case_id', c.id, 'state', st, 'correlation_id', p_correlation));
  return r;
end $$;
revoke execute on function semester_core.readiness_evaluate(uuid,uuid,uuid,text,jsonb,int,uuid,interval) from public, anon, authenticated;
grant execute on function semester_core.readiness_evaluate(uuid,uuid,uuid,text,jsonb,int,uuid,interval) to service_role;

-- RLS: students own, registrar tenant-wide via grant, advisor caseload; ops sees no student detail by default
do $$ declare t text; begin foreach t in array array['readiness_cases','readiness_checks','readiness_receipts','readiness_transitions'] loop
  execute format('alter table semester_core.%I enable row level security', t); execute format('alter table semester_core.%I force row level security', t); end loop; end $$;
grant select on semester_core.readiness_cases, semester_core.readiness_checks, semester_core.readiness_receipts, semester_core.readiness_transitions to authenticated;
create policy rt_read on semester_core.readiness_transitions for select to authenticated using (true);
create policy rcase_student on semester_core.readiness_cases for select to authenticated using (student_id = semester_core.my_student_id(tenant_id));
create policy rcase_registrar on semester_core.readiness_cases for select to authenticated using (semester_core.has_capability(tenant_id, 'registrar.readiness.queue.read'));
create policy rcase_advisor on semester_core.readiness_cases for select to authenticated using (semester_core.has_capability(tenant_id, 'advisor.caseload.read', student_id));
create policy rcheck_via_case on semester_core.readiness_checks for select to authenticated
  using (exists (select 1 from semester_core.readiness_cases c where c.tenant_id = readiness_checks.tenant_id and c.id = readiness_checks.case_id));
create policy rrcpt_student on semester_core.readiness_receipts for select to authenticated using (student_id = semester_core.my_student_id(tenant_id));
create policy rrcpt_registrar on semester_core.readiness_receipts for select to authenticated using (semester_core.has_capability(tenant_id, 'registrar.readiness.queue.read'));

create index readiness_cases_student_term_idx on semester_core.readiness_cases (tenant_id, student_id, term_code, updated_at desc);
create index readiness_cases_queue_idx on semester_core.readiness_cases (tenant_id, state, updated_at desc) where state in ('blocked','needs_review','stale','referred');
create index readiness_checks_case_state_idx on semester_core.readiness_checks (tenant_id, case_id, state);
create index readiness_receipts_student_idx on semester_core.readiness_receipts (tenant_id, student_id, issued_at desc);
