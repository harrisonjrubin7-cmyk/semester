// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The database boot path notes lost rows the same way the localStorage one
 * does (`ingressDrops`, `lib/deletions.ts`). It never goes near
 * `loadPersisted`, so the noting there does not cover it.
 */
let notes: [string, unknown][] = [];
let settings: [string, unknown][] = [];
let emptyDb = false;
let refuseWrites = 0;
const writes: { store: string; key: string; value: unknown }[] = [];

vi.mock('./db', () => ({
  MAPS_STORE: 'maps',
  SETTINGS_STORE: 'settings',
  open: async () => ({}),
  held: () => true,
  isEmpty: async () => emptyDb,
  write: async (w: { store: string; key: string; value: unknown }[]) => {
    if (refuseWrites > 0) {
      refuseWrites -= 1;
      return false;
    }
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
  emptyDb = false;
  refuseWrites = 0;
});

const refuseNote = () => {
  const real = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === 'semester.ingress-drops') throw new DOMException('full', 'QuotaExceededError');
    return real.call(this, key, value);
  });
};

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

  // Found reviewing 3615f39: the move off localStorage writes the normalized
  // copy in its own transaction, which carried no note.
  it('carries a refused note in the move off localStorage', async () => {
    emptyDb = true;
    localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, seenOnboarding: true, notes: [damaged] }));
    refuseNote();
    await load();
    expect(heldWrites().map((w) => w.value)).toEqual([['notes']]);
  });

  // Found reviewing 3615f39: a write that failed left the note counted as
  // written, and the retry that landed went without it.
  it('sends the note again after a write that failed', async () => {
    notes = [['n-good', damaged]];
    refuseNote();
    const loaded = (await load())!;
    prime(loaded);
    refuseWrites = 1;
    persist({ ...loaded, notes: [] });
    await settle();
    expect(heldWrites(), 'the refused write recorded nothing').toEqual([]);
    persist({ ...loaded, notes: [], tasks: [] });
    await settle();
    expect(heldWrites().map((w) => w.value)).toEqual([['notes']]);
  });

  // Found reviewing 3615f39: another tab's heal took the note out of the
  // database, and this tab, whose note never reached localStorage, kept it.
  it('lets go of a note the database carried once another tab has removed it', async () => {
    notes = [['n-good', damaged]];
    refuseNote();
    const loaded = (await load())!;
    prime(loaded);
    persist({ ...loaded, notes: [] });
    await settle();
    expect(ingressDrops()).toEqual(['notes']);
    notes = [];
    settings = [];
    await load();
    expect(ingressDrops()).toEqual([]);
  });
});
