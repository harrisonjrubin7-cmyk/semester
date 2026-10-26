import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { courseRole } from '../lib/teamServer';
import { checkText, checkQuestions, summary, Issue } from '../lib/a11yContentRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
// axr-001: recorded accessibility reviews of a course section, append-only.
const AXR = [
  `CREATE TABLE IF NOT EXISTS axr_reviews (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, reviewer_id text NOT NULL,
     errors int NOT NULL, warnings int NOT NULL, note text NOT NULL CHECK (length(note) BETWEEN 10 AND 2000), at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION axr_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'axr_reviews_append_only') THEN
       CREATE TRIGGER axr_reviews_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON axr_reviews FOR EACH STATEMENT EXECUTE FUNCTION axr_refuse_change();
     END IF;
   END $$`,
];
const ensure = () => { if (!ready) ready = (async () => { for (const q of AXR) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };

// Course accessibility review (Semester Faculty; S-60 §5). Course staff see automated findings for the section's syllabus,
// materials, assignments and published assessments; an instructor of record records a dated review. Assessment
// publishing refuses errors (api/assessments.ts). Findings are heuristics; linked files and media still need a human check.
export default createEndpoint({
  description: 'Course accessibility review: automated findings over course content and recorded reviews',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), sectionId: z.string() }),
    z.object({ action: z.literal('record'), sectionId: z.string(), note: z.string().min(10).max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    if (!(await tenantScope(T)).sections.has(input.sectionId)) forbid('That section is not in your institution.');
    const role = await courseRole(T, input.sectionId, me);
    if (!role) forbid('Only course staff see the accessibility review.');

    const s = await zite.sections.findOne({ id: input.sectionId });
    const [res, tasks] = await Promise.all([
      zite.resources.findAll({ filters: { section: input.sectionId }, limit: 300 }),
      zite.tasks.findAll({ filters: { section: input.sectionId, type: 'Assignment' }, limit: 500 }),
    ]);
    const issues: Issue[] = [...checkText(s?.syllabus ?? '', 'Syllabus')];
    for (const r of res.records.filter((x) => x.kind === 'Material' && x.visibility === 'Course')) {
      const [url, ...rest] = (r.body ?? '').split('\n');
      issues.push(...checkText(r.title ?? '', `Material “${r.title ?? ''}” title`, { allowBareUrl: true }), ...checkText(rest.join('\n'), `Material “${r.title ?? ''}”`));
      if (/(youtube\.com|youtu\.be|vimeo\.com|\.mp4\b)/i.test(url ?? '') && !/caption|transcript|subtitle/i.test(`${r.title} ${rest.join(' ')}`))
        issues.push({ level: 'warning', rule: 'media-captions', where: `Material “${r.title ?? ''}”`, message: 'This links to video. Say where its captions or transcript are.' });
    }
    for (const t of tasks.records) issues.push(...checkText(`${t.title ?? ''}\n\n${t.rubric ?? ''}`, `Assignment “${t.title ?? ''}”`));
    try {
      const asm = (await sql.query(`SELECT a.title, v.questions FROM asm_assessments a JOIN LATERAL (SELECT questions FROM asm_versions WHERE assessment_id = a.id ORDER BY version DESC LIMIT 1) v ON true
        WHERE a.tenant_id = $1 AND a.section_id = $2`, [T, input.sectionId])) as Row[];
      for (const x of asm) issues.push(...checkQuestions((x.questions as { prompt: string; options: string[] }[]) ?? [], `Assessment “${String(x.title)}”`));
    } catch { /* no assessments created yet in this database */ }

    if (input.action === 'record') {
      if (role !== 'instructor') forbid('Only an instructor of record records the review.');
      const sm = summary(issues);
      await sql.query(`INSERT INTO axr_reviews (tenant_id, section_id, reviewer_id, errors, warnings, note) VALUES ($1,$2,$3,$4,$5,$6)`, [T, input.sectionId, me, sm.errors, sm.warnings, input.note.trim()]);
      await audit(a, 'Course accessibility review recorded', `section:${input.sectionId}`, `${sm.errors} errors, ${sm.warnings} warnings`, 'Instructor of record');
    }
    const reviews = (await sql.query(`SELECT reviewer_id, errors, warnings, note, at FROM axr_reviews WHERE tenant_id = $1 AND section_id = $2 ORDER BY at DESC LIMIT 20`, [T, input.sectionId])) as Row[];
    const names = await userNames(reviews.map((r) => String(r.reviewer_id)));
    return {
      role, issues, summary: summary(issues),
      reviews: reviews.map((r) => ({ by: names[String(r.reviewer_id)] ?? 'Member', errors: Number(r.errors), warnings: Number(r.warnings), note: String(r.note), at: new Date(String(r.at)).toISOString() })),
    };
  },
});
