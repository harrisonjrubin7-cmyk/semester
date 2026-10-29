import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { RSA_MIGRATION } from '../lib/rsaMigration';
import { ETH_MIGRATION } from '../lib/ethMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...RSA_MIGRATION, ...ETH_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

// E25 Research Ethics and Protocol Review: committee review of research protocols with
// conflict-of-interest and quorum rules. Rules: lib/ethMigration.ts.
export default createEndpoint({
  description: 'Ethics protocol review: submission, committee reviews, and the chair decision',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), role: z.enum(['member', 'chair']), on: z.boolean() }),
    z.object({ action: z.literal('submit'), projectCode: z.string().max(20).default(''), title: z.string().min(5).max(160), summary: z.string().min(50).max(6000), subjects: z.enum(['human', 'animal', 'both', 'none']), risk: z.enum(['minimal', 'greater']), consent: z.string().max(2000).default('') }),
    z.object({ action: z.literal('begin'), id: z.number().int() }),
    z.object({ action: z.literal('review'), id: z.number().int(), position: z.enum(['approve', 'conditions', 'decline']), note: z.string().min(5).max(1000) }),
    z.object({ action: z.literal('decide'), id: z.number().int(), decision: z.enum(['approve', 'conditions', 'decline']), note: z.string().max(500).default(''), expiresOn: DATE, conditions: z.string().max(2000).default('') }),
    z.object({ action: z.literal('close'), id: z.number().int() }),
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
    const fail = (out: string | null) => { if (out) forbid(out); };
    let result: unknown = null;

    if (input.action === 'setStaff') {
      if (!isAdmin) forbid('Only administrators manage the ethics committee.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT eth_set_staff($1,$2,$3,$4,$5) AS r`, [me, T, uid, input.role, input.on]));
      await audit(a, `Ethics committee ${input.role} ${input.on ? 'granted' : 'revoked'}`, `eth_staff:${uid}`, input.role, 'Administrator');
    }
    if (input.action === 'submit') {
      const out = await one(`SELECT eth_submit($1,$2,$3,$4,$5,$6,$7,$8) AS r`, [me, T, input.projectCode || null, input.title, input.summary, input.subjects, input.risk, input.consent]);
      if (!out || !out.startsWith('ok:')) forbid(out ?? 'Failed.');
      const newId = Number(out!.split(':')[1]);
      result = { protocolId: newId };
      await audit(a, 'Ethics protocol submitted', `eth_protocol:${newId}`, input.title, 'Researcher');
    }
    if (input.action === 'begin') fail(await one(`SELECT eth_begin($1,$2,$3) AS r`, [me, T, input.id]));
    if (input.action === 'review') fail(await one(`SELECT eth_review($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.position, input.note]));
    if (input.action === 'decide') { fail(await one(`SELECT eth_decide($1,$2,$3,$4,$5,$6,$7) AS r`, [me, T, input.id, input.decision, input.note, input.expiresOn ?? null, input.conditions])); await audit(a, `Ethics protocol ${input.decision === 'decline' ? 'declined' : 'approved'}`, `eth_protocol:${input.id}`, input.decision, 'Ethics chair'); }
    if (input.action === 'close') fail(await one(`SELECT eth_close($1,$2,$3) AS r`, [me, T, input.id]));

    const myRole = ((await sql.query(`SELECT eth_role($1,$2) AS r`, [T, me])) as { r: string | null }[])[0]?.r ?? null;
    const onCommittee = myRole !== null;
    const [protocols, reviews, projects, staff] = await Promise.all([
      sql.query(onCommittee
        ? `SELECT p.*, r.project_code FROM eth_protocols p LEFT JOIN rsa_requests r ON r.id = p.project_id WHERE p.tenant_id = $1 ORDER BY p.created_at DESC LIMIT 200`
        : `SELECT p.*, r.project_code FROM eth_protocols p LEFT JOIN rsa_requests r ON r.id = p.project_id WHERE p.tenant_id = $1 AND p.submitter_id = $2 ORDER BY p.created_at DESC LIMIT 100`, onCommittee ? [T] : [T, me]),
      sql.query(`SELECT rev.* FROM eth_reviews rev JOIN eth_protocols p ON p.id = rev.protocol_id WHERE p.tenant_id = $1 ORDER BY rev.at`, [T]),
      sql.query(`SELECT project_code, title FROM rsa_requests WHERE tenant_id = $1 AND project_code IS NOT NULL AND state IN ('approved','closed') ORDER BY project_code`, [T]),
      sql.query(`SELECT user_id, role FROM eth_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY granted_at`, [T]),
    ]) as [Row[], Row[], Row[], Row[]];
    const names = await userNames([...protocols.flatMap((p) => [p.submitter_id, p.decided_by]), ...reviews.map((r) => r.reviewer_id), ...staff.map((s) => s.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    const day = (v: unknown) => (v ? new Date(String(v)).toISOString().slice(0, 10) : null);
    return {
      result, isAdmin, myRole, institutionName: a.institutionName ?? null,
      committee: staff.map((s) => ({ name: nm(s.user_id), role: String(s.role), me: s.user_id === me })),
      projects: projects.map((p) => ({ code: String(p.project_code), title: String(p.title) })),
      protocols: protocols.map((p) => ({ id: Number(p.id), title: String(p.title), summary: String(p.summary), subjects: String(p.subjects), risk: String(p.risk),
        consent: String(p.consent), state: String(p.state), projectCode: p.project_code ? String(p.project_code) : null,
        submitter: nm(p.submitter_id), submitterMe: p.submitter_id === me, expiresOn: day(p.expires_on), conditionsText: String(p.conditions_text),
        decisionNote: String(p.decision_note), decidedBy: nm(p.decided_by),
        reviews: reviews.filter((r) => String(r.protocol_id) === String(p.id)).map((r) => ({ reviewer: nm(r.reviewer_id), position: String(r.position), note: String(r.note), mine: r.reviewer_id === me })) })),
    };
  },
});
