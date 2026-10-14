-- Review patch for workspace-source/university_rls.sql (uploaded reference). Apply AFTER it, fresh project only. NOT RUN.
-- Brings it in line with handoff/build-plan/AUTHZ-DECISION.md and fixes four gaps found in review.
begin;

-- 1. Force RLS on every exposed table (the reference only enables it, so the table owner bypasses it).
do $$ declare t text; begin
  foreach t in array array['grade_drafts','published_grades','grade_corrections','advising_notes','finance_accounts','support_cases','restricted_case_notes'] loop
    execute format('alter table public.%I force row level security', t);
  end loop; end $$;

-- 2. Office-wide scope. Registrar and Finance work across the institution; the reference only offers section,
--    student and case scopes, so a registrar would need one student_scopes row per student. An office scope is
--    explicit, auditable and still bound to one grant + tenant.
create table private.office_scopes(
  grant_id uuid not null, tenant_id uuid not null, office text not null check (office in ('registrar','finance')),
  primary key (grant_id, tenant_id, office),
  foreign key (grant_id, tenant_id) references private.role_grants(id, tenant_id));
revoke all on private.office_scopes from public, anon, authenticated;
create function private.office_access(p_tenant uuid, p_office text, p_cap text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.role_grants g
    join private.role_capabilities c on c.role_key = g.role_key and c.capability = p_cap
    join private.office_scopes o on o.grant_id = g.id and o.tenant_id = g.tenant_id
    where g.id = private.current_grant() and g.tenant_id = p_tenant and o.office = p_office);
$$;
revoke execute on function private.office_access(uuid, text, text) from public, anon;
grant execute on function private.office_access(uuid, text, text) to authenticated;
drop policy correction_read on public.grade_corrections;
create policy correction_read on public.grade_corrections for select to authenticated using (
  private.section_access(tenant_id, section_id, 'correction.request')
  or private.student_access(tenant_id, student_id, 'correction.approve')
  or private.office_access(tenant_id, 'registrar', 'correction.approve'));
drop policy finance_read on public.finance_accounts;
create policy finance_read on public.finance_accounts for select to authenticated using (
  private.student_access(tenant_id, student_id, 'finance.read') or private.office_access(tenant_id, 'finance', 'finance.read'));

-- 3. One draft per student per section (the reference allows duplicates, so two drafts can race to release).
alter table public.grade_drafts add constraint one_draft_per_enrollment unique (tenant_id, section_id, student_id);

-- 4. A correction must point at a grade for the SAME student and section. The reference leaves this to
--    command code ("commands must verify…"); a composite FK makes it impossible to get wrong.
alter table public.published_grades add constraint grade_identity unique (id, tenant_id, student_id, section_id);
alter table public.grade_corrections drop constraint if exists grade_corrections_grade_id_tenant_id_fkey;
alter table public.grade_corrections add constraint correction_matches_grade
  foreign key (grade_id, tenant_id, student_id, section_id) references public.published_grades(id, tenant_id, student_id, section_id);
alter table public.grade_corrections add constraint independent_approver check (approver_id is null or approver_id <> requester_id);

-- 5. Writes: definer command functions owned by semester_writer (AUTHZ-DECISION.md), not ad-hoc service-role
--    queries. Release keeps history: published_grades rows are never updated; a correction inserts a new
--    version and marks the old one superseded (add superseded_by uuid to published_grades when the command is written).

-- Checks (run on a branch; each should hold)
-- select relforcerowsecurity from pg_class where relname in ('grade_drafts','published_grades','finance_accounts');         -- all true
-- insert two grade_drafts for the same (tenant, section, student)                                                           -- second fails 23505
-- insert grade_corrections with grade_id of student A but student_id B                                                      -- fails 23503
-- update grade_corrections set approver_id = requester_id                                                                    -- fails 23514
-- as a Registrar grant with an office scope: select count(*) from grade_corrections                                          -- sees tenant's corrections only
commit;
