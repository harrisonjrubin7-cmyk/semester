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
    z.object({ op: z.literal('admin'), action: z.enum(['segment_create', 'segment_retire', 'template_create', 'template_approve', 'template_retire', 'channel_set']),
      segmentId: z.string().max(40).optional(), templateId: z.string().max(40).optional(), name: z.string().max(120).optional(),
      kinds: z.array(z.string().max(60)).max(6).optional(), roleTerms: z.array(z.string().max(40)).max(10).optional(), utmSource: z.string().max(60).optional(), utmCampaign: z.string().max(60).optional(),
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), channel: z.enum(['email', 'event', 'social']).optional(), subject: z.string().max(200).optional(), body: z.string().max(10000).optional(),
      seenBody: z.string().max(64).optional(), version: z.number().int().optional(), status: z.enum(['open', 'paused']).optional(), senderLabel: z.string().max(80).optional(),
      dailyCap: z.number().int().min(0).max(100000).optional(), note: z.string().max(500).optional() }),
    z.object({ op: z.literal('source'), action: z.enum(['propose', 'approve', 'revoke']), sourceId: z.string().optional(), kind: z.string().max(40).optional(),
      title: z.string().max(160).optional(), reference: z.string().max(500).optional(), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      permissionNote: z.string().max(500).optional(), reason: z.string().max(500).optional() }),
    z.object({ op: z.literal('run'), commandKey: z.string().min(8).max(80), action: z.enum(['create', 'edit', 'submit', 'approve', 'reject', 'withdraw', 'claim_add', 'claim_remove', 'launch_check']),
      campaignId: z.string().optional(), version: z.number().int().optional(), name: z.string().max(120).optional(), channel: z.enum(['email', 'event', 'social']).optional(),
      goal: z.string().max(500).optional(), subject: z.string().max(200).optional(), body: z.string().max(10000).optional(), spendMinor: z.number().int().min(0).max(100_000_000).optional(),
      seenHash: z.string().optional(), note: z.string().max(1000).optional(),
      kind: z.string().max(40).optional(), text: z.string().max(300).optional(), sourceId: z.string().max(40).optional(), claimId: z.number().int().optional(), a11yReviewed: z.boolean().optional(),
      templateId: z.string().max(40).optional(), segmentId: z.string().max(40).nullable().optional() }),
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
    if (input.op === 'admin') {
      const { op: _op, action, ...p } = input;
      const t = ((await sql.query(`SELECT mkt_admin($1,$2,$3::jsonb) AS t`, [me, action, JSON.stringify(p)])) as { t: string }[])[0].t;
      return t.startsWith('ok:') ? { id: t.slice(3), resultCode: 'OK', message: 'Saved.' } : { id: '', resultCode: 'REFUSED', message: t };
    }
    if (input.op === 'source') {
      const { op: _op, action, ...p } = input;
      const t = ((await sql.query(`SELECT mkt_source($1,$2,$3::jsonb) AS t`, [me, action, JSON.stringify(p)])) as { t: string }[])[0].t;
      return t.startsWith('ok:') ? { id: t.slice(3), resultCode: 'OK', message: action === 'propose' ? 'Source proposed. Someone else must approve it with the publication permission.' : action === 'approve' ? 'Source approved.' : 'Source revoked; campaigns citing it are back in draft.' }
        : { id: '', resultCode: 'REFUSED', message: t };
    }
    if (input.op === 'run') {
      const { commandKey, action, campaignId, ...p } = input;
      if (action !== 'create' && !campaignId) throw new ZiteError('Choose a campaign.');
      const payload: Record<string, unknown> = { ...p };
      // Audience counts are taken on the server from the campaign's stored segment (none = everyone who consented), never from client input.
      const segSize = async () => ((await sql.query(`SELECT mkt_segment_size((SELECT segment_id FROM mkt_campaigns WHERE id = $1)) AS n`, [campaignId])) as { n: number }[])[0].n;
      if (action === 'submit') payload.audienceSize = await segSize();
      if (action === 'launch_check') payload.audienceNow = await segSize();   // consent re-counted at launch time
      const hash = await sha256(JSON.stringify({ action, campaignId, ...p }));
      const rows = (await sql.query(`SELECT mkt_cmd($1,$2,$3,$4,$5,$6::jsonb) AS r`, [me, commandKey, hash, action, campaignId ?? null, JSON.stringify(payload)])) as { r: { id: string | null; resultCode: string; message: string; replay?: boolean } }[];
      const r = rows[0].r;
      return { id: r.id ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
    }
    const [camps, tl, audience, { records: users }, claims, sources, checks, segs, tpls, chans, adm] = await Promise.all([
      sql.query(`SELECT c.*, mkt_hash(c) AS hash, mkt_claim_blockers(c.id) AS claim_blockers, mkt_hints(c.subject || ' ' || c.body) AS hints, mkt_a11y(c.subject || ' ' || c.body) AS a11y
        FROM mkt_campaigns c ORDER BY number DESC LIMIT 100`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT campaign_id, actor_id, action, detail, at FROM mkt_timeline ORDER BY id DESC LIMIT 500`) as Promise<Record<string, unknown>[]>,
      consentedAudience(),
      zite.auth.findAllUsers({ limit: 200 }),
      sql.query(`SELECT k.id, k.campaign_id, k.kind, k.text, k.source_id, mkt_source_ok(k.source_id, k.kind) AS ok FROM mkt_claims k ORDER BY k.id`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT s.*, mkt_source_ok(s.id, s.kind) AS ok FROM mkt_sources s ORDER BY s.created_at DESC LIMIT 200`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT DISTINCT ON (campaign_id) campaign_id, actor_id, outcome, blockers, at FROM mkt_launch_checks ORDER BY campaign_id, id DESC`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT g.*, mkt_segment_size(g.id) AS size FROM mkt_segments g ORDER BY g.created_at DESC LIMIT 100`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT t.*, md5(t.subject || '|' || t.body) AS seen FROM mkt_templates t ORDER BY t.created_at DESC LIMIT 100`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT * FROM mkt_channels ORDER BY channel`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT kind, ref, actor_id, action, detail, at FROM mkt_admin_events ORDER BY id DESC LIMIT 50`) as Promise<Record<string, unknown>[]>,
    ]);
    const name = (id: unknown) => { if (!id) return ''; const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Unknown'; };
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      me, roles, audience,
      segments: segs.map((g) => ({ id: String(g.id), name: String(g.name), kinds: (g.kinds as string[]) ?? [], roleTerms: (g.role_terms as string[]) ?? [], utmSource: (g.utm_source as string) ?? '',
        utmCampaign: (g.utm_campaign as string) ?? '', since: g.since ? new Date(String(g.since)).toISOString().slice(0, 10) : '', state: String(g.state), size: Number(g.size), by: name(g.created_by) })),
      templates: tpls.map((t) => ({ id: String(t.id), name: String(t.name), channel: String(t.channel), subject: String(t.subject), body: String(t.body), state: String(t.state), seen: String(t.seen),
        author: name(t.author_id), authorId: String(t.author_id), approvedBy: name(t.approved_by) })),
      channels: chans.map((c) => ({ channel: String(c.channel), status: String(c.status), senderLabel: String(c.sender_label), dailyCap: Number(c.daily_cap), note: String(c.note), version: Number(c.version), updatedBy: name(c.updated_by) })),
      adminEvents: adm.map((e) => ({ kind: String(e.kind), ref: String(e.ref), actor: name(e.actor_id), action: String(e.action), detail: String(e.detail), at: iso(e.at) })),
      sources: sources.map((x) => ({ id: String(x.id), kind: String(x.kind), title: String(x.title), reference: String(x.reference), state: String(x.state), usable: !!x.ok,
        expiresOn: x.expires_on ? new Date(String(x.expires_on)).toISOString().slice(0, 10) : null, permissionNote: String(x.permission_note ?? ''),
        proposedBy: name(x.proposed_by), proposedById: String(x.proposed_by), approvedBy: name(x.approved_by), revokeReason: (x.revoke_reason as string) ?? '' })),
      campaigns: camps.map((c) => ({
        id: String(c.id), number: Number(c.number), name: String(c.name), channel: String(c.channel), goal: String(c.goal), subject: String(c.subject), body: String(c.body),
        spendMinor: Number(c.spend_minor), audienceSize: c.audience_size == null ? null : Number(c.audience_size), state: String(c.state), version: Number(c.version), hash: String(c.hash),
        author: name(c.author_id), authorId: String(c.author_id), approvedBy: name(c.approved_by), approvedAt: iso(c.approved_at), note: (c.review_note as string) ?? '',
        segmentId: (c.segment_id as string) ?? null, templateId: (c.template_id as string) ?? null,
        claims: claims.filter((k) => k.campaign_id === c.id).map((k) => ({ id: Number(k.id), kind: String(k.kind), text: String(k.text), sourceId: (k.source_id as string) ?? null, sourced: !!k.ok })),
        claimBlockers: (c.claim_blockers as string[]) ?? [], hints: (c.hints as string[]) ?? [], a11y: (c.a11y as string[]) ?? [],
        launch: (() => { const l = checks.find((x) => x.campaign_id === c.id); return l ? { by: name(l.actor_id), outcome: String(l.outcome), blockers: (l.blockers as string[]) ?? [], at: iso(l.at) } : null; })(),
        timeline: tl.filter((t) => t.campaign_id === c.id).reverse().map((t) => ({ actor: name(t.actor_id), action: String(t.action), detail: String(t.detail), at: iso(t.at) })),
      })),
    };
  },
});
