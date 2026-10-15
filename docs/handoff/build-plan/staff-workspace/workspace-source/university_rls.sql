-- Reference migration: fresh Supabase project, privileged migration owner.
-- Not an upgrade migration; not executed or production certified.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, supabase_auth_admin;

create table private.tenants(id uuid primary key default gen_random_uuid(), name text not null);
create table private.memberships(
 tenant_id uuid references private.tenants(id), user_id uuid references auth.users(id),
 active boolean not null default true, primary key(tenant_id,user_id));
create table private.roles(key text primary key);
insert into private.roles values ('Faculty'),('TA'),('Advisor'),('Registrar'),('Finance'),('Student Affairs');
create table private.role_capabilities(
 role_key text references private.roles(key), capability text,
 primary key(role_key,capability));
insert into private.role_capabilities values
 ('Faculty','academic.read'),('Faculty','academic.draft'),('Faculty','academic.release'),('Faculty','correction.request'),
 ('TA','academic.read'),('TA','academic.draft'),
 ('Advisor','academic.read'),('Advisor','advising.read'),
 ('Registrar','academic.read'),('Registrar','correction.approve'),('Registrar','correction.publish'),('Registrar','hold.release'),
 ('Finance','finance.read'),('Finance','adjustment.submit'),
 ('Student Affairs','support.read'),('Student Affairs','referral.send');
create table private.role_grants(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null,user_id uuid not null,
 role_key text not null references private.roles(key),valid_from timestamptz not null default now(),
 expires_at timestamptz,revoked_at timestamptz,
 foreign key(tenant_id,user_id) references private.memberships(tenant_id,user_id),
 unique(id,tenant_id),check(expires_at is null or expires_at>valid_from));
create index grants_user_idx on private.role_grants(user_id,tenant_id);

create table private.students(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references private.tenants(id),
 unique(id,tenant_id));
create table private.sections(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references private.tenants(id),
 unique(id,tenant_id));
create table private.enrollments(
 tenant_id uuid not null,section_id uuid not null,student_id uuid not null,
 primary key(tenant_id,section_id,student_id),
 foreign key(section_id,tenant_id) references private.sections(id,tenant_id),
 foreign key(student_id,tenant_id) references private.students(id,tenant_id));
create table private.section_scopes(
 grant_id uuid not null,tenant_id uuid not null,section_id uuid not null,
 primary key(grant_id,tenant_id,section_id),
 foreign key(grant_id,tenant_id) references private.role_grants(id,tenant_id),
 foreign key(section_id,tenant_id) references private.sections(id,tenant_id));
create table private.student_scopes(
 grant_id uuid not null,tenant_id uuid not null,student_id uuid not null,
 primary key(grant_id,tenant_id,student_id),
 foreign key(grant_id,tenant_id) references private.role_grants(id,tenant_id),
 foreign key(student_id,tenant_id) references private.students(id,tenant_id));
create table private.session_contexts(
 session_id uuid primary key,user_id uuid not null references auth.users(id),
 active_grant_id uuid not null references private.role_grants(id),
 updated_at timestamptz not null default now());

-- Domain records separate draft and published data, rather than masking JSX.
create table public.grade_drafts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,
 section_id uuid not null,student_id uuid not null,value text not null,version integer not null default 1,
 foreign key(tenant_id,section_id,student_id) references private.enrollments(tenant_id,section_id,student_id));
create table public.published_grades(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,
 section_id uuid not null,student_id uuid not null,value text not null,
 version integer not null default 1,published_at timestamptz not null default now(),
 foreign key(tenant_id,section_id,student_id) references private.enrollments(tenant_id,section_id,student_id),
 unique(id,tenant_id));
create table public.grade_corrections(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,grade_id uuid not null,
 student_id uuid not null,section_id uuid not null,proposed_value text not null,
 reason text not null,state text not null default 'requested' check(state in('requested','approved','published','denied')),
 requester_id uuid not null references auth.users(id),approver_id uuid references auth.users(id),
 version integer not null default 1,
 foreign key(grade_id,tenant_id) references public.published_grades(id,tenant_id),
 foreign key(tenant_id,section_id,student_id) references private.enrollments(tenant_id,section_id,student_id));
