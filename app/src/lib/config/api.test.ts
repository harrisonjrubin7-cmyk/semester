import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configApi } from './api';
import type { ConfigVersion } from './studio';

/**
 * `publish` sends one update, and the rows it reaches are the ones its
 * filters name. A publisher who opened a draft at one moment and publishes it
 * at another must not publish what they did not see: the database compares
 * the row with itself, so only the filter can say "the draft as I reviewed it".
 */

const DRAFT: ConfigVersion = {
  id: 'draft-1',
  tenant_id: 'cs-u',
  domain: 'workflows',
  state: 'draft',
  version: null,
  settings: { approval_sla_days: 10 },
  note: 'slower',
  based_on: 1,
  created_by: 'editor',
  published_by: null,
  created_at: '2026-09-30T10:00:00.123456+00:00',
  updated_at: '2026-09-30T10:05:00.654321+00:00',
  published_at: null,
};

/** A client that records each filter it is given and answers with the rows it is told to. */
function fake(rows: { id: string }[] | null, error: { message: string } | null = null) {
  const seen = { update: null as unknown, eq: [] as [string, unknown][] };
  const chain = {
    update(values: unknown) {
      seen.update = values;
      return chain;
    },
    eq(column: string, value: unknown) {
      seen.eq.push([column, value]);
      return chain;
    },
    select: async () => ({ data: rows, error }),
  };
  const db = { from: () => chain } as unknown as SupabaseClient;
  return { api: configApi(db), seen };
}

describe('publishing a draft', () => {
  it('names the draft and the moment it was reviewed, so a draft saved since reaches no row', async () => {
    const { api, seen } = fake([{ id: 'draft-1' }]);
    await api.publish(DRAFT);
    expect(seen.update).toEqual({ state: 'published' });
    expect(seen.eq).toEqual([
      ['id', 'draft-1'],
      ['updated_at', DRAFT.updated_at],
    ]);
  });

  it('says so when no row was reached, instead of reporting a publish', async () => {
    const { api } = fake([]);
    await expect(api.publish(DRAFT)).rejects.toThrow(/changed after you opened it/i);
  });

  it('still turns a database refusal into a sentence', async () => {
    const { api } = fake(null, { message: 'Whoever drafted a configuration does not publish it.' });
    await expect(api.publish(DRAFT)).rejects.toThrow(/does not publish it/);
  });

  it('control: a publish that reaches its row returns quietly', async () => {
    const { api } = fake([{ id: 'draft-1' }]);
    await expect(api.publish(DRAFT)).resolves.toBeUndefined();
  });
});
