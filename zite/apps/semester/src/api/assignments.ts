import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureFil } from '../lib/filServer';
import { SBM_MIGRATION } from '../lib/sbmMigration';
import { publishProblems, changes, AI_POLICIES, type AssignmentDraft } from '../lib/assignmentRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureFil(); for (const q of SBM_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const one = async (q: string, p: unknown[]) => String(((await pg().query(q, p)) as { r: string | null }[])[0]?.r ?? '');
const DRAFT = z.object({ title: z.string().max(200), instructions: z.string().max(20000), dueAt: z.string().max(40), points: z.number().min(0).max(1000),
  rubric: z.string().max(8000), attemptsAllowed: z.number().int().min(1).max(10), aiPolicy: z.enum(AI_POLICIES) });

// Assignment versions (S-80 §6, S-82 §8B). Drafts belong to the instructor of record and are never shown to students;
// publishing freezes an exact version; students only ever see the current published version; receipts keep the version
// they were submitted against (lib/asgMigration.ts, sbm_submit).
export default createEndpoint({
  description: 'Assignment drafts, preview, versioned publication and history; students see only the published version',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list'), sectionId: z.string() }),
    z.object({ action: z.literal('saveDraft'), sectionId: z.string(), id: z.number().int().nullable(), draft: DRAFT, expectedDraftVersion: z.number().int().min(0) }),
    z.object({ action: z.literal('preview'), sectionId: z.string(), id: z.number().int() }),
    z.object({ action: z.literal('publish'), sectionId: z.string(), id: z.number().int(), expectedDraftVersion: z.number().int(), note: z.string().max(500) }),
    z.object({ action: z.literal('versions'), sectionId: z.string(), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const me = a.userId, T = a.institutionId;
    const s = await zite.sections.findOne({ id: input.sectionId });
    if (!s) forbid('Section not found.');
    const isInstructor = ids(s!.instructors).includes(me) && a.roles.includes('Faculty');
    const enrolled = !isInstructor && !!(await zite.enrollments.findOne({ filters: { student: me, section: s!.id } }));
    if (!isInstructor && !enrolled) forbid('You are not enrolled in or teaching this section.');
    await ensure();
    const get = async (id: number) => ((await pg().query(`SELECT * FROM asg_assignments WHERE id = $1 AND tenant_id = $2 AND section_id = $3`, [id, T, s!.id])) as Row[])[0];
    const version = async (id: number, v: number) => ((await pg().query(`SELECT content FROM asg_versions WHERE assignment_id = $1 AND version = $2`, [id, v])) as Row[])[0]?.content as AssignmentDraft | undefined;

    if (input.action === 'list') {
      const rows = (await pg().query(`SELECT a.*, (SELECT count(*) FROM asg_task_links l WHERE l.assignment_id = a.id)::int AS given,
          (SELECT row_to_json(v) FROM (SELECT version, content, changes, published_at FROM asg_versions WHERE assignment_id = a.id AND version = a.current_version) v) AS cur
        FROM asg_assignments a WHERE a.tenant_id = $1 AND a.section_id = $2 ORDER BY a.created_at`, [T, s!.id])) as Row[];
      if (!isInstructor) // Students: published versions only; drafts and draft text never leave the server.
        return { role: 'student', assignments: rows.filter((r) => r.cur).map((r) => { const c = r.cur as Row; return { id: Number(r.id), version: Number(c.version), content: c.content, changes: c.changes, publishedAt: c.published_at }; }) };
      return { role: 'instructor', assignments: rows.map((r) => ({ id: Number(r.id), state: String(r.state), draft: r.draft, draftVersion: Number(r.draft_version), currentVersion: Number(r.current_version),
        given: Number(r.given), current: r.cur ? (r.cur as Row).content : null, unpublishedChanges: r.cur ? changes((r.cur as Row).content as AssignmentDraft, r.draft as AssignmentDraft).length > 0 : true })) };
    }
    if (!isInstructor) forbid('Only the instructor of record manages assignments.');

    if (input.action === 'saveDraft') {
      const r = await one(`SELECT asg_save_draft($1,$2,$3,$4,$5,$6::jsonb,$7) AS r`, [me, T, s!.id, true, input.id, JSON.stringify(input.draft), input.expectedDraftVersion]);
      if (!r.startsWith('ok:')) forbid(r);
      return { ok: true, id: Number(r.split(':')[1]), draftVersion: Number(r.split(':')[2]) };
    }
    const row = await get(input.id);
    if (!row) forbid('Assignment not found.');
    const draft = row!.draft as AssignmentDraft;
    const cur = Number(row!.current_version) ? await version(input.id, Number(row!.current_version)) : null;

    if (input.action === 'preview') {
      // Exactly what students will receive, checked by the same rules the database relies on.
      return { draft, draftVersion: Number(row!.draft_version), problems: publishProblems(draft), changes: changes(cur ?? null, draft), currentVersion: Number(row!.current_version) };
    }
    if (input.action === 'versions') {
      const vs = (await pg().query(`SELECT version, content, changes, note, published_by, published_at, content_sha256 FROM asg_versions WHERE assignment_id = $1 ORDER BY version DESC`, [input.id])) as Row[];
      const names = await userNames(vs.map((v) => String(v.published_by)));
      const subs = (await pg().query(`SELECT asg_version, count(*)::int AS n FROM sbm_receipts WHERE asg_id = $1 GROUP BY asg_version`, [input.id])) as Row[];
      return { versions: vs.map((v) => ({ version: Number(v.version), content: v.content, changes: v.changes, note: String(v.note), by: names[String(v.published_by)] ?? 'Instructor',
        at: new Date(String(v.published_at)).toISOString(), sha256: String(v.content_sha256).slice(0, 12), submissions: Number(subs.find((x) => Number(x.asg_version) === Number(v.version))?.n ?? 0) })) };
    }

    // publish: freeze the stored draft (never the browser's copy), then give it to every enrolled student.
    const problems = publishProblems(draft);
    const what = changes(cur ?? null, draft);
    const r = await one(`SELECT asg_publish($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.id, true, input.expectedDraftVersion, problems.length === 0, what, input.note]);
    if (!r.startsWith('ok:')) forbid(problems.length ? problems.join(' ') : r);
    const v = Number(r.split(':')[1]);
    const enr = (await zite.enrollments.findAll({ filters: { section: s!.id }, limit: 2000 })).records.filter((e) => e.status === 'Enrolled');
    const students = [...new Set(enr.map((e) => first(e.student) ?? '').filter(Boolean))];
    const links = (await pg().query(`SELECT task_id, student_id FROM asg_task_links WHERE assignment_id = $1`, [input.id])) as Row[];
    const fields = { title: draft.title.trim(), dueAt: new Date(draft.dueAt).toISOString(), points: draft.points, rubric: draft.rubric };
    let created = 0, updated = 0;
    for (const st of students) {
      const l = links.find((x) => x.student_id === st);
      if (l) { await zite.tasks.update({ id: String(l.task_id), record: fields as never }); updated++; continue; }
      const t = await zite.tasks.create({ record: { ...fields, owner: st, type: 'Assignment', source: 'Official', section: s!.id, status: 'Open' } as never });
      const lk = await one(`SELECT asg_link_task($1,$2,$3,$4) AS r`, [T, input.id, t.id, st]);
      if (lk !== 'ok') forbid(lk);
      created++;
    }
    if (students.length) await zite.messages.create({ record: { body: v === 1 ? `New assignment in ${s!.label}: ${fields.title}` : `${fields.title} (${s!.label}) was updated: ${what.join('; ')}`,
      sender: me, recipients: students, isNotification: true, read: false } as never });
    await audit(a, v === 1 ? 'Assignment published' : 'Assignment revised', `assignment:${input.id}`, `version ${v}${what.length ? ': ' + what.join('; ') : ''}`, 'Instructor of record');
    return { ok: true, version: v, changes: what, created, updated };
  },
});
