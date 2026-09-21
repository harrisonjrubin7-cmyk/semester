// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What a brand-new database account says about its version.
 *
 * Nothing, until this was fixed — and the silence was read as an old account.
 *
 * `writesFor` stores only a setting that differs from the default, and a new
 * account's `schemaVersion` *is* the default, so the marker was never written
 * by a save. `load` did not write it either, so the account reached disk with
 * no version row at all. On the next open `forwardFrom` read that silence as
 * `FIRST_DB_SCHEMA` — the floor, justified by "no database account can
 * predate version 3", which is true of accounts that moved off localStorage
 * and not of one created by this build — and ran every step above it.
 *
 * Steps 4, 5 and 6 each rewrite `nav` unconditionally, so the cost was exact:
 * install the app, choose a navigation, reopen, and it is back on the default
 * with nothing said. Measured in Chromium before the fix: choose Browser and
 * the row reads `nav="browser"`; reload and it reads
 * `nav="workspace" schemaVersion=6`. From the second open it stuck, because
 * by then the steps had written the marker themselves.
 *
 * `index.test.ts` covers what the steps do to an account that has been read.
 * This covers the one that has just been created.
 */

const write = vi.fn<(w: unknown[]) => Promise<boolean>>();
const isEmpty = vi.fn<() => Promise<boolean>>();

vi.mock('./db', async () => {
  const real = await vi.importActual<typeof import('./db')>('./db');
  return {
    ...real,
    open: vi.fn(async () => ({}) as unknown),
    write: (w: unknown[]) => write(w),
    isEmpty: () => isEmpty(),
  };
});

const { load } = await import('./index');
const { SCHEMA } = await import('../../lib/migrate');
const { DEFAULT_PERSISTED, primePersisted } = await import('../shape');

/** Every row `load` wrote, flattened out of the batches it wrote them in. */
const rows = () => write.mock.calls.flatMap(([batch]) => batch as { key: string; value: unknown }[]);

beforeEach(() => {
  write.mockReset();
  write.mockResolvedValue(true);
  isEmpty.mockReset();
  isEmpty.mockResolvedValue(true);
  localStorage.clear();
  /*
   * `loadPersisted` caches its answer in a module-level `primed`, and the
   * database path sets it. Left alone, the first test in this file decides
   * what the fourth one reads out of `semester.v1` — which made a real
   * assertion order-dependent. Cleared so each test stands on its own.
   */
  primePersisted(null);
});

/*
 * Not at the end of the test that installs the spy: an assertion that throws
 * never reaches the line after it, and a `getItem` left throwing then failed
 * the *next* two tests for a reason that had nothing to do with them. That is
 * how a three-test cascade reads as three findings.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the first run on a device', () => {
  it('stamps the version on an account it has just created', async () => {
    const state = await load();
    expect(state?.nav).toBe(DEFAULT_PERSISTED.nav);
    const marker = rows().find((r) => r.key === 'schemaVersion');
    expect(marker, 'a new account must say what version it is').toBeDefined();
    /*
     * This build's number, not the floor. The whole failure was an account
     * created at 6 being read as 3 and walked forward through steps it had
     * never needed.
     */
    expect(marker?.value).toBe(SCHEMA);
  });

  it('starts the account in the term it was created in, not in a constant', async () => {
    /*
     * The second door onto a fresh install. `shape.ts` has one and this file's
     * `load` has the other, and fixing only the first would leave every
     * database-path install — which is the path this build actually takes —
     * still starting in Fall 2026. See `state/freshterm.test.ts` for what the
     * term costs when it is wrong.
     */
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 1, 3));
    const { termNow } = await import('../../lib/term');
    const state = await load();
    expect(state?.term).toBe('2027SP');
    expect(state?.term).toBe(termNow(new Date(2027, 1, 3)).id);
    vi.useRealTimers();
  });

  it('stamps it when storage cannot be read at all', async () => {
    // A private window with storage off: nothing to move, and nothing ever
    // will be, so this is a new account rather than a move to come back to.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is off');
    });
    await load();
    expect(rows().map((r) => r.key)).toContain('schemaVersion');
  });

  it('does not stamp over a move that did not land', async () => {
    /*
     * The trap in stamping unconditionally. The marker fills the settings
     * store, so `isEmpty` is false on the next open, so the move is never
     * attempted again — and the account in `semester.v1` is stranded on a
     * device that still has it. A failed write must leave the account empty
     * and come back to it.
     */
    localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: SCHEMA, nav: 'tabs' }));
    write.mockResolvedValue(false);
    const state = await load();
    expect(state?.nav, 'the app still opens').toBe(DEFAULT_PERSISTED.nav);
    // It tried the move; what it must not do is claim the account exists.
    const after = write.mock.calls.slice(1).flatMap(([batch]) => batch as { key: string }[]);
    expect(after.map((r) => r.key)).not.toContain('schemaVersion');
  });

  it('leaves an account that moved off localStorage alone', async () => {
    // That path writes its own marker, and `load` must return what it read
    // rather than the defaults.
    localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: SCHEMA, nav: 'tabs' }));
    const state = await load();
    expect(state?.nav).toBe('tabs');
    expect(rows().filter((r) => r.key === 'schemaVersion')).toHaveLength(1);
  });
});
