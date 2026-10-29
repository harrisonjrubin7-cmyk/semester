import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { DFM_MIGRATION } from '../lib/dfmMigration';
import { DST_MIGRATION } from '../lib/dstMigration';
import { TCP_MIGRATION } from '../lib/tcpMigration';
import { DEA_MIGRATION } from '../lib/deaMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...SREQ_MIGRATION, ...DFM_MIGRATION, ...DST_MIGRATION, ...TCP_MIGRATION, ...DEA_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const Goals = z.array(z.object({ goal: z.string().max(400), measure: z.string().max(200) })).max(12);
const Year = z.string().regex(/^\d{4}-\d{2}$/);

// Deans and chairs: college and department plans, department health, resources against an allocation, escalations, and
// college governance. Rules live in dea_* (lib/deaMigration.ts); this endpoint resolves the actor and institution.
export default createEndpoint({
  description: 'Deans and chairs: college and department plans, department health, resource requests, escalations and college motions',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setDean'), unitId: z.number().int(), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('allocate'), unitId: z.number().int(), year: Year, amountMinor: z.number().int().min(0).max(1e13), reason: z.string().max(500) }),
    z.object({ action: z.literal('plan'), step: z.enum(['draft', 'edit', 'submit', 'approve', 'return']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      level: z.enum(['department', 'college']).optional(), deptId: z.number().int().optional(), unitId: z.number().int().optional(), year: Year.optional(), title: z.string().max(160).optional(), goals: Goals.optional(), seenHash: z.string().max(64).optional(), note: z.string().max(2000).optional() }),
    z.object({ action: z.literal('request'), step: z.enum(['submit', 'withdraw', 'approve', 'decline', 'return']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      deptId: z.number().int().optional(), year: Year.optional(), kind: z.enum(['position', 'budget', 'space', 'equipment']).optional(), amountMinor: z.number().int().min(0).max(1e13).optional(), text: z.string().max(4000).optional() }),
    z.object({ action: z.literal('escalate'), step: z.enum(['raise', 'acknowledge', 'resolve']), id: z.number().int().nullable(), deptId: z.number().int().optional(),
      category: z.enum(['staffing', 'curriculum', 'facilities', 'conduct', 'budget', 'other']).optional(), text: z.string().max(4000).optional() }),
    z.object({ action: z.literal('motion'), step: z.enum(['open', 'vote', 'close', 'withdraw']), id: z.number().int().nullable(), unitId: z.number().int().optional(), title: z.string().max(160).optional(),
      text: z.string().max(8000).optional(), days: z.number().int().optional(), vote: z.enum(['yes', 'no', 'abstain']).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const okOr = (r: string | null) => { if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.'); return r!.slice(3); };

    if (input.action === 'setDean') {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      const r = await one(`SELECT dea_set_dean($1,$2,$3,$4,$5,$6) AS r`, [T, me, isAdmin, input.unitId, uid, input.on]); if (r) forbid(r);
      await audit(a, input.on ? 'Dean appointed' : 'Dean removed', `unit:${input.unitId}`, `user:${uid}`, 'Administrator');
    }
    if (input.action === 'allocate') {
      const r = await one(`SELECT dea_allocate($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, isAdmin, input.unitId, input.year, input.amountMinor, input.reason]); if (r) forbid(r);
      await audit(a, 'College allocation set', `unit:${input.unitId}`, `${input.year} ${input.amountMinor}`, 'Administrator');
    }
    if (input.action === 'plan') {
      const id = okOr(await one(`SELECT dea_plan($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14) AS r`, [T, me, isAdmin, input.step, input.id, input.expectedVersion, input.level ?? null, input.deptId ?? null, input.unitId ?? null,
        input.year ?? null, input.title ?? null, input.goals ? JSON.stringify(input.goals) : null, input.seenHash ?? null, input.note ?? null]));
      if (input.step === 'approve' || input.step === 'return') await audit(a, `Plan ${input.step}`, `plan:${id}`, input.note ?? '', 'Dean');
    }
    if (input.action === 'request') {
      const id = okOr(await one(`SELECT dea_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.deptId ?? null, input.year ?? null, input.kind ?? null, input.amountMinor ?? null, input.text ?? null]));
      if (input.step !== 'submit') await audit(a, `Resource request ${input.step}`, `resourceRequest:${id}`, input.text ?? '', 'Dean');
    }
    if (input.action === 'escalate') okOr(await one(`SELECT dea_escalate($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.step, input.id, input.deptId ?? null, input.category ?? null, input.text ?? null]));
    if (input.action === 'motion') {
      const id = okOr(await one(`SELECT dea_motion($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, me, input.step, input.id, input.unitId ?? null, input.title ?? null, input.text ?? null, input.days ?? null, input.vote ?? null]));
      if (input.step !== 'vote') await audit(a, `College motion ${input.step}`, `motion:${id}`, '', 'Dean');
    }

    const deanUnits = ((await sql.query(`SELECT d.unit_id, u.name FROM dea_deans d JOIN tcp_units u ON u.id = d.unit_id WHERE d.tenant_id = $1 AND d.user_id = $2 AND d.revoked_at IS NULL`, [T, me])) as Row[]).map((r) => ({ id: Number(r.unit_id), name: String(r.name) }));
    const depts = (await sql.query(`SELECT id, name, chair_id FROM inst_departments WHERE tenant_id = $1 AND active ORDER BY name`, [T])) as Row[];
    const covered = deanUnits.length ? ((await sql.query(`SELECT id FROM inst_departments WHERE tenant_id = $1 AND active AND dea_covers($1, $2, id)`, [T, me])) as Row[]).map((r) => Number(r.id)) : [];
    const chairOf = depts.filter((d) => String(d.chair_id ?? '') === me).map((d) => Number(d.id));
    const visible = [...new Set([...covered, ...chairOf])];
    if (!isAdmin && !deanUnits.length && !chairOf.length) forbid('This area is for deans, department chairs and institution administrators.');
    const deptName = new Map(depts.map((d) => [Number(d.id), String(d.name)]));

    // Department health: counts only, from records the dean already oversees. No student-level data.
    const health = covered.length ? ((await sql.query(`SELECT d.id,
        (SELECT count(*) FROM sec_requests s WHERE s.department_id = d.id AND s.state IN ('submitted', 'chair_approved'))::int AS sections_waiting,
        (SELECT count(*) FROM dst_needs n WHERE n.department_id = d.id AND n.state = 'open')::int AS open_needs,
        (SELECT count(*) FROM dfm_responses r JOIN dfm_forms f ON f.id = r.form_id WHERE f.department_id = d.id AND r.state = 'submitted')::int AS forms_waiting,
        (SELECT count(*) FROM dea_escalations e WHERE e.dept_id = d.id AND e.state <> 'resolved')::int AS escalations_open,
        (SELECT count(*) FROM dea_escalations e WHERE e.dept_id = d.id AND e.state = 'open' AND e.created_at < now() - interval '5 days')::int AS escalations_overdue,
        (SELECT count(*) FROM dea_requests q WHERE q.dept_id = d.id AND q.state = 'submitted')::int AS requests_waiting,
        (SELECT state FROM dea_plans p WHERE p.dept_id = d.id ORDER BY p.year DESC LIMIT 1) AS plan_state,
        (SELECT year FROM dea_plans p WHERE p.dept_id = d.id ORDER BY p.year DESC LIMIT 1) AS plan_year
      FROM inst_departments d WHERE d.id = ANY($1::bigint[])`, [covered])) as Row[]) : [];

    const plans = (await sql.query(`SELECT * FROM dea_plans WHERE tenant_id = $1 AND (dept_id = ANY($2::bigint[]) OR unit_id = ANY($3::bigint[]) OR ($4 AND level = 'college')) ORDER BY year DESC, updated_at DESC LIMIT 200`,
      [T, visible, deanUnits.map((u) => u.id), isAdmin])) as Row[];
    const requests = (await sql.query(`SELECT * FROM dea_requests WHERE tenant_id = $1 AND dept_id = ANY($2::bigint[]) ORDER BY state = 'submitted' DESC, created_at DESC LIMIT 200`, [T, visible])) as Row[];
    const escalations = (await sql.query(`SELECT * FROM dea_escalations WHERE tenant_id = $1 AND dept_id = ANY($2::bigint[]) ORDER BY state = 'resolved', created_at DESC LIMIT 200`, [T, visible])) as Row[];
    const allocations = (await sql.query(`SELECT a.unit_id, a.year, a.amount_minor, u.name, (SELECT coalesce(sum(amount_minor), 0) FROM dea_requests q WHERE q.alloc_unit = a.unit_id AND q.year = a.year AND q.state = 'approved') AS used
      FROM dea_allocations a JOIN tcp_units u ON u.id = a.unit_id WHERE a.tenant_id = $1 AND (a.unit_id = ANY($2::bigint[]) OR $3) ORDER BY a.year DESC`, [T, deanUnits.map((u) => u.id), isAdmin])) as Row[];
    const motions = (await sql.query(`SELECT m.*, u.name AS unit_name, (SELECT vote FROM dea_votes v WHERE v.motion_id = m.id AND v.voter_id = $2) AS my_vote, (SELECT count(*) FROM dea_votes v WHERE v.motion_id = m.id)::int AS votes
      FROM dea_motions m JOIN tcp_units u ON u.id = m.unit_id WHERE m.tenant_id = $1 AND (m.unit_id = ANY($3::bigint[]) OR $2 = ANY(m.electorate)) ORDER BY m.created_at DESC LIMIT 50`, [T, me, deanUnits.map((u) => u.id)])) as Row[];
    const units = isAdmin ? ((await sql.query(`SELECT u.id, u.name, (SELECT string_agg(d.user_id, ',') FROM dea_deans d WHERE d.unit_id = u.id AND d.revoked_at IS NULL) AS deans FROM tcp_units u WHERE u.tenant_id = $1 AND u.active ORDER BY u.name`, [T])) as Row[]) : [];
    const names = await userNames([...plans.flatMap((p) => [String(p.author_id), String(p.decider_id ?? '')]), ...requests.flatMap((r) => [String(r.requester_id), String(r.decider_id ?? '')]),
      ...escalations.flatMap((e) => [String(e.raised_by), String(e.handled_by ?? '')]), ...units.flatMap((u) => String(u.deans ?? '').split(','))].filter(Boolean));
    const nm = (id: unknown) => (id ? names[String(id)] ?? 'Member' : null);
    return {
      me, isAdmin, deanUnits, chairOf: chairOf.map((id) => ({ id, name: deptName.get(id) ?? '' })),
      health: health.map((h) => ({ deptId: Number(h.id), dept: deptName.get(Number(h.id)) ?? '', sectionsWaiting: Number(h.sections_waiting), openNeeds: Number(h.open_needs), formsWaiting: Number(h.forms_waiting),
        escalationsOpen: Number(h.escalations_open), escalationsOverdue: Number(h.escalations_overdue), requestsWaiting: Number(h.requests_waiting), planState: h.plan_state ? String(h.plan_state) : null, planYear: h.plan_year ? String(h.plan_year) : null })),
      plans: plans.map((p) => ({ id: Number(p.id), level: String(p.level), deptId: p.dept_id == null ? null : Number(p.dept_id), unitId: p.unit_id == null ? null : Number(p.unit_id), scope: p.dept_id != null ? deptName.get(Number(p.dept_id)) ?? '' : deanUnits.find((u) => u.id === Number(p.unit_id))?.name ?? 'College',
        year: String(p.year), title: String(p.title), goals: p.goals as { goal: string; measure: string }[], hash: String(p.plan_hash), state: String(p.state), mine: p.author_id === me, author: nm(p.author_id), decider: nm(p.decider_id), note: String(p.note), rev: Number(p.rev),
        canDecide: p.state === 'submitted' && p.author_id !== me && (p.level === 'college' ? isAdmin : covered.includes(Number(p.dept_id))) })),
      requests: requests.map((r) => ({ id: Number(r.id), deptId: Number(r.dept_id), dept: deptName.get(Number(r.dept_id)) ?? '', year: String(r.year), kind: String(r.kind), amountMinor: Number(r.amount_minor), justification: String(r.justification), state: String(r.state),
        mine: r.requester_id === me, requester: nm(r.requester_id), decider: nm(r.decider_id), note: String(r.note), rev: Number(r.rev), canDecide: r.state === 'submitted' && r.requester_id !== me && covered.includes(Number(r.dept_id)) })),
      escalations: escalations.map((e) => ({ id: Number(e.id), deptId: Number(e.dept_id), dept: deptName.get(Number(e.dept_id)) ?? '', category: String(e.category), detail: String(e.detail), state: String(e.state), raisedBy: nm(e.raised_by), handledBy: nm(e.handled_by), note: String(e.note),
        createdAt: iso(e.created_at), overdue: e.state === 'open' && new Date(String(e.created_at)).getTime() < Date.now() - 5 * 864e5, canHandle: e.raised_by !== me && covered.includes(Number(e.dept_id)) })),
      allocations: allocations.map((x) => ({ unitId: Number(x.unit_id), unit: String(x.name), year: String(x.year), amountMinor: Number(x.amount_minor), usedMinor: Number(x.used) })),
      motions: motions.map((m) => ({ id: Number(m.id), unitId: Number(m.unit_id), unit: String(m.unit_name), title: String(m.title), body: String(m.body), electorate: (m.electorate as string[]).length, votes: Number(m.votes), myVote: m.my_vote ? String(m.my_vote) : null,
        canVote: (m.electorate as string[]).includes(me) && m.state === 'open', isDean: deanUnits.some((u) => u.id === Number(m.unit_id)), closesAt: iso(m.closes_at), state: String(m.state), outcome: String(m.outcome) })),
      units: units.map((u) => ({ id: Number(u.id), name: String(u.name), deans: String(u.deans ?? '').split(',').filter(Boolean).map((id) => nm(id) ?? 'Member') })),
    };
  },
});
