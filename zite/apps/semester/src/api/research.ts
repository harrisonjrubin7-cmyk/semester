import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { DGV_MIGRATION } from '../lib/dgvMigration';
import { RSD_MIGRATION, RSD_METRIC_IDS, RSD_ROLES } from '../lib/rsdMigration';
import { rawMetrics, cohortSize } from '../lib/analyticsServer';
import { buildSnapshot, safeToStore, RESEARCH_CODE_VERSION } from '../lib/researchRules';
import { MIN_CELL, METRICS, suppress } from '../lib/analytics';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of [...DGV_MIGRATION, ...RSD_MIGRATION]) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const Spec = z.object({ roles: z.array(z.enum(RSD_ROLES)).max(7).optional(), term: z.string().max(40).optional(), metrics: z.array(z.enum(RSD_METRIC_IDS)).max(6).optional(), cohorts: z.array(z.string().max(20)).max(10).optional() });

// Institutional Researcher: cohorts, datasets and reproducible snapshots. Aggregates only, through the disclosure control.
export default createEndpoint({
  description: 'Research cohorts and datasets approved by a data steward, and reproducible aggregate snapshots with small-cell suppression',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('setAnalyst'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('def'), step: z.enum(['draft', 'edit', 'submit', 'approve', 'return', 'new_version', 'retire']), id: z.number().int().nullable(), expectedVersion: z.number().int().nullable(),
      kind: z.enum(['cohort', 'dataset']).optional(), title: z.string().max(140).optional(), purpose: z.string().max(2000).optional(), spec: Spec.optional(), seenHash: z.string().max(64).optional(), note: z.string().max(1000).default('') }),
    z.object({ action: z.literal('snapshot'), datasetId: z.number().int(), seenHash: z.string().max(64) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    await ensure();
    const sql = pg();
    const T = a.institutionId, me = a.userId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const flags = ((await sql.query(`SELECT rsd_is_analyst($1,$2) AS analyst, dgv_is($1,$2) AS steward`, [T, me])) as { analyst: boolean; steward: boolean }[])[0];
    if (!flags.analyst && !flags.steward && !isAdmin) forbid('Research datasets are for institutional researchers and data stewards.');
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;

    if (input.action === 'setAnalyst') {
      const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
      const uid = rows[0] ? String((rows[0] as Row).id) : null;
      if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
      const r = await one(`SELECT rsd_set_analyst($1,$2,$3,$4,$5) AS r`, [me, isAdmin, T, uid, input.on]); if (r) forbid(r);
      await audit(a, input.on ? 'Institutional researcher appointed' : 'Institutional researcher removed', `user:${uid}`, '', 'Administrator');
    }
    if (input.action === 'def') {
      const spec = input.spec ? Object.fromEntries(Object.entries(input.spec).filter(([, v]) => v !== undefined && !(typeof v === 'string' && !v.trim()))) : null;
      const r = await one(`SELECT rsd_def($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) AS r`, [T, me, input.step, input.id, input.expectedVersion, input.kind ?? null, input.title ?? null, input.purpose ?? null, spec ? JSON.stringify(spec) : null, input.seenHash ?? null, input.note]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not save it.');
      if (input.step === 'approve' || input.step === 'retire') await audit(a, `Research definition ${input.step}`, `researchDef:${r!.slice(3)}`, input.note, 'Data steward');
    }
    let ran: unknown = null;
    if (input.action === 'snapshot') {
      if (!flags.analyst) forbid('Only institutional researchers run snapshots.');
      const d = ((await sql.query(`SELECT * FROM rsd_defs WHERE id = $1 AND tenant_id = $2 AND kind = 'dataset' AND state = 'approved'`, [input.datasetId, T])) as Row[])[0];
      if (!d) forbid('Only an approved dataset version is run.');
      const spec = d!.spec as { metrics: string[]; cohorts?: string[] };
      const cohortDefs = (spec.cohorts ?? []).length ? ((await sql.query(`SELECT id, title, spec FROM rsd_defs WHERE tenant_id = $1 AND kind = 'cohort' AND state = 'approved' AND id::text = ANY($2::text[])`, [T, spec.cohorts])) as Row[]) : [];
      const raw = await rawMetrics(T);
      const sizes = await Promise.all(cohortDefs.map(async (c) => ({ id: String(c.id), title: String(c.title), size: await cohortSize(T, c.spec as { roles: string[]; term?: string }) })));
      const out = buildSnapshot(spec, raw, sizes);
      if (!safeToStore(out)) forbid('The output failed the disclosure check. Nothing was stored.');
      const r = await one(`SELECT rsd_snapshot($1,$2,$3,$4,$5,$6,$7::jsonb) AS r`, [T, me, input.datasetId, input.seenHash, RESEARCH_CODE_VERSION, MIN_CELL, JSON.stringify(out)]);
      if (!r?.startsWith('ok:')) forbid(r ?? 'Could not store the snapshot.');
      await audit(a, 'Research snapshot run', `researchSnapshot:${r!.slice(3)}`, `dataset ${input.datasetId}, cells under ${MIN_CELL} suppressed`, 'Institutional researcher');
      ran = Number(r!.slice(3));
    }

    const defs = (await sql.query(`SELECT * FROM rsd_defs WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT 300`, [T])) as Row[];
    const snaps = (await sql.query(`SELECT id, def_id, spec_hash, code_version, min_cell, output, output_hash, matches_previous, run_by, run_at FROM rsd_snapshots WHERE tenant_id = $1 ORDER BY id DESC LIMIT 100`, [T])) as Row[];
    const analysts = isAdmin ? ((await sql.query(`SELECT user_id FROM rsd_analysts WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[]).map((r) => String(r.user_id)) : [];
    const names = await userNames([...defs.flatMap((d) => [String(d.author_id), String(d.approver_id ?? '')]), ...snaps.map((s) => String(s.run_by)), ...analysts]);
    // Live cohort sizes for drafts and approved cohorts, suppressed like everything else.
    const cohortRows = defs.filter((d) => d.kind === 'cohort' && d.state !== 'retired');
    const liveSizes = Object.fromEntries(await Promise.all(cohortRows.map(async (c) => [String(c.id), suppress([{ label: 'size', value: await cohortSize(T, c.spec as { roles: string[]; term?: string }) }]).totalDisplay] as const)));
    return {
      me, isAdmin, analyst: flags.analyst, steward: flags.steward, minCell: MIN_CELL, codeVersion: RESEARCH_CODE_VERSION, ran,
      metrics: METRICS.map((m) => ({ id: m.id, label: m.label, counts: m.counts, caveat: m.caveat })), roles: [...RSD_ROLES] as string[],
      analysts: analysts.map((u) => ({ id: u, name: names[u] ?? 'Member' })),
      defs: defs.map((d) => ({ id: Number(d.id), kind: String(d.kind), lineage: String(d.lineage), version: Number(d.version), title: String(d.title), purpose: String(d.purpose), spec: d.spec, specHash: String(d.spec_hash), state: String(d.state), rev: Number(d.rev), mine: String(d.author_id) === me, author: names[String(d.author_id)] ?? 'Researcher', approver: d.approver_id ? names[String(d.approver_id)] ?? 'Steward' : null, reviewNote: String(d.review_note), size: liveSizes[String(d.id)] ?? null, updatedAt: iso(d.updated_at) })),
      snapshots: snaps.map((s) => ({ id: Number(s.id), defId: Number(s.def_id), specHash: String(s.spec_hash), codeVersion: String(s.code_version), minCell: Number(s.min_cell), output: s.output, outputHash: String(s.output_hash), matchesPrevious: s.matches_previous === null ? null : Boolean(s.matches_previous), runBy: names[String(s.run_by)] ?? 'Researcher', runAt: iso(s.run_at) })),
    };
  },
});
