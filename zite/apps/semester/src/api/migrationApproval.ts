import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { requireAction, audit } from '../lib/server';
import { pg } from '../lib/pg';

// Institution side of a domain migration (APP-024): the institution's administrator reviews Semester's evidence for a
// migration in THEIR institution and approves cutover. The institution is resolved on the server from the caller's
// membership; the approval binds to the exact evidence shown (mig_institution_approve, defined by Company OS).
export default createEndpoint({
  description: 'Institution administrators review migration evidence for their institution and approve cutover',
  authenticated: true,
  inputSchema: z.discriminatedUnion('action', [
    z.object({ action: z.literal('list') }),
    z.object({ action: z.literal('approve'), projectId: z.string(), seenHash: z.string(), note: z.string().min(10).max(1000) }),
  ]),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'connector.manage');
    const sql = pg();
    const ready = ((await sql.query(`SELECT to_regprocedure('mig_institution_approve(text,text,text,text,text)') IS NOT NULL AS ok`)) as { ok: boolean }[])[0].ok;
    if (!ready) return { ready: false, projects: [] };
    if (input.action === 'approve') {
      const r = (await sql.query(`SELECT mig_institution_approve($1,$2,$3,$4,$5) AS e`, [a.userId, a.institutionId, input.projectId, input.seenHash, input.note])) as { e: string | null }[];
      if (r[0].e) throw new ZiteError({ code: 'FORBIDDEN', message: r[0].e, userFacingMessage: r[0].e });
      await audit(a, 'Migration cutover approved', `migration:${input.projectId}`, input.note, 'Institution administrator');
    }
    const rows = (await sql.query(`SELECT p.id, p.number, p.title, p.domain, p.stage, p.rollback_plan, p.rollback_hours, p.cutover_at, p.window_ends_at, mig_evidence_hash(p.id) AS evidence,
        (SELECT json_agg(json_build_object('kind', r.kind, 'source', r.source_count, 'target', r.target_count, 'mismatches', r.mismatches, 'passed', r.passed, 'at', r.at) ORDER BY r.id) FROM mig_runs r WHERE r.project_id = p.id) AS runs,
        EXISTS (SELECT 1 FROM mig_approvals x WHERE x.project_id = p.id AND x.evidence_hash = mig_evidence_hash(p.id)) AS approved
      FROM mig_projects p WHERE p.tenant_id = $1 ORDER BY p.number DESC`, [a.institutionId])) as Record<string, unknown>[];
    return {
      ready: true,
      projects: rows.map((p) => ({ id: String(p.id), number: Number(p.number), title: String(p.title), domain: String(p.domain), stage: String(p.stage),
        rollbackPlan: (p.rollback_plan as string) ?? '', rollbackHours: Number(p.rollback_hours), cutoverAt: p.cutover_at ? String(p.cutover_at) : null,
        windowEndsAt: p.window_ends_at ? String(p.window_ends_at) : null, evidence: String(p.evidence), approved: !!p.approved,
        runs: ((p.runs as { kind: string; source: number; target: number; mismatches: number; passed: boolean; at: string }[] | null) ?? []) })),
    };
  },
});
