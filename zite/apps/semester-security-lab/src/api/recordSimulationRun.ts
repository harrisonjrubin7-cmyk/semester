import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityLead } from '../lib/access';

export default createEndpoint({
  authenticated: true,
  description: 'Saves a simulator result as a simulation-mode run',
  inputSchema: z.object({
    runType: z.enum(['Token Bucket', 'JWT']),
    title: z.string().min(1).max(200),
    status: z.enum(['passed', 'failed', 'recorded']),
    summary: z.string().max(4000),
    evidence: z.string().max(20000),
  }),
  outputSchema: z.object({ id: z.string() }),
  execute: async ({ input, context }) => {
    await requireSecurityLead(context.user.id);
    const now = new Date().toISOString();
    // Mode is forced server-side: simulators can never produce sandbox/staging evidence.
    const r = await zite.labRuns.create({
      record: {
        title: input.title, runType: input.runType, mode: 'simulation', status: input.status,
        environment: 'Browser simulation', runnerVersion: 'lab-sim v1', applicationCommit: 'n/a',
        initiatedBy: context.user.id, startedAt: now, finishedAt: now,
        summary: input.summary, evidence: input.evidence,
      },
    });
    return { id: r.id };
  },
});
