import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireAccess, tenantScope } from '../lib/server';
import { scopedSearch } from '../lib/search';

export default createEndpoint({
  description: 'Searches only the records the signed-in member is allowed to see',
  authenticated: true,
  inputSchema: z.object({ q: z.string().max(200) }),
  outputSchema: z.object({ hits: z.array(z.object({ id: z.string(), kind: z.string(), title: z.string(), detail: z.string(), source: z.string(), path: z.string() })) }),
  execute: async ({ input, context }) => {
    const a = await requireAccess(context.user.id);
    if (!input.q.trim()) return { hits: [] };
    const hits = (await scopedSearch(a.userId, input.q, await tenantScope(a.institutionId), a.isSample ? 'Sample' : 'Official')).slice(0, 25);
    return { hits };
  },
});
