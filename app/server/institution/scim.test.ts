import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SCIM_GROUP_SCHEMA,
  SCIM_PATCH_SCHEMA,
  SCIM_USER_SCHEMA,
  type ProvisioningResult,
  type ScimFilter,
  type ScimGroup,
  type ScimUser,
} from '../../../packages/institution/src/index.ts';
import {
  createScimService,
  type CredentialMaterial,
  type ScimAuditEvent,
  type ScimRepository,
  type StoredScimGroup,
} from './scim.ts';

const credentialId = '11111111-1111-4111-8111-111111111111';
const secret = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH';
const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
const hash = createHash('sha256').update(Buffer.concat([salt, Buffer.from(secret)])).digest();

class MemoryRepository implements ScimRepository {
  users = new Map<string, ProvisioningResult>();
  groups = new Map<string, StoredScimGroup>();
  events: ScimAuditEvent[] = [];
  writes = 0;
  private requests = new Map<string, ProvisioningResult | StoredScimGroup>();

  async credential(id: string): Promise<CredentialMaterial | null> {
    return id === credentialId
      ? { id, tenantId: 'vanderbilt', salt, hash, status: 'active' }
      : null;
  }

  async listUsers(tenantId: string, filter: ScimFilter | null) {
    return [...this.users.values()].filter((user) => user.tenantId === tenantId && (!filter || user[filter.attribute] === filter.value));
  }

  async getUser(tenantId: string, id: string) {
    const user = this.users.get(id);
    return user?.tenantId === tenantId ? user : null;
  }

  async putUser(tenantId: string, id: string | null, input: ScimUser, requestId: string) {
    const replay = this.requests.get(`${tenantId}:${requestId}`);
    if (replay && 'userId' in replay) return replay;
    this.writes++;
    const now = '2026-09-24T12:00:00.000Z';
    const userId = id ?? `user-${this.users.size + 1}`;
    const before = this.users.get(userId);
    const result: ProvisioningResult = {
      tenantId,
      userId,
      externalId: input.externalId,
      userName: input.userName,
      displayName: input.displayName,
      active: input.active,
      roles: before?.roles ?? [],
      groupIds: before?.groupIds ?? [],
      auditId: `audit-${requestId}`,
      createdAt: before?.createdAt ?? now,
      updatedAt: now,
      location: `https://semester.example/api/scim/v2/Users/${userId}`,
    };
    this.users.set(userId, result);
    this.requests.set(`${tenantId}:${requestId}`, result);
    return result;
  }

  async listGroups(tenantId: string, filter: ScimFilter | null) {
    return [...this.groups.values()].filter((group) => group.tenantId === tenantId && (!filter || (
      filter.attribute === 'externalId' ? group.externalId === filter.value : false
    )));
  }

  async getGroup(tenantId: string, id: string) {
    const group = this.groups.get(id);
    return group?.tenantId === tenantId ? group : null;
  }

  async putGroup(tenantId: string, id: string | null, input: ScimGroup, requestId: string) {
    const replay = this.requests.get(`${tenantId}:${requestId}`);
    if (replay && 'groupId' in replay) return replay;
    this.writes++;
    const now = '2026-09-24T12:00:00.000Z';
    const groupId = id ?? `group-${this.groups.size + 1}`;
    const before = this.groups.get(groupId);
    const result: StoredScimGroup = {
      tenantId,
      groupId,
      externalId: input.externalId,
      displayName: input.displayName,
      members: input.members,
      createdAt: before?.createdAt ?? now,
      updatedAt: now,
      location: `https://semester.example/api/scim/v2/Groups/${groupId}`,
    };
    this.groups.set(groupId, result);
    this.requests.set(`${tenantId}:${requestId}`, result);
    return result;
  }

  async deleteGroup(tenantId: string, id: string) {
    const group = this.groups.get(id);
    if (group?.tenantId === tenantId) this.groups.delete(id);
  }

  async audit(event: ScimAuditEvent) {
    this.events.push(event);
  }
}

const bearer = `Bearer ${credentialId}.${secret}`;

