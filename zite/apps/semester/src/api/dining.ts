import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { DNG_MIGRATION } from '../lib/dngMigration';
import { ALLERGENS } from '../lib/diningRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of DNG_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
// Institutions do not yet record a time zone; until they do, opening hours are read in this zone (gap recorded in the register).
const TZ = 'America/Chicago';
function localNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  return { weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), hhmm: `${parts.hour}:${parts.minute}`, date: `${parts.year}-${parts.month}-${parts.day}` };
}
const Hours = z.record(z.enum(['0', '1', '2', '3', '4', '5', '6']), z.tuple([z.string().regex(/^\d{2}:\d{2}$/), z.string().regex(/^\d{2}:\d{2}$/)]).nullable());

// Dining (role register: Dining Staff). Students see open locations and menus with allergens, keep their own allergen list,
// order with a swipe or dining dollars from their meal plan, and cancel before preparation. Dining staff (granted by an
// administrator) run locations, hours, menus and stock, set meal-plan entitlements, fulfil orders and close each day with a
// count. No card payments and no money movement: plan billing is Student Accounts' job. Rules live in lib/dngMigration.ts.
export default createEndpoint({
  description: 'Dining: locations, hours, menus with allergens, meal-plan orders, fulfillment, stock and daily close',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), term: z.string().max(40).optional() }),
    z.object({ action: z.literal('declare'), allergens: z.array(z.enum(ALLERGENS)).max(14) }),
    z.object({ action: z.literal('order'), requestKey: z.string().min(8).max(100), locationId: z.number().int(), term: z.string().min(2).max(40), tender: z.enum(['swipe', 'dollars']),
      items: z.array(z.object({ item: z.number().int(), qty: z.number().int().min(1).max(10) })).min(1).max(20), acknowledgeAllergens: z.boolean().default(false) }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(['prepare', 'ready', 'pick_up', 'cancel', 'reject']), expectedVersion: z.number().int(), note: z.string().max(300).default('') }),
    z.object({ action: z.literal('location'), id: z.number().int().nullable().default(null), name: z.string().min(2).max(120), hours: Hours, active: z.boolean() }),
    z.object({ action: z.literal('item'), id: z.number().int().nullable().default(null), locationId: z.number().int(), name: z.string().min(2).max(120), priceCents: z.number().int().min(0).max(10000),
      allergens: z.array(z.enum(ALLERGENS)).max(14), dietary: z.array(z.string().min(2).max(30)).max(10), ingredients: z.string().max(2000).default(''), stock: z.number().int().min(0).nullable(), available: z.boolean(), expectedVersion: z.number().int().default(0) }),
    z.object({ action: z.literal('entitle'), email: z.string().email().max(200), term: z.string().min(2).max(40), planName: z.string().min(2).max(80), swipes: z.number().int().min(0).max(1000), dollarsCents: z.number().int().min(0).max(1000000) }),
    z.object({ action: z.literal('close'), locationId: z.number().int(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), swipes: z.number().int().min(0), dollarsCents: z.number().int().min(0), note: z.string().max(1000).default('') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const isStaff = !!((await sql.query(`SELECT dng_is_staff($1,$2) AS ok`, [T, me])) as { ok: boolean }[])[0]?.ok;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const member = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid!;
    };
    const one = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    let result: unknown = null;
    const now = localNow();

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage dining access.');
      const uid = await member(input.email);
      await one(`SELECT dng_set_staff($1,$2,$3,$4) AS e`, [me, T, uid, input.on]);
      await audit(a, input.on ? 'Dining staff access granted' : 'Dining staff access revoked', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'declare') await one(`SELECT dng_declare($1,$2,$3::text[]) AS e`, [T, me, input.allergens]);
    if (input.action === 'location') {
      await one(`SELECT dng_location($1,$2,$3,$4,$5::jsonb,$6) AS e`, [T, me, input.id, input.name, JSON.stringify(input.hours), input.active]);
      await audit(a, 'Dining location saved', `diningLocation:${input.id ?? input.name}`, '', 'Dining staff');
    }
    if (input.action === 'item') {
      await one(`SELECT dng_item($1,$2,$3,$4,$5,$6,$7::text[],$8::text[],$9,$10,$11,$12) AS e`, [T, me, input.id, input.locationId, input.name, input.priceCents, input.allergens, input.dietary, input.ingredients, input.stock, input.available, input.expectedVersion]);
      await audit(a, 'Menu item saved', `diningItem:${input.id ?? input.name}`, input.allergens.join(','), 'Dining staff');
    }
    if (input.action === 'entitle') {
      const uid = await member(input.email);
      await one(`SELECT dng_entitle($1,$2,$3,$4,$5,$6,$7) AS e`, [T, me, uid, input.term, input.planName, input.swipes, input.dollarsCents]);
      await audit(a, 'Meal plan set', `user:${uid}`, `${input.term}: ${input.swipes} swipes, ${input.dollarsCents}c`, 'Dining staff');
    }
    if (input.action === 'order') {
      const out = ((await sql.query(`SELECT dng_order($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11::date) AS r`, [T, input.requestKey, me, input.locationId, input.term, input.tender, JSON.stringify(input.items),
        input.acknowledgeAllergens, now.weekday, now.hhmm, now.date])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [k, id] = out.split(':');
      result = { id: Number(id), replayed: k === 'replay' };
    }
    if (input.action === 'step') {
      const before = ((await sql.query(`SELECT student_id FROM dng_orders WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Order not found.');
      await one(`SELECT dng_step($1,$2,$3,$4,$5,$6) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note]);
      if (['ready', 'reject'].includes(input.step)) await zite.messages.create({ record: { body: input.step === 'ready' ? 'Your dining order is ready for pickup.' : 'Your dining order could not be made; your swipe or dining dollars were returned.', sender: me, recipients: [String(before!.student_id)], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'close') {
      await one(`SELECT dng_close($1,$2,$3,$4::date,$5,$6,$7) AS e`, [T, me, input.locationId, input.date, input.swipes, input.dollarsCents, input.note]);
      await audit(a, 'Dining day closed', `diningLocation:${input.locationId}:${input.date}`, `${input.swipes} swipes, ${input.dollarsCents}c${input.note ? ' — ' + input.note.slice(0, 120) : ''}`, 'Dining staff');
    }

    const locs = (await sql.query(`SELECT * FROM dng_locations WHERE tenant_id = $1 AND (active OR $2) ORDER BY name`, [T, isStaff])) as Row[];
    const items = locs.length ? (await sql.query(`SELECT * FROM dng_items WHERE location_id = ANY($1::bigint[]) AND (available OR $2) ORDER BY name`, [locs.map((l) => Number(l.id)), isStaff])) as Row[] : [];
    const plans = (await sql.query(`SELECT * FROM dng_entitlements WHERE tenant_id = $1 AND student_id = $2 ORDER BY updated_at DESC`, [T, me])) as Row[];
    const allergy = ((await sql.query(`SELECT allergens FROM dng_allergy WHERE tenant_id = $1 AND student_id = $2`, [T, me])) as Row[])[0];
    const myOrders = (await sql.query(`SELECT * FROM dng_orders WHERE tenant_id = $1 AND student_id = $2 ORDER BY created_at DESC LIMIT 30`, [T, me])) as Row[];
    const queue = isStaff ? (await sql.query(`SELECT * FROM dng_orders WHERE tenant_id = $1 AND (state IN ('placed','preparing','ready') OR service_date = $2::date) ORDER BY created_at LIMIT 300`, [T, now.date])) as Row[] : [];
    const closes = isStaff ? (await sql.query(`SELECT * FROM dng_closes WHERE tenant_id = $1 ORDER BY service_date DESC LIMIT 30`, [T])) as Row[] : [];
    const staff = isAdmin ? (await sql.query(`SELECT user_id FROM dng_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...queue.map((o) => String(o.student_id)), ...staff.map((s) => String(s.user_id))])]);
    const locName = Object.fromEntries(locs.map((l) => [String(l.id), String(l.name)]));
    const isOpenNow = (h: Record<string, [string, string] | null>) => { const x = h[String(now.weekday)]; return !!x && x[0] <= now.hhmm && now.hhmm < x[1]; };
    const order = (o: Row) => ({ id: Number(o.id), location: locName[String(o.location_id)] ?? 'Location', student: names[String(o.student_id)] ?? 'Student', tender: String(o.tender), totalCents: Number(o.total_cents),
      lines: o.lines as { name: string; qty: number; allergens: string[] }[], allergenAck: !!o.allergen_ack, state: String(o.state), version: Number(o.version), note: String(o.note), date: day(o.service_date), createdAt: iso(o.created_at) });

    return {
      result, isStaff, isAdmin, today: now.date, timeZone: TZ, allergensList: ALLERGENS, myAllergens: (allergy?.allergens as string[]) ?? [],
      plans: plans.map((p) => ({ term: String(p.term), plan: String(p.plan_name), swipes: Number(p.swipes), dollarsCents: Number(p.dollars_cents) })),
      locations: locs.map((l) => ({ id: Number(l.id), name: String(l.name), hours: l.hours as Record<string, [string, string] | null>, active: !!l.active, open: !!l.active && isOpenNow(l.hours as never), version: Number(l.version),
        items: items.filter((i) => Number(i.location_id) === Number(l.id)).map((i) => ({ id: Number(i.id), name: String(i.name), priceCents: Number(i.price_cents), allergens: i.allergens as string[], dietary: i.dietary as string[],
          ingredients: String(i.ingredients), stock: i.stock === null ? null : Number(i.stock), available: !!i.available, version: Number(i.version) })) })),
      myOrders: myOrders.map(order), queue: queue.map(order),
      closes: closes.map((c) => ({ location: locName[String(c.location_id)] ?? 'Location', date: day(c.service_date), expectedSwipes: Number(c.expected_swipes), expectedCents: Number(c.expected_cents),
        countedSwipes: Number(c.counted_swipes), countedCents: Number(c.counted_cents), note: String(c.note) })),
      staff: staff.map((s) => ({ name: names[String(s.user_id)] ?? 'Member' })),
    };
  },
});
