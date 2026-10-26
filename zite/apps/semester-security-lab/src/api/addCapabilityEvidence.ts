import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const STAGES = ['Designed', 'Implemented', 'Tested', 'Deployed', 'Institution-authorized', 'Production-enabled', 'Operationally accepted', 'Incumbent decommissioned'] as const;
const ENVS = ['Synthetic', 'Preview', 'Staging', 'Production'] as const;

export default createEndpoint({
  description: 'Records evidence for one stage of a capability, signed by the current reviewer',
  authenticated: true,
  inputSchema: z.object({
    capabilityId: z.string(), stage: z.enum(STAGES), environment: z.enum(ENVS),
    summary: z.string(), reference: z.string(), scope: z.string(),
  }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    if (input.reference.trim().length < 10) throw new ZiteError('Evidence needs a concrete reference (run ID, test output, approval record).');
    if (!input.scope.trim()) throw new ZiteError('Say what scope this evidence covers.');
    if (['Deployed', 'Production-enabled', 'Operationally accepted', 'Incumbent decommissioned'].includes(input.stage) && input.environment === 'Synthetic')
      throw new ZiteError('Deployment or production evidence cannot come from a synthetic environment.');
    await zite.capabilityEvidence.create({
      record: {
        summary: input.summary.trim() || `${input.stage} evidence`, capability: [input.capabilityId], stage: input.stage,
        evidenceReference: input.reference.trim(), environment: input.environment, scope: input.scope.trim(),
        recordedAt: new Date().toISOString(), reviewer: context.user.id,
      },
    });
    return { ok: true };
  },
});
