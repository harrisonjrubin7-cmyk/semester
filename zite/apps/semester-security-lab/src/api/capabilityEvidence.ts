import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityReader } from '../lib/access';

export default createEndpoint({
  description: 'Lists per-stage evidence entries for one capability',
  authenticated: true,
  inputSchema: z.object({ capabilityId: z.string() }),
  outputSchema: z.object({
    entries: z.array(z.object({
      id: z.string(), stage: z.string(), summary: z.string(), reference: z.string(),
      environment: z.string(), scope: z.string(), recordedAt: z.string(), reviewer: z.string(),
    })),
  }),
  execute: async ({ input, context }) => {
    await requireSecurityReader(context.user.id);
    const { records } = await zite.capabilityEvidence.findAll({ filters: { capability: input.capabilityId }, limit: 500 });
    const ids = [...new Set(records.flatMap((r) => (Array.isArray(r.reviewer) ? r.reviewer : r.reviewer ? [r.reviewer] : [])))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { records: users } = await zite.auth.findAllUsers({ limit: 100 });
      users.filter((u) => ids.includes(u.id)).forEach((u) => names.set(u.id, u.name || u.email));
    }
    const entries = records.map((r) => {
      const rid = Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer;
      return {
        id: r.id, stage: r.stage ?? '', summary: r.summary ?? '', reference: r.evidenceReference ?? '',
        environment: r.environment ?? '', scope: r.scope ?? '', recordedAt: r.recordedAt ?? '',
        reviewer: rid ? names.get(rid) ?? 'Unknown reviewer' : 'Unknown reviewer',
      };
    }).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return { entries };
  },
});