function fixture(options: { allow?: boolean } = {}) {
  const repository = new MemoryRepository();
  const service = createScimService({
    baseUrl: 'https://semester.example/api/scim/v2',
    repository,
    rateLimiter: { allow: async () => options.allow !== false },
  });
  const request = (path: string, init: RequestInit = {}) => service(new Request(`https://semester.example/api/scim/v2${path}`, {
    ...init,
    headers: { authorization: bearer, ...(init.body ? { 'content-type': 'application/scim+json' } : {}), ...init.headers },
  }));
  const mutate = (path: string, method: string, body?: unknown, key = `request-${Math.random()}`) => request(path, {
    method,
    headers: { 'Idempotency-Key': key },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { repository, request, mutate };
}

const user = (active = true): ScimUser => ({
  schemas: [SCIM_USER_SCHEMA],
  externalId: 'vu-1001',
  userName: 'student@vanderbilt.edu',
  displayName: 'Student One',
  active,
});

describe('SCIM 2.0 institutional service', () => {
  it('serves authenticated discovery documents', async () => {
    const f = fixture();
    for (const path of ['/ServiceProviderConfig', '/Schemas', '/ResourceTypes']) {
      const response = await f.request(path);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/scim+json');
      expect(await response.json()).toHaveProperty('schemas');
    }
  });

  it('creates, reads, filters, replaces, patches and deactivates users', async () => {
    const f = fixture();
    const created = await f.mutate('/Users', 'POST', { ...user(), tenantId: 'attacker-selected' }, 'create-user');
    expect(created.status).toBe(201);
    const resource = await created.json();
    expect(resource.id).toBe('user-1');
    expect(JSON.stringify(resource)).not.toMatch(/tenantId|roles|auditId|course|grade/i);
    expect(f.repository.users.get('user-1')?.tenantId).toBe('vanderbilt');

    expect((await f.request('/Users/user-1')).status).toBe(200);
    const listed = await (await f.request('/Users?filter=userName%20eq%20%22student%40vanderbilt.edu%22&startIndex=1&count=10')).json();
    expect(listed.totalResults).toBe(1);
    expect(listed.Resources[0].id).toBe('user-1');

    expect((await f.mutate('/Users/user-1', 'PUT', { ...user(), displayName: 'Updated Name' }, 'replace-user')).status).toBe(200);
    expect((await f.mutate('/Users/user-1', 'PATCH', {
      schemas: [SCIM_PATCH_SCHEMA],
      Operations: [{ op: 'replace', path: 'displayName', value: 'Patched Name' }],
    }, 'patch-user')).status).toBe(200);
    expect(f.repository.users.get('user-1')?.displayName).toBe('Patched Name');

    const removed = await f.mutate('/Users/user-1', 'DELETE', undefined, 'deactivate-user');
    expect(removed.status).toBe(204);
    expect(f.repository.users.get('user-1')?.active).toBe(false);
  });

  it('supports group CRUD without exposing role mappings', async () => {
    const f = fixture();
    const group: ScimGroup = {
      schemas: [SCIM_GROUP_SCHEMA],
      externalId: 'students',
      displayName: 'Vanderbilt students',
      members: [{ value: 'user-1', display: 'Student One' }],
    };
    const created = await f.mutate('/Groups', 'POST', group, 'create-group');
    expect(created.status).toBe(201);
    expect(JSON.stringify(await created.json())).not.toMatch(/roles|tenantId/);
    expect((await f.request('/Groups/group-1')).status).toBe(200);
    expect((await f.mutate('/Groups/group-1', 'PUT', { ...group, displayName: 'Students' }, 'replace-group')).status).toBe(200);
    expect((await f.mutate('/Groups/group-1', 'PATCH', {
      schemas: [SCIM_PATCH_SCHEMA],
      Operations: [{ op: 'replace', path: 'members', value: [] }],
    }, 'patch-group')).status).toBe(200);
    expect((await f.mutate('/Groups/group-1', 'DELETE', undefined, 'delete-group')).status).toBe(204);
    expect((await f.request('/Groups/group-1')).status).toBe(404);
  });

  it('returns the same resource for an idempotent replay without a second write', async () => {
    const f = fixture();
    const first = await (await f.mutate('/Users', 'POST', user(), 'same-request')).json();
    const again = await (await f.mutate('/Users', 'POST', user(), 'same-request')).json();
    expect(again.id).toBe(first.id);
    expect(f.repository.writes).toBe(1);
  });

  it('rejects oversized bodies, invalid schemas and unsupported tenant paths', async () => {
    const f = fixture();
    expect((await f.mutate('/Users', 'POST', { ...user(), schemas: ['wrong'] }, 'bad-schema')).status).toBe(400);
    expect((await f.request('/Tenants/another-school/Users')).status).toBe(404);
    expect((await f.mutate('/Users', 'POST', { ...user(), displayName: 'x'.repeat(130_000) }, 'huge')).status).toBe(413);
  });

  it('rejects invalid credentials with a SCIM error and no repository write', async () => {
    const f = fixture();
    const response = await f.request('/Users', { headers: { authorization: `Bearer ${credentialId}.${'z'.repeat(44)}` } });
    expect(response.status).toBe(401);
    expect((await response.json()).schemas).toEqual(['urn:ietf:params:scim:api:messages:2.0:Error']);
    expect(f.repository.writes).toBe(0);
  });

  it('rate limits by the credential boundary before reading resources', async () => {
    const f = fixture({ allow: false });
    expect((await f.request('/Users')).status).toBe(429);
  });

  it('records accepted and refused mutations without request bodies or bearer secrets', async () => {
    const f = fixture();
    await f.mutate('/Users', 'POST', user(), 'accepted-request');
    await f.mutate('/Users', 'POST', { ...user(), schemas: ['wrong'] }, 'refused-request');
    expect(f.repository.events.map((event) => event.outcome)).toEqual(['accepted', 'refused']);
    expect(JSON.stringify(f.repository.events)).not.toContain(secret);
    expect(JSON.stringify(f.repository.events)).not.toContain('student@vanderbilt.edu');
  });
});
