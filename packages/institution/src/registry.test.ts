import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AUTHORITY_MODES,
  COMPONENT_ID_PATTERN,
  COMPONENT_LIFECYCLES,
  CONTRACT_DIRECTIONS,
  CONTRACT_KINDS,
  DEPENDENCY_FAILURE_BEHAVIORS,
  DEPENDENCY_KINDS,
  RECOVERY_FAILURE_BEHAVIORS,
  authorityOverlaps,
  checkRegistry,
  validateComponentDefinition,
  type ComponentDefinition,
} from './registry.ts';

const schema = JSON.parse(readFileSync(new URL('../../../docs/control-plane/component.schema.json', import.meta.url), 'utf8'));

/** A fixture, not an entry: nothing here is registered anywhere. */
const def = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  componentId: 'academic.registration',
  version: '1',
  domain: 'academic_operations',
  owner: { teamId: 'academic_platform', supportQueueId: 'academic_operations' },
  lifecycle: 'development',
  implementation: { repositoryRef: 'fixture/path', revision: 'fixture-rev' },
  contracts: [{ key: 'registration.request', version: '1', kind: 'command', direction: 'provides', schemaRef: 'fixture://registration.request' }],
  dependencies: [{ componentId: 'identity.membership', kind: 'authorization', failureBehavior: 'block' }],
  authority: [{ tenantId: 't1', recordType: 'enrollment', scopeKey: 'term:2026-fall', mode: 'transitional', effectiveFrom: '2026-08-01T00:00:00Z' }],
  controls: ['tenant_isolation', 'audit_capture'],
  recovery: { runbookRef: 'fixture://runbook', failureBehavior: 'deny_protected_action' },
  ...over,
});

const errorsOf = (input: unknown): string[] => {
  const v = validateComponentDefinition(input);
  return v.ok ? [] : v.errors;
};

describe('component.schema.json and the validator agree', () => {
  it('on the required keys, the allowed keys, and every enum', () => {
    expect(schema.required).toEqual(['componentId', 'version', 'domain', 'owner', 'lifecycle', 'implementation', 'contracts', 'dependencies', 'authority', 'controls', 'recovery']);
    expect(Object.keys(schema.properties).sort()).toEqual([...schema.required, 'evidenceRefs'].sort());
    expect(schema.properties.lifecycle.enum).toEqual([...COMPONENT_LIFECYCLES]);
    expect(schema.properties.recovery.properties.failureBehavior.enum).toEqual([...RECOVERY_FAILURE_BEHAVIORS]);
    expect(schema.$defs.contract.properties.kind.enum).toEqual([...CONTRACT_KINDS]);
    expect(schema.$defs.contract.properties.direction.enum).toEqual([...CONTRACT_DIRECTIONS]);
    expect(schema.$defs.dependency.properties.kind.enum).toEqual([...DEPENDENCY_KINDS]);
    expect(schema.$defs.dependency.properties.failureBehavior.enum).toEqual([...DEPENDENCY_FAILURE_BEHAVIORS]);
    expect(schema.$defs.authority.properties.mode.enum).toEqual([...AUTHORITY_MODES]);
    expect(new RegExp(schema.properties.componentId.pattern).source).toBe(COMPONENT_ID_PATTERN.source);
  });

  it('on the required keys of every nested object, by removing each and watching the validator object', () => {
    const nested: Array<[string, string[], (d: Record<string, unknown>) => Record<string, unknown>]> = [
      ['owner', schema.properties.owner.required, (d) => d.owner as Record<string, unknown>],
      ['implementation', schema.properties.implementation.required, (d) => d.implementation as Record<string, unknown>],
      ['recovery', schema.properties.recovery.required, (d) => d.recovery as Record<string, unknown>],
      ['contract', schema.$defs.contract.required, (d) => (d.contracts as Record<string, unknown>[])[0]!],
      ['dependency', schema.$defs.dependency.required, (d) => (d.dependencies as Record<string, unknown>[])[0]!],
      ['authority', schema.$defs.authority.required, (d) => (d.authority as Record<string, unknown>[])[0]!],
    ];
    expect(errorsOf(def())).toEqual([]); // the control
    for (const [name, required, pick] of nested) {
      for (const key of required as string[]) {
        const d = def();
        delete pick(d)[key];
        expect(errorsOf(d).some((e) => e.endsWith(`.${key}: required`)), `${name}.${key}`).toBe(true);
      }
    }
  });
});

