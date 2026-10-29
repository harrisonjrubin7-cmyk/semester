import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { DFM_MIGRATION } from '../lib/dfmMigration';
import { DST_MIGRATION } from '../lib/dstMigration';
import { demandRows, courseDemand } from '../lib/demandRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...SREQ_MIGRATION, ...DFM_MIGRATION, ...DST_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Department staffing coordination (Department Admin) and section demand (Department Chair). Rules in lib/dstMigration.ts.
export default createEndpoint({
  description: 'Department staffing needs and offers (admin posts, chair approves, person accepts) and section demand for chairs',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('need'), step: z.enum(['post', 'edit', 'cancel']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(), departmentId: z.number().int().optional(),
      term: z.string().max(40).optional(), course: z.string().max(40).optional(), role: z.enum(['teaching_assistant', 'grader', 'lab_instructor', 'instructor']).optional(),
      hours: z.number().int().optional(), slots: z.number().int().optional(), note: z.string().max(1000).optional() }),
    z.object({ action: z.literal('offer'), step: z.enum(['offer', 'approve', 'reject', 'accept', 'decline', 'withdraw']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      needId: z.number().int().optional(), email: z.string().email().max(200).optional(), note: z.string().max(1000).default('') }),
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
    const tenant = await tenantScope(T);

    if (input.action === 'need') {
      const r = await one(`SELECT dst_need($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.departmentId ?? null, input.term ?? null, input.course ?? null, input.role ?? null, input.hours ?? null, input.slots ?? null, input.note ?? null]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
    }
    if (input.action === 'offer') {
      let person: string | null = null;
      if (input.step === 'offer') {
        const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [(input.email ?? '').trim()] });
        person = rows[0] ? String((rows[0] as Row).id) : null;
        if (!person || !tenant.members.has(person)) forbid('That person is not a member of your institution.');
      }
      const r = await one(`SELECT dst_offer($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.needId ?? null, person, input.note]);
      if (r && !r.startsWith('ok:')) forbid(r);
      if (input.step === 'approve' || input.step === 'accept') await audit(a, `Staffing offer ${input.step}`, `staffingOffer:${input.id ?? r?.slice(3)}`, '', input.step === 'approve' ? 'Department chair' : 'Self');
    }

    const depts = (await sql.query(`SELECT id, name, chair_id FROM inst_departments WHERE tenant_id = $1 AND active ORDER BY name`, [T])) as Row[];
    const adminOf = new Set(((await sql.query(`SELECT department_id FROM dfm_admins WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL`, [T, me])) as Row[]).map((r) => Number(r.department_id)));
    const chairOf = new Set(depts.filter((d) => String(d.chair_id ?? '') === me).map((d) => Number(d.id)));
    const mine = [...new Set([...adminOf, ...chairOf])];
    const needs = (await sql.query(`SELECT * FROM dst_needs WHERE tenant_id = $1 AND (department_id = ANY($2::bigint[]) OR id IN (SELECT need_id FROM dst_offers WHERE person_id = $3)) ORDER BY state = 'open' DESC, updated_at DESC LIMIT 300`, [T, mine, me])) as Row[];
    const offers = (await sql.query(`SELECT o.* FROM dst_offers o JOIN dst_needs n ON n.id = o.need_id WHERE o.tenant_id = $1 AND (n.department_id = ANY($2::bigint[]) OR o.person_id = $3) ORDER BY o.updated_at DESC LIMIT 600`, [T, mine, me])) as Row[];
    const names = await userNames(offers.flatMap((o) => [String(o.person_id), String(o.offered_by), String(o.approved_by ?? '')]));
    const deptName = new Map(depts.map((d) => [Number(d.id), String(d.name)]));

    // Demand: chairs, department admins and institution administrators only. Committed seats and waiting students per section.
    let demand: unknown = null;
    if (mine.length || isAdmin) {
      const secIds = [...tenant.sections];
      const secs = secIds.length ? (await zite.sections.findAll({ limit: 2000 })).records.filter((s) => tenant.sections.has(s.id)) : [];
      const seats = secIds.length ? ((await sql.query(`SELECT section_id, count(*)::int AS n FROM reg_seats WHERE tenant_id = $1 GROUP BY section_id`, [T]).catch(() => [])) as Row[]) : [];
      const waits = secIds.length ? ((await sql.query(`SELECT section_id, count(*)::int AS n FROM reg_waitlist WHERE tenant_id = $1 AND state = 'waiting' GROUP BY section_id`, [T]).catch(() => [])) as Row[]) : [];
      const rows = demandRows(secs.map((s) => ({ id: s.id, label: s.label ?? 'Section', course: (s.label ?? '').split(/[-·]/)[0].trim() || (s.label ?? 'Course'), term: s.term ?? '', capacity: typeof s.capacity === 'number' ? s.capacity : null, state: s.sectionState ?? 'Open' })),
        Object.fromEntries(seats.map((r) => [String(r.section_id), Number(r.n)])), Object.fromEntries(waits.map((r) => [String(r.section_id), Number(r.n)])));
      demand = { sections: rows.slice(0, 300), courses: courseDemand(rows).slice(0, 100), source: 'Committed seats and waiting students from registration; capacity from the section record.' };
    }

    return {
      me, isAdmin,
      departments: depts.map((d) => ({ id: Number(d.id), name: String(d.name), admin: adminOf.has(Number(d.id)), chair: chairOf.has(Number(d.id)) })),
      needs: needs.map((n) => ({ id: Number(n.id), departmentId: Number(n.department_id), department: deptName.get(Number(n.department_id)) ?? '', term: String(n.term_code), course: String(n.course_code), role: String(n.role), hours: Number(n.hours_per_week), slots: Number(n.slots), note: String(n.note), state: String(n.state), version: Number(n.version), manage: mine.includes(Number(n.department_id)), admin: adminOf.has(Number(n.department_id)), chair: chairOf.has(Number(n.department_id)) })),
      offers: offers.map((o) => ({ id: Number(o.id), needId: Number(o.need_id), person: String(o.person_id) === me ? 'You' : names[String(o.person_id)] ?? 'Member', mineToAnswer: String(o.person_id) === me, offeredBy: names[String(o.offered_by)] ?? 'Staff', offeredByMe: String(o.offered_by) === me, approvedBy: o.approved_by ? names[String(o.approved_by)] ?? 'Chair' : null, state: String(o.state), note: String(o.note), version: Number(o.version), at: iso(o.updated_at) })),
      demand,
    };
  },
});
