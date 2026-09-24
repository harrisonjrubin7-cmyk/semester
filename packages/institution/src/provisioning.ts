import { UNIVERSITY_ROLES, type UniversityRole } from './index.ts';

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
export const SCIM_PATCH_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

export type ScimResourceKind = 'User' | 'Group';
export type ScimPatchVerb = 'add' | 'replace' | 'remove';

export interface ScimFilter {
  attribute: 'userName' | 'externalId';
  operator: 'eq';
  value: string;
}

export interface ScimUser {
  schemas: [typeof SCIM_USER_SCHEMA];
  externalId?: string;
  userName: string;
  displayName?: string;
  active: boolean;
}

export interface ScimMember {
  value: string;
  display?: string;
}

export interface ScimGroup {
  schemas: [typeof SCIM_GROUP_SCHEMA];
  externalId?: string;
  displayName: string;
  members: ScimMember[];
}

export interface ScimPatchOperation {
  op: ScimPatchVerb;
  path: 'active' | 'userName' | 'displayName' | 'externalId' | 'members';
  value?: boolean | string | ScimMember[];
}

export interface ProvisioningResult {
  tenantId: string;
  userId: string;
  externalId?: string;
  userName: string;
  displayName?: string;
  active: boolean;
  roles: UniversityRole[];
  groupIds: string[];
  auditId: string;
  createdAt: string;
  updatedAt: string;
  location: string;
}

export interface ScimUserResource {
  schemas: [typeof SCIM_USER_SCHEMA];
  id: string;
  externalId?: string;
  userName: string;
  displayName?: string;
  active: boolean;
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
  };
}

const object = (value: unknown, message: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

const bounded = (value: unknown, name: string, required = true): string | undefined => {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > 300) {
    throw new Error(`Invalid SCIM ${name}.`);
  }
  return value.trim();
};

const schema = (value: unknown, expected: string, message: string): void => {
  if (!Array.isArray(value) || value.length > 10 || !value.includes(expected)) throw new Error(message);
};

const members = (value: unknown): ScimMember[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1_000) throw new Error('Invalid SCIM group members.');
  return value.map((entry) => {
    const member = object(entry, 'Invalid SCIM group member.');
    return {
      value: bounded(member.value, 'member identifier')!,
      ...(member.display === undefined ? {} : { display: bounded(member.display, 'member display')! }),
    };
  });
};

export function parseScimFilter(value: unknown): ScimFilter {
  if (typeof value !== 'string' || value.length > 640) throw new Error('Invalid SCIM filter.');
  const match = /^(userName|externalId)\s+eq\s+"([^"]+)"$/i.exec(value.trim());
  if (!match || match[2].length > 300) throw new Error('Invalid SCIM filter.');
  const attribute = match[1].toLowerCase() === 'username' ? 'userName' : 'externalId';
  return { attribute, operator: 'eq', value: match[2] };
}

export function parseScimUser(value: unknown): ScimUser {
  const input = object(value, 'Invalid SCIM user.');
  schema(input.schemas, SCIM_USER_SCHEMA, 'Invalid SCIM user schema.');
  if (input.active !== undefined && typeof input.active !== 'boolean') throw new Error('Invalid SCIM user active state.');
  return {
    schemas: [SCIM_USER_SCHEMA],
    ...(input.externalId === undefined ? {} : { externalId: bounded(input.externalId, 'external identifier')! }),
    userName: bounded(input.userName, 'userName')!,
    ...(input.displayName === undefined ? {} : { displayName: bounded(input.displayName, 'displayName')! }),
    active: input.active === undefined ? true : input.active,
  };
}

export function parseScimGroup(value: unknown): ScimGroup {
  const input = object(value, 'Invalid SCIM group.');
  schema(input.schemas, SCIM_GROUP_SCHEMA, 'Invalid SCIM group schema.');
  return {
    schemas: [SCIM_GROUP_SCHEMA],
    ...(input.externalId === undefined ? {} : { externalId: bounded(input.externalId, 'external identifier')! }),
    displayName: bounded(input.displayName, 'group displayName')!,
    members: members(input.members),
  };
}

export function parseScimPatch(value: unknown, resource: ScimResourceKind): ScimPatchOperation[] {
  const input = object(value, 'Invalid SCIM patch.');
  schema(input.schemas, SCIM_PATCH_SCHEMA, 'Invalid SCIM patch schema.');
  if (!Array.isArray(input.Operations) || !input.Operations.length || input.Operations.length > 100) {
    throw new Error('Invalid SCIM patch operations.');
  }
  const permitted = new Set(resource === 'User'
    ? ['active', 'userName', 'displayName', 'externalId']
    : ['displayName', 'externalId', 'members']);
  return input.Operations.map((entry) => {
    const operation = object(entry, 'Invalid SCIM patch operation.');
    const op = typeof operation.op === 'string' ? operation.op.toLowerCase() : '';
    const path = typeof operation.path === 'string' ? operation.path : '';
    if (!['add', 'replace', 'remove'].includes(op) || !permitted.has(path)) {
      throw new Error('Invalid SCIM patch operation.');
    }
    if (op !== 'remove' && operation.value === undefined) throw new Error('Invalid SCIM patch value.');
    let parsed: ScimPatchOperation['value'];
    if (operation.value !== undefined) {
      if (path === 'active') {
        if (typeof operation.value !== 'boolean') throw new Error('Invalid SCIM patch value.');
        parsed = operation.value;
      } else if (path === 'members') {
        parsed = members(operation.value);
      } else {
        parsed = bounded(operation.value, `patch ${path}`)!;
      }
    }
    return {
      op: op as ScimPatchVerb,
      path: path as ScimPatchOperation['path'],
      ...(parsed === undefined ? {} : { value: parsed }),
    };
  });
}

export function mapScimGroupsToRoles(
  groupNames: readonly string[],
  mappings: Readonly<Record<string, readonly UniversityRole[]>>,
): UniversityRole[] {
  const roles: UniversityRole[] = [];
  const known = new Set<UniversityRole>(UNIVERSITY_ROLES);
  for (const group of groupNames) {
    for (const role of mappings[group] ?? []) {
      if (known.has(role) && !roles.includes(role)) roles.push(role);
    }
  }
  return roles;
}

export function scimUserResource(result: ProvisioningResult): ScimUserResource {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: result.userId,
    ...(result.externalId === undefined ? {} : { externalId: result.externalId }),
    userName: result.userName,
    ...(result.displayName === undefined ? {} : { displayName: result.displayName }),
    active: result.active,
    meta: {
      resourceType: 'User',
      created: result.createdAt,
      lastModified: result.updatedAt,
      location: result.location,
    },
  };
}
