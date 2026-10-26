import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, fail, isReviewer, schemaReady, COMPANY } from '../lib/db';

const app = z.object({
  id: z.string(), name: z.string(), developer: z.string(), developerId: z.string(), developerTenant: z.string(), status: z.string(),
  scopes: z.array(z.string()), review: z.string(), reviewedBy: z.string(), reviewedAt: z.string().nullable(), note: z.string(),
  installs: z.number(), calls: z.number(), denied: z.number(), createdAt: z.string(),
});

export default createEndpoint({
  description: 'Platform console for developer apps: list apps, installs and audit; review, suspend, reinstate and revoke',
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('decide'), appId: z.string(), approve: z.boolean(), seenScopes: z.array(z.string()).min(1), note: z.string().max(500) }),
    z.object({ action: z.literal('setStatus'), appId: z.string(), status: z.enum(['sandbox', 'suspended']), reason: z.string().min(5).max(300) }),
    z.object({ action: z.literal('revokeInstall'), installId: z.string(), reason: z.string().min(5).max(300) }),
  ]),
  outputSchema: z.object({
    me: z.string(), reviewer: z.boolean(), ready: z.boolean(), message: z.string(),
    apps: z.array(app),
    installs: z.array(z.object({ id: z.string(), appId: z.string(), appName: z.string(), tenant: z.string(), scopes: z.array(z.string()), status: z.string(), expiresAt: z.string(), calls: z.number(), denied: z.number(), lastCall: z.string().nullable() })),
    audit: z.array(z.object({ id: z.string(), tenant: z.string(), actor: z.string(), action: z.string(), target: z.string(), detail: z.string(), at: z.string() })),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const sql = pg();
    const reviewer = await isReviewer(me);
    const ready = await schemaReady();
    const empty = { me, reviewer, ready, apps: [], installs: [], audit: [] };
    if (!reviewer) return { ...empty, message: 'Ask the founder for the app reviewer role to see developer apps.' };
    if (!ready) return { ...empty, message: 'The developer platform update hasn’t reached the database yet. Open Developer apps in Semester once, then reload.' };

    let message = '';
    const log = (action: string, target: string, detail: string) =>
      sql.query(`INSERT INTO dev_audit (tenant_id, actor_id, action, target, detail) VALUES ($1,$2,$3,$4,$5)`, [COMPANY, me, action, target, detail]);

    if (input.action === 'decide') {
      const r = (await sql.query(`SELECT dev_review($1,$2,$3,$4,$5) AS e`, [me, input.appId, input.approve, input.seenScopes, input.note])) as { e: string | null }[];
      if (r[0].e) fail(r[0].e);
      message = input.approve ? 'Approved for exactly these scopes. Each institution still approves its own install.' : 'Rejected. Only the developer’s institution can install it.';
    } else if (input.action === 'setStatus') {
      const cur = (await sql.query(`SELECT developer_id, status FROM dev_apps WHERE id = $1`, [input.appId])) as { developer_id: string; status: string }[];
      if (!cur.length || cur[0].status === input.status) fail('Nothing changed — the app is already in that state.');
      if (input.status === 'sandbox' && cur[0].developer_id === me) fail('You registered this app, so someone else must reinstate it.');
      await sql.query(`UPDATE dev_apps SET status = $2 WHERE id = $1`, [input.appId, input.status]);
      await log(input.status === 'suspended' ? 'platform.suspend' : 'platform.reinstate', input.appId, input.reason);
      message = input.status === 'suspended' ? 'Suspended. Every install fails on its next call.' : 'Reinstated.';
    } else if (input.action === 'revokeInstall') {
      const r = (await sql.query(`UPDATE dev_installs SET status = 'revoked', revoked_by = $2, revoked_at = now() WHERE id = $1 AND status = 'active' RETURNING id`, [input.installId, me])) as unknown[];
      if (!r.length) fail('Install not found or already revoked.');
      await log('platform.revoke', input.installId, input.reason);
      message = 'Token revoked. The next call with it fails.';
    }

    const [apps, installs, audit, inst] = await Promise.all([
      sql.query(`SELECT a.*, coalesce(a.developer_tenant,'') AS dt,
          (SELECT count(*)::int FROM dev_installs i WHERE i.app_id = a.id AND i.status = 'active') AS n_inst,
          (SELECT count(*)::int FROM dev_calls c JOIN dev_installs i ON i.id = c.install_id WHERE i.app_id = a.id) AS n_calls,
          (SELECT count(*)::int FROM dev_calls c JOIN dev_installs i ON i.id = c.install_id WHERE i.app_id = a.id AND c.result <> 'OK') AS n_denied
        FROM dev_apps a ORDER BY (a.review_status = 'unreviewed') DESC, a.created_at DESC LIMIT 300`),
      sql.query(`SELECT i.id, i.app_id, a.name, i.tenant_id, i.scopes, i.status, i.expires_at,
          (SELECT count(*)::int FROM dev_calls c WHERE c.install_id = i.id) AS calls,
          (SELECT count(*)::int FROM dev_calls c WHERE c.install_id = i.id AND c.result <> 'OK') AS denied,
          (SELECT max(created_at) FROM dev_calls c WHERE c.install_id = i.id) AS last_call
        FROM dev_installs i JOIN dev_apps a ON a.id = i.app_id ORDER BY i.created_at DESC LIMIT 300`),
      sql.query(`SELECT id, tenant_id, actor_id, action, target, detail, created_at FROM dev_audit ORDER BY id DESC LIMIT 100`),
      zite.institutions.findAll({ limit: 500 }),
    ]) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[], { records: { id: string; name?: string }[] }];

    const ids = [...new Set([...apps.map((a) => String(a.developer_id)), ...apps.map((a) => String(a.reviewed_by ?? '')), ...audit.map((a) => String(a.actor_id))].filter(Boolean))];
    const users = ids.length ? (await zite.sql({ query: `SELECT "id","name","email" FROM "ziteUsers" WHERE "id" = ANY($1)`, params: [ids] })).rows : [];
    const who = (id: unknown) => { if (String(id) === me) return 'You'; const u = users.find((x) => String(x.id) === String(id)); return u ? String(u.name || u.email) : 'Unknown'; };
    const tenant = (id: unknown) => { const s = String(id ?? ''); return s === COMPANY ? 'Semester' : s === 'semester-sandbox' ? 'Sandbox' : inst.records.find((r) => r.id === s)?.name ?? (s || '—'); };
    const iso = (v: unknown) => new Date(String(v)).toISOString();

    return {
      me, reviewer, ready, message,
      apps: apps.map((a) => ({ id: String(a.id), name: String(a.name), developer: who(a.developer_id), developerId: String(a.developer_id), developerTenant: tenant(a.dt),
        status: String(a.status), scopes: (a.requested_scopes as string[]) ?? [], review: String(a.review_status), reviewedBy: a.reviewed_by ? who(a.reviewed_by) : '',
        reviewedAt: a.reviewed_at ? iso(a.reviewed_at) : null, note: String(a.review_note ?? ''), installs: Number(a.n_inst), calls: Number(a.n_calls), denied: Number(a.n_denied), createdAt: iso(a.created_at) })),
      installs: installs.map((i) => ({ id: String(i.id), appId: String(i.app_id), appName: String(i.name), tenant: tenant(i.tenant_id), scopes: i.scopes as string[], status: String(i.status),
        expiresAt: iso(i.expires_at), calls: Number(i.calls), denied: Number(i.denied), lastCall: i.last_call ? iso(i.last_call) : null })),
      audit: audit.map((a) => ({ id: String(a.id), tenant: tenant(a.tenant_id), actor: who(a.actor_id), action: String(a.action), target: String(a.target), detail: String(a.detail), at: iso(a.created_at) })),
    };
  },
});
