import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { PTA_MIGRATION } from '../lib/ptaMigration';
import { RSA_MIGRATION } from '../lib/rsaMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...PTA_MIGRATION, ...RSA_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// E23 Research Administration: request intake (institution members + partner organizations via
// their agreement scope) and the project registry. Rules: lib/rsaMigration.ts.
export default createEndpoint({
  description: 'Research requests and the project registry: submission, administrator review and decisions, partner collaboration requests',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setStaff'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('submit'), title: z.string().min(5).max(160), summary: z.string().min(20).max(4000), kind: z.enum(['internal', 'external', 'collaboration']), amountCents: z.number().int().min(0).max(1_000_000_000_00) }),
    z.object({ action: z.literal('review'), id: z.number().int() }),
    z.object({ action: z.literal('decide'), id: z.number().int(), approve: z.boolean(), note: z.string().max(500).default(''), code: z.string().max(20).default('') }),
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
      if (!isAdmin) forbid('Only administrators manage research administrators.');
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : '';
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      fail(await one(`SELECT rsa_set_staff($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
      await audit(a, `Research administrator ${input.on ? 'granted' : 'revoked'}`, `rsa_staff:${uid}`, '', 'Administrator');
    }
    if (input.action === 'submit') {
      const out = await one(`SELECT rsa_submit($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.title, input.summary, input.kind, input.amountCents]);
      if (!out || !out.startsWith('ok:')) forbid(out ?? 'Failed.');
      const newId = Number(out!.split(':')[1]);
      result = { requestId: newId };
      await audit(a, 'Research request submitted', `rsa_request:${newId}`, input.title, 'Member');
    }
    if (input.action === 'review') fail(await one(`SELECT rsa_review($1,$2,$3) AS r`, [me, T, input.id]));
    if (input.action === 'decide') { fail(await one(`SELECT rsa_decide($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.id, input.approve, input.note, input.code])); await audit(a, `Research request ${input.approve ? 'approved' : 'declined'}`, `rsa_request:${input.id}`, input.approve ? input.code : input.note.slice(0, 200), 'Research administrator'); }
    if (input.action === 'close') fail(await one(`SELECT rsa_close($1,$2,$3) AS r`, [me, T, input.id]));

    const isRsaAdmin = Boolean(((await sql.query(`SELECT rsa_is_admin($1,$2) AS b`, [T, me])) as Row[])[0]?.b);
    const [requests, orgs, staff] = await Promise.all([
      sql.query(isRsaAdmin
        ? `SELECT * FROM rsa_requests WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`
        : `SELECT * FROM rsa_requests WHERE tenant_id = $1 AND requester_id = $2 ORDER BY created_at DESC LIMIT 100`, isRsaAdmin ? [T] : [T, me]),
      sql.query(`SELECT id, name FROM pta_orgs ORDER BY name`),
      sql.query(`SELECT user_id FROM rsa_staff WHERE tenant_id = $1 AND revoked_at IS NULL ORDER BY granted_at`, [T]),
    ]) as [Row[], Row[], Row[]];
    const orgName = new Map(orgs.map((o) => [String(o.id), String(o.name)]));
    const names = await userNames([...requests.flatMap((r) => [r.requester_id, r.decided_by]), ...staff.map((s) => s.user_id)].filter(Boolean).map(String));
    const nm = (v: unknown) => (v ? names[String(v)] ?? 'Member' : null);
    return {
      result, isAdmin, isRsaAdmin, institutionName: a.institutionName ?? null,
      admins: staff.map((s) => ({ name: nm(s.user_id), me: s.user_id === me })),
      requests: requests.map((r) => ({ id: Number(r.id), title: String(r.title), summary: String(r.summary), kind: String(r.kind),
        amountCents: Number(r.amount_cents), state: String(r.state), projectCode: r.project_code ? String(r.project_code) : null,
        org: r.org_id ? orgName.get(String(r.org_id)) ?? 'Organization' : null, requester: nm(r.requester_id), mine: r.requester_id === me,
        decisionNote: String(r.decision_note), decidedBy: nm(r.decided_by), at: iso(r.created_at) })),
    };
  },
});
