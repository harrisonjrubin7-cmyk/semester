import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  authenticated: true,
  description: 'Creates or updates a rate-limit policy (bounded values)',
  inputSchema: z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(100),
    scope: z.enum(['ip', 'user', 'tenant', 'ai', 'export']),
    capacity: z.number(),
    refillPerSecond: z.number(),
    cost: z.number(),
    version: z.string().min(1).max(20),
    status: z.enum(['draft', 'approved']),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input }) => {
    const { id, ...rec } = input;
    const ok = (v: number, max: number) => Number.isFinite(v) && v > 0 && v <= max;
    if (!ok(rec.capacity, 100000) || !ok(rec.refillPerSecond, 10000) || !ok(rec.cost, rec.capacity)) {
      throw new ZiteError('Capacity, refill and cost must be positive, bounded, and cost ≤ capacity.');
    }
    if (id) { await zite.rateLimitPolicies.update({ id, record: rec }); return { id }; }
    const r = await zite.rateLimitPolicies.create({ record: rec });
    return { id: r.id };
  },
});
