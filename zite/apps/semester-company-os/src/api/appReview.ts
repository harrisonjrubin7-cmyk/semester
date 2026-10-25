import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg } from '../lib/fin';
import { rolesOf } from '../lib/coRoles';

// Semester's publisher review of developer apps (APP-017). Approval lets other institutions install an app for exactly
// the scopes reviewed; each institution still approves its own install. The decision itself runs in dev_review()
// (apps/semester/src/lib/devMigration.ts): reviewer ≠ developer, decision bound to the scopes shown, audit in the same transaction.
const forbid = (m: string): never => { throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); };

export default createEndpoint({
  description: 'Lists developer apps awaiting Semester review and records reviewer decisions',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('decide'), appId: z.string(), approve: z.boolean(), seenScopes: z.array(z.string()).min(1), note: z.string().max(500) }),
  ]),
  outputSchema: z.object({
    me: z.string(), ready: z.boolean(),
    apps: z.array(z.object({ id: z.string(), name: z.string(), developer: z.string(), developerId: z.string(), status: z.string(), scopes: z.array(z.string()),
      review: z.string(), reviewedBy: z.string(), reviewedAt: z.string().nullable(), note: z.string(), installs: z.number() })),
    message: z.string(),
  }),
  execute: async ({ input, context }) => {
    const sql = pg();
    const me = context.user.id;
    if (!(await rolesOf(me)).includes('app_reviewer')) forbid('You don’t have the app reviewer role.');

    const ready = ((await sql.query(`SELECT to_regprocedure('dev_review(text,text,boolean,text[],text)') IS NOT NULL AS ok`)) as { ok: boolean }[])[0].ok;
    let message = '';
    if (input.action === 'decide') {
      if (!ready) forbid('The developer platform update hasn’t reached the database yet. Open the Developer apps page in Semester once, then retry.');
      const r = (await sql.query(`SELECT dev_review($1,$2,$3,$4,$5) AS e`, [me, input.appId, input.approve, input.seenScopes, input.note])) as { e: string | null }[];
      if (r[0].e) forbid(r[0].e);
      message = input.approve ? 'Approved. Other institutions can now install it for these scopes, each with their own approval.' : 'Rejected. Only the developer’s institution can install it.';
    }
    if (!ready) return { me, ready, apps: [], message: 'Waiting for the developer platform update.' };

    const rows = (await sql.query(`SELECT a.id, a.name, a.developer_id, a.status, a.requested_scopes, a.review_status, coalesce(a.reviewed_by, '') AS reviewed_by, a.reviewed_at,
        coalesce(a.review_note, '') AS note, (SELECT count(*)::int FROM dev_installs i WHERE i.app_id = a.id AND i.status = 'active') AS installs
      FROM dev_apps a ORDER BY (a.review_status = 'unreviewed') DESC, a.created_at DESC LIMIT 200`)) as Record<string, unknown>[];
    const { records } = await zite.auth.findAllUsers({ limit: 200 });
    const name = (id: unknown) => { const u = records.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown developer'; };
    return {
      me, ready, message,
      apps: rows.map((r) => ({ id: String(r.id), name: String(r.name), developer: name(r.developer_id), developerId: String(r.developer_id), status: String(r.status),
        scopes: (r.requested_scopes as string[]) ?? [], review: String(r.review_status), reviewedBy: r.reviewed_by ? name(r.reviewed_by) : '',
        reviewedAt: r.reviewed_at ? new Date(String(r.reviewed_at)).toISOString() : null, note: String(r.note), installs: Number(r.installs) })),
    };
  },
});
