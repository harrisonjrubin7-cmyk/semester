import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { DFM_MIGRATION } from '../lib/dfmMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...SREQ_MIGRATION, ...DFM_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const STAFF_ROLES = ['Staff', 'Administrator', 'Faculty', 'Advisor', 'Tutor', 'Registrar'];
const Field = z.object({ key: z.string().max(40), label: z.string().max(200), type: z.enum(['text', 'longtext', 'choice', 'date']), required: z.boolean().optional(), options: z.array(z.string().max(100)).max(20).optional() });

// Department forms (role app "Department Admin": forms). Institution and roles come from requireAccess; every rule is in lib/dfmMigration.ts.
export default createEndpoint({
  description: 'Department forms: admins build forms, the chair or another admin approves them, people respond, the department reviews',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setAdmin'), departmentId: z.number().int(), email: z.string().email().max(200), active: z.boolean() }),
    z.object({ action: z.literal('form'), step: z.enum(['draft', 'edit', 'submit', 'approve', 'return', 'close', 'copy']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      departmentId: z.number().int().optional(), title: z.string().max(140).optional(), instructions: z.string().max(2000).optional(), fields: z.array(Field).max(25).optional(),
      audience: z.enum(['students', 'staff', 'everyone']).optional(), seenHash: z.string().max(64).optional(), note: z.string().max(1000).default('') }),
    z.object({ action: z.literal('respond'), formId: z.number().int(), requestKey: z.string().min(8).max(100), answers: z.record(z.string().max(4000)) }),
    z.object({ action: z.literal('review'), id: z.number().int(), expectedVersion: z.number().int(), step: z.enum(['accept', 'return', 'decline']), note: z.string().max(1000).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const isStudent = a.roles.includes('Student'), isStaff = a.roles.some((r) => STAFF_ROLES.includes(r));
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;

    if (input.action === 'setAdmin') {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      const r = await one(`SELECT dfm_set_admin($1,$2,$3,$4,$5,$6) AS r`, [me, isAdmin, T, input.departmentId, uid, input.active]);
      if (r) forbid(r);
      await audit(a, 'Department admin changed', `user:${uid}`, `department ${input.departmentId}: ${input.active ? 'admin' : 'revoked'}`, 'Administrator');
    }
    if (input.action === 'form') {
      const r = await one(`SELECT dfm_form($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.departmentId ?? null, input.title ?? null, input.instructions ?? null, input.fields ? JSON.stringify(input.fields) : null, input.audience ?? null, input.seenHash ?? null, input.note]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save the form.');
      if (input.step === 'approve' || input.step === 'close') await audit(a, `Department form ${input.step}`, `departmentForm:${r!.slice(3)}`, '', 'Department');
    }
    if (input.action === 'respond') {
      const r = await one(`SELECT dfm_respond($1,$2,$3,$4,$5,$6,$7::jsonb) AS r`, [T, me, isStudent, isStaff, input.formId, input.requestKey, JSON.stringify(input.answers)]);
      if (!r || !(r.startsWith('ok:') || r.startsWith('replay:'))) forbid(r ?? 'Could not send it.');
    }
    if (input.action === 'review') {
      const r = await one(`SELECT dfm_review($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.id, input.expectedVersion, input.step, input.note]);
      if (r) forbid(r);
    }

    const depts = (await sql.query(`SELECT id, name, chair_id FROM inst_departments WHERE tenant_id = $1 AND active ORDER BY name`, [T])) as Row[];
    const adminOf = new Set(((await sql.query(`SELECT department_id FROM dfm_admins WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => Number(r.department_id)));
    const chairOf = new Set(depts.filter((d) => String(d.chair_id ?? '') === me).map((d) => Number(d.id)));
    const mine = [...new Set([...adminOf, ...chairOf])];
    const forms = (await sql.query(`SELECT *, dfm_hash(title, instructions, fields, audience) AS seen FROM dfm_forms WHERE tenant_id = $1 AND (state = 'open' OR department_id = ANY($2::bigint[])) ORDER BY updated_at DESC LIMIT 200`, [T, mine])) as Row[];
    const responses = (await sql.query(`SELECT r.* FROM dfm_responses r JOIN dfm_forms f ON f.id = r.form_id WHERE r.tenant_id = $1 AND (r.respondent_id = $2 OR f.department_id = ANY($3::bigint[])) ORDER BY r.updated_at DESC LIMIT 500`, [T, me, mine])) as Row[];
    const admins = isAdmin ? ((await sql.query(`SELECT department_id, user_id FROM dfm_admins WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]) : [];
    const names = await userNames([...responses.map((r) => String(r.respondent_id)), ...forms.map((f) => String(f.author_id)), ...admins.map((x) => String(x.user_id))]);
    const deptName = new Map(depts.map((d) => [Number(d.id), String(d.name)]));
    const canAnswer = (aud: string) => aud === 'everyone' || (aud === 'students' && isStudent) || (aud === 'staff' && isStaff);
    return {
      me, isAdmin,
      departments: depts.map((d) => ({ id: Number(d.id), name: String(d.name), admin: adminOf.has(Number(d.id)), chair: chairOf.has(Number(d.id)), admins: admins.filter((x) => Number(x.department_id) === Number(d.id)).map((x) => names[String(x.user_id)] ?? 'Member') })),
      forms: forms.map((f) => {
        const dept = Number(f.department_id), manage = mine.includes(dept);
        return { id: Number(f.id), departmentId: dept, department: deptName.get(dept) ?? '', title: String(f.title), instructions: String(f.instructions), fields: f.fields, audience: String(f.audience), state: String(f.state), version: Number(f.version), seenHash: String(f.seen), mine: String(f.author_id) === me, author: names[String(f.author_id)] ?? 'Staff', manage, canAnswer: String(f.state) === 'open' && canAnswer(String(f.audience)) };
      }).filter((f) => f.manage || f.canAnswer),
      responses: responses.map((r) => ({ id: Number(r.id), formId: Number(r.form_id), mine: String(r.respondent_id) === me, respondent: String(r.respondent_id) === me ? 'You' : names[String(r.respondent_id)] ?? 'Member', answers: r.answers, state: String(r.state), note: String(r.note), version: Number(r.version), at: iso(r.updated_at) })),
    };
  },
});
