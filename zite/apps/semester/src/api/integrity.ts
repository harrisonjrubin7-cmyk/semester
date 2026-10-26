import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { INT_MIGRATION } from '../lib/intMigration';
import { CATEGORIES } from '../lib/integrityRules';
import { courseRole } from '../lib/teamServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of INT_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const STEPS = ['respond', 'propose', 'accept', 'decline', 'refer', 'decide', 'appeal', 'decide_appeal', 'withdraw', 'close'] as const;
// Notifications carry no details: the case is visible only inside the app to its three parties.
const NOTE = 'An academic integrity matter needs your attention. Open Integrity in Semester to see it.';

// Academic integrity (Semester Faculty; S-60 §5). Instructors of record report about students enrolled in their section;
// the student responds; a course-level resolution stands only if the student accepts; otherwise the integrity office
// decides and a different officer hears any appeal. Visible only to the student, the reporter and integrity officers.
// No grade is changed by an outcome.
export default createEndpoint({
  description: 'Academic integrity cases: report, respond, course-level resolution, referral, decision, appeal',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('report'), requestKey: z.string().min(8).max(100), sectionId: z.string(), studentId: z.string(), category: z.enum(CATEGORIES),
      allegation: z.string().min(20).max(4000), workRef: z.string().max(200).default('') }),
    z.object({ action: z.literal('step'), id: z.number().int(), step: z.enum(STEPS), expectedVersion: z.number().int(), text: z.string().max(4000).default(''), choice: z.string().max(60).default('') }),
    z.object({ action: z.literal('setOfficer'), email: z.string().email().max(200), on: z.boolean() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const isOfficer = !!((await sql.query(`SELECT int_is_officer($1,$2) AS ok`, [T, me])) as { ok: boolean }[])[0]?.ok;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    let result: unknown = null;

    if (input.action === 'setOfficer') {
      if (!isAdmin) forbid('Only administrators manage integrity-office access.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(((await sql.query(`SELECT int_set_officer($1,$2,$3,$4) AS e`, [me, T, uid, input.on])) as { e: string | null }[])[0].e);
      await audit(a, input.on ? 'Integrity office access granted' : 'Integrity office access revoked', `user:${uid}`, '', 'Administrator');
    }

    if (input.action === 'report') {
      if (!(await tenantScope(T)).sections.has(input.sectionId)) forbid('That section is not in your institution.');
      if ((await courseRole(T, input.sectionId, me)) !== 'instructor') forbid('Only an instructor of record can report an integrity concern for this section.');
      const enr = (await zite.enrollments.findAll({ filters: { student: input.studentId, section: input.sectionId }, limit: 5 })).records;
      if (!enr.some((e) => e.status === 'Enrolled' || e.status === 'Completed')) forbid('That student is not enrolled in this section.');
      const out = ((await sql.query(`SELECT int_report($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [T, input.requestKey, me, input.sectionId, input.studentId, input.category, input.allegation, input.workRef.trim()])) as { r: string }[])[0].r;
      if (!/^(ok|replay):\d+$/.test(out)) forbid(out);
      const [kind, id] = out.split(':');
      result = { id: Number(id), replayed: kind === 'replay' };
      if (kind === 'ok') {
        await audit(a, 'Integrity concern reported', `integrityCase:${id}`, input.category, 'Instructor of record');
        await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [input.studentId], isNotification: true } as never }).catch(() => undefined);
      }
    }

    if (input.action === 'step') {
      const before = ((await sql.query(`SELECT student_id, reporter_id, decided_by FROM int_cases WHERE id = $1 AND tenant_id = $2`, [input.id, T])) as Row[])[0];
      if (!before) forbid('Case not found.');
      fail(((await sql.query(`SELECT int_step($1,$2,$3,$4,$5,$6,$7) AS e`, [T, input.id, me, input.step, input.expectedVersion, input.text, input.choice])) as { e: string | null }[])[0].e);
      await audit(a, `Integrity case: ${input.step.replace('_', ' ')}`, `integrityCase:${input.id}`, input.choice, isOfficer && me !== before!.student_id && me !== before!.reporter_id ? 'Integrity office' : me === before!.student_id ? 'Student' : 'Instructor of record');
      // Tell the next party, with no details.
      const to = new Set<string>();
      if (['respond', 'accept', 'decline', 'appeal'].includes(input.step)) to.add(String(before!.reporter_id));
      if (['propose', 'decide', 'decide_appeal', 'withdraw', 'close'].includes(input.step)) to.add(String(before!.student_id));
      if (['decide', 'decide_appeal'].includes(input.step)) to.add(String(before!.reporter_id));
      to.delete(me);
      if (to.size) await zite.messages.create({ record: { body: NOTE, sender: me, recipients: [...to], isNotification: true } as never }).catch(() => undefined);
    }

    // Read model: only the three parties.
    const cases = (await sql.query(`SELECT * FROM int_cases WHERE tenant_id = $1 AND (student_id = $2 OR reporter_id = $2 OR $3) ORDER BY updated_at DESC LIMIT 200`, [T, me, isOfficer])) as Row[];
    const events = cases.length ? (await sql.query(`SELECT case_id, step, to_state, actor_role, note, at FROM int_events WHERE tenant_id = $1 AND case_id = ANY($2::bigint[]) ORDER BY at`, [T, cases.map((c) => Number(c.id))])) as Row[] : [];
    const tenant = await tenantScope(T);
    const secs = (await zite.sections.findAll({ limit: 2000, fields: ['label', 'instructors'] })).records.filter((s) => tenant.sections.has(s.id));
    const label = Object.fromEntries(secs.map((s) => [s.id, s.label ?? 'Section']));
    const teaching = secs.filter((s) => ids(s.instructors).includes(me));
    const rosters = teaching.length ? (await zite.enrollments.findAll({ limit: 5000 })).records.filter((e) => (e.status === 'Enrolled' || e.status === 'Completed') && teaching.some((s) => ids(e.section).includes(s.id))) : [];
    const officers = isAdmin ? (await sql.query(`SELECT user_id FROM int_staff WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as { user_id: string }[] : [];
    const names = await userNames([...new Set([...cases.flatMap((c) => [String(c.student_id), String(c.reporter_id)]), ...rosters.map((e) => first(e.student) ?? ''), ...officers.map((o) => o.user_id)].filter(Boolean))]);
    return {
      result, isOfficer, isAdmin,
      teaching: teaching.map((s) => ({ id: s.id, label: s.label ?? 'Section', students: rosters.filter((e) => ids(e.section).includes(s.id)).map((e) => ({ id: first(e.student)!, name: names[first(e.student) ?? ''] ?? 'Student' })) })),
      officers: officers.map((o) => ({ id: o.user_id, name: names[o.user_id] ?? 'Member' })),
      cases: cases.map((c) => {
        const role = c.student_id === me ? 'student' : c.reporter_id === me ? 'reporter' : 'officer';
        return {
          id: Number(c.id), ref: `AI-${c.id}`, role, state: String(c.state), version: Number(c.version), section: label[String(c.section_id)] ?? 'Section',
          student: names[String(c.student_id)] ?? 'Student', reporter: names[String(c.reporter_id)] ?? 'Instructor', category: String(c.category), allegation: String(c.allegation),
          workRef: String(c.work_ref), statement: String(c.student_statement), proposedSanction: c.proposed_sanction ? String(c.proposed_sanction) : null, proposalNote: String(c.proposal_note),
          finding: c.finding ? String(c.finding) : null, sanction: c.sanction ? String(c.sanction) : null, decisionNote: String(c.decision_note), decidedAt: iso(c.decided_at),
          decidedByMe: c.decided_by === me, appealNote: String(c.appeal_note), appealOutcome: c.appeal_outcome ? String(c.appeal_outcome) : null,
          events: events.filter((e) => Number(e.case_id) === Number(c.id)).map((e) => ({ step: String(e.step), state: String(e.to_state), by: String(e.actor_role), note: String(e.note), at: iso(e.at) })),
        };
      }),
    };
  },
});