-- Commands must verify correction student/section matches its referenced grade.
create table public.advising_notes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,student_id uuid not null,body text not null,
 foreign key(student_id,tenant_id) references private.students(id,tenant_id));
create table public.finance_accounts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,student_id uuid not null,
 balance numeric(14,2) not null,currency text not null,
 foreign key(student_id,tenant_id) references private.students(id,tenant_id));
create table public.support_cases(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,student_id uuid not null,
 summary text not null,state text not null default 'intake',unique(id,tenant_id),
 foreign key(student_id,tenant_id) references private.students(id,tenant_id));
create table private.case_scopes(
 grant_id uuid not null,tenant_id uuid not null,case_id uuid not null,
 restricted_notes boolean not null default false,primary key(grant_id,tenant_id,case_id),
 foreign key(grant_id,tenant_id) references private.role_grants(id,tenant_id),
 foreign key(case_id,tenant_id) references public.support_cases(id,tenant_id));
create table public.restricted_case_notes(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,case_id uuid not null,body text not null,
 foreign key(case_id,tenant_id) references public.support_cases(id,tenant_id));

create table private.access_requests(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,requester_id uuid not null,
 requested_role text not null references private.roles(key),requested_scope jsonb not null,
 purpose text not null,expires_at timestamptz not null,
 state text not null default 'draft' check(state in('draft','submitted','manager_review','owner_review','needs_information','approved','active','denied','withdrawn','expired','revoked')),
 version integer not null default 1, activated_grant_id uuid unique references private.role_grants(id),
 foreign key(tenant_id,requester_id) references private.memberships(tenant_id,user_id));
create table private.access_decisions(
 id uuid primary key default gen_random_uuid(),request_id uuid not null references private.access_requests(id),
 reviewer_id uuid not null references auth.users(id),stage text not null check(stage in('manager','owner')),
 decision text not null check(decision in('approve','deny','information')),reason text not null,
 at timestamptz not null default now());
create table private.workflow_events(
 id bigint generated always as identity primary key,tenant_id uuid not null references private.tenants(id),
 actor_id uuid not null references auth.users(id),grant_id uuid references private.role_grants(id),
 record_id uuid not null,event text not null,from_state text,to_state text,
 policy_version text not null,at timestamptz not null default now());

create function private.current_grant() returns uuid language sql stable security definer set search_path='' as $$
 select g.id from private.role_grants g
 join private.memberships m on m.tenant_id=g.tenant_id and m.user_id=g.user_id
 join private.session_contexts c on c.active_grant_id=g.id and c.user_id=g.user_id
 where g.user_id=auth.uid() and c.session_id=(auth.jwt()->>'session_id')::uuid
 and g.id=(auth.jwt()->'workspace'->>'grant_id')::uuid
 and m.active and g.revoked_at is null and g.valid_from<=now()
 and (g.expires_at is null or g.expires_at>now());
$$;
create function private.section_access(p_tenant uuid,p_section uuid,p_cap text)
 returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.role_grants g
 join private.role_capabilities c on c.role_key=g.role_key and c.capability=p_cap
 join private.section_scopes s on s.grant_id=g.id and s.tenant_id=g.tenant_id
 where g.id=private.current_grant() and g.tenant_id=p_tenant and s.section_id=p_section);
$$;
create function private.student_access(p_tenant uuid,p_student uuid,p_cap text)
 returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.role_grants g
 join private.role_capabilities c on c.role_key=g.role_key and c.capability=p_cap
 join private.student_scopes s on s.grant_id=g.id and s.tenant_id=g.tenant_id
 where g.id=private.current_grant() and g.tenant_id=p_tenant and s.student_id=p_student);
