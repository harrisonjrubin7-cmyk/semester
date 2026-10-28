import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { rolesOf } from '../lib/coRoles';
import { pg } from '../../../semester/src/lib/pg';
import { ensureRel } from '../../../semester/src/lib/relServer';

// What institutions chose to share (readiness check states) and what Security Lab released (coverage only).
// Company OS never reads tenant records for this: it reads only the released snapshots.
export default createEndpoint({
  description: 'Customer readiness that institutions shared, and Security Lab assurance coverage that was released',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    if (!(await rolesOf(context.user.id)).length) throw new ZiteError({ code: 'FORBIDDEN', message: 'company role required', userFacingMessage: 'This needs a company role (granted by the founder).' });
    await ensureRel();
    const [rd, as] = await Promise.all([
      pg().query(`SELECT tenant_id, snapshot, shared_at FROM rel_readiness WHERE stopped_at IS NULL ORDER BY shared_at DESC`) as unknown as Promise<{ tenant_id: string; snapshot: unknown; shared_at: string }[]>,
      pg().query(`SELECT snapshot, released_at FROM rel_assurance WHERE withdrawn_at IS NULL ORDER BY released_at DESC`) as unknown as Promise<{ snapshot: unknown; released_at: string }[]>,
    ]);
    const insts = rd.length ? (await zite.institutions.findAll({ limit: 500, fields: ['name'] })).records : [];
    return {
      readiness: rd.map((r) => ({ institution: insts.find((i) => i.id === r.tenant_id)?.name ?? 'Institution', sharedAt: new Date(String(r.shared_at)).toISOString(), ...(r.snapshot as object) })),
      assurance: as.map((r) => ({ ...(r.snapshot as object), releasedAt: new Date(String(r.released_at)).toISOString() })),
    };
  },
});