describe('validateComponentDefinition', () => {
  it('accepts a sound definition, and one with evidence', () => {
    expect(validateComponentDefinition(def()).ok).toBe(true);
    expect(validateComponentDefinition(def({ evidenceRefs: ['e1', 'e2'] })).ok).toBe(true);
  });

  it('refuses a non-object, and every top-level key removed in turn', () => {
    for (const v of [null, undefined, 'x', 3, [], true]) expect(validateComponentDefinition(v).ok).toBe(false);
    for (const key of schema.required as string[]) {
      const d = def();
      delete d[key];
      expect(errorsOf(d), key).toContain(`$.${key}: required`);
    }
  });

  it('refuses an unknown key at the top and inside, as additionalProperties false does', () => {
    expect(errorsOf(def({ surprise: 1 }))).toContain('$.surprise: not allowed');
    expect(errorsOf(def({ owner: { teamId: 't', supportQueueId: 'q', extra: 1 } }))).toContain('$.owner.extra: not allowed');
  });

  it('refuses a malformed id, an empty string, and an unknown enum value', () => {
    for (const id of ['Registration', 'registration', 'a.B', 'a..b', '1a.b', 'a.b-c', '']) expect(errorsOf(def({ componentId: id })).length, id).toBeGreaterThan(0);
    for (const id of ['a.b', 'academic.registration', 'x1.y_2.z']) expect(errorsOf(def({ componentId: id })), id).toEqual([]);
    expect(errorsOf(def({ version: '' }))).toContain('$.version: must be a non-empty string');
    expect(errorsOf(def({ lifecycle: 'live' })).join()).toMatch(/lifecycle: must be one of/);
    expect(errorsOf(def({ recovery: { runbookRef: 'r', failureBehavior: 'ignore' } })).join()).toMatch(/failureBehavior: must be one of/);
  });

  it('requires an approval for authoritative records, and a window that opens before it closes', () => {
    const auth = (a: Record<string, unknown>) => def({ authority: [{ tenantId: 't1', recordType: 'enrollment', scopeKey: 's', effectiveFrom: '2026-08-01T00:00:00Z', ...a }] });
    expect(errorsOf(auth({ mode: 'authoritative' }))).toContain('$.authority[0].approvalRef: required when mode is authoritative');
    expect(errorsOf(auth({ mode: 'authoritative', approvalRef: 'ap-1' }))).toEqual([]);
    expect(errorsOf(auth({ mode: 'planning_only' }))).toEqual([]);
    expect(errorsOf(auth({ mode: 'read_replica', effectiveUntil: '2026-08-01T00:00:00Z' }))).toContain('$.authority[0].effectiveUntil: must be after effectiveFrom');
    expect(errorsOf(auth({ mode: 'read_replica', effectiveFrom: 'yesterday' }))).toContain('$.authority[0].effectiveFrom: must be an ISO date-time');
  });

  it('refuses duplicate controls and reports every problem at once', () => {
    expect(errorsOf(def({ controls: ['a', 'a'] }))).toContain('$.controls: items must be unique');
    expect(errorsOf(def({ lifecycle: 'live', version: '', controls: 'x' })).length).toBe(3);
  });
});

const comp = (over: Record<string, unknown>): ComponentDefinition => {
  const v = validateComponentDefinition(def(over));
  if (!v.ok) throw new Error(v.errors.join('; '));
  return v.definition;
};

