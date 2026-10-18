import { describe, expect, it } from 'vitest';
import {
  createApplication,
  createMemoryStore,
  listApplications,
  readApplication,
  transitionApplication,
  type Principal,
} from './registry';

const reader = (orgId: string): Principal => ({
  id: `user_${orgId}`,
  orgId,
  scopes: new Set(['apps:read', 'apps:write']),
  grantActive: true,
});

const none = new Set<string>();
const evidence = (...items: string[]): ReadonlySet<string> => new Set(items);

async function seed(store: ReturnType<typeof createMemoryStore>, orgId: string, id: string): Promise<void> {
  const result = await createApplication(store, reader(orgId), { id, name: `App ${id}`, purpose: 'Planning' });
  expect(result.ok).toBe(true);
}

describe('creating an application', () => {
  it('starts as a draft owned by the principal organization, not by any id in the input', async () => {
    const store = createMemoryStore();
    const result = await createApplication(store, reader('org_a'), { id: 'app_1', name: 'Planner', purpose: 'Tasks' });
    expect(result).toEqual({
      ok: true,
      value: { id: 'app_1', orgId: 'org_a', name: 'Planner', purpose: 'Tasks', state: 'draft', version: 1 },
    });
  });

  it('refuses a principal without apps:write', async () => {
    const store = createMemoryStore();
    const viewer: Principal = { ...reader('org_a'), scopes: new Set(['apps:read']) };
    const result = await createApplication(store, viewer, { id: 'app_1', name: 'x', purpose: 'y' });
    expect(result).toEqual({ ok: false, error: { code: 'FORBIDDEN', scope: 'apps:write' } });
    expect(await store.get('app_1')).toBeUndefined();
  });

  it('refuses a duplicate id instead of overwriting the existing record', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const again = await createApplication(store, reader('org_b'), { id: 'app_1', name: 'Other', purpose: 'z' });
    expect(again).toEqual({ ok: false, error: { code: 'CONFLICT' } });
    expect((await store.get('app_1'))?.orgId).toBe('org_a');
  });
});

describe('tenant isolation', () => {
  it('reports another organization record as NOT_FOUND, not FORBIDDEN, so its existence does not leak', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    expect(await readApplication(store, reader('org_b'), 'app_1')).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('reports a missing record the same way as another tenant record', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const missing = await readApplication(store, reader('org_a'), 'nope');
    const foreign = await readApplication(store, reader('org_b'), 'app_1');
    expect(missing).toEqual(foreign);
  });

  it('lists only the principal own organization records', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    await seed(store, 'org_a', 'app_2');
    await seed(store, 'org_b', 'app_3');
    const result = await listApplications(store, reader('org_a'));
    expect(result.ok && result.value.map((record) => record.id).sort()).toEqual(['app_1', 'app_2']);
  });

  it('will not transition another organization record', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const result = await transitionApplication(store, reader('org_b'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      evidence: evidence('sandbox-fixtures'),
      expectedVersion: 1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
    expect((await store.get('app_1'))?.state).toBe('draft');
  });
});

describe('scopes and revoked grants', () => {
  it('refuses a read without apps:read', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const writerOnly: Principal = { ...reader('org_a'), scopes: new Set(['apps:write']) };
    expect(await readApplication(store, writerOnly, 'app_1')).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', scope: 'apps:read' },
    });
  });

  it('refuses every operation once the grant is revoked, before any record is read', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const revoked: Principal = { ...reader('org_a'), grantActive: false };
    expect(await readApplication(store, revoked, 'app_1')).toEqual({ ok: false, error: { code: 'GRANT_REVOKED' } });
    expect(await listApplications(store, revoked)).toEqual({ ok: false, error: { code: 'GRANT_REVOKED' } });
    expect(
      await transitionApplication(store, revoked, {
        id: 'app_1',
        to: 'sandbox-enabled',
        evidence: evidence('sandbox-fixtures'),
        expectedVersion: 1,
      }),
    ).toEqual({ ok: false, error: { code: 'GRANT_REVOKED' } });
  });
});

describe('transitions through the registry', () => {
  it('moves a draft to sandbox-enabled, bumps the version, and persists the new state', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const result = await transitionApplication(store, reader('org_a'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      evidence: evidence('sandbox-fixtures'),
      expectedVersion: 1,
    });
    expect(result.ok && result.value.state).toBe('sandbox-enabled');
    expect((await store.get('app_1'))?.version).toBe(2);
  });

  it('reports missing evidence and does not persist anything', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const result = await transitionApplication(store, reader('org_a'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      evidence: none,
      expectedVersion: 1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'EVIDENCE_REQUIRED', missing: ['sandbox-fixtures'] } });
    expect((await store.get('app_1'))?.state).toBe('draft');
  });

  it('refuses a skipped state and lists the moves that are allowed', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    const result = await transitionApplication(store, reader('org_a'), {
      id: 'app_1',
      to: 'active',
      evidence: evidence('certified-release'),
      expectedVersion: 1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'INVALID_TRANSITION', allowed: ['sandbox-enabled'] } });
  });

  it('refuses a stale expected version and reports the current one', async () => {
    const store = createMemoryStore();
    await seed(store, 'org_a', 'app_1');
    await transitionApplication(store, reader('org_a'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      evidence: evidence('sandbox-fixtures'),
      expectedVersion: 1,
    });
    const stale = await transitionApplication(store, reader('org_a'), {
      id: 'app_1',
      to: 'active',
      evidence: evidence('certified-release'),
      expectedVersion: 1,
    });
    expect(stale).toEqual({ ok: false, error: { code: 'PRECONDITION_FAILED', currentVersion: 2 } });
  });
});
