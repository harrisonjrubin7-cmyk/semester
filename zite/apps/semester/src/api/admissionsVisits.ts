import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { ADV_MIGRATION } from '../lib/advMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of ADV_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Admissions visits (staff side): publish and manage visit slots for this institution and see who
// is coming. Applicants book through the Applicants portal. Rules: lib/advMigration.ts.
export default createEndpoint({
  description: 'Admissions visit slots: publish, close, and see bookings for this institution',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('createSlot'), startsAt: z.string().min(16).max(40), kind: z.enum(['tour', 'info_session', 'interview']), capacity: z.number().int().min(1).max(500), location: z.string().max(120).default(''), note: z.string().max(300).default('') }),
    z.object({ action: z.literal('closeSlot'), id: z.number().int() }),
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
      if (!isAdmin) forbid('Only administrators manage admissions staff.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT adv_set_staff($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
      await audit(a, `Admissions staff ${input.on ? 'granted' : 'revoked'}`, `adv_staff:${uid}`, '', 'Administrator');
    }
    if (input.action === 'createSlot') {
      const out = await one(`SELECT adv_create_slot($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.startsAt, input.kind, input.capacity, input.location, input.note]);
      if (!out || !out.startsWith('ok:')) forbid(out ?? 'Failed.');
      const newId = Number(out!.split(':')[1]);
      result = { slotId: newId };
      await audit(a, 'Visit slot published', `adv_slot:${newId}`, `${input.kind} · ${input.startsAt}`, 'Admissions staff');
    }
    if (input.action === 'closeSlot') fail(await one(`SELECT adv_close_slot($1,$2,$3) AS r`, [me, T, input.id]));

    const isStaff = Boolean(((await sql.query(`SELECT adv_is_staff($1,$2) AS b`, [T, me])) as Row[])[0]?.b);
    const [slots, bookings, staff] = await Promise.all([
      sql.query(`SELECT * FROM adv_slots WHERE tenant_id = $1 ORDER BY starts_at DESC LIMIT 100`, [T]),
      sql.query(`SELECT b.* FROM adv_bookings b JOIN adv_slots s ON s.id = b.slot_id WHERE s.tenant_id = $1 AND b.state = 'booked' ORDER BY b.created_at`, [T]),
      sql.query(`SELECT user_id FROM adv_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY granted_at`, [T]),
    ]) as [Row[], Row[], Row[]];
    const names = await userNames([...bookings.map((b) => b.user_id), ...staff.map((s) => s.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    return {
      result, isAdmin, isStaff, institutionName: a.institutionName ?? null,
      staff: staff.map((s) => ({ name: nm(s.user_id), me: s.user_id === me })),
      slots: slots.map((s) => { const bs = bookings.filter((b) => String(b.slot_id) === String(s.id));
        return { id: Number(s.id), startsAt: iso(s.starts_at), kind: String(s.kind), capacity: Number(s.capacity), location: String(s.location), note: String(s.note),
          state: String(s.state), seatsTaken: bs.reduce((n, b) => n + Number(b.guests), 0),
          bookings: bs.map((b) => ({ name: nm(b.user_id), guests: Number(b.guests) })) }; }),
    };
  },
});
