import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureCal } from '../lib/calendarServer';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { CUR_MIGRATION } from '../lib/curMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureCal(); for (const q of [...SREQ_MIGRATION, ...CUR_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const Syllabus = z.object({ weeks: z.number().int().min(1).max(30), assessments: z.array(z.object({ name: z.string().min(2).max(80), weight: z.number().positive().max(100) })).min(1).max(12), policies: z.string().min(20).max(4000) });

// Curriculum governance (S-70). Faculty propose a course version with outcomes and a syllabus template; the department chair
// endorses; a curriculum-committee member approves, which files the version into the catalog for a registrar to publish on
// the Catalog page (existing two-person approval). Authors see their own proposals, chairs their department's, the committee
// everything past the chair. Every rule is enforced in lib/curMigration.ts.
export default createEndpoint({
  description: 'Curriculum: faculty course proposals with outcomes and syllabus templates, chair endorsement, committee approval, catalog filing',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('submit'), requestKey: z.string().min(8).max(100), departmentId: z.number().int(), code: z.string().min(4).max(20), title: z.string().min(3).max(160),
      credits: z.number().positive().max(12), description: z.string().min(20).max(4000), prereqs: z.array(z.string().min(4).max(20)).max(10), outcomes: z.array(z.string().min(10).max(400)).min(1).max(12),
      syllabus: Syllabus, effectiveTerm: z.string().min(3).max(40), rationale: z.string().min(20).max(4000) }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(['endorse', 'approve', 'return', 'withdraw']), expectedVersion: z.number().int(), note: z.string().max(2000).default('') }),
    z.object({ action: z.literal('setCommittee'), email: z.string().email().max(200), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const isCommittee = !!((await sql.query(`SELECT cur_is_committee($1,$2) AS ok`, [T, me])) as { ok: boolean }[])[0]?.ok;
    const can = async (action: Parameters<typeof requireAction>[1]) => { try { await requireAction(me, action); return true; } catch { return false; } };
    const [isAdmin, isFaculty] = await Promise.all([can('member.manage'), can('grade.write')]);
    let result: unknown = null;

    if (input.action === 'setCommittee') {
      if (!isAdmin) forbid('Only administrators manage the curriculum committee.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(((await sql.query(`SELECT cur_set_committee($1,$2,$3,$4) AS e`, [me, T, uid, input.on])) as { e: string | null }[])[0].e);
      await audit(a, input.on ? 'Curriculum committee member added' : 'Curriculum committee member removed', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'submit') {
      if (!isFaculty) forbid('Only faculty propose courses.');
      const out = ((await sql.query(`SELECT cur_submit($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::jsonb,$11::jsonb,$12,$13) AS r`, [T, input.requestKey, me, input.departmentId, input.code, input.title, input.credits,
        input.description, input.prereqs, JSON.stringify(input.outcomes), JSON.stringify(input.syllabus), input.effectiveTerm, input.rationale])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') {
        await audit(a, 'Course proposal submitted', `courseProposal:${id}`, `${input.code} for ${input.effectiveTerm}`, 'Faculty');
        const chair = ((await sql.query(`SELECT chair_id FROM inst_departments WHERE id = $1`, [input.departmentId])) as Row[])[0]?.chair_id;
        if (chair) await zite.messages.create({ record: { body: 'A course proposal is waiting for your review in Semester (Curriculum).', sender: me, recipients: [String(chair)], isNotification: true } as never }).catch(() => undefined);
      }
    }
    if (input.action === 'step') {
      const before = ((await sql.query(`SELECT author_id FROM cur_proposals WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Proposal not found.');
      fail(((await sql.query(`SELECT cur_step($1,$2,$3,$4,$5,$6) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note])) as { e: string | null }[])[0].e);
      await audit(a, `Course proposal: ${input.step}`, `courseProposal:${input.id}`, input.note.slice(0, 200), input.step === 'endorse' ? 'Department chair' : input.step === 'approve' ? 'Curriculum committee' : input.step === 'withdraw' ? 'Faculty' : 'Reviewer');
      if (String(before!.author_id) !== me) await zite.messages.create({ record: { body: 'There is an update to your course proposal in Semester (Curriculum).', sender: me, recipients: [String(before!.author_id)], isNotification: true } as never }).catch(() => undefined);
    }

    const depts = (await sql.query(`SELECT id, name, chair_id FROM inst_departments WHERE tenant_id = $1 AND active ORDER BY name`, [T])) as Row[];
    const chairOf = depts.filter((d) => d.chair_id === me).map((d) => Number(d.id));
    const rows = (await sql.query(`SELECT p.*, d.name AS dept, c.state AS cat_state, c.version AS cat_version FROM cur_proposals p JOIN inst_departments d ON d.id = p.department_id
      LEFT JOIN cat_courses c ON c.id = p.cat_course_id WHERE p.tenant_id = $1 AND (p.author_id = $2 OR p.department_id = ANY($3::bigint[]) OR ($4 AND p.state <> 'submitted'))
      ORDER BY p.updated_at DESC LIMIT 300`, [T, me, chairOf, isCommittee])) as Row[];
    const published = (await sql.query(`SELECT code FROM cur_published($1) ORDER BY code`, [T])) as Row[];
    const committee = isAdmin ? (await sql.query(`SELECT user_id FROM cur_committee WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...rows.map((r) => String(r.author_id)), ...committee.map((c) => String(c.user_id)), ...depts.map((d) => String(d.chair_id ?? '')).filter(Boolean)])]);

    return {
      result, isFaculty, isCommittee, isAdmin, chairOf,
      departments: depts.map((d) => ({ id: Number(d.id), name: String(d.name), chair: d.chair_id ? names[String(d.chair_id)] ?? 'Chair' : null })),
      catalogCodes: published.map((p) => String(p.code)),
      proposals: rows.map((r) => {
        const role = r.author_id === me ? 'author' : chairOf.includes(Number(r.department_id)) ? 'chair' : 'committee';
        const steps = role === 'author' ? (['submitted', 'chair_endorsed'].includes(String(r.state)) ? ['withdraw'] : [])
          : role === 'chair' ? (r.state === 'submitted' ? ['endorse', 'return'] : isCommittee && r.state === 'chair_endorsed' && r.chair_by !== me ? ['approve', 'return'] : [])
          : r.state === 'chair_endorsed' ? ['approve', 'return'] : [];
        return {
          id: Number(r.id), role, steps, author: names[String(r.author_id)] ?? 'Faculty', dept: String(r.dept), code: String(r.code), title: String(r.title), credits: Number(r.credits),
          description: String(r.description), prereqs: r.prereqs as string[], outcomes: r.outcomes as string[], syllabus: r.syllabus, effectiveTerm: String(r.effective_term), rationale: String(r.rationale),
          state: String(r.state), version: Number(r.version), note: String(r.note), updatedAt: iso(r.updated_at),
          catalog: r.cat_state ? { state: String(r.cat_state), version: Number(r.cat_version) } : null,
        };
      }),
      committee: committee.map((c) => ({ name: names[String(c.user_id)] ?? 'Member' })),
    };
  },
});
