import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, forbid, audit, userNames, ids } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureCmy } from '../lib/cmyServer';
import { CNA_MIGRATION } from '../lib/cnaMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { await ensureCmy(); for (const q of CNA_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Community announcements: managers draft and publish (a second manager approves multi-community or important ones);
// members see live announcements for the communities they belong to and acknowledge the ones that ask. In-app only.
export default createEndpoint({
  description: 'Community announcements: drafts, second-manager approval, corrections, member feed and acknowledgements (in-app only)',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('step'), step: z.enum(['draft', 'edit', 'submit', 'approve', 'correct', 'withdraw']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      groups: z.array(z.string().max(40)).max(20).optional(), title: z.string().max(140).optional(), body: z.string().max(8000).optional(), important: z.boolean().optional(), mustAck: z.boolean().optional(),
      publishAt: z.string().max(40).nullable().optional(), expiresAt: z.string().max(40).nullable().optional(), seen: z.string().max(64).optional(), text: z.string().max(2000).optional() }),
    z.object({ action: z.literal('ack'), id: z.number().int() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const groups = (await zite.groups.findAll({ filters: { institution: T }, limit: 500 })).records.filter((g) => g.kind === 'Community');
    const mine = groups.filter((g) => ids(g.members).includes(me)).map((g) => g.id);
    const manager = ((await sql.query(`SELECT cmy_is_staff($1,$2) AS s`, [T, me])) as { s: boolean }[])[0].s;

    if (input.action === 'step') {
      const r = ((await sql.query(`SELECT cna_step($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,$11::timestamptz,$12::timestamptz,$13,$14) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.groups ?? null,
        input.title ?? null, input.body ?? null, input.important ?? null, input.mustAck ?? null, input.publishAt ?? null, input.expiresAt ?? null, input.seen ?? null, input.text ?? null])) as { r: string | null }[])[0].r;
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
      if (['approve', 'withdraw', 'correct'].includes(input.step)) await audit(a, `Announcement ${input.step}`, `announcement:${r!.slice(3)}`, input.text ?? '', 'Community manager');
    }
    if (input.action === 'ack') { const r = ((await sql.query(`SELECT cna_ack($1,$2,$3,$4::text[]) AS r`, [T, me, input.id, mine])) as { r: string | null }[])[0].r; if (r) forbid(r); }

    const feed = (await sql.query(`SELECT c.*, EXISTS (SELECT 1 FROM cna_acks k WHERE k.announcement_id = c.id AND k.user_id = $3) AS acked FROM cna_announcements c
      WHERE c.tenant_id = $1 AND c.group_ids && $2::text[] AND cna_live(c) ORDER BY c.important DESC, c.publish_at DESC LIMIT 50`, [T, mine, me])) as Row[];
    const work = manager ? ((await sql.query(`SELECT c.*, cna_live(c) AS live, (SELECT count(*) FROM cna_acks k WHERE k.announcement_id = c.id)::int AS acks FROM cna_announcements c
      WHERE c.tenant_id = $1 ORDER BY c.state = 'pending_approval' DESC, c.updated_at DESC LIMIT 100`, [T])) as Row[]) : [];
    const name = (gid: string) => groups.find((g) => g.id === gid)?.name ?? 'Community';
    const membersOf = (gs: string[]) => new Set(groups.filter((g) => gs.includes(g.id)).flatMap((g) => ids(g.members))).size;
    const people = await userNames(work.flatMap((w) => [String(w.author_id), String(w.approver_id ?? '')]).filter(Boolean));
    const corrections = (v: unknown) => ((v as { text: string; at: string }[]) ?? []).map((c) => ({ text: c.text, at: c.at }));
    const active = (await sql.query(`SELECT group_id FROM cmy_communities WHERE tenant_id = $1 AND state = 'active'`, [T])) as Row[];
    return {
      manager, me,
      communities: manager ? groups.filter((g) => active.some((x) => x.group_id === g.id)).map((g) => ({ id: g.id, name: g.name ?? 'Community', members: ids(g.members).length })) : [],
      feed: feed.map((f) => ({ id: Number(f.id), title: String(f.title), body: String(f.body), important: Boolean(f.important), mustAck: Boolean(f.must_ack), acked: Boolean(f.acked),
        communities: (f.group_ids as string[]).filter((g) => mine.includes(g)).map(name), publishedAt: iso(f.publish_at), expiresAt: iso(f.expires_at), corrections: corrections(f.corrections) })),
      work: work.map((w) => ({ id: Number(w.id), title: String(w.title), body: String(w.body), hash: String(w.body_hash), groups: w.group_ids as string[], communities: (w.group_ids as string[]).map(name),
        important: Boolean(w.important), mustAck: Boolean(w.must_ack), publishAt: iso(w.publish_at), expiresAt: iso(w.expires_at), state: String(w.state), live: Boolean(w.live), mine: w.author_id === me,
        author: people[String(w.author_id)] ?? 'Member', approver: w.approver_id ? people[String(w.approver_id)] ?? 'Member' : null, withdrawnReason: w.withdrawn_reason ? String(w.withdrawn_reason) : null,
        corrections: corrections(w.corrections), acks: Number(w.acks), audience: membersOf(w.group_ids as string[]), rev: Number(w.rev) })),
    };
  },
});
