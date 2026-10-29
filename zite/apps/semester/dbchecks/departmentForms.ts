import { neon } from '@neondatabase/serverless';
import { SREQ_MIGRATION } from '../src/lib/sreqMigration';
import { DFM_MIGRATION } from '../src/lib/dfmMigration';

// Department Admin "forms" (lib/dfmMigration.ts). One rolled-back transaction with synthetic departments and people.
// Run on app jeabiv2536: import { run } from './dbchecks/departmentForms'; await run();
export const CHECKS = `DO $$
DECLARE x text; d1 bigint; dX bigint; f1 bigint; f2 bigint; r1 bigint; h text; v int; fl jsonb; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'zz History', 'chair1') RETURNING id INTO d1;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t2', 'zz Biology', 'chairB') RETURNING id INTO dX;
  fl := '[{"key":"course","label":"Course you want to join","type":"text","required":true},{"key":"term","label":"Term","type":"choice","options":["Fall","Spring"],"required":true},{"key":"why","label":"Why","type":"longtext"},{"key":"start","label":"Start date","type":"date"}]';
  x := dfm_set_admin('da1', false, 't1', d1, 'da1', true);
  INSERT INTO rr VALUES (x = 'Only institution administrators appoint department admins.', 'F1 only institution administrators appoint');
  x := dfm_set_admin('adm', true, 't1', d1, 'adm', true);
  INSERT INTO rr VALUES (x = 'Ask another administrator to change your own department access.', 'F2 no self-appointment');
  x := dfm_set_admin('adm', true, 't1', dX, 'da1', true);
  INSERT INTO rr VALUES (x = 'Department not found.', 'F3 cannot appoint into another institution');
  PERFORM dfm_set_admin('adm', true, 't1', d1, 'da1', true); PERFORM dfm_set_admin('adm', true, 't1', d1, 'da2', true);

  x := dfm_form('t1', 'stu', 'draft', NULL, NULL, d1, 'Course overload request', '', fl, 'students', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only that department''s admins create its forms.', 'F4 only department admins create forms');
  x := dfm_form('t1', 'da1', 'draft', NULL, NULL, d1, 'Course overload request', '', '[{"key":"Bad Key","label":"x","type":"text"}]', 'students', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Each field needs a short key (letters, digits, underscore).', 'F5 field definitions are validated');
  x := dfm_form('t1', 'da1', 'draft', NULL, NULL, d1, 'Course overload request', '', '[{"key":"t","label":"Term","type":"choice","options":["Fall"]}]', 'students', NULL, NULL);
  INSERT INTO rr VALUES (x = 'A choice field needs 2 to 20 options.', 'F6 choice fields need options');
  x := dfm_form('t1', 'da1', 'draft', NULL, NULL, d1, 'Course overload request', 'Ask before week 2.', fl, 'students', NULL, NULL); f1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'F7 an admin drafts a form');
  PERFORM dfm_form('t1', 'da1', 'submit', f1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT dfm_hash(title, instructions, fields, audience), version INTO h, v FROM dfm_forms WHERE id = f1;
  x := dfm_form('t1', 'da1', 'approve', f1, v, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'You built this form, so the chair or another department admin approves it.', 'F8 the author cannot approve');
  x := dfm_form('t1', 'chairB', 'approve', f1, v, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'Form not found.', 'F9 another institution''s chair cannot see it');
  x := dfm_form('t1', 'chair1', 'approve', f1, v, NULL, NULL, NULL, NULL, NULL, 'stale', NULL);
  INSERT INTO rr VALUES (x = 'The form changed since you opened it. Reload and review again.', 'F10 approval is bound to the fields seen');
  x := dfm_form('t1', 'chair1', 'approve', f1, v, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state = 'open' AND approver_id = 'chair1' FROM dfm_forms WHERE id = f1), 'F11 the chair approves and it opens');
  SELECT version INTO v FROM dfm_forms WHERE id = f1;
  x := dfm_form('t1', 'da1', 'edit', f1, v, NULL, 'Changed title', '', fl, 'students', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only drafts can be edited. Close an open form and copy it to change it.', 'F12 an open form cannot be edited');

  x := dfm_respond('t1', 'staff9', false, true, f1, 'key-0001', '{"course":"HIST 300","term":"Fall"}');
  INSERT INTO rr VALUES (x = 'This form is not for you.', 'F13 audience is enforced (staff cannot answer a students form)');
  x := dfm_respond('t2', 'stu', true, false, f1, 'key-0001', '{"course":"HIST 300","term":"Fall"}');
  INSERT INTO rr VALUES (x = 'This form is not open.', 'F14 another institution cannot answer');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0001', '{"term":"Fall"}');
  INSERT INTO rr VALUES (x = 'Answer “Course you want to join”.', 'F15 required fields enforced');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0001', '{"course":"HIST 300","term":"Summer"}');
  INSERT INTO rr VALUES (x = 'Choose one of the options for “Term”.', 'F16 choice must be one of the options');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0001', '{"course":"HIST 300","term":"Fall","start":"next week"}');
  INSERT INTO rr VALUES (x = 'Enter a date for “Start date”.', 'F17 dates are validated');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0001', '{"course":"HIST 300","term":"Fall","extra":"x"}');
  INSERT INTO rr VALUES (x = 'An answer does not match any field on this form.', 'F18 unknown answers refused');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0001', '{"course":"HIST 300","term":"Fall","why":"Need it to graduate on time."}'); r1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'F19 a student responds');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0001', '{"course":"HIST 300","term":"Fall","why":"Need it to graduate on time."}');
  INSERT INTO rr VALUES (x = 'replay:' || r1, 'F20 a retry replays');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0002', '{"course":"HIST 301","term":"Fall"}');
  INSERT INTO rr VALUES (x = 'You already sent this form.', 'F21 one live response per person');
  x := dfm_review('t1', 'stu2', r1, 1, 'accept', '');
  INSERT INTO rr VALUES (x = 'Response not found.', 'F22 outsiders cannot see responses');
  x := dfm_review('t1', 'da2', r1, 1, 'return', 'short');
  INSERT INTO rr VALUES (x = 'Write a note the person will see (10+ characters).', 'F23 returning needs a note');
  x := dfm_review('t1', 'da2', r1, 1, 'return', 'Please name the second course too.');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state FROM dfm_responses WHERE id = r1) = 'returned', 'F24 a reviewer returns it');
  x := dfm_respond('t1', 'stu', true, false, f1, 'key-0003', '{"course":"HIST 300 and HIST 310","term":"Fall"}');
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'F25 a returned response can be resubmitted');
  PERFORM dfm_set_admin('adm', true, 't1', d1, 'da2', false);
  x := dfm_review('t1', 'da2', substr(x, 4)::bigint, 1, 'accept', '');
  INSERT INTO rr VALUES (x = 'Response not found.', 'F26 a revoked admin loses access at once');

  x := dfm_respond('t1', 'da1', false, true, f1, 'key-0009', '{"course":"HIST 200","term":"Spring"}');
  INSERT INTO rr VALUES (x = 'This form is not for you.', 'F27 audience check uses server roles');
  SELECT version INTO v FROM dfm_forms WHERE id = f1;
  x := dfm_form('t1', 'da1', 'close', f1, v, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  x := dfm_respond('t1', 'stu3', true, false, f1, 'key-0001', '{"course":"HIST 300","term":"Fall"}');
  INSERT INTO rr VALUES (x = 'This form is not open.', 'F28 a closed form takes no responses');
  SELECT version INTO v FROM dfm_forms WHERE id = f1;
  x := dfm_form('t1', 'da1', 'copy', f1, v, NULL, NULL, NULL, NULL, NULL, NULL, NULL); f2 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES ((SELECT state = 'draft' AND approver_id IS NULL FROM dfm_forms WHERE id = f2), 'F29 a copy starts as an unapproved draft');
  got := false; BEGIN UPDATE dfm_responses SET reviewer_id = respondent_id WHERE id = r1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F30 the table refuses self-review');
  got := false; BEGIN DELETE FROM dfm_events WHERE subject_id = r1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F31 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...SREQ_MIGRATION, ...DFM_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['self-approve (F8)', `IF f.author_id = p_actor THEN RETURN 'You built this form`, `IF false THEN RETURN 'You built this form`],
    ['audience (F13, F27)', `IF (f.audience = 'students' AND NOT p_is_student) OR (f.audience = 'staff' AND NOT p_is_staff) THEN`, `IF false THEN`],
    ['answer validation (F15–F18)', `e := dfm_answers_problem(f.fields, p_answers); IF e IS NOT NULL THEN RETURN e; END IF;`, ``],
    ['edit open form (F12)', `IF f.state <> 'draft' THEN RETURN 'Only drafts can be edited.`, `IF false THEN RETURN 'Only drafts can be edited.`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
