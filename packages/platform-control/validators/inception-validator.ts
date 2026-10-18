import {
  CONNECTION_TYPES, DECLARABLE_INTEGRATION_HEALTH, INTEGRATION_HEALTH, OPERATIONS_CADENCES, PERMISSION_SCOPES, RECORD_LIFECYCLE_STATES, VIEW_STATES,
  type AdapterRecord, type AuthorityConnectionRecord, type CadenceRecord, type EvidenceArtifactRecord, type InceptionSnapshot, type JourneyRecord,
  type LifecycleRecord, type OperatingSystemRecord, type PermissionRecord, type RegistrySnapshot, type RequiredEventRecord, type ScreenContractRecord,
  type ServiceLevelRecord, type ValidationIssue, type WorkstreamRecord,
} from '../types.ts';
import { PILOT_RELEASE_SCOPES } from './workspace-validator.ts';

/**
 * The inception layer: every operating system the execution specification
 * names, and the chain each one has to resolve before anything in it is
 * "live". These validators hold the chain's shape. They cannot certify that a
 * system operates — a record here is scope and ownership — so, like the
 * workspace validator, they refuse any claim this registry version has no
 * evidence type for.
 */

/** The specification's workspace registry. It says 25 and lists 26; the list is the roster. */
export const INCEPTION_OPERATING_SYSTEMS = [
  'public', 'identity', 'student', 'learning', 'admissions', 'faculty', 'advising', 'registrar', 'finance', 'campus', 'housing_dining',
  'career', 'support', 'family', 'alumni', 'community', 'marketplace', 'institution', 'security', 'operations', 'company', 'customer',
  'developer', 'partner', 'investor', 'ai_governance',
] as const;

export const INCEPTION_GROUPS = [
  'operating_systems', 'authority', 'events', 'permissions', 'journeys', 'screen_contracts', 'adapters', 'cadence', 'service_levels', 'evidence_pack', 'lifecycle', 'workstreams',
] as const;

export const JOURNEY_COUNT = 24;
export const WORKSTREAM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'] as const;

/** The release evidence pack, file by file. A release with any of these missing is not an inception release. */
export const REQUIRED_RELEASE_ARTIFACTS = [
  'release-manifest.json', 'git-commit.txt', 'build-artifacts.json', 'database-migrations.json', 'migration-checksums.json', 'openapi-diff.md',
  'asyncapi-diff.md', 'registry-validation.json', 'all-capability-passports.json', 'test-results/unit.xml', 'test-results/integration.xml',
  'test-results/rls.xml', 'test-results/e2e.xml', 'test-results/accessibility.xml', 'test-results/security.xml', 'test-results/performance.xml',
  'dependency-scan.json', 'container-scan.json', 'secrets-scan.json', 'backup-restore-drill.json', 'rollback-drill.json', 'staging-smoke-test.json',
  'production-smoke-test.json', 'feature-config-snapshot.json', 'integration-health-snapshot.json', 'approvers.json', 'release-notes.md',
] as const;

const MASTER_DOMAIN = /^D(0[1-9]|[1-3][0-9]|40)$/;
const CONTRACT_KEY = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/;
const PERMISSION_SEGMENT = /^[a-z][a-z0-9_]*$/;
const ARTIFACT_PATH = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.(?:json|md|txt|xml)$/;
/** The same shape `packages/platform/src/engines/integration.ts` refuses at `openConnection`: a reference that is really a secret. */
const LOOKS_LIKE_SECRET = /^(sk|pk|ghp|xox[bap])[-_]|-----BEGIN|^[A-Za-z0-9+/]{40,}={0,2}$/;

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated].sort(compareOrdinal);
}

function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  const sorted = [...expected].sort(compareOrdinal);
  return [...actual].sort(compareOrdinal).every((value, index) => value === sorted[index]);
}

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

type Issue = (code: string, path: string, message: string) => void;

