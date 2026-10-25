import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAccess } from '../lib/server';
import { ROLE_APPS, appsForRoles, gapStats, roleAppByKey, HOST_LABEL } from '../lib/roleApps';
import { ROLE_APP_SPECS } from '../lib/roleAppSpecs';
import { audit } from '../lib/server';
import { pg } from '../lib/pg';
import { CTX_MIGRATION } from '../lib/ctxMigration';

let ready: Promise<void> | null = null;
const ensureCtx = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of CTX_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};

// Role apps (owner build pack, 69 roles). Which apps a person opens is decided from their membership on the server.
// Opening an app grants nothing: every screen it links to still enforces its own permissions.
export default createEndpoint({
  description: 'Role app launcher: the role apps your memberships open, one app home, and the 69-app gap map for administrators',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('mine') }),
    z.object({ action: z.literal('open'), key: z.string().max(60) }),
    z.object({ action: z.literal('catalog') }),
    z.object({ action: z.literal('switch'), key: z.string().max(60) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    const mine = appsForRoles(a.roles);
    const spec = (k: string) => { const s = ROLE_APP_SPECS[k]; return s ? { family: s[0], target: s[1], boundary: s[2] } : null; };
    const view = (x: (typeof ROLE_APPS)[number]) => ({ ...x, hostLabel: HOST_LABEL[x.host], stats: gapStats([x]), spec: spec(x.key) });
    await ensureCtx();
    const sql = pg();
    if (input.action === 'switch') {
      if (!mine.some((m) => m.key === input.key)) throw new ZiteError({ code: 'FORBIDDEN', message: 'not your app', userFacingMessage: 'You can only switch to an app for a role you hold here.' });
      await sql.query(`SELECT ctx_switch($1,$2,$3)`, [a.institutionId, a.userId, input.key]);
      await audit(a, 'Active app switched', `user:${a.userId}`, input.key, 'Owner');
    }
    const cur = ((await sql.query(`SELECT app_key FROM ctx_active WHERE tenant_id = $1 AND user_id = $2`, [a.institutionId, a.userId])) as { app_key: string }[])[0]?.app_key ?? null;
    // A stored choice that the person no longer holds is ignored (role removed): the context re-resolves, never carries over.
    const active = cur && mine.some((m) => m.key === cur) ? cur : mine[0]?.key ?? null;
    if (input.action === 'open') {
      const app = roleAppByKey(input.key);
      if (!app || !mine.some((m) => m.key === app.key)) throw new ZiteError({ code: 'FORBIDDEN', message: 'not your app', userFacingMessage: 'This app is not part of your role here.' });
      return { ...view(app), active: active === app.key };
    }
    if (input.action === 'catalog') {
      if (!a.roles.includes('Administrator')) return { allowed: false };
      return { allowed: true, stats: gapStats(), apps: ROLE_APPS.map(view) };
    }
    return { roles: a.roles, active, apps: mine.map(view) };
  },
});
