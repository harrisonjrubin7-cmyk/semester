import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, audit, userNames, requireTenantMember } from '../lib/server';
import { pg } from '../lib/pg';
import { TUT_MIGRATION } from '../lib/tutMigration';

let ready: Promise<void> | null = null;
const ensureTut = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const s of TUT_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Tutoring (lib/tutMigration.ts). Views are cut on the server by who the caller is in THEIR institution:
// student → own requests in full; tutor → only sessions assigned to them; learning-center staff → operational metadata only
// (no goal, no summary); administrator → manages center staff. Nothing here reads grades.
export default createEndpoint({
  description: 'Tutoring: student requests, tutor profiles and sessions, learning-center verification, matching and waitlists',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('request'), id: z.string().min(8).max(80), subject: z.string().min(2).max(80), goal: z.string().min(10).max(1000) }),
    z.object({ action: z.literal('cancel'), id: z.string() }),
    z.object({ action: z.literal('profile'), subjects: z.array(z.string().min(2).max(80)).min(1).max(10), availability: z.string().min(5).max(300), active: z.boolean() }),
    z.object({ action: z.literal('schedule'), id: z.string(), version: z.number().int(), at: z.string() }),
    z.object({ action: z.literal('complete'), id: z.string(), version: z.number().int(), attended: z.boolean(), summary: z.string().max(2000), followups: z.array(z.string().min(2).max(200)).max(8) }),
    z.object({ action: z.literal('verify'), tutorId: z.string(), on: z.boolean() }),
    z.object({ action: z.literal('match'), id: z.string(), version: z.number().int(), tutorId: z.string().nullable() }),
    z.object({ action: z.literal('setStaff'), userId: z.string(), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureTut();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const isAdmin = a.roles.includes('Administrator');
    const staff = ((await sql.query(`SELECT tut_is_staff($1,$2) AS ok`, [T, uid])) as { ok: boolean }[])[0].ok;
    const call = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: uid, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    const rowOf = async (id: string) => ((await sql.query(`SELECT * FROM tut_requests WHERE id = $1`, [id])) as Row[])[0];

    switch (input.action) {
      case 'request': await call(`SELECT tut_request($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.subject, input.goal]); await audit(a, 'Tutoring requested', `tutoring:${input.id}`, input.subject, 'Owner'); break;
      case 'cancel': await call(`SELECT tut_cancel($1,$2,$3) AS e`, [uid, T, input.id]); await audit(a, 'Tutoring cancelled', `tutoring:${input.id}`, '', staff ? 'Learning center' : 'Owner'); break;
      case 'profile': await call(`SELECT tut_profile($1,$2,$3,$4,$5) AS e`, [uid, T, input.subjects, input.availability, input.active]); break;
      case 'schedule': {
        await call(`SELECT tut_schedule($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.version, input.at]);
        const r = await rowOf(input.id); if (r) await notify(String(r.student_id), `Your ${r.subject} tutoring session is scheduled.`);
        break;
      }
      case 'complete': {
        await call(`SELECT tut_complete($1,$2,$3,$4,$5,$6,$7) AS e`, [uid, T, input.id, input.version, input.attended, input.summary, input.followups]);
        const r = await rowOf(input.id); if (r && input.attended) await notify(String(r.student_id), `Your tutor added a summary and next steps for ${r.subject}.`);
        await audit(a, 'Tutoring session closed', `tutoring:${input.id}`, input.attended ? 'attended' : 'no-show', 'Tutor');
        break;
      }
      case 'verify': await call(`SELECT tut_verify($1,$2,$3,$4) AS e`, [uid, T, input.tutorId, input.on]); await audit(a, input.on ? 'Tutor verified' : 'Tutor unverified', `user:${input.tutorId}`, '', 'Learning center'); break;
      case 'match': {
        await call(`SELECT tut_match($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.version, input.tutorId]);
        const r = await rowOf(input.id);
        if (r && input.tutorId) { await notify(input.tutorId, `New tutoring match: ${r.subject}.`); await notify(String(r.student_id), `You were matched with a tutor for ${r.subject}.`); }
        else if (r) await notify(String(r.student_id), `No ${r.subject} tutor is free yet; you are on the waitlist.`);
        await audit(a, input.tutorId ? 'Tutoring matched' : 'Tutoring waitlisted', `tutoring:${input.id}`, '', 'Learning center');
        break;
      }
      case 'setStaff':
        if (!isAdmin) fail('Only institution administrators manage learning-center staff.');
        if (input.on) await requireTenantMember(T, input.userId);
        await call(`SELECT tut_set_staff($1,$2,$3,$4) AS e`, [uid, T, input.userId, input.on]);
        await audit(a, input.on ? 'Learning-center staff granted' : 'Learning-center staff revoked', `user:${input.userId}`, '', 'Administrator');
        break;
    }

    const [mineQ, assignedQ, prof] = await Promise.all([
      sql.query(`SELECT * FROM tut_requests WHERE tenant_id = $1 AND student_id = $2 ORDER BY number DESC LIMIT 30`, [T, uid]) as Promise<Row[]>,
      sql.query(`SELECT * FROM tut_requests WHERE tenant_id = $1 AND tutor_id = $2 AND state IN ('matched','scheduled','completed') ORDER BY (state = 'completed'), session_at NULLS FIRST LIMIT 50`, [T, uid]) as Promise<Row[]>,
      sql.query(`SELECT * FROM tut_tutors WHERE tenant_id = $1 AND user_id = $2`, [T, uid]) as Promise<Row[]>,
    ]);
    const names = await userNames([...mineQ.map((r) => String(r.tutor_id ?? '')), ...assignedQ.map((r) => String(r.student_id))]);
    const base = (r: Row) => ({ id: String(r.id), number: Number(r.number), subject: String(r.subject), state: String(r.state), version: Number(r.version), sessionAt: iso(r.session_at), createdAt: iso(r.created_at) });
    const out: Record<string, unknown> = {
      isAdmin, staff,
      mine: mineQ.map((r) => ({ ...base(r), goal: String(r.goal), tutor: r.tutor_id ? names[String(r.tutor_id)] ?? 'Tutor' : null, attended: r.attended as boolean | null, summary: (r.summary as string) ?? null, followups: (r.followups as string[]) ?? [] })),
      // Tutor view: the student's name, goal and their own summary; nothing else about the student.
      assigned: assignedQ.map((r) => ({ ...base(r), student: names[String(r.student_id)] ?? 'Student', goal: String(r.goal), summary: (r.summary as string) ?? null })),
      profile: prof[0] ? { subjects: prof[0].subjects as string[], availability: String(prof[0].availability), active: !!prof[0].active, verified: !!prof[0].verified_by } : null,
    };
    if (staff) {
      const [queue, tutors] = await Promise.all([
        sql.query(`SELECT id, number, subject, state, version, tutor_id, session_at, attended, created_at FROM tut_requests WHERE tenant_id = $1 ORDER BY (state IN ('requested','waitlisted')) DESC, number DESC LIMIT 200`, [T]) as Promise<Row[]>,
        sql.query(`SELECT * FROM tut_tutors WHERE tenant_id = $1 ORDER BY updated_at DESC`, [T]) as Promise<Row[]>,
      ]);
      const n2 = await userNames([...tutors.map((t) => String(t.user_id)), ...queue.map((q) => String(q.tutor_id ?? ''))]);
      // Staff see metadata only: subject, state, tutor, time, attendance. Not the goal, not the summary.
      out.queue = queue.map((q) => ({ ...base(q), tutor: q.tutor_id ? n2[String(q.tutor_id)] ?? 'Tutor' : null, attended: q.attended as boolean | null }));
      out.tutors = tutors.map((t) => ({ id: String(t.user_id), name: n2[String(t.user_id)] ?? 'Tutor', subjects: t.subjects as string[], availability: String(t.availability), active: !!t.active, verified: !!t.verified_by, self: t.user_id === uid }));
      const att = queue.filter((q) => q.state === 'completed');
      out.stats = { open: queue.filter((q) => ['requested', 'waitlisted'].includes(String(q.state))).length, waitlisted: queue.filter((q) => q.state === 'waitlisted').length,
        completed: att.length, attended: att.filter((q) => q.attended).length };
    }
    if (isAdmin) {
      const [st, mems] = await Promise.all([
        sql.query(`SELECT user_id FROM tut_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T]) as Promise<Row[]>,
        zite.memberships.findAll({ filters: { institution: T }, limit: 500 }),
      ]);
      const ids = st.map((s) => String(s.user_id));
      const n3 = await userNames([...ids, ...mems.records.map((m) => first(m.member) ?? '')]);
      out.staffList = ids.map((id) => ({ id, name: n3[id] ?? 'Member' }));
      out.members = mems.records.map((m) => first(m.member)).filter((id): id is string => !!id && id !== uid && !ids.includes(id)).map((id) => ({ id, name: n3[id] ?? 'Member' }));
    }
    return out;
  },
});
