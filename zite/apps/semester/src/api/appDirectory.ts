import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { forbid, first } from '../lib/server';
import { pg } from '../lib/pg';
import { APPS, visibleApps, appLink, type AppKey, type Facts } from '../lib/appDirectoryRules';

// The app switcher shared by all ten Semester apps (each app has a front door to this endpoint). The account is the same in
// every app; this reads facts about the signed-in person and returns the apps that make sense for them, with links.
// App addresses are kept in os_app_urls; only company staff (a co_roles holder) can set them.
const MIGRATION = [
  `CREATE TABLE IF NOT EXISTS os_app_urls (app_key text PRIMARY KEY CHECK (app_key IN ('semester','faculty','institution','family','employers','applicants','site','company','security','developers')),
     url text NOT NULL CHECK (url ~ '^https://[^[:space:]/]+'), set_by text NOT NULL, set_at timestamptz NOT NULL DEFAULT now())`,
];
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const KEYS = APPS.map((a) => a.key) as [AppKey, ...AppKey[]];

async function count(q: string, p: unknown[]): Promise<number> {
  try { return Number(((await pg().query(q, p)) as { n: number }[])[0]?.n ?? 0); } catch { return 0; } // table not created yet in this workspace
}
async function rows(q: string, p: unknown[]): Promise<string[]> {
  try { return ((await pg().query(q, p)) as { r: string }[]).map((x) => String(x.r)); } catch { return []; }
}

export default createEndpoint({
  description: 'App directory: which Semester apps the signed-in person can use, with links; company staff set app addresses',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), current: z.enum(KEYS).nullable().default(null) }),
    z.object({ action: z.literal('setUrl'), app: z.enum(KEYS), url: z.string().url().max(300).nullable() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const companyRoles = await rows(`SELECT role AS r FROM co_roles WHERE user_id = $1 AND revoked_at IS NULL`, [me]);
    if (input.action === 'setUrl') {
      if (!companyRoles.length) forbid('Only company staff set app addresses.');
      if (input.url === null) await sql.query(`DELETE FROM os_app_urls WHERE app_key = $1`, [input.app]);
      else {
        if (!appLink(input.url)) forbid('Use the app’s https address.');
        await sql.query(`INSERT INTO os_app_urls (app_key, url, set_by) VALUES ($1,$2,$3) ON CONFLICT (app_key) DO UPDATE SET url = EXCLUDED.url, set_by = EXCLUDED.set_by, set_at = now()`, [input.app, input.url.replace(/\/+$/, ''), me]);
      }
    }
    const mems = (await zite.memberships.findAll({ filters: { member: me }, limit: 50 })).records.filter((m) => m.status === 'Active');
    const facts: Facts = {
      roles: [...new Set(mems.flatMap((m) => m.roles ?? []))],
      hasMembership: mems.length > 0,
      delegate: (await count(`SELECT count(*)::int AS n FROM crs_delegations WHERE delegate_id = $1 AND revoked_at IS NULL AND expires_at > now()`, [me])) > 0,
      familyShares: (await zite.consents.findAll({ filters: { recipient: me, consentType: 'Data Sharing' }, limit: 50 })).records.filter((c) => c.granted && !c.revoked && String(c.label ?? '').startsWith('Family:') && (!c.expiresOn || String(c.expiresOn) >= new Date().toISOString().slice(0, 10))).length,
      employerPostings: await count(`SELECT count(*)::int AS n FROM emp_postings WHERE owner_id = $1`, [me]),
      applications: (await zite.applications.findAll({ filters: { applicant: me }, limit: 5 })).records.length,
      companyRoles,
      developerApps: await count(`SELECT count(*)::int AS n FROM dev_apps WHERE developer_id = $1`, [me]),
    };
    const urls = Object.fromEntries(((await sql.query(`SELECT app_key, url FROM os_app_urls`)) as { app_key: string; url: string }[]).map((r) => [r.app_key, r.url]));
    const visible = new Set(visibleApps(facts));
    if (input.action === 'get' && input.current) visible.add(input.current);
    return {
      canSetUrls: companyRoles.length > 0,
      institution: first(mems.map((m) => first(m.institution) ?? '')) ?? null,
      apps: APPS.filter((x) => visible.has(x.key) || companyRoles.length > 0).map((x) => ({ ...x, url: urls[x.key] ?? null, visible: visible.has(x.key), current: input.action === 'get' && input.current === x.key })),
    };
  },
});