describe('checkRegistry', () => {
  const identity = comp({ componentId: 'identity.membership', dependencies: [], contracts: [], authority: [] });
  const registration = comp({ componentId: 'academic.registration', authority: [] });

  it('finds nothing wrong with a consistent pair', () => {
    expect(checkRegistry([identity, registration])).toEqual([]);
  });

  it('names a dependency nobody registered, a component registered twice, and a self-dependency', () => {
    expect(checkRegistry([registration]).map((p) => p.code)).toEqual(['UNKNOWN_DEPENDENCY']);
    expect(checkRegistry([identity, identity]).map((p) => p.code)).toContain('DUPLICATE_COMPONENT');
    const selfish = comp({ componentId: 'a.b', dependencies: [{ componentId: 'a.b', kind: 'synchronous', failureBehavior: 'block' }], contracts: [], authority: [] });
    expect(checkRegistry([selfish]).map((p) => p.code)).toEqual(['SELF_DEPENDENCY']);
  });

  it('wants one provider for each contract version, and a provider for each one consumed', () => {
    const consumer = comp({ componentId: 'calendar.sync', dependencies: [], authority: [], contracts: [{ key: 'registration.request', version: '1', kind: 'command', direction: 'consumes', schemaRef: 'x' }] });
    expect(checkRegistry([consumer]).map((p) => p.code)).toEqual(['CONTRACT_HAS_NO_PROVIDER']);
    expect(checkRegistry([identity, registration, consumer])).toEqual([]);
    const twin = comp({ componentId: 'academic.registration_two', dependencies: [], authority: [] });
    expect(checkRegistry([identity, registration, twin]).map((p) => p.code)).toEqual(['CONTRACT_HAS_TWO_PROVIDERS']);
    const otherVersion = comp({ componentId: 'academic.registration_two', dependencies: [], authority: [], contracts: [{ key: 'registration.request', version: '2', kind: 'command', direction: 'provides', schemaRef: 'x' }] });
    expect(checkRegistry([identity, registration, otherVersion])).toEqual([]);
  });
});

describe('authorityOverlaps', () => {
  const a = (componentId: string, over: Record<string, unknown> = {}) => ({
    componentId,
    assignment: { tenantId: 't1', recordType: 'enrollment', scopeKey: 'term:2026-fall', mode: 'authoritative' as const, effectiveFrom: '2026-08-01T00:00:00Z', effectiveUntil: '2026-12-31T00:00:00Z', approvalRef: 'ap', ...over },
  });

  it('flags two authoritative claims over the same scope and time', () => {
    expect(authorityOverlaps([a('x.one'), a('y.two')])).toHaveLength(1);
  });

  it('flags an authoritative claim beside a transitional one, which is also writing', () => {
    expect(authorityOverlaps([a('x.one'), a('y.two', { mode: 'transitional' })])).toHaveLength(1);
  });

  it('allows them to follow each other, including when one ends the instant the other begins', () => {
    expect(authorityOverlaps([a('x.one', { effectiveUntil: '2026-09-01T00:00:00Z' }), a('y.two', { effectiveFrom: '2026-09-01T00:00:00Z' })])).toEqual([]);
  });

  it('treats an open-ended claim as overlapping everything after it starts', () => {
    const open = a('x.one', { effectiveUntil: undefined });
    expect(authorityOverlaps([open, a('y.two', { effectiveFrom: '2030-01-01T00:00:00Z', effectiveUntil: '2030-02-01T00:00:00Z' })])).toHaveLength(1);
  });

  it('lets a replica or a plan sit beside the authority, and ignores a different tenant, record or scope', () => {
    expect(authorityOverlaps([a('x.one'), a('y.two', { mode: 'read_replica' })])).toEqual([]);
    expect(authorityOverlaps([a('x.one'), a('y.two', { mode: 'planning_only' })])).toEqual([]);
    expect(authorityOverlaps([a('x.one', { mode: 'transitional' }), a('y.two', { mode: 'transitional' })])).toEqual([]);
    for (const other of [{ tenantId: 't2' }, { recordType: 'grade' }, { scopeKey: 'term:2027-spring' }]) {
      expect(authorityOverlaps([a('x.one'), a('y.two', other)]), JSON.stringify(other)).toEqual([]);
    }
  });
});
