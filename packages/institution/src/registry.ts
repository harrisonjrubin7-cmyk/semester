/**
 * The component registry's definition shape, and the checks no JSON Schema
 * can make.
 *
 * A component here is a unit with an owner: it says what it owns, what it
 * offers and consumes, what it depends on, what happens when it fails, and
 * which records it is authoritative for. `validateComponentDefinition` checks
 * one definition's shape — the same constraints as the proposed
 * `component.schema.json` (`docs/control-plane/component.schema.json`),
 * written out by hand because this repository has no JSON Schema validator and
 * a dependency is not worth one file. `registry.test.ts` holds the two to each
 * other, so the schema cannot drift from the code that enforces it.
 *
 * `checkRegistry` makes the checks a schema cannot: that a dependency names a
 * component that exists, that a contract is provided by exactly one component,
 * and that no two authority assignments claim the same record scope over the
 * same time.
 *
 * ## What it is not
 *
 * Not a catalogue. No component is registered here: a definition's repository
 * reference and revision must come from verified implementation evidence, and
 * writing forty from the domain catalogue would be inventing them. Not a
 * permission system either — the registry describes responsibility and grants
 * no runtime access, so nothing in `policy.ts` reads it.
 */

export const COMPONENT_LIFECYCLES = ['proposed', 'development', 'active', 'deprecated', 'retired'] as const;
export const CONTRACT_KINDS = ['command', 'event', 'query'] as const;
export const CONTRACT_DIRECTIONS = ['provides', 'consumes'] as const;
export const DEPENDENCY_KINDS = ['authorization', 'validation', 'synchronous', 'asynchronous'] as const;
export const DEPENDENCY_FAILURE_BEHAVIORS = ['block', 'degrade', 'retry', 'reconcile'] as const;
export const AUTHORITY_MODES = ['planning_only', 'read_replica', 'transitional', 'authoritative'] as const;
export const RECOVERY_FAILURE_BEHAVIORS = ['deny_protected_action', 'degrade_noncritical_feature', 'queue_and_reconcile'] as const;

/** `registration.engine`, `academic.registration`: two or more dot-separated lower-snake segments. */
export const COMPONENT_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export interface ComponentContract {
  key: string;
  version: string;
  kind: (typeof CONTRACT_KINDS)[number];
  direction: (typeof CONTRACT_DIRECTIONS)[number];
  schemaRef: string;
}

export interface ComponentDependency {
  componentId: string;
  kind: (typeof DEPENDENCY_KINDS)[number];
  failureBehavior: (typeof DEPENDENCY_FAILURE_BEHAVIORS)[number];
}

export interface AuthorityAssignment {
  tenantId: string;
  recordType: string;
  scopeKey: string;
  mode: (typeof AUTHORITY_MODES)[number];
  effectiveFrom: string;
  effectiveUntil?: string;
  approvalRef?: string;
}

export interface ComponentDefinition {
  componentId: string;
  version: string;
  domain: string;
  owner: { teamId: string; supportQueueId: string };
  lifecycle: (typeof COMPONENT_LIFECYCLES)[number];
  implementation: { repositoryRef: string; revision: string };
  contracts: ComponentContract[];
  dependencies: ComponentDependency[];
  authority: AuthorityAssignment[];
  controls: string[];
  recovery: { runbookRef: string; failureBehavior: (typeof RECOVERY_FAILURE_BEHAVIORS)[number] };
  evidenceRefs?: string[];
}

export type DefinitionVerdict = { ok: true; definition: ComponentDefinition } | { ok: false; errors: string[] };

