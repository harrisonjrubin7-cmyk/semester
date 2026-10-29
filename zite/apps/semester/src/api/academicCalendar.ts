import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAccess, requireAction, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureCal } from '../lib/calendarServer';

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);

// Academic calendar (lib/calMigration.ts). Everyone in the institution reads the effective calendar; registrars propose and a
// different registrar approves. Capability is checked on the server; the tenant comes from the caller's membership.
export default createEndpoint({
  description: 'Academic calendar: effective term dates and registration windows; registrars propose, another registrar approves',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('propose'), term: z.string().min(3).max(40), regOpens: z.string(), regCloses: z.string(), addDropEnds: z.string(), classesStart: z.string(), classesEnd: z.string(), note: z.string().max(300) }),
    z.object({ action: z.literal('decide'), id: z.number().int(), approve: z.boolean(), note: z.string().max(300) }),
    z.object({ action: z.literal('complete'), term: z.string().min(3).max(40), note: z.string().max(300) }),
    z.object({ action: z.literal('archive'), term: z.string().min(3).max(40), note: z.string().max(300) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureCal();
    const sql = pg();
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    if (input.action !== 'get') {
      const a = await requireAction(context.user.id, 'registration.request.decide');
      if (input.action === 'propose') {
        fail(((await sql.query(`SELECT cal_propose($1,$2,$3,$4,$5,$6,$7,$8,$9) AS e`, [a.userId, a.institutionId, input.term, input.regOpens, input.regCloses, input.addDropEnds, input.classesStart, input.classesEnd, input.note])) as { e: string | null }[])[0].e);
        await audit(a, 'Term calendar proposed', `term:${input.term}`, input.note, 'Registrar');
      } else if (input.action === 'decide') {
        fail(((await sql.query(`SELECT cal_decide($1,$2,$3,$4,$5) AS e`, [a.userId, a.institutionId, input.id, input.approve, input.note])) as { e: string | null }[])[0].e);
        await audit(a, input.approve ? 'Term calendar approved' : 'Term calendar rejected', `termCalendar:${input.id}`, input.note, 'Registrar');
      } else if (input.action === 'complete') {
        fail(((await sql.query(`SELECT term_complete($1,$2,$3,$4) AS e`, [a.userId, a.institutionId, input.term, input.note])) as { e: string | null }[])[0].e);
        await audit(a, 'Term completed', `term:${input.term}`, input.note, 'Registrar');
      } else {
        fail(((await sql.query(`SELECT term_archive($1,$2,$3,$4) AS e`, [a.userId, a.institutionId, input.term, input.note])) as { e: string | null }[])[0].e);
        await audit(a, 'Term archived', `term:${input.term}`, input.note, 'Registrar');
      }
    }
    const a = await requireAccess(context.user.id);
    let canEdit = false;
    try { await requireAction(context.user.id, 'registration.request.decide'); canEdit = true; } catch { canEdit = false; }
    const rows = (await sql.query(`SELECT *, CASE WHEN now() < reg_opens THEN 'not_yet' WHEN now() > reg_closes THEN 'closed' ELSE 'open' END AS win FROM cal_terms WHERE tenant_id = $1 ORDER BY term, version DESC`, [a.institutionId])) as Row[];
    const life = (await sql.query(`SELECT term, state, completed_by, completed_at, archived_by, archived_at FROM term_lifecycle WHERE tenant_id = $1`, [a.institutionId])) as Row[];
    const lifeByTerm = Object.fromEntries(life.map((l) => [String(l.term), l]));
    const names = canEdit ? await userNames([...rows.flatMap((r) => [String(r.proposed_by), String(r.decided_by ?? '')]), ...life.flatMap((l) => [String(l.completed_by), String(l.archived_by ?? '')])]) : {};
    const view = (r: Row) => ({ id: Number(r.id), term: String(r.term), version: Number(r.version), state: String(r.state), regOpens: iso(r.reg_opens), regCloses: iso(r.reg_closes),
      addDropEnds: day(r.add_drop_ends), classesStart: day(r.classes_start), classesEnd: day(r.classes_end), note: String(r.note ?? ''), window: String(r.win), lifeState: String(lifeByTerm[String(r.term)]?.state ?? 'open'),
      ...(canEdit ? { proposedBy: names[String(r.proposed_by)] ?? 'Registrar', decidedBy: r.decided_by ? names[String(r.decided_by)] ?? 'Registrar' : null, decisionNote: (r.decision_note as string) ?? '', mine: r.proposed_by === a.userId, decidedAt: iso(r.decided_at),
        completedBy: lifeByTerm[String(r.term)]?.completed_by ? names[String(lifeByTerm[String(r.term)].completed_by)] ?? 'Registrar' : null,
        completedAt: iso(lifeByTerm[String(r.term)]?.completed_at), archivedAt: iso(lifeByTerm[String(r.term)]?.archived_at) } : {}) });
    return {
      canEdit,
      effective: rows.filter((r) => r.state === 'approved').map(view),
      pending: canEdit ? rows.filter((r) => r.state === 'proposed').map(view) : [],
      history: canEdit ? rows.filter((r) => ['superseded', 'rejected'].includes(String(r.state))).map(view) : [],
    };
  },
});
