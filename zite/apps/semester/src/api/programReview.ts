import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAccess, requireAction, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureCal } from '../lib/calendarServer';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { CUR_MIGRATION } from '../lib/curMigration';
import { PRG_MIGRATION } from '../lib/prgMigration';
import { TCP_MIGRATION } from '../lib/tcpMigration';
import { DEA_MIGRATION } from '../lib/deaMigration';
import { PRW_MIGRATION, PRW_SECTIONS } from '../lib/prwMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureCal(); for (const q of [...SREQ_MIGRATION, ...CUR_MIGRATION, ...PRG_MIGRATION, ...TCP_MIGRATION, ...DEA_MIGRATION, ...PRW_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const Action = z.object({ action: z.string().max(400), finding: z.number().int().min(0).max(19), owner: z.string().max(120), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// Periodic program review: open (dean) -> self-study (chair) -> external reviewer and report (dean) -> action plan (chair)
// -> plan decision (another dean) -> tracked actions -> close. Rules live in prw_step (lib/prwMigration.ts).
export default createEndpoint({
  description: 'Periodic program review: self-study, external reviewer report, action plan and tracked follow-up',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('open'), code: z.string().max(24), cycle: z.string().regex(/^\d{4}-\d{2}$/), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.object({ action: z.literal('step'), id: z.number().int(), expectedVersion: z.number().int(),
      step: z.enum(['save_self_study', 'submit_self_study', 'set_reviewer', 'record_report', 'save_plan', 'submit_plan', 'approve_plan', 'return_plan', 'action_done', 'close', 'cancel']),
      sections: z.record(z.enum(PRW_SECTIONS), z.string().max(20000)).optional(), name: z.string().max(160).optional(), affiliation: z.string().max(200).optional(), noConflict: z.boolean().optional(),
      report: z.string().max(40000).optional(), findings: z.array(z.string().max(1000)).max(20).optional(), recommendation: z.enum(['continue', 'continue_with_conditions', 'revise', 'consider_closure']).optional(),
      plan: z.array(Action).max(40).optional(), seen: z.string().max(64).optional(), idx: z.number().int().min(0).max(39).optional(), note: z.string().max(4000).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const step = async (st: string, id: number | null, ev: number | null, payload: Record<string, unknown>) => {
      const r = ((await sql.query(`SELECT prw_step($1,$2,$3,$4,$5,$6::jsonb) AS r`, [T, me, st, id, ev, JSON.stringify(payload)])) as { r: string | null }[])[0].r;
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
      return r!.slice(3);
    };
    if (input.action === 'open') {
      const id = await step('open', null, null, { code: input.code, cycle: input.cycle, due: input.due });
      await audit(a, 'Program review opened', `programReview:${id}`, `${input.code} ${input.cycle}`, 'Dean');
    }
    if (input.action === 'step') {
      const { action: _a, id, expectedVersion, step: st, ...payload } = input;
      await step(st, id, expectedVersion, payload);
      if (['record_report', 'approve_plan', 'return_plan', 'close', 'cancel'].includes(st)) await audit(a, `Program review ${st.replace('_', ' ')}`, `programReview:${id}`, input.note ?? '', 'Dean');
    }

    const covered = ((await sql.query(`SELECT id FROM inst_departments WHERE tenant_id = $1 AND active AND dea_covers($1, $2, id)`, [T, me])) as Row[]).map((r) => Number(r.id));
    const chairOf = ((await sql.query(`SELECT id FROM inst_departments WHERE tenant_id = $1 AND active AND chair_id = $2`, [T, me])) as Row[]).map((r) => Number(r.id));
    if (!isAdmin && !covered.length && !chairOf.length) forbid('Program review is for deans, department chairs and institution administrators.');
    const visible = [...new Set([...covered, ...chairOf])];
    const [reviews, actions, openable] = await Promise.all([
      sql.query(`SELECT r.*, p.name AS program_name, d.name AS dept_name FROM prw_reviews r JOIN prg_programs p ON p.id = r.program_id JOIN inst_departments d ON d.id = r.dept_id
        WHERE r.tenant_id = $1 AND (r.dept_id = ANY($2::bigint[]) OR $3) ORDER BY r.state IN ('closed', 'cancelled'), r.updated_at DESC LIMIT 100`, [T, visible, isAdmin]) as Promise<Row[]>,
      sql.query(`SELECT a.* FROM prw_actions a JOIN prw_reviews r ON r.id = a.review_id WHERE r.tenant_id = $1 AND (r.dept_id = ANY($2::bigint[]) OR $3) ORDER BY a.review_id, a.idx`, [T, visible, isAdmin]) as Promise<Row[]>,
      sql.query(`SELECT p.code, p.name, d.name AS dept FROM prg_programs p JOIN inst_departments d ON d.id = p.department_id WHERE p.tenant_id = $1 AND p.state = 'published' AND p.department_id = ANY($2::bigint[])
        AND NOT EXISTS (SELECT 1 FROM prw_reviews r WHERE r.tenant_id = p.tenant_id AND r.program_code = p.code AND r.state NOT IN ('closed', 'cancelled')) ORDER BY p.code`, [T, covered]) as Promise<Row[]>,
    ]);
    const names = await userNames(reviews.flatMap((r) => [r.opened_by, r.self_study_by, r.report_by, r.plan_by, r.plan_decided_by, r.closed_by].map((x) => String(x ?? ''))).filter(Boolean));
    const nm = (id: unknown) => (id ? names[String(id)] ?? 'Member' : null);
    const today = new Date().toISOString().slice(0, 10);
    return {
      me, isAdmin, sections: PRW_SECTIONS, openable: openable.map((p) => ({ code: String(p.code), name: String(p.name), dept: String(p.dept) })),
      reviews: reviews.map((r) => {
        const dept = Number(r.dept_id);
        return { id: Number(r.id), code: String(r.program_code), program: String(r.program_name), dept: String(r.dept_name), cycle: String(r.cycle), due: String(r.self_study_due).slice(0, 10), state: String(r.state), rev: Number(r.rev),
          isChair: chairOf.includes(dept), isDean: covered.includes(dept), selfStudy: (r.self_study ?? {}) as Record<string, string>, selfStudyBy: nm(r.self_study_by), selfStudyAt: iso(r.self_study_at),
          reviewer: r.reviewer_name ? { name: String(r.reviewer_name), affiliation: String(r.reviewer_affiliation ?? ''), noConflict: Boolean(r.reviewer_no_conflict) } : null,
          report: r.report ? String(r.report) : null, findings: (r.findings as string[] | null) ?? [], recommendation: r.recommendation ? String(r.recommendation) : null, reportBy: nm(r.report_by),
          plan: (r.plan as z.infer<typeof Action>[] | null) ?? [], planHash: r.plan_hash ? String(r.plan_hash) : null, planBy: nm(r.plan_by), planMine: r.plan_by === me, planDecidedBy: nm(r.plan_decided_by), planNote: String(r.plan_note),
          closeNote: String(r.close_note), openedBy: nm(r.opened_by), closedBy: nm(r.closed_by),
          actions: actions.filter((x) => Number(x.review_id) === Number(r.id)).map((x) => ({ idx: Number(x.idx), action: String(x.action), finding: Number(x.finding), owner: String(x.owner), due: String(x.due).slice(0, 10),
            done: Boolean(x.done_at), doneNote: x.done_note ? String(x.done_note) : null, overdue: !x.done_at && String(x.due).slice(0, 10) < today })) };
      }),
    };
  },
});
