import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { renderRegistryProjection } from '../scripts/projection.ts';
import { loadRegistry, repositoryRoot } from '../scripts/registry-io.ts';
import { resolveInside } from '../scripts/validation.ts';
import type { RegistrySnapshot } from '../types.ts';
import { validateInception } from '../validators/inception-validator.ts';
import { validateRelease } from '../validators/release-validator.ts';

/**
 * Review findings on the registry gates, each shown to bite by breaking one
 * thing in a copy of the committed registry (see inception-validator.test.ts).
 */
const registry = await loadRegistry();
const copy = (): RegistrySnapshot => structuredClone(registry);

test('an evidence path cannot name something outside the directory it is judged against', () => {
  const root = resolve(repositoryRoot);
  assert.equal(resolveInside(root, 'docs/ARCHITECTURE.md'), resolve(root, 'docs/ARCHITECTURE.md'));
  assert.equal(resolveInside(root, '../etc/passwd'), null);
  assert.equal(resolveInside(root, '/etc/passwd'), null);
  assert.equal(resolveInside(resolve(root, 'release'), '../README.md'), null);
});

test('only a literal true verifies an adapter in the release gate', () => {
  const snapshot = copy();
  const adapter = snapshot.inception!.adapters[0];
  (adapter as { sandbox_verified: unknown }).sandbox_verified = 'false';
  assert.ok(validateInception(snapshot).some((i) => i.code === 'sandbox_verified_not_boolean' && i.path === `adapters.${adapter.key}.sandbox_verified`));
  assert.ok(validateRelease(snapshot).inception.unverifiedAdapters.includes(adapter.key));
});

test('the release gate names every completion claim the coverage matrix counts', () => {
  const inception = registry.inception!;
  const decision = validateRelease(registry);
  const uncatalogued = inception.events.filter((e) => e.catalog_event === null).map((e) => `${e.os}.${e.event}`).sort();
  assert.deepEqual(decision.inception.eventsWithoutCatalog, uncatalogued);
  assert.ok(uncatalogued.length > 0, 'the committed registry has proposed events, so the claim is live');

  const contracted = new Set(inception.screen_contracts.map((c) => c.route));
  const unrouted = [...new Set(inception.operating_systems.flatMap((os) => os.routes))].filter((r) => !contracted.has(r)).sort();
  assert.deepEqual(decision.inception.routesWithoutContracts, unrouted);
  assert.ok(unrouted.length > 0, 'the committed registry has routes without contracts, so the claim is live');

  const undeployed = (registry.workspaces ?? []).filter((w) => w.refs.deployments.length === 0).map((w) => w.key).sort();
  assert.deepEqual(decision.inception.pilotScopesWithoutDeployment, undeployed);
  assert.equal(decision.allowed, false);
});

test('a route stops being named once a screen contract covers it', () => {
  const missing = validateRelease(registry).inception.routesWithoutContracts[0];
  const snapshot = copy();
  snapshot.inception!.screen_contracts = [...snapshot.inception!.screen_contracts, { ...snapshot.inception!.screen_contracts[0], route: missing }];
  assert.ok(!validateRelease(snapshot).inception.routesWithoutContracts.includes(missing));
});

test('the projection lowers before it attaches, and raises a capability only after its evidence exists', () => {
  const sql = renderRegistryProjection(registry).split('\n');
  const passes = ['-- 1.', '-- 2.', '-- 3.', '-- 4.', '-- 5.'].map((prefix) => sql.findIndex((line) => line.startsWith(prefix)));
  assert.ok(passes.every((index) => index >= 0), 'every pass is present');
  assert.deepEqual(passes, [...passes].sort((a, b) => a - b));
  assert.ok(!sql.some((line) => line.includes("'active'")), 'no dependency or status claims active, which no projection can satisfy');
});

test('a mature capability gets its test evidence before it is raised to deployed', () => {
  const snapshot = copy();
  const capability = snapshot.capabilities[0];
  capability.maturity = { ...capability.maturity, api: true, user_interface: true, e2e_tested: true, production_ready: true };
  capability.evidence = { ...capability.evidence, e2e: [{ kind: 'test', path: 'tests/example.test.ts' }] } as typeof capability.evidence;
  const sql = renderRegistryProjection(snapshot).split('\n');
  const evidence = sql.findIndex((line) => line.includes("'test', 'tests/example.test.ts#e2e'"));
  // Pass 5 is the only raise: it is the update that skips rows already at the status (pass 1 lowers with a rank comparison instead).
  const raise = sql.findIndex((line) => line.includes(`where capability_key = '${capability.key}' and status <> 'deployed'::private.registry_status;`));
  assert.ok(evidence >= 0, 'the test evidence is projected');
  assert.ok(raise >= 0, 'the raise to deployed is projected');
  assert.ok(evidence < raise, 'evidence is attached before the status that needs it');
});
