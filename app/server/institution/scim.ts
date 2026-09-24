import { createHash, timingSafeEqual } from 'node:crypto';
import {
  SCIM_GROUP_SCHEMA,
  SCIM_USER_SCHEMA,
  parseScimFilter,
  parseScimGroup,
  parseScimPatch,
  parseScimUser,
  scimUserResource,
  type ProvisioningResult,
  type ScimFilter,
  type ScimGroup,
  type ScimMember,
  type ScimPatchOperation,
  type ScimUser,
} from '../../../packages/institution/src/index.ts';

const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
const MAX_BODY = 128_000;

export interface CredentialMaterial {
  id: string;
  tenantId: string;
  salt: Uint8Array;
  hash: Uint8Array;
  status: 'active' | 'revoked';
}

export interface StoredScimGroup {
  tenantId: string;
  groupId: string;
  externalId?: string;
  displayName: string;
  members: ScimMember[];
  createdAt: string;
  updatedAt: string;
  location: string;
}

export interface ScimAuditEvent {
  tenantId: string;
  credentialId: string;
  requestId: string;
  method: string;
  resourceType: 'User' | 'Group' | 'Discovery' | 'Unknown';
  resourceId?: string;
  outcome: 'accepted' | 'refused';
  status: number;
  reason: string;
  occurredAt: string;
}

export interface ScimRepository {
  /**
   * Mutation methods persist their accepted audit event atomically. `audit`
   * may therefore see the same tenant/request id immediately afterwards and
   * must treat that as an idempotent acknowledgement, not a second insert.
   * Refused mutations have no mutation transaction, so `audit` creates them.
   */
  credential(id: string): Promise<CredentialMaterial | null>;
  listUsers(tenantId: string, filter: ScimFilter | null): Promise<ProvisioningResult[]>;
  getUser(tenantId: string, id: string): Promise<ProvisioningResult | null>;
  putUser(tenantId: string, id: string | null, input: ScimUser, requestId: string, credentialId: string): Promise<ProvisioningResult>;
  listGroups(tenantId: string, filter: ScimFilter | null): Promise<StoredScimGroup[]>;
  getGroup(tenantId: string, id: string): Promise<StoredScimGroup | null>;
  putGroup(tenantId: string, id: string | null, input: ScimGroup, requestId: string, credentialId: string): Promise<StoredScimGroup>;
  deleteGroup(tenantId: string, id: string, requestId: string, credentialId: string): Promise<void>;
  audit(event: ScimAuditEvent): Promise<void>;
}

export interface ScimRateLimiter {
  allow(tenantId: string, credentialId: string): Promise<boolean>;
}

interface ScimConfig {
  baseUrl: string;
  repository: ScimRepository;
  rateLimiter: ScimRateLimiter;
  clock?: () => Date;
}

class ScimError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const headers = () => new Headers({
  'Content-Type': 'application/scim+json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headers() });

const errorResponse = (status: number, detail: string) => json({
  schemas: [SCIM_ERROR_SCHEMA],
  status: String(status),
  detail,
}, status);

const resourceType = (path: string): ScimAuditEvent['resourceType'] =>
  path.includes('/Users') ? 'User'
    : path.includes('/Groups') ? 'Group'
      : ['/ServiceProviderConfig', '/Schemas', '/ResourceTypes'].includes(path) ? 'Discovery'
        : 'Unknown';

const groupResource = (group: StoredScimGroup) => ({
  schemas: [SCIM_GROUP_SCHEMA],
  id: group.groupId,
  ...(group.externalId ? { externalId: group.externalId } : {}),
  displayName: group.displayName,
  members: group.members,
  meta: {
    resourceType: 'Group',
    created: group.createdAt,
    lastModified: group.updatedAt,
    location: group.location,
  },
});

const page = <T>(items: T[], url: URL) => {
  const rawStart = Number(url.searchParams.get('startIndex') ?? '1');
  const rawCount = Number(url.searchParams.get('count') ?? '100');
  const startIndex = Number.isInteger(rawStart) && rawStart > 0 ? rawStart : 1;
  const count = Number.isInteger(rawCount) && rawCount >= 0 ? Math.min(rawCount, 200) : 100;
  const resources = items.slice(startIndex - 1, startIndex - 1 + count);
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: items.length,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
};

async function body(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY) throw new ScimError(413, 'The SCIM request is too large.');
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY) throw new ScimError(413, 'The SCIM request is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new ScimError(400, 'The SCIM request is not valid JSON.');
  }
}

const requestId = (request: Request): string => {
  const value = request.headers.get('idempotency-key');
  if (!value || value.length > 300) throw new ScimError(400, 'A bounded Idempotency-Key is required for SCIM mutations.');
  return value;
};

const validated = <T>(read: () => T): T => {
  try {
    return read();
  } catch (error) {
    throw new ScimError(400, error instanceof Error ? error.message : 'Invalid SCIM request.');
  }
};

