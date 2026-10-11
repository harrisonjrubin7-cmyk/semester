import assert from 'node:assert/strict';
import test from 'node:test';
import { COMMON_CONTRACT, systemPrompt } from '../src/agents/contract.ts';
import { moduleAgents } from '../src/agents/modules.ts';
import { ROSTER, agent } from '../src/agents/roster.ts';
import { SUITES, suite } from '../src/agents/suites.ts';
import { loadEcosystemRegistry, buildCoverageMatrix, coverageSummary } from '../src/registry/coverage.ts';
import { HANDLERS } from '../src/runtime/handlers.ts';
import { READ_ONLY_TOOLS } from '../types.ts';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

test('thirty-three agents, unique ids and keys, A01..A33 in order', () => {
  assert.equal(ROSTER.length, 33);
  assert.deepEqual(ROSTER.map((item) => item.id), Array.from({ length: 33 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`));
  assert.equal(new Set(ROSTER.map((item) => item.key)).size, 33);
  assert.equal(agent('independent-verifier')?.id, 'A16');
});

test('every agent belongs to one of the twelve suites and every suite has at least one agent', () => {
  for (const item of ROSTER) assert.ok(suite(item.suite), `${item.id} names suite ${item.suite}`);
  for (const item of SUITES) assert.ok(ROSTER.some((a) => a.suite === item.key), `${item.key} has an agent`);
});

test('every contract is complete and its prompt carries the common contract first', () => {
  for (const item of ROSTER) {
    for (const field of ['purpose', 'prompt', 'taskTypes', 'requiredInputs', 'tools', 'prohibited', 'acceptance', 'verification', 'escalation'] as const) {
      const value = item[field];
      assert.ok(Array.isArray(value) ? value.length > 0 : String(value).trim().length > 0, `${item.id}.${field}`);
    }
    assert.ok(item.limits.maxTurns > 0 && item.limits.maxToolCalls > 0 && item.limits.maxElapsedMs > 0 && item.limits.maxConcurrent > 0, `${item.id} limits`);
    assert.ok(systemPrompt(item).startsWith(COMMON_CONTRACT), `${item.id} prompt starts with the common contract`);
    assert.ok(systemPrompt(item).includes(item.prompt.trim()));
  }
});

test('write access is explicit: an agent with write_file names allowed writes, an agent without has none', () => {
  for (const item of ROSTER) {
    if (item.tools.includes('write_file')) assert.ok(item.allowedWrites.length > 0, `${item.id} writes need allowed paths`);
    else assert.deepEqual(item.allowedWrites, [], `${item.id} has no write tool and so no allowed writes`);
    if (item.implementation === 'model') assert.ok(item.tools.every((tool) => READ_ONLY_TOOLS.includes(tool) || tool === 'model' || tool === 'external_send' || tool === 'release_adapter'), `${item.id} model-only agents get no development tools`);
  }
});

test('the progressive first eight have a deterministic handler for at least one task type; the rest route to the model port', () => {
  const first = ['A01', 'A02', 'A04', 'A07', 'A10', 'A15', 'A16', 'A33'];
  for (const id of first) {
    const item = agent(id)!;
    assert.ok(item.implementation !== 'model', `${id} is not model-only`);
    if (id !== 'A01') assert.ok(item.taskTypes.some((type) => type in HANDLERS), `${id} has a handler for one of ${item.taskTypes.join(', ')}`);
  }
  assert.equal(agent('A01')!.taskTypes.includes('plan'), true, 'the coordinator plans through the runtime, not a handler');
});

test('module agents are generated from the registry roster, one per confirmed pilot release scope', () => {
  const registry = loadEcosystemRegistry(repositoryRoot);
  const modules = moduleAgents(registry);
  assert.equal(modules.length, registry.workspaces.length);
  assert.equal(modules.length, registry.manifest.pilot_release_scopes.length);
  assert.deepEqual(modules.map((m) => m.moduleKey), registry.manifest.pilot_release_scopes);
  for (const module of modules) {
    assert.deepEqual(module.allowedWrites, [], `${module.key} holds no specialist permission`);
    assert.ok(module.prompt.includes(`You own implementation coherence for ${registry.workspaces.find((w) => w.key === module.moduleKey)!.name}.`));
  }
  const registration = modules.find((m) => m.moduleKey === 'student-os')!;
  assert.ok(registration.roles.includes('student'));
  assert.ok(registration.permissions.some((line) => line.startsWith('registration.readiness:')));
});

test('the coverage matrix has exactly one row per registry record and derives status from evidence', () => {
  const registry = loadEcosystemRegistry(repositoryRoot);
  const rows = buildCoverageMatrix(registry, []);
  const expected = registry.workspaces.length + registry.capabilities.length + registry.systems.length + registry.roles.length + registry.screens.length + registry.workflows.length + registry.integrations.length + registry.controls.length + registry.documents.length + registry.tenants.length + registry.backlog.length;
  assert.equal(rows.length, expected);
  assert.equal(new Set(rows.map((row) => row.identifier)).size, rows.length, 'identifiers are unique');
  const summary = coverageSummary(rows);
  assert.equal(Object.values(summary).reduce((a, b) => a + b, 0), rows.length);
  assert.equal(summary.deployed, 0, 'nothing in the registry claims deployment');
  for (const row of rows.filter((r) => r.kind === 'workspace')) assert.ok(['blocked', 'specified', 'in_progress'].includes(row.implementationStatus), `${row.identifier} is ${row.implementationStatus}`);
  const withTask = buildCoverageMatrix(registry, [{ id: 'task_1', registryKeys: ['control.tenant-isolation'], status: 'verified' } as never]);
  assert.deepEqual(withTask.find((row) => row.identifier === 'control.tenant-isolation')!.tasks, [{ id: 'task_1', status: 'verified' }]);
});
