import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids, first, Access } from '../lib/server';
import { pg, sha256 } from '../lib/pg';
import { SREQ_MIGRATION } from '../lib/sreqMigration';
import { validateDraft, parseMeeting, scheduleConflicts, sectionLabel, reconcile, Booking } from '../lib/sectionRequestRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of SREQ_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const REQUESTERS = ['Faculty', 'Staff', 'Administrator'];

async function activeMember(T: string, userId: string, roles: string[]) {
  const m = await zite.memberships.findAll({ filters: { member: userId, institution: T }, limit: 5 });
  return m.records.some((x) => x.status === 'Active' && (x.roles ?? []).some((r) => roles.includes(r)));
}
async function userByEmail(email: string) {
  const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
  return rows[0] ? String((rows[0] as Row).id) : null;
}
const step = async (T: string, id: number, actor: string, s: string, approve: boolean, expected: number, note: string, section = '') =>
  ((await pg().query(`SELECT sreq_step($1,$2,$3,$4,$5,$6,$7,$8) AS e`, [T, id, actor, s, approve, expected, note, section])) as { e: string | null }[])[0].e;
const load = async (T: string, id: number) => ((await pg().query(`SELECT * FROM sec_requests WHERE tenant_id = $1 AND id = $2`, [T, id])) as Row[])[0] ?? null;

/** Registrar-side: create (or adopt) the canonical section, assign the instructor, open it for registration, reconcile. */
async function publish(a: Access, id: number): Promise<{ state: string; mismatch: string[] }> {
  const T = a.institutionId, me = a.userId;
  let r = await load(T, id);
  if (!r) forbid('Request not found.');
  if (r!.state === 'authorized') { fail(await step(T, id, me, 'begin_create', true, Number(r!.version), 'Creating the section')); r = await load(T, id); }
  if (r!.state === 'creating') {
    const label = sectionLabel(String(r!.course_code), String(r!.section_code), String(r!.term_code));
    const tenant = await tenantScope(T);
    // Recovery: a section with this label may already exist from an attempt whose last step failed. Adopt it, never duplicate.
    const existing = (await zite.sections.findAll({ limit: 2000 })).records.find((s) => tenant.sections.has(s.id) && s.label === label);
    try {
      const sec = existing ?? await zite.sections.create({ record: {
        label, course: [String(r!.course_id)], term: String(r!.term_code), academicTerm: [String(r!.term_id)], meetingTimes: String(r!.meeting_times),
        instructors: [String(r!.instructor_id)], capacity: Number(r!.capacity), sectionState: 'Open', recordVersion: 1, courseAiPolicy: 'Not Allowed',
      } as never });
      fail(await step(T, id, me, 'created', true, Number(r!.version), existing ? 'Adopted the section created on an earlier attempt' : 'Section created and opened for registration', sec.id));
      await audit(a, 'Section created from request', `section:${sec.id}`, `request SR-${id}`, 'Registrar authorization');
      await zite.messages.create({ record: { body: `You are the instructor for ${label}. It is open for registration. Set it up in Learn.`, sender: me, recipients: [String(r!.instructor_id)], isNotification: true } as never }).catch(() => undefined);
    } catch (e) {
      const cur = await load(T, id);
      if (cur?.state === 'creating') await step(T, id, me, 'create_failed', true, Number(cur.version), `Creating the section failed: ${e instanceof Error ? e.message.slice(0, 200) : 'unknown error'}. Nothing was opened; try again.`);
      throw e;
    }
    r = await load(T, id);
  }
  if (r!.state === 'created') {
    const s = await zite.sections.findOne({ id: String(r!.section_id) });
    const mismatch = reconcile(
      { courseId: String(r!.course_id), termCode: String(r!.term_code), capacity: Number(r!.capacity), times: String(r!.meeting_times), instructorId: String(r!.instructor_id),
        label: sectionLabel(String(r!.course_code), String(r!.section_code), String(r!.term_code)) },
      s ? { course: ids(s.course), term: s.term ?? '', capacity: s.capacity ?? null, times: s.meetingTimes ?? '', instructors: ids(s.instructors), label: s.label ?? '', state: s.sectionState ?? '' } : null);
    if (mismatch.length) { await audit(a, 'Section request reconciliation mismatch', `request:SR-${id}`, mismatch.join(', '), 'Registrar'); return { state: 'created', mismatch }; }
    fail(await step(T, id, me, 'reconciled', true, Number(r!.version), `Receipt SR-${id}: section matches the authorized request`));
    return { state: 'reconciled', mismatch: [] };
  }
  return { state: String(r!.state), mismatch: [] };
}

