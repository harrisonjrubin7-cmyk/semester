import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { CSX_MIGRATION } from '../lib/csxMigration';
import { adoption } from '../lib/adoption';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureCoRoles(); for (const q of CSX_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const forbid = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };

/** Aggregate adoption for a confirmed tenant: counts only, small groups suppressed (lib/adoption.ts). */
async function adoptionFor(tenant: string) {
  const sql = pg();
  const ms = (await zite.memberships.findAll({ filters: { institution: tenant }, limit: 2000 })).records;
  const has = async (t: string) => ((await sql.query(`SELECT to_regclass($1) IS NOT NULL AS h`, [t])) as { h: boolean }[])[0].h;
  const ent = (await has('tcp_entitlements')) ? (await sql.query(`SELECT module FROM tcp_entitlements WHERE tenant_id = $1 AND granted`, [tenant])) as Row[] : [];
  const use = (await has('tcp_usage')) ? (await sql.query(`SELECT module, day, calls FROM tcp_usage WHERE tenant_id = $1 AND day >= current_date - 60`, [tenant])) as Row[] : [];
  return adoption(ms.map((m) => ({ roles: (m.roles as string[] | undefined) ?? [], status: String(m.status ?? '') })), ent.map((e) => String(e.module)),
    use.map((u) => ({ module: String(u.module), day: day(u.day)!, calls: Number(u.calls) })), new Date().toISOString().slice(0, 10));
}

