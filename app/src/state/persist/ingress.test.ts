// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The database boot path notes lost rows the same way the localStorage one
 * does (`ingressDrops`, `lib/deletions.ts`). It never goes near
 * `loadPersisted`, so the noting there does not cover it.
 */
let notes: [string, unknown][] = [];
let settings: [string, unknown][] = [];
const writes: { store: string; key: string; value: unknown }[] = [];

vi.mock('./db', () => ({
  MAPS_STORE: 'maps',
  SETTINGS_STORE: 'settings',
  open: async () => ({}),
  held: () => true,
  isEmpty: async () => false,
  write: async (w: { store: string; key: string; value: unknown }[]) => {
    writes.push(...w);
    return true;
  },
  wipe: async () => true,
  readAll: async (store: string) => (store === 'notes' ? notes : store === 'settings' ? settings : []),
}));

const { load, persist, prime, releaseHeldNote } = await import('./index');
const { clearIngressDrops, ingressDrops } = await import('../../lib/deletions');

afterEach(() => {
  vi.restoreAllMocks();
  clearIngressDrops();
  localStorage.clear();
  settings = [];
  writes.length = 0;
});

const damaged = { title: 'Lab notes', body: 'lost its id', created: 1, updated: 1 };
const settle = () => new Promise((r) => setTimeout(r, 400));
const heldWrites = () => writes.filter((w) => w.store === 'settings' && w.key === 'heldIngressDrops');

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

  // Found reviewing 301db55: with a database, storage at its quota refused the
  // note in localStorage while the database took the copy without the row, and
  // a close before the pull left the gap with nothing saying it was damage.
  for (const refused of [true, false]) {
    it(`a note storage refused rides on the database write (${refused ? 'refused' : 'control'})`, async () => {
      notes = [['n-good', damaged]];
      const real = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
        if (refused && key === 'semester.ingress-drops') throw new DOMException('full', 'QuotaExceededError');
        return real.call(this, key, value);
      });
      const loaded = (await load())!;
      prime(loaded);
      persist({ ...loaded, notes: [] });
      await settle();
      expect(heldWrites().map((w) => w.value)).toEqual(refused ? [['notes']] : []);
    });
  }

  it('reads a note the database carried on the next boot, and keeps it out of the state', async () => {
    notes = [];
    settings = [['heldIngressDrops', ['notes']]];
    const loaded = (await load())!;
    expect(ingressDrops()).toEqual(['notes']);
    expect('heldIngressDrops' in loaded).toBe(false);
  });

  it('takes the carried note out of the database once healed', async () => {
    notes = [];
    settings = [['heldIngressDrops', ['notes']]];
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const loaded = (await load())!;
    prime(loaded);
    clearIngressDrops();
    await releaseHeldNote();
    expect(heldWrites().map((w) => w.value)).toEqual([null]);
  });
});
