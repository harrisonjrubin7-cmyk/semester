// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A change owed as the page leaves survives the reload, even when the browser
 * aborts the database write it had started. See `keepForNextLoad` in
 * `./index`.
 *
 * The double is the same shape as `tell.test.ts`'s: `write` answers what the
 * real one would, and a write the browser tore down answers nothing at all.
 */

const write = vi.fn<(w: unknown[]) => Promise<boolean>>();

vi.mock('./db', async () => {
  const real = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...real,
    open: vi.fn(async () => ({}) as unknown),
    held: () => true,
    isEmpty: vi.fn(async () => false),
    readAll: vi.fn(async () => []),
    write: (w: unknown[]) => write(w),
  };
});

/** A fresh copy of the module, as a reload gets. */
async function page() {
  vi.resetModules();
  const mod = await import('./index');
  await mod.load().catch(() => {});
  write.mockClear();
  return mod;
}

/** A write the browser abandons as the document goes: it never answers. */
const tornDown = () => new Promise<boolean>(() => {});

const row = (title: string) => ({ notes: [{ id: 'n1', title }] }) as never;

beforeEach(() => {
  localStorage.clear();
  write.mockReset();
  write.mockResolvedValue(true);
});

describe('a change owed as the page leaves', () => {
  it('is written to the database on the next load when the leaving write was torn down', async () => {
    const before = await page();
    before.prime({ notes: [] });
    before.persist(row('Ticked'));
    write.mockImplementationOnce(tornDown);
    before.flushOnLeave();
    expect(write).toHaveBeenCalledTimes(1);

    // The reload: a new module, the leaving write never having answered.
    write.mockClear();
    write.mockResolvedValue(true);
    vi.resetModules();
    const after = await import('./index');
    await after.load();
    const replayed = write.mock.calls.map((c) => JSON.stringify(c[0])).join('\n');
    expect(replayed).toContain('Ticked');
    // And, having landed, it is not kept for a third load.
    expect(localStorage.getItem(after.LEAVING_KEY)).toBeNull();
  });

  it('includes a change still in flight, not only the one not yet started', async () => {
    const before = await page();
    before.prime({ notes: [] });
    before.persist(row('Opened'));
    write.mockImplementationOnce(tornDown);
    void before.flushNow();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    // Nothing is pending now: the only copy of "Opened" is the write in flight.
    before.flushOnLeave();
    expect(localStorage.getItem(before.LEAVING_KEY)).toContain('Opened');
  });

  it('is dropped once a write carrying it lands, so it is never replayed over something newer', async () => {
    const mod = await page();
    mod.prime({ notes: [] });
    mod.persist(row('First'));
    // On a page that stays, a write that does not land answers false: db.ts
    // gives up on a stalled transaction rather than waiting for ever.
    write.mockResolvedValueOnce(false);
    mod.flushOnLeave();
    expect(localStorage.getItem(mod.LEAVING_KEY)).toContain('First');
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));

    // The page did not go after all (a tab hidden and shown again), and a
    // newer edit lands.
    mod.persist(row('Second'));
    await mod.flushNow();
    expect(localStorage.getItem(mod.LEAVING_KEY)).toBeNull();
  });

  it('is kept when an earlier write fails and a later one, carrying only what came after it, lands', async () => {
    // A write in flight, then a second started as the page leaves: the second
    // carries only the diff from the first. The first aborting and the second
    // landing leaves the database without the first change, so the second
    // landing must not count as everything confirmed.
    const mod = await page();
    mod.prime({ notes: [] });
    const n1 = { id: 'n1', title: 'First' };
    mod.persist({ notes: [n1] } as never);
    let failFirst!: (ok: boolean) => void;
    write.mockImplementationOnce(() => new Promise<boolean>((r) => (failFirst = r)));
    const first = mod.flushNow();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));

    mod.persist({ notes: [n1, { id: 'n2', title: 'Second' }] } as never);
    let landSecond!: (ok: boolean) => void;
    write.mockImplementationOnce(() => new Promise<boolean>((r) => (landSecond = r)));
    mod.flushOnLeave();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(JSON.stringify(write.mock.calls[1][0])).not.toContain('"First"');

    failFirst(false);
    await first;
    landSecond(true);
    await mod.flushNow();
    expect(localStorage.getItem(mod.LEAVING_KEY)).toContain('First');
  });

  it('is kept when the replay itself does not land, so the next open tries again', async () => {
    localStorage.setItem('semester.leaving', JSON.stringify([{ store: 'notes', key: 'n1', value: { id: 'n1', title: 'Kept' } }]));
    write.mockResolvedValue(false);
    vi.resetModules();
    const mod = await import('./index');
    await mod.load();
    expect(localStorage.getItem(mod.LEAVING_KEY)).toContain('Kept');
  });

  it('is dropped by an erase, so a reload after erasing brings nothing back', async () => {
    const mod = await page();
    mod.prime({ notes: [] });
    mod.persist(row('Before erase'));
    write.mockImplementationOnce(tornDown);
    mod.flushOnLeave();
    expect(localStorage.getItem(mod.LEAVING_KEY)).not.toBeNull();
    mod.stopWriting();
    expect(localStorage.getItem(mod.LEAVING_KEY)).toBeNull();
  });

  it('is not written when nothing is owed, and a malformed one is thrown away', async () => {
    const mod = await page();
    mod.prime({ notes: [] });
    mod.flushOnLeave();
    expect(localStorage.getItem(mod.LEAVING_KEY)).toBeNull();

    localStorage.setItem(mod.LEAVING_KEY, '{"not":"a list"}');
    vi.resetModules();
    const again = await import('./index');
    await again.load();
    expect(write).not.toHaveBeenCalledWith(expect.objectContaining({ not: 'a list' }));
    expect(localStorage.getItem(again.LEAVING_KEY)).toBeNull();
  });
});
