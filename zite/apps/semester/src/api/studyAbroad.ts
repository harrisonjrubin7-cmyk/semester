import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { SAB_MIGRATION } from '../lib/sabMigration';
import { openSteps, State, Actor, CHECKLIST } from '../lib/abroadRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of SAB_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const STEPS = ['approve', 'decline', 'propose', 'approve_agreement', 'return_agreement', 'confirm_ready', 'depart', 'come_back', 'reconcile', 'withdraw', 'cancel'] as const;
const NOTE = 'There is an update to your study-abroad application in Semester. Open Study abroad to see it.';
const LineZ = z.object({ hostCourse: z.string().min(2).max(30), hostTitle: z.string().max(160).default(''), homeCode: z.string().min(2).max(20), credits: z.number().positive().max(12) });
const ResultZ = z.object({ credits: z.number().min(0).max(12), grade: z.string().min(1).max(10) });

// Study abroad (role register: Study Abroad Advisor). Advisors are granted by an administrator. Students browse open
// programs, apply, propose a learning agreement and keep a readiness checklist; advisors approve within capacity, approve the
// exact agreement, confirm readiness, record departure, and reconcile returned credit. Students see only their own
// applications. Reconciliation is a record for the registrar; nothing posts to the transcript from here.
export default createEndpoint({
  description: 'Study abroad: programs, applications, learning agreements, travel readiness, returned-credit reconciliation',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('program'), id: z.number().int().nullable().default(null), name: z.string().min(3).max(120), host: z.string().min(2).max(160), country: z.string().min(2).max(80),
      term: z.string().min(2).max(40), capacity: z.number().int().min(1).max(500), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), description: z.string().max(4000).default(''), active: z.boolean() }),
    z.object({ action: z.literal('apply'), requestKey: z.string().min(8).max(100), programId: z.number().int(), statement: z.string().min(50).max(4000) }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(STEPS), expectedVersion: z.number().int(), text: z.string().max(2000).default(''),
      lines: z.array(LineZ).max(12).optional(), results: z.array(ResultZ).max(12).optional() }),
    z.object({ action: z.literal('check'), id: z.number().int(), item: z.enum(CHECKLIST), done: z.boolean() }),
    z.object({ action: z.literal('setAdvisor'), email: z.string().email().max(200), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const isAdvisor = !!((await sql.query(`SELECT sab_is_advisor($1,$2) AS ok`, [T, me])) as { ok: boolean }[])[0]?.ok;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    let result: unknown = null;

    if (input.action === 'setAdvisor') {
      if (!isAdmin) forbid('Only administrators manage study-abroad access.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(((await sql.query(`SELECT sab_set_advisor($1,$2,$3,$4) AS e`, [me, T, uid, input.on])) as { e: string | null }[])[0].e);
      await audit(a, input.on ? 'Study-abroad advisor access granted' : 'Study-abroad advisor access revoked', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'program') {
      fail(((await sql.query(`SELECT sab_program($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11) AS e`, [T, me, input.id, input.name, input.host, input.country, input.term, input.capacity, input.deadline, input.description, input.active])) as { e: string | null }[])[0].e);
      await audit(a, input.id ? 'Study-abroad program updated' : 'Study-abroad program created', `abroadProgram:${input.id ?? input.name}`, `${input.term}, capacity ${input.capacity}`, 'Study-abroad advisor');
    }
    if (input.action === 'apply') {
      const today = new Date().toISOString().slice(0, 10);
      const out = ((await sql.query(`SELECT sab_apply($1,$2,$3,$4,$5,$6::date) AS r`, [T, input.requestKey, me, input.programId, input.statement, today])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, 'Study-abroad application submitted', `abroadApp:${id}`, `program ${input.programId}`, 'Student');
    }
    if (input.action === 'check') {
      fail(((await sql.query(`SELECT sab_check($1,$2,$3,$4,$5) AS e`, [T, input.id, me, input.item, input.done])) as { e: string | null }[])[0].e);
    }
    if (input.action === 'step') {
      const before = ((await sql.query(`SELECT student_id FROM sab_apps WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Application not found.');
      const data = input.step === 'propose' ? JSON.stringify(input.lines ?? []) : input.step === 'reconcile' ? JSON.stringify(input.results ?? []) : null;
      fail(((await sql.query(`SELECT sab_step($1,$2,$3,$4,$5,$6,$7::jsonb) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.text, data])) as { e: string | null }[])[0].e);
      const self = String(before!.student_id) === me;
      await audit(a, `Study-abroad application: ${input.step.replace(/_/g, ' ')}`, `abroadApp:${input.id}`, ['decline', 'return_agreement', 'cancel'].includes(input.step) ? input.text.slice(0, 200) : '', self ? 'Student' : 'Study-abroad advisor');
      if (!self) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(before!.student_id)], isNotification: true } as never }).catch(() => undefined);
    }

    const programs = (await sql.query(`SELECT p.*, (SELECT count(*) FROM sab_apps x WHERE x.program_id = p.id AND x.state IN ('approved','agreed','ready','abroad','returned','reconciled'))::int AS held,
      (SELECT count(*) FROM sab_apps x WHERE x.program_id = p.id AND x.state = 'submitted')::int AS waiting FROM sab_programs p WHERE p.tenant_id = $1 AND (p.active OR $2) ORDER BY p.deadline, p.name`, [T, isAdvisor])) as Row[];
    const pname = Object.fromEntries(programs.map((p) => [String(p.id), `${p.name} · ${p.host}, ${p.country}`]));
    const apps = (await sql.query(`SELECT a.*, sab_hash(a.lines) AS lines_hash, p.name AS pname, p.host AS phost, p.country AS pcountry FROM sab_apps a JOIN sab_programs p ON p.id = a.program_id
      WHERE a.tenant_id = $1 AND (a.student_id = $2 OR $3) ORDER BY a.updated_at DESC LIMIT 500`, [T, me, isAdvisor])) as Row[];
    const advisors = isAdmin ? (await sql.query(`SELECT user_id FROM sab_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...apps.map((x) => String(x.student_id)), ...advisors.map((x) => String(x.user_id))])]);
    const today = new Date().toISOString().slice(0, 10);

    return {
      result, isAdvisor, isAdmin, checklist: CHECKLIST,
      programs: programs.map((p) => ({ id: Number(p.id), name: String(p.name), host: String(p.host), country: String(p.country), term: String(p.term), capacity: Number(p.capacity),
        held: Number(p.held), waiting: Number(p.waiting), deadline: day(p.deadline), description: String(p.description), active: !!p.active, open: !!p.active && (day(p.deadline) ?? '') >= today })),
      applications: apps.map((x) => {
        const actor: Actor = x.student_id === me ? 'student' : 'advisor';
        return {
          id: Number(x.id), mine: x.student_id === me, student: names[String(x.student_id)] ?? 'Student', program: pname[String(x.program_id)] ?? `${x.pname} · ${x.phost}, ${x.pcountry}`,
          term: String(x.term), statement: String(x.statement), state: String(x.state), version: Number(x.version), lines: x.lines as unknown[], linesHash: String(x.lines_hash),
          agreementApproved: !!x.agreement_hash && x.agreement_hash === x.lines_hash, agreementNote: String(x.agreement_note), checklist: x.checklist as Record<string, boolean>,
          results: (x.results as unknown[] | null) ?? null, reason: String(x.reason), updatedAt: iso(x.updated_at), steps: openSteps(String(x.state) as State, actor),
        };
      }),
      advisors: advisors.map((s) => ({ name: names[String(s.user_id)] ?? 'Member' })),
    };
  },
});