function requireGaps(record: { status: string; gaps?: unknown }, path: string, issue: Issue): void {
  if (!strings(record.gaps)) { issue('invalid_record_shape', `${path}.gaps`, 'gaps must be a string array.'); return; }
  if (record.status !== 'verified' && record.gaps.length === 0) issue('unready_without_gap', `${path}.gaps`, 'An unverified record must name its gaps.');
}

function validateOperatingSystems(systems: OperatingSystemRecord[], events: RequiredEventRecord[], issue: Issue): void {
  const keys = systems.map((record) => record.key);
  for (const key of duplicates(keys)) issue('duplicate_key', `operating_systems.${key}`, `${key} is duplicated.`);
  if (!sameMembers(keys, INCEPTION_OPERATING_SYSTEMS)) issue('os_roster_drift', 'operating_systems', `The roster must hold the ${INCEPTION_OPERATING_SYSTEMS.length} inception operating systems exactly once.`);
  const scopeCoverage = new Set<string>();
  const routeOwners = new Map<string, string[]>();
  for (const record of systems) for (const route of strings(record.routes) ? record.routes : []) routeOwners.set(route, [...(routeOwners.get(route) ?? []), record.key]);
  const eventsByOs = new Map<string, Set<string>>();
  for (const event of events) eventsByOs.set(event.os, new Set([...(eventsByOs.get(event.os) ?? []), event.event]));

  for (const record of [...systems].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `operating_systems.${record.key}`;
    if (!text(record.os_family)) issue('missing_os_family', `${path}.os_family`, 'os_family is required.');
    if (record.status === 'implemented' || record.status === 'verified') {
      issue('unsupported_os_claim', `${path}.status`, 'This registry version cannot certify an implemented or verified operating system.');
    }
    if (!strings(record.routes) || record.routes.length === 0) issue('missing_routes', `${path}.routes`, 'At least one route is required.');
    else {
      for (const route of duplicates(record.routes)) issue('duplicate_route', `${path}.routes`, `Route ${route} is listed twice.`);
      for (const route of record.routes) {
        if (!route.startsWith('/')) issue('invalid_route', `${path}.routes`, `Route ${route} must begin with /.`);
        const others = (routeOwners.get(route) ?? []).filter((owner) => owner !== record.key);
        const declared = object(record.shared_routes) && strings(record.shared_routes[route]) ? record.shared_routes[route] : [];
        for (const other of others) if (!declared.includes(other)) issue('unshared_route_collision', `${path}.routes`, `Route ${route} is also owned by ${other} and shared_routes does not say so.`);
      }
    }
    if (object(record.shared_routes)) for (const [route, owners] of Object.entries(record.shared_routes)) {
      if (!strings(record.routes) || !record.routes.includes(route)) issue('shared_route_not_owned', `${path}.shared_routes.${route}`, `${route} is shared but not among this system's routes.`);
      for (const owner of strings(owners) ? owners : []) if (!keys.includes(owner) || !(routeOwners.get(route) ?? []).includes(owner)) issue('shared_route_phantom', `${path}.shared_routes.${route}`, `${owner} does not own ${route}.`);
    }
    if (!strings(record.pilot_scopes) || record.pilot_scopes.length === 0) issue('missing_pilot_scope', `${path}.pilot_scopes`, 'Every operating system is delivered through at least one pilot release scope.');
    else for (const scope of record.pilot_scopes) {
      if (!(PILOT_RELEASE_SCOPES as readonly string[]).includes(scope)) issue('unknown_pilot_scope', `${path}.pilot_scopes`, `Unknown pilot release scope ${scope}.`);
      scopeCoverage.add(scope);
    }
    if (!strings(record.master_domains)) issue('invalid_record_shape', `${path}.master_domains`, 'master_domains must be a string array.');
    else {
      for (const domain of record.master_domains) if (!MASTER_DOMAIN.test(domain)) issue('unknown_master_domain', `${path}.master_domains`, `${domain} is not a master-catalog domain (D01–D40).`);
      if (record.master_domains.length === 0 && !(strings(record.gaps) && record.gaps.some((gap) => /master-catalog domain/i.test(gap)))) {
        issue('undocumented_domain_gap', `${path}.master_domains`, 'A system outside the master catalog must say so in its gaps.');
      }
    }
    if (!strings(record.minimum_events)) issue('invalid_record_shape', `${path}.minimum_events`, 'minimum_events must be a string array.');
    else for (const event of record.minimum_events) {
      if (!eventsByOs.get(record.key)?.has(event)) issue('missing_required_event_record', `${path}.minimum_events`, `${event} has no record in the events registry for ${record.key}.`);
    }
    if (!strings(record.screens_in_repo)) issue('invalid_record_shape', `${path}.screens_in_repo`, 'screens_in_repo must be a string array.');
    requireGaps(record, path, issue);
  }
  for (const scope of PILOT_RELEASE_SCOPES) if (!scopeCoverage.has(scope)) issue('uncovered_pilot_scope', `operating_systems.${scope}`, `No operating system is delivered through ${scope}.`);
}

