import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PRK_MIGRATION } from '../lib/prkMigration';
import { effectivePermit, nextPermit, PermitState, PermitStep } from '../lib/parkingRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of PRK_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
const PSTEPS: PermitStep[] = ['allocate', 'waitlist', 'decline', 'revoke', 'withdraw'];
const NOTE = 'There is an update to your parking in Semester. Open Parking to see it.';

// Transportation and Parking (S-76 E17). Members register vehicles, apply for permits, and see and appeal citations on
// their own vehicles. Parking staff manage zones, allocate permits and issue citations; appeal adjudicators (a separate
// role) decide appeals. Both are granted by an administrator. Semester takes no payment and keeps no location data.
// Every rule is enforced in lib/prkMigration.ts.
export default createEndpoint({
  description: 'Parking: vehicles, zones, permits and waitlists, citations, independent appeals',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), kind: z.enum(['staff', 'adjudicator', 'none']) }),
    z.object({ action: z.literal('zone'), id: z.number().int().nullable(), name: z.string().min(1).max(80), capacity: z.number().int().min(0).max(20000), active: z.boolean() }),
    z.object({ action: z.literal('vehicle'), id: z.number().int().nullable(), plate: z.string().min(2).max(20), region: z.string().min(2).max(40), description: z.string().max(120).default(''), active: z.boolean() }),
    z.object({ action: z.literal('apply'), requestKey: z.string().min(8).max(100), zoneId: z.number().int(), vehicleId: z.number().int(), term: z.string().min(2).max(40), validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
    z.object({ action: z.literal('pstep'), id: z.number().int(), step: z.enum(PSTEPS as [PermitStep, ...PermitStep[]]), expectedVersion: z.number().int(), note: z.string().max(1000).default('') }),
    z.object({ action: z.literal('cite'), requestKey: z.string().min(8).max(100), plate: z.string().min(2).max(20), region: z.string().min(2).max(40), zoneId: z.number().int().nullable(), reason: z.string().min(5).max(500), amountCents: z.number().int().min(0).max(100000) }),
    z.object({ action: z.literal('cstep'), id: z.number().int(), step: z.enum(['appeal', 'upheld', 'dismissed', 'reduced', 'void', 'correct_plate']), expectedVersion: z.number().int(), note: z.string().max(3000).default(''), newCents: z.number().int().min(0).max(100000).nullable().default(null), plate: z.string().max(20).default(''), region: z.string().max(40).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const kind = (((await sql.query(`SELECT prk_kind($1,$2) AS k`, [T, me])) as { k: string | null }[])[0].k) as 'staff' | 'adjudicator' | null;
    const ok = (out: string) => { if (!/^(ok|replay):\d+$/.test(out)) forbid(out); const [k, id] = out.split(':'); return { id: Number(id), replayed: k === 'replay' }; };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage parking access.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(((await sql.query(`SELECT prk_set_staff($1,$2,$3,$4) AS e`, [me, T, uid, input.kind === 'none' ? null : input.kind])) as { e: string | null }[])[0].e);
      await audit(a, `Parking access: ${input.kind}`, `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'zone') {
      result = ok(((await sql.query(`SELECT prk_zone($1,$2,$3,$4,$5,$6) AS r`, [T, me, input.id, input.name, input.capacity, input.active])) as { r: string }[])[0].r);
      await audit(a, 'Parking zone saved', `parkingZone:${(result as { id: number }).id}`, `${input.name} · ${input.capacity}`, 'Parking staff');
    }
    if (input.action === 'vehicle') {
      result = ok(((await sql.query(`SELECT prk_vehicle($1,$2,$3,$4,$5,$6,$7) AS r`, [T, me, input.id, input.plate, input.region, input.description, input.active])) as { r: string }[])[0].r);
      await audit(a, input.id ? 'Vehicle updated' : 'Vehicle registered', `vehicle:${(result as { id: number }).id}`, input.active ? '' : 'removed', 'Member');
    }
    if (input.action === 'apply') {
      result = ok(((await sql.query(`SELECT prk_apply($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [T, input.requestKey, me, input.zoneId, input.vehicleId, input.term, input.validFrom, input.validTo])) as { r: string }[])[0].r);
      if (!(result as { replayed: boolean }).replayed) await audit(a, 'Parking permit applied for', `parkingPermit:${(result as { id: number }).id}`, input.term, 'Member');
    }
    if (input.action === 'pstep') {
      const before = ((await sql.query(`SELECT holder_id FROM prk_permits WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Permit not found.');
      fail(((await sql.query(`SELECT prk_pstep($1,$2,$3,$4,$5,$6) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note])) as { e: string | null }[])[0].e);
      const self = String(before!.holder_id) === me;
      await audit(a, `Parking permit: ${input.step}`, `parkingPermit:${input.id}`, input.note.slice(0, 200), self ? 'Member' : 'Parking staff');
      if (!self) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(before!.holder_id)], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'cite') {
      result = ok(((await sql.query(`SELECT prk_cite($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [T, input.requestKey, me, input.plate, input.region, input.zoneId, input.reason, input.amountCents])) as { r: string }[])[0].r);
      if (!(result as { replayed: boolean }).replayed) {
        await audit(a, 'Parking citation issued', `citation:${(result as { id: number }).id}`, input.reason.slice(0, 120), 'Parking staff');
        const owner = ((await sql.query(`SELECT v.owner_id FROM prk_citations c JOIN prk_vehicles v ON v.id = c.vehicle_id WHERE c.id = $1`, [(result as { id: number }).id])) as Row[])[0];
        if (owner) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(owner.owner_id)], isNotification: true } as never }).catch(() => undefined);
      }
    }
    if (input.action === 'cstep') {
      fail(((await sql.query(`SELECT prk_cstep($1,$2,$3,$4,$5,$6,$7,$8,$9) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.note, input.newCents, input.plate || null, input.region || null])) as { e: string | null }[])[0].e);
      await audit(a, `Parking citation: ${input.step.replace('_', ' ')}`, `citation:${input.id}`, input.note.slice(0, 200), input.step === 'appeal' ? 'Vehicle owner' : kind === 'adjudicator' ? 'Appeal adjudicator' : 'Parking staff');
      if (input.step !== 'appeal') {
        const owner = ((await sql.query(`SELECT v.owner_id FROM prk_citations c JOIN prk_vehicles v ON v.id = c.vehicle_id WHERE c.id = $1`, [input.id])) as Row[])[0];
        if (owner && String(owner.owner_id) !== me) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [String(owner.owner_id)], isNotification: true } as never }).catch(() => undefined);
      }
    }

    // Read model, scoped by who is asking.
    const zones = (await sql.query(`SELECT z.*, prk_issued(z.id) AS issued, (SELECT count(*) FROM prk_permits p WHERE p.zone_id = z.id AND p.state = 'waitlisted')::int AS waiting
      FROM prk_zones z WHERE z.tenant_id = $1 AND (z.active OR $2) ORDER BY z.name`, [T, kind === 'staff'])) as Row[];
    const zoneName = Object.fromEntries(zones.map((z) => [String(z.id), String(z.name)]));
    const vehicles = (await sql.query(`SELECT * FROM prk_vehicles WHERE tenant_id = $1 AND (owner_id = $2 OR $3) AND (active OR owner_id = $2)`, [T, me, kind === 'staff'])) as Row[];
    const plateOf = Object.fromEntries(vehicles.map((v) => [String(v.id), `${v.plate} (${v.region})`]));
    const permits = (await sql.query(`SELECT * FROM prk_permits WHERE tenant_id = $1 AND (holder_id = $2 OR $3) ORDER BY (state IN ('applied','waitlisted')) DESC, created_at LIMIT 1000`, [T, me, kind === 'staff'])) as Row[];
    const citations = (await sql.query(`SELECT c.*, v.owner_id FROM prk_citations c LEFT JOIN prk_vehicles v ON v.id = c.vehicle_id
      WHERE c.tenant_id = $1 AND (v.owner_id = $2 OR $3) ORDER BY (c.state = 'appealed') DESC, c.issued_at DESC LIMIT 1000`, [T, me, kind !== null])) as Row[];
    const staffRows = isAdmin ? (await sql.query(`SELECT user_id, kind FROM prk_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[] : [];
    const names = await userNames([...new Set([...permits.map((p) => String(p.holder_id)), ...staffRows.map((s) => String(s.user_id))])]);
    const now = new Date();

    return {
      result, kind, isAdmin,
      zones: zones.map((z) => ({ id: Number(z.id), name: String(z.name), capacity: Number(z.capacity), issued: Number(z.issued), waiting: kind === 'staff' ? Number(z.waiting) : undefined, active: !!z.active })),
      vehicles: vehicles.filter((v) => v.owner_id === me).map((v) => ({ id: Number(v.id), plate: String(v.plate), region: String(v.region), description: String(v.description), active: !!v.active })),
      permits: permits.map((p) => {
        const holder = p.holder_id === me;
        const eff = effectivePermit(String(p.state) as PermitState, p.valid_to ? new Date(String(p.valid_to) + 'T23:59:59Z') : null, now);
        const z = zones.find((x) => String(x.id) === String(p.zone_id));
        const full = z ? Number(z.issued) >= Number(z.capacity) || !z.active : true;
        return {
          id: Number(p.id), mine: holder, holder: names[String(p.holder_id)] ?? 'Member', zone: zoneName[String(p.zone_id)] ?? 'Zone', vehicle: plateOf[String(p.vehicle_id)] ?? 'Vehicle',
          term: String(p.term), validFrom: day(p.valid_from), validTo: day(p.valid_to), state: eff, version: Number(p.version), note: String(p.note),
          steps: eff === 'expired' ? [] : PSTEPS.filter((s) => nextPermit(eff, s, { staff: kind === 'staff', holder }, full)),
        };
      }),
      citations: citations.map((c) => {
        const owner = c.owner_id === me;
        const issued = new Date(String(c.issued_at));
        const steps: string[] = [];
        if (owner && c.state === 'issued' && now.getTime() - issued.getTime() <= 21 * 86_400_000) steps.push('appeal');
        if (kind === 'adjudicator' && c.state === 'appealed' && c.issued_by !== me) steps.push('upheld', 'dismissed', 'reduced');
        if (kind === 'staff' && c.state === 'issued') steps.push('void', 'correct_plate');
        return {
          id: Number(c.id), mine: owner, plate: `${c.plate} (${c.region})`, zone: c.zone_id ? zoneName[String(c.zone_id)] ?? null : null, reason: String(c.reason),
          amountCents: Number(c.amount_cents), finalCents: c.final_cents === null ? null : Number(c.final_cents), state: String(c.state), version: Number(c.version),
          appealText: String(c.appeal_text), decisionNote: String(c.decision_note), issuedAt: iso(c.issued_at), unmatched: !c.vehicle_id,
          appealBy: iso(new Date(issued.getTime() + 21 * 86_400_000)), steps,
        };
      }),
      staff: staffRows.map((s) => ({ name: names[String(s.user_id)] ?? 'Member', kind: String(s.kind) })),
    };
  },
});
