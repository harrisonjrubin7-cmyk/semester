import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry } from '../scripts/registry-io.ts';
import { validateSnapshot } from '../scripts/validation.ts';
import type { RegistrySnapshot } from '../types.ts';
import { INCEPTION_OPERATING_SYSTEMS, JOURNEY_COUNT, REQUIRED_RELEASE_ARTIFACTS, inceptionCoverage, validateInception } from '../validators/inception-validator.ts';
import { validateRelease } from '../validators/release-validator.ts';
import { projectedStatus, renderRegistryProjection } from '../scripts/projection.ts';

/**
 * The committed registry is the fixture: it must be valid as a whole, and each
 * rule below is shown to bite by breaking one thing in a copy of it. A rule
 * that has never failed is not known to be a rule (CLAUDE.md), so every
 * negative case is one edit away from the real records, not a made-up shape.
 */
const registry = await loadRegistry();
const copy = (): RegistrySnapshot => structuredClone(registry);
const codes = (snapshot: RegistrySnapshot, prefix?: string): string[] =>
  validateInception(snapshot).filter((i) => !prefix || i.path.startsWith(prefix)).map(({ code }) => code);

test('the committed registry, inception layer included, is valid', async () => {
  assert.deepEqual(await validateSnapshot(registry), []);
  assert.equal(registry.inception?.operating_systems.length, INCEPTION_OPERATING_SYSTEMS.length);
  assert.equal(registry.inception?.journeys.length, JOURNEY_COUNT);
  assert.equal(registry.inception?.evidence_pack.length, REQUIRED_RELEASE_ARTIFACTS.length);
  assert.ok((registry.inception?.event_catalog.length ?? 0) > 50, 'EVENT_TYPES was read from packages/institution/src/events.ts');
});

test('a bounded snapshot without the inception layer is told so, once', () => {
  const { inception: _dropped, ...rest } = copy();
  assert.deepEqual(validateInception(rest).map(({ code }) => code), ['missing_inception_registry']);
});

test('the operating-system roster cannot lose, duplicate or overclaim a system', () => {
  const dropped = copy();
  dropped.inception!.operating_systems = dropped.inception!.operating_systems.filter((os) => os.key !== 'marketplace');
  assert.ok(codes(dropped).includes('os_roster_drift'));
  assert.ok(codes(dropped, 'events.event.marketplace').every((code) => code === 'unknown_os'), 'events of the dropped system now name an unknown system');
  assert.equal(codes(dropped, 'events.event.marketplace').length, 3);

  const claimed = copy();
  claimed.inception!.operating_systems.find((os) => os.key === 'student')!.status = 'implemented';
  assert.deepEqual(codes(claimed, 'operating_systems.student'), ['unsupported_os_claim']);

  const silent = copy();
  const admissions = silent.inception!.operating_systems.find((os) => os.key === 'admissions')!;
  admissions.gaps = ['Something else.'];
  assert.deepEqual(codes(silent, 'operating_systems.admissions'), ['undocumented_domain_gap']);
});

test('a route shared by two systems must be declared by both, and a pilot scope cannot go uncovered', () => {
  const collision = copy();
  collision.inception!.operating_systems.find((os) => os.key === 'security')!.shared_routes = {};
  assert.deepEqual(codes(collision, 'operating_systems.security'), ['unshared_route_collision']);
  assert.deepEqual(codes(collision, 'operating_systems.public'), [], 'the side that still declares the share is not at fault');

  const uncovered = copy();
  for (const os of uncovered.inception!.operating_systems) os.pilot_scopes = os.pilot_scopes.filter((scope) => scope !== 'alumni-portal');
  const alumni = uncovered.inception!.operating_systems.find((os) => os.key === 'alumni')!;
  alumni.pilot_scopes = ['student-os'];
  assert.ok(codes(uncovered).includes('uncovered_pilot_scope'));
});

test('a required event cannot claim a catalog type that does not exist, and cannot be implemented without one', () => {
  const phantom = copy();
  phantom.inception!.events.find((e) => e.key === 'event.registrar.readiness_evaluated')!.catalog_event = 'registration.readiness_imagined';
  assert.deepEqual(codes(phantom, 'events.event.registrar.readiness_evaluated'), ['unknown_catalog_event']);

  const overclaimed = copy();
  overclaimed.inception!.events.find((e) => e.key === 'event.student.course_created')!.status = 'implemented';
  assert.deepEqual(codes(overclaimed, 'events.event.student.course_created'), ['event_claim_without_catalog']);

  const understated = copy();
  understated.inception!.events.find((e) => e.key === 'event.student.task_completed')!.status = 'designed';
  assert.deepEqual(codes(understated, 'events.event.student.task_completed'), ['catalog_event_understated']);

  const unread = copy();
  unread.inception!.event_catalog = [];
  assert.ok(codes(unread).includes('missing_event_catalog'));
});

