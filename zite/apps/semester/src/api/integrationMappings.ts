import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAction, audit, userNames } from '../lib/server';
import { pg } from '../lib/pg';
import { MAP_MIGRATION } from '../lib/mapMigration';
import { CONNECTORS, TARGETS, TRANSFORMS, PROTECTED_TARGETS, validateMapping, detectDrift, MappingRow, Connector } from '../lib/mappingRules';

let ready: Promise<void> | null = null;
const ensureMap = () => {
  if (!ready) { const sql = pg(); ready = (async () => { for (const q of MAP_MIGRATION) await sql.query(q); })().catch((e) => { ready = null; throw e; }); }
  return ready;
};
type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const RowSchema = z.object({ source: z.string().min(1).max(64), target: z.string().max(64), transform: z.enum(TRANSFORMS), required: z.boolean() });

// Integration Admin: field mappings (two-person approval) and drift checks against what a source sends now. Institution-scoped;
// connector capability only. No credentials or record contents are handled here; drift input is field names only.
export default createEndpoint({
  description: 'Integration field mappings with two-person approval, and drift checks comparing the fields a source sends with the approved mapping',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('propose'), connector: z.enum(CONNECTORS), rows: z.array(RowSchema).min(1).max(60), note: z.string().max(300) }),
    z.object({ action: z.literal('decide'), id: z.number().int(), approve: z.boolean(), note: z.string().max(300) }),
    z.object({ action: z.literal('checkDrift'), connector: z.enum(CONNECTORS), sentFields: z.array(z.string().max(64)).min(1).max(200) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'connector.manage');
    await ensureMap();
    const sql = pg();
    const T = a.institutionId;
    const fail = (e: string | null) => { if (e) throw new ZiteError({ code: 'FORBIDDEN', message: e, userFacingMessage: e }); };
    let lastDrift: unknown = null;
    if (input.action === 'propose') {
      fail(validateMapping(input.connector, input.rows as MappingRow[]));
      fail(((await sql.query(`SELECT map_propose($1,$2,$3,$4::jsonb,$5) AS e`, [a.userId, T, input.connector, JSON.stringify(input.rows.map((r) => ({ ...r, source: r.source.trim() }))), input.note])) as { e: string | null }[])[0].e);
      await audit(a, 'Integration mapping proposed', `mapping:${input.connector}`, input.note, 'Integration admin');
    }
    if (input.action === 'decide') {
      fail(((await sql.query(`SELECT map_decide($1,$2,$3,$4,$5) AS e`, [a.userId, T, input.id, input.approve, input.note])) as { e: string | null }[])[0].e);
      await audit(a, input.approve ? 'Integration mapping approved' : 'Integration mapping rejected', `mapping:${input.id}`, input.note, 'Integration admin');
    }
    if (input.action === 'checkDrift') {
      const cur = ((await sql.query(`SELECT version, rows FROM map_versions WHERE tenant_id = $1 AND connector = $2 AND state = 'approved' ORDER BY version DESC LIMIT 1`, [T, input.connector])) as Row[])[0];
      if (!cur) fail(`No approved ${input.connector} mapping yet.`);
      const report = detectDrift(cur!.rows as MappingRow[], input.sentFields);
      await sql.query(`INSERT INTO map_drift (tenant_id, connector, mapping_version, sent_fields, report, ok, checked_by) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [T, input.connector, cur!.version, input.sentFields, JSON.stringify(report), report.ok, a.userId]);
      await audit(a, report.ok ? 'Mapping drift check passed' : 'Mapping drift detected', `mapping:${input.connector}`, `${report.missingRequired.length} required missing, ${report.newFields.length} new`, 'Integration admin');
      lastDrift = { connector: input.connector, version: Number(cur!.version), ...report };
    }
    const [versions, drift] = await Promise.all([
      sql.query(`SELECT * FROM map_versions WHERE tenant_id = $1 ORDER BY connector, version DESC`, [T]) as Promise<Row[]>,
      sql.query(`SELECT * FROM map_drift WHERE tenant_id = $1 ORDER BY id DESC LIMIT 20`, [T]) as Promise<Row[]>,
    ]);
    const names = await userNames([...versions.flatMap((v) => [String(v.proposed_by), String(v.decided_by ?? '')]), ...drift.map((d) => String(d.checked_by))]);
    const vv = (v: Row) => ({ id: Number(v.id), connector: String(v.connector) as Connector, version: Number(v.version), rows: v.rows as MappingRow[], note: String(v.note), state: String(v.state),
      proposedBy: names[String(v.proposed_by)] ?? 'Admin', mine: v.proposed_by === a.userId, decidedBy: v.decided_by ? names[String(v.decided_by)] ?? 'Admin' : null, decisionNote: (v.decision_note as string) ?? '' });
    return {
      lastDrift, connectors: CONNECTORS, targets: TARGETS, transforms: TRANSFORMS, protectedTargets: [...PROTECTED_TARGETS],
      approved: versions.filter((v) => v.state === 'approved').map(vv),
      pending: versions.filter((v) => v.state === 'proposed').map(vv),
      history: versions.filter((v) => ['superseded', 'rejected'].includes(String(v.state))).map(vv),
      drift: drift.map((d) => ({ id: Number(d.id), connector: String(d.connector), version: d.mapping_version == null ? null : Number(d.mapping_version), ok: !!d.ok, report: d.report, by: names[String(d.checked_by)] ?? 'Admin', at: iso(d.at) })),
    };
  },
});
