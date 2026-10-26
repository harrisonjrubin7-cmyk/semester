import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { FAC_MIGRATION } from '../lib/facMigration';
import { nextOrder, requesterStatus, OrderState, OrderStep, Kind } from '../lib/facilitiesRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of FAC_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const OSTEPS: OrderStep[] = ['authorize', 'assign', 'start', 'complete', 'close', 'reopen', 'cancel'];
const CATS = ['plumbing', 'electrical', 'heating_cooling', 'lighting', 'doors_locks', 'cleaning', 'grounds', 'safety_hazard', 'other'] as const;

// Facilities (S-76 E13). Anyone reports a problem and sees only a plain status of their own reports — no names or
// internal notes. Coordinators triage, mark duplicates, create, authorize, assign and inspect work and plan maintenance.
// Technicians and contractors see and work only orders assigned to them; contractor access ends on its date. Roles are
// granted by an administrator. Every rule is enforced in lib/facMigration.ts. Residence-hall repairs stay in Housing.
export default createEndpoint({
  description: 'Facilities: problem reports, triage and duplicates, work orders, assignment, completion evidence, inspection, planned maintenance',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), kind: z.enum(['coordinator', 'technician', 'contractor', 'none']), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null) }),
    z.object({ action: z.literal('location'), building: z.string().min(1).max(80), area: z.string().max(80).default(''), restricted: z.boolean() }),
    z.object({ action: z.literal('report'), requestKey: z.string().min(8).max(100), locationId: z.number().int(), category: z.enum(CATS), description: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('triage'), id: z.number().int(), expectedVersion: z.number().int(), step: z.enum(['triage', 'duplicate', 'decline', 'convert']), duplicateOf: z.number().int().nullable().default(null), title: z.string().max(140).default(''), priority: z.enum(['p1', 'p2', 'p3', 'p4']).default('p3'), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('createOrder'), locationId: z.number().int(), title: z.string().min(3).max(140), detail: z.string().max(4000).default(''), priority: z.enum(['p1', 'p2', 'p3', 'p4']) }),
    z.object({ action: z.literal('ostep'), id: z.number().int(), step: z.enum(OSTEPS as [OrderStep, ...OrderStep[]]), expectedVersion: z.number().int(), note: z.string().max(4000).default(''), assigneeId: z.string().max(100).nullable().default(null) }),
    z.object({ action: z.literal('plan'), locationId: z.number().int(), title: z.string().min(3).max(140), everyDays: z.number().int().min(1).max(3650), firstDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.object({ action: z.literal('generate') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const kind = (((await sql.query(`SELECT fac_kind($1,$2) AS k`, [T, me])) as { k: string | null }[])[0].k) as Kind | null;
    const role = kind === 'coordinator' ? 'Facilities coordinator' : kind ? 'Facilities technician' : 'Member';
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const tell = (to: string, body: string) => (to && to !== me ? zite.messages.create({ record: { body, sender: me, recipients: [to], isNotification: true } as never }).catch(() => undefined) : undefined);
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage facilities access.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT fac_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.kind === 'none' ? null : input.kind, input.expiresOn ? `${input.expiresOn}T23:59:59Z` : null]));
      await audit(a, `Facilities access: ${input.kind}`, `user:${uid}`, input.expiresOn ? `until ${input.expiresOn}` : '', 'Administrator');
    }
    if (input.action === 'location') {
      const out = await one(`SELECT fac_location($1,$2,$3,$4,$5) AS r`, [T, me, input.building, input.area, input.restricted]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      await audit(a, 'Facilities location saved', `facLocation:${out!.slice(3)}`, `${input.building} ${input.area}${input.restricted ? ' (restricted)' : ''}`, role);
    }
    if (input.action === 'report') {
      const out = await one(`SELECT fac_report($1,$2,$3,$4,$5,$6) AS r`, [T, input.requestKey, me, input.locationId, input.category, input.description]);
      if (!out || !/^(ok|replay):\d+$/.test(out)) forbid(out ?? 'Failed.');
      const [k, id] = out!.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, 'Facilities problem reported', `facReport:${id}`, input.category, 'Member');
    }
    if (input.action === 'triage') {
      const before = ((await sql.query(`SELECT requester_id FROM fac_requests WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      const out = await one(`SELECT fac_triage($1,$2,$3,$4,$5,$6,$7,$8,$9) AS r`, [T, me, input.id, input.expectedVersion, input.step, input.duplicateOf, input.title, input.priority, input.note]);
      if (out && !out.startsWith('order:')) forbid(out);
      await audit(a, `Facilities report: ${input.step}`, `facReport:${input.id}`, input.note, role);
      if (before) await tell(String(before.requester_id), 'There is an update to a problem you reported in Semester. Open Facilities to see it.');
    }
    if (input.action === 'createOrder') {
      const out = await one(`SELECT fac_create_order($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.locationId, input.title, input.detail, input.priority]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      await audit(a, 'Work order created', `workOrder:${out!.slice(3)}`, input.title, role);
    }
    if (input.action === 'ostep') {
      fail(await one(`SELECT fac_ostep($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.id, input.step, input.expectedVersion, input.note, input.assigneeId]));
      await audit(a, `Work order: ${input.step}`, `workOrder:${input.id}`, input.note.slice(0, 200), role);
      if (input.step === 'assign' && input.assigneeId) await tell(input.assigneeId, 'Facilities work has been assigned to you in Semester.');
      if (input.step === 'close' || input.step === 'reopen' || input.step === 'start' || input.step === 'complete') {
        const reqs = (await sql.query(`SELECT DISTINCT requester_id FROM fac_requests WHERE order_id = $1 AND tenant_id = $2`, [input.id, T])) as Row[];
        for (const r of reqs) await tell(String(r.requester_id), 'There is an update to a problem you reported in Semester. Open Facilities to see it.');
      }
    }
    if (input.action === 'plan') {
      const out = await one(`SELECT fac_plan($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.locationId, input.title, input.everyDays, input.firstDue]);
      if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.');
      await audit(a, 'Maintenance plan created', `facPlan:${out!.slice(3)}`, `${input.title} every ${input.everyDays} days`, role);
    }
    if (input.action === 'generate') {
      const out = await one(`SELECT fac_generate($1,$2) AS r`, [T, me]);
      if (!out?.startsWith('made:')) forbid(out ?? 'Failed.');
      result = { made: Number(out!.slice(5)) };
      await audit(a, 'Planned maintenance generated', 'facPlans', `${out!.slice(5)} work orders`, role);
    }

    // Read model, scoped by who is asking.
    const coord = kind === 'coordinator';
    const locations = (await sql.query(`SELECT * FROM fac_locations WHERE tenant_id = $1 AND (active OR $2) ORDER BY building, area`, [T, coord])) as Row[];
    const locName = Object.fromEntries(locations.map((l) => [String(l.id), `${l.building}${l.area ? ` · ${l.area}` : ''}`]));
    const mineReports = (await sql.query(`SELECT r.*, o.state AS order_state FROM fac_requests r LEFT JOIN fac_orders o ON o.id = r.order_id
      WHERE r.tenant_id = $1 AND r.requester_id = $2 ORDER BY r.created_at DESC LIMIT 200`, [T, me])) as Row[];
    const queue = coord ? (await sql.query(`SELECT * FROM fac_requests WHERE tenant_id = $1 AND state IN ('open','triaged') ORDER BY created_at LIMIT 500`, [T])) as Row[] : [];
    // Earlier reports from the last 14 days at the same place and category: duplicate candidates for the coordinator.
    const recent = coord ? (await sql.query(`SELECT id, location_id, category FROM fac_requests WHERE tenant_id = $1 AND created_at > now() - interval '14 days' AND state NOT IN ('declined','duplicate')`, [T])) as Row[] : [];
    const orders = kind ? (await sql.query(`SELECT * FROM fac_orders WHERE tenant_id = $1 AND ($2 OR assignee_id = $3)
      ORDER BY (state IN ('closed','cancelled')), priority, created_at LIMIT 1000`, [T, coord, me])) as Row[] : [];
    const plans = coord ? (await sql.query(`SELECT * FROM fac_plans WHERE tenant_id = $1 ORDER BY next_due`, [T])) as Row[] : [];
    const workers = coord ? (await sql.query(`SELECT user_id, kind, expires_at FROM fac_staff WHERE tenant_id = $1 AND revoked_at IS NULL AND kind IN ('technician','contractor') AND (expires_at IS NULL OR expires_at > now())`, [T])) as Row[] : [];
    const staffRows = isAdmin ? (await sql.query(`SELECT user_id, kind, expires_at FROM fac_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...queue.map((q) => String(q.requester_id)), ...orders.flatMap((o) => [o.assignee_id, o.authorized_by, o.closed_by]).filter(Boolean).map(String), ...workers.map((w) => String(w.user_id)), ...staffRows.map((s) => String(s.user_id))])]);
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const restricted = new Set(locations.filter((l) => l.restricted).map((l) => String(l.id)));

    return {
      result, kind, isAdmin,
      locations: locations.map((l) => ({ id: Number(l.id), label: locName[String(l.id)], building: String(l.building), area: String(l.area), restricted: kind ? !!l.restricted : undefined })),
      myReports: mineReports.map((r) => ({ id: Number(r.id), location: locName[String(r.location_id)] ?? 'Location', category: String(r.category), description: String(r.description), createdAt: iso(r.created_at),
        status: requesterStatus(String(r.state) as never, r.order_state ? String(r.order_state) as OrderState : null) })),
      queue: queue.map((q) => ({ id: Number(q.id), requester: nm(q.requester_id), location: locName[String(q.location_id)] ?? 'Location', locationId: Number(q.location_id), category: String(q.category), description: String(q.description), state: String(q.state), version: Number(q.version), createdAt: iso(q.created_at),
        similar: recent.filter((o) => String(o.id) !== String(q.id) && Number(o.id) < Number(q.id) && String(o.location_id) === String(q.location_id) && o.category === q.category).map((o) => Number(o.id)) })),
      orders: orders.map((o) => {
        const assignee = o.assignee_id === me;
        return { id: Number(o.id), title: String(o.title), detail: String(o.detail), location: locName[String(o.location_id)] ?? 'Location', restricted: restricted.has(String(o.location_id)), priority: String(o.priority),
          state: String(o.state), version: Number(o.version), assignee: nm(o.assignee_id), mine: assignee, authorizedBy: nm(o.authorized_by), closedBy: nm(o.closed_by), evidence: String(o.evidence), note: String(o.note),
          planned: !!o.plan_id, dueDate: o.due_date ? String(o.due_date).slice(0, 10) : null, createdAt: iso(o.created_at),
          steps: OSTEPS.filter((s) => nextOrder(String(o.state) as OrderState, s, { kind, assignee })) };
      }),
      plans: plans.map((p) => ({ id: Number(p.id), title: String(p.title), location: locName[String(p.location_id)] ?? 'Location', everyDays: Number(p.every_days), nextDue: String(p.next_due).slice(0, 10), active: !!p.active })),
      workers: workers.map((w) => ({ id: String(w.user_id), name: nm(w.user_id), kind: String(w.kind), until: iso(w.expires_at) })),
      staff: staffRows.map((s) => ({ name: nm(s.user_id), kind: String(s.kind), until: iso(s.expires_at) })),
    };
  },
});
