-- Fresh Supabase reference; not executed, not an upgrade or FERPA certification.
begin;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
create table private.gb_memberships(tenant_id uuid,user_id uuid references auth.users(id),active boolean not null default true,primary key(tenant_id,user_id));
create table private.gb_students(id uuid,tenant_id uuid,user_id uuid references auth.users(id),primary key(id,tenant_id),unique(tenant_id,user_id));
create table private.gb_sections(id uuid,tenant_id uuid,primary key(id,tenant_id));
create table private.gb_grants(id uuid primary key,tenant_id uuid not null,user_id uuid not null,
 role_key text not null check(role_key in('Student','Faculty','TA','Advisor','Registrar','Finance','Student Affairs')),
 expires_at timestamptz,revoked_at timestamptz,unique(id,tenant_id),
 foreign key(tenant_id,user_id) references private.gb_memberships(tenant_id,user_id));
create table private.gb_capabilities(grant_id uuid references private.gb_grants(id),capability text,primary key(grant_id,capability));
create table private.gb_scopes(grant_id uuid,tenant_id uuid,scope_kind text check(scope_kind in('section','student')),object_id uuid,
 primary key(grant_id,tenant_id,scope_kind,object_id),foreign key(grant_id,tenant_id) references private.gb_grants(id,tenant_id));
-- Scope objects must be validated by trusted provisioning commands.
create table private.gb_sessions(session_id uuid primary key,user_id uuid references auth.users(id),grant_id uuid references private.gb_grants(id));
create table public.gb_drafts(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,student_id uuid not null,section_id uuid not null,
 assessment_id uuid not null,score numeric,approved_feedback text,version integer not null default 1,
 moderation_state text not null default 'draft' check(moderation_state in('draft','submitted','review_required','reviewed')),
 source_ready boolean not null default false,access_gate_passed boolean not null default false,
 blocker text not null default 'none' check(blocker in('none','policy_exception','missing_evidence','privacy_block')),
 unique(id,tenant_id),foreign key(student_id,tenant_id) references private.gb_students(id,tenant_id),
 foreign key(section_id,tenant_id) references private.gb_sections(id,tenant_id));
create table private.gb_overrides(id uuid primary key default gen_random_uuid(),draft_id uuid not null,tenant_id uuid not null,
 draft_version integer not null,approver_id uuid not null references auth.users(id),approver_grant uuid not null,
 reason text not null check(length(btrim(reason))>0),expires_at timestamptz not null,
 unique(draft_id,draft_version),foreign key(draft_id,tenant_id) references public.gb_drafts(id,tenant_id),
 foreign key(approver_grant,tenant_id) references private.gb_grants(id,tenant_id));
create table public.gb_releases(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,draft_id uuid not null,
 student_id uuid not null,section_id uuid not null,assessment_id uuid not null,draft_version integer not null,
 score numeric not null,feedback text,released_by uuid not null references auth.users(id),released_at timestamptz not null default now(),
 override_id uuid references private.gb_overrides(id),unique(draft_id,draft_version),
 foreign key(draft_id,tenant_id) references public.gb_drafts(id,tenant_id),
 foreign key(student_id,tenant_id) references private.gb_students(id,tenant_id),foreign key(section_id,tenant_id) references private.gb_sections(id,tenant_id));
-- Accepted final academic facts are not assessment releases.
create table public.gb_academic_facts(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,student_id uuid not null,
 section_id uuid not null,final_grade text not null,credits numeric not null,record_version integer not null,
 accepted_at timestamptz not null default now(),foreign key(student_id,tenant_id) references private.gb_students(id,tenant_id),
 foreign key(section_id,tenant_id) references private.gb_sections(id,tenant_id));
create table private.gb_requirement_versions(id uuid primary key,tenant_id uuid not null,program_key text not null,version text not null,definition jsonb not null);
create table public.gb_audit_runs(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,student_id uuid not null,
 requirement_version uuid not null references private.gb_requirement_versions(id),mode text not null check(mode in('official','what_if')),
 evidence_as_of timestamptz not null,result jsonb not null,
 foreign key(student_id,tenant_id) references private.gb_students(id,tenant_id));
-- Commands must enforce requirement-version tenant equality and versioned node semantics.
create table public.gb_transcript_requests(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,student_id uuid not null,
 state text not null default 'requested' check(state in('requested','validating','review_required','authorized','generating','ready','delivering','delivered','failed','cancelled')),
 version integer not null default 1,foreign key(student_id,tenant_id) references private.gb_students(id,tenant_id));