// Customer Success: account ↔ institution links (confirmed by a platform admin), aggregate adoption, success plans and QBRs.
// Nothing here sends anything to a customer or reads a person's record.
export default createEndpoint({
  description: 'Customer success: link accounts to institutions, aggregate adoption, success plans and QBRs (nothing is sent)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), accountId: z.string().max(40).nullable() }),
    z.object({ action: z.literal('link'), step: z.enum(['propose', 'confirm', 'unlink']), accountId: z.string().max(40), tenantId: z.string().max(80).nullable(), note: z.string().max(500) }),
    z.object({ action: z.literal('goal'), step: z.enum(['add', 'achieved', 'missed', 'dropped']), accountId: z.string().max(40), goalId: z.number().int().nullable(), version: z.number().int().nullable(),
      goal: z.string().max(200).optional(), measure: z.string().max(200).optional(), target: z.string().max(80).optional(), dueOn: z.string().max(10).optional(), evidence: z.string().max(1000).optional() }),
    z.object({ action: z.literal('qbr'), step: z.enum(['plan', 'prepare', 'hold', 'cancel', 'action', 'done']), accountId: z.string().max(40), qbrId: z.number().int().nullable(), version: z.number().int().nullable(),
      scheduledFor: z.string().max(10).optional(), notes: z.string().max(5000).optional(), attendees: z.string().max(500).optional(), title: z.string().max(200).optional(),
      owner: z.string().max(120).optional(), dueOn: z.string().max(10).optional(), actionId: z.number().int().optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const roles = await rolesOf(me);
    const cs = roles.includes('customer_success'), pa = roles.includes('platform_admin');
    if (!cs && !pa) forbid('Customer success needs the customer success role.');
    await ensure();
    const sql = pg();
    const call = async (q: string, p: unknown[]) => { const r = ((await sql.query(q, p)) as { r: string | null }[])[0].r; if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.'); };
    const accounts = (await zite.customerAccounts.findAll({ limit: 500 })).records;
    const known = (id: string) => accounts.some((a) => a.id === id);

    if (input.action === 'link') {
      if (!known(input.accountId)) forbid('Unknown account.');
      if (input.tenantId && !(await zite.institutions.findOne({ id: input.tenantId }))) forbid('Unknown institution.');
      await call(`SELECT csx_link($1,$2,$3,$4,$5) AS r`, [me, input.step, input.accountId, input.tenantId, input.note]);
    } else if (input.action === 'goal') {
      if (!known(input.accountId)) forbid('Unknown account.');
      const { action: _a, step, ...p } = input;
      await call(`SELECT csx_goal($1,$2,$3::jsonb) AS r`, [me, step, JSON.stringify(p)]);
    } else if (input.action === 'qbr') {
      if (!known(input.accountId)) forbid('Unknown account.');
      const { action: _a, step, ...p } = input;
      const payload: Record<string, unknown> = { ...p };
      if (step === 'prepare') {   // the snapshot is computed here, never taken from the client
        const t = ((await sql.query(`SELECT csx_tenant($1) AS t`, [input.accountId])) as { t: string | null }[])[0].t;
        const goals = (await sql.query(`SELECT goal, measure, target, due_on, state, evidence FROM csx_goals WHERE account_id = $1 ORDER BY id`, [input.accountId])) as Row[];
        payload.snapshot = { takenAt: new Date().toISOString(), adoption: t ? await adoptionFor(t) : null,
          goals: goals.map((g) => ({ goal: g.goal, measure: g.measure, target: g.target, dueOn: day(g.due_on), state: g.state, evidence: g.evidence })) };
      }
      await call(`SELECT csx_qbr($1,$2,$3::jsonb) AS r`, [me, step, JSON.stringify(payload)]);
    }

    const [links, insts] = await Promise.all([
      sql.query(`SELECT * FROM csx_links`) as Promise<Row[]>,
      zite.institutions.findAll({ limit: 500 }),
    ]);
    const { records: users } = await zite.auth.findAllUsers({ limit: 200 });
    const name = (id: unknown) => { const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    const instName = (id: unknown) => insts.records.find((i) => i.id === String(id))?.name ?? String(id);
    const customers = accounts.filter((a) => a.lifecycleStage === 'Customer' || links.some((l) => l.account_id === a.id));
    const selId = input.action === 'get' ? input.accountId : input.accountId;
    const sel = customers.find((a) => a.id === selId) ?? customers[0] ?? null;
    let detail: unknown = null;
    if (sel) {
      const link = links.find((l) => l.account_id === sel.id);
      const [goals, qbrs, actions, events] = await Promise.all([
        sql.query(`SELECT * FROM csx_goals WHERE account_id = $1 ORDER BY state = 'active' DESC, due_on`, [sel.id]) as Promise<Row[]>,
        sql.query(`SELECT * FROM csx_qbrs WHERE account_id = $1 ORDER BY id DESC LIMIT 20`, [sel.id]) as Promise<Row[]>,
        sql.query(`SELECT a.* FROM csx_actions a JOIN csx_qbrs q ON q.id = a.qbr_id WHERE q.account_id = $1 ORDER BY a.due_on`, [sel.id]) as Promise<Row[]>,
        sql.query(`SELECT * FROM csx_events WHERE account_id = $1 ORDER BY id DESC LIMIT 50`, [sel.id]) as Promise<Row[]>,
      ]);
      detail = {
        id: sel.id, name: sel.legalName ?? 'Account',
        link: link ? { tenantId: String(link.tenant_id), tenant: instName(link.tenant_id), state: String(link.state), proposedBy: name(link.proposed_by), proposedById: String(link.proposed_by), confirmedBy: link.confirmed_by ? name(link.confirmed_by) : null, note: String(link.note) } : null,
        adoption: link?.state === 'confirmed' ? await adoptionFor(String(link.tenant_id)) : null,
        goals: goals.map((g) => ({ id: Number(g.id), goal: String(g.goal), measure: String(g.measure), target: String(g.target), dueOn: day(g.due_on), state: String(g.state), evidence: String(g.evidence), owner: name(g.owner_id), version: Number(g.version) })),
        qbrs: qbrs.map((q) => ({ id: Number(q.id), scheduledFor: day(q.scheduled_for), state: String(q.state), snapshot: q.snapshot ?? null, attendees: String(q.attendees), notes: String(q.notes), owner: name(q.owner_id), version: Number(q.version),
          actions: actions.filter((a) => Number(a.qbr_id) === Number(q.id)).map((a) => ({ id: Number(a.id), title: String(a.title), owner: String(a.owner), dueOn: day(a.due_on), done: !!a.done_at })) })),
        history: events.map((e) => ({ actor: name(e.actor_id), subject: String(e.subject), step: String(e.step), note: String(e.note), at: iso(e.at) })),
      };
    }
    return {
      me, cs, pa,
      accounts: customers.map((a) => ({ id: a.id, name: a.legalName ?? 'Account', linked: links.find((l) => l.account_id === a.id)?.state ?? null })),
      institutions: insts.records.map((i) => ({ id: i.id, name: i.name ?? i.id })),
      selected: detail,
    };
  },
});
