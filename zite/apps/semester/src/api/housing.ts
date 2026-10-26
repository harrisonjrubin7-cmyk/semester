import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { HSG_MIGRATION } from '../lib/hsgMigration';
import { openSteps, AppState, Actor } from '../lib/housingRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of HSG_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const CATEGORIES = ['plumbing', 'electrical', 'heating_cooling', 'furniture', 'pests', 'lock_or_key', 'cleaning', 'other'] as const;
const STEPS = ['offer', 'accept', 'decline', 'withdraw', 'cancel', 'move_in', 'move_out'] as const;
const NOTE = 'There is an update to your housing in Semester. Open Housing to see it.';

// Residence life (role register: Residence Life Staff, Resident Assistant; students apply and report maintenance).
// Housing staff and resident assistants are granted by an administrator. Students see only their own applications and
// tickets; resident assistants see residents' names and rooms and maintenance in their own building, never applications or
// preferences; housing staff see everything in their institution. Every rule is enforced in lib/hsgMigration.ts.
export default createEndpoint({
  description: 'Residence life: housing applications, room offers and contracts, move-in/out, maintenance requests',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('apply'), requestKey: z.string().min(8).max(100), term: z.string().min(2).max(40), preferences: z.string().max(2000).default('') }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(STEPS), expectedVersion: z.number().int(), text: z.string().max(6000).default(''), roomId: z.number().int().nullable().default(null) }),
    z.object({ action: z.literal('room'), building: z.string().min(1).max(80), room: z.string().min(1).max(40), capacity: z.number().int().min(1).max(8), active: z.boolean() }),
    z.object({ action: z.literal('report'), requestKey: z.string().min(8).max(100), roomId: z.number().int(), category: z.enum(CATEGORIES), description: z.string().min(10).max(2000), urgent: z.boolean().default(false) }),
    z.object({ action: z.literal('maint'), id: z.number().int(), step: z.enum(['start', 'resolve', 'reopen', 'close']), expectedVersion: z.number().int(), text: z.string().max(2000).default('') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), kind: z.enum(['staff', 'ra', 'none']), building: z.string().max(80).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const mine = ((await sql.query(`SELECT kind, building FROM hsg_staff WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[])[0];
    const kind = (mine?.kind as 'staff' | 'ra' | undefined) ?? null;
    const myBuilding = mine?.building ? String(mine.building) : null;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage housing access.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(((await sql.query(`SELECT hsg_set_staff($1,$2,$3,$4,$5) AS e`, [me, T, uid, input.kind === 'none' ? null : input.kind, input.building])) as { e: string | null }[])[0].e);
      await audit(a, `Housing access: ${input.kind}`, `user:${uid}`, input.building, 'Administrator');
    }
    if (input.action === 'room') {
      fail(((await sql.query(`SELECT hsg_room($1,$2,$3,$4,$5,$6) AS e`, [T, me, input.building, input.room, input.capacity, input.active])) as { e: string | null }[])[0].e);
      await audit(a, 'Housing room saved', `room:${input.building}/${input.room}`, `capacity ${input.capacity}${input.active ? '' : ', inactive'}`, 'Housing staff');
    }
    if (input.action === 'apply') {
      const out = ((await sql.query(`SELECT hsg_apply($1,$2,$3,$4,$5) AS r`, [T, input.requestKey, me, input.term, input.preferences.trim()])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, 'Housing application submitted', `housingApp:${id}`, input.term, 'Student');
    }
    if (input.action === 'step') {
      const before = ((await sql.query(`SELECT student_id FROM hsg_apps WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Application not found.');
      fail(((await sql.query(`SELECT hsg_step($1,$2,$3,$4,$5,$6,$7) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.text, input.roomId])) as { e: string | null }[])[0].e);
      const self = String(before!.student_id) === me;
      await audit(a, `Housing application: ${input.step.replace('_', ' ')}`, `housingApp:${input.id}`, input.step === 'offer' ? `room ${input.roomId}` : input.step === 'accept' ? 'contract accepted' : input.text.slice(0, 200), self ? 'Student' : 'Housing staff');
      if (!self) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(before!.student_id)], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'report') {
      const out = ((await sql.query(`SELECT hsg_report($1,$2,$3,$4,$5,$6,$7) AS r`, [T, input.requestKey, me, input.roomId, input.category, input.description, input.urgent])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
      if (k === 'ok') await audit(a, 'Maintenance request submitted', `maintenance:${id}`, input.category + (input.urgent ? ', urgent' : ''), kind === 'staff' ? 'Housing staff' : 'Resident');
    }
    if (input.action === 'maint') {
      const before = ((await sql.query(`SELECT reporter_id FROM hsg_maint WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Request not found.');
      fail(((await sql.query(`SELECT hsg_maint_step($1,$2,$3,$4,$5,$6) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.text])) as { e: string | null }[])[0].e);
      await audit(a, `Maintenance request: ${input.step}`, `maintenance:${input.id}`, input.text.slice(0, 200), kind === 'staff' ? 'Housing staff' : 'Resident');
      if (String(before!.reporter_id) !== me) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(before!.reporter_id)], isNotification: true } as never }).catch(() => undefined);
    }

    // Read model, scoped by who is asking.
    const rooms = (await sql.query(`SELECT r.*, (SELECT count(*) FROM hsg_apps x WHERE x.room_id = r.id AND x.state IN ('offered','accepted','moved_in'))::int AS held
      FROM hsg_rooms r WHERE r.tenant_id = $1 ORDER BY building, room`, [T])) as Row[];
    const roomLabel = Object.fromEntries(rooms.map((r) => [String(r.id), `${r.building} ${r.room}`]));
    const roomBuilding = Object.fromEntries(rooms.map((r) => [String(r.id), String(r.building)]));
    const apps = (await sql.query(`SELECT * FROM hsg_apps WHERE tenant_id = $1 AND (student_id = $2 OR $3) ORDER BY updated_at DESC LIMIT 500`, [T, me, kind === 'staff'])) as Row[];
    const residents = kind === 'ra' ? (await sql.query(`SELECT a.student_id, a.room_id, a.state FROM hsg_apps a JOIN hsg_rooms r ON r.id = a.room_id
      WHERE a.tenant_id = $1 AND r.building = $2 AND a.state IN ('accepted','moved_in')`, [T, myBuilding])) as Row[] : [];
    const tickets = (await sql.query(`SELECT m.* FROM hsg_maint m JOIN hsg_rooms r ON r.id = m.room_id WHERE m.tenant_id = $1
      AND (m.reporter_id = $2 OR $3 OR ($4::text IS NOT NULL AND r.building = $4)) ORDER BY (m.state IN ('resolved','closed')), m.urgent DESC, m.updated_at DESC LIMIT 500`,
      [T, me, kind === 'staff', kind === 'ra' ? myBuilding : null])) as Row[];
    const staff = isAdmin ? (await sql.query(`SELECT user_id, kind, building FROM hsg_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...apps.map((x) => String(x.student_id)), ...residents.map((x) => String(x.student_id)), ...tickets.map((x) => String(x.reporter_id)), ...staff.map((x) => String(x.user_id))])]);
    const myRooms = apps.filter((x) => x.student_id === me && ['accepted', 'moved_in'].includes(String(x.state))).map((x) => ({ id: Number(x.room_id), label: roomLabel[String(x.room_id)] }));

    return {
      result, kind, myBuilding, isAdmin,
      rooms: kind === 'staff' ? rooms.map((r) => ({ id: Number(r.id), building: String(r.building), room: String(r.room), capacity: Number(r.capacity), held: Number(r.held), active: !!r.active })) : [],
      reportRooms: kind === 'staff' ? rooms.map((r) => ({ id: Number(r.id), label: roomLabel[String(r.id)] })) : myRooms,
      applications: apps.map((x) => {
        const actor: Actor = x.student_id === me ? 'student' : 'staff';
        return {
          id: Number(x.id), mine: x.student_id === me, student: names[String(x.student_id)] ?? 'Student', term: String(x.term), preferences: String(x.preferences),
          state: String(x.state), version: Number(x.version), room: x.room_id ? roomLabel[String(x.room_id)] : null,
          contractTerms: x.contract_terms ? String(x.contract_terms) : null, contractHash: x.contract_hash ? String(x.contract_hash) : null,
          acceptedAt: iso(x.accepted_at), moveInNote: String(x.move_in_note), moveOutNote: String(x.move_out_note), updatedAt: iso(x.updated_at),
          steps: openSteps(String(x.state) as AppState, actor),
        };
      }),
      residents: residents.map((x) => ({ name: names[String(x.student_id)] ?? 'Resident', room: roomLabel[String(x.room_id)], state: String(x.state) })),
      tickets: tickets.map((m) => ({
        id: Number(m.id), mine: m.reporter_id === me, reporter: names[String(m.reporter_id)] ?? 'Resident', room: roomLabel[String(m.room_id)], building: roomBuilding[String(m.room_id)],
        category: String(m.category), description: String(m.description), urgent: !!m.urgent, state: String(m.state), version: Number(m.version), resolution: String(m.resolution), updatedAt: iso(m.updated_at),
      })),
      staff: staff.map((s) => ({ name: names[String(s.user_id)] ?? 'Member', kind: String(s.kind), building: s.building ? String(s.building) : null })),
    };
  },
});
