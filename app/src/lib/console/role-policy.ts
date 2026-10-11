import { cloud } from '../cloud';

export interface ServerRole {
  role: string;
  global: boolean;
}

export interface ServerCapability {
  capability: string;
  about: string;
}

export interface ServerRoleCapability {
  role: string;
  capability: string;
}

export interface RolePolicySnapshot {
  roles: ServerRole[];
  capabilities: ServerCapability[];
  assignments: ServerRoleCapability[];
}

interface RolePolicySource {
  roles: unknown;
  capabilities: unknown;
  assignments: unknown;
}

const ROLE_POLICY_TABLES = {
  roles: 'app_roles',
  capabilities: 'app_capabilities',
  assignments: 'role_capabilities',
} as const;

const invalid = (): never => { throw new Error('Role policy response was invalid.'); };
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : invalid();
const identifier = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 && value === value.trim() ? value : invalid();
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : invalid();
const boolean = (value: unknown): boolean => typeof value === 'boolean' ? value : invalid();
const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;

function unique(values: readonly string[]): void {
  if (new Set(values).size !== values.length) invalid();
}

export function readRolePolicy(source: RolePolicySource): RolePolicySnapshot {
  const rawRoles = array(source.roles);
  const rawCapabilities = array(source.capabilities);
  const rawAssignments = array(source.assignments);

  const roles: ServerRole[] = rawRoles.map((value: unknown) => {
    const row = object(value);
    return { role: identifier(row.role), global: boolean(row.global) };
  });
  const capabilities: ServerCapability[] = rawCapabilities.map((value: unknown) => {
    const row = object(value);
    return { capability: identifier(row.capability), about: identifier(row.about) };
  });
  const assignments: ServerRoleCapability[] = rawAssignments.map((value: unknown) => {
    const row = object(value);
    return { role: identifier(row.role), capability: identifier(row.capability) };
  });

  unique(roles.map(({ role }) => role));
  unique(capabilities.map(({ capability }) => capability));
  unique(assignments.map(({ role, capability }) => `${role}\u0000${capability}`));
  const knownRoles = new Set(roles.map(({ role }) => role));
  const knownCapabilities = new Set(capabilities.map(({ capability }) => capability));
  if (assignments.some(({ role, capability }) => !knownRoles.has(role) || !knownCapabilities.has(capability))) invalid();

  return {
    roles: roles.sort((left, right) => compare(left.role, right.role)),
    capabilities: capabilities.sort((left, right) => compare(left.capability, right.capability)),
    assignments: assignments.sort((left, right) => compare(left.role, right.role) || compare(left.capability, right.capability)),
  };
}

export async function loadRolePolicy(open: typeof cloud = cloud): Promise<RolePolicySnapshot> {
  const db = await open();
  const [roles, capabilities, assignments] = await Promise.all([
    db.from(ROLE_POLICY_TABLES.roles).select('role, global').order('role'),
    db.from(ROLE_POLICY_TABLES.capabilities).select('capability, about').order('capability'),
    db.from(ROLE_POLICY_TABLES.assignments).select('role, capability').order('role'),
  ]);
  const error = roles.error ?? capabilities.error ?? assignments.error;
  if (error) throw new Error(error.message?.trim() || 'Could not load role policy.');
  return readRolePolicy({ roles: roles.data, capabilities: capabilities.data, assignments: assignments.data });
}
