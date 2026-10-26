import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { pg, ensureDevSchema, sha256 } from '../lib/pg';
import { authorizeCall, InstallRow } from '../lib/devAuth';

// Synthetic sandbox data only. Real institution records are never reachable through app tokens.
const DATA: Record<string, unknown[]> = {
  'catalog:read': [{ code: 'SBX 101', title: 'Sandbox Foundations', credits: 3 }, { code: 'SBX 210', title: 'Synthetic Systems', credits: 4 }],
  'sections:read': [{ section: 'SBX 101-A', meets: 'Mon/Wed 10:00', capacity: 30 }, { section: 'SBX 210-B', meets: 'Tue/Thu 14:00', capacity: 24 }],
  'events:read': [{ title: 'Sandbox open house', starts: '2026-11-04T17:00:00Z' }],
};

export default createEndpoint({
  description: 'Sandbox API for developer apps: verifies the app token, install and scope on every call',
  inputSchema: z.object({ token: z.string().max(200), scope: z.string().max(40) }),
  outputSchema: z.object({ ok: z.boolean(), code: z.string(), message: z.string(), synthetic: z.boolean(), data: z.array(z.unknown()) }),
  execute: async ({ input }) => {
    await ensureDevSchema();
    const sql = pg();
    const rows = (await sql.query(`SELECT i.id, i.tenant_id, i.app_id, i.scopes, i.status, i.expires_at, a.status AS app_status
      FROM dev_installs i JOIN dev_apps a ON a.id = i.app_id WHERE i.token_hash = $1`, [await sha256(input.token)])) as Record<string, unknown>[];
    const r = rows[0];
    const install: InstallRow | null = r ? { tenantId: String(r.tenant_id), appId: String(r.app_id), scopes: r.scopes as string[], status: r.status as InstallRow['status'], appStatus: r.app_status as InstallRow['appStatus'], expiresAt: String(r.expires_at) } : null;
    const d = authorizeCall(install, input.scope, new Date());
    await sql.query(`INSERT INTO dev_calls (install_id, tenant_id, scope, result) VALUES ($1,$2,$3,$4)`, [r?.id ?? null, r?.tenant_id ?? null, input.scope, d.ok ? 'OK' : d.code]);
    return d.ok
      ? { ok: true, code: 'OK', message: 'Synthetic sandbox data.', synthetic: true, data: DATA[input.scope] ?? [] }
      : { ok: false, code: d.code, message: d.message, synthetic: true, data: [] };
  },
});
