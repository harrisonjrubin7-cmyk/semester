import { z } from 'zod';
import { ensureDevSchema } from '../../../semester/src/lib/pg';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, fail, schemaReady, SANDBOX_TENANT } from '../lib/db';

export default createEndpoint({
  authenticated: true,
  description: 'A developer’s own production apps: review state, installs at institutions, and suspending their own app',
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('suspendOwn'), appId: z.string() }),
  ]),
  outputSchema: z.object({
    ready: z.boolean(), message: z.string(),
    apps: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), review: z.string(), reviewNote: z.string(), scopes: z.array(z.string()), createdAt: z.string(), installs: z.number(), activeTokens: z.number() })),
    installs: z.array(z.object({ id: z.string(), appId: z.string(), institution: z.string(), scopes: z.array(z.string()), status: z.string(), expiresAt: z.string(), calls: z.number(), denied: z.number(), lastCall: z.string().nullable() })),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const sql = pg();
    await ensureDevSchema();
    const ready = await schemaReady();
    if (!ready) return { ready, message: 'The developer platform update hasn’t reached the database yet. Open Developer apps in Semester once, then reload.', apps: [], installs: [] };
    let message = '';
    if (input.action === 'suspendOwn') {
      const own = (await sql.query(`SELECT developer_tenant FROM dev_apps WHERE id = $1 AND developer_id = $2 AND developer_tenant <> $3`, [input.appId, me, SANDBOX_TENANT])) as { developer_tenant: string }[];
      if (!own.length) fail('That is not one of your production apps.');
      const r = (await sql.query(`UPDATE dev_apps SET status = 'suspended' WHERE id = $1 AND status <> 'suspended' RETURNING id`, [input.appId])) as unknown[];
      if (!r.length) fail('This app is already suspended.');
      await sql.query(`INSERT INTO dev_audit (tenant_id, actor_id, action, target, detail) VALUES ($1,$2,'suspend',$3,'Suspended by its developer')`, [own[0].developer_tenant, me, input.appId]);
      message = 'App suspended. Every install fails on its next call. Semester can reinstate it from the platform console.';
    }
    const [apps, installs, inst] = await Promise.all([
      sql.query(`SELECT a.*, (SELECT count(*)::int FROM dev_installs i WHERE i.app_id = a.id) AS n_all,
          (SELECT count(*)::int FROM dev_installs i WHERE i.app_id = a.id AND i.status = 'active') AS n_active
        FROM dev_apps a WHERE a.developer_id = $1 AND a.developer_tenant <> $2 ORDER BY a.created_at DESC`, [me, SANDBOX_TENANT]),
      sql.query(`SELECT i.id, i.app_id, a.name, i.tenant_id, i.scopes, i.status, i.expires_at,
          (SELECT count(*)::int FROM dev_calls c WHERE c.install_id = i.id) AS calls,
          (SELECT count(*)::int FROM dev_calls c WHERE c.install_id = i.id AND c.result <> 'OK') AS denied,
          (SELECT max(created_at) FROM dev_calls c WHERE c.install_id = i.id) AS last_call
        FROM dev_installs i JOIN dev_apps a ON a.id = i.app_id WHERE a.developer_id = $1 AND a.developer_tenant <> $2 ORDER BY i.created_at DESC LIMIT 200`, [me, SANDBOX_TENANT]),
      zite.institutions.findAll({ limit: 500 }),
    ]) as [Record<string, unknown>[], Record<string, unknown>[], { records: { id: string; name?: string }[] }];
    const tenantName = (id: unknown) => { const s = String(id ?? ''); return inst.records.find((r) => r.id === s)?.name ?? (s || '—'); };
    const iso = (v: unknown) => new Date(String(v)).toISOString();
    return { ready, message,
      apps: apps.map((a) => ({ id: String(a.id), name: String(a.name), status: String(a.status), review: String(a.review_status), reviewNote: String(a.review_note ?? ''), scopes: (a.requested_scopes as string[]) ?? [], createdAt: iso(a.created_at), installs: Number(a.n_all), activeTokens: Number(a.n_active) })),
      installs: installs.map((i) => ({ id: String(i.id), appId: String(i.app_id), institution: tenantName(i.tenant_id), scopes: i.scopes as string[], status: String(i.status), expiresAt: iso(i.expires_at), calls: Number(i.calls), denied: Number(i.denied), lastCall: i.last_call ? iso(i.last_call) : null })),
    };
  },
});
