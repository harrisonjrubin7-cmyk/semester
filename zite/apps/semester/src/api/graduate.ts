import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, first, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { GRD_MIGRATION } from '../lib/grdMigration';

let ready: Promise<void> | null = null;
const ensureGrd = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const s of GRD_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const KINDS = ['program_plan', 'proposal', 'qualifying_exam', 'prospectus', 'full_draft', 'defense', 'final_submission'] as const;

// Graduate milestones (lib/grdMigration.ts). The student sees and drives their own plan; faculty see only students whose
// committee they accepted, and only those students' milestones and reviews. Funding entries are visible to the student alone.
export default createEndpoint({
  description: 'Graduate milestones: committee invitations, milestone versions and reviews, defense scheduling, personal funding notes',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('invite'), memberId: z.string(), role: z.enum(['chair', 'member']) }),
    z.object({ action: z.literal('remove'), memberId: z.string() }),
    z.object({ action: z.literal('respond'), studentId: z.string(), accept: z.boolean() }),
    z.object({ action: z.literal('plan'), id: z.string().min(8).max(80), kind: z.enum(KINDS), title: z.string().min(3).max(200), dueOn: z.string().nullable() }),
    z.object({ action: z.literal('submit'), id: z.string(), summary: z.string().min(10).max(2000), link: z.string().max(800).nullable(), scheduledAt: z.string().nullable() }),
    z.object({ action: z.literal('review'), id: z.string(), version: z.number().int(), decision: z.enum(['approve', 'revise']), note: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('addFunding'), id: z.string().min(8).max(80), kind: z.enum(['assistantship', 'fellowship', 'grant', 'other']), source: z.string().min(2).max(120), term: z.string().min(2).max(40), hours: z.number().min(0).max(40).nullable(), note: z.string().max(300) }),
    z.object({ action: z.literal('removeFunding'), id: z.string() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureGrd();
    const sql = pg();
    const a = await requireAccess(context.user.id);
    const uid = a.userId, T = a.institutionId;
    const call = async (q: string, p: unknown[]) => fail(((await sql.query(q, p)) as { e: string | null }[])[0].e);
    const notify = (to: string, body: string) => zite.messages.create({ record: { body, sender: uid, recipients: [to], isNotification: true } as never }).catch(() => undefined);
    const mems = await zite.memberships.findAll({ filters: { institution: T }, limit: 500 });
    const faculty = mems.records.filter((m) => (m.roles ?? []).includes('Faculty') && m.status === 'Active').map((m) => first(m.member)).filter(Boolean) as string[];

    switch (input.action) {
      case 'invite':
        if (!faculty.includes(input.memberId)) fail('Committee members must be active faculty at your institution.');
        await call(`SELECT grd_invite($1,$2,$3,$4) AS e`, [uid, T, input.memberId, input.role]);
        await notify(input.memberId, `You were invited to a graduate committee as ${input.role}. Open Progress → Graduate milestones to respond.`);
        await audit(a, 'Committee invitation sent', `user:${input.memberId}`, input.role, 'Owner');
        break;
      case 'remove': await call(`SELECT grd_remove($1,$2,$3) AS e`, [uid, T, input.memberId]); await audit(a, 'Committee member removed', `user:${input.memberId}`, '', 'Owner'); break;
      case 'respond':
        await call(`SELECT grd_respond($1,$2,$3,$4) AS e`, [uid, T, input.studentId, input.accept]);
        await notify(input.studentId, input.accept ? 'A faculty member accepted your committee invitation.' : 'A faculty member declined your committee invitation.');
        await audit(a, input.accept ? 'Committee invitation accepted' : 'Committee invitation declined', `user:${input.studentId}`, '', 'Faculty');
        break;
      case 'plan': await call(`SELECT grd_plan($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.kind, input.title, input.dueOn || null]); break;
      case 'submit': {
        await call(`SELECT grd_submit($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.summary, input.link || null, input.scheduledAt || null]);
        const members = (await sql.query(`SELECT member_id FROM grd_committee WHERE tenant_id = $1 AND student_id = $2 AND state = 'accepted'`, [T, uid])) as Row[];
        for (const m of members) await notify(String(m.member_id), 'A graduate milestone was submitted for your review.');
        await audit(a, 'Milestone submitted', `milestone:${input.id}`, '', 'Owner');
        break;
      }
      case 'review': {
        await call(`SELECT grd_review($1,$2,$3,$4,$5,$6) AS e`, [uid, T, input.id, input.version, input.decision, input.note]);
        const m = ((await sql.query(`SELECT student_id, title, state FROM grd_milestones WHERE id = $1`, [input.id])) as Row[])[0];
        if (m) await notify(String(m.student_id), `New committee review on “${m.title}” (${m.state}).`);
        await audit(a, `Milestone review: ${input.decision}`, `milestone:${input.id}`, '', 'Committee member');
        break;
      }
      case 'addFunding':
        await sql.query(`INSERT INTO grd_funding (id, tenant_id, student_id, kind, source, term, hours_per_week, note) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [input.id, T, uid, input.kind, input.source.trim(), input.term.trim(), input.hours, input.note.trim()]);
        break;
      case 'removeFunding':
        await sql.query(`UPDATE grd_funding SET removed_at = now() WHERE id = $1 AND tenant_id = $2 AND student_id = $3 AND removed_at IS NULL`, [input.id, T, uid]);
        break;
    }

    const mapM = (m: Row) => ({ id: String(m.id), kind: String(m.kind), title: String(m.title), dueOn: m.due_on ? String(m.due_on).slice(0, 10) : null, state: String(m.state),
      version: Number(m.version), summary: (m.summary as string) ?? '', link: (m.link as string) ?? null, scheduledAt: iso(m.scheduled_at), approvedAt: iso(m.approved_at) });
    const [committee, milestones, funding, asMember] = await Promise.all([
      sql.query(`SELECT * FROM grd_committee WHERE tenant_id = $1 AND student_id = $2 AND state IN ('invited','accepted','declined') ORDER BY role, invited_at`, [T, uid]) as Promise<Row[]>,
      sql.query(`SELECT * FROM grd_milestones WHERE tenant_id = $1 AND student_id = $2 ORDER BY due_on NULLS LAST, number`, [T, uid]) as Promise<Row[]>,
      sql.query(`SELECT * FROM grd_funding WHERE tenant_id = $1 AND student_id = $2 AND removed_at IS NULL ORDER BY created_at DESC`, [T, uid]) as Promise<Row[]>,
      sql.query(`SELECT * FROM grd_committee WHERE tenant_id = $1 AND member_id = $2 AND state IN ('invited','accepted')`, [T, uid]) as Promise<Row[]>,
    ]);
    const myIds = milestones.map((m) => String(m.id));
    const reviews = myIds.length ? (await sql.query(`SELECT * FROM grd_reviews WHERE milestone_id = ANY($1) ORDER BY at`, [myIds])) as Row[] : [];
    const accepted = asMember.filter((c) => c.state === 'accepted').map((c) => String(c.student_id));
    const theirM = accepted.length ? (await sql.query(`SELECT * FROM grd_milestones WHERE tenant_id = $1 AND student_id = ANY($2) AND state IN ('under_review','revisions','approved') ORDER BY (state = 'under_review') DESC, number DESC LIMIT 100`, [T, accepted])) as Row[] : [];
    const myReviews = theirM.length ? (await sql.query(`SELECT milestone_id, version, decision FROM grd_reviews WHERE member_id = $1 AND milestone_id = ANY($2)`, [uid, theirM.map((m) => String(m.id))])) as Row[] : [];
    const names = await userNames([...committee.map((c) => String(c.member_id)), ...reviews.map((r) => String(r.member_id)), ...asMember.map((c) => String(c.student_id)), ...faculty]);
    return {
      isFaculty: faculty.includes(uid),
      committee: committee.map((c) => ({ id: String(c.member_id), name: names[String(c.member_id)] ?? 'Faculty', role: String(c.role), state: String(c.state) })),
      faculty: faculty.filter((f) => f !== uid && !committee.some((c) => c.member_id === f && c.state !== 'declined')).map((f) => ({ id: f, name: names[f] ?? 'Faculty' })),
      milestones: milestones.map((m) => ({ ...mapM(m), reviews: reviews.filter((r) => r.milestone_id === m.id).map((r) => ({ by: names[String(r.member_id)] ?? 'Member', version: Number(r.version), decision: String(r.decision), note: String(r.note), at: iso(r.at) })) })),
      funding: funding.map((f) => ({ id: String(f.id), kind: String(f.kind), source: String(f.source), term: String(f.term), hours: f.hours_per_week == null ? null : Number(f.hours_per_week), note: String(f.note) })),
      invitations: asMember.filter((c) => c.state === 'invited').map((c) => ({ studentId: String(c.student_id), student: names[String(c.student_id)] ?? 'Student', role: String(c.role) })),
      toReview: theirM.map((m) => ({ ...mapM(m), student: names[String(m.student_id)] ?? 'Student', reviewed: myReviews.some((r) => r.milestone_id === m.id && Number(r.version) === Number(m.version)) })),
    };
  },
});
