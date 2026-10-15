-- Review patch for the record-oriented reference (university_rls_migration.sql). Fresh local project only. NOT RUN.
begin;
-- 1. Force RLS: enable alone lets the table owner bypass the read policy.
alter table public.education_records force row level security;

-- 2. Office-wide read for Registrar and Finance. As written, every record needs a record_assignments row per
--    grant, so a registrar would need one row per published grade in the institution. An explicit tenant-wide
--    grant scope keeps it bound to one grant, one tenant and the role's read rules.
create table private.grant_tenant_scope(
  grant_id uuid not null, tenant_id uuid not null, approved_by uuid not null references auth.users(id), reason text not null,
  primary key (grant_id, tenant_id),
  foreign key (grant_id, tenant_id) references private.role_grants(id, tenant_id));
revoke all on private.grant_tenant_scope from public, anon, authenticated;
create or replace function private.can_read_record(p_id uuid, p_tenant uuid, p_student uuid, p_kind text)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from private.role_grants g where g.id = private.active_grant() and g.tenant_id = p_tenant and (
  (g.role_key = 'Student' and p_kind in ('grade_published', 'finance') and exists (
     select 1 from private.students s where s.id = p_student and s.tenant_id = p_tenant and s.user_id = auth.uid()))
  or (exists (select 1 from private.role_read_rules r where r.role_key = g.role_key and r.record_kind = p_kind)
      and (exists (select 1 from private.record_assignments a where a.grant_id = g.id and a.tenant_id = p_tenant and a.record_id = p_id)
           or (g.role_key in ('Registrar', 'Finance') and p_kind <> 'restricted_support'
               and exists (select 1 from private.grant_tenant_scope t where t.grant_id = g.id and t.tenant_id = p_tenant))))));
$$;
-- (can't widen to restricted_support or to roles other than Registrar/Finance)

-- 3. Evidence tables: also block TRUNCATE (the row triggers don't fire for it).
create trigger audit_no_truncate before truncate on private.audit_events for each statement execute function private.reject_evidence_change();
create trigger disclosure_no_truncate before truncate on private.disclosure_records for each statement execute function private.reject_evidence_change();

-- 4. Body must at least be an object; per-kind field allowlists still belong in the server command (as noted).
alter table public.education_records add constraint body_is_object check (jsonb_typeof(body) = 'object');

-- 5. Writes: definer commands owned by semester_writer (AUTHZ-DECISION.md); record_assignments and
--    grant_tenant_scope are provisioned only by those commands; the command must check approved_by differs from the
--    grant's user (a CHECK can't see role_grants.user_id).
commit;
