import { describe, expect, it } from 'vitest';

import { loadRolePolicy, readRolePolicy } from './role-policy';

const source = {
  roles: [
    { role: 'student', global: false },
    { role: 'platform_admin', global: true },
  ],
  capabilities: [
    { capability: 'student:self', about: 'Read the signed-in student record.' },
    { capability: 'console:operate', about: 'Open the operations console.' },
  ],
  assignments: [
    { role: 'student', capability: 'student:self' },
    { role: 'platform_admin', capability: 'console:operate' },
  ],
};

describe('role policy reader', () => {
  it('accepts the exact server row shapes and produces deterministic server truth', () => {
    expect(readRolePolicy(source)).toEqual({
      roles: [
        { role: 'platform_admin', global: true },
        { role: 'student', global: false },
      ],
      capabilities: [
        { capability: 'console:operate', about: 'Open the operations console.' },
        { capability: 'student:self', about: 'Read the signed-in student record.' },
      ],
      assignments: [
        { role: 'platform_admin', capability: 'console:operate' },
        { role: 'student', capability: 'student:self' },
      ],
    });
  });

  it.each([
    ['non-array roles', { ...source, roles: null }],
    ['malformed role', { ...source, roles: [{ role: '', global: false }] }],
    ['duplicate capability', { ...source, capabilities: [...source.capabilities, source.capabilities[0]] }],
    ['unknown role assignment', { ...source, assignments: [{ role: 'ghost', capability: 'console:operate' }] }],
    ['unknown capability assignment', { ...source, assignments: [{ role: 'student', capability: 'ghost:use' }] }],
    ['duplicate assignment', { ...source, assignments: [source.assignments[0], source.assignments[0]] }],
  ])('rejects %s rather than rendering partial authority', (_case, value) => {
    expect(() => readRolePolicy(value)).toThrow('Role policy response was invalid.');
  });
});

describe('role policy loader', () => {
  it('reads only the three authenticated reference-table projections', async () => {
    const seen: Array<[string, string]> = [];
    const resultByTable = {
      app_roles: { data: source.roles, error: null },
      app_capabilities: { data: source.capabilities, error: null },
      role_capabilities: { data: source.assignments, error: null },
    } as const;
    const db = {
      from: (table: keyof typeof resultByTable) => ({
        select: (columns: string) => {
          seen.push([table, columns]);
          return { order: async () => resultByTable[table] };
        },
      }),
    };

    await expect(loadRolePolicy(async () => db as never)).resolves.toEqual(readRolePolicy(source));
    expect(seen).toEqual([
      ['app_roles', 'role, global'],
      ['app_capabilities', 'capability, about'],
      ['role_capabilities', 'role, capability'],
    ]);
  });

  it.each(['app_roles', 'app_capabilities', 'role_capabilities'] as const)(
    'fails closed when the %s query fails',
    async (failed) => {
      const resultByTable = {
        app_roles: { data: source.roles, error: failed === 'app_roles' ? { message: 'roles denied' } : null },
        app_capabilities: { data: source.capabilities, error: failed === 'app_capabilities' ? { message: 'capabilities denied' } : null },
        role_capabilities: { data: source.assignments, error: failed === 'role_capabilities' ? { message: 'assignments denied' } : null },
      };
      const db = {
        from: (table: keyof typeof resultByTable) => ({
          select: () => ({ order: async () => resultByTable[table] }),
        }),
      };

      await expect(loadRolePolicy(async () => db as never)).rejects.toThrow(failed === 'app_roles'
        ? 'roles denied'
        : failed === 'app_capabilities'
          ? 'capabilities denied'
          : 'assignments denied');
    },
  );
});
