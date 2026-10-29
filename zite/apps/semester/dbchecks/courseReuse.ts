import { neon } from '@neondatabase/serverless';
import { CRS_MIGRATION } from '../src/lib/crsMigration';
import { ASG_MIGRATION } from '../src/lib/asgMigration';
import { ASM_MIGRATION } from '../src/lib/asmMigration';
import { REUSE_MIGRATION } from '../src/lib/reuseMigration';

// Rolled-back checks for course reuse (lib/reuseMigration.ts), house pattern: one transaction, the DO block
// raises RESULT and everything rolls back. The shell copies; student data (task links, attempts) never does.
export const CHECKS = `DO $$
DECLARE r jsonb; a1 bigint; a2 bigint; k1 bigint; x text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO crs_syllabus_versions (tenant_id, section_id, version, body, change_note, author_id) VALUES
    ('ta','sec-old',1,'First syllabus body, long enough to store.','v1','prof'),
    ('ta','sec-old',2,'Latest syllabus body, long enough to store.','v2','prof');
  INSERT INTO asg_assignments (tenant_id, section_id, created_by, draft, current_version, state) VALUES
    ('ta','sec-old','prof','{"title":"HW1 draft","instructions":"draft text","dueAt":"2025-09-01T00:00:00Z","points":50,"rubric":"r","attemptsAllowed":1,"aiPolicy":"Course policy","groupSetId":"g1"}',1,'Published') RETURNING id INTO a1;
  INSERT INTO asg_versions (assignment_id, version, content, content_sha256, published_by) VALUES
    (a1,1,'{"title":"HW1 final","instructions":"final text","dueAt":"2025-09-05T00:00:00Z","points":50,"rubric":"r","attemptsAllowed":2,"aiPolicy":"Course policy","groupSetId":"g1"}','sha','prof');
  INSERT INTO asg_assignments (tenant_id, section_id, created_by, draft) VALUES
    ('ta','sec-old','prof','{"title":"Draft quiz","instructions":"wip","dueAt":"2025-10-01T00:00:00Z","points":10,"rubric":"","attemptsAllowed":1,"aiPolicy":"Course policy","groupSetId":null}') RETURNING id INTO a2;
  INSERT INTO asg_task_links (assignment_id, task_id, student_id) VALUES (a1,'task-1','stu-1');
  INSERT INTO asm_assessments (tenant_id, section_id, title, state, opens_at, closes_at, attempts_allowed, created_by) VALUES
    ('ta','sec-old','Quiz 1','published','2025-09-01T00:00Z','2025-09-10T00:00Z',2,'prof') RETURNING id INTO k1;
  INSERT INTO asm_versions (assessment_id, version, questions, total_points, published_by) VALUES (k1,1,'[{"q":1}]',10,'prof');
  INSERT INTO asm_attempts (tenant_id, assessment_id, version, student_id) VALUES ('ta',k1,1,'stu-1');

  r := reuse_copy_shell('ta','sec-old','sec-new','prof2',30);
  INSERT INTO rr VALUES ((r->>'assignments')::int = 2 AND (r->>'assessments')::int = 1 AND (r->>'syllabus')::boolean, 'R1 counts: 2 assignments, 1 assessment, syllabus copied');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM crs_syllabus_versions WHERE tenant_id='ta' AND section_id='sec-new' AND version=1 AND body='Latest syllabus body, long enough to store.' AND author_id='prof2'), 'R2 latest syllabus lands as version 1 by the copier');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM asg_assignments WHERE tenant_id='ta' AND section_id='sec-new' AND draft->>'title'='HW1 final' AND draft->>'dueAt'='' AND (draft->>'groupSetId') IS NULL AND state='Draft' AND current_version=0), 'R3 published assignment copies from its latest version, due date cleared, group set detached, as a draft');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM asg_assignments WHERE tenant_id='ta' AND section_id='sec-new' AND draft->>'title'='Draft quiz' AND draft->>'dueAt'=''), 'R4 a draft-only assignment copies from its draft, due date cleared');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM asm_assessments WHERE tenant_id='ta' AND section_id='sec-new' AND title='Quiz 1' AND state='draft' AND opens_at='2025-10-01T00:00Z' AND closes_at='2025-10-10T00:00Z'), 'R5 assessment copies as a draft with its window shifted by the calendar delta');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM asm_versions v JOIN asm_assessments a ON a.id=v.assessment_id WHERE a.section_id='sec-new' AND v.version=1 AND v.questions='[{"q":1}]'::jsonb AND v.published_by='prof2'), 'R6 the latest question set lands as version 1');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM asg_task_links l JOIN asg_assignments a ON a.id=l.assignment_id WHERE a.section_id='sec-new'), 'R7 no student task links are copied');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM asm_attempts t JOIN asm_assessments a ON a.id=t.assessment_id WHERE a.section_id='sec-new'), 'R8 no student attempts are copied');
  INSERT INTO rr VALUES ((reuse_copy_shell('ta','sec-old','sec-old','prof2',0)->>'error') = 'Choose a different section to copy into.', 'R9 copying a section into itself is refused');
  r := reuse_copy_shell('tb','sec-old','sec-new2','prof2',0);
  INSERT INTO rr VALUES ((r->>'assignments')::int = 0 AND NOT (r->>'syllabus')::boolean AND NOT EXISTS (SELECT 1 FROM asg_assignments WHERE section_id='sec-new2'), 'R10 another tenant copies nothing');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const MIG = [...CRS_MIGRATION, ...ASG_MIGRATION, ...ASM_MIGRATION, ...REUSE_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', MIG);
  const m1 = REUSE_MIGRATION.map((q) => q.replace(` || '{"dueAt":"","groupSetId":null}'::jsonb`, () => ''));
  console.log('due-date-kept mutant applied:', m1.join('') !== REUSE_MIGRATION.join(''));
  await go('mutant due-dates-carried-over (R3/R4):', [...CRS_MIGRATION, ...ASG_MIGRATION, ...ASM_MIGRATION, ...m1]);
  const m2 = REUSE_MIGRATION.map((q) => q.replace(`sr.title, 'draft'`, () => `sr.title, 'published'`));
  console.log('published-copy mutant applied:', m2.join('') !== REUSE_MIGRATION.join(''));
  await go('mutant assessments-copy-published (R5):', [...CRS_MIGRATION, ...ASG_MIGRATION, ...ASM_MIGRATION, ...m2]);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('crs_syllabus_versions') AS t`)));
}
