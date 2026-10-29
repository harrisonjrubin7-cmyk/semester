// Migration reuse-001: course reuse (platform plan: term completion -> archive -> retention -> course reuse).
// Copies a section's teaching shell into a new section: the latest syllabus as version 1, every assignment as a
// fresh draft (from its latest published version when it has one), and every assessment as a draft carrying its
// latest question set. Student data is never copied: no task links, submissions, attempts, grades or discussions
// are read or written here. Assignment due dates are cleared and group sets detached — both belong to the old
// term's students; assessment windows shift by the calendar delta the endpoint computes (0 when unknown).
export const REUSE_MIGRATION: string[] = [
  `CREATE OR REPLACE FUNCTION reuse_copy_shell(p_tenant text, p_from text, p_to text, p_actor text, p_day_shift int) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE syl text; na int := 0; nk int := 0; ar record; sr record; vcontent jsonb; vq jsonb; vt numeric; nid bigint; shift int := coalesce(p_day_shift, 0);
   BEGIN
     IF p_from = p_to THEN RETURN jsonb_build_object('error', 'Choose a different section to copy into.'); END IF;
     SELECT body INTO syl FROM crs_syllabus_versions WHERE tenant_id = p_tenant AND section_id = p_from ORDER BY version DESC LIMIT 1;
     IF syl IS NOT NULL THEN
       INSERT INTO crs_syllabus_versions (tenant_id, section_id, version, body, change_note, author_id)
         VALUES (p_tenant, p_to, 1, syl, 'Copied from the previous term', p_actor);
     END IF;
     FOR ar IN SELECT * FROM asg_assignments WHERE tenant_id = p_tenant AND section_id = p_from ORDER BY id LOOP
       SELECT content INTO vcontent FROM asg_versions WHERE assignment_id = ar.id ORDER BY version DESC LIMIT 1;
       INSERT INTO asg_assignments (tenant_id, section_id, created_by, draft)
         VALUES (p_tenant, p_to, p_actor, coalesce(vcontent, ar.draft) || '{"dueAt":"","groupSetId":null}'::jsonb);
       na := na + 1;
     END LOOP;
     FOR sr IN SELECT * FROM asm_assessments WHERE tenant_id = p_tenant AND section_id = p_from ORDER BY id LOOP
       INSERT INTO asm_assessments (tenant_id, section_id, title, state, opens_at, closes_at, time_limit_min, attempts_allowed, created_by)
         VALUES (p_tenant, p_to, sr.title, 'draft', sr.opens_at + make_interval(days => shift), sr.closes_at + make_interval(days => shift), sr.time_limit_min, sr.attempts_allowed, p_actor)
         RETURNING id INTO nid;
       SELECT questions, total_points INTO vq, vt FROM asm_versions WHERE assessment_id = sr.id ORDER BY version DESC LIMIT 1;
       IF vq IS NOT NULL THEN
         INSERT INTO asm_versions (assessment_id, version, questions, total_points, published_by) VALUES (nid, 1, vq, vt, p_actor);
       END IF;
       nk := nk + 1;
     END LOOP;
     RETURN jsonb_build_object('syllabus', syl IS NOT NULL, 'assignments', na, 'assessments', nk);
   END $$`,
];