$$;
create function private.case_access(p_tenant uuid,p_case uuid,p_restricted boolean)
 returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.role_grants g
 join private.role_capabilities c on c.role_key=g.role_key and c.capability='support.read'
 join private.case_scopes s on s.grant_id=g.id and s.tenant_id=g.tenant_id
 where g.id=private.current_grant() and g.tenant_id=p_tenant and s.case_id=p_case
 and (not p_restricted or s.restricted_notes));
$$;

create function private.custom_access_token_hook(event jsonb) returns jsonb
 language plpgsql stable security definer set search_path='' as $$
 declare claims jsonb:=event->'claims'; workspace jsonb;
 begin
 select jsonb_build_object('grant_id',g.id,'tenant_id',g.tenant_id,'role',g.role_key)
 into workspace from private.session_contexts c
 join private.role_grants g on g.id=c.active_grant_id and g.user_id=c.user_id
 join private.memberships m on m.tenant_id=g.tenant_id and m.user_id=g.user_id
 where c.session_id=(claims->>'session_id')::uuid and c.user_id=(event->>'user_id')::uuid
 and m.active and g.revoked_at is null and g.valid_from<=now()
 and (g.expires_at is null or g.expires_at>now());
 claims:=jsonb_set(claims,'{workspace}',coalesce(workspace,'null'::jsonb),true);
 return jsonb_set(event,'{claims}',claims);
 end;
$$;
revoke execute on function private.current_grant() from public,anon,authenticated;
revoke execute on function private.section_access(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function private.student_access(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function private.case_access(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.current_grant(),private.section_access(uuid,uuid,text),private.student_access(uuid,uuid,text),private.case_access(uuid,uuid,boolean) to authenticated;
revoke execute on function private.custom_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all sequences in schema private from public,anon,authenticated;

alter table public.grade_drafts enable row level security;
alter table public.published_grades enable row level security;
alter table public.grade_corrections enable row level security;
alter table public.advising_notes enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.support_cases enable row level security;
alter table public.restricted_case_notes enable row level security;
revoke all on public.grade_drafts,public.published_grades,public.grade_corrections,public.advising_notes,public.finance_accounts,public.support_cases,public.restricted_case_notes from public,anon,authenticated;
grant select on public.grade_drafts,public.published_grades,public.grade_corrections,public.advising_notes,public.finance_accounts,public.support_cases,public.restricted_case_notes to authenticated;
create policy draft_read on public.grade_drafts for select to authenticated using(private.section_access(tenant_id,section_id,'academic.draft'));
create policy published_read on public.published_grades for select to authenticated using(private.section_access(tenant_id,section_id,'academic.read') or private.student_access(tenant_id,student_id,'academic.read'));
create policy correction_read on public.grade_corrections for select to authenticated using(private.section_access(tenant_id,section_id,'correction.request') or private.student_access(tenant_id,student_id,'correction.approve'));
create policy advising_read on public.advising_notes for select to authenticated using(private.student_access(tenant_id,student_id,'advising.read'));
create policy finance_read on public.finance_accounts for select to authenticated using(private.student_access(tenant_id,student_id,'finance.read'));
create policy support_read on public.support_cases for select to authenticated using(private.case_access(tenant_id,id,false));
create policy restricted_read on public.restricted_case_notes for select to authenticated using(private.case_access(tenant_id,case_id,true));
create index draft_scope_idx on public.grade_drafts(tenant_id,section_id);
create index published_scope_idx on public.published_grades(tenant_id,student_id,section_id);
create index correction_scope_idx on public.grade_corrections(tenant_id,student_id,section_id);
create index advising_scope_idx on public.advising_notes(tenant_id,student_id);
create index finance_scope_idx on public.finance_accounts(tenant_id,student_id);
create index restricted_scope_idx on public.restricted_case_notes(tenant_id,case_id);
-- No client INSERT/UPDATE/DELETE grants. Server command handlers must independently
-- authorize writes, validate state/version, enforce separation of duties, and audit.
-- Keep private out of Supabase's exposed schemas. Register the token hook manually.
commit;
