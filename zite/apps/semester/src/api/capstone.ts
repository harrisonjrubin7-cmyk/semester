import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { CAP_MIGRATION, CAP_MILESTONES, CAP_CRITERIA } from '../lib/capMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of CAP_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const band = (avg: number) => (avg >= 3.5 ? 'Excellent' : avg >= 2.75 ? 'Good' : avg >= 2 ? 'Satisfactory' : 'Needs further work');

// Undergraduate capstone (cap-001). Students propose and submit; supervisors and second readers (faculty) decide and score.
// Readers score blind: neither sees the other's scores until both are in. The outcome is a recommendation, not a grade.
export default createEndpoint({
  description: 'Capstone: proposal to a faculty supervisor, ordered milestones with review, blind two-reader rubric (a recommendation, not a grade)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('propose'), term: z.string().max(40), title: z.string().max(160), summary: z.string().max(3000), supervisorId: z.string().max(40) }),
    z.object({ action: z.literal('step'), step: z.enum(['accept', 'decline', 'reader', 'submit', 'approve', 'revise', 'score', 'withdraw']), id: z.number().int(), version: z.number().int(),
      note: z.string().max(2000).optional(), readerId: z.string().max(40).optional(), milestone: z.enum(CAP_MILESTONES).optional(), body: z.string().max(8000).optional(), url: z.string().max(500).optional(),
      question: z.number().int().optional(), method: z.number().int().optional(), evidence: z.number().int().optional(), communication: z.number().int().optional(), comment: z.string().max(3000).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const mems = await zite.memberships.findAll({ filters: { institution: T }, limit: 2000 });
    const faculty = mems.records.filter((m) => (m.roles ?? []).includes('Faculty') && m.status === 'Active').map((m) => first(m.member)).filter(Boolean) as string[];
    const call = async (q: string, p: unknown[]) => { const r = ((await sql.query(q, p)) as { r: string | null }[])[0].r; if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.'); return r!.slice(3); };
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: me, recipients: [to], isNotification: true, read: false } as never });

    if (input.action === 'propose') {
      const id = await call(`SELECT cap_propose($1,$2,$3,$4,$5::jsonb) AS r`, [T, me, a.roles.includes('Student'), faculty.includes(input.supervisorId), JSON.stringify(input)]);
      await notify(input.supervisorId, 'A student asked you to supervise their capstone. Open Semester Faculty → Capstones to answer.');
      await audit(a, 'Capstone proposed', `capstone:${id}`, input.title, 'Student');
    } else if (input.action === 'step') {
      const { action: _a, step, id, version, ...p } = input;
      const c = ((await sql.query(`SELECT student_id, supervisor_id FROM cap_projects WHERE id = $1 AND tenant_id = $2`, [id, T])) as Row[])[0];
      if (!c) forbid('Capstone not found.');
      await call(`SELECT cap_step($1,$2,$3,$4,$5,$6,$7::jsonb) AS r`, [T, me, step, id, version, step === 'reader' ? faculty.includes(p.readerId ?? '') : false, JSON.stringify(p)]);
      if (step === 'submit') await notify(String(c!.supervisor_id), `A capstone ${p.milestone} was submitted for your review.`);
      if (['accept', 'decline', 'approve', 'revise'].includes(step)) await notify(String(c!.student_id), `Your capstone supervisor ${step === 'accept' ? 'accepted your proposal' : step === 'decline' ? 'declined your proposal' : step === 'approve' ? 'approved a milestone' : 'asked for revisions'}.`);
      if (step === 'reader' && p.readerId) await notify(p.readerId, 'You were named second reader on a capstone. Open Semester Faculty → Capstones.');
      if (['accept', 'decline', 'approve', 'score'].includes(step)) await audit(a, `Capstone ${step}`, `capstone:${id}`, '', step === 'score' ? 'Reader' : 'Supervisor');
    }

    const projects = (await sql.query(`SELECT p.*, cap_current(p.id) AS current FROM cap_projects p WHERE p.tenant_id = $1 AND (p.student_id = $2 OR p.supervisor_id = $2 OR p.second_reader_id = $2)
      ORDER BY p.created_at DESC LIMIT 100`, [T, me])) as Row[];
    const pids = projects.map((p) => Number(p.id));
    const [subs, scores] = pids.length ? await Promise.all([
      sql.query(`SELECT * FROM cap_submissions WHERE project_id = ANY($1::bigint[]) ORDER BY id`, [pids]) as Promise<Row[]>,
      sql.query(`SELECT * FROM cap_scores WHERE project_id = ANY($1::bigint[])`, [pids]) as Promise<Row[]>,
    ]) : [[], []] as Row[][];
    const names = await userNames([...faculty, ...projects.flatMap((p) => [String(p.student_id), String(p.supervisor_id), String(p.second_reader_id ?? '')])]);
    const nm = (id: unknown) => (id ? names[String(id)] ?? 'Member' : null);
    return {
      me, isStudent: a.roles.includes('Student'), isFaculty: faculty.includes(me), milestones: CAP_MILESTONES, criteria: CAP_CRITERIA,
      faculty: faculty.filter((f) => f !== me).map((f) => ({ id: f, name: names[f] ?? 'Faculty' })),
      projects: projects.map((p) => {
        const role = p.student_id === me ? 'student' : p.supervisor_id === me ? 'supervisor' : 'second_reader';
        const ss = scores.filter((s) => Number(s.project_id) === Number(p.id));
        const both = ss.length === 2;
        // Blind scoring: a reader sees only their own scores until both are in; the student sees them only once evaluated.
        const visible = ss.filter((s) => both ? (role !== 'student' || p.state === 'evaluated') : s.reader_id === me);
        const all = both ? ss.flatMap((s) => CAP_CRITERIA.map((k) => Number(s[k]))) : [];
        const gap = both ? CAP_CRITERIA.filter((k) => Math.abs(Number(ss[0][k]) - Number(ss[1][k])) >= 2) : [];
        return {
          id: Number(p.id), role, term: String(p.term), title: String(p.title), summary: String(p.summary), state: String(p.state), version: Number(p.version),
          student: nm(p.student_id), supervisor: nm(p.supervisor_id), secondReader: nm(p.second_reader_id), declineReason: String(p.decline_reason), current: (p.current as string) ?? null,
          submissions: subs.filter((s) => Number(s.project_id) === Number(p.id)).map((s) => ({ id: Number(s.id), milestone: String(s.milestone), version: Number(s.version), body: String(s.body), url: (s.url as string) ?? null,
            decision: (s.decision as string) ?? null, note: String(s.note), at: iso(s.submitted_at), decidedAt: iso(s.decided_at) })),
          myScoreDone: ss.some((s) => s.reader_id === me),
          scores: visible.map((s) => ({ role: String(s.role), ...Object.fromEntries(CAP_CRITERIA.map((k) => [k, Number(s[k])])), comment: String(s.comment) })),
          recommendation: both && (role !== 'student' || p.state === 'evaluated') ? { average: Math.round((all.reduce((x, y) => x + y, 0) / all.length) * 100) / 100, band: band(all.reduce((x, y) => x + y, 0) / all.length), disagreement: gap } : null,
        };
      }),
    };
  },
});