test('reference and derived connections reconcile; a delegation carries all four properties', () => {
  const reference = copy();
  reference.inception!.authority.find((a) => a.key === 'authority.official_grades')!.reconciliation_required = false;
  assert.deepEqual(codes(reference, 'authority.authority.official_grades'), ['reference_without_reconciliation']);

  const delegation = copy();
  delegation.inception!.authority.find((a) => a.key === 'authority.consent_delegation')!.delegation = { scope: true, purpose: true, expiry: false, revocation: true };
  assert.deepEqual(codes(delegation, 'authority.authority.consent_delegation'), ['incomplete_delegation']);

  const misplaced = copy();
  misplaced.inception!.authority.find((a) => a.key === 'authority.contract')!.delegation = { scope: true, purpose: true, expiry: true, revocation: true };
  assert.deepEqual(codes(misplaced, 'authority.authority.contract'), ['delegation_on_non_delegated']);
});

test('permissions are resource.action.scope with a declared scope and known roles', () => {
  const broad = copy();
  const permission = broad.inception!.permissions.find((p) => p.key === 'student.course.read.own')!;
  permission.key = 'student.course';
  permission.permission = 'student.course';
  assert.deepEqual(codes(broad, 'permissions.student.course'), ['invalid_permission_grammar']);

  const scope = copy();
  const other = scope.inception!.permissions.find((p) => p.key === 'ops.release.promote.production')!;
  other.key = 'ops.release.promote.everywhere';
  other.permission = 'ops.release.promote.everywhere';
  assert.deepEqual(codes(scope, 'permissions.ops.release.promote.everywhere'), ['unknown_permission_scope']);

  const role = copy();
  role.inception!.permissions.find((p) => p.key === 'registrar.override.approve.tenant')!.roles = ['registrar_overlord'];
  assert.deepEqual(codes(role, 'permissions.registrar.override.approve.tenant'), ['unknown_role']);
});

test('the twenty-four journeys are all present, cross known systems, and are verified only by a named test', () => {
  const missing = copy();
  missing.inception!.journeys = missing.inception!.journeys.filter((j) => j.number !== 24);
  assert.ok(codes(missing).includes('journey_roster_drift'));

  const verified = copy();
  const journey = verified.inception!.journeys.find((j) => j.number === 24)!;
  journey.status = 'verified';
  journey.gaps = [];
  assert.deepEqual(codes(verified, 'journeys.journey.24'), ['verified_without_tests']);

  const lost = copy();
  lost.inception!.journeys.find((j) => j.number === 1)!.crosses = ['public', 'lost_os'];
  assert.deepEqual(codes(lost, 'journeys.journey.01'), ['unknown_os']);
});

test('a screen contract exposes the seven view states, sits under its workspace, and names real roles, capabilities and events', () => {
  const states = copy();
  states.inception!.screen_contracts[0].states = ['ready', 'loading', 'empty', 'error', 'forbidden', 'offline'];
  assert.deepEqual(codes(states, 'screen_contracts'), ['incomplete_view_states']);

  const route = copy();
  route.inception!.screen_contracts[0].route = '/finance/readiness/:caseId';
  assert.deepEqual(codes(route, 'screen_contracts'), ['route_outside_workspace']);

  const refs = copy();
  refs.inception!.screen_contracts[0].capabilities = ['registrar.readiness.evaluate'];
  refs.inception!.screen_contracts[0].events = ['registrar.readiness.evaluated'];
  assert.deepEqual(codes(refs, 'screen_contracts'), ['unknown_capability', 'unknown_catalog_event']);

  const authority = copy();
  authority.inception!.screen_contracts[0].authority.reconciliation_required = false;
  assert.deepEqual(codes(authority, 'screen_contracts'), ['external_authority_without_reconciliation']);
});

test('an adapter cannot declare runtime health, carry a secret, or claim a sandbox it has not verified', () => {
  const runtime = copy();
  runtime.inception!.adapters.find((a) => a.key === 'adapter.lms')!.health = 'healthy';
  assert.deepEqual(codes(runtime, 'adapters.adapter.lms'), ['unsupported_runtime_health_claim']);

  const secret = copy();
  // Assembled from parts so the secret scanner does not read a Stripe-shaped literal; the value is still secret-shaped.
  secret.inception!.adapters.find((a) => a.key === 'adapter.email')!.credential_reference = ['sk', 'live', '0123456789abcdef'].join('_');
  assert.deepEqual(codes(secret, 'adapters.adapter.email'), ['credential_in_registry']);

  const sandbox = copy();
  sandbox.inception!.adapters.find((a) => a.key === 'adapter.calendar')!.sandbox_verified = true;
  assert.deepEqual(codes(sandbox, 'adapters.adapter.calendar'), ['sandbox_claim_without_verification']);

  const mismatch = copy();
  mismatch.inception!.adapters.find((a) => a.key === 'adapter.crm')!.status = 'designed';
  assert.deepEqual(codes(mismatch, 'adapters.adapter.crm'), ['adapter_status_health_mismatch']);
});

