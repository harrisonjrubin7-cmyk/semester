-- 007: registrar registration command (registrar brief §2.4 and §2.7). Additive to 001-006.
-- Request state, enrollment state and seat count are separate. Seats are allocated only by
-- app.submit_registration, which locks the section row, so concurrent requests cannot oversell.
\set ON_ERROR_STOP on
begin;
set local role semester_owner;

insert into iam.capabilities(key) values ('registration.submit_own'), ('registration.read_own')
  on conflict (key) do nothing;
insert into iam.role_capabilities(role_id, capability_id)
  select r.id, c.id from iam.roles r cross join iam.capabilities c
  where r.key = 'student' and c.key in ('registration.submit_own', 'registration.read_own')
  on conflict do nothing;

create table app.course_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workspace_id uuid not null,
  code text not null,
  capacity int not null check (capacity >= 0),
  enrolled_count int not null default 0 check (enrolled_count >= 0),
  state text not null default 'open' check (state in ('open', 'closed')),
  unique (tenant_id, id),
  check (enrolled_count <= capacity),
  foreign key (tenant_id, workspace_id) references iam.workspaces(tenant_id, id)
);

create table app.registration_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_user_id uuid not null,
  section_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  state text not null check (state in ('committed', 'rejected')),
  result text not null check (result in ('enrolled', 'already_enrolled', 'capacity_unavailable', 'section_closed')),
  created_at timestamptz not null default now(),
  unique (tenant_id, student_user_id, idempotency_key),
  foreign key (tenant_id, section_id) references app.course_sections(tenant_id, id),
  foreign key (tenant_id, student_user_id) references iam.memberships(tenant_id, user_id)
);

create table app.enrollment_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  student_user_id uuid not null,
  section_id uuid not null,
  state text not null default 'enrolled' check (state in ('enrolled', 'dropped', 'withdrawn', 'completed')),
  request_id uuid not null references app.registration_requests(id),
  created_at timestamptz not null default now(),
  foreign key (tenant_id, section_id) references app.course_sections(tenant_id, id),
  foreign key (tenant_id, student_user_id) references iam.memberships(tenant_id, user_id)
);
-- One live enrollment per student per section, whatever happens above.
create unique index enrollment_one_live on app.enrollment_records(tenant_id, section_id, student_user_id) where state = 'enrolled';

alter table app.course_sections enable row level security;      alter table app.course_sections force row level security;
alter table app.registration_requests enable row level security; alter table app.registration_requests force row level security;
alter table app.enrollment_records enable row level security;    alter table app.enrollment_records force row level security;

-- Runtime may only read. Every write goes through the command below.
grant select on app.course_sections, app.registration_requests, app.enrollment_records to semester_api;
create policy sections_member on app.course_sections for select to semester_api
  using (tenant_id = iam.current_tenant_id() and iam.is_active_member(tenant_id));
create policy requests_own on app.registration_requests for select to semester_api
  using (tenant_id = iam.current_tenant_id() and student_user_id = iam.current_user_id() and iam.is_active_member(tenant_id));
create policy enrollments_own on app.enrollment_records for select to semester_api
  using (tenant_id = iam.current_tenant_id() and student_user_id = iam.current_user_id()
         and iam.has_capability(tenant_id, null, 'registration.read_own'));

-- The one reviewed SECURITY DEFINER path (audit §2.6): narrow purpose, fixed search_path, qualified
-- names, explicit authorization inside, no dynamic SQL, execute granted only to semester_api.
create function app.submit_registration(p_section uuid, p_key text)
returns table (request_id uuid, state text, result text)
language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_user uuid := iam.current_user_id();
  v_tenant uuid := iam.current_tenant_id();
  v_ws uuid;
  v_req app.registration_requests%rowtype;
  v_sec app.course_sections%rowtype;
  v_result text;
