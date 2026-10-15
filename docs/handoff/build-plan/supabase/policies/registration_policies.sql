-- First vertical slice: registration readiness. Policies for the tables in 060_bespoke_core.sql.
-- Students: own records only. Registrar: tenant-wide with a registrar.* grant. Advisor: read-only for assigned caseload.
-- Writes to registration_requests go through live-institution-command (service role) — no client insert/update policies,
-- so idempotency, payload hashing and the outbox can't be bypassed.

create or replace function semester_core.my_student_id(p_tenant uuid)
returns uuid language sql stable security definer set search_path = semester_core, pg_temp as $$
  select s.id from semester_core.students s
  where s.tenant_id = p_tenant and s.account_id = auth.uid() and semester_core.is_active_member(p_tenant)
$$;

create or replace function semester_core.has_capability(p_tenant uuid, p_cap text, p_scope_id uuid default null)
returns boolean language sql stable security definer set search_path = semester_core, pg_temp as $$
  select exists (
    select 1 from semester_core.grants g join semester_core.memberships m on m.tenant_id = g.tenant_id and m.id = g.membership_id
    where g.tenant_id = p_tenant and m.owner_account_id = auth.uid() and m.status = 'active' and m.deleted_at is null
      and g.capability_key = p_cap and g.revoked_at is null and (g.valid_until is null or g.valid_until > now())
      and (g.scope_type = 'tenant' or g.scope_id = p_scope_id)
  )
$$;
revoke execute on function semester_core.my_student_id(uuid), semester_core.has_capability(uuid,text,uuid) from public, anon;
grant execute on function semester_core.my_student_id(uuid), semester_core.has_capability(uuid,text,uuid) to authenticated;

grant select on semester_core.holds, semester_core.time_tickets, semester_core.readiness_cases, semester_core.readiness_checks,
  semester_core.registration_requests, semester_core.registration_receipts to authenticated;

-- holds
create policy holds_student on semester_core.holds for select to authenticated
  using (student_id = semester_core.my_student_id(tenant_id));
create policy holds_registrar on semester_core.holds for select to authenticated
  using (semester_core.has_capability(tenant_id, 'registrar.readiness.read'));
create policy holds_advisor on semester_core.holds for select to authenticated
  using (semester_core.has_capability(tenant_id, 'advisor.caseload.read', student_id));

-- time tickets
create policy tickets_student on semester_core.time_tickets for select to authenticated
  using (student_id = semester_core.my_student_id(tenant_id));
create policy tickets_registrar on semester_core.time_tickets for select to authenticated
  using (semester_core.has_capability(tenant_id, 'registrar.readiness.read'));

-- readiness
create policy rc_student on semester_core.readiness_cases for select to authenticated
  using (student_id = semester_core.my_student_id(tenant_id));
create policy rc_staff on semester_core.readiness_cases for select to authenticated
  using (semester_core.has_capability(tenant_id, 'registrar.readiness.read') or semester_core.has_capability(tenant_id, 'advisor.caseload.read', student_id));
create policy rck_visible on semester_core.readiness_checks for select to authenticated
  using (exists (select 1 from semester_core.readiness_cases c where c.tenant_id = readiness_checks.tenant_id and c.id = readiness_checks.case_id));
  -- inherits readiness_cases RLS through the subquery

-- registration requests + receipts (read only for clients)
create policy rr_student on semester_core.registration_requests for select to authenticated
  using (student_id = semester_core.my_student_id(tenant_id));
create policy rr_registrar on semester_core.registration_requests for select to authenticated
  using (semester_core.has_capability(tenant_id, 'registrar.readiness.read'));
create policy rrc_visible on semester_core.registration_receipts for select to authenticated
  using (exists (select 1 from semester_core.registration_requests r where r.tenant_id = registration_receipts.tenant_id and r.id = registration_receipts.request_id));

create index if not exists grants_cap_lookup on semester_core.grants (tenant_id, capability_key) where revoked_at is null;
create index if not exists students_account_lookup on semester_core.students (tenant_id, account_id);