test('the evidence pack, the lifecycle and the workstreams hold their rosters', () => {
  const pack = copy();
  pack.inception!.evidence_pack = pack.inception!.evidence_pack.filter((a) => a.artifact !== 'rollback-drill.json');
  assert.ok(codes(pack).includes('evidence_pack_drift'));

  const producer = copy();
  const artifact = producer.inception!.evidence_pack.find((a) => a.artifact === 'approvers.json')!;
  artifact.status = 'verified';
  assert.deepEqual(codes(producer, 'evidence_pack.artifact.approvers'), ['verified_without_producer']);

  const exit = copy();
  exit.inception!.lifecycle[0].transitions.retained_or_deleted = ['created'];
  assert.deepEqual(codes(exit, 'lifecycle'), ['terminal_has_exit']);

  const stranded = copy();
  stranded.inception!.lifecycle[0].transitions.approved = [];
  assert.ok(codes(stranded, 'lifecycle').includes('unreachable_state'));

  const group = copy();
  group.inception!.workstreams.find((w) => w.letter === 'J')!.registry_groups = ['journeys', 'vibes'];
  assert.deepEqual(codes(group, 'workstreams.workstream.j'), ['unknown_registry_group']);
});

test('the coverage matrix is counted from the registry, and the release is blocked by every unmet inception claim', () => {
  const coverage = inceptionCoverage(registry);
  assert.equal(coverage.length, INCEPTION_OPERATING_SYSTEMS.length);
  const registrar = coverage.find((row) => row.identifier === 'registrar')!;
  assert.deepEqual(registrar.events, { required: 3, carried_by_catalog: 3, proposed: 0 });
  assert.deepEqual(registrar.screen_contracts, ['registrar.readiness.case']);
  assert.equal(registrar.deployment, 'not deployed');
  assert.ok(coverage.every((row) => row.status === 'designed'));

  const decision = validateRelease(registry);
  assert.equal(decision.allowed, false);
  assert.equal(decision.inception.unverifiedJourneys.length, JOURNEY_COUNT);
  assert.equal(decision.inception.unverifiedAdapters.length, registry.inception!.adapters.length);
  assert.ok(decision.issues.some((i) => i.code === 'artifact_without_producer'));
  // Every artifact is absent from release/ here, so each one must be reported missing: a producer string alone is not evidence.
  const missing = decision.issues.filter((i) => i.code === 'artifact_missing').length;
  assert.equal(missing, registry.inception!.evidence_pack.length);
  const everyPresent = new Set(registry.inception!.evidence_pack.map((a) => a.artifact));
  assert.equal(validateRelease(registry, everyPresent).issues.filter((i) => i.code === 'artifact_missing').length, 0);
});

test('the SQL projection derives status from maturity and never writes a status the evidence does not support', () => {
  assert.equal(projectedStatus({ designed: true, schema: true, policies: true, api: false, user_interface: false, e2e_tested: false, staged: false, production_ready: false, tenant_activated: false, monitored: false }), 'draft');
  assert.equal(projectedStatus({ designed: true, schema: true, policies: true, api: true, user_interface: false, e2e_tested: false, staged: false, production_ready: false, tenant_activated: false, monitored: false }), 'implemented');
  assert.equal(projectedStatus({ designed: true, schema: true, policies: true, api: true, user_interface: true, e2e_tested: true, staged: false, production_ready: false, tenant_activated: false, monitored: false }), 'tested');
  assert.equal(projectedStatus({ designed: true, schema: true, policies: true, api: true, user_interface: true, e2e_tested: true, staged: true, production_ready: true, tenant_activated: false, monitored: false }), 'deployed');
  const sql = renderRegistryProjection(registry);
  assert.match(sql, /insert into private\.registry_workspaces .*'registrar'/s);
  assert.match(sql, /'registration\.readiness', w\.id, .*'draft'/);
  assert.doesNotMatch(sql, /'active'\)\s*\n\s*from private\.registry_workspaces w/, 'no capability is projected as active');
  assert.ok(sql.startsWith('-- Generated'));
});
