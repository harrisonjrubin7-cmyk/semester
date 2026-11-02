-- 014_semester_read_policies.sql: first reviewed READ policies for your 129-table semester schema (semester_campus_portals.sql).
-- Every table there has ENABLE + FORCE RLS and no policies; this adds SELECT policies for the cases the RBAC matrices allow by default.
-- WRITES stay denied: every mutation goes through a command function. NOT executed or parsed. Review with the institution before use.
--
-- Identity: a Supabase user maps to institution-scoped people through identity_links(issuer = 'supabase-auth', subject = auth.uid()).
-- Never trust a tenant_id from the request; every helper derives it from the verified identity link plus an active membership.
--
-- FORCE RLS applies to the table owner too, so the helper functions below must be owned by a role with BYPASSRLS
-- (created once by a superuser). They read only identity, membership and relationship tables, and return booleans or ids, never rows.
BEGIN;
SET LOCAL search_path = semester, public;
SET LOCAL lock_timeout = '5s';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'semester_rls_helper') THEN
    CREATE ROLE semester_rls_helper NOLOGIN BYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA semester TO semester_rls_helper, authenticated;
GRANT SELECT ON semester.identity_links, semester.memberships, semester.section_instructors, semester.enrollments, semester.advisor_assignments, semester.delegations TO semester_rls_helper;

-- ------------------------------------------------ helpers
-- (tenant_id, person_id) pairs for the signed-in user, active memberships only.
CREATE FUNCTION semester.my_people() RETURNS TABLE(tenant_id uuid, person_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT il.tenant_id, il.person_id FROM semester.identity_links il
  WHERE il.issuer = 'supabase-auth' AND il.subject = auth.uid()::text
    AND EXISTS (SELECT 1 FROM semester.memberships m WHERE m.tenant_id = il.tenant_id AND m.person_id = il.person_id AND m.status = 'active' AND now() >= m.starts_at AND (m.ends_at IS NULL OR m.ends_at > now())) $$;
CREATE FUNCTION semester.is_me(p_tenant uuid, p_person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.my_people() me WHERE me.tenant_id = p_tenant AND me.person_id = p_person) $$;
CREATE FUNCTION semester.is_member(p_tenant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.my_people() me WHERE me.tenant_id = p_tenant) $$;
-- Applicants have an identity link but usually no membership yet: separate helper, used only for their own application rows.
CREATE FUNCTION semester.is_me_unmembered(p_tenant uuid, p_person uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.identity_links il WHERE il.tenant_id = p_tenant AND il.person_id = p_person AND il.issuer = 'supabase-auth' AND il.subject = auth.uid()::text) $$;
-- Teaching relationship: the caller is listed on the section.
CREATE FUNCTION semester.teaches_section(p_tenant uuid, p_section uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.section_instructors si JOIN semester.my_people() me ON me.tenant_id = si.tenant_id AND me.person_id = si.person_id
                 WHERE si.tenant_id = p_tenant AND si.section_id = p_section AND si.role_code IN ('instructor', 'co_instructor', 'ta')) $$;
-- Teaches any section this student is enrolled in (for the roster's people rows).
CREATE FUNCTION semester.teaches_student(p_tenant uuid, p_student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.enrollments e WHERE e.tenant_id = p_tenant AND e.person_id = p_student AND e.status IN ('enrolled', 'waitlisted') AND semester.teaches_section(p_tenant, e.section_id)) $$;
-- Active advisor assignment.
CREATE FUNCTION semester.advises(p_tenant uuid, p_student uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.advisor_assignments a JOIN semester.my_people() me ON me.tenant_id = a.tenant_id AND me.person_id = a.advisor_person_id
                 WHERE a.tenant_id = p_tenant AND a.student_person_id = p_student AND now() >= a.starts_at AND (a.ends_at IS NULL OR a.ends_at > now())) $$;
-- Delegation for one named item: permission_scope = {"items": ["schedule", "holds", "housing", "wallets", "balance"]}.
CREATE FUNCTION semester.delegated(p_tenant uuid, p_student uuid, p_item text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM semester.delegations d JOIN semester.identity_links il ON il.tenant_id = d.tenant_id AND il.person_id = d.delegate_person_id
                 WHERE d.tenant_id = p_tenant AND d.subject_person_id = p_student AND il.issuer = 'supabase-auth' AND il.subject = auth.uid()::text
                   AND now() >= d.starts_at AND (d.expires_at IS NULL OR d.expires_at > now()) AND d.revoked_at IS NULL
                   AND d.permission_scope -> 'items' ? p_item) $$;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['my_people()', 'is_me(uuid, uuid)', 'is_member(uuid)', 'is_me_unmembered(uuid, uuid)', 'teaches_section(uuid, uuid)', 'teaches_student(uuid, uuid)', 'advises(uuid, uuid)', 'delegated(uuid, uuid, text)'] LOOP
    EXECUTE 'ALTER FUNCTION semester.' || f || ' OWNER TO semester_rls_helper';
    EXECUTE 'REVOKE ALL ON FUNCTION semester.' || f || ' FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION semester.' || f || ' TO authenticated';
  END LOOP;
END $$;

-- ------------------------------------------------ grants (SELECT only; policies below decide rows)
GRANT SELECT ON semester.people, semester.student_records, semester.student_holds, semester.registration_requests, semester.enrollments, semester.sections, semester.courses,
  semester.applications, semester.application_requirements, semester.admission_decisions, semester.admission_offers, semester.onboarding_instances,
  semester.housing_applications, semester.housing_allocations, semester.dining_plan_enrollments, semester.dining_entitlement_periods, semester.dining_entitlement_entries,
  semester.campus_wallets, semester.campus_wallet_entries, semester.dining_transactions, semester.dining_locations, semester.dining_hours, semester.menus, semester.consents, semester.delegations TO authenticated;

-- ------------------------------------------------ own records
CREATE POLICY own ON semester.people FOR SELECT TO authenticated USING (semester.is_me(tenant_id, id));
CREATE POLICY roster ON semester.people FOR SELECT TO authenticated USING (semester.teaches_student(tenant_id, id));   -- preferred_name/status only; restrict columns with a view
CREATE POLICY advisee ON semester.people FOR SELECT TO authenticated USING (semester.advises(tenant_id, id));
CREATE POLICY own ON semester.student_records FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.student_holds FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY advisee ON semester.student_holds FOR SELECT TO authenticated USING (semester.advises(tenant_id, person_id));
CREATE POLICY delegate ON semester.student_holds FOR SELECT TO authenticated USING (semester.delegated(tenant_id, person_id, 'holds'));
CREATE POLICY own ON semester.registration_requests FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY advisee ON semester.registration_requests FOR SELECT TO authenticated USING (semester.advises(tenant_id, person_id));
CREATE POLICY own ON semester.enrollments FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY roster ON semester.enrollments FOR SELECT TO authenticated USING (semester.teaches_section(tenant_id, section_id));
CREATE POLICY advisee ON semester.enrollments FOR SELECT TO authenticated USING (semester.advises(tenant_id, person_id));
CREATE POLICY delegate ON semester.enrollments FOR SELECT TO authenticated USING (semester.delegated(tenant_id, person_id, 'schedule'));
CREATE POLICY catalog ON semester.courses FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND status = 'active');
CREATE POLICY catalog ON semester.sections FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND status <> 'draft');

