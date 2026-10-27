import { z } from 'zod';
import { createEndpoint, ZiteError } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityLead } from '../lib/access';

const typeFor: Record<string, string> = {
  'Go Redis Token Bucket': 'Go Tests',
  'PostgreSQL RLS Audit': 'RLS Audit',
  'Tenant Isolation': 'Isolation',
  'JWT Claims': 'JWT',
};

export default createEndpoint({
  authenticated: true,
  description: 'Requests an allowlisted suite run; records it as blocked when no runner is connected',
  inputSchema: z.object({ suiteId: z.string() }),
  outputSchema: z.object({ id: z.string(), status: z.string() }),
  execute: async ({ input, context }) => {
    await requireSecurityLead(context.user.id);
    const suite = await zite.testSuites.findOne({ id: input.suiteId });
    if (!suite) throw new ZiteError('That suite is not in the allowlist.');
    const now = new Date().toISOString();
    // No external runner integration exists yet, so execution never fabricates results.
    const r = await zite.labRuns.create({
      record: {
        title: `${suite.name} — execution request`,
        runType: typeFor[suite.kind ?? ''] ?? 'Go Tests',
        mode: suite.kind === 'JWT Claims' ? 'simulation' : 'staging',
        status: 'blocked',
        environment: 'Staging (not connected)', runnerVersion: 'none', applicationCommit: 'unknown',
        initiatedBy: context.user.id, startedAt: now, finishedAt: now,
        summary: suite.kind === 'JWT Claims'
          ? 'Use the JWT simulator screen to run this suite.'
          : `Blocked: requires an approved external runner (${suite.runnerReference}). No results were produced.`,
        evidence: '',
      },
    });
    if (suite.kind !== 'JWT Claims') {
      await zite.testSuites.update({ id: suite.id, record: { runnerStatus: 'Blocked' } });
    }
    if (suite.kind === 'Tenant Isolation') {
      const { records } = await zite.isolationTests.findAll({ limit: 200 });
      await zite.isolationTests.bulkCreate({
        records: records.map((t) => ({ test: t.test, result: 'blocked', mode: 'staging', lastRunAt: now, evidence: `Run ${r.id}: no staging runner connected.` })),
        matchOn: ['test'],
      });
    }
    return { id: r.id, status: 'blocked' };
  },
});
