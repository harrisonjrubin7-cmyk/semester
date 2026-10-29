// Employer discovery profiles (Employers thin-app pass: candidate search and pipelines). A student writes a
// short discovery profile and chooses whether employers can find it. Discovery is doubly gated: the profile
// must be discoverable AND the searching employer's partnership with the student's institution must be
// Approved (crr_partners) — the same approval that gates applying. Turning discoverable off hides the
// profile from every search immediately; the profile itself stays for the student to edit.
export const EMP_PROFILE_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS emp_profiles (student_id text PRIMARY KEY, tenant_id text NOT NULL,
     headline text NOT NULL DEFAULT '' CHECK (length(headline) <= 120), program text NOT NULL DEFAULT '' CHECK (length(program) <= 120),
     grad_year int, skills text NOT NULL DEFAULT '' CHECK (length(skills) <= 500), roles text NOT NULL DEFAULT '' CHECK (length(roles) <= 300),
     discoverable boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION emp_profile_save(p_student text, p_tenant text, p_headline text, p_program text, p_grad int, p_skills text, p_roles text, p_discoverable boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_discoverable AND length(trim(coalesce(p_headline, ''))) < 3 THEN RETURN 'Add a headline before employers can discover you.'; END IF;
     IF p_grad IS NOT NULL AND (p_grad < 2024 OR p_grad > 2100) THEN RETURN 'Check the graduation year.'; END IF;
     INSERT INTO emp_profiles (student_id, tenant_id, headline, program, grad_year, skills, roles, discoverable)
       VALUES (p_student, p_tenant, left(coalesce(p_headline, ''), 120), left(coalesce(p_program, ''), 120), p_grad, left(coalesce(p_skills, ''), 500), left(coalesce(p_roles, ''), 300), p_discoverable)
     ON CONFLICT (student_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, headline = EXCLUDED.headline, program = EXCLUDED.program,
       grad_year = EXCLUDED.grad_year, skills = EXCLUDED.skills, roles = EXCLUDED.roles, discoverable = EXCLUDED.discoverable, updated_at = clock_timestamp();
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION emp_search_candidates(p_tenants text[], p_q text, p_grad int)
     RETURNS TABLE (student_id text, headline text, program text, grad_year int, skills text, roles text, tenant_id text)
     LANGUAGE sql STABLE AS $$
     SELECT student_id, headline, program, grad_year, skills, roles, tenant_id FROM emp_profiles
     WHERE discoverable AND tenant_id = ANY (p_tenants)
       AND (p_grad IS NULL OR grad_year = p_grad)
       AND (coalesce(p_q, '') = '' OR (headline || ' ' || program || ' ' || skills || ' ' || roles) ILIKE '%' || p_q || '%')
     ORDER BY updated_at DESC LIMIT 50 $$`,
];
