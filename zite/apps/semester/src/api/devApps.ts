import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAction, audit } from '../lib/server';
import { pg, ensureDevSchema, sha256 } from '../lib/pg';
import { SCOPES, validScopes } from '../lib/devAuth';

const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

export default createEndpoint({
  description: 'Administrators register sandbox apps, install them with scopes for their institution, and revoke installs',
  authenticated: true,
  inputSchema: z.object({
    action: z.enum(['list', 'register', 'requestScopes', 'install', 'revoke', 'rotate', 'suspend']),
    name: z.string().max(80).optional(),
    appId: z.string().optional(),
    installId: z.string().optional(),
    scopes: z.array(z.string()).optional(),
    days: z.number().int().min(1).max(90).optional(),
  }),
  outputSchema: z.object({
    scopes: z.array(z.object({ key: z.string(), label: z.string() })),
    apps: z.array(z.object({ id: z.string(), name: z.string(), status: z.string(), createdAt: z.string(), mine: z.boolean(), requestedScopes: z.array(z.string()), review: z.string(), reviewNote: z.string() })),
    installs: z.array(z.object({ id: z.string(), appId: z.string(), appName: z.string(), scopes: z.array(z.string()), status: z.string(), expiresAt: z.string(), calls: z.number(), denied: z.number(), lastCall: z.string().nullable() })),
    token: z.string().nullable(),
    message: z.string(),
  }),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'devapps.manage');
    await ensureDevSchema();
    const sql = pg();
    const T = a.institutionId;
    let token: string | null = null; let message = '';
    const log = async (action: string, target: string, detail = '') => {
      await sql.query(`INSERT INTO dev_audit (tenant_id, actor_id, action, target, detail) VALUES ($1,$2,$3,$4,$5)`, [T, a.userId, action, target, detail]);
      await audit(a, `Developer app: ${action}`, target, detail, 'Institution');
    };

    if (input.action === 'register') {
      if (!input.name?.trim()) throw new ZiteError('Name the app.');
      const err = validScopes(input.scopes ?? []); if (err) throw new ZiteError(err);
      const id = rid('app');
      await sql.query(`INSERT INTO dev_apps (id, name, developer_id, developer_tenant, requested_scopes) VALUES ($1,$2,$3,$4,$5)`, [id, input.name.trim(), a.userId, T, input.scopes]);
      await log('register', id, `${input.name.trim()} · requests ${(input.scopes ?? []).join(', ')}`);
      message = 'Sandbox app registered. It can be installed here now; other institutions need Semester review first.';
    } else if (input.action === 'requestScopes') {
      const err = validScopes(input.scopes ?? []); if (err) throw new ZiteError(err);
      const r = (await sql.query(`SELECT dev_request_scopes($1,$2,$3,$4) AS e`, [a.userId, T, input.appId, input.scopes])) as { e: string | null }[];
      if (r[0].e) throw new ZiteError(r[0].e);
      await audit(a, 'Developer app: request scopes', input.appId!, (input.scopes ?? []).join(', '), 'Developer');
      message = 'Requested scopes updated. If they changed, the app needs Semester review again before other institutions can install it.';
    } else if (input.action === 'install') {
      const err = validScopes(input.scopes ?? []); if (err) throw new ZiteError(err);
      const id = rid('ins');
      const minted = `smst_sbx_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      // One transaction: review/scope checks, the install and its audit row (lib/devMigration.ts dev_install).
      const r = (await sql.query(`SELECT dev_install($1,$2,$3,$4,$5,$6,$7) AS e`, [a.userId, T, input.appId, input.scopes, await sha256(minted), input.days ?? 30, id])) as { e: string | null }[];
      if (r[0].e) throw new ZiteError(r[0].e);
      await audit(a, 'Developer app: install', id, `${input.appId} · ${(input.scopes ?? []).join(', ')}`, 'Institution');
      token = minted; message = 'Installed. Copy the token now — it will not be shown again.';
    } else if (input.action === 'revoke') {
      const r = (await sql.query(`UPDATE dev_installs SET status = 'revoked', revoked_by = $3, revoked_at = now() WHERE id = $1 AND tenant_id = $2 AND status = 'active' RETURNING id`, [input.installId, T, a.userId])) as unknown[];
      if (!r.length) throw new ZiteError('Install not found or already revoked.');
      await log('revoke', input.installId!); message = 'Revoked. The next call with that token fails.';
    } else if (input.action === 'rotate') {
      const minted = `smst_sbx_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const r = (await sql.query(`SELECT dev_rotate_token($1,$2,$3,$4,$5) AS e`, [a.userId, T, input.installId, await sha256(minted), input.days ?? 30])) as { e: string | null }[];
      if (r[0].e) throw new ZiteError(r[0].e);
      await audit(a, 'Developer app: rotate token', input.installId!, `${input.days ?? 30} days`, 'Institution');
      token = minted; message = 'Token rotated. The old token stops working now — copy the new one, only its hash is stored.';
    } else if (input.action === 'suspend') {
      const r = (await sql.query(`UPDATE dev_apps SET status = 'suspended' WHERE id = $1 AND developer_id = $2 RETURNING id`, [input.appId, a.userId])) as unknown[];
      if (!r.length) throw new ZiteError('Only the developer who registered an app can suspend it.');
      await log('suspend', input.appId!); message = 'App suspended everywhere it is installed.';
    }

    // Tenant-scoped listing: apps this tenant registered or installed; installs of this tenant only.
    // Apps this institution can see: its own, ones it installed, and ones that passed Semester review.
    const apps = (await sql.query(`SELECT a.id, a.name, a.status, a.created_at, a.developer_id = $2 AS mine, a.requested_scopes, a.review_status, coalesce(a.review_note, '') AS review_note
      FROM dev_apps a WHERE a.developer_id = $2 OR a.developer_tenant = $1 OR a.review_status = 'approved' OR EXISTS (SELECT 1 FROM dev_installs i WHERE i.app_id = a.id AND i.tenant_id = $1)
      ORDER BY a.created_at DESC`, [T, a.userId])) as Record<string, unknown>[];
    const installs = (await sql.query(`SELECT i.id, i.app_id, a.name, i.scopes, i.status, i.expires_at,
        (SELECT count(*)::int FROM dev_calls c WHERE c.install_id = i.id) AS calls,
        (SELECT count(*)::int FROM dev_calls c WHERE c.install_id = i.id AND c.result <> 'OK') AS denied,
        (SELECT max(created_at) FROM dev_calls c WHERE c.install_id = i.id) AS last_call
      FROM dev_installs i JOIN dev_apps a ON a.id = i.app_id WHERE i.tenant_id = $1 ORDER BY i.created_at DESC`, [T])) as Record<string, unknown>[];
    return {
      scopes: Object.entries(SCOPES).map(([key, label]) => ({ key, label })),
      apps: apps.map((x) => ({ id: String(x.id), name: String(x.name), status: String(x.status), createdAt: new Date(String(x.created_at)).toISOString(), mine: !!x.mine, requestedScopes: (x.requested_scopes as string[]) ?? [], review: String(x.review_status), reviewNote: String(x.review_note) })),
      installs: installs.map((x) => ({ id: String(x.id), appId: String(x.app_id), appName: String(x.name), scopes: x.scopes as string[], status: String(x.status),
        expiresAt: new Date(String(x.expires_at)).toISOString(), calls: Number(x.calls), denied: Number(x.denied), lastCall: x.last_call ? new Date(String(x.last_call)).toISOString() : null })),
      token, message,
    };
  },
});
