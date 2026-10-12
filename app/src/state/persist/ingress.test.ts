// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The database boot path notes lost rows the same way the localStorage one
 * does (`ingressDrops`, `lib/deletions.ts`). It never goes near
 * `loadPersisted`, so the noting there does not cover it.
 */
let notes: [string, unknown][] = [];

vi.mock('./db', () => ({
  MAPS_STORE: 'maps',
  SETTINGS_STORE: 'settings',
  open: async () => ({}),
  held: () => true,
  isEmpty: async () => false,
  write: async () => true,
  wipe: async () => true,
  readAll: async (store: string) => (store === 'notes' ? notes : []),
}));

const { load } = await import('./index');
const { clearIngressDrops, ingressDrops } = await import('../../lib/deletions');

afterEach(() => {
  clearIngressDrops();
  localStorage.clear();
});

describe('the database boot read', () => {
  it('notes a list whose stored rows it could not address', async () => {
    notes = [['n-good', { title: 'Lab notes', body: 'lost its id', created: 1, updated: 1 }]];
    await load();
    expect(ingressDrops()).toEqual(['notes']);
  });

  it('notes nothing when every row reads back whole', async () => {
    notes = [['n-good', { id: 'n-good', title: 'Lab notes', body: 'fine', created: 1, updated: 1 }]];
    await load();
    expect(ingressDrops()).toEqual([]);
  });
});
