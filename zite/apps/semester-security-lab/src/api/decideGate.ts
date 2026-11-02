import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const deny = (m: string) => new ZiteError(m);

export default createEndpoint({
  authenticated: true,
  description: 'Satisfies or rejects a release gate using a recorded run as evidence',
  inputSchema: z.object({ gateId: z.string(), runId: z.string().optional(), decision: z.enum(['satisfied', 'rejected', 'pending']) }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ input, context }) => {
    const gate = await zite.releaseGates.findOne({ id: input.gateId });
    if (!gate) throw deny('Gate not found.');
    if (input.decision === 'satisfied') {
      if (!input.runId) throw deny('Pick an evidence run.');
      const run = await zite.labRuns.findOne({ id: input.runId });
      if (!run) throw deny('Evidence run not found.');
      if (run.mode === 'simulation') throw deny('Simulation results can never satisfy a release gate.');
      if (run.mode !== gate.requiredMode) throw deny(`This gate needs ${gate.requiredMode} evidence; the run is ${run.mode}.`);
      if (run.status !== 'passed') throw deny('Only a passed run can satisfy a gate.');
    }
    await zite.releaseGates.update({
      id: gate.id,
      record: {
        status: input.decision,
        evidenceRunId: input.decision === 'satisfied' ? input.runId! : '',
        approvedBy: input.decision === 'pending' ? null : context.user.id,
        decidedAt: input.decision === 'pending' ? null : new Date().toISOString(),
      },
    });
    return { ok: true };
  },
});
