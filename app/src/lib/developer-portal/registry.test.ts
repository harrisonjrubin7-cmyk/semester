import { describe, expect, it } from 'vitest';
import {
  createApplication,
  createMemoryEvidence,
  createMemoryStore,
  listApplications,
  readApplication,
  transitionApplication,
  type ApplicationRecord,
  type MemoryEvidence,
  type Principal,
} from './registry';

const reader = (orgId: string): Principal => ({
  id: `user_${orgId}`,
  orgId,
  scopes: new Set(['apps:read', 'apps:write']),
  grantActive: true,
});

/** Ids are assigned in order, so tests can name the records they create. */
const sequence = (prefix: string): (() => string) => {
  let next = 0;
  return () => `${prefix}_${++next}`;
};

async function seed(
  store: ReturnType<typeof createMemoryStore>,
  orgId: string,
  id: string,
): Promise<string> {
  const result = await createApplication(store, reader(orgId), { name: `App ${id}`, purpose: 'Planning' }, () => id);
  expect(result.ok).toBe(true);
  return id;
}

describe('creating an application', () => {
  it('starts as a draft owned by the principal organization, with an id the server assigns', async () => {
    const store = createMemoryStore();
    const result = await createApplication(
      store,
      reader('org_a'),
      { name: 'Planner', purpose: 'Tasks' },
      sequence('app'),
    );
    expect(result).toEqual({
      ok: true,
      value: { id: 'app_1', orgId: 'org_a', name: 'Planner', purpose: 'Tasks', state: 'draft', version: 1 },
    });
  });

  it('ignores any id the caller tries to supply', async () => {
    const store = createMemoryStore();
    const input = { name: 'Planner', purpose: 'Tasks', id: 'app_a' };
    const result = await createApplication(store, reader('org_b'), input, sequence('gen'));
    expect(result.ok && result.value.id).toBe('gen_1');
    expect(await store.get('app_a')).toBeUndefined();
  });

  it('refuses a principal without apps:write', async () => {
    const store = createMemoryStore();
    const viewer: Principal = { ...reader('org_a'), scopes: new Set(['apps:read']) };
    const result = await createApplication(store, viewer, { name: 'x', purpose: 'y' }, sequence('app'));
    expect(result).toEqual({ ok: false, error: { code: 'FORBIDDEN', scope: 'apps:write' } });
    expect(await listApplications(store, reader('org_a'))).toEqual({ ok: true, value: [] });
  });
});

describe('conditional writes in the store', () => {
  const record: ApplicationRecord = {
    id: 'app_1',
    orgId: 'org_a',
    name: 'Planner',
    purpose: 'Tasks',
    state: 'draft',
    version: 1,
  };

  it('insert stores a record only when its id is free', async () => {
    const store = createMemoryStore();
    expect(await store.insert(record)).toBe(true);
    expect(await store.insert({ ...record, orgId: 'org_b' })).toBe(false);
    expect((await store.get('app_1'))?.orgId).toBe('org_a');
  });

  it('replace stores a record only while the stored version is the expected one', async () => {
    const store = createMemoryStore();
    await store.insert(record);
    expect(await store.replace({ ...record, version: 2 }, 1)).toBe(true);
    expect(await store.replace({ ...record, version: 3, name: 'Late' }, 1)).toBe(false);
    expect((await store.get('app_1'))?.version).toBe(2);
  });
});

describe('tenant isolation', () => {
  it('reports another organization record as NOT_FOUND, not FORBIDDEN, so its existence does not leak', async () => {
    const store = createMemoryStore();
    const id = await seed(store, 'org_a', 'app_1');
    expect(await readApplication(store, reader('org_b'), id)).toEqual({
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
    const evidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    evidence.grant('org_b', 'app_1', 'sandbox-fixtures');
    const result = await transitionApplication(store, evidence, reader('org_b'), {
      id: 'app_1',
      to: 'sandbox-enabled',
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
    const evidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    evidence.grant('org_a', 'app_1', 'sandbox-fixtures');
    const revoked: Principal = { ...reader('org_a'), grantActive: false };
    expect(await readApplication(store, revoked, 'app_1')).toEqual({ ok: false, error: { code: 'GRANT_REVOKED' } });
    expect(await listApplications(store, revoked)).toEqual({ ok: false, error: { code: 'GRANT_REVOKED' } });
    expect(
      await transitionApplication(store, evidence, revoked, {
        id: 'app_1',
        to: 'sandbox-enabled',
        expectedVersion: 1,
      }),
    ).toEqual({ ok: false, error: { code: 'GRANT_REVOKED' } });
  });
});

describe('transitions through the registry', () => {
  it('moves a draft to sandbox-enabled, bumps the version, and persists the new state', async () => {
    const store = createMemoryStore();
    const evidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    evidence.grant('org_a', 'app_1', 'sandbox-fixtures');
    const result = await transitionApplication(store, evidence, reader('org_a'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      expectedVersion: 1,
    });
    expect(result.ok && result.value.state).toBe('sandbox-enabled');
    expect((await store.get('app_1'))?.version).toBe(2);
  });

  it('reports missing evidence and does not persist anything', async () => {
    const store = createMemoryStore();
    const evidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    const result = await transitionApplication(store, evidence, reader('org_a'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      expectedVersion: 1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'EVIDENCE_REQUIRED', missing: ['sandbox-fixtures'] } });
    expect((await store.get('app_1'))?.state).toBe('draft');
  });

  it('does not count evidence held by another organization', async () => {
    const store = createMemoryStore();
    const evidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    evidence.grant('org_b', 'app_1', 'sandbox-fixtures');
    const result = await transitionApplication(store, evidence, reader('org_a'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      expectedVersion: 1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'EVIDENCE_REQUIRED', missing: ['sandbox-fixtures'] } });
  });

  it('refuses a skipped state and lists the moves that are allowed', async () => {
    const store = createMemoryStore();
    const evidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    evidence.grant('org_a', 'app_1', 'certified-release');
    const result = await transitionApplication(store, evidence, reader('org_a'), {
      id: 'app_1',
      to: 'active',
      expectedVersion: 1,
    });
    expect(result).toEqual({ ok: false, error: { code: 'INVALID_TRANSITION', allowed: ['sandbox-enabled'] } });
  });

  it('refuses a stale expected version and reports the current one', async () => {
    const store = createMemoryStore();
    const evidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    evidence.grant('org_a', 'app_1', 'sandbox-fixtures');
    await transitionApplication(store, evidence, reader('org_a'), {
      id: 'app_1',
      to: 'sandbox-enabled',
      expectedVersion: 1,
    });
    const stale = await transitionApplication(store, evidence, reader('org_a'), {
      id: 'app_1',
      to: 'active',
      expectedVersion: 1,
    });
    expect(stale).toEqual({ ok: false, error: { code: 'PRECONDITION_FAILED', currentVersion: 2 } });
  });

  it('lets exactly one of two concurrent transitions with the same expected version succeed', async () => {
    const store = createMemoryStore();
    const evidence: MemoryEvidence = createMemoryEvidence();
    await seed(store, 'org_a', 'app_1');
    evidence.grant('org_a', 'app_1', 'sandbox-fixtures');
    const attempt = () =>
      transitionApplication(store, evidence, reader('org_a'), {
        id: 'app_1',
        to: 'sandbox-enabled',
        expectedVersion: 1,
      });
    const results = await Promise.all([attempt(), attempt()]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toEqual({
      ok: false,
      error: { code: 'PRECONDITION_FAILED', currentVersion: 2 },
    });
    expect((await store.get('app_1'))?.version).toBe(2);
  });
});