create table private.gb_transcript_snapshots(id uuid primary key,request_id uuid not null references public.gb_transcript_requests(id),
 accepted_fact_ids uuid[] not null,content_hash text not null,storage_key text not null);
-- Snapshot content/storage keys and recipient details are not client-readable.
create table private.gb_audit_events(id bigint generated always as identity primary key,tenant_id uuid not null,actor_id uuid not null,
 grant_id uuid not null,event text not null,record_id uuid not null,record_version integer not null,reason text,
 occurred_at timestamptz not null default now());
create function private.gb_current_grant() returns uuid language sql stable security definer set search_path='' as $$
 select g.id from private.gb_grants g join private.gb_memberships m on m.tenant_id=g.tenant_id and m.user_id=g.user_id
 join private.gb_sessions s on s.grant_id=g.id and s.user_id=g.user_id
 where g.user_id=auth.uid() and s.session_id=(auth.jwt()->>'session_id')::uuid
 and g.id=(auth.jwt()->'workspace'->>'grant_id')::uuid and m.active and g.revoked_at is null
 and(g.expires_at is null or g.expires_at>now());
$$;
create function private.gb_can(p_tenant uuid,p_student uuid,p_section uuid,p_cap text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.gb_grants g join private.gb_capabilities c on c.grant_id=g.id and c.capability=p_cap
 where g.id=private.gb_current_grant() and g.tenant_id=p_tenant and exists(
 select 1 from private.gb_scopes s where s.grant_id=g.id and s.tenant_id=p_tenant
 and((s.scope_kind='student' and s.object_id=p_student) or(s.scope_kind='section' and s.object_id=p_section))));
$$;
create function private.gb_self(p_tenant uuid,p_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.gb_students s join private.gb_grants g on g.tenant_id=s.tenant_id and g.user_id=s.user_id
 where g.id=private.gb_current_grant() and g.role_key='Student' and s.tenant_id=p_tenant and s.id=p_student and s.user_id=auth.uid());