function validateEvents(events: RequiredEventRecord[], systems: OperatingSystemRecord[], catalog: ReadonlySet<string>, issue: Issue): void {
  const osKeys = new Set(systems.map((record) => record.key));
  const minimum = new Map(systems.map((record) => [record.key, new Set(strings(record.minimum_events) ? record.minimum_events : [])]));
  for (const key of duplicates(events.map((event) => event.key))) issue('duplicate_key', `events.${key}`, `${key} is duplicated.`);
  for (const event of [...events].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `events.${event.key}`;
    if (!osKeys.has(event.os)) issue('unknown_os', `${path}.os`, `Unknown operating system ${event.os}.`);
    else if (!minimum.get(event.os)?.has(event.event)) issue('orphan_required_event', `${path}.event`, `${event.event} is not a minimum event of ${event.os}.`);
    if (event.key !== `event.${event.os}.${event.event.replace(/\./g, '_')}`) issue('invalid_key', path, 'Event record key must be event.<os>.<event with dots as underscores>.');
    if (event.catalog_event === null) {
      if (event.status !== 'designed' && event.status !== 'blocked') issue('event_claim_without_catalog', `${path}.status`, 'An event with no catalog type cannot be implemented or verified.');
    } else if (!catalog.has(event.catalog_event)) {
      issue('unknown_catalog_event', `${path}.catalog_event`, `${event.catalog_event} is not in EVENT_TYPES (packages/institution/src/events.ts).`);
    } else if (event.status === 'designed') {
      issue('catalog_event_understated', `${path}.status`, 'An event carried by a catalog type is at least implemented.');
    }
  }
}

