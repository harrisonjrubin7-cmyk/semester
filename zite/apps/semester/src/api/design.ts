import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope, ids, first } from '../lib/server';
import { pg } from '../lib/pg';
import { CRS_MIGRATION } from '../lib/crsMigration';
import { IDN_MIGRATION } from '../lib/idnMigration';
import { checkText, summary } from '../lib/a11yContentRules';
import { STAGE } from '../lib/designRules';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...CRS_MIGRATION, ...IDN_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Instructional design (S-76 E04), reusing Course Studio: releases publish into crs_syllabus_versions through
// crs_publish_syllabus, the same store the section page shows students. Drafts stay here until the instructor approves the
// exact reviewed draft and publishes it. Instructor status comes from the Zite section on the server, never from the client.
// The accessibility review records the automated content check (lib/a11yContentRules.ts) computed here. Rules: lib/idnMigration.ts.
export default createEndpoint({
  description: 'Instructional design: requests, objective maps, draft versions, accessibility and quality reviews, faculty approval and publication into Course Studio',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setDesigner'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('request'), sectionId: z.string().min(1).max(60), scope: z.string().min(10).max(4000) }),
    z.object({ action: z.literal('claim'), requestId: z.number().int(), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('objective'), requestId: z.number().int(), code: z.string().regex(/^[A-Za-z0-9.-]{1,12}$/), statement: z.string().min(10).max(500),
      level: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']), evidence: z.string().max(500).default('') }),
    z.object({ action: z.literal('draft'), requestId: z.number().int(), body: z.string().min(20).max(40000), note: z.string().max(500).default('') }),
    z.object({ action: z.literal('review'), requestId: z.number().int(), draftId: z.number().int(), kind: z.enum(['accessibility', 'quality']), passed: z.boolean(), findings: z.string().max(4000).default('') }),
    z.object({ action: z.literal('approve'), requestId: z.number().int(), draftId: z.number().int(), hash: z.string().regex(/^[0-9a-f]{64}$/), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('release'), requestId: z.number().int(), impact: z.string().max(1000).default(''), expectedVersion: z.number().int() }),
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
    const designer = !!((await sql.query(`SELECT idn_is_designer($1,$2) AS d`, [T, me])) as { d: boolean }[])[0].d;
    const scope = await tenantScope(T);
    const allSections = (await zite.sections.findAll({ limit: 2000 })).records.filter((s) => scope.sections.has(s.id));
    const teaches = (sectionId: string) => !!allSections.find((s) => s.id === sectionId && ids(s.instructors).includes(me));
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out) forbid(out); };
    const ok = (out: string | null) => { if (!out?.startsWith('ok:')) forbid(out ?? 'Failed.'); return Number(out!.slice(3)); };
    const req = async (id: number) => ((await sql.query(`SELECT * FROM idn_requests WHERE id = $1 AND tenant_id = $2`, [id, T])) as Row[])[0];
    const notify = (to: string[], body: string) => to.length ? zite.messages.create({ record: { body, sender: me, recipients: to, isNotification: true } as never }).catch(() => undefined) : Promise.resolve();
    let result: unknown = null;

    if (input.action === 'setDesigner') {
      if (!isAdmin) forbid('Only administrators manage instructional designers.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !scope.members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT idn_set_designer($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
      await audit(a, `Instructional designer ${input.on ? 'granted' : 'revoked'}`, `idn_designer:${uid}`, '', 'Administrator');
    }
    if (input.action === 'request') {
      if (!scope.sections.has(input.sectionId)) forbid('Section not found.');
      const published = Number(((await sql.query(`SELECT count(*)::int AS n FROM crs_syllabus_versions WHERE section_id = $1`, [input.sectionId])) as Row[])[0].n);
      result = { requestId: ok(await one(`SELECT idn_request($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.sectionId, published ? 'revision' : 'new', input.scope, teaches(input.sectionId)])) };
    }
    if (input.action === 'claim') {
      fail(await one(`SELECT idn_claim($1,$2,$3,$4) AS r`, [me, T, input.requestId, input.expectedVersion]));
      const r = await req(input.requestId); await notify([String(r.requested_by)], 'An instructional designer took on your design request.');
    }
    if (input.action === 'objective' || input.action === 'draft' || input.action === 'approve' || input.action === 'release') {
      const r = await req(input.requestId);
      if (!r) forbid('Request not found.');
      const inst = teaches(String(r.section_id));
      if (input.action === 'objective') fail(await one(`SELECT idn_objective($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.requestId, input.code, input.statement, input.level, input.evidence, inst]));
      if (input.action === 'draft') result = { draftId: ok(await one(`SELECT idn_save_draft($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.requestId, input.body, input.note, inst])) };
      if (input.action === 'approve') {
        fail(await one(`SELECT idn_approve($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.requestId, input.draftId, input.hash, inst, input.expectedVersion]));
        if (r.designer_id) await notify([String(r.designer_id)], 'The instructor approved your draft for publication.');
      }
      if (input.action === 'release') {
        const v = Number(((await sql.query(`SELECT coalesce(max(version), 0)::int AS v FROM crs_syllabus_versions WHERE section_id = $1`, [r.section_id])) as Row[])[0].v);
        fail(await one(`SELECT idn_release($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.requestId, inst, input.impact, v, input.expectedVersion]));
        // Mirror Course Studio's publish: keep the section's current text in step and tell enrolled students.
        const body = String(((await sql.query(`SELECT body FROM crs_syllabus_versions WHERE section_id = $1 ORDER BY version DESC LIMIT 1`, [r.section_id])) as Row[])[0].body);
        await zite.sections.update({ id: String(r.section_id), record: { syllabus: body } as never });
        const students = (await zite.enrollments.findAll({ filters: { section: String(r.section_id) }, limit: 2000 })).records.filter((x) => x.status === 'Enrolled').map((x) => first(x.student)).filter(Boolean) as string[];
        await notify(students, `Course material was ${r.kind === 'revision' ? 'revised' : 'published'}${input.impact ? `: ${input.impact}` : ''}.`);
        await audit(a, 'Designed course material published', `section:${r.section_id}`, input.impact, 'Instructor of record');
      }
    }
    if (input.action === 'review') {
      const d = ((await sql.query(`SELECT body FROM idn_drafts WHERE id = $1 AND request_id = $2`, [input.draftId, input.requestId])) as Row[])[0];
      if (!d) forbid('Draft not found.');
      const auto = summary(checkText(String(d.body), 'draft')).errors;
      fail(await one(`SELECT idn_review($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.requestId, input.draftId, input.kind, input.passed, input.findings, input.kind === 'accessibility' ? auto : 0]));
    }

    // Reads: instructors see their sections' requests; designers see all requests in the tenant.
    const mySections = allSections.filter((s) => ids(s.instructors).includes(me));
    const reqs = (await sql.query(`SELECT * FROM idn_requests WHERE tenant_id = $1 AND ($2 OR section_id = ANY($3::text[])) ORDER BY created_at DESC LIMIT 200`, [T, designer, mySections.map((s) => s.id)])) as Row[];
    const rids = reqs.map((r) => Number(r.id));
    const drafts = rids.length ? (await sql.query(`SELECT * FROM idn_drafts WHERE request_id = ANY($1::bigint[]) ORDER BY rev`, [rids])) as Row[] : [];
    const reviews = rids.length ? (await sql.query(`SELECT * FROM idn_reviews WHERE request_id = ANY($1::bigint[]) ORDER BY at`, [rids])) as Row[] : [];
    const objectives = rids.length ? (await sql.query(`SELECT * FROM idn_objectives WHERE request_id = ANY($1::bigint[]) ORDER BY code`, [rids])) as Row[] : [];
    const team = isAdmin ? ((await sql.query(`SELECT user_id FROM idn_designers WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]).map((x) => String(x.user_id)) : [];
    const names = await userNames([...reqs.flatMap((r) => [r.requested_by, r.designer_id, r.approved_by, r.released_by]), ...drafts.map((d) => d.author_id), ...reviews.map((r) => r.reviewer_id), ...team].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const label = (sid: unknown) => allSections.find((s) => s.id === String(sid))?.label ?? 'Section';

    return {
      result, designer, isAdmin, designers: team.map((t) => nm(t)),
      sections: mySections.map((s) => ({ id: s.id, label: s.label ?? 'Section' })),
      requests: reqs.map((r) => {
        const ds = drafts.filter((d) => String(d.request_id) === String(r.id));
        const latest = ds[ds.length - 1];
        return { id: Number(r.id), section: label(r.section_id), sectionId: String(r.section_id), kind: String(r.kind), scope: String(r.scope), state: String(r.state), stage: STAGE[String(r.state)] ?? String(r.state),
          requestedBy: nm(r.requested_by), designer: nm(r.designer_id), mineAsDesigner: r.designer_id === me, instructor: teaches(String(r.section_id)), version: Number(r.version),
          approvedDraftId: r.approved_draft_id ? Number(r.approved_draft_id) : null, approvedBy: nm(r.approved_by), releasedVersion: r.released_version == null ? null : Number(r.released_version), impactNote: String(r.impact_note),
          latestDraftId: latest ? Number(latest.id) : null,
          objectives: objectives.filter((o) => String(o.request_id) === String(r.id)).map((o) => ({ code: String(o.code), statement: String(o.statement), level: String(o.level), evidence: String(o.evidence) })),
          drafts: ds.map((d) => ({ id: Number(d.id), rev: Number(d.rev), body: String(d.body), sha256: String(d.sha256), note: String(d.note), author: nm(d.author_id), authorIsMe: d.author_id === me, at: iso(d.created_at),
            autoIssues: checkText(String(d.body), 'draft').map((i) => `${i.level}: ${i.message}`) })),
          reviews: reviews.filter((v) => String(v.request_id) === String(r.id)).map((v) => ({ draftId: Number(v.draft_id), kind: String(v.kind), passed: !!v.passed, findings: String(v.findings), autoErrors: Number(v.auto_errors), reviewer: nm(v.reviewer_id), at: iso(v.at) })) };
      }),
    };
  },
});
