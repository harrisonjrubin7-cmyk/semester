import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAccess, requireAction, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { TCP_MIGRATION, TCP_MODULES, TCP_SETTINGS } from '../lib/tcpMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
export const ensureTcp = () => { if (!ready) ready = (async () => { for (const q of [...SREQ_MIGRATION, ...TCP_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const ROLES = ['Student', 'Faculty', 'Advisor', 'Tutor', 'Staff', 'Administrator', 'Alumni', 'Employer'] as const;

// University Admin control plane: structure, policies, configuration, entitlements (read-only here; granted by the company)
// and staged rollout. Administrator authority is resolved on the server; every rule lives in tcp_* (lib/tcpMigration.ts).
export default createEndpoint({
  description: 'Institution control plane: units and departments, versioned policies, settings, entitlements and staged module rollout',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('unit'), step: z.enum(['create', 'rename', 'move', 'archive', 'assign_dept']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      name: z.string().max(120).optional(), kind: z.enum(['college', 'school', 'division']).optional(), parentId: z.number().int().nullable().optional(), deptId: z.number().int().optional() }),
    z.object({ action: z.literal('policy'), step: z.enum(['draft', 'edit', 'approve', 'retire']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      key: z.string().max(41).optional(), title: z.string().max(160).optional(), body: z.string().max(40000).optional(), seenHash: z.string().max(64).optional() }),
    z.object({ action: z.literal('set'), key: z.enum(TCP_SETTINGS), value: z.union([z.string().max(80), z.number()]), expectedVersion: z.number().int(), reason: z.string().max(500) }),
    z.object({ action: z.literal('roll'), module: z.enum(TCP_MODULES), stage: z.enum(['off', 'pilot', 'all']), roles: z.array(z.enum(ROLES)).max(8).default([]), expectedVersion: z.number().int(), reason: z.string().max(500) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    try { await requireAction(a.userId, 'member.manage'); } catch { forbid('The control plane is for institution administrators.'); }
    await ensureTcp();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;

    if (input.action === 'unit') {
      const r = await one(`SELECT tcp_unit($1,$2,true,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.name ?? null, input.kind ?? 'college', input.parentId ?? null, input.deptId ?? null]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
      await audit(a, `Structure ${input.step}`, `unit:${r!.slice(3)}`, input.name ?? '', 'Administrator');
    }
    if (input.action === 'policy') {
      const r = await one(`SELECT tcp_policy($1,$2,true,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.key ?? null, input.title ?? null, input.body ?? null, input.seenHash ?? null]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
      await audit(a, `Policy ${input.step}`, `policy:${r!.slice(3)}`, input.key ?? '', 'Administrator');
    }
    if (input.action === 'set') {
      const r = await one(`SELECT tcp_set($1,$2,true,$3,$4::jsonb,$5,$6) AS r`, [T, me, input.key, JSON.stringify(input.value), input.expectedVersion, input.reason]); if (r) forbid(r);
      await audit(a, 'Configuration changed', `setting:${input.key}`, input.reason, 'Administrator');
    }
    if (input.action === 'roll') {
      const r = await one(`SELECT tcp_roll($1,$2,true,$3,$4,$5::text[],$6,$7) AS r`, [T, me, input.module, input.stage, input.roles, input.expectedVersion, input.reason]); if (r) forbid(r);
      await audit(a, `Rollout ${input.stage}`, `module:${input.module}`, input.reason, 'Administrator');
    }

    const [units, depts, policies, settings, ents, rolls, maint, events] = await Promise.all([
      sql.query(`SELECT * FROM tcp_units WHERE tenant_id = $1 AND active ORDER BY name`, [T]) as Promise<Row[]>,
      sql.query(`SELECT d.id, d.name, d.active, u.unit_id FROM inst_departments d LEFT JOIN tcp_unit_depts u ON u.dept_id = d.id WHERE d.tenant_id = $1 ORDER BY d.name`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM tcp_policies WHERE tenant_id = $1 AND state <> 'retired' ORDER BY key, version DESC`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM tcp_settings WHERE tenant_id = $1`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM tcp_entitlements WHERE tenant_id = $1`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM tcp_rollouts WHERE tenant_id = $1`, [T]) as Promise<Row[]>,
      sql.query(`SELECT id, title, impact, starts_at, ends_at FROM tcp_maintenance WHERE cancelled_at IS NULL AND ends_at > now() AND (tenant_id IS NULL OR tenant_id = $1) ORDER BY starts_at`, [T]) as Promise<Row[]>,
      sql.query(`SELECT actor_id, area, action, target, detail, at FROM tcp_events WHERE tenant_id = $1 ORDER BY at DESC LIMIT 40`, [T]) as Promise<Row[]>,
    ]);
    const names = await userNames([...policies.flatMap((p) => [String(p.author_id), String(p.approver_id ?? '')]), ...rolls.map((r) => String(r.pilot_by ?? '')), ...events.map((e) => String(e.actor_id))].filter(Boolean));
    const nm = (id: unknown) => (id ? names[String(id)] ?? 'Semester staff' : null);
    return {
      me, roles: ROLES, modules: TCP_MODULES, settingKeys: TCP_SETTINGS,
      units: units.map((u) => ({ id: Number(u.id), name: String(u.name), kind: String(u.kind), parentId: u.parent_id == null ? null : Number(u.parent_id), rev: Number(u.rev) })),
      departments: depts.map((d) => ({ id: Number(d.id), name: String(d.name), active: Boolean(d.active), unitId: d.unit_id == null ? null : Number(d.unit_id) })),
      policies: policies.map((p) => ({ id: Number(p.id), key: String(p.key), version: Number(p.version), title: String(p.title), body: String(p.body), hash: String(p.body_hash), state: String(p.state), mine: p.author_id === me,
        author: nm(p.author_id), approver: nm(p.approver_id), approvedAt: iso(p.approved_at), rev: Number(p.rev) })),
      settings: TCP_SETTINGS.map((k) => { const s = settings.find((x) => x.key === k); return { key: k, value: s ? s.value : null, version: s ? Number(s.version) : 0, updatedAt: s ? iso(s.updated_at) : null }; }),
      moduleState: TCP_MODULES.map((m) => {
        const e = ents.find((x) => x.module === m), r = rolls.find((x) => x.module === m);
        return { module: m, entitled: Boolean(e?.granted), seatLimit: e?.seat_limit == null ? null : Number(e.seat_limit), apiCallsDay: e?.api_calls_day == null ? null : Number(e.api_calls_day),
          stage: r ? String(r.stage) : 'off', pilotRoles: (r?.pilot_roles as string[]) ?? [], pilotBy: nm(r?.pilot_by), pilotMine: r?.pilot_by === me, pilotAt: iso(r?.pilot_at), rev: r ? Number(r.rev) : 0 };
      }),
      maintenance: maint.map((m) => ({ id: Number(m.id), title: String(m.title), impact: String(m.impact), startsAt: iso(m.starts_at), endsAt: iso(m.ends_at) })),
      events: events.map((e) => ({ who: nm(e.actor_id), area: String(e.area), action: String(e.action), target: String(e.target), detail: String(e.detail), at: iso(e.at) })),
    };
  },
});