begin
  if v_user is null or v_tenant is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  -- Authorization is evaluated as the caller's context, not as the function owner.
  select s.workspace_id into v_ws from app.course_sections s where s.id = p_section and s.tenant_id = v_tenant;
  if v_ws is null then
    raise exception 'ACCESS_DENIED' using errcode = '42501';  -- other tenant's or unknown section: same answer
  end if;
  if not iam.has_capability(v_tenant, v_ws, 'registration.submit_own') then
    raise exception 'ACCESS_DENIED' using errcode = '42501';
  end if;

  -- Retry with the same key returns the original outcome; no second operation.
  select * into v_req from app.registration_requests r
    where r.tenant_id = v_tenant and r.student_user_id = v_user and r.idempotency_key = p_key;
  if found then
    if v_req.section_id <> p_section then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return query select v_req.id, v_req.state, v_req.result; return;
  end if;

  -- Serialize on the section row. Everything below sees a stable seat count.
  select * into v_sec from app.course_sections s where s.id = p_section for update;

  -- Two concurrent first-time calls with the same key: the loser waits on the lock above,
  -- then finds the winner's request here.
  select * into v_req from app.registration_requests r
    where r.tenant_id = v_tenant and r.student_user_id = v_user and r.idempotency_key = p_key;
  if found then return query select v_req.id, v_req.state, v_req.result; return; end if;

  if exists (select 1 from app.enrollment_records e where e.tenant_id = v_tenant and e.section_id = p_section
             and e.student_user_id = v_user and e.state = 'enrolled') then
    v_result := 'already_enrolled';
  elsif v_sec.state <> 'open' then
    v_result := 'section_closed';
  elsif v_sec.enrolled_count >= v_sec.capacity then
    v_result := 'capacity_unavailable';
  else
    v_result := 'enrolled';
  end if;

  insert into app.registration_requests (tenant_id, student_user_id, section_id, idempotency_key, state, result)
    values (v_tenant, v_user, p_section, p_key, case when v_result = 'enrolled' then 'committed' else 'rejected' end, v_result)
    returning * into v_req;
  if v_result = 'enrolled' then
    update app.course_sections set enrolled_count = enrolled_count + 1 where id = p_section;
    insert into app.enrollment_records (tenant_id, student_user_id, section_id, request_id)
      values (v_tenant, v_user, p_section, v_req.id);
  end if;
  return query select v_req.id, v_req.state, v_req.result;
end;
$$;
revoke all on function app.submit_registration(uuid, text) from public;
grant execute on function app.submit_registration(uuid, text) to semester_api;
commit;

-- The command runs as semester_cmd: no login, no BYPASSRLS, not reachable by the runtime login.
-- RLS still applies to it; its policies are limited to the caller's own tenant and user.
begin;
create role semester_cmd nologin nobypassrls;
grant usage on schema iam, app to semester_cmd;
grant select on iam.users, iam.tenants, iam.memberships, iam.roles, iam.capabilities,
  iam.role_capabilities, iam.role_assignments to semester_cmd;
grant execute on function iam.current_user_id(), iam.current_tenant_id(), iam.is_active_member(uuid),
  iam.has_capability(uuid, uuid, text) to semester_cmd;
grant select on app.course_sections, app.registration_requests, app.enrollment_records to semester_cmd;
grant update (enrolled_count) on app.course_sections to semester_cmd;
grant insert on app.registration_requests, app.enrollment_records to semester_cmd;

create policy cmd_users_self on iam.users for select to semester_cmd using (id = iam.current_user_id());
create policy cmd_tenants_current on iam.tenants for select to semester_cmd using (id = iam.current_tenant_id());
create policy cmd_memberships_self on iam.memberships for select to semester_cmd
  using (user_id = iam.current_user_id() and tenant_id = iam.current_tenant_id());
create policy cmd_assignments_self on iam.role_assignments for select to semester_cmd
  using (tenant_id = iam.current_tenant_id() and exists (select 1 from iam.memberships m
    where m.id = membership_id and m.tenant_id = role_assignments.tenant_id and m.user_id = iam.current_user_id()));
create policy cmd_sections on app.course_sections for select to semester_cmd using (tenant_id = iam.current_tenant_id());
create policy cmd_sections_count on app.course_sections for update to semester_cmd
  using (tenant_id = iam.current_tenant_id()) with check (tenant_id = iam.current_tenant_id());
create policy cmd_requests on app.registration_requests for select to semester_cmd
  using (tenant_id = iam.current_tenant_id() and student_user_id = iam.current_user_id());
create policy cmd_requests_insert on app.registration_requests for insert to semester_cmd
  with check (tenant_id = iam.current_tenant_id() and student_user_id = iam.current_user_id());
create policy cmd_enrollments on app.enrollment_records for select to semester_cmd
  using (tenant_id = iam.current_tenant_id() and student_user_id = iam.current_user_id());
create policy cmd_enrollments_insert on app.enrollment_records for insert to semester_cmd
  with check (tenant_id = iam.current_tenant_id() and student_user_id = iam.current_user_id());

alter function app.submit_registration(uuid, text) owner to semester_cmd;
commit;
