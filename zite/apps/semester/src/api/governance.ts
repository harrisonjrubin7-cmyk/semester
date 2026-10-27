import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireAccess, requireAction, forbid, audit, userNames, tenantScope } from '../lib/server';
import { pg } from '../lib/pg';
import { DGV_MIGRATION } from '../lib/dgvMigration';

type Row = Record<string, unknown>;
let ready: Promise<void> | null = null;
const ensure = () => { if (!ready) ready = (async () => { for (const q of DGV_MIGRATION) await pg().query(q); })().catch((e) => { ready = null; throw e; }); return ready; };
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const CLASS = z.enum(['public', 'internal', 'confidential', 'restricted']);

// Data governance catalog (Data Steward). Metadata about datasets only; no student records are read or returned.
export default createEndpoint({
  description: 'Data governance: definitions, dataset classification, lineage, source authority, quality rules, retention and source conflicts',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('get') }),
    z.object({ action: z.literal('steward'), email: z.string().email().max(200), on: z.boolean() }),
    z.object({ action: z.literal('term'), name: z.string().min(2).max(120), definition: z.string().min(10).max(4000) }),
    z.object({ action: z.literal('termStep'), id: z.number().int(), step: z.enum(['approve', 'retire']), expectedVersion: z.number().int() }),
    z.object({ action: z.literal('asset'), name: z.string().min(2).max(120), system: z.string().min(1).max(120), classification: CLASS, systemOfRecord: z.string().min(2).max(120) }),
    z.object({ action: z.literal('classify'), id: z.number().int(), classification: CLASS, expectedVersion: z.number().int() }),
    z.object({ action: z.literal('link'), fromId: z.number().int(), toId: z.number().int(), transform: z.string().min(3).max(500) }),
    z.object({ action: z.literal('rule'), assetId: z.number().int(), description: z.string().min(5).max(500), threshold: z.number().min(0).max(100) }),
    z.object({ action: z.literal('measure'), ruleId: z.number().int(), measured: z.number().min(0).max(100) }),
    z.object({ action: z.literal('resolveIssue'), id: z.number().int(), text: z.string().max(1000) }),
    z.object({ action: z.literal('retain'), assetId: z.number().int(), days: z.number().int().positive().max(36500), legalMinDays: z.number().int().min(0).max(36500), basis: z.string().max(500) }),
    z.object({ action: z.literal('conflict'), subject: z.string().min(3).max(200), sourceA: z.string().min(1).max(120), sourceB: z.string().min(1).max(120), detail: z.string().min(10).max(2000) }),
    z.object({ action: z.literal('settle'), id: z.number().int(), source: z.string().max(120), rationale: z.string().max(2000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensure();
    const sql = pg();
    const me = context.user.id;
    const a = await requireAccess(me);
    const T = a.institutionId;
    let isAdmin = false;
    try { await requireAction(me, 'member.manage'); isAdmin = true; } catch { /* not an administrator */ }
    const one = async (q: string, p: unknown[]) => ((await sql.query(q, p)) as { r: string | null }[])[0].r;
    const fail = (out: string | null) => { if (out && !out.startsWith('ok:') && out !== 'pending') forbid(out); return out; };
    const steward = !!((await sql.query(`SELECT dgv_is($1,$2) AS r`, [T, me])) as { r: boolean }[])[0].r;
    if (!steward && !isAdmin) forbid('Only data stewards and administrators open data governance.');
    let result: unknown = null;

    switch (input.action) {
      case 'steward': {
        if (!isAdmin) forbid('Only administrators appoint data stewards.');
        const { rows } = await zite.sql({ query: `SELECT "id" FROM "ziteUsers" WHERE lower("email") = lower($1) LIMIT 1`, params: [input.email.trim()] });
        const uid = rows[0] ? String((rows[0] as Row).id) : '';
        if (!uid || !(await tenantScope(T)).members.has(uid)) forbid('That person is not a member of your institution.');
        fail(await one(`SELECT dgv_set_steward($1,$2,$3,$4) AS r`, [me, T, uid, input.on]));
        await audit(a, `Data steward ${input.on ? 'appointed' : 'removed'}`, `user:${uid}`, '', 'Administrator');
        break;
      }
      case 'term': result = fail(await one(`SELECT dgv_term($1,$2,$3,$4) AS r`, [me, T, input.name, input.definition])); break;
      case 'termStep': fail(await one(`SELECT dgv_term_step($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.step, input.expectedVersion])); break;
      case 'asset': result = fail(await one(`SELECT dgv_asset($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.name, input.system, input.classification, input.systemOfRecord])); break;
      case 'classify': result = fail(await one(`SELECT dgv_classify($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.classification, input.expectedVersion])); break;
      case 'link': fail(await one(`SELECT dgv_link($1,$2,$3,$4,$5) AS r`, [me, T, input.fromId, input.toId, input.transform])); break;
      case 'rule': result = fail(await one(`SELECT dgv_rule($1,$2,$3,$4,$5) AS r`, [me, T, input.assetId, input.description, input.threshold])); break;
      case 'measure': result = fail(await one(`SELECT dgv_measure($1,$2,$3,$4) AS r`, [me, T, input.ruleId, input.measured])); break;
      case 'resolveIssue': fail(await one(`SELECT dgv_resolve_issue($1,$2,$3,$4) AS r`, [me, T, input.id, input.text])); break;
      case 'retain': fail(await one(`SELECT dgv_retain($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.assetId, input.days, input.legalMinDays, input.basis])); break;
      case 'conflict': result = fail(await one(`SELECT dgv_conflict($1,$2,$3,$4,$5,$6) AS r`, [me, T, input.subject, input.sourceA, input.sourceB, input.detail])); break;
      case 'settle': fail(await one(`SELECT dgv_settle($1,$2,$3,$4,$5) AS r`, [me, T, input.id, input.source, input.rationale])); break;
      case 'get': break;
    }

    const terms = (await sql.query(`SELECT * FROM dgv_terms WHERE tenant_id = $1 ORDER BY name`, [T])) as Row[];
    const assets = (await sql.query(`SELECT a.*, r.days, r.legal_min_days, r.basis FROM dgv_assets a LEFT JOIN dgv_retention r ON r.asset_id = a.id WHERE a.tenant_id = $1 ORDER BY a.name`, [T])) as Row[];
    const links = (await sql.query(`SELECT l.* FROM dgv_lineage l JOIN dgv_assets a ON a.id = l.from_id WHERE a.tenant_id = $1`, [T])) as Row[];
    const rules = (await sql.query(`SELECT q.*, (SELECT row_to_json(x) FROM (SELECT measured, passed, at FROM dgv_results WHERE rule_id = q.id ORDER BY at DESC LIMIT 1) x) AS last
      FROM dgv_rules q JOIN dgv_assets a ON a.id = q.asset_id WHERE a.tenant_id = $1 ORDER BY q.id`, [T])) as Row[];
    const issues = (await sql.query(`SELECT s.*, q.asset_id, q.description, r.measured FROM dgv_issues s JOIN dgv_results r ON r.id = s.result_id JOIN dgv_rules q ON q.id = r.rule_id JOIN dgv_assets a ON a.id = q.asset_id
      WHERE a.tenant_id = $1 ORDER BY s.state, s.id DESC`, [T])) as Row[];
    const conflicts = (await sql.query(`SELECT * FROM dgv_conflicts WHERE tenant_id = $1 ORDER BY state, id DESC`, [T])) as Row[];
    const stewards = (await sql.query(`SELECT user_id FROM dgv_stewards WHERE tenant_id = $1 AND revoked_at IS NULL`, [T])) as Row[];
    const nm = await userNames([...new Set([...terms.flatMap((t) => [t.proposed_by, t.approved_by]), ...assets.flatMap((x) => [x.owner_id, x.pending_by]), ...conflicts.flatMap((c) => [c.raised_by, c.resolved_by]), ...stewards.map((s) => s.user_id)].filter(Boolean).map(String))]);
    const n = (u: unknown) => (u ? nm[String(u)] ?? 'Someone' : '');
    const name = (id: unknown) => String(assets.find((x) => String(x.id) === String(id))?.name ?? '');
    return {
      result, me, steward, isAdmin,
      terms: terms.map((t) => ({ id: Number(t.id), name: String(t.name), definition: String(t.definition), state: String(t.state), proposedBy: n(t.proposed_by), mine: t.proposed_by === me, approvedBy: n(t.approved_by), version: Number(t.version) })),
      assets: assets.map((x) => ({ id: Number(x.id), name: String(x.name), system: String(x.system), classification: String(x.classification), systemOfRecord: String(x.system_of_record), owner: n(x.owner_id),
        pending: x.pending_class ? { to: String(x.pending_class), by: n(x.pending_by), mine: x.pending_by === me } : null, version: Number(x.version),
        retention: x.days == null ? null : { days: Number(x.days), legalMin: Number(x.legal_min_days), basis: String(x.basis) },
        feeds: links.filter((l) => String(l.from_id) === String(x.id)).map((l) => ({ to: name(l.to_id), transform: String(l.transform) })),
        fedBy: links.filter((l) => String(l.to_id) === String(x.id)).map((l) => ({ from: name(l.from_id), transform: String(l.transform) })) })),
      rules: rules.map((q) => { const l = q.last as { measured: number; passed: boolean; at: string } | null;
        return { id: Number(q.id), asset: name(q.asset_id), description: String(q.description), threshold: Number(q.threshold), last: l ? { measured: Number(l.measured), passed: !!l.passed, at: iso(l.at) } : null }; }),
      issues: issues.map((s) => ({ id: Number(s.id), asset: name(s.asset_id), description: String(s.description), measured: Number(s.measured), state: String(s.state), resolution: String(s.resolution) })),
      conflicts: conflicts.map((c) => ({ id: Number(c.id), subject: String(c.subject), a: String(c.source_a), b: String(c.source_b), detail: String(c.detail), state: String(c.state), raisedBy: n(c.raised_by), mine: c.raised_by === me,
        authoritative: c.authoritative ? String(c.authoritative) : null, rationale: String(c.rationale), resolvedBy: n(c.resolved_by) })),
      stewards: stewards.map((s) => n(s.user_id)),
    };
  },
});
