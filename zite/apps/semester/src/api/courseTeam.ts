import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureTeam, courseRole } from '../lib/teamServer';
import { validateRubric, rubricMax, Criterion } from '../lib/rubricRules';

type Row = Record<string, unknown>;
const fail = (e: string | null | undefined) => { if (e) forbid(e); };
const NOT_MEMBER = 'That person is not an active member of your institution.';
const Crit = z.object({ id: z.string().min(1).max(40), name: z.string().max(200), levels: z.array(z.object({ label: z.string().max(120), points: z.number() })).max(6) });

// Teaching team (Faculty "Course Studio"; TA app "delegated grading"): instructors delegate grading in one section for a
// set time and publish rubrics. Delegates read rubrics and grade; only instructors of record delegate, publish or release.
export default createEndpoint({
  description: 'Teaching team: grading delegates for a section (time-limited, revocable) and versioned rubrics',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), sectionId: z.string() }),
    z.object({ action: z.literal('delegate'), sectionId: z.string(), email: z.string().email().max(200), days: z.number().int().min(1).max(180) }),
    z.object({ action: z.literal('revoke'), sectionId: z.string(), delegationId: z.number().int() }),
    z.object({ action: z.literal('publishRubric'), sectionId: z.string(), key: z.string().regex(/^[a-z0-9-]{2,60}$/), title: z.string().max(120), criteria: z.array(Crit).max(20), expectedVersion: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensureTeam();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    if (!(await tenantScope(T)).sections.has(input.sectionId)) forbid('That section is not in your institution.');
    const role = await courseRole(T, input.sectionId, me);
    if (!role) forbid('You do not teach or grade in this section.');
    const instructorOnly = () => { if (role !== 'instructor') forbid('Only an instructor of record can do that.'); };

    if (input.action === 'delegate') {
      instructorOnly();
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const target = rows[0] ? String((rows[0] as Row).id) : null;
      if (!target) forbid(NOT_MEMBER);
      const m = await zite.memberships.findAll({ filters: { member: target!, institution: T }, limit: 5 });
      if (!m.records.some((x) => x.status === 'Active')) forbid(NOT_MEMBER);
      const enrolled = (await zite.enrollments.findAll({ filters: { student: target!, section: input.sectionId }, limit: 5 })).records.some((e) => e.status !== 'Dropped');
      if (enrolled) forbid('A student in this section cannot grade it.');
      fail(((await sql.query(`SELECT crs_delegate($1,$2,$3,$4,$5) AS e`, [T, input.sectionId, me, target, input.days])) as { e: string | null }[])[0].e);
      await audit(a, 'Grading delegated', `section:${input.sectionId}`, `${input.days} days`, 'Instructor of record');
      await zite.messages.create({ record: { body: `You can grade submitted work in a course section for ${input.days} days. Open Learn to find it.`, sender: me, recipients: [target!], isNotification: true } as never }).catch(() => undefined);
    }
    if (input.action === 'revoke') {
      instructorOnly();
      const n = ((await sql.query(`UPDATE crs_delegations SET revoked_at = now() WHERE id = $1 AND tenant_id = $2 AND section_id = $3 AND revoked_at IS NULL RETURNING id`, [input.delegationId, T, input.sectionId])) as Row[]).length;
      if (!n) forbid('No live delegation to end.');
      await audit(a, 'Grading delegation ended', `section:${input.sectionId}`, '', 'Instructor of record');
    }
    if (input.action === 'publishRubric') {
      instructorOnly();
      const cs = input.criteria as Criterion[];
      fail(validateRubric(input.title, cs));
      fail(((await sql.query(`SELECT rbr_publish($1,$2,$3,$4,$5,$6::jsonb,$7,$8) AS e`, [T, input.sectionId, input.key, me, input.title, JSON.stringify(cs), rubricMax(cs), input.expectedVersion])) as { e: string | null }[])[0].e);
      await audit(a, 'Rubric published', `section:${input.sectionId}`, `${input.key}`, 'Instructor of record');
    }

    const [dels, rubrics] = await Promise.all([
      role === 'instructor' ? sql.query(`SELECT * FROM crs_delegations WHERE tenant_id = $1 AND section_id = $2 ORDER BY created_at DESC LIMIT 50`, [T, input.sectionId]) as Promise<Row[]> : Promise.resolve([] as Row[]),
      sql.query(`SELECT DISTINCT ON (rubric_key) rubric_key, version, title, criteria, max_points FROM rbr_versions WHERE tenant_id = $1 AND section_id = $2 ORDER BY rubric_key, version DESC`, [T, input.sectionId]) as Promise<Row[]>,
    ]);
    const names = await userNames(dels.map((d) => String(d.delegate_id)));
    const now = Date.now();
    return {
      role,
      delegations: dels.map((d) => ({ id: Number(d.id), name: names[String(d.delegate_id)] ?? 'Member', until: new Date(String(d.expires_at)).toISOString(),
        live: !d.revoked_at && new Date(String(d.expires_at)).getTime() > now })),
      rubrics: rubrics.map((r) => ({ key: String(r.rubric_key), version: Number(r.version), title: String(r.title), criteria: r.criteria as Criterion[], max: Number(r.max_points) })),
    };
  },
});
