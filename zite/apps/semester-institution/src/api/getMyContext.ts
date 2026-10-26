import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { getMemberships } from '../server/access';

export default createEndpoint({
  description: 'Lists the institutions and capabilities the signed-in person holds',
  authenticated: true,
  inputSchema: z.object({}),
  outputSchema: z.object({
    institutions: z.array(z.object({ id: z.string(), name: z.string(), capabilities: z.array(z.string()) })),
  }),
  execute: async ({ context }) => {
    const map = await getMemberships(context.user.id);
    const instIds = [...map.keys()].filter((id) => (map.get(id)?.size ?? 0) > 0);
    if (!instIds.length) return { institutions: [] };
    const { records } = await zite.institutions.findAll({ filters: { id: { in: instIds } }, limit: 200 });
    return {
      institutions: records.map((r) => ({ id: r.id, name: r.name ?? 'Institution', capabilities: [...(map.get(r.id) ?? [])] })),
    };
  },
});