$$;
create function private.gb_approve_override(p_draft uuid,p_version integer,p_reason text,p_expiry timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
 declare d public.gb_drafts;gid uuid:=private.gb_current_grant();oid uuid;
 begin
 select * into d from public.gb_drafts where id=p_draft for update;
 if not found then raise exception 'Unavailable record' using errcode='42501';end if;
 if not exists(select 1 from private.gb_grants g where g.id=gid and g.role_key='Registrar')
 or not private.gb_can(d.tenant_id,d.student_id,d.section_id,'release.override')
 then raise exception 'Override denied' using errcode='42501';end if;
 if d.version<>p_version or d.blocker<>'policy_exception' or d.moderation_state<>'reviewed'
 or not d.source_ready or not d.access_gate_passed or d.score is null
 then raise exception 'Record not overrideable' using errcode='55000';end if;
 if nullif(btrim(p_reason),'') is null or p_expiry<=now() or p_expiry>now()+interval '24 hours'
 then raise exception 'Reason and bounded expiry required';end if;
 insert into private.gb_overrides(draft_id,tenant_id,draft_version,approver_id,approver_grant,reason,expires_at)
 values(d.id,d.tenant_id,d.version,auth.uid(),gid,p_reason,p_expiry) returning id into oid;
 insert into private.gb_audit_events(tenant_id,actor_id,grant_id,event,record_id,record_version,reason)
 values(d.tenant_id,auth.uid(),gid,'override_approved',d.id,d.version,p_reason);
 return oid;
 end;
$$;
create function public.gb_release(p_draft uuid,p_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
 declare d public.gb_drafts;gid uuid:=private.gb_current_grant();oid uuid;rid uuid;
 begin
 select * into d from public.gb_drafts where id=p_draft for update;
 if not found then raise exception 'Unavailable record' using errcode='42501';end if;
 if not private.gb_can(d.tenant_id,d.student_id,d.section_id,'grades.release')
 or not exists(select 1 from private.gb_grants g where g.id=gid and g.role_key in('Faculty','Registrar'))
 then raise exception 'Release denied' using errcode='42501';end if;
 if d.version<>p_version then raise exception 'Stale version' using errcode='40001';end if;
 select id into rid from public.gb_releases where draft_id=d.id and draft_version=d.version;
 if found then return rid;end if;
 if d.moderation_state<>'reviewed' or not d.source_ready or not d.access_gate_passed or d.score is null
 or d.blocker in('missing_evidence','privacy_block') then raise exception 'Release gates failed' using errcode='55000';end if;
 if d.blocker='policy_exception' then
 select o.id into oid from private.gb_overrides o join private.gb_grants g on g.id=o.approver_grant
 join private.gb_memberships m on m.tenant_id=g.tenant_id and m.user_id=g.user_id
 join private.gb_capabilities c on c.grant_id=g.id and c.capability='release.override'
 where o.draft_id=d.id and o.draft_version=d.version and o.expires_at>now()
 and g.role_key='Registrar' and g.revoked_at is null and (g.expires_at is null or g.expires_at>now()) and m.active
 and exists(select 1 from private.gb_scopes s where s.grant_id=g.id and s.tenant_id=d.tenant_id
 and((s.scope_kind='student' and s.object_id=d.student_id) or(s.scope_kind='section' and s.object_id=d.section_id)));
 if oid is null then raise exception 'Current registrar override required' using errcode='55000';end if;
 end if;
 insert into public.gb_releases(tenant_id,draft_id,student_id,section_id,assessment_id,draft_version,score,feedback,released_by,override_id)
 values(d.tenant_id,d.id,d.student_id,d.section_id,d.assessment_id,d.version,d.score,d.approved_feedback,auth.uid(),oid) returning id into rid;
 insert into private.gb_audit_events(tenant_id,actor_id,grant_id,event,record_id,record_version)
 values(d.tenant_id,auth.uid(),gid,'grade_released',rid,d.version);
 return rid;
 end;
$$;
create function private.gb_append_only() returns trigger language plpgsql set search_path='' as $$
 begin raise exception 'Append-only record' using errcode='55000';end;
$$;
create trigger release_immutable before update or delete on public.gb_releases for each row execute function private.gb_append_only();
create trigger audit_immutable before update or delete on private.gb_audit_events for each row execute function private.gb_append_only();
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all sequences in schema private from public,anon,authenticated;
revoke execute on function private.gb_current_grant(),private.gb_can(uuid,uuid,uuid,text),private.gb_self(uuid,uuid),private.gb_approve_override(uuid,integer,text,timestamptz),private.gb_append_only(),public.gb_release(uuid,integer) from public,anon,authenticated;
grant execute on function private.gb_current_grant(),private.gb_can(uuid,uuid,uuid,text),private.gb_self(uuid,uuid),public.gb_release(uuid,integer) to authenticated;
-- Override is private: trusted endpoint calls it under a validated user JWT context.
-- Grant EXECUTE to authenticated without exposing private through the Data API.
grant execute on function private.gb_approve_override(uuid,integer,text,timestamptz) to authenticated;
alter table public.gb_drafts enable row level security;
alter table public.gb_releases enable row level security;
alter table public.gb_academic_facts enable row level security;
alter table public.gb_audit_runs enable row level security;
alter table public.gb_transcript_requests enable row level security;
revoke all on public.gb_drafts,public.gb_releases,public.gb_academic_facts,public.gb_audit_runs,public.gb_transcript_requests from public,anon,authenticated;
grant select on public.gb_drafts,public.gb_releases,public.gb_academic_facts,public.gb_audit_runs,public.gb_transcript_requests to authenticated;
create policy draft_read on public.gb_drafts for select to authenticated using(private.gb_can(tenant_id,student_id,section_id,'grades.draft.read'));
create policy release_read on public.gb_releases for select to authenticated using(private.gb_self(tenant_id,student_id) or private.gb_can(tenant_id,student_id,section_id,'grades.released.read'));
create policy academic_read on public.gb_academic_facts for select to authenticated using(private.gb_self(tenant_id,student_id) or private.gb_can(tenant_id,student_id,section_id,'academic.read'));
create policy audit_run_read on public.gb_audit_runs for select to authenticated using(private.gb_self(tenant_id,student_id) or private.gb_can(tenant_id,student_id,null,'degree_audit.read'));
create policy transcript_request_read on public.gb_transcript_requests for select to authenticated using(private.gb_self(tenant_id,student_id) or private.gb_can(tenant_id,student_id,null,'transcript.manage'));
-- No client writes. Draft/moderation commands must enforce version increments and cannot set gates arbitrarily.
-- Hook integration, tenant provisioning, transcript delivery, accepted-final-grade commands,
-- degree-audit evaluator, outbox delivery, legal review, and SQL tests are not included.
commit;