const applyUserPatch = (current: ProvisioningResult, operations: ScimPatchOperation[]): ScimUser => {
  const next: Record<string, unknown> = {
    schemas: [SCIM_USER_SCHEMA],
    externalId: current.externalId,
    userName: current.userName,
    displayName: current.displayName,
    active: current.active,
  };
  for (const operation of operations) {
    if (operation.path === 'members') throw new ScimError(400, 'Invalid SCIM user patch.');
    if (operation.op === 'remove') delete next[operation.path];
    else next[operation.path] = operation.value;
  }
  return validated(() => parseScimUser(next));
};

const applyGroupPatch = (current: StoredScimGroup, operations: ScimPatchOperation[]): ScimGroup => {
  const next: Record<string, unknown> = {
    schemas: [SCIM_GROUP_SCHEMA],
    externalId: current.externalId,
    displayName: current.displayName,
    members: current.members,
  };
  for (const operation of operations) {
    if (operation.path === 'active' || operation.path === 'userName') throw new ScimError(400, 'Invalid SCIM group patch.');
    if (operation.op === 'remove') delete next[operation.path];
    else next[operation.path] = operation.value;
  }
  return validated(() => parseScimGroup(next));
};

const idFrom = (path: string, collection: 'Users' | 'Groups') => {
  const match = new RegExp(`^/${collection}/([^/]+)$`).exec(path);
  return match ? decodeURIComponent(match[1]) : null;
};

