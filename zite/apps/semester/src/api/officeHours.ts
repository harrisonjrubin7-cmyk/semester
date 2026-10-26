import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureApt } from '../lib/aptServer';
import { validateSlots, expand, KIND_ROLES, SlotKind } from '../lib/aptRules';
import { courseRole } from '../lib/teamServer';

type Row = Record<string, unknown>;
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const KINDS = ['Office hours', 'Advising', 'Tutoring'] as const;
const iso = (v: unknown) => new Date(String(v)).toISOString();

/** Sections a student is enrolled in (not dropped). */
async function enrolledSections(uid: string) {
  const e = await zite.enrollments.findAll({ filters: { student: uid }, limit: 500 });
  return new Set(e.records.filter((x) => x.status === 'Enrolled' || x.status === 'Completed').flatMap((x) => ids(x.section)));
}

// Office hours and appointments: hosts publish slots (faculty for their own sections; advisors and tutors for the
// institution); students book, cancel before start, and see follow-ups; hosts cancel slots (students notified) and record
// attendance. Every rule is repeated in the database under lock (apt-001).
export default createEndpoint({
  description: 'Office hours and appointments: host slots with capacity, atomic booking, cancellation, attendance and follow-up',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('create'), kind: z.enum(KINDS), sectionId: z.string().nullable(), startsAt: z.string(), minutes: z.number().int(), capacity: z.number().int(), weeks: z.number().int(), location: z.string().max(200) }),
    z.object({ action: z.literal('book'), slotId: z.number().int(), topic: z.string().max(500).default('') }),
    z.object({ action: z.literal('cancel'), bookingId: z.number().int() }),
    z.object({ action: z.literal('cancelSlot'), slotId: z.number().int(), reason: z.string().max(500) }),
    z.object({ action: z.literal('mark'), bookingId: z.number().int(), state: z.enum(['attended', 'no_show']), followUp: z.string().max(2000).default('') }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensureApt();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const canHost = (k: SlotKind) => a.roles.some((r) => KIND_ROLES[k].includes(r));

    if (input.action === 'create') {
      if (!canHost(input.kind)) forbid(`Your role cannot host ${input.kind.toLowerCase()}.`);
      if (input.kind === 'Office hours') {
        if (!input.sectionId || !(await tenantScope(T)).sections.has(input.sectionId)) forbid('That section is not in your institution.');
        if ((await courseRole(T, input.sectionId!, me)) !== 'instructor') forbid('Only an instructor of the section can hold its office hours.');
      }
      fail(validateSlots({ ...input, sectionId: input.sectionId ?? null }, Date.now()));
      const times = expand(input.startsAt, input.minutes, input.weeks);
      fail(((await sql.query(`SELECT apt_create($1,$2,$3,$4,$5::timestamptz[],$6::timestamptz[],$7,$8) AS e`,
        [T, me, input.kind, input.sectionId, times.map((t) => t.start), times.map((t) => t.end), input.capacity, input.location])) as { e: string | null }[])[0].e);
      await audit(a, `${input.kind} published`, input.sectionId ? `section:${input.sectionId}` : 'appointments', `${times.length} slot(s)`, a.roles.join(', '));
    }

    if (input.action === 'book') {
      const s = ((await sql.query(`SELECT * FROM apt_slots WHERE id = $1 AND tenant_id = $2`, [input.slotId, T])) as Row[])[0];
      if (!s) forbid('That slot is not offered at your institution.');
      if (s!.section_id && !(await enrolledSections(me)).has(String(s!.section_id))) forbid('These office hours are for students in that section.');
      fail(((await sql.query(`SELECT apt_book($1,$2,$3,$4) AS e`, [T, input.slotId, me, input.topic.trim()])) as { e: string | null }[])[0].e);
      await audit(a, 'Appointment booked', `slot:${input.slotId}`, String(s!.kind), 'Student');
      await zite.messages.create({ record: { body: `${String(s!.kind)} booked for ${iso(s!.starts_at).slice(0, 16).replace('T', ' ')} UTC.`, sender: me, recipients: [String(s!.host_id)], isNotification: true } as never }).catch(() => undefined);
    }

    if (input.action === 'cancel') {
      fail(((await sql.query(`SELECT apt_cancel($1,$2,$3) AS e`, [T, input.bookingId, me])) as { e: string | null }[])[0].e);
      await audit(a, 'Appointment cancelled', `booking:${input.bookingId}`, '', 'Student');
    }

    if (input.action === 'cancelSlot') {
      const affected = ((await sql.query(`SELECT b.student_id, s.kind, s.starts_at FROM apt_bookings b JOIN apt_slots s ON s.id = b.slot_id WHERE b.slot_id = $1 AND b.tenant_id = $2 AND b.state = 'booked'`, [input.slotId, T])) as Row[]);
      fail(((await sql.query(`SELECT apt_cancel_slot($1,$2,$3,$4) AS e`, [T, input.slotId, me, input.reason])) as { e: string | null }[])[0].e);
      await audit(a, 'Slot cancelled by host', `slot:${input.slotId}`, `${affected.length} booking(s) cancelled`, a.roles.join(', '));
      if (affected.length) await zite.messages.create({ record: { body: `Your ${String(affected[0].kind).toLowerCase()} on ${iso(affected[0].starts_at).slice(0, 16).replace('T', ' ')} UTC was cancelled by the host: ${input.reason.trim()}. Please book another time.`,
        sender: me, recipients: affected.map((x) => String(x.student_id)), isNotification: true } as never }).catch(() => undefined);
    }

    if (input.action === 'mark') {
      fail(((await sql.query(`SELECT apt_mark($1,$2,$3,$4,$5) AS e`, [T, input.bookingId, me, input.state, input.followUp.trim()])) as { e: string | null }[])[0].e);
      await audit(a, input.state === 'attended' ? 'Attendance recorded' : 'No-show recorded', `booking:${input.bookingId}`, input.followUp.trim() ? 'follow-up written' : '', a.roles.join(', '));
    }

    // Read model.
    const enrolled = await enrolledSections(me);
    const [open, mine, hosting] = await Promise.all([
      sql.query(`SELECT s.*, (SELECT count(*) FROM apt_bookings b WHERE b.slot_id = s.id AND b.state <> 'cancelled')::int AS booked FROM apt_slots s
        WHERE s.tenant_id = $1 AND s.cancelled_at IS NULL AND s.starts_at > now() AND s.host_id <> $2 AND (s.section_id IS NULL OR s.section_id = ANY($3::text[]))
        ORDER BY s.starts_at LIMIT 200`, [T, me, [...enrolled]]) as Promise<Row[]>,
      sql.query(`SELECT b.id, b.state, b.topic, b.follow_up, s.kind, s.section_id, s.starts_at, s.ends_at, s.location, s.host_id, s.cancel_reason FROM apt_bookings b JOIN apt_slots s ON s.id = b.slot_id
        WHERE b.tenant_id = $1 AND b.student_id = $2 ORDER BY s.starts_at DESC LIMIT 100`, [T, me]) as Promise<Row[]>,
      sql.query(`SELECT s.*, coalesce(json_agg(json_build_object('id', b.id, 'student', b.student_id, 'state', b.state, 'topic', b.topic, 'followUp', b.follow_up)) FILTER (WHERE b.id IS NOT NULL), '[]') AS bookings
        FROM apt_slots s LEFT JOIN apt_bookings b ON b.slot_id = s.id AND b.state <> 'cancelled'
        WHERE s.tenant_id = $1 AND s.host_id = $2 AND s.starts_at > now() - interval '14 days' GROUP BY s.id ORDER BY s.starts_at LIMIT 200`, [T, me]) as Promise<Row[]>,
    ]);
    const tenant = await tenantScope(T);
    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label', 'instructors'] })).records.filter((s) => tenant.sections.has(s.id));
    const secLabel = Object.fromEntries(secs.map((s) => [s.id, s.label ?? '']));
    const teaching = secs.filter((s) => ids(s.instructors).includes(me)).map((s) => ({ id: s.id, label: s.label ?? '' }));
    const people = await userNames([...new Set([...open.map((s) => String(s.host_id)), ...mine.map((b) => String(b.host_id)),
      ...hosting.flatMap((s) => (s.bookings as Row[]).map((b) => String(b.student)))])]);
    const slotRow = (s: Row) => ({ id: Number(s.id), kind: String(s.kind), section: s.section_id ? secLabel[String(s.section_id)] ?? 'Section' : null,
      start: iso(s.starts_at), end: iso(s.ends_at), location: String(s.location), capacity: Number(s.capacity) });
    return {
      hostKinds: KINDS.filter((k) => canHost(k)), teaching,
      open: open.map((s) => ({ ...slotRow(s), host: people[String(s.host_id)] ?? 'Host', booked: Number(s.booked) })),
      mine: mine.map((b) => ({ id: Number(b.id), state: String(b.state), topic: String(b.topic), followUp: b.state === 'cancelled' ? '' : String(b.follow_up), kind: String(b.kind),
        section: b.section_id ? secLabel[String(b.section_id)] ?? 'Section' : null, start: iso(b.starts_at), end: iso(b.ends_at), location: String(b.location),
        host: people[String(b.host_id)] ?? 'Host', cancelReason: String(b.cancel_reason ?? '') })),
      hosting: hosting.map((s) => ({ ...slotRow(s), cancelled: !!s.cancelled_at, cancelReason: String(s.cancel_reason ?? ''),
        bookings: (s.bookings as Row[]).map((b) => ({ id: Number(b.id), student: people[String(b.student)] ?? 'Student', state: String(b.state), topic: String(b.topic), followUp: String(b.followUp) })) })),
      now: new Date().toISOString(), firstSection: first(teaching.map((t) => t.id)) ?? null,
    };
  },
});
