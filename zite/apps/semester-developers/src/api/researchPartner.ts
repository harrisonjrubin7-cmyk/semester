import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, fail } from '../lib/db';
import { DGV_MIGRATION } from '../../../semester/src/lib/dgvMigration';
import { RSD_MIGRATION } from '../../../semester/src/lib/rsdMigration';
import { RPP_MIGRATION } from '../../../semester/src/lib/rppMigration';
import { requireModule, moduleOn } from '../../../semester/src/lib/tcpServer';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...DGV_MIGRATION, ...RSD_MIGRATION, ...RPP_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// Research Partner: protocol requests to an institution, data-use agreements, secure in-platform reading of the approved,
// already-suppressed aggregate snapshots, and outputs submitted for review. No person-level data and no export exist here;
// what a partner may read is decided by rpp_read_ok in the database on every request.
export default createEndpoint({
  description: 'Research partner access: protocol requests, data-use agreements, approved aggregate snapshots and output review',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get'), institutionId: z.string().max(80).optional() }),
    z.object({ action: z.literal('submit'), requestKey: z.string().min(8).max(80), institutionId: z.string().max(80), organization: z.string().max(160), title: z.string().max(200), aims: z.string().max(4000), ethicsRef: z.string().max(300), datasets: z.array(z.number().int()).min(1).max(10), retentionDays: z.number().int() }),
    z.object({ action: z.literal('withdraw'), id: z.number().int(), reason: z.string().max(500).default('') }),
    z.object({ action: z.literal('accept'), agreementId: z.number().int(), seenHash: z.string().max(64) }),
    z.object({ action: z.literal('submitOutput'), protocolId: z.number().int(), title: z.string().max(200), body: z.string().max(20000), cites: z.array(z.number().int()).min(1).max(20) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const me = context.user.id;
    await ensure();
    const sql = pg();
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const inst = await zite.institutions.findAll({ limit: 500 });
    const instName = (id: unknown) => inst.records.find((r) => r.id === String(id))?.name ?? 'Institution';

    if (input.action === 'submit') {
      if (!inst.records.some((r) => r.id === input.institutionId)) fail('Choose an institution.');
      await requireModule(input.institutionId, 'research_partners', []);
      const r = await one(`SELECT rpp_submit($1,$2,$3,$4,$5,$6,$7,$8::bigint[],$9) AS r`, [me, input.requestKey, input.institutionId, input.organization, input.title, input.aims, input.ethicsRef, input.datasets, input.retentionDays]);
      if (!r || !(r.startsWith('ok:') || r.startsWith('replay:'))) fail(r ?? 'Could not submit it.');
    }
    if (input.action === 'withdraw') { const r = await one(`SELECT rpp_withdraw($1,$2,$3) AS r`, [me, input.id, input.reason]); if (r) fail(r); }
    if (input.action === 'accept') { const r = await one(`SELECT rpp_accept($1,$2,$3) AS r`, [me, input.agreementId, input.seenHash]); if (r) fail(r); }
    if (input.action === 'submitOutput') {
      const t = ((await sql.query(`SELECT tenant_id FROM rpp_protocols WHERE id = $1 AND partner_id = $2`, [input.protocolId, me])) as { tenant_id: string }[])[0];
      if (t) await requireModule(t.tenant_id, 'research_partners', []);
      const r = await one(`SELECT rpp_output_submit($1,$2,$3,$4,$5::bigint[]) AS r`, [me, input.protocolId, input.title, input.body, input.cites]);
      if (!r?.startsWith('ok:')) fail(r ?? 'Could not submit it.');
    }

    const picked = input.action === 'get' ? input.institutionId : input.action === 'submit' ? input.institutionId : undefined;
    const chosen = picked && (await moduleOn(picked, 'research_partners', [])) ? picked : undefined;
    const [protocols, agreements, outputs, offered] = await Promise.all([
      sql.query(`SELECT * FROM rpp_protocols WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 100`, [me]) as Promise<Row[]>,
      sql.query(`SELECT g.id, g.protocol_id, g.terms, g.terms_hash, g.days, g.issued_at, g.accepted_at, g.expires_at, g.revoked_at, g.revoked_reason, (g.accepted_at IS NOT NULL AND g.revoked_at IS NULL AND g.expires_at > now()) AS active
        FROM rpp_agreements g WHERE g.partner_id = $1 ORDER BY g.issued_at DESC`, [me]) as Promise<Row[]>,
      sql.query(`SELECT id, protocol_id, title, body, cites, small_numbers, state, review_note, created_at, decided_at FROM rpp_outputs WHERE partner_id = $1 ORDER BY created_at DESC LIMIT 200`, [me]) as Promise<Row[]>,
      chosen ? (sql.query(`SELECT id, title, purpose, version FROM rsd_defs WHERE tenant_id = $1 AND kind = 'dataset' AND state = 'approved' ORDER BY title`, [chosen]) as Promise<Row[]>) : Promise.resolve([] as Row[]),
    ]);
    // Secure analysis: only snapshots rpp_read_ok allows right now, for datasets named in this partner's approved protocols.
    const snapsAll = (await sql.query(`SELECT s.id, s.tenant_id, s.def_id, d.title, d.version, s.code_version, s.min_cell, s.output, s.output_hash, s.run_at
      FROM rsd_snapshots s JOIN rsd_defs d ON d.id = s.def_id WHERE rpp_read_ok($1, s.id) ORDER BY s.run_at DESC LIMIT 100`, [me])) as Row[];
    // Control plane: an institution that switched research partners off stops all partner reading at once.
    const onFor = new Map<string, boolean>();
    for (const t of new Set(snapsAll.map((x) => String(x.tenant_id)))) onFor.set(t, await moduleOn(t, 'research_partners', []));
    const snaps = snapsAll.filter((x) => onFor.get(String(x.tenant_id)));
    const dsIds = [...new Set(protocols.flatMap((p) => p.datasets as number[]))];
    const dsRows = dsIds.length ? ((await sql.query(`SELECT id, title, version FROM rsd_defs WHERE id = ANY($1::bigint[])`, [dsIds])) as Row[]) : [];
    const dsTitle = (id: unknown) => { const d = dsRows.find((x) => String(x.id) === String(id)); return d ? `${d.title} v${d.version}` : `#${id}`; };
    return {
      institutions: inst.records.map((r) => ({ id: r.id, name: r.name ?? 'Institution' })),
      offered: offered.map((d) => ({ id: Number(d.id), title: String(d.title), purpose: String(d.purpose), version: Number(d.version) })),
      protocols: protocols.map((p) => ({ id: Number(p.id), institution: instName(p.tenant_id), organization: String(p.organization), title: String(p.title), aims: String(p.aims), ethicsRef: String(p.ethics_ref),
        datasetIds: (p.datasets as number[]).map(Number), datasets: (p.datasets as number[]).map(dsTitle), retentionDays: Number(p.retention_days), state: String(p.state), reviewNote: String(p.review_note), createdAt: iso(p.created_at) })),
      agreements: agreements.map((g) => ({ id: Number(g.id), protocolId: Number(g.protocol_id), terms: String(g.terms), termsHash: String(g.terms_hash), days: Number(g.days), issuedAt: iso(g.issued_at), acceptedAt: iso(g.accepted_at), expiresAt: iso(g.expires_at), revokedAt: iso(g.revoked_at), revokedReason: g.revoked_reason ? String(g.revoked_reason) : null, active: Boolean(g.active) })),
      outputs: outputs.map((o) => ({ id: Number(o.id), protocolId: Number(o.protocol_id), title: String(o.title), body: String(o.body), cites: (o.cites as number[]).map(Number), smallNumbers: Boolean(o.small_numbers), state: String(o.state), reviewNote: String(o.review_note), createdAt: iso(o.created_at) })),
      snapshots: snaps.map((s) => ({ id: Number(s.id), defId: Number(s.def_id), dataset: `${s.title} v${s.version}`, codeVersion: String(s.code_version), minCell: Number(s.min_cell), output: s.output, outputHash: String(s.output_hash), runAt: iso(s.run_at) })),
    };
  },
});
