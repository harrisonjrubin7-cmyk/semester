-- Apply AFTER the previous gradebook_transcript_reference.sql in a local database.
-- Existing what-if rows stay hidden until owner_user_id is correctly backfilled.
begin;
alter table public.gb_audit_runs add column owner_user_id uuid references auth.users(id);
alter table public.gb_audit_runs add constraint audit_run_tenant_unique unique(id,tenant_id);
create table private.gb_audit_shares(
 run_id uuid not null,tenant_id uuid not null,grant_id uuid not null,
 expires_at timestamptz not null,revoked_at timestamptz,
 primary key(run_id,grant_id),
 foreign key(run_id,tenant_id) references public.gb_audit_runs(id,tenant_id),
 foreign key(grant_id,tenant_id) references private.gb_grants(id,tenant_id));
revoke all on private.gb_audit_shares from public,anon,authenticated;
create function private.gb_can_read_audit(p_run uuid,p_tenant uuid,p_student uuid,p_mode text,p_owner uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (
  p_mode='official' and (
   private.gb_self(p_tenant,p_student)
   or private.gb_can(p_tenant,p_student,null,'degree_audit.read')
  )
 ) or (
  p_mode='what_if' and (
   (p_owner=auth.uid() and private.gb_self(p_tenant,p_student))
   or (
    private.gb_can(p_tenant,p_student,null,'degree_audit.shared.read')
    and exists(select 1 from private.gb_audit_shares s
      where s.run_id=p_run and s.tenant_id=p_tenant
      and s.grant_id=private.gb_current_grant()
      and s.revoked_at is null and s.expires_at>now())
   )
  )
 );
$$;
revoke execute on function private.gb_can_read_audit(uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function private.gb_can_read_audit(uuid,uuid,uuid,text,uuid) to authenticated;
drop policy audit_run_read on public.gb_audit_runs;
create policy audit_run_read on public.gb_audit_runs for select to authenticated using(
 private.gb_can_read_audit(id,tenant_id,student_id,mode,owner_user_id));
-- Writes and share creation stay server-only. Validate owner, consent/scope,
-- requirement-version tenant equality, versioned evidence, and expiry there.
commit;
