import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAccess, forbid, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { DGV_MIGRATION } from '../lib/dgvMigration';
import { RSD_MIGRATION } from '../lib/rsdMigration';
import { RPP_MIGRATION } from '../lib/rppMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...DGV_MIGRATION, ...RSD_MIGRATION, ...RPP_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Data steward side of Research Partner access: governance review of protocols, data-use agreements, output review.
// Every rule is in rpp_* (lib/rppMigration.ts); this endpoint resolves the actor and institution server-side.
export default createEndpoint({
  description: 'Research partner protocols for data stewards: governance review, data-use agreements and output review',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('review'), id: z.number().int(), approve: z.boolean(), seenHash: z.string().max(64), note: z.string().max(2000) }),
    z.object({ action: z.literal('issue'), protocolId: z.number().int(), terms: z.string().max(20000), days: z.number().int() }),
    z.object({ action: z.literal('revoke'), agreementId: z.number().int(), reason: z.string().max(2000) }),
    z.object({ action: z.literal('reviewOutput'), id: z.number().int(), step: z.enum(['approve', 'return', 'reject']), confirmNoSmallCounts: z.boolean().default(false), note: z.string().max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    const steward = ((await sql.query(`SELECT dgv_is($1,$2) AS s`, [T, me])) as { s: boolean }[])[0].s;
    if (!steward) forbid('Research partner protocols are reviewed by data stewards.');
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;

    if (input.action === 'review') {
      const r = await one(`SELECT rpp_review($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.id, input.approve, input.seenHash, input.note]); if (r) forbid(r);
      await audit(a, input.approve ? 'Research protocol approved' : 'Research protocol rejected', `researchProtocol:${input.id}`, input.note, 'Data steward');
    }
    if (input.action === 'issue') {
      const r = await one(`SELECT rpp_issue($1,$2,$3,$4,$5) AS r`, [me, T, input.protocolId, input.terms, input.days]); if (!r?.startsWith('ok:')) forbid(r ?? 'Could not issue it.');
      await audit(a, 'Data-use agreement issued', `researchAgreement:${r!.slice(3)}`, `${input.days} days`, 'Data steward');
    }
    if (input.action === 'revoke') {
      const r = await one(`SELECT rpp_revoke($1,$2,$3,$4) AS r`, [me, T, input.agreementId, input.reason]); if (r) forbid(r);
      await audit(a, 'Data-use agreement revoked', `researchAgreement:${input.agreementId}`, input.reason, 'Data steward');
    }
    if (input.action === 'reviewOutput') {
      const r = await one(`SELECT rpp_output_review($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.id, input.step, input.confirmNoSmallCounts, input.note]); if (r) forbid(r);
      await audit(a, `Research output ${input.step}`, `researchOutput:${input.id}`, input.note, 'Data steward');
    }

    const [protocols, agreements, outputs, datasets] = await Promise.all([
      sql.query(`SELECT * FROM rpp_protocols WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`, [T]) as Promise<Row[]>,
      sql.query(`SELECT id, protocol_id, days, issued_by, issued_at, accepted_at, expires_at, revoked_at, revoked_reason, (accepted_at IS NOT NULL AND revoked_at IS NULL AND expires_at > now()) AS active FROM rpp_agreements WHERE tenant_id = $1 ORDER BY issued_at DESC`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM rpp_outputs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 300`, [T]) as Promise<Row[]>,
      sql.query(`SELECT id, title, version FROM rsd_defs WHERE tenant_id = $1 AND kind = 'dataset'`, [T]) as Promise<Row[]>,
    ]);
    const names = await userNames([...new Set([...protocols.map((p) => String(p.partner_id)), ...protocols.map((p) => String(p.reviewer_id ?? '')), ...agreements.map((g) => String(g.issued_by)), ...outputs.map((o) => String(o.reviewer_id ?? ''))].filter(Boolean))]);
    const nm = (id: unknown) => (id ? names[String(id)] ?? 'Unknown person' : null);
    const dsTitle = (id: unknown) => { const d = datasets.find((x) => String(x.id) === String(id)); return d ? `${d.title} v${d.version}` : `#${id}`; };
    return {
      me,
      protocols: protocols.map((p) => ({ id: Number(p.id), partner: nm(p.partner_id), mine: p.partner_id === me, organization: String(p.organization), title: String(p.title), aims: String(p.aims), ethicsRef: String(p.ethics_ref),
        datasets: (p.datasets as number[]).map(dsTitle), retentionDays: Number(p.retention_days), hash: String(p.protocol_hash), state: String(p.state), reviewer: nm(p.reviewer_id), reviewNote: String(p.review_note), createdAt: iso(p.created_at) })),
      agreements: agreements.map((g) => ({ id: Number(g.id), protocolId: Number(g.protocol_id), days: Number(g.days), issuedBy: nm(g.issued_by), issuedAt: iso(g.issued_at), acceptedAt: iso(g.accepted_at), expiresAt: iso(g.expires_at), revokedAt: iso(g.revoked_at), revokedReason: g.revoked_reason ? String(g.revoked_reason) : null, active: Boolean(g.active) })),
      outputs: outputs.map((o) => ({ id: Number(o.id), protocolId: Number(o.protocol_id), mine: o.partner_id === me, title: String(o.title), body: String(o.body), cites: (o.cites as number[]).map(Number), smallNumbers: Boolean(o.small_numbers), state: String(o.state), reviewer: nm(o.reviewer_id), reviewNote: String(o.review_note), createdAt: iso(o.created_at) })),
    };
  },
});
