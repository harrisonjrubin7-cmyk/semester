import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAction, forbid, audit } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureRel, logRel } from '../lib/relServer';
import { readinessRelease } from '../lib/releaseRules';
import readiness from './institutionReadiness';

type Row = Record<string, unknown>;
export default createEndpoint({
  description: 'Institution administrators choose whether Semester company staff see their readiness status (check states only, no details)',
  authenticated: true,
  inputSchema: z.object({ action: z.enum(['status', 'share', 'stop']) }),
  outputSchema: z.any(),
  execute: async ({ input, context }) => {
    const a = await requireAction(context.user.id, 'member.manage');
    await ensureRel();
    const T = a.institutionId;
    if (input.action === 'share') {
      const full = await readiness.execute({ input: {}, context } as never);
      const snap = readinessRelease(full as never);
      await pg().query(`INSERT INTO rel_readiness (tenant_id, snapshot, shared_by) VALUES ($1,$2,$3) ON CONFLICT (tenant_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, shared_by = EXCLUDED.shared_by, shared_at = now(), stopped_at = NULL`, [T, JSON.stringify(snap), a.userId]);
      await logRel('readiness', T, a.userId, 'shared');
      await audit(a, 'Readiness shared with Semester company', `institution:${T}`, 'check states only', a.roles.join(', '));
    } else if (input.action === 'stop') {
      const r = (await pg().query(`UPDATE rel_readiness SET stopped_at = now() WHERE tenant_id = $1 AND stopped_at IS NULL RETURNING tenant_id`, [T])) as Row[];
      if (!r.length) forbid('Readiness is not being shared.');
      await logRel('readiness', T, a.userId, 'stopped');
      await audit(a, 'Readiness sharing stopped', `institution:${T}`, '', a.roles.join(', '));
    }
    const cur = ((await pg().query(`SELECT snapshot, shared_at, stopped_at FROM rel_readiness WHERE tenant_id = $1`, [T])) as Row[])[0];
    return { sharing: !!cur && !cur.stopped_at, sharedAt: cur ? new Date(String(cur.shared_at)).toISOString() : null, snapshot: cur && !cur.stopped_at ? cur.snapshot : null };
  },
});