-- ------------------------------------------------ admissions (applicants usually aren't members yet)
CREATE POLICY own ON semester.applications FOR SELECT TO authenticated USING (semester.is_me_unmembered(tenant_id, applicant_person_id));
CREATE POLICY own ON semester.application_requirements FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.applications a WHERE a.tenant_id = application_requirements.tenant_id AND a.id = application_requirements.application_id AND semester.is_me_unmembered(a.tenant_id, a.applicant_person_id)));
CREATE POLICY own_released ON semester.admission_decisions FOR SELECT TO authenticated USING (status = 'released' AND EXISTS (SELECT 1 FROM semester.applications a WHERE a.tenant_id = admission_decisions.tenant_id AND a.id = admission_decisions.application_id AND semester.is_me_unmembered(a.tenant_id, a.applicant_person_id)));
CREATE POLICY own ON semester.admission_offers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.admission_decisions d JOIN semester.applications a ON a.tenant_id = d.tenant_id AND a.id = d.application_id
  WHERE d.tenant_id = admission_offers.tenant_id AND d.id = admission_offers.decision_id AND d.status = 'released' AND semester.is_me_unmembered(a.tenant_id, a.applicant_person_id)));
CREATE POLICY own ON semester.onboarding_instances FOR SELECT TO authenticated USING (semester.is_me_unmembered(tenant_id, person_id));
-- Reviewer notes, review scores and recommendation content: NO client policy. Admissions staff read them through commands that call authorize().

-- ------------------------------------------------ housing
CREATE POLICY own ON semester.housing_applications FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.housing_allocations FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY delegate ON semester.housing_allocations FOR SELECT TO authenticated USING (semester.delegated(tenant_id, person_id, 'housing'));
-- Placement instructions, eligibility reasons and accommodation evidence: NO client policy.

-- ------------------------------------------------ dining (each balance type separate)
CREATE POLICY own ON semester.dining_plan_enrollments FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY own ON semester.dining_entitlement_periods FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.dining_plan_enrollments e WHERE e.tenant_id = dining_entitlement_periods.tenant_id AND e.id = dining_entitlement_periods.plan_enrollment_id AND semester.is_me(e.tenant_id, e.person_id)));
CREATE POLICY own ON semester.dining_entitlement_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.dining_entitlement_periods p JOIN semester.dining_plan_enrollments e ON e.tenant_id = p.tenant_id AND e.id = p.plan_enrollment_id
  WHERE p.tenant_id = dining_entitlement_entries.tenant_id AND p.id = dining_entitlement_entries.period_id AND semester.is_me(e.tenant_id, e.person_id)));
CREATE POLICY own ON semester.campus_wallets FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY delegate ON semester.campus_wallets FOR SELECT TO authenticated USING (semester.delegated(tenant_id, person_id, 'wallets'));
CREATE POLICY own ON semester.campus_wallet_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM semester.campus_wallets w WHERE w.tenant_id = campus_wallet_entries.tenant_id AND w.id = campus_wallet_entries.wallet_id AND semester.is_me(w.tenant_id, w.person_id)));
CREATE POLICY own ON semester.dining_transactions FOR SELECT TO authenticated USING (semester.is_me(tenant_id, person_id));
CREATE POLICY campus ON semester.dining_locations FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND status = 'open');
CREATE POLICY campus ON semester.dining_hours FOR SELECT TO authenticated USING (semester.is_member(tenant_id));
CREATE POLICY campus ON semester.menus FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND status = 'published');

-- ------------------------------------------------ governance: people see their own consents and delegations
CREATE POLICY own ON semester.consents FOR SELECT TO authenticated USING (semester.is_me(tenant_id, subject_person_id));
CREATE POLICY own_or_delegate ON semester.delegations FOR SELECT TO authenticated USING (semester.is_me(tenant_id, subject_person_id) OR semester.is_me(tenant_id, delegate_person_id));
-- audit_events, ferpa_disclosure_records, subject_tokens, pii_values, privileged_access_grants, export_jobs, every lti_* table,
-- payment and billing internals, reviews and recommendations: NO client policies. Default deny stays in force.
COMMIT;
