import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan, Scenario } from './graduation';

const calls: { op: string; args: unknown[] }[] = [];
let fail = '';
vi.mock('./cloud', () => ({
  cloud: async () => ({
    from: (table: string) => ({
      upsert: async (row: unknown) => {
        calls.push({ op: `upsert:${table}`, args: [row] });
        return { error: fail ? { message: fail } : null };
      },
      delete: () => ({
        eq: async (col: string, v: string) => {
          calls.push({ op: `delete:${table}`, args: [col, v] });
          return { error: fail ? { message: fail } : null };
        },
      }),
    }),
  }),
}));

const { deleteDraft, draftPreview, draftRow, saveDraft } = await import('./graduation-cloud');

const plan: Plan = { needed: 120, perTerm: 15, summer: 0, costPerTerm: 20_000, summerCost: 0, next: { season: 'Spring', year: 2027 } };
const minor: Scenario = { id: 's1', name: 'Add a minor', extra: 18, perTerm: 15, summer: 0 };

beforeEach(() => {
  calls.length = 0;
  fail = '';
});

describe('a scenario draft for the account', () => {
  it('is always labelled an estimate, with the projection in the table’s units', () => {
    const row = draftRow(plan, 60, minor);
    expect(row).toMatchObject({ name: 'Add a minor', projected_grad_term: 'Fall 2029', projected_cost_cents: 12_000_000, source_label: 'estimated' });
    expect(row.inputs.change).toEqual({ extra: 18, perTerm: 15, summer: 0 });
  });

  it('previews every field it will store, in words', () => {
    const lines = draftPreview(draftRow(plan, 60, minor));
    expect(lines).toContain('Estimated finish: Fall 2029');
    expect(lines).toContain('Labelled: Estimated');
    expect(lines.join(' ')).toContain('Credits finished: 60 of 120');
  });

  it('upserts to the scenarios table, keeping the id it was given', async () => {
    const id = await saveDraft('user-1', draftRow(plan, 60, minor), '0b8f5e6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b');
    expect(id).toBe('0b8f5e6a-1c2d-4e3f-8a9b-0c1d2e3f4a5b');
    expect(calls[0].op).toBe('upsert:graduation_scenarios');
    expect(calls[0].args[0]).toMatchObject({ id, user_id: 'user-1', source_label: 'estimated' });
  });

  it('makes a fresh id the first time, and throws the server’s refusal', async () => {
    const id = await saveDraft('user-1', draftRow(plan, 60, minor));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    fail = 'permission denied';
    await expect(saveDraft('user-1', draftRow(plan, 60, minor))).rejects.toThrow('permission denied');
  });

  it('deletes one draft by id', async () => {
    await deleteDraft('abc');
    expect(calls).toEqual([{ op: 'delete:graduation_scenarios', args: ['id', 'abc'] }]);
  });
});
