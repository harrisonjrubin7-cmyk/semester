import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, first, forbid, audit, tenantScope, userNames } from '../lib/server';
import { pg, ensureSchema, dispatchOutbox } from '../lib/pg';
import { WL_MIGRATION } from '../lib/wlMigration';
import { registrationWindow, maxCredits } from '../lib/calendarServer';
import { checkChange, Sec } from '../lib/changeRules';
import { tenantSources } from '../lib/sourcesServer';
import { sisBlock } from '../lib/sources';

let ready: Promise<void> | null = null;
const ensureWl = () => {
  if (!ready) ready = (async () => { await ensureSchema(); for (const q of WL_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; });
  return ready;
};
type Row = Record<string, unknown>;
const fail = (e: string | null | undefined) => { if (e) forbid(e); };

/** Mirrors a ledger seat change onto the student's Zite enrollment rows. Failures leave the ledger authoritative. */
async function mirror(student: string, section: string, status: 'Enrolled' | 'Dropped' | 'Waitlisted') {
  const found = await zite.enrollments.findAll({ filters: { student, section }, limit: 5 });
  const live = found.records.find((e) => e.status !== 'Dropped') ?? found.records[0];
  if (live) await zite.enrollments.update({ id: live.id, record: { status } as never });
  else if (status !== 'Dropped') await zite.enrollments.create({ record: { label: 'Registrar ledger', student, section, status, source: 'Made Here' } as never });
}

// Waitlists and registrar-decided drop/swap. Students act on their own seats only; the registrar decides changes.
// Seats and capacity are enforced in Postgres under lock (lib/wlMigration.ts). Student checks: lib/changeRules.ts.
export default createEndpoint({
  description: 'Registration changes: waitlists, and drop or swap requests that the registrar decides atomically',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine'), term: z.string() }),
    z.object({ action: z.literal('joinWaitlist'), sectionId: z.string() }),
    z.object({ action: z.literal('leaveWaitlist'), sectionId: z.string() }),
    z.object({ action: z.literal('requestDrop'), sectionId: z.string(), reason: z.string().max(500) }),
    z.object({ action: z.literal('requestSwap'), fromSectionId: z.string(), toSectionId: z.string(), reason: z.string().max(500) }),
    z.object({ action: z.literal('withdraw'), id: z.number().int() }),
    z.object({ action: z.literal('queue') }),
    z.object({ action: z.literal('decide'), id: z.number().int(), approve: z.boolean(), note: z.string().max(500) }),
    z.object({ action: z.literal('promote'), sectionId: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureWl();
    const sql = pg();
    const [secs, courses] = await Promise.all([zite.sections.findAll({ limit: 2000 }), zite.courses.findAll({ limit: 2000 })]);
    const courseById = Object.fromEntries(courses.records.map((c) => [c.id, c]));
    const secById = Object.fromEntries(secs.records.map((s) => [s.id, s]));
    const label = (id: string) => { const s = secById[id]; const c = courseById[first(s?.course) ?? '']; return `${c?.code ?? '?'} ${(s?.label ?? '').split(' · ')[1] ?? ''}`.trim(); };
    const toSec = (id: string): Sec => { const s = secById[id]; return { id, term: s?.term ?? '', credits: Number(courseById[first(s?.course) ?? '']?.credits ?? 0), times: s?.meetingTimes ?? '' }; };
    const cap = (id: string) => (secById[id]?.capacity ?? null) as number | null;

    // ---------- Registrar ----------
    if (input.action === 'queue' || input.action === 'decide' || input.action === 'promote') {
      const a = await requireAction(context.user.id, 'registration.request.decide');
      const tenant = await tenantScope(a.institutionId);
      const T = a.institutionId;
      if (input.action === 'decide') {
        const c = ((await sql.query(`SELECT * FROM reg_changes WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
        if (!c) forbid('Change request not found.');
        const from = String(c!.from_section), to = c!.to_section ? String(c!.to_section) : null;
        if (!tenant.sections.has(from) || (to && !tenant.sections.has(to))) forbid('That section is not in your institution.');
        if (input.approve) { const blocked = sisBlock(await tenantSources(T)); if (blocked) forbid(blocked); }
        const r = ((await sql.query(`SELECT reg_change_decide($1,$2,$3,$4,$5,$6,$7) AS r`, [T, input.id, a.userId, input.approve, input.note, cap(from), to ? cap(to) : null])) as { r: Row }[])[0].r;
        if (r.error) forbid(String(r.error));
        await audit(a, `${c!.kind === 'swap' ? 'Swap' : 'Drop'} ${r.state}`, `regChange:${input.id}`, `${r.resultCode}${input.note ? ` · ${input.note}` : ''}`, 'Registrar');
        let mirrorFailed = false;
        try {
          if (r.state === 'committed') {
            const student = String(r.student);
            // Seat changes reach Zite enrollment rows through the outbox (lib/pg.ts apply, topic reg.seat); failures stay pending.
            mirrorFailed = (await dispatchOutbox(T)).failed > 0;
            await zite.messages.create({ record: { body: `${r.message} (${label(from)}${to ? ` → ${label(to)}` : ''})`, sender: a.userId, recipients: [student], isNotification: true } as never });
            for (const p of (r.promoted as { student: string; section: string }[])) {
              await zite.messages.create({ record: { body: `A seat opened in ${label(p.section)} and you were enrolled from the waitlist.`, sender: a.userId, recipients: [p.student], isNotification: true } as never });
            }
          }
        } catch { mirrorFailed = true; }
        return { state: r.state, resultCode: r.resultCode, message: `${r.message}${(r.promoted as unknown[]).length ? ` ${(r.promoted as unknown[]).length} waitlisted student(s) given the freed seat.` : ''}${mirrorFailed ? ' Saved in the registrar ledger; student records update when reconciliation runs.' : ''}` };
      }
      if (input.action === 'promote') {
        if (!tenant.sections.has(input.sectionId)) forbid('That section is not in your institution.');
        // Used after a capacity increase: freed seats go to the waitlist before any new request.
        const promoted = await (async () => {
          await sql.query(`INSERT INTO reg_section_locks (tenant_id, section_id, capacity) VALUES ($1,$2,$3) ON CONFLICT (tenant_id, section_id) DO UPDATE SET capacity = EXCLUDED.capacity`, [T, input.sectionId, cap(input.sectionId)]);
          return ((await sql.query(`SELECT reg_wl_promote($1,$2,$3,$4,$5) AS p`, [T, input.sectionId, cap(input.sectionId), a.userId, 'capacity review'])) as { p: { student: string; section: string }[] }[])[0].p;
        })();
        await dispatchOutbox(T);
        for (const p of promoted) {
          await zite.messages.create({ record: { body: `A seat opened in ${label(p.section)} and you were enrolled from the waitlist.`, sender: a.userId, recipients: [p.student], isNotification: true } as never }).catch(() => undefined);
        }
        await audit(a, 'Waitlist promotion run', `section:${input.sectionId}`, `${promoted.length} promoted`, 'Registrar');
      }
      const [changes, waits, seats] = await Promise.all([
        sql.query(`SELECT * FROM reg_changes WHERE tenant_id = $1 ORDER BY (state = 'requested') DESC, id DESC LIMIT 100`, [T]) as Promise<Row[]>,
        sql.query(`SELECT section_id, count(*)::int AS n, min(joined_at) AS oldest FROM reg_waitlist WHERE tenant_id = $1 AND state = 'waiting' GROUP BY section_id`, [T]) as Promise<Row[]>,
        sql.query(`SELECT section_id, count(*)::int AS n FROM reg_seats WHERE tenant_id = $1 GROUP BY section_id`, [T]) as Promise<Row[]>,
      ]);
      const seatN = Object.fromEntries(seats.map((s) => [String(s.section_id), Number(s.n)]));
      const names = await userNames(changes.map((c) => String(c.student_id)));
      return {
        pending: changes.filter((c) => c.state === 'requested').map((c) => ({ id: Number(c.id), kind: String(c.kind), student: names[String(c.student_id)] ?? 'Student', self: c.student_id === a.userId,
          from: label(String(c.from_section)), to: c.to_section ? label(String(c.to_section)) : null, toSeats: c.to_section ? `${seatN[String(c.to_section)] ?? 0}/${cap(String(c.to_section)) ?? '∞'}` : null, reason: String(c.reason), at: c.created_at })),
        decided: changes.filter((c) => c.state !== 'requested').slice(0, 20).map((c) => ({ id: Number(c.id), kind: String(c.kind), student: names[String(c.student_id)] ?? 'Student', from: label(String(c.from_section)), to: c.to_section ? label(String(c.to_section)) : null, state: String(c.state), code: String(c.result_code ?? ''), message: String(c.message ?? '') })),
        waitlists: waits.filter((w) => tenant.sections.has(String(w.section_id))).map((w) => ({ sectionId: String(w.section_id), section: label(String(w.section_id)), waiting: Number(w.n), seats: `${seatN[String(w.section_id)] ?? 0}/${cap(String(w.section_id)) ?? '∞'}`, oldest: w.oldest })),
      };
    }

    // ---------- Student (own seats only) ----------
    const a = await requireAccess(context.user.id);
    const tenant = await tenantScope(a.institutionId);
    const T = a.institutionId, me = a.userId;
    const mySeats = async () => ((await sql.query(`SELECT section_id FROM reg_seats WHERE tenant_id = $1 AND student_id = $2`, [T, me])) as Row[]).map((r) => String(r.section_id)).filter((id) => tenant.sections.has(id));
    const inTenant = (id: string) => { if (!tenant.sections.has(id)) forbid('That section is not offered by your institution.'); };

    if (input.action === 'joinWaitlist') {
      inTenant(input.sectionId);
      fail(((await sql.query(`SELECT reg_wl_join($1,$2,$3,$4) AS e`, [T, input.sectionId, me, cap(input.sectionId)])) as { e: string | null }[])[0].e);
      await mirror(me, input.sectionId, 'Waitlisted').catch(() => undefined);
      await audit(a, 'Joined waitlist', `section:${input.sectionId}`, '', 'Student self-service');
    }
    if (input.action === 'leaveWaitlist') {
      inTenant(input.sectionId);
      fail(((await sql.query(`SELECT reg_wl_leave($1,$2,$3) AS e`, [T, input.sectionId, me])) as { e: string | null }[])[0].e);
      await mirror(me, input.sectionId, 'Dropped').catch(() => undefined);
      await audit(a, 'Left waitlist', `section:${input.sectionId}`, '', 'Student self-service');
    }
    if (input.action === 'requestDrop' || input.action === 'requestSwap') {
      const from = input.action === 'requestDrop' ? input.sectionId : input.fromSectionId;
      const to = input.action === 'requestSwap' ? input.toSectionId : undefined;
      inTenant(from); if (to) inTenant(to);
      const held = (await mySeats()).map(toSec);
      const term = toSec(from).term;
      const win = await registrationWindow(T, term);
      fail(checkChange({ kind: to ? 'swap' : 'drop', window: win, from: toSec(from), to: to ? toSec(to) : undefined, held: held.filter((s) => s.term === term), maxCredits: await maxCredits(T) }));
      fail(((await sql.query(`SELECT reg_change_request($1,$2,$3,$4,$5,$6) AS e`, [T, me, to ? 'swap' : 'drop', from, to ?? null, input.reason])) as { e: string | null }[])[0].e);
      await audit(a, to ? 'Swap requested' : 'Drop requested', `section:${from}`, to ? `to ${label(to)}` : '', 'Student self-service');
    }
    if (input.action === 'withdraw') {
      const n = ((await sql.query(`UPDATE reg_changes SET state = 'withdrawn' WHERE id = $1 AND tenant_id = $2 AND student_id = $3 AND state = 'requested' RETURNING id`, [input.id, T, me])) as Row[]).length;
      if (!n) throw new ZiteError({ code: 'FORBIDDEN', message: 'Only your own waiting request can be withdrawn.', userFacingMessage: 'Only your own waiting request can be withdrawn.' });
      await audit(a, 'Change request withdrawn', `regChange:${input.id}`, '', 'Student self-service');
    }

    const term = input.action === 'mine' ? input.term : null;
    const seats = await mySeats();
    const [waits, changes, counts] = await Promise.all([
      sql.query(`SELECT w.section_id, (SELECT count(*) FROM reg_waitlist x WHERE x.tenant_id = w.tenant_id AND x.section_id = w.section_id AND x.state = 'waiting' AND (x.joined_at, x.id) <= (w.joined_at, w.id))::int AS pos
                 FROM reg_waitlist w WHERE w.tenant_id = $1 AND w.student_id = $2 AND w.state = 'waiting'`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT * FROM reg_changes WHERE tenant_id = $1 AND student_id = $2 ORDER BY id DESC LIMIT 20`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT section_id, count(*)::int AS n FROM reg_seats WHERE tenant_id = $1 GROUP BY section_id`, [T]) as Promise<Row[]>,
    ]);
    const seatN = Object.fromEntries(counts.map((s) => [String(s.section_id), Number(s.n)]));
    const options = term ? Object.values(secById).filter((s) => tenant.sections.has(s.id) && s.term === term && !seats.includes(s.id)).map((s) => {
      const c = cap(s.id); const n = seatN[s.id] ?? 0;
      return { sectionId: s.id, label: label(s.id), times: s.meetingTimes ?? '', seats: `${n}/${c ?? '∞'}`, full: c != null && n >= c, waiting: waits.some((w) => w.section_id === s.id) };
    }) : [];
    return {
      seats: seats.filter((id) => !term || toSec(id).term === term).map((id) => ({ sectionId: id, label: label(id), times: secById[id]?.meetingTimes ?? '', pending: changes.some((c) => c.state === 'requested' && c.from_section === id) })),
      waitlists: waits.map((w) => ({ sectionId: String(w.section_id), label: label(String(w.section_id)), position: Number(w.pos) })),
      changes: changes.map((c) => ({ id: Number(c.id), kind: String(c.kind), from: label(String(c.from_section)), to: c.to_section ? label(String(c.to_section)) : null, state: String(c.state), message: String(c.message ?? '') })),
      options,
    };
  },
});