const TOP_LEVEL_REQUIRED = [
  'componentId', 'version', 'domain', 'owner', 'lifecycle', 'implementation',
  'contracts', 'dependencies', 'authority', 'controls', 'recovery',
] as const;
const TOP_LEVEL_ALLOWED: readonly string[] = [...TOP_LEVEL_REQUIRED, 'evidenceRefs'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length >= 1;
const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

function checkObject(path: string, value: unknown, required: readonly string[], allowed: readonly string[], errors: string[]): value is Record<string, unknown> {
  if (!isObject(value)) {
    errors.push(`${path}: must be an object`);
    return false;
  }
  for (const key of required) if (!(key in value)) errors.push(`${path}.${key}: required`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key}: not allowed`);
  return true;
}

function checkText(path: string, value: unknown, errors: string[]): void {
  if (!isText(value)) errors.push(`${path}: must be a non-empty string`);
}

function checkEnum(path: string, list: readonly string[], value: unknown, errors: string[]): void {
  if (!isOneOf(list, value)) errors.push(`${path}: must be one of ${list.join(', ')}`);
}

function checkList(path: string, value: unknown, errors: string[], each: (item: unknown, itemPath: string) => void): void {
  if (!Array.isArray(value)) {
    errors.push(`${path}: must be an array`);
    return;
  }
  value.forEach((item, i) => each(item, `${path}[${i}]`));
}

function checkInstant(path: string, value: unknown, errors: string[]): void {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    errors.push(`${path}: must be an ISO date-time`);
  }
}

/**
 * Check one definition's shape, collecting every error rather than stopping
 * at the first — a definition is edited by a person who wants the whole list.
 * Unknown keys are errors, as `additionalProperties: false` makes them.
 */
export function validateComponentDefinition(input: unknown): DefinitionVerdict {
  const errors: string[] = [];
  if (!checkObject('$', input, TOP_LEVEL_REQUIRED, TOP_LEVEL_ALLOWED, errors)) return { ok: false, errors };
  const d = input;

  if (!isText(d.componentId) || !COMPONENT_ID_PATTERN.test(d.componentId)) errors.push(`$.componentId: must match ${COMPONENT_ID_PATTERN.source}`);
  if ('version' in d) checkText('$.version', d.version, errors);
  if ('domain' in d) checkText('$.domain', d.domain, errors);
  if ('lifecycle' in d) checkEnum('$.lifecycle', COMPONENT_LIFECYCLES, d.lifecycle, errors);

  if ('owner' in d && checkObject('$.owner', d.owner, ['teamId', 'supportQueueId'], ['teamId', 'supportQueueId'], errors)) {
    checkText('$.owner.teamId', d.owner.teamId, errors);
    checkText('$.owner.supportQueueId', d.owner.supportQueueId, errors);
  }
  if ('implementation' in d && checkObject('$.implementation', d.implementation, ['repositoryRef', 'revision'], ['repositoryRef', 'revision'], errors)) {
    checkText('$.implementation.repositoryRef', d.implementation.repositoryRef, errors);
    checkText('$.implementation.revision', d.implementation.revision, errors);
  }
  if ('recovery' in d && checkObject('$.recovery', d.recovery, ['runbookRef', 'failureBehavior'], ['runbookRef', 'failureBehavior'], errors)) {
    checkText('$.recovery.runbookRef', d.recovery.runbookRef, errors);
    checkEnum('$.recovery.failureBehavior', RECOVERY_FAILURE_BEHAVIORS, d.recovery.failureBehavior, errors);
  }

  if ('contracts' in d) {
    checkList('$.contracts', d.contracts, errors, (c, p) => {
      if (!checkObject(p, c, ['key', 'version', 'kind', 'direction', 'schemaRef'], ['key', 'version', 'kind', 'direction', 'schemaRef'], errors)) return;
      checkText(`${p}.key`, c.key, errors);
      checkText(`${p}.version`, c.version, errors);
      checkEnum(`${p}.kind`, CONTRACT_KINDS, c.kind, errors);
      checkEnum(`${p}.direction`, CONTRACT_DIRECTIONS, c.direction, errors);
      checkText(`${p}.schemaRef`, c.schemaRef, errors);
    });
  }
  if ('dependencies' in d) {
    checkList('$.dependencies', d.dependencies, errors, (dep, p) => {
      if (!checkObject(p, dep, ['componentId', 'kind', 'failureBehavior'], ['componentId', 'kind', 'failureBehavior'], errors)) return;
      checkText(`${p}.componentId`, dep.componentId, errors);
      checkEnum(`${p}.kind`, DEPENDENCY_KINDS, dep.kind, errors);
      checkEnum(`${p}.failureBehavior`, DEPENDENCY_FAILURE_BEHAVIORS, dep.failureBehavior, errors);
    });
  }
  if ('authority' in d) {
    const keys = ['tenantId', 'recordType', 'scopeKey', 'mode', 'effectiveFrom', 'effectiveUntil', 'approvalRef'];
    checkList('$.authority', d.authority, errors, (a, p) => {
      if (!checkObject(p, a, ['tenantId', 'recordType', 'scopeKey', 'mode', 'effectiveFrom'], keys, errors)) return;
      checkText(`${p}.tenantId`, a.tenantId, errors);
      checkText(`${p}.recordType`, a.recordType, errors);
      checkText(`${p}.scopeKey`, a.scopeKey, errors);
      checkEnum(`${p}.mode`, AUTHORITY_MODES, a.mode, errors);
      checkInstant(`${p}.effectiveFrom`, a.effectiveFrom, errors);
      if ('effectiveUntil' in a) checkInstant(`${p}.effectiveUntil`, a.effectiveUntil, errors);
      if ('approvalRef' in a) checkText(`${p}.approvalRef`, a.approvalRef, errors);
      // Authority is a claim; the approval that makes it one must be named.
      if (a.mode === 'authoritative' && !('approvalRef' in a)) errors.push(`${p}.approvalRef: required when mode is authoritative`);
      // A window that closes before it opens is a typo that would otherwise
      // read as "never effective" and quietly drop the assignment.
      if (typeof a.effectiveFrom === 'string' && typeof a.effectiveUntil === 'string' && Date.parse(a.effectiveUntil) <= Date.parse(a.effectiveFrom)) {
        errors.push(`${p}.effectiveUntil: must be after effectiveFrom`);
      }
    });
  }
  if ('controls' in d) {
    checkList('$.controls', d.controls, errors, (c, p) => checkText(p, c, errors));
    if (Array.isArray(d.controls) && new Set(d.controls).size !== d.controls.length) errors.push('$.controls: items must be unique');
  }
  if ('evidenceRefs' in d) {
    checkList('$.evidenceRefs', d.evidenceRefs, errors, (c, p) => checkText(p, c, errors));
    if (Array.isArray(d.evidenceRefs) && new Set(d.evidenceRefs).size !== d.evidenceRefs.length) errors.push('$.evidenceRefs: items must be unique');
  }

  return errors.length === 0 ? { ok: true, definition: d as unknown as ComponentDefinition } : { ok: false, errors };
}

export interface RegistryProblem {
  code: 'UNKNOWN_DEPENDENCY' | 'DUPLICATE_COMPONENT' | 'CONTRACT_HAS_NO_PROVIDER' | 'CONTRACT_HAS_TWO_PROVIDERS' | 'AUTHORITY_OVERLAP' | 'SELF_DEPENDENCY';
  componentId: string;
  detail: string;
}

const FOREVER = Number.POSITIVE_INFINITY;
const windowOf = (a: AuthorityAssignment): [number, number] => [Date.parse(a.effectiveFrom), a.effectiveUntil === undefined ? FOREVER : Date.parse(a.effectiveUntil)];

/**
 * Two assignments for the same tenant, record type and scope that overlap in
 * time conflict when both can write and one is authoritative: two systems may
 * both *read* a record, but only one may be the official one at an instant.
 * Planning-only and read-replica assignments sit beside anything; two
 * transitional ones coexist, because a migration window is exactly that.
 */
export function authorityOverlaps(
  assignments: readonly { componentId: string; assignment: AuthorityAssignment }[],
): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  for (let i = 0; i < assignments.length; i += 1) {
    for (let j = i + 1; j < assignments.length; j += 1) {
      const a = assignments[i]!;
      const b = assignments[j]!;
      const same = a.assignment.tenantId === b.assignment.tenantId && a.assignment.recordType === b.assignment.recordType && a.assignment.scopeKey === b.assignment.scopeKey;
      if (!same) continue;
      const writes = (m: AuthorityAssignment['mode']) => m === 'authoritative' || m === 'transitional';
      if (!writes(a.assignment.mode) || !writes(b.assignment.mode)) continue;
      if (a.assignment.mode !== 'authoritative' && b.assignment.mode !== 'authoritative') continue;
      const [aFrom, aUntil] = windowOf(a.assignment);
      const [bFrom, bUntil] = windowOf(b.assignment);
      if (aFrom < bUntil && bFrom < aUntil) {
        problems.push({
          code: 'AUTHORITY_OVERLAP',
          componentId: a.componentId,
          detail: `${a.componentId} and ${b.componentId} both claim ${a.assignment.recordType}/${a.assignment.scopeKey} for tenant ${a.assignment.tenantId} over the same time`,
        });
      }
    }
  }
  return problems;
}

/**
 * The checks across definitions: a dependency names a registered component,
 * a component is registered once, each contract version has one provider and
 * every consumed contract has one, and authority does not overlap.
 */
export function checkRegistry(definitions: readonly ComponentDefinition[]): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const ids = new Set<string>();
  for (const d of definitions) {
    if (ids.has(d.componentId)) problems.push({ code: 'DUPLICATE_COMPONENT', componentId: d.componentId, detail: `${d.componentId} is registered twice` });
    ids.add(d.componentId);
  }

  const providers = new Map<string, string[]>();
  for (const d of definitions) {
    for (const dep of d.dependencies) {
      if (dep.componentId === d.componentId) problems.push({ code: 'SELF_DEPENDENCY', componentId: d.componentId, detail: `${d.componentId} depends on itself` });
      else if (!ids.has(dep.componentId)) problems.push({ code: 'UNKNOWN_DEPENDENCY', componentId: d.componentId, detail: `${d.componentId} depends on ${dep.componentId}, which is not registered` });
    }
    for (const c of d.contracts) {
      if (c.direction === 'provides') providers.set(`${c.key}@${c.version}`, [...(providers.get(`${c.key}@${c.version}`) ?? []), d.componentId]);
    }
  }
  for (const [id, who] of providers) {
    if (who.length > 1) problems.push({ code: 'CONTRACT_HAS_TWO_PROVIDERS', componentId: who[0]!, detail: `${id} is provided by ${who.join(' and ')}` });
  }
  for (const d of definitions) {
    for (const c of d.contracts) {
      if (c.direction === 'consumes' && !providers.has(`${c.key}@${c.version}`)) {
        problems.push({ code: 'CONTRACT_HAS_NO_PROVIDER', componentId: d.componentId, detail: `${d.componentId} consumes ${c.key}@${c.version}, which nothing provides` });
      }
    }
  }

  problems.push(...authorityOverlaps(definitions.flatMap((d) => d.authority.map((assignment) => ({ componentId: d.componentId, assignment })))));
  return problems;
}
