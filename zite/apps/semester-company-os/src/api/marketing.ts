import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, sha256 } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { MKA_MIGRATION } from '../lib/mkaMigration';
import { SITE_MIGRATION } from '../../../semester-site/src/lib/pg';
import { MKT_MIGRATION } from '../lib/mktMigration';

let ready: Promise<void> | null = null;
const ensureMkt = () => {
  if (!ready) ready = (async () => { await ensureCoRoles(); const sql = pg(); for (const s of [...SITE_MIGRATION, ...MKT_MIGRATION, ...MKA_MIGRATION]) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  return ready;
};

// The data API returns at most 2000 rows per call; page through with offset (stops at 100k rows).

/** The only audience: distinct people who consented through the site's contact forms, minus anyone whose latest consent-ledger
 *  event is a withdrawal (mka_audience, lib/mkaMigration.ts). Counted on the server; never student or education records.
 *  (Fixed 29 Oct: this used to count inbox rows, so a person with two requests counted twice and withdrawals were impossible.) */
async function consentedAudience() {
  return ((await pg().query(`SELECT mka_audience() AS n`)) as { n: number }[])[0].n;
}

// Marketing and Growth (APP-021): draft → submit (audience snapshot) → approval of the exact content by someone else → sending disabled.
export default createEndpoint({
  description: 'Marketing campaigns: list for marketers and approvers, and run one campaign step atomically. Sending is disabled.',
  authenticated: true,
  inputSchema: z.discriminatedUnion('op', [
    z.object({ op: z.literal('list') }),
    z.object({ op: z.literal('run'), commandKey: z.string().min(8).max(80), action: z.enum(['create', 'edit', 'submit', 'approve', 'reject', 'withdraw']),
      campaignId: z.string().optional(), version: z.number().int().optional(), name: z.string().max(120).optional(), channel: z.enum(['email', 'event', 'social']).optional(),
      goal: z.string().max(500).optional(), subject: z.string().max(200).optional(), body: z.string().max(10000).optional(), spendMinor: z.number().int().min(0).max(100_000_000).optional(),
      seenHash: z.string().optional(), note: z.string().max(1000).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureMkt();
    const sql = pg();
    const me = context.user.id;
    const roles = await rolesOf(me);
    if (!roles.includes('marketer') && !roles.includes('marketing_approver')) {
      const m = 'You don’t have a marketing role.';
      throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m });
    }
    if (input.op === 'run') {
      const { commandKey, action, campaignId, ...p } = input;
      if (action !== 'create' && !campaignId) throw new ZiteError('Choose a campaign.');
      const payload: Record<string, unknown> = { ...p };
      if (action === 'submit') payload.audienceSize = await consentedAudience();   // server-side snapshot, not client input
      const hash = await sha256(JSON.stringify({ action, campaignId, ...p }));
      const rows = (await sql.query(`SELECT mkt_cmd($1,$2,$3,$4,$5,$6::jsonb) AS r`, [me, commandKey, hash, action, campaignId ?? null, JSON.stringify(payload)])) as { r: { id: string | null; resultCode: string; message: string; replay?: boolean } }[];
      const r = rows[0].r;
      return { id: r.id ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
    }
    const [camps, tl, audience, { records: users }] = await Promise.all([
      sql.query(`SELECT c.*, mkt_hash(c) AS hash FROM mkt_campaigns c ORDER BY number DESC LIMIT 100`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT campaign_id, actor_id, action, detail, at FROM mkt_timeline ORDER BY id DESC LIMIT 500`) as Promise<Record<string, unknown>[]>,
      consentedAudience(),
      zite.auth.findAllUsers({ limit: 200 }),
    ]);
    const name = (id: unknown) => { if (!id) return ''; const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      me, roles, audience,
      campaigns: camps.map((c) => ({
        id: String(c.id), number: Number(c.number), name: String(c.name), channel: String(c.channel), goal: String(c.goal), subject: String(c.subject), body: String(c.body),
        spendMinor: Number(c.spend_minor), audienceSize: c.audience_size == null ? null : Number(c.audience_size), state: String(c.state), version: Number(c.version), hash: String(c.hash),
        author: name(c.author_id), authorId: String(c.author_id), approvedBy: name(c.approved_by), approvedAt: iso(c.approved_at), note: (c.review_note as string) ?? '',
        timeline: tl.filter((t) => t.campaign_id === c.id).reverse().map((t) => ({ actor: name(t.actor_id), action: String(t.action), detail: String(t.detail), at: iso(t.at) })),
      })),
    };
  },
});
