import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, sha256 } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { HKB_MIGRATION, HKB_CLAIMS } from '../lib/hkbMigration';

let ready: Promise<void> | null = null;
const ensure = () => {
  if (!ready) ready = (async () => { await ensureCoRoles(); const sql = pg(); for (const s of HKB_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  return ready;
};

// Support help articles (Support Agent): draft → review by another agent of the exact text → published. Customer delivery is disabled.
export default createEndpoint({
  description: 'Support help articles: support agents draft, a second agent reviews the exact text; customer delivery is disabled',
  authenticated: true,
  inputSchema: z.discriminatedUnion('op', [
    z.object({ op: z.literal('list') }),
    z.object({ op: z.literal('run'), commandKey: z.string().min(8).max(80), step: z.enum(['draft', 'edit', 'submit', 'publish', 'return', 'revise', 'retire']),
      articleId: z.string().optional(), version: z.number().int().optional(), title: z.string().max(140).optional(), body: z.string().max(20000).optional(),
      audience: z.enum(['internal', 'customer']).optional(), claimTypes: z.array(z.enum(HKB_CLAIMS)).max(5).optional(), claimSources: z.string().max(500).optional(),
      seenHash: z.string().max(64).optional(), note: z.string().max(1000).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const roles = await rolesOf(me);
    if (!roles.includes('support_agent')) { const m = 'Help articles need the support agent role.'; throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m }); }
    if (input.op === 'run') {
      const { commandKey, step, articleId, ...p } = input;
      if (step !== 'draft' && !articleId) throw new ZiteError('Choose an article.');
      const hash = await sha256(JSON.stringify({ step, articleId, ...p }));
      const r = ((await sql.query(`SELECT hkb_cmd($1,$2,$3,$4,$5,$6::jsonb) AS r`, [me, commandKey, hash, step, articleId ?? null, JSON.stringify(p)])) as { r: { id: string | null; resultCode: string; message: string; replay?: boolean } }[])[0].r;
      return { id: r.id ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
    }
    const [arts, ev, { records: users }] = await Promise.all([
      sql.query(`SELECT a.*, hkb_hash(a) AS hash FROM hkb_articles a ORDER BY updated_at DESC LIMIT 300`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT article_id, actor_id, action, detail, at FROM hkb_events ORDER BY id DESC LIMIT 1000`) as Promise<Record<string, unknown>[]>,
      zite.auth.findAllUsers({ limit: 200 }),
    ]);
    const name = (id: unknown) => { if (!id) return ''; const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      me,
      articles: arts.map((a) => ({
        id: String(a.id), number: Number(a.number), title: String(a.title), body: String(a.body), audience: String(a.audience), claimTypes: (a.claim_types as string[]) ?? [], claimSources: String(a.claim_sources),
        state: String(a.state), version: Number(a.version), hash: String(a.hash), mine: String(a.author_id) === me, author: name(a.author_id), reviewer: name(a.reviewer_id),
        reviewNote: String(a.review_note), supersedes: a.supersedes ? String(a.supersedes) : null, publishedAt: iso(a.published_at), delivery: String(a.delivery),
        history: ev.filter((e) => e.article_id === a.id).reverse().map((e) => ({ actor: name(e.actor_id), action: String(e.action), detail: String(e.detail), at: iso(e.at) })),
      })),
    };
  },
});