function validateAuthority(records: AuthorityConnectionRecord[], issue: Issue): void {
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `authority.${key}`, `${key} is duplicated.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `authority.${record.key}`;
    if (!(CONNECTION_TYPES as readonly string[]).includes(record.connection_type)) issue('unknown_connection_type', `${path}.connection_type`, `Unknown connection type ${record.connection_type}.`);
    for (const field of ['record', 'primary_authority', 'semester_action', 'lifecycle_owner'] as const) {
      if (!text(record[field])) issue('missing_authority_field', `${path}.${field}`, `${field} is required.`);
    }
    if (typeof record.reconciliation_required !== 'boolean') issue('invalid_record_shape', `${path}.reconciliation_required`, 'reconciliation_required must be a boolean.');
    if ((record.connection_type === 'reference' || record.connection_type === 'derived') && record.reconciliation_required !== true) {
      issue('reference_without_reconciliation', `${path}.reconciliation_required`, 'A reference or derived connection carries freshness and must reconcile.');
    }
    if (record.connection_type === 'delegated') {
      const d = record.delegation;
      if (!object(d) || !(['scope', 'purpose', 'expiry', 'revocation'] as const).every((field) => d[field] === true)) {
        issue('incomplete_delegation', `${path}.delegation`, 'Every delegation has scope, purpose, expiry and revocation.');
      }
    } else if (record.delegation !== undefined) {
      issue('delegation_on_non_delegated', `${path}.delegation`, 'Only a delegated connection carries delegation properties.');
    }
  }
}

function validatePermissions(records: PermissionRecord[], systems: OperatingSystemRecord[], roles: ReadonlySet<string>, issue: Issue): void {
  const osKeys = new Set(systems.map((record) => record.key));
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `permissions.${key}`, `${key} is duplicated.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `permissions.${record.key}`;
    if (record.permission !== record.key) issue('permission_key_mismatch', path, 'A permission record is keyed by its permission.');
    const segments = typeof record.permission === 'string' ? record.permission.split('.') : [];
    if (segments.length < 3 || !segments.every((segment) => PERMISSION_SEGMENT.test(segment))) {
      issue('invalid_permission_grammar', `${path}.permission`, 'Permissions are resource.action.scope: at least three lower-case segments.');
    } else if (!(PERMISSION_SCOPES as readonly string[]).includes(segments[segments.length - 1])) {
      issue('unknown_permission_scope', `${path}.permission`, `Scope ${segments[segments.length - 1]} is not a declared permission scope.`);
    }
    if (!osKeys.has(record.os)) issue('unknown_os', `${path}.os`, `Unknown operating system ${record.os}.`);
    if (!strings(record.roles) || record.roles.length === 0) issue('missing_permission_roles', `${path}.roles`, 'A permission names the roles that may hold it.');
    else for (const role of record.roles) if (!roles.has(role)) issue('unknown_role', `${path}.roles`, `Unknown role ${role}.`);
  }
}

function validateJourneys(records: JourneyRecord[], systems: OperatingSystemRecord[], issue: Issue): void {
  const osKeys = new Set(systems.map((record) => record.key));
  const numbers = records.map((record) => record.number);
  const expected = Array.from({ length: JOURNEY_COUNT }, (_, index) => index + 1);
  if (!sameMembers(numbers.map(String), expected.map(String))) issue('journey_roster_drift', 'journeys', `The ${JOURNEY_COUNT} required end-to-end journeys must each appear exactly once.`);
  for (const record of [...records].sort((left, right) => left.number - right.number)) {
    const path = `journeys.${record.key}`;
    if (record.key !== `journey.${String(record.number).padStart(2, '0')}`) issue('invalid_key', path, 'Journey keys are journey.NN.');
    if (!strings(record.crosses) || record.crosses.length === 0) issue('missing_journey_systems', `${path}.crosses`, 'A journey crosses at least one operating system.');
    else for (const os of record.crosses) if (!osKeys.has(os)) issue('unknown_os', `${path}.crosses`, `Unknown operating system ${os}.`);
    if (!strings(record.tests)) issue('invalid_record_shape', `${path}.tests`, 'tests must be a string array.');
    else if (record.status === 'verified' && record.tests.length === 0) issue('verified_without_tests', `${path}.tests`, 'A verified journey names the test that runs it end to end.');
    requireGaps(record, path, issue);
  }
}

