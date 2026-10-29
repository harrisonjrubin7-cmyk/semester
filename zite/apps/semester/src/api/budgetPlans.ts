import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PRC_MIGRATION } from '../lib/prcMigration';
import { BDG_MIGRATION } from '../lib/bdgMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...PRC_MIGRATION, ...BDG_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const CENTS = z.number().int().min(0).max(1_000_000_000_00);

// E11 Budget and Planning: fiscal-year plans of quarterly amounts per budget code, written by
// planners and approved by a different approver; variance reads the approved plan against
// procurement commitments (prc_used). Rules: lib/bdgMigration.ts.
export default createEndpoint({
  description: 'Fiscal-year budget plans: planner drafts, approver decisions, and variance against procurement commitments',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), role: z.enum(['planner', 'approver']), on: z.boolean() }),
    z.object({ action: z.literal('create'), fy: z.number().int().min(2020).max(2100), name: z.string().min(3).max(120) }),
    z.object({ action: z.literal('setLine'), planId: z.number().int(), code: z.string().min(2).max(20), label: z.string().min(2).max(120), q1: CENTS, q2: CENTS, q3: CENTS, q4: CENTS }),
    z.object({ action: z.literal('removeLine'), planId: z.number().int(), code: z.string().min(2).max(20) }),
    z.object({ action: z.literal('propose'), planId: z.number().int() }),
    z.object({ action: z.literal('decide'), planId: z.number().int(), approve: z.boolean(), note: z.string().max(500).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage budget-planning roles.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT bdg_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
      await audit(a, `Budget ${input.role} ${input.on ? 'granted' : 'revoked'}`, `bdg_staff:${uid}`, input.role, 'Administrator');
    }
    if (input.action === 'create') {
      const out = await one(`SELECT bdg_create($1,$2,$3,$4) AS r`, [me, T, input.fy, input.name]);
      if (!out || !out.startsWith('ok:')) forbid(out ?? 'Failed.');
      const newId = Number(out!.split(':')[1]);
      result = { planId: newId };
      await audit(a, 'Budget plan created', `bdg_plan:${newId}`, `${input.fy} · ${input.name}`, 'Budget planner');
    }
    if (input.action === 'setLine') fail(await one(`SELECT bdg_set_line($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [me, T, input.planId, input.code, input.label, input.q1, input.q2, input.q3, input.q4]));
    if (input.action === 'removeLine') fail(await one(`SELECT bdg_remove_line($1,$2,$3,$4) AS r`, [me, T, input.planId, input.code]));
    if (input.action === 'propose') { fail(await one(`SELECT bdg_propose($1,$2,$3) AS r`, [me, T, input.planId])); await audit(a, 'Budget plan proposed', `bdg_plan:${input.planId}`, '', 'Budget planner'); }
    if (input.action === 'decide') { fail(await one(`SELECT bdg_decide($1,$2,$3,$4,$5) AS r`, [me, T, input.planId, input.approve, input.note])); await audit(a, `Budget plan ${input.approve ? 'approved' : 'sent back'}`, `bdg_plan:${input.planId}`, input.note.slice(0, 200), 'Budget approver'); }

    const roles = ((await sql.query(`SELECT role FROM bdg_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => String(r.role));
    const [plans, lines, codes, staff] = await Promise.all([
      sql.query(`SELECT * FROM bdg_plans WHERE tenant_id = $1 ORDER BY fiscal_year DESC, version DESC LIMIT 60`, [T]),
      sql.query(`SELECT l.*, CASE WHEN p.state = 'approved' THEN prc_used($1, l.code) ELSE NULL END AS committed
        FROM bdg_lines l JOIN bdg_plans p ON p.id = l.plan_id WHERE p.tenant_id = $1 ORDER BY l.code`, [T]),
      sql.query(`SELECT code, name FROM prc_budgets WHERE tenant_id = $1 ORDER BY code`, [T]),
      sql.query(`SELECT user_id, role FROM bdg_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY role, granted_at`, [T]),
    ]) as [Row[], Row[], Row[], Row[]];
    const names = await userNames([...plans.flatMap((p) => [p.created_by, p.approved_by]), ...staff.map((s) => s.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const lineOf = (l: Row) => ({ code: String(l.code), label: String(l.label), q1: Number(l.q1), q2: Number(l.q2), q3: Number(l.q3), q4: Number(l.q4),
      total: Number(l.q1) + Number(l.q2) + Number(l.q3) + Number(l.q4), committed: l.committed === null || l.committed === undefined ? null : Number(l.committed) });
    return {
      result, isAdmin, isPlanner: roles.includes('planner'), isApprover: roles.includes('approver'), institutionName: a.institutionName ?? null,
      budgetCodes: codes.map((c) => ({ code: String(c.code), name: String(c.name) })),
      staff: staff.map((s) => ({ name: nm(s.user_id), role: String(s.role), me: s.user_id === me })),
      plans: plans.map((p) => ({ id: Number(p.id), fy: Number(p.fiscal_year), name: String(p.name), state: String(p.state), version: Number(p.version),
        createdBy: nm(p.created_by), createdByMe: p.created_by === me, approvedBy: nm(p.approved_by), approvedAt: iso(p.approved_at), decisionNote: String(p.decision_note),
        lines: lines.filter((l) => String(l.plan_id) === String(p.id)).map(lineOf) })),
    };
  },
});
