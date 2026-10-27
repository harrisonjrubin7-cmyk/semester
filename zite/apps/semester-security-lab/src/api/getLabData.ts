import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { requireSecurityReader } from '../lib/access';

const s = z.string().optional();
const n = z.number().optional();

export default createEndpoint({
  authenticated: true,
  description: 'Loads all Security Lab records',
  inputSchema: z.object({}),
  outputSchema: z.object({
    runs: z.array(z.object({ id: z.string(), title: s, runType: s, mode: s, status: s, environment: s, runnerVersion: s, applicationCommit: s, startedAt: s, finishedAt: s, summary: s, evidence: s })),
    findings: z.array(z.object({ id: z.string(), objectName: s, check: s, severity: s, remediation: s, detail: s, evidence: s })),
    isolation: z.array(z.object({ id: z.string(), test: s, layer: s, actorFixture: s, targetFixture: s, expected: s, result: s, mode: s, evidence: s, lastRunAt: s })),
    gates: z.array(z.object({ id: z.string(), gate: s, requiredEvidence: s, requiredMode: s, status: s, evidenceRunId: s, decidedAt: s })),
    suites: z.array(z.object({ id: z.string(), name: s, kind: s, version: s, runnerReference: s, runnerStatus: s, description: s })),
    policies: z.array(z.object({ id: z.string(), name: s, scope: s, capacity: n, refillPerSecond: n, cost: n, version: s, status: s })),
    artifacts: z.array(z.object({ id: z.string(), item: s, screenOrComponent: s, sourceReference: s, intendedBehavior: s, implementationStatus: s, acceptanceTest: s })),
  }),
  execute: async ({ context }) => {
    await requireSecurityReader(context.user.id);
    const [runs, findings, isolation, gates, suites, policies, artifacts] = await Promise.all([
      zite.labRuns.findAll({ limit: 500, sort: [{ field: 'startedAt', direction: 'desc' }] }),
      zite.auditFindings.findAll({ limit: 500 }),
      zite.isolationTests.findAll({ limit: 200 }),
      zite.releaseGates.findAll({ limit: 100 }),
      zite.testSuites.findAll({ limit: 100 }),
      zite.rateLimitPolicies.findAll({ limit: 100 }),
      zite.artifactInventory.findAll({ limit: 500 }),
    ]);
    return {
      runs: runs.records.map(({ initiatedBy, ...r }) => r),
      findings: findings.records,
      isolation: isolation.records,
      gates: gates.records.map(({ approvedBy, ...g }) => g),
      suites: suites.records,
      policies: policies.records,
      artifacts: artifacts.records,
    };
  },
});
