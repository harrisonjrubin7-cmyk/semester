import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { rolesOf } from '../lib/coRoles';
import { SREQ_MIGRATION } from '../../../semester/src/lib/sreqMigration';
import { TCP_MIGRATION, TCP_MODULES, TCP_ENFORCED } from '../../../semester/src/lib/tcpMigration';

type Row = Record<string, unknown>;
const forbid = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...SREQ_MIGRATION, ...TCP_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Platform Admin: tenant fleet, entitlements and quotas, flags with a kill switch, maintenance windows. Configuration authority
// only: nothing here reads a student record. platform_admin is a company role held in co_roles and never granted by code.
export default createEndpoint({
  description: 'Platform admin: tenant fleet, entitlements and quotas, feature flags with kill switch, maintenance windows',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('entitle'), tenantId: z.string().max(80), module: z.enum(TCP_MODULES), granted: z.boolean(), seatLimit: z.number().int().nullable(), apiCallsDay: z.number().int().nullable(), expectedVersion: z.number().int(), note: z.string().max(500) }),
    z.object({ action: z.literal('flag'), step: z.enum(['define', 'propose', 'approve', 'override', 'clear', 'kill', 'unkill']), key: z.string().max(61), expectedVersion: z.number().int().nullable(), on: z.boolean().nullable(), tenantId: z.string().max(80).nullable(), text: z.string().max(500).nullable() }),
    z.object({ action: z.literal('manage'), tenantId: z.string().max(80), managed: z.boolean(), reason: z.string().max(500) }),
    z.object({ action: z.literal('maintenance'), step: z.enum(['schedule', 'cancel']), id: z.number().int().nullable(), tenantId: z.string().max(80).nullable(), title: z.string().max(160).nullable(), impact: z.string().max(1000).nullable(), startsAt: z.string().max(40).nullable(), endsAt: z.string().max(40).nullable() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    if (!(await rolesOf(me)).includes('platform_admin')) forbid('The platform console needs the Platform admin role.');
    await ensure();
    const sql = pg();
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const inst = (await zite.institutions.findAll({ limit: 500 })).records;
    const known = (id: string | null) => id === null || inst.some((r) => r.id === id);

    if (input.action === 'entitle') {
      if (!known(input.tenantId)) forbid('Unknown institution.');
      const r = await one(`SELECT tcp_entitle($1,true,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, input.tenantId, input.module, input.granted, input.seatLimit, input.apiCallsDay, input.expectedVersion, input.note]); if (r) forbid(r);
    }
    if (input.action === 'flag') {
      if (!known(input.tenantId)) forbid('Unknown institution.');
      const r = await one(`SELECT tcp_flag($1,true,$2,$3,$4,$5,$6,$7) AS r`, [me, input.step, input.key, input.expectedVersion, input.on, input.tenantId, input.text]); if (r) forbid(r);
    }
    if (input.action === 'manage') {
      if (!known(input.tenantId)) forbid('Unknown institution.');
      const r = await one(`SELECT tcp_manage($1,true,$2,$3,$4) AS r`, [me, input.tenantId, input.managed, input.reason]); if (r) forbid(r);
    }
    if (input.action === 'maintenance') {
      if (!known(input.tenantId)) forbid('Unknown institution.');
      const r = await one(`SELECT tcp_maint($1,true,$2,$3,$4,$5,$6,$7::timestamptz,$8::timestamptz) AS r`, [me, input.step, input.id, input.tenantId, input.title, input.impact, input.startsAt, input.endsAt]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
    }

    const [ents, rolls, flags, overrides, maint, events, tenants, usage] = await Promise.all([
      sql.query(`SELECT * FROM tcp_entitlements`) as Promise<Row[]>,
      sql.query(`SELECT tenant_id, module, stage, pilot_roles FROM tcp_rollouts`) as Promise<Row[]>,
      sql.query(`SELECT * FROM tcp_flags ORDER BY key`) as Promise<Row[]>,
      sql.query(`SELECT * FROM tcp_flag_overrides`) as Promise<Row[]>,
      sql.query(`SELECT * FROM tcp_maintenance WHERE cancelled_at IS NULL AND ends_at > now() ORDER BY starts_at`) as Promise<Row[]>,
      sql.query(`SELECT tenant_id, actor_id, area, action, target, detail, at FROM tcp_events WHERE area IN ('entitlement', 'flag', 'maintenance', 'rollout') ORDER BY at DESC LIMIT 50`) as Promise<Row[]>,
      sql.query(`SELECT tenant_id, managed FROM tcp_tenants`) as Promise<Row[]>,
      sql.query(`SELECT tenant_id, module, calls FROM tcp_usage WHERE day = current_date`) as Promise<Row[]>,
    ]);
    const instName = (id: unknown) => (id ? inst.find((r) => r.id === String(id))?.name ?? 'Unknown institution' : 'All institutions');
    return {
      me, modules: TCP_MODULES,
      fleet: inst.map((i) => ({ id: i.id, name: i.name ?? 'Institution', managed: Boolean(tenants.find((t) => t.tenant_id === i.id)?.managed),
        modules: TCP_MODULES.map((m) => { const e = ents.find((x) => x.tenant_id === i.id && x.module === m), r = rolls.find((x) => x.tenant_id === i.id && x.module === m);
          const enf = TCP_ENFORCED.find((x) => x.module === m);
        return { module: m, enforced: Boolean(enf), quotaEnforced: Boolean(enf?.quota), callsToday: Number(usage.find((u) => u.tenant_id === i.id && u.module === m)?.calls ?? 0), granted: Boolean(e?.granted), seatLimit: e?.seat_limit == null ? null : Number(e.seat_limit), apiCallsDay: e?.api_calls_day == null ? null : Number(e.api_calls_day), rev: e ? Number(e.rev) : 0, note: e ? String(e.note) : '', stage: r ? String(r.stage) : 'off' }; }),
        overrides: overrides.filter((o) => o.tenant_id === i.id).map((o) => ({ key: String(o.key), on: Boolean(o.on_value), reason: String(o.reason) })),
        inMaintenance: maint.some((m) => (m.tenant_id == null || m.tenant_id === i.id) && new Date(String(m.starts_at)) <= new Date()) })),
      flags: flags.map((f) => ({ key: String(f.key), description: String(f.description), defaultOn: Boolean(f.default_on), killed: Boolean(f.killed), proposedOn: f.proposed_on == null ? null : Boolean(f.proposed_on), proposedByMe: f.proposed_by === me, rev: Number(f.rev),
        overrides: overrides.filter((o) => o.key === f.key).map((o) => ({ tenantId: String(o.tenant_id), institution: instName(o.tenant_id), on: Boolean(o.on_value), reason: String(o.reason) })) })),
      maintenance: maint.map((m) => ({ id: Number(m.id), scope: instName(m.tenant_id), title: String(m.title), impact: String(m.impact), startsAt: iso(m.starts_at), endsAt: iso(m.ends_at) })),
      events: events.map((e) => ({ institution: instName(e.tenant_id), mine: e.actor_id === me, area: String(e.area), action: String(e.action), target: String(e.target), detail: String(e.detail), at: iso(e.at) })),
    };
  },
});
