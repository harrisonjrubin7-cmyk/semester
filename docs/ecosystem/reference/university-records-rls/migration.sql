-- Fresh local Supabase reference. Not an upgrade migration or compliance certification.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated,supabase_auth_admin;
create table private.tenants(id uuid primary key,name text not null);
create table private.memberships(tenant_id uuid references private.tenants(id),user_id uuid references auth.users(id),active boolean not null default true,primary key(tenant_id,user_id));
create table private.students(id uuid primary key,tenant_id uuid not null references private.tenants(id),user_id uuid references auth.users(id),unique(id,tenant_id),unique(tenant_id,user_id));
create table private.role_grants(id uuid primary key,tenant_id uuid not null,user_id uuid not null,
 role_key text not null check(role_key in('Faculty','TA','Advisor','Registrar','Finance','Student Affairs','Student')),
 valid_from timestamptz not null default now(),expires_at timestamptz,revoked_at timestamptz,
 foreign key(tenant_id,user_id) references private.memberships(tenant_id,user_id),unique(id,tenant_id),
 check(expires_at is null or expires_at>valid_from));
create table private.session_contexts(session_id uuid primary key,user_id uuid not null references auth.users(id),grant_id uuid not null references private.role_grants(id));
create table private.role_read_rules(role_key text not null,record_kind text not null,primary key(role_key,record_kind));
insert into private.role_read_rules values
 ('Faculty','grade_draft'),('Faculty','grade_published'),('TA','grade_draft'),('TA','grade_published'),
 ('Advisor','grade_published'),('Advisor','advising'),('Registrar','grade_published'),
 ('Finance','finance'),('Student Affairs','support'),('Student Affairs','restricted_support');
-- Each row contains one sensitivity category, never a whole-student payload.
create table public.education_records(id uuid primary key,tenant_id uuid not null,student_id uuid not null,
 kind text not null check(kind in('grade_draft','grade_published','advising','finance','support','restricted_support')),
 body jsonb not null,version integer not null default 1,
 foreign key(student_id,tenant_id) references private.students(id,tenant_id),unique(id,tenant_id));
create table private.record_assignments(grant_id uuid not null,tenant_id uuid not null,record_id uuid not null,
 primary key(grant_id,tenant_id,record_id),
 foreign key(grant_id,tenant_id) references private.role_grants(id,tenant_id),
 foreign key(record_id,tenant_id) references public.education_records(id,tenant_id));
create index records_student_idx on public.education_records(tenant_id,student_id,kind);
create index grants_user_idx on private.role_grants(user_id,tenant_id);
create function private.active_grant() returns uuid language sql stable security definer set search_path='' as $$
 select g.id from private.role_grants g
 join private.memberships m on m.tenant_id=g.tenant_id and m.user_id=g.user_id
 join private.session_contexts c on c.grant_id=g.id and c.user_id=g.user_id
 where g.user_id=auth.uid() and c.session_id=(auth.jwt()->>'session_id')::uuid
 and g.id=(auth.jwt()->'workspace'->>'grant_id')::uuid and m.active
 and g.revoked_at is null and g.valid_from<=now() and (g.expires_at is null or g.expires_at>now());
$$;
create function private.can_read_record(p_id uuid,p_tenant uuid,p_student uuid,p_kind text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.role_grants g where g.id=private.active_grant() and g.tenant_id=p_tenant and (
  (g.role_key='Student' and p_kind in('grade_published','finance') and exists(
   select 1 from private.students s where s.id=p_student and s.tenant_id=p_tenant and s.user_id=auth.uid()))
  or (exists(select 1 from private.role_read_rules r where r.role_key=g.role_key and r.record_kind=p_kind)
   and exists(select 1 from private.record_assignments a where a.grant_id=g.id and a.tenant_id=p_tenant and a.record_id=p_id))
 ));
$$;
create function private.custom_access_token_hook(event jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare claims jsonb:=event->'claims'; workspace jsonb;
 begin
 select jsonb_build_object('grant_id',g.id,'tenant_id',g.tenant_id,'role',g.role_key) into workspace
 from private.session_contexts c join private.role_grants g on g.id=c.grant_id and g.user_id=c.user_id
 join private.memberships m on m.user_id=g.user_id and m.tenant_id=g.tenant_id
 where c.session_id=(claims->>'session_id')::uuid and c.user_id=(event->>'user_id')::uuid
 and m.active and g.revoked_at is null and g.valid_from<=now() and (g.expires_at is null or g.expires_at>now());
 return jsonb_set(event,'{claims}',jsonb_set(claims,'{workspace}',coalesce(workspace,'null'::jsonb),true));
 end;
$$;
revoke execute on function private.active_grant(),private.can_read_record(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.active_grant(),private.can_read_record(uuid,uuid,uuid,text) to authenticated;
revoke execute on function private.custom_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;
alter table public.education_records enable row level security;
revoke all on public.education_records from public,anon,authenticated;
grant select on public.education_records to authenticated;
create policy record_read on public.education_records for select to authenticated
 using(private.can_read_record(id,tenant_id,student_id,kind));
create table private.audit_events(id bigint generated always as identity primary key,
 tenant_id uuid not null references private.tenants(id),actor_id uuid not null references auth.users(id),
 grant_id uuid,record_id uuid not null,event text not null,
 policy_version text not null,occurred_at timestamptz not null default now(),
 foreign key(grant_id,tenant_id) references private.role_grants(id,tenant_id),
 foreign key(record_id,tenant_id) references public.education_records(id,tenant_id));
create table private.disclosure_records(id bigint generated always as identity primary key,
 tenant_id uuid not null,student_id uuid not null,event_kind text not null check(event_kind in('request','disclosure')),
 parties jsonb not null,legitimate_interest text not null,legal_basis text not null,
 fields_disclosed text[] not null,emergency_threat text,occurred_at timestamptz not null default now(),
 foreign key(student_id,tenant_id) references private.students(id,tenant_id),
 check(jsonb_typeof(parties)='array' and jsonb_array_length(parties)>0),
 check(legal_basis<>'health_safety_emergency' or nullif(btrim(emergency_threat),'') is not null));
create function private.reject_evidence_change() returns trigger language plpgsql set search_path='' as $$
 begin raise exception 'Evidence rows are append-only' using errcode='55000'; end;
$$;
revoke execute on function private.reject_evidence_change() from public,anon,authenticated;
create trigger audit_append_only before update or delete on private.audit_events for each row execute function private.reject_evidence_change();
create trigger disclosure_append_only before update or delete on private.disclosure_records for each row execute function private.reject_evidence_change();
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all sequences in schema private from public,anon,authenticated;
-- Server writes require separate validated commands. RLS SELECT creates no audit event.
-- Keep private unexposed. Register hook separately. Owners can bypass triggers/RLS.
commit;