export function createScimService(config: ScimConfig) {
  const base = new URL(config.baseUrl);
  const clock = config.clock ?? (() => new Date());

  return async (request: Request): Promise<Response> => {
    let credential: CredentialMaterial | null = null;
    let path = '';
    let mutationId = request.headers.get('idempotency-key') ?? '';
    try {
      const url = new URL(request.url);
      if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new ScimError(404, 'SCIM endpoint not found.');
      path = url.pathname.slice(base.pathname.length) || '/';

      const token = /^Bearer ([0-9a-fA-F-]{36})\.([A-Za-z0-9_-]{32,})$/.exec(request.headers.get('authorization') ?? '');
      if (!token) throw new ScimError(401, 'A valid SCIM bearer credential is required.');
      credential = await config.repository.credential(token[1]);
      const salt = credential?.salt ?? new Uint8Array(16);
      const expected = credential?.hash ?? new Uint8Array(32);
      const actual = createHash('sha256').update(Buffer.concat([Buffer.from(salt), Buffer.from(token[2])])).digest();
      const valid = expected.byteLength === actual.byteLength && timingSafeEqual(Buffer.from(expected), actual);
      if (!credential || credential.status !== 'active' || !valid) throw new ScimError(401, 'A valid SCIM bearer credential is required.');
      if (!await config.rateLimiter.allow(credential.tenantId, credential.id)) throw new ScimError(429, 'SCIM request rate limit exceeded.');

      if (request.method === 'GET' && path === '/ServiceProviderConfig') {
        return json({
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
          patch: { supported: true }, bulk: { supported: false }, filter: { supported: true, maxResults: 200 },
          changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false },
        });
      }
      if (request.method === 'GET' && path === '/Schemas') {
        return json({ schemas: [SCIM_LIST_SCHEMA], totalResults: 2, Resources: [{ id: SCIM_USER_SCHEMA }, { id: SCIM_GROUP_SCHEMA }] });
      }
      if (request.method === 'GET' && path === '/ResourceTypes') {
        return json({ schemas: [SCIM_LIST_SCHEMA], totalResults: 2, Resources: [
          { id: 'User', endpoint: '/Users', schema: SCIM_USER_SCHEMA },
          { id: 'Group', endpoint: '/Groups', schema: SCIM_GROUP_SCHEMA },
        ] });
      }

      const userId = idFrom(path, 'Users');
      const groupId = idFrom(path, 'Groups');
      if (request.method === 'GET' && path === '/Users') {
        const filter = url.searchParams.has('filter') ? validated(() => parseScimFilter(url.searchParams.get('filter'))) : null;
        return json(page((await config.repository.listUsers(credential.tenantId, filter)).map(scimUserResource), url));
      }
      if (request.method === 'GET' && userId) {
        const found = await config.repository.getUser(credential.tenantId, userId);
        return found ? json(scimUserResource(found)) : errorResponse(404, 'SCIM user not found.');
      }
      if (request.method === 'GET' && path === '/Groups') {
        const filter = url.searchParams.has('filter') ? validated(() => parseScimFilter(url.searchParams.get('filter'))) : null;
        return json(page((await config.repository.listGroups(credential.tenantId, filter)).map(groupResource), url));
      }
      if (request.method === 'GET' && groupId) {
        const found = await config.repository.getGroup(credential.tenantId, groupId);
        return found ? json(groupResource(found)) : errorResponse(404, 'SCIM group not found.');
      }

      if (request.method === 'GET') throw new ScimError(404, 'SCIM endpoint not found.');
      mutationId = requestId(request);
      if (request.method === 'POST' && path === '/Users') {
        const input = await body(request);
        const saved = await config.repository.putUser(credential.tenantId, null, validated(() => parseScimUser(input)), mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'User', resourceId: saved.userId, outcome: 'accepted', status: 201, reason: 'created', occurredAt: clock().toISOString() });
        return json(scimUserResource(saved), 201);
      }
      if (request.method === 'PUT' && userId) {
        if (!await config.repository.getUser(credential.tenantId, userId)) throw new ScimError(404, 'SCIM user not found.');
        const input = await body(request);
        const saved = await config.repository.putUser(credential.tenantId, userId, validated(() => parseScimUser(input)), mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'User', resourceId: userId, outcome: 'accepted', status: 200, reason: 'replaced', occurredAt: clock().toISOString() });
        return json(scimUserResource(saved));
      }
      if (request.method === 'PATCH' && userId) {
        const current = await config.repository.getUser(credential.tenantId, userId);
        if (!current) throw new ScimError(404, 'SCIM user not found.');
        const input = await body(request);
        const saved = await config.repository.putUser(credential.tenantId, userId, applyUserPatch(current, validated(() => parseScimPatch(input, 'User'))), mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'User', resourceId: userId, outcome: 'accepted', status: 200, reason: 'patched', occurredAt: clock().toISOString() });
        return json(scimUserResource(saved));
      }
      if (request.method === 'DELETE' && userId) {
        const current = await config.repository.getUser(credential.tenantId, userId);
        if (!current) throw new ScimError(404, 'SCIM user not found.');
        await config.repository.putUser(credential.tenantId, userId, {
          schemas: [SCIM_USER_SCHEMA], externalId: current.externalId, userName: current.userName,
          displayName: current.displayName, active: false,
        }, mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'User', resourceId: userId, outcome: 'accepted', status: 204, reason: 'deactivated', occurredAt: clock().toISOString() });
        return new Response(null, { status: 204, headers: headers() });
      }

      if (request.method === 'POST' && path === '/Groups') {
        const input = await body(request);
        const saved = await config.repository.putGroup(credential.tenantId, null, validated(() => parseScimGroup(input)), mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'Group', resourceId: saved.groupId, outcome: 'accepted', status: 201, reason: 'created', occurredAt: clock().toISOString() });
        return json(groupResource(saved), 201);
      }
      if (request.method === 'PUT' && groupId) {
        if (!await config.repository.getGroup(credential.tenantId, groupId)) throw new ScimError(404, 'SCIM group not found.');
        const input = await body(request);
        const saved = await config.repository.putGroup(credential.tenantId, groupId, validated(() => parseScimGroup(input)), mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'Group', resourceId: groupId, outcome: 'accepted', status: 200, reason: 'replaced', occurredAt: clock().toISOString() });
        return json(groupResource(saved));
      }
      if (request.method === 'PATCH' && groupId) {
        const current = await config.repository.getGroup(credential.tenantId, groupId);
        if (!current) throw new ScimError(404, 'SCIM group not found.');
        const input = await body(request);
        const saved = await config.repository.putGroup(credential.tenantId, groupId, applyGroupPatch(current, validated(() => parseScimPatch(input, 'Group'))), mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'Group', resourceId: groupId, outcome: 'accepted', status: 200, reason: 'patched', occurredAt: clock().toISOString() });
        return json(groupResource(saved));
      }
      if (request.method === 'DELETE' && groupId) {
        if (!await config.repository.getGroup(credential.tenantId, groupId)) throw new ScimError(404, 'SCIM group not found.');
        await config.repository.deleteGroup(credential.tenantId, groupId, mutationId, credential.id);
        await config.repository.audit({ tenantId: credential.tenantId, credentialId: credential.id, requestId: mutationId, method: request.method, resourceType: 'Group', resourceId: groupId, outcome: 'accepted', status: 204, reason: 'deleted', occurredAt: clock().toISOString() });
        return new Response(null, { status: 204, headers: headers() });
      }

      throw new ScimError(404, 'SCIM endpoint not found.');
    } catch (error) {
      const failure = error instanceof ScimError ? error : new ScimError(503, 'SCIM service is temporarily unavailable.');
      if (credential && request.method !== 'GET' && mutationId) {
        await config.repository.audit({
          tenantId: credential.tenantId,
          credentialId: credential.id,
          requestId: mutationId.slice(0, 300),
          method: request.method,
          resourceType: resourceType(path),
          outcome: 'refused',
          status: failure.status,
          reason: failure.message,
          occurredAt: clock().toISOString(),
        });
      }
      return errorResponse(failure.status, failure.message);
    }
  };
}
