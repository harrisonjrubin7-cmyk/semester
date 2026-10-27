import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { HSG_MIGRATION } from '../lib/hsgMigration';
import { RLF_MIGRATION } from '../lib/rlfMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...HSG_MIGRATION, ...RLF_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const REF = z.enum(['advising', 'counseling', 'housing', 'financial_aid', 'disability_services']);

// Residence life community work: RA check-ins and referrals, building programs, bounded incident reports. Roles come from
// hsg_staff (granted in Housing by an administrator). No academic or private resident records are read here.
export default createEndpoint({
  description: 'Residence life: RA check-ins and referrals, building programs with RSVPs and attendance, bounded incident reports',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('checkin'), residentId: z.string(), outcome: z.enum(['ok', 'follow_up', 'referred']), referral: REF.nullable().default(null), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('propose'), title: z.string().min(3).max(120), description: z.string().max(2000).default(''), startsAt: z.string().datetime(), capacity: z.number().int().min(1).max(1000), budgetCents: z.number().int().min(0).max(10_000_000).default(0) }),
    z.object({ action: z.literal('programStep'), id: z.number().int(), step: z.enum(['approve', 'decline', 'cancel', 'held']), note: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('rsvp'), id: z.number().int(), on: z.boolean() }),
    z.object({ action: z.literal('attend'), id: z.number().int(), residentId: z.string(), attended: z.boolean() }),
    z.object({ action: z.literal('report'), area: z.string().min(2).max(80), category: z.enum(['noise', 'facilities_safety', 'policy', 'roommate', 'wellbeing_concern', 'emergency_followup']), occurredAt: z.string().datetime(), description: z.string().min(10).max(1000), building: z.string().max(80).default('') }),
    z.object({ action: z.literal('incidentStep'), id: z.number().int(), step: z.enum(['acknowledge', 'refer', 'close']), text: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out && !out.startsWith('ok:')) forbid(out); return out; };
    const kind = await one(`SELECT hsg_kind($1,$2) AS r`, [T, me]);
    const raBuilding = kind === 'ra' ? await one(`SELECT rlf_ra_building($1,$2) AS r`, [T, me]) : null;
    const home = await one(`SELECT rlf_resident_building($1,$2) AS r`, [T, me]);
    let result: unknown = null;

    switch (input.action) {
      case 'checkin': fail(await one(`SELECT rlf_checkin($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.residentId, input.outcome, input.outcome === 'referred' ? input.referral : null, input.note])); break;
      case 'propose': result = fail(await one(`SELECT rlf_propose($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.title, input.description, input.startsAt, input.capacity, input.budgetCents])); break;
      case 'programStep': {
        fail(await one(`SELECT rlf_program_step($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.id, input.step, input.note, input.expectedVersion]));
        const by = ((await sql.query(`SELECT proposed_by FROM rlf_programs WHERE id = $1`, [input.id])) as Row[])[0]?.proposed_by;
        if (by && by !== me) await zite.messages.create({ record: { body: 'There is an update to your building program in Semester (Residence life).', sender: me, recipients: [String(by)], isNotification: true } as never }).catch(() => undefined);
        break;
      }
      case 'rsvp': fail(await one(`SELECT rlf_rsvp($1,$2,$3,$4) AS r`, [me, T, input.id, input.on])); break;
      case 'attend': fail(await one(`SELECT rlf_attend($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.residentId, input.attended])); break;
      case 'report': {
        result = fail(await one(`SELECT rlf_report($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.area, input.category, input.occurredAt, input.description, input.building]));
        await audit(a, 'Residence incident filed', `incident:${String(result).slice(3)}`, input.category, kind === 'ra' ? 'Resident assistant' : 'Housing staff');
        if (['wellbeing_concern', 'emergency_followup'].includes(input.category)) {
          const staff = ((await sql.query(`SELECT user_id FROM hsg_staff WHERE tenant_id = $1 AND kind = 'staff' AND revoked_at IS NULL AND user_id <> $2`, [T, me])) as Row[]).map((r) => String(r.user_id));
          if (staff.length) await zite.messages.create({ record: { body: 'A priority residence incident report needs triage. Open Residence life in Semester.', sender: me, recipients: staff, isNotification: true } as never }).catch(() => undefined);
        }
        break;
      }
      case 'incidentStep': {
        fail(await one(`SELECT rlf_incident_step($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.id, input.step, input.text, input.expectedVersion]));
        await audit(a, `Residence incident: ${input.step}`, `incident:${input.id}`, '', 'Housing staff');
        break;
      }
      case 'get': break;
    }

    const staff = kind === 'staff';
    const programs = (await sql.query(`SELECT p.*, (SELECT count(*) FROM rlf_rsvps r WHERE r.program_id = p.id)::int AS n,
        EXISTS (SELECT 1 FROM rlf_rsvps r WHERE r.program_id = p.id AND r.resident_id = $2) AS mine
      FROM rlf_programs p WHERE p.tenant_id = $1 AND ($3 OR p.proposed_by = $2 OR (p.state IN ('approved','held') AND p.building = $4)) ORDER BY p.starts_at DESC LIMIT 200`, [T, me, staff, home])) as Row[];
    const myRun = programs.filter((p) => p.proposed_by === me).map((p) => Number(p.id));
    const rsvps = myRun.length ? (await sql.query(`SELECT * FROM rlf_rsvps WHERE program_id = ANY($1)`, [myRun])) as Row[] : [];
    const residents = raBuilding ? (await sql.query(`SELECT DISTINCT a.student_id FROM hsg_apps a JOIN hsg_rooms r ON r.id = a.room_id WHERE a.tenant_id = $1 AND a.state = 'moved_in' AND r.building = $2 AND a.student_id <> $3`, [T, raBuilding, me])) as Row[] : [];
    const checkins = kind ? (await sql.query(`SELECT * FROM rlf_checkins WHERE tenant_id = $1 AND ($2 OR ra_id = $3) ORDER BY at DESC LIMIT 200`, [T, staff, me])) as Row[] : [];
    const incidents = kind ? (await sql.query(`SELECT * FROM rlf_incidents WHERE tenant_id = $1 AND ($2 OR filed_by = $3) ORDER BY state = 'closed', category IN ('wellbeing_concern','emergency_followup') DESC, id DESC LIMIT 200`, [T, staff, me])) as Row[] : [];
    const nm = await userNames([...new Set([...programs.flatMap((p) => [p.proposed_by, p.decided_by]), ...rsvps.map((r) => r.resident_id), ...residents.map((r) => r.student_id), ...checkins.flatMap((c) => [c.ra_id, c.resident_id]), ...incidents.flatMap((i) => [i.filed_by, i.handled_by])].filter(Boolean).map(String))]);
    const n = (u: unknown) => (u ? nm[String(u)] ?? 'Someone' : '');
    return {
      result, me, kind, raBuilding, home,
      programs: programs.map((p) => ({ id: Number(p.id), building: String(p.building), title: String(p.title), description: String(p.description), startsAt: iso(p.starts_at), capacity: Number(p.capacity), budgetCents: Number(p.budget_cents),
        state: String(p.state), proposedBy: n(p.proposed_by), mineToRun: p.proposed_by === me, decidedBy: n(p.decided_by), decisionNote: String(p.decision_note), n: Number(p.n), rsvpd: !!p.mine, version: Number(p.version),
        attendees: p.proposed_by === me ? rsvps.filter((r) => String(r.program_id) === String(p.id)).map((r) => ({ id: String(r.resident_id), name: n(r.resident_id), attended: r.attended == null ? null : !!r.attended })) : [] })),
      residents: residents.map((r) => ({ id: String(r.student_id), name: n(r.student_id) })),
      checkins: checkins.map((c) => ({ ra: n(c.ra_id), resident: n(c.resident_id), building: String(c.building), outcome: String(c.outcome), referral: c.referral ? String(c.referral) : null, note: String(c.note), at: iso(c.at) })),
      incidents: incidents.map((i) => ({ id: Number(i.id), building: String(i.building), area: String(i.area), category: String(i.category), occurredAt: iso(i.occurred_at), description: String(i.description), state: String(i.state),
        filedBy: n(i.filed_by), mine: i.filed_by === me, handledBy: n(i.handled_by), outcome: String(i.outcome), version: Number(i.version) })),
    };
  },
});
