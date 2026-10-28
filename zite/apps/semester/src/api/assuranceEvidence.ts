import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAction } from '../lib/server';
import { pg } from '../lib/pg';
import { ensureRel } from '../lib/relServer';

// Product assurance coverage the Security Lab released (sanitised: stages and environments only). Not tenant data.
export default createEndpoint({
  description: 'Released Security Lab assurance coverage for the product (no evidence text, no production data)',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    await requireAction(context.user.id, 'audit.read');
    await ensureRel();
    const rows = (await pg().query(`SELECT snapshot, released_at FROM rel_assurance WHERE withdrawn_at IS NULL ORDER BY released_at DESC LIMIT 500`)) as { snapshot: unknown; released_at: string }[];
    return { releases: rows.map((r) => ({ ...(r.snapshot as object), releasedAt: new Date(String(r.released_at)).toISOString() })) };
  },
});
