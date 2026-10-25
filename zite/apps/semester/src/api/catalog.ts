import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAccess, requireAction, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureCal } from '../lib/calendarServer';

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Published course catalog and registration rules (lib/catMigration.ts). Everyone reads what is approved; registrars propose and
// a different registrar approves. Applying catalog versions to live sections is a separate activation step, not done here.
export default createEndpoint({
  description: 'Course catalog versions and registration rules: registrars propose, another registrar approves; everyone reads the approved catalog',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('proposeCourse'), code: z.string().min(4).max(20), title: z.string().min(3).max(160), credits: z.number().positive().max(12), description: z.string().min(20).max(4000), prerequisites: z.string().max(300), effectiveTerm: z.string().min(3).max(40), retire: z.boolean() }),
    z.object({ action: z.literal('proposeRules'), maxCredits: z.number().min(1).max(30), note: z.string().max(300) }),
    z.object({ action: z.literal('decide'), kind: z.enum(['course', 'rules']), id: z.number().int(), approve: z.boolean(), note: z.string().max(300) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureCal();
    const sql = pg();
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    const one = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    if (input.action !== 'get') {
      const a = await requireAction(context.user.id, 'registration.request.decide');
      if (input.action === 'proposeCourse') {
        await one(`SELECT cat_propose_course($1,$2,$3,$4,$5,$6,$7,$8,$9) AS e`, [a.userId, a.institutionId, input.code, input.title, input.credits, input.description, input.prerequisites, input.effectiveTerm, input.retire]);
        await audit(a, 'Catalog change proposed', `course:${input.code}`, input.effectiveTerm, 'Registrar');
      } else if (input.action === 'proposeRules') {
        await one(`SELECT cat_propose_rules($1,$2,$3,$4) AS e`, [a.userId, a.institutionId, input.maxCredits, input.note]);
        await audit(a, 'Registration rules proposed', 'rules', `max ${input.maxCredits}`, 'Registrar');
      } else {
        await one(`SELECT cat_decide($1,$2,$3,$4,$5,$6) AS e`, [a.userId, a.institutionId, input.kind, input.id, input.approve, input.note]);
        await audit(a, `${input.kind === 'course' ? 'Catalog change' : 'Registration rules'} ${input.approve ? 'approved' : 'rejected'}`, `${input.kind}:${input.id}`, input.note, 'Registrar');
      }
    }
    const a = await requireAccess(context.user.id);
    let canEdit = false;
    try { await requireAction(context.user.id, 'registration.request.decide'); canEdit = true; } catch { canEdit = false; }
    const [courses, rules] = await Promise.all([
      sql.query(`SELECT * FROM cat_courses WHERE tenant_id = $1 ORDER BY code, version DESC`, [a.institutionId]) as Promise<Row[]>,
      sql.query(`SELECT * FROM cat_rules WHERE tenant_id = $1 ORDER BY version DESC`, [a.institutionId]) as Promise<Row[]>,
    ]);
    const names = canEdit ? await userNames([...courses, ...rules].flatMap((r) => [String(r.proposed_by), String(r.decided_by ?? '')])) : {};
    const who = (r: Row) => canEdit ? { proposedBy: names[String(r.proposed_by)] ?? 'Registrar', decidedBy: r.decided_by ? names[String(r.decided_by)] ?? 'Registrar' : null, decisionNote: (r.decision_note as string) ?? '', mine: r.proposed_by === a.userId, decidedAt: iso(r.decided_at) } : {};
    const c = (r: Row) => ({ id: Number(r.id), code: String(r.code), version: Number(r.version), title: String(r.title), credits: Number(r.credits), description: String(r.description), prerequisites: String(r.prerequisites), effectiveTerm: String(r.effective_term), retire: !!r.retire, state: String(r.state), ...who(r) });
    const ru = (r: Row) => ({ id: Number(r.id), version: Number(r.version), maxCredits: Number(r.max_credits), note: String(r.overload_note), state: String(r.state), ...who(r) });
    return {
      canEdit,
      catalog: courses.filter((r) => r.state === 'approved' && !r.retire).map(c),
      retired: courses.filter((r) => r.state === 'approved' && r.retire).map(c),
      rules: rules.filter((r) => r.state === 'approved').map(ru)[0] ?? null,
      pendingCourses: canEdit ? courses.filter((r) => r.state === 'proposed').map(c) : [],
      pendingRules: canEdit ? rules.filter((r) => r.state === 'proposed').map(ru) : [],
      history: canEdit ? [...courses.filter((r) => ['superseded', 'rejected'].includes(String(r.state))).map((r) => ({ kind: 'course', ...c(r) })), ...rules.filter((r) => ['superseded', 'rejected'].includes(String(r.state))).map((r) => ({ kind: 'rules', ...ru(r) }))] : [],
    };
  },
});
