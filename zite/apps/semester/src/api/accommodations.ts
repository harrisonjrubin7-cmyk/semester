import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, ids, first, audit, userNames, tenantScope, requireTenantMember } from '../lib/server';
import { pg } from '../lib/pg';
import { ACC_MIGRATION } from '../lib/accMigration';

let ready: Promise<void> | null = null;
const ensureAcc = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const s of ACC_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
const CATEGORIES = ['testing', 'classroom', 'course_materials', 'housing', 'other'] as const;

// Accessibility accommodations (APP-006; lib/accMigration.ts). Every view is decided by who the caller is in THEIR institution:
// the student sees their own requests; the accessibility office sees its institution's queue; instructors see arrangements
// only for sections they teach that a student sent a letter to; administrators manage office membership.
export default createEndpoint({
  description: 'Accessibility accommodations: student requests, accessibility-office decisions, student-controlled letters to instructors',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('submit'), id: z.string().min(8).max(80), category: z.enum(CATEGORIES), description: z.string().min(20).max(4000), documentation: z.boolean() }),
    z.object({ action: z.literal('withdraw'), id: z.string() }),
    z.object({ action: z.literal('letter'), id: z.string(), sectionId: z.string(), send: z.boolean() }),
    z.object({ action: z.literal('decide'), id: z.string(), version: z.number().int(), decision: z.enum(['approve', 'decline', 'request_info']),
      arrangements: z.array(z.string().min(3).max(200)).max(10), note: z.string().max(1000), validUntil: z.string().nullable() }),
    z.object({ action: z.literal('setOffice'), userId: z.string(), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureAcc();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const isAdmin = a.roles.includes('Administrator');
    const office = ((await sql.query(`SELECT acc_is_staff($1,$2) AS ok`, [T, uid])) as { ok: boolean }[])[0].ok;
    const myEnrolledSections = async () => (await zite.enrollments.findAll({ filters: { student: uid }, limit: 500 })).records
      .filter((e) => e.status === 'Enrolled').map((e) => first(e.section)).filter(Boolean) as string[];

    if (input.action === 'submit') {
      fail(((await sql.query(`SELECT acc_submit($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.category, input.description, input.documentation])) as { e: string | null }[])[0].e);
      await audit(a, 'Accommodation requested', `accommodation:${input.id}`, input.category, 'Student');   // category only; never the description
      return { ok: true };
    }
    if (input.action === 'withdraw') {
      fail(((await sql.query(`SELECT acc_withdraw($1,$2,$3) AS e`, [uid, T, input.id])) as { e: string | null }[])[0].e);
      return { ok: true };
    }
    if (input.action === 'letter') {
      if (input.send && !(await myEnrolledSections()).includes(input.sectionId)) fail('You can only send a letter to a course you are enrolled in.');
      fail(((await sql.query(`SELECT acc_letter($1,$2,$3,$4,$5) AS e`, [uid, T, input.id, input.sectionId, input.send])) as { e: string | null }[])[0].e);
      await audit(a, input.send ? 'Accommodation letter sent' : 'Accommodation letter withdrawn', `section:${input.sectionId}`, '', 'Student');
      return { ok: true };
    }
    if (input.action === 'decide') {
      fail(((await sql.query(`SELECT acc_decide($1,$2,$3,$4,$5,$6,$7,$8::date) AS e`, [uid, T, input.id, input.version, input.decision, input.arrangements, input.note, input.validUntil])) as { e: string | null }[])[0].e);
      await audit(a, `Accommodation ${input.decision.replace('_', ' ')}`, `accommodation:${input.id}`, '', 'Accessibility office');
      return { ok: true };
    }
    if (input.action === 'setOffice') {
      if (!isAdmin) fail('Only administrators manage accessibility-office access.');
      const tenant = await tenantScope(T);
      if (!tenant.members.has(input.userId)) fail('That person is not in your institution.');
      if (input.on) await requireTenantMember(T, input.userId);
      fail(((await sql.query(`SELECT acc_set_staff($1,$2,$3,$4) AS e`, [uid, T, input.userId, input.on])) as { e: string | null }[])[0].e);
      await audit(a, input.on ? 'Accessibility office access granted' : 'Accessibility office access revoked', `user:${input.userId}`, '', 'Administrator');
      return { ok: true };
    }

    // get: each section of the response is filled only for callers entitled to it.
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    const mine = (await sql.query(`SELECT r.*, (SELECT coalesce(json_agg(l.section_id) FILTER (WHERE l.withdrawn_at IS NULL), '[]') FROM acc_letters l WHERE l.request_id = r.id) AS sent
      FROM acc_requests r WHERE r.tenant_id = $1 AND r.student_id = $2 ORDER BY r.number DESC`, [T, uid])) as Record<string, unknown>[];
    const enrolled = await myEnrolledSections();
    const secRows = enrolled.length ? (await zite.sections.findAll({ limit: 2000 })).records.filter((s) => enrolled.includes(s.id)) : [];
    const queue = office ? (await sql.query(`SELECT * FROM acc_requests WHERE tenant_id = $1 AND student_id <> $2 ORDER BY (state IN ('submitted','info_requested')) DESC, number DESC LIMIT 200`, [T, uid])) as Record<string, unknown>[] : [];
    const tenant = await tenantScope(T);
    const teachSecs = (await zite.sections.findAll({ limit: 2000 })).records.filter((s) => tenant.sections.has(s.id) && ids(s.instructors).includes(uid));
    const letters = teachSecs.length ? (await sql.query(`SELECT * FROM acc_instructor_letters($1, $2)`, [T, teachSecs.map((s) => s.id)])) as Record<string, unknown>[] : [];
    const officeMembers = isAdmin ? (await sql.query(`SELECT user_id FROM acc_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as { user_id: string }[] : [];
    const names = await userNames([...queue.map((q) => String(q.student_id)), ...letters.map((l) => String(l.student_id)), ...officeMembers.map((m) => m.user_id), ...(isAdmin ? [...tenant.members] : [])]);
    const secLabel = (id: string) => (teachSecs.find((s) => s.id === id) ?? secRows.find((s) => s.id === id))?.label ?? 'Course';
    return {
      office, isAdmin,
      mine: mine.map((r) => ({ id: String(r.id), number: Number(r.number), category: String(r.category), description: String(r.description), state: String(r.state),
        arrangements: (r.arrangements as string[]) ?? [], note: (r.decision_note as string) ?? '', validUntil: r.valid_until ? String(r.valid_until).slice(0, 10) : null,
        sent: (r.sent as string[]) ?? [], createdAt: iso(r.created_at) })),
      mySections: secRows.map((s) => ({ id: s.id, label: s.label ?? 'Course' })),
      queue: queue.map((r) => ({ id: String(r.id), number: Number(r.number), student: names[String(r.student_id)] ?? 'Student', category: String(r.category), description: String(r.description),
        documentation: !!r.documentation_offered, state: String(r.state), version: Number(r.version), arrangements: (r.arrangements as string[]) ?? [], note: (r.decision_note as string) ?? '',
        validUntil: r.valid_until ? String(r.valid_until).slice(0, 10) : null, createdAt: iso(r.created_at) })),
      letters: letters.map((l) => ({ student: names[String(l.student_id)] ?? 'Student', section: secLabel(String(l.section_id)), arrangements: (l.arrangements as string[]) ?? [],
        validUntil: String(l.valid_until).slice(0, 10), sentAt: iso(l.sent_at) })),
      officeMembers: officeMembers.map((m) => ({ id: m.user_id, name: names[m.user_id] ?? 'Member' })),
      members: isAdmin ? [...tenant.members].filter((m) => m !== uid).map((m) => ({ id: m, name: names[m] ?? 'Member' })).sort((x, y) => x.name.localeCompare(y.name)) : [],
    };
  },
});
