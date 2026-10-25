import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { TRF_MIGRATION } from '../lib/trfMigration';

let ready: Promise<void> | null = null;
const ensureTrf = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of TRF_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toUpperCase();
const Decision = z.object({ line: z.number().int(), outcome: z.enum(['equivalent', 'elective', 'no_credit']), code: z.string().max(20).optional(), credits: z.number().positive().max(12).optional(), reason: z.string().max(300) });

// Transfer credit (lib/trfMigration.ts). Students see their own requests and the approved articulation rules; registrars
// (capability checked on the server) evaluate, review appeals and manage rules. Nothing here posts to the official transcript.
export default createEndpoint({
  description: 'Transfer credit: students list prior courses, registrars evaluate with published articulation rules, one appeal to a different evaluator',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('submit'), id: z.string().min(8).max(80), institution: z.string().min(3).max(160),
      lines: z.array(z.object({ course: z.string().min(3).max(30), title: z.string().max(160), credits: z.number().positive().max(12), grade: z.string().max(10), suggestion: z.string().max(20) })).min(1).max(30) }),
    z.object({ action: z.literal('appeal'), id: z.string(), text: z.string().min(20).max(2000) }),
    z.object({ action: z.literal('evaluate'), id: z.string(), version: z.number().int(), decisions: z.array(Decision).max(30) }),
    z.object({ action: z.literal('reviewAppeal'), id: z.string(), version: z.number().int(), decisions: z.array(Decision).max(30), note: z.string().min(10).max(1000) }),
    z.object({ action: z.literal('proposeRule'), institution: z.string().min(3).max(160), course: z.string().min(3).max(30), outcome: z.enum(['equivalent', 'elective', 'no_credit']), code: z.string().max(20), credits: z.number().positive().max(12).nullable(), term: z.string().min(3).max(40) }),
    z.object({ action: z.literal('decideRule'), id: z.number().int(), approve: z.boolean(), note: z.string().max(300) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureTrf();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    const one = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    let isRegistrar = false;
    try { await requireAction(context.user.id, 'registration.request.decide'); isRegistrar = true; } catch { isRegistrar = false; }
    const registrarOnly = () => { if (!isRegistrar) fail('Only registrars can do this.'); };
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: uid, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    const studentOf = async (id: string) => String(((await sql.query(`SELECT student_id FROM trf_requests WHERE id = $1`, [id])) as Row[])[0]?.student_id ?? '');

    switch (input.action) {
      case 'submit': await one(`SELECT trf_submit($1,$2,$3,$4,$5::jsonb) AS e`, [uid, T, input.id, input.institution, JSON.stringify(input.lines)]); await audit(a, 'Transfer evaluation requested', `transfer:${input.id}`, input.institution, 'Owner'); break;
      case 'appeal': await one(`SELECT trf_appeal($1,$2,$3,$4) AS e`, [uid, T, input.id, input.text]); await audit(a, 'Transfer evaluation appealed', `transfer:${input.id}`, '', 'Owner'); break;
      case 'evaluate': registrarOnly(); await one(`SELECT trf_evaluate($1,$2,$3,$4,$5::jsonb) AS e`, [uid, T, input.id, input.version, JSON.stringify(input.decisions)]);
        await notify(await studentOf(input.id), 'Your transfer credit evaluation is ready.'); await audit(a, 'Transfer evaluation decided', `transfer:${input.id}`, '', 'Registrar'); break;
      case 'reviewAppeal': registrarOnly(); await one(`SELECT trf_review_appeal($1,$2,$3,$4,$5::jsonb,$6) AS e`, [uid, T, input.id, input.version, JSON.stringify(input.decisions), input.note]);
        await notify(await studentOf(input.id), 'Your transfer credit appeal has an answer.'); await audit(a, 'Transfer appeal reviewed', `transfer:${input.id}`, '', 'Registrar'); break;
      case 'proposeRule': registrarOnly(); await one(`SELECT trf_propose_rule($1,$2,$3,$4,$5,$6,$7,$8) AS e`, [uid, T, input.institution, input.course, input.outcome, input.code || null, input.credits, input.term]);
        await audit(a, 'Articulation rule proposed', `rule:${input.institution} ${input.course}`, input.outcome, 'Registrar'); break;
      case 'decideRule': registrarOnly(); await one(`SELECT trf_decide_rule($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.approve, input.note]);
        await audit(a, input.approve ? 'Articulation rule approved' : 'Articulation rule rejected', `rule:${input.id}`, input.note, 'Registrar'); break;
    }

    const rules = (await sql.query(`SELECT * FROM trf_rules WHERE tenant_id = $1 AND state IN ('approved','proposed') ORDER BY ext_institution, ext_course`, [T])) as Row[];
    const approved = rules.filter((r) => r.state === 'approved');
    const match = (inst: string, course: string) => approved.find((r) => norm(String(r.ext_institution)) === norm(inst) && String(r.ext_course) === norm(course));
    const rv = (r: Row) => ({ id: Number(r.id), institution: String(r.ext_institution), course: String(r.ext_course), outcome: String(r.outcome), code: (r.internal_code as string) ?? null, credits: r.credits == null ? null : Number(r.credits), term: String(r.effective_term), state: String(r.state), mine: r.proposed_by === uid });
    const loadLines = async (ids: string[]) => ids.length ? (await sql.query(`SELECT * FROM trf_lines WHERE request_id = ANY($1) ORDER BY line`, [ids])) as Row[] : [];
    const view = (q: Row, lines: Row[]) => ({ id: String(q.id), number: Number(q.number), institution: String(q.ext_institution), state: String(q.state), version: Number(q.version), createdAt: iso(q.created_at),
      appealText: (q.appeal_text as string) ?? null, appealNote: (q.appeal_note as string) ?? null,
      lines: lines.filter((l) => l.request_id === q.id).map((l) => { const m = match(String(q.ext_institution), String(l.ext_course));
        return { line: Number(l.line), course: String(l.ext_course), title: String(l.ext_title), credits: Number(l.ext_credits), grade: String(l.grade), suggestion: (l.student_suggestion as string) ?? null,
          outcome: (l.outcome as string) ?? null, code: (l.internal_code as string) ?? null, awarded: l.awarded_credits == null ? null : Number(l.awarded_credits), reason: (l.reason as string) ?? null,
          rule: m ? { outcome: String(m.outcome), code: (m.internal_code as string) ?? null } : null }; }) });
    const mine = (await sql.query(`SELECT * FROM trf_requests WHERE tenant_id = $1 AND student_id = $2 ORDER BY number DESC`, [T, uid])) as Row[];
    const out: Record<string, unknown> = { isRegistrar, rules: approved.map(rv), mine: mine.map((q) => ({ ...view(q, []), lines: [] as unknown[] })) };
    const myLines = await loadLines(mine.map((q) => String(q.id)));
    out.mine = mine.map((q) => view(q, myLines));
    if (isRegistrar) {
      const queue = (await sql.query(`SELECT * FROM trf_requests WHERE tenant_id = $1 AND state IN ('submitted','appealed') AND student_id <> $2 ORDER BY number`, [T, uid])) as Row[];
      const ql = await loadLines(queue.map((q) => String(q.id)));
      const names = await userNames(queue.map((q) => String(q.student_id)));
      out.queue = queue.map((q) => ({ ...view(q, ql), student: names[String(q.student_id)] ?? 'Student', evaluatedByMe: q.evaluator_id === uid }));
      out.pendingRules = rules.filter((r) => r.state === 'proposed').map(rv);
    }
    return out;
  },
});