// Semester Institution — new course sections (department → chair → registrar → canonical section → instructor → registration).
export default createEndpoint({
  description: 'Department requests for new course sections, with chair review, registrar authorization, section creation and reconciliation',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('saveDepartment'), id: z.number().int().optional(), name: z.string().min(2).max(120), chairEmail: z.string().email().max(200).optional(), active: z.boolean().default(true) }),
    z.object({ action: z.literal('saveRoom'), id: z.number().int().optional(), name: z.string().min(2).max(80), capacity: z.number().int().min(1).max(2000), active: z.boolean().default(true) }),
    z.object({ action: z.literal('submit'), requestKey: z.string().min(8).max(100), departmentId: z.number().int(), courseId: z.string(), termId: z.string(),
      sectionCode: z.string().max(8), capacity: z.number().int(), meetingTimes: z.string().max(40), roomId: z.number().int(), instructorId: z.string(), reason: z.string().max(1000).default('') }),
    z.object({ action: z.literal('withdraw'), id: z.number().int(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('chair'), id: z.number().int(), approve: z.boolean(), note: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('registrar'), id: z.number().int(), approve: z.boolean(), note: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('publish'), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let result: unknown = null;

    if (input.action === 'saveDepartment' || input.action === 'saveRoom') {
      const adm = await requireAction(me, 'catalog.manage');
      if (input.action === 'saveDepartment') {
        let chair: string | null = null;
        if (input.chairEmail) {
          chair = await userByEmail(input.chairEmail);
          if (!chair || !(await activeMember(T, chair, REQUESTERS))) forbid('The chair must be an active faculty, staff or administrator member of your institution.');
        }
        try {
          if (input.id) { const n = (await sql.query(`UPDATE inst_departments SET name = trim($3), chair_id = $4, active = $5 WHERE tenant_id = $1 AND id = $2 RETURNING id`, [T, input.id, input.name, chair, input.active]) as Row[]).length; if (!n) forbid('Department not found.'); }
          else await sql.query(`INSERT INTO inst_departments (tenant_id, name, chair_id, active) VALUES ($1, trim($2), $3, $4)`, [T, input.name, chair, input.active]);
        } catch (e) { if (String((e as Error).message).includes('inst_departments_name')) forbid('A department with that name already exists.'); throw e; }
        await audit(adm, input.id ? 'Department updated' : 'Department added', `department:${input.name}`, chair ? 'chair assigned' : 'no chair', 'Administrator');
      } else {
        try {
          if (input.id) { const n = (await sql.query(`UPDATE inst_rooms SET name = trim($3), capacity = $4, active = $5 WHERE tenant_id = $1 AND id = $2 RETURNING id`, [T, input.id, input.name, input.capacity, input.active]) as Row[]).length; if (!n) forbid('Room not found.'); }
          else await sql.query(`INSERT INTO inst_rooms (tenant_id, name, capacity, active) VALUES ($1, trim($2), $3, $4)`, [T, input.name, input.capacity, input.active]);
        } catch (e) { if (String((e as Error).message).includes('inst_rooms_name')) forbid('A room with that name already exists.'); throw e; }
        await audit(adm, input.id ? 'Room updated' : 'Room added', `room:${input.name}`, `capacity ${input.capacity}`, 'Administrator');
      }
    }

    if (input.action === 'submit') {
      if (!a.roles.some((r) => REQUESTERS.includes(r))) forbid('Only faculty, staff or administrators can request a section.');
      const tenant = await tenantScope(T);
      if (!tenant.courses.has(input.courseId)) forbid('That course is not in your institution.');
      const [course, term] = await Promise.all([zite.courses.findOne({ id: input.courseId }), zite.academicTerms.findOne({ id: input.termId })]);
      if (!term || !ids(term.institution).includes(T)) forbid('That term is not in your institution.');
      if (term!.state === 'Closed') forbid('That term is closed.');
      const room = ((await sql.query(`SELECT capacity FROM inst_rooms WHERE tenant_id = $1 AND id = $2 AND active`, [T, input.roomId])) as Row[])[0];
      const code = input.sectionCode.trim().toUpperCase();
      const times = input.meetingTimes.trim();
      fail(validateDraft({ sectionCode: code, capacity: input.capacity, meetingTimes: times, roomCapacity: room ? Number(room.capacity) : null,
        instructorIsFaculty: await activeMember(T, input.instructorId, ['Faculty']) }));
      const label = sectionLabel(course!.code ?? '', code, term!.code ?? '');
      if ((await zite.sections.findAll({ limit: 2000 })).records.some((s) => tenant.sections.has(s.id) && s.label === label)) forbid(`${label} already exists in the catalog.`);
      const m = parseMeeting(times)!;
      const fp = await sha256(JSON.stringify([input.departmentId, input.courseId, input.termId, code, input.capacity, times, input.roomId, input.instructorId, input.reason.trim()]));
      const out = ((await sql.query(`SELECT sreq_submit($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) AS r`,
        [T, me, input.requestKey, fp, input.departmentId, input.courseId, course!.code ?? '', input.termId, term!.code ?? '', code, input.capacity, times, m.days, m.start, m.end, input.roomId, input.instructorId, input.reason.trim()])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [kind, id] = out.split(':');
      result = { id: Number(id), replayed: kind === 'replay' };
      if (kind === 'ok') {
        await audit(a, 'Section requested', `request:SR-${id}`, label, 'Department request');
        const chair = ((await sql.query(`SELECT chair_id FROM inst_departments WHERE id = $1`, [input.departmentId])) as Row[])[0]?.chair_id;
        if (chair && chair !== me) await zite.messages.create({ record: { body: `A new section request (${label}) is waiting for your review in Institution.`, sender: me, recipients: [String(chair)], isNotification: true } as never }).catch(() => undefined);
      }
    }

    if (input.action === 'withdraw') {
      fail(await step(T, input.id, me, 'withdraw', true, input.expectedVersion, 'Withdrawn by the requester'));
      await audit(a, 'Section request withdrawn', `request:SR-${input.id}`, '', 'Requester');
    }

    if (input.action === 'chair') {
      if (!input.approve && !input.note.trim()) forbid('Say why you are declining, so the department can respond.');
      fail(await step(T, input.id, me, 'chair', input.approve, input.expectedVersion, input.note.trim()));
      await audit(a, input.approve ? 'Section request approved by chair' : 'Section request declined by chair', `request:SR-${input.id}`, input.note.trim(), 'Department chair');
      const r = await load(T, input.id);
      if (r) await zite.messages.create({ record: { body: `Your section request SR-${input.id} was ${input.approve ? 'approved by the chair and sent to the registrar' : 'declined by the chair'}.`, sender: me, recipients: [String(r.requester_id)], isNotification: true } as never }).catch(() => undefined);
    }

    if (input.action === 'registrar' || input.action === 'publish') {
      const reg = await requireAction(me, 'registration.request.decide');
      if (input.action === 'registrar') {
        if (!input.approve && !input.note.trim()) forbid('Say why you are declining, so the department can respond.');
        const r = await load(T, input.id);
        if (!r) forbid('Request not found.');
        if (input.approve) {
          // Scheduling check against sections already in the catalog for this term (the database re-checks other requests under lock).
          const tenant = await tenantScope(T);
          const booked: Booking[] = (await zite.sections.findAll({ limit: 2000 })).records
            .filter((s) => tenant.sections.has(s.id) && s.term === r!.term_code && s.sectionState !== 'Cancelled')
            .map((s) => ({ ref: s.label ?? s.id, roomId: null, instructorId: ids(s.instructors).includes(String(r!.instructor_id)) ? String(r!.instructor_id) : null, times: s.meetingTimes ?? '' }));
          const clashes = scheduleConflicts({ roomId: String(r!.room_id), instructorId: String(r!.instructor_id), times: String(r!.meeting_times) }, booked);
          if (clashes.length) forbid(clashes[0]);
          if (!(await activeMember(T, String(r!.instructor_id), ['Faculty']))) forbid('The instructor is no longer an active faculty member.');
        }
        fail(await step(T, input.id, me, 'registrar', input.approve, input.expectedVersion, input.note.trim()));
        await audit(reg, input.approve ? 'Section request authorized by registrar' : 'Section request declined by registrar', `request:SR-${input.id}`, input.note.trim(), 'Registrar');
        await zite.messages.create({ record: { body: `Your section request SR-${input.id} was ${input.approve ? 'authorized by the registrar' : 'declined by the registrar'}.`, sender: me, recipients: [String(r!.requester_id)], isNotification: true } as never }).catch(() => undefined);
        if (input.approve) result = await publish(reg, input.id);
      } else {
        result = await publish(reg, input.id);
      }
    }

    // Read model: what this person may see.
    const [depts, rooms] = await Promise.all([
      sql.query(`SELECT id, name, chair_id, active FROM inst_departments WHERE tenant_id = $1 ORDER BY name`, [T]) as Promise<Row[]>,
      sql.query(`SELECT id, name, capacity, active FROM inst_rooms WHERE tenant_id = $1 ORDER BY name`, [T]) as Promise<Row[]>,
    ]);
    const chairOf = depts.filter((d) => d.chair_id === me).map((d) => Number(d.id));
    let isRegistrar = false, isAdmin = false;
    try { await requireAction(me, 'registration.request.decide'); isRegistrar = true; } catch { /* not a registrar */ }
    try { await requireAction(me, 'catalog.manage'); isAdmin = true; } catch { /* not an admin */ }
    const reqs = (await sql.query(`SELECT * FROM sec_requests WHERE tenant_id = $1 AND (requester_id = $2 OR department_id = ANY($3::bigint[]) OR $4) ORDER BY updated_at DESC LIMIT 200`,
      [T, me, chairOf, isRegistrar])) as Row[];
    const events = reqs.length ? (await sql.query(`SELECT request_id, step, to_state, actor_id, note, at FROM sec_request_events WHERE tenant_id = $1 AND request_id = ANY($2::bigint[]) ORDER BY at`, [T, reqs.map((r) => Number(r.id))])) as Row[] : [];
    const canRequest = a.roles.some((r) => REQUESTERS.includes(r));
    const tenant = canRequest ? await tenantScope(T) : null;
    const [courses, terms, facultyRows] = canRequest ? await Promise.all([
      zite.courses.findAll({ limit: 2000 }), zite.academicTerms.findAll({ filters: { institution: T }, limit: 200 }),
      zite.memberships.findAll({ filters: { institution: T }, limit: 2000 }),
    ]) : [null, null, null];
    const faculty = facultyRows ? facultyRows.records.filter((m) => m.status === 'Active' && (m.roles ?? []).includes('Faculty')).map((m) => first(m.member)!).filter(Boolean) : [];
    const names = await userNames([...new Set([...reqs.flatMap((r) => [String(r.requester_id), String(r.instructor_id)]), ...events.map((e) => String(e.actor_id)), ...faculty, ...depts.map((d) => String(d.chair_id ?? '')).filter(Boolean)])]);
    const roomName = Object.fromEntries(rooms.map((r) => [Number(r.id), String(r.name)]));
    const deptName = Object.fromEntries(depts.map((d) => [Number(d.id), String(d.name)]));
    return {
      result,
      me: { canRequest, chairOf, isRegistrar, isAdmin },
      departments: depts.map((d) => ({ id: Number(d.id), name: String(d.name), chair: d.chair_id ? names[String(d.chair_id)] ?? 'Member' : null, active: !!d.active })),
      rooms: rooms.map((r) => ({ id: Number(r.id), name: String(r.name), capacity: Number(r.capacity), active: !!r.active })),
      courses: courses ? courses.records.filter((c) => tenant!.courses.has(c.id)).map((c) => ({ id: c.id, code: c.code ?? '', title: c.title ?? '' })) : [],
      terms: terms ? terms.records.filter((t) => t.state !== 'Closed').map((t) => ({ id: t.id, code: t.code ?? '', label: t.label ?? t.code ?? '' })) : [],
      faculty: faculty.map((id) => ({ id, name: names[id] ?? 'Member' })),
      requests: reqs.map((r) => ({
        id: Number(r.id), ref: `SR-${r.id}`, state: String(r.state), version: Number(r.version),
        label: sectionLabel(String(r.course_code), String(r.section_code), String(r.term_code)), capacity: Number(r.capacity), meetingTimes: String(r.meeting_times),
        room: roomName[Number(r.room_id)] ?? '—', department: deptName[Number(r.department_id)] ?? '—', departmentId: Number(r.department_id),
        instructor: names[String(r.instructor_id)] ?? 'Member', requester: names[String(r.requester_id)] ?? 'Member', mine: r.requester_id === me, forMe: r.instructor_id === me,
        reason: String(r.reason ?? ''), lastNote: String(r.last_note ?? ''), sectionId: r.section_id ? String(r.section_id) : null,
        events: events.filter((e) => Number(e.request_id) === Number(r.id)).map((e) => ({ step: String(e.step), state: String(e.to_state), who: names[String(e.actor_id)] ?? 'Member', note: String(e.note ?? ''), at: new Date(String(e.at)).toISOString() })),
      })),
    };
  },
});
