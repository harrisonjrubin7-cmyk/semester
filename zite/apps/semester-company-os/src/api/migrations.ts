import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { pg, sha256 } from '../lib/fin';
import { ensureCoRoles, rolesOf } from '../lib/coRoles';
import { MIG_MIGRATION } from '../lib/migMigration';

let ready: Promise<void> | null = null;
const ensureMig = () => {
  if (!ready) ready = (async () => { await ensureCoRoles(); const sql = pg(); for (const s of MIG_MIGRATION) await sql.query(s); })().catch((e) => { ready = null; throw e; });
  return ready;
};

// Implementation Delivery (APP-024): gated domain migrations. Only implementation leads see or run them here; the institution
// approves cutover from its own console in the Semester app. This records and gates the migration; it moves no data.
export default createEndpoint({
  description: 'Domain migrations: list for implementation leads, and run one gated migration step atomically',
  authenticated: true,
  inputSchema: z.discriminatedUnion('op', [
    z.object({ op: z.literal('list') }),
    z.object({ op: z.literal('run'), commandKey: z.string().min(8).max(80), action: z.enum(['create', 'inventory', 'plan', 'record_run', 'advance', 'cutover', 'rollback', 'complete']),
      projectId: z.string().optional(), version: z.number().int().optional(), tenantId: z.string().optional(), domain: z.string().optional(), title: z.string().max(140).optional(),
      item: z.string().max(140).optional(), sourceSystem: z.string().max(80).optional(), recordCount: z.number().int().min(0).optional(), owner: z.string().max(80).optional(),
      mappingNote: z.string().max(2000).optional(), rollbackPlan: z.string().max(2000).optional(), rollbackHours: z.number().int().min(24).max(720).optional(),
      kind: z.enum(['validation', 'dual_run', 'post_cutover']).optional(), sourceCount: z.number().int().min(0).optional(), targetCount: z.number().int().min(0).optional(),
      mismatches: z.number().int().min(0).optional(), note: z.string().max(500).optional(), reason: z.string().max(500).optional() }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    await ensureMig();
    const sql = pg();
    const me = context.user.id;
    if (!(await rolesOf(me)).includes('impl_lead')) {
      const m = 'You don’t have the implementation lead role.';
      throw new ZiteError({ code: 'FORBIDDEN', message: m, userFacingMessage: m });
    }
    if (input.op === 'run') {
      const { commandKey, action, projectId, ...p } = input;
      const payload: Record<string, unknown> = { ...p };
      if (action === 'create') {
        const inst = p.tenantId ? await zite.institutions.findOne({ id: p.tenantId }) : undefined;
        if (!inst) throw new ZiteError('Choose an institution.');
        payload.tenantName = inst.name ?? '';
      }
      const hash = await sha256(JSON.stringify({ action, projectId, ...p }));
      const rows = (await sql.query(`SELECT mig_cmd($1,$2,$3,$4,$5,$6::jsonb) AS r`, [me, commandKey, hash, action, projectId ?? null, JSON.stringify(payload)])) as { r: { id: string | null; resultCode: string; message: string; replay?: boolean } }[];
      const r = rows[0].r;
      return { id: r.id ?? '', resultCode: r.resultCode, message: r.message, replay: !!r.replay };
    }
    const [projects, inv, runs, appr, tl, insts, { records: users }] = await Promise.all([
      sql.query(`SELECT p.*, mig_evidence_hash(p.id) AS evidence FROM mig_projects p ORDER BY (p.stage IN ('completed','rolled_back')), p.number DESC LIMIT 100`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT * FROM mig_inventory ORDER BY id`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT * FROM mig_runs ORDER BY id`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT * FROM mig_approvals ORDER BY id`) as Promise<Record<string, unknown>[]>,
      sql.query(`SELECT * FROM mig_timeline ORDER BY id`) as Promise<Record<string, unknown>[]>,
      zite.institutions.findAll({ limit: 200 }),
      zite.auth.findAllUsers({ limit: 200 }),
    ]);
    const name = (id: unknown) => { if (!id) return ''; const u = users.find((x) => x.id === String(id)); return u ? (u.id === me ? 'You' : u.name || u.email) : 'Institution approver'; };
    const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
    return {
      me,
      institutions: insts.records.map((i) => ({ id: i.id, name: i.name ?? '', sample: !!i.isSample })),
      projects: projects.map((p) => ({
        id: String(p.id), number: Number(p.number), title: String(p.title), tenant: String(p.tenant_name), domain: String(p.domain), stage: String(p.stage), version: Number(p.version),
        lead: name(p.lead_id), mappingNote: (p.mapping_note as string) ?? '', rollbackPlan: (p.rollback_plan as string) ?? '', rollbackHours: Number(p.rollback_hours),
        cutoverAt: iso(p.cutover_at), windowEndsAt: iso(p.window_ends_at), endedReason: (p.ended_reason as string) ?? '',
        evidenceApproved: appr.some((a) => a.project_id === p.id && a.evidence_hash === p.evidence),
        inventory: inv.filter((x) => x.project_id === p.id).map((x) => ({ item: String(x.item), source: String(x.source_system), count: Number(x.record_count), owner: String(x.owner) })),
        runs: runs.filter((x) => x.project_id === p.id).map((x) => ({ kind: String(x.kind), source: Number(x.source_count), target: Number(x.target_count), mismatches: Number(x.mismatches), passed: !!x.passed, at: iso(x.at), by: name(x.recorded_by) })),
        approvals: appr.filter((x) => x.project_id === p.id).map((x) => ({ by: name(x.approver_id), note: String(x.note), at: iso(x.at), current: x.evidence_hash === p.evidence })),
        timeline: tl.filter((x) => x.project_id === p.id).map((x) => ({ actor: name(x.actor_id), action: String(x.action), detail: String(x.detail), at: iso(x.at) })),
      })),
    };
  },
});
