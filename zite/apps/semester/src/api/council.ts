import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PCL_MIGRATION } from '../lib/pclMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of PCL_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Portfolio Council: rubrics, reviewer pool, conflicts, validation, credential recommendations and appeals for program-level
// evidence packages. No individual student records. Council members see every package; reviewers see packages assigned to them;
// submitters see their own.
export default createEndpoint({
  description: 'Portfolio Council: rubrics, reviewers, conflict declarations, evidence validation, credential recommendations and appeals',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('member'), email: z.string().email().max(200), role: z.enum(['member', 'chair', 'none']) }),
    z.object({ action: z.literal('rubric'), name: z.string().min(3).max(120), criteria: z.string().min(20).max(8000) }),
    z.object({ action: z.literal('rubricStep'), id: z.number().int(), step: z.enum(['adopt', 'retire']), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('reviewer'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('submit'), title: z.string().min(3).max(200), credential: z.string().min(2).max(120), rubricId: z.number().int(), summary: z.string().min(20).max(8000) }),
    z.object({ action: z.literal('declare'), packageId: z.number().int(), reason: z.string().min(5).max(500) }),
    z.object({ action: z.literal('assign'), packageId: z.number().int(), reviewerId: z.string() }),
    z.object({ action: z.literal('review'), packageId: z.number().int(), score: z.number().int().min(0).max(4), met: z.boolean(), note: z.string().min(10).max(4000) }),
    z.object({ action: z.literal('step'), packageId: z.number().int(), step: z.enum(['close_review', 'recommend', 'appeal', 'close']), note: z.string().max(4000).default(''), expectedVersion: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out && !out.startsWith('ok:')) forbid(out); return out; };
    const byEmail = async (email: string) => {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      return uid;
    };
    const role = await one(`SELECT pcl_role($1,$2) AS r`, [T, me]);
    let result: unknown = null;

    switch (input.action) {
      case 'member': {
        if (!isAdmin) forbid('Only administrators appoint council members.');
        const uid = await byEmail(input.email);
        fail(await one(`SELECT pcl_set_member($1,$2,$3,$4) AS r`, [me, T, uid, input.role]));
        await audit(a, 'Portfolio council role changed', `user:${uid}`, input.role, 'Administrator');
        break;
      }
      case 'rubric': result = fail(await one(`SELECT pcl_rubric($1,$2,$3,$4) AS r`, [me, T, input.name, input.criteria])); break;
      case 'rubricStep': fail(await one(`SELECT pcl_rubric_step($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.step, input.expectedVersion])); break;
      case 'reviewer': fail(await one(`SELECT pcl_reviewer($1,$2,$3,$4) AS r`, [me, T, await byEmail(input.email), input.on])); break;
      case 'submit': result = fail(await one(`SELECT pcl_submit($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.title, input.credential, input.rubricId, input.summary])); break;
      case 'declare': fail(await one(`SELECT pcl_declare($1,$2,$3,$4) AS r`, [me, T, input.packageId, input.reason])); break;
      case 'assign': {
        fail(await one(`SELECT pcl_assign($1,$2,$3,$4) AS r`, [me, T, input.packageId, input.reviewerId]));
        await zite.messages.create({ record: { body: 'You were assigned an evidence package to review. Open Portfolio council in Semester.', sender: me, recipients: [input.reviewerId], isNotification: true } as never }).catch(() => undefined);
        break;
      }
      case 'review': fail(await one(`SELECT pcl_review($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.packageId, input.score, input.met, input.note])); break;
      case 'step': {
        fail(await one(`SELECT pcl_step($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.packageId, input.step, input.note, input.expectedVersion]));
        await audit(a, `Portfolio council: ${input.step.replace('_', ' ')}`, `package:${input.packageId}`, input.note.slice(0, 200), role ?? 'Submitter');
        const sub = ((await sql.query(`SELECT submitted_by FROM pcl_packages WHERE id = $1`, [input.packageId])) as Row[])[0]?.submitted_by;
        if (sub && sub !== me) await zite.messages.create({ record: { body: 'There is an update to your evidence package in Semester (Portfolio council).', sender: me, recipients: [String(sub)], isNotification: true } as never }).catch(() => undefined);
        break;
      }
      case 'get': break;
    }

    const rubrics = (await sql.query(`SELECT * FROM pcl_rubrics WHERE tenant_id = $1 ORDER BY state, name`, [T])) as Row[];
    const pkgs = (await sql.query(`SELECT k.* FROM pcl_packages k WHERE k.tenant_id = $1 AND ($2 OR k.submitted_by = $3 OR EXISTS (SELECT 1 FROM pcl_assignments s WHERE s.package_id = k.id AND s.reviewer_id = $3)
      OR EXISTS (SELECT 1 FROM pcl_reviewers v WHERE v.tenant_id = $1 AND v.user_id = $3 AND v.active AND k.state IN ('submitted','appealed'))) ORDER BY k.id DESC`, [T, !!role, me])) as Row[];
    const pids = pkgs.map((k) => Number(k.id));
    const assigns = pids.length ? (await sql.query(`SELECT * FROM pcl_assignments WHERE package_id = ANY($1)`, [pids])) as Row[] : [];
    const reviews = pids.length ? (await sql.query(`SELECT * FROM pcl_reviews WHERE package_id = ANY($1)`, [pids])) as Row[] : [];
    const conflicts = pids.length ? (await sql.query(`SELECT * FROM pcl_conflicts WHERE package_id = ANY($1)`, [pids])) as Row[] : [];
    const pool = (await sql.query(`SELECT user_id FROM pcl_reviewers WHERE tenant_id = $1 AND active`, [T])) as Row[];
    const members = (await sql.query(`SELECT user_id, role FROM pcl_members WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[];
    const nm = await userNames([...new Set([...rubrics.flatMap((r) => [r.author_id, r.adopted_by]), ...pkgs.flatMap((k) => [k.submitted_by, k.decided_by]), ...assigns.map((s) => s.reviewer_id), ...pool.map((p) => p.user_id), ...members.map((m) => m.user_id)].filter(Boolean).map(String))]);
    const n = (u: unknown) => (u ? nm[String(u)] ?? 'Someone' : '');
    const inPool = pool.some((p) => p.user_id === me);
    return {
      result, me, role, isAdmin, inPool,
      rubrics: rubrics.map((r) => ({ id: Number(r.id), name: String(r.name), criteria: String(r.criteria), state: String(r.state), author: n(r.author_id), mine: r.author_id === me, adoptedBy: n(r.adopted_by), version: Number(r.version) })),
      packages: pkgs.map((k) => { const id = String(k.id); const rv = reviews.filter((x) => String(x.package_id) === id);
        const seeAll = !!role || k.submitted_by === me;
        return { id: Number(k.id), title: String(k.title), credential: String(k.credential), rubric: String(rubrics.find((r) => String(r.id) === String(k.rubric_id))?.name ?? ''), summary: String(k.summary),
          submittedBy: n(k.submitted_by), mine: k.submitted_by === me, state: String(k.state), appealed: !!k.appealed, appealReason: String(k.appeal_reason), decidedBy: n(k.decided_by), decisionNote: String(k.decision_note), version: Number(k.version),
          assigned: assigns.filter((s) => String(s.package_id) === id).map((s) => ({ id: String(s.reviewer_id), name: n(s.reviewer_id), reviewed: rv.some((x) => x.reviewer_id === s.reviewer_id) })),
          myAssignment: assigns.some((s) => String(s.package_id) === id && s.reviewer_id === me), myReview: rv.some((x) => x.reviewer_id === me),
          myConflict: conflicts.some((c) => String(c.package_id) === id && c.reviewer_id === me), iReviewed: rv.some((x) => x.reviewer_id === me),
          conflicted: role ? conflicts.filter((c) => String(c.package_id) === id).map((c) => String(c.reviewer_id)) : [],
          reviews: seeAll ? rv.map((x) => ({ score: Number(x.score), met: !!x.met, note: String(x.note), at: iso(x.at) })) : [] }; }),
      pool: role ? pool.map((p) => ({ id: String(p.user_id), name: n(p.user_id) })) : [],
      members: isAdmin || role ? members.map((m) => ({ name: n(m.user_id), role: String(m.role) })) : [],
    };
  },
});