function validateScreenContracts(records: ScreenContractRecord[], systems: OperatingSystemRecord[], roles: ReadonlySet<string>, capabilities: ReadonlySet<string>, catalog: ReadonlySet<string>, issue: Issue): void {
  const byOs = new Map(systems.map((record) => [record.key, record]));
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `screen_contracts.${key}`, `${key} is duplicated.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `screen_contracts.${record.key}`;
    const workspace = byOs.get(record.workspace);
    if (!workspace) issue('unknown_os', `${path}.workspace`, `Unknown operating system ${record.workspace}.`);
    else if (!text(record.route) || !(strings(workspace.routes) && workspace.routes.some((route) => record.route === route || record.route.startsWith(`${route}/`)))) {
      issue('route_outside_workspace', `${path}.route`, `${record.route} is not under a route of ${record.workspace}.`);
    }
    if (!text(record.title)) issue('missing_title', `${path}.title`, 'title is required.');
    for (const [field, known, code, noun] of [['roles', roles, 'unknown_role', 'role'], ['capabilities', capabilities, 'unknown_capability', 'capability']] as const) {
      const values = record[field];
      if (!strings(values) || values.length === 0) issue(`missing_${field}`, `${path}.${field}`, `${field} is required.`);
      else for (const value of values) if (!known.has(value)) issue(code, `${path}.${field}`, `Unknown ${noun} ${value}.`);
    }
    if (!strings(record.records) || record.records.length === 0) issue('missing_records', `${path}.records`, 'A screen names the records it shows.');
    for (const field of ['commands', 'events', 'audit_events'] as const) {
      const values = record[field];
      if (!strings(values) || values.length === 0) issue(`missing_${field}`, `${path}.${field}`, `${field} is required.`);
      else for (const value of values) if (!CONTRACT_KEY.test(value)) issue('invalid_contract_key', `${path}.${field}`, `${value} is not a namespaced contract key.`);
    }
    if (strings(record.events)) for (const event of record.events) if (!catalog.has(event)) issue('unknown_catalog_event', `${path}.events`, `${event} is not in EVENT_TYPES.`);
    if (!strings(record.states) || !sameMembers(record.states, VIEW_STATES)) issue('incomplete_view_states', `${path}.states`, `Every screen exposes exactly the seven view states: ${VIEW_STATES.join(', ')}.`);
    if (!object(record.authority) || !text(record.authority.primary) || !text(record.authority.semester_role) || typeof record.authority.reconciliation_required !== 'boolean') {
      issue('incomplete_authority', `${path}.authority`, 'authority needs primary, semester_role and reconciliation_required.');
    } else if (!/^semester/.test(record.authority.primary) && record.authority.reconciliation_required !== true) {
      issue('external_authority_without_reconciliation', `${path}.authority`, 'A screen whose primary authority is external must reconcile.');
    }
    if (!object(record.ai) || typeof record.ai.enabled !== 'boolean' || !text(record.ai.rule)) issue('incomplete_ai_rule', `${path}.ai`, 'ai needs enabled and a rule, even when disabled.');
    if (!text(record.operational_owner)) issue('missing_operational_owner', `${path}.operational_owner`, 'operational_owner is required.');
    if (!text(record.runbook)) issue('missing_runbook', `${path}.runbook`, 'runbook is required.');
  }
}

function validateAdapters(records: AdapterRecord[], systems: OperatingSystemRecord[], integrations: ReadonlySet<string>, issue: Issue): void {
  const osKeys = new Set(systems.map((record) => record.key));
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `adapters.${key}`, `${key} is duplicated.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `adapters.${record.key}`;
    if (!text(record.adapter)) issue('missing_adapter_name', `${path}.adapter`, 'adapter is required.');
    if (!(INTEGRATION_HEALTH as readonly string[]).includes(record.health)) issue('unknown_integration_health', `${path}.health`, `Unknown health ${record.health}.`);
    else if (!DECLARABLE_INTEGRATION_HEALTH.includes(record.health)) issue('unsupported_runtime_health_claim', `${path}.health`, `${record.health} is observed at runtime and cannot be declared in a registry file.`);
    if ((record.status === 'blocked') !== (record.health === 'blocked')) issue('adapter_status_health_mismatch', `${path}.health`, 'A blocked adapter is blocked in both status and health.');
    if (record.integration !== null && !integrations.has(record.integration)) issue('unknown_integration', `${path}.integration`, `Unknown integration ${record.integration}.`);
    if (!strings(record.domains) || record.domains.length === 0) issue('missing_adapter_domains', `${path}.domains`, 'An adapter names the operating systems that use it.');
    else for (const os of record.domains) if (!osKeys.has(os)) issue('unknown_os', `${path}.domains`, `Unknown operating system ${os}.`);
    if (!strings(record.required_behavior) || record.required_behavior.length === 0) issue('missing_required_behavior', `${path}.required_behavior`, 'required_behavior is required.');
    if (!text(record.credential_reference)) issue('missing_credential_reference', `${path}.credential_reference`, 'credential_reference is required.');
    else if (LOOKS_LIKE_SECRET.test(record.credential_reference)) issue('credential_in_registry', `${path}.credential_reference`, 'credential_reference must be a reference into the secret store, not a secret.');
    if (typeof record.sandbox_verified !== 'boolean') issue('sandbox_verified_not_boolean', `${path}.sandbox_verified`, 'sandbox_verified is true or false.');
    if (record.sandbox_verified === true && record.status !== 'verified') issue('sandbox_claim_without_verification', `${path}.sandbox_verified`, 'A sandbox-verified adapter is a verified adapter.');
  }
}

