import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { requireSecurityLead } from '../lib/access';
import { recordEvidence, STAGES, ENVS } from '../lib/recordEvidence';

export default createEndpoint({
  description: 'Records evidence for one stage of a capability, signed by the current reviewer',
  authenticated: true,
  inputSchema: z.object({
    capabilityId: z.string(), stage: z.enum(STAGES), environment: z.enum(ENVS),
    summary: z.string(), reference: z.string(), scope: z.string(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    await requireSecurityLead(context.user.id);
    await recordEvidence(context.user.id, input);
    return { ok: true };
  },
});
