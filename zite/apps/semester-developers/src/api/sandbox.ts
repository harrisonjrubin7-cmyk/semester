import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { pg, fail, sha256, schemaReady, SCOPES, FORBIDDEN_SCOPES, SANDBOX_TENANT } from '../lib/db';

// Engineer sandbox: register a test app in the isolated "semester-sandbox" tenant, mint a test token, and call the
// same synthetic API that real installs use. No institution data is reachable from here.
const DATA: Record<string, unknown[]> = {
  'catalog:read': [{ code: 'SBX 101', title: 'Sandbox Foundations', credits: 3 }, { code: 'SBX 210', title: 'Synthetic Systems', credits: 4 }],
  'sections:read': [{ section: 'SBX 101-A', meets: 'Mon/Wed 10:00', capacity: 30 }, { section: 'SBX 210-B', meets: 'Tue/Thu 14:00', capacity: 24 }],
  'events:read': [{ title: 'Sandbox open house', starts: '2026-11-04T17:00:00Z' }],
};
const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

export default createEndpoint({
  description: 'Developer sandbox: test apps and tokens in an isolated tenant, plus a request tester for the app API',
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('createApp'), name: z.string().min(2).max(80), scopes: z.array(z.string()).min(1) }),
    z.object({ action: z.literal('mintToken'), appId: z.string(), scopes: z.array(z.string()).min(1), days: z.number().int().min(1).max(30) }),
    z.object({ action: z.literal('call'), token: z.string().max(200), scope: z.string().max(40) }),
  ]),
  outputSchema: z.object({
    ready: z.boolean(), token: z.string().nullable(), message: z.string(),
    scopes: z.array(z.object({ key: z.string(), label: z.string() })), forbidden: z.array(z.string()),
    apps: z.array(z.object({ id: z.string(), name: z.string(), scopes: z.array(z.string()), status: z.string(), tokens: z.number() })),
    response: z.object({ status: z.number(), body: z.any(), ms: z.number() }).nullable(),
  }),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    const sql = pg();
    const ready = await schemaReady();
    const base = { ready, token: null as string | null, message: '', response: null as null | { status: number; body: unknown; ms: number },
      scopes: Object.entries(SCOPES).map(([key, label]) => ({ key, label })), forbidden: FORBIDDEN_SCOPES };
    if (!ready) return { ...base, apps: [], message: 'The developer platform update hasn’t reached the database yet. Open Developer apps in Semester once, then reload.' };

    const check = (scopes: string[]) => { const bad = scopes.filter((s) => !(s in SCOPES)); if (bad.length) fail(`Scope ${bad.join(', ')} can’t be granted to an app.`); };

    if (input.action === 'createApp') {
      check(input.scopes);
      const id = rid('app');
      await sql.query(`INSERT INTO dev_apps (id, name, developer_id, developer_tenant, requested_scopes) VALUES ($1,$2,$3,$4,$5)`, [id, `[Sandbox] ${input.name.trim()}`, me, SANDBOX_TENANT, input.scopes]);
      await sql.query(`INSERT INTO dev_audit (tenant_id, actor_id, action, target, detail) VALUES ($1,$2,'register',$3,$4)`, [SANDBOX_TENANT, me, id, input.scopes.join(', ')]);
      base.message = 'Test app created in the sandbox tenant.';
    } else if (input.action === 'mintToken') {
      check(input.scopes);
      const owns = (await sql.query(`SELECT 1 FROM dev_apps WHERE id = $1 AND developer_id = $2 AND developer_tenant = $3`, [input.appId, me, SANDBOX_TENANT])) as unknown[];
      if (!owns.length) fail('You can only mint tokens for your own sandbox apps.');
      const minted = `smst_sbx_${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const r = (await sql.query(`SELECT dev_install($1,$2,$3,$4,$5,$6,$7) AS e`, [me, SANDBOX_TENANT, input.appId, input.scopes, await sha256(minted), input.days, rid('ins')])) as { e: string | null }[];
      if (r[0].e) fail(r[0].e);
      base.token = minted; base.message = 'Token minted. Copy it now — only its hash is stored.';
    } else if (input.action === 'call') {
      const t0 = Date.now();
      const rows = (await sql.query(`SELECT i.id, i.tenant_id, i.scopes, i.status, i.expires_at, a.status AS app_status FROM dev_installs i JOIN dev_apps a ON a.id = i.app_id WHERE i.token_hash = $1`, [await sha256(input.token)])) as Record<string, unknown>[];
      const r = rows[0];
      let code = 'OK', status = 200, msg = 'Synthetic sandbox data.';
      if (!(input.scope in SCOPES)) { code = 'UNKNOWN_SCOPE'; status = 400; msg = 'Unknown scope.'; }
      else if (!r) { code = 'NO_INSTALL'; status = 401; msg = 'Token is not valid for any installation.'; }
      else if (r.status === 'revoked') { code = 'REVOKED'; status = 401; msg = 'This installation was revoked.'; }
      else if (r.app_status === 'suspended') { code = 'APP_SUSPENDED'; status = 403; msg = 'This app is suspended.'; }
      else if (new Date(String(r.expires_at)) <= new Date()) { code = 'EXPIRED'; status = 401; msg = 'This token has expired.'; }
      else if (!(r.scopes as string[]).includes(input.scope)) { code = 'SCOPE_NOT_GRANTED'; status = 403; msg = `Scope ${input.scope} was not granted.`; }
      await sql.query(`INSERT INTO dev_calls (install_id, tenant_id, scope, result) VALUES ($1,$2,$3,$4)`, [r?.id ?? null, r?.tenant_id ?? null, input.scope, code]);
      base.response = { status, ms: Date.now() - t0, body: { ok: code === 'OK', code, message: msg, synthetic: true, data: code === 'OK' ? DATA[input.scope] ?? [] : [] } };
    }

    const apps = (await sql.query(`SELECT a.id, a.name, a.requested_scopes, a.status, (SELECT count(*)::int FROM dev_installs i WHERE i.app_id = a.id AND i.status = 'active') AS n
      FROM dev_apps a WHERE a.developer_id = $1 AND a.developer_tenant = $2 ORDER BY a.created_at DESC`, [me, SANDBOX_TENANT])) as Record<string, unknown>[];
    return { ...base, apps: apps.map((a) => ({ id: String(a.id), name: String(a.name), scopes: a.requested_scopes as string[], status: String(a.status), tokens: Number(a.n) })) };
  },
});
