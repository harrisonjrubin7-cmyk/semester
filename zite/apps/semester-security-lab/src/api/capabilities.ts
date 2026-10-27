import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityReader } from '../lib/access';

export default createEndpoint({
  description: 'Lists the Semester capability register',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(), capability: z.string(), layer: z.string(), domain: z.string(), status: z.string(),
      app: z.string(), routes: z.string(), sourceAuthority: z.string(), phase: z.string(), blockers: z.string(), evidence: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    await requireSecurityReader(context.user.id);
    const { records } = await zite.capabilityRegister.findAll({ limit: 2000 });
    return {
      items: records.map((r) => ({
        id: r.id, capability: r.capability ?? '', layer: r.layer ?? '', domain: r.domain ?? '', status: r.status ?? 'Designed',
        app: r.app ?? '', routes: r.routes ?? '', sourceAuthority: r.sourceAuthority ?? '', phase: r.phase ?? '', blockers: r.blockers ?? '', evidence: r.evidence ?? '',
      })),
    };
  },
});