function validateCadence(records: CadenceRecord[], issue: Issue): void {
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `cadence.${key}`, `${key} is duplicated.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `cadence.${record.key}`;
    if (!(OPERATIONS_CADENCES as readonly string[]).includes(record.cadence)) issue('unknown_cadence', `${path}.cadence`, `Unknown cadence ${record.cadence}.`);
    if (!text(record.activity) || !text(record.accountable_owner)) issue('incomplete_cadence', path, 'A cadence entry names its activity and accountable owner.');
  }
}

function validateServiceLevels(records: ServiceLevelRecord[], issue: Issue): void {
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `service_levels.${key}`, `${key} is duplicated.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `service_levels.${record.key}`;
    for (const field of ['work_type', 'first_response', 'target_resolution', 'escalation'] as const) {
      if (!text(record[field])) issue('incomplete_service_level', `${path}.${field}`, `${field} is required.`);
    }
  }
}

function validateEvidencePack(records: EvidenceArtifactRecord[], issue: Issue): void {
  const artifacts = records.map((record) => record.artifact);
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `evidence_pack.${key}`, `${key} is duplicated.`);
  for (const artifact of duplicates(artifacts)) issue('duplicate_artifact', `evidence_pack.${artifact}`, `${artifact} is listed twice.`);
  if (!sameMembers(artifacts, REQUIRED_RELEASE_ARTIFACTS)) issue('evidence_pack_drift', 'evidence_pack', `The release evidence pack holds the ${REQUIRED_RELEASE_ARTIFACTS.length} required artifacts exactly once.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `evidence_pack.${record.key}`;
    if (!ARTIFACT_PATH.test(record.artifact)) issue('invalid_artifact_path', `${path}.artifact`, `${record.artifact} is not a pack-relative file path.`);
    if (record.producer !== null && !text(record.producer)) issue('invalid_record_shape', `${path}.producer`, 'producer is a command or null.');
    if (record.status === 'verified' && record.producer === null) issue('verified_without_producer', `${path}.producer`, 'A verified artifact names what produces it.');
  }
}

function validateLifecycle(records: LifecycleRecord[], issue: Issue): void {
  if (records.length !== 1) { issue('invalid_lifecycle_count', 'lifecycle', 'Exactly one shared record lifecycle is required.'); return; }
  const record = records[0];
  const path = `lifecycle.${record.key}`;
  if (!strings(record.states) || !sameMembers(record.states, RECORD_LIFECYCLE_STATES)) issue('lifecycle_state_drift', `${path}.states`, `The lifecycle holds exactly: ${RECORD_LIFECYCLE_STATES.join(' → ')}.`);
  const states = new Set(strings(record.states) ? record.states : []);
  const transitions = object(record.transitions) ? record.transitions : {};
  for (const state of [...states].sort(compareOrdinal)) {
    if (!Object.prototype.hasOwnProperty.call(transitions, state)) issue('missing_transition_source', `${path}.transitions.${state}`, `State ${state} has no transition entry.`);
  }
  for (const [from, targets] of Object.entries(transitions).sort(([left], [right]) => compareOrdinal(left, right))) {
    if (!states.has(from)) issue('unknown_transition_source', `${path}.transitions.${from}`, `Unknown source state ${from}.`);
    for (const target of strings(targets) ? targets : []) if (!states.has(target)) issue('unknown_transition_target', `${path}.transitions.${from}`, `Unknown target state ${target}.`);
    if (from === 'retained_or_deleted' && strings(targets) && targets.length > 0) issue('terminal_has_exit', `${path}.transitions.${from}`, 'retained_or_deleted is terminal.');
  }
  const reachable = new Set<string>();
  const queue = states.has('created') ? ['created'] : [];
  while (queue.length > 0) {
    const state = queue.shift()!;
    if (reachable.has(state)) continue;
    reachable.add(state);
    for (const target of strings(transitions[state]) ? transitions[state] : []) if (states.has(target)) queue.push(target);
  }
  for (const state of [...states].sort(compareOrdinal)) if (!reachable.has(state)) issue('unreachable_state', `${path}.states.${state}`, `State ${state} is unreachable from created.`);
  if (!Array.isArray(record.examples) || record.examples.length === 0) issue('missing_lifecycle_examples', `${path}.examples`, 'The lifecycle names the records it governs.');
  else for (const [index, example] of record.examples.entries()) {
    if (!object(example) || !text(example.record) || !text(example.authority) || !text(example.lifecycle_owner)) issue('incomplete_lifecycle_example', `${path}.examples.${index}`, 'Each example names record, authority and lifecycle_owner.');
  }
}

function validateWorkstreams(records: WorkstreamRecord[], issue: Issue): void {
  for (const key of duplicates(records.map((record) => record.key))) issue('duplicate_key', `workstreams.${key}`, `${key} is duplicated.`);
  if (!sameMembers(records.map((record) => record.letter), WORKSTREAM_LETTERS)) issue('workstream_roster_drift', 'workstreams', `Workstreams ${WORKSTREAM_LETTERS[0]}–${WORKSTREAM_LETTERS[WORKSTREAM_LETTERS.length - 1]} must each appear exactly once.`);
  for (const record of [...records].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `workstreams.${record.key}`;
    if (record.key !== `workstream.${String(record.letter).toLowerCase()}`) issue('invalid_key', path, 'Workstream keys are workstream.<letter>.');
    if (!strings(record.deliverables) || record.deliverables.length === 0) issue('missing_deliverables', `${path}.deliverables`, 'A workstream names its deliverables.');
    if (!strings(record.registry_groups) || record.registry_groups.length === 0) issue('missing_registry_groups', `${path}.registry_groups`, 'A workstream names the registry groups it converges.');
    else for (const group of record.registry_groups) if (!(INCEPTION_GROUPS as readonly string[]).includes(group)) issue('unknown_registry_group', `${path}.registry_groups`, `Unknown inception group ${group}.`);
    requireGaps(record, path, issue);
  }
}

export function validateInception(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const issue: Issue = (code, path, message) => { issues.push({ code, path, message }); };
  const inception = snapshot.inception;
  if (!inception) return [{ code: 'missing_inception_registry', path: 'inception', message: 'Full registry validation requires every inception group.' }];
  for (const group of INCEPTION_GROUPS) {
    if (!Array.isArray((inception as unknown as Record<string, unknown>)[group])) issue('missing_inception_group', `inception.${group}`, `Inception group ${group} is missing.`);
  }
  if (issues.length) return issues;
  const catalog = new Set(inception.event_catalog);
  if (catalog.size === 0) issue('missing_event_catalog', 'inception.event_catalog', 'EVENT_TYPES could not be read; nothing here can claim a catalog event.');
  const roles = new Set(snapshot.roles.map((record) => record.key));
  const capabilities = new Set(snapshot.capabilities.map((record) => record.key));
  const integrations = new Set(snapshot.integrations.map((record) => record.key));
  const owners: Array<[string, Array<{ key: string; owner: string; evidence: string[] }>]> = INCEPTION_GROUPS.map((group) => [group, inception[group]]);
  for (const [group, records] of owners) for (const record of records) {
    if (!text(record.owner)) issue('missing_owner', `${group}.${record.key}`, 'Registry record requires an owner.');
    if (!strings(record.evidence) || record.evidence.length === 0) issue('missing_evidence', `${group}.${record.key}`, 'Registry record requires at least one evidence path.');
  }
  validateOperatingSystems(inception.operating_systems, inception.events, issue);
  validateEvents(inception.events, inception.operating_systems, catalog, issue);
  validateAuthority(inception.authority, issue);
  validatePermissions(inception.permissions, inception.operating_systems, roles, issue);
  validateJourneys(inception.journeys, inception.operating_systems, issue);
  validateScreenContracts(inception.screen_contracts, inception.operating_systems, roles, capabilities, catalog, issue);
  validateAdapters(inception.adapters, inception.operating_systems, integrations, issue);
  validateCadence(inception.cadence, issue);
  validateServiceLevels(inception.service_levels, issue);
  validateEvidencePack(inception.evidence_pack, issue);
  validateLifecycle(inception.lifecycle, issue);
  validateWorkstreams(inception.workstreams, issue);
  return issues;
}

/** Every repository path an inception record cites, for the evidence sweep. */
export function inceptionEvidencePaths(inception: InceptionSnapshot | undefined): string[] {
  if (!inception) return [];
  const paths = new Set<string>();
  for (const group of INCEPTION_GROUPS) for (const record of inception[group]) for (const path of strings(record.evidence) ? record.evidence : []) paths.add(path);
  for (const system of inception.operating_systems) for (const path of strings(system.screens_in_repo) ? system.screens_in_repo : []) paths.add(path);
  for (const journey of inception.journeys) for (const path of strings(journey.tests) ? journey.tests : []) paths.add(path);
  for (const contract of inception.screen_contracts) if (text(contract.runbook)) paths.add(contract.runbook);
  return [...paths].sort(compareOrdinal);
}

/** The coverage matrix the specification asks for, one row per operating system, derived rather than written. */
export function inceptionCoverage(snapshot: RegistrySnapshot) {
  const inception = snapshot.inception;
  if (!inception) return [];
  const capabilitiesByWorkspace = new Map<string, string[]>();
  for (const capability of snapshot.capabilities) capabilitiesByWorkspace.set(capability.workspace, [...(capabilitiesByWorkspace.get(capability.workspace) ?? []), capability.key]);
  return [...inception.operating_systems].sort((left, right) => compareOrdinal(left.key, right.key)).map((system) => {
    const events = inception.events.filter((event) => event.os === system.key);
    const journeys = inception.journeys.filter((journey) => journey.crosses.includes(system.key));
    const contracts = inception.screen_contracts.filter((contract) => contract.workspace === system.key);
    const adapters = inception.adapters.filter((adapter) => adapter.domains.includes(system.key));
    const permissions = inception.permissions.filter((permission) => permission.os === system.key);
    const implementedEvents = events.filter((event) => event.catalog_event !== null).length;
    return {
      identifier: system.key,
      system: system.os_family,
      workspaces: system.pilot_scopes,
      master_domains: system.master_domains,
      routes: system.routes,
      roles: [...new Set(permissions.flatMap((permission) => permission.roles))].sort(compareOrdinal),
      screens_in_repo: system.screens_in_repo,
      screen_contracts: contracts.map((contract) => contract.key),
      capabilities: capabilitiesByWorkspace.get(system.key) ?? [],
      permissions: permissions.map((permission) => permission.permission),
      events: { required: events.length, carried_by_catalog: implementedEvents, proposed: events.length - implementedEvents },
      journeys: journeys.map((journey) => ({ key: journey.key, status: journey.status })),
      adapters: adapters.map((adapter) => ({ key: adapter.key, health: adapter.health })),
      status: system.status,
      evidence: system.evidence,
      deployment: 'not deployed',
      blockers: system.gaps,
    };
  });
}
