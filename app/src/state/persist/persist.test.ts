import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Persisted } from '../shape';

/**
 * When the other tabs are told, and what happens when they are told too early.
 *
 * Two tabs of this app talk over a BroadcastChannel — `lib/tabs.ts` — and that
 * file states the rule and the claim. The rule: "A tab that receives a nudge
 * takes what is on disk. It never pushes back, never merges, and never
 * argues." The claim: there is "no ordering problem between a broadcast and a
 * write", because the receiving tab re-reads the disk both already agree is
 * authoritative.
 *
 * Both were true of the localStorage path, where the write is synchronous and
 * finished before anyone is told. Neither was true of this one, where the
 * write is a quarter of a second away. Measured in a browser with two tabs
 * open and nothing happening:
 *
 *     one tab,  idle four seconds:    0 messages
 *     two tabs, idle four seconds:  172 messages each
 *
 * — because the write effect told the other tabs on every run, including the
 * run caused by a hydrate that a nudge had triggered. And `persist` clears its
 * timer on every call, so at forty-three round trips a second the quarter
 * second never elapsed and `flush` never ran: with two tabs open the app wrote
 * nothing at all. A note typed in either drew on screen and was gone on
 * reload.
 *
 * With the loop stopped, the second half showed: the note's row reached the
 * database with an empty title, because the nudge still went out a quarter of
 * a second before the write, and sent the other tab to read a disk that did
 * not have the change on it yet — which it then wrote back over the new one.
 */
const written: unknown[][] = [];
/** Every step, in the order it really happened. */
const order: string[] = [];
let fail = false;

vi.mock('./db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./db')>()),
  open: vi.fn(async () => ({}) as IDBDatabase),
  isEmpty: vi.fn(async () => false),
  readAll: vi.fn(async () => []),
  write: vi.fn(async (writes: unknown[]) => {
    if (fail) throw new Error('no');
    written.push(writes);
    order.push('wrote');
  }),
}));

const { load, persist, prime, flushNow } = await import('./index');

const state = (over: Partial<Persisted> = {}): Partial<Persisted> =>
  ({ myName: '', schoolId: 'vanderbilt', ...over }) as Partial<Persisted>;

beforeEach(async () => {
  written.length = 0;
  order.length = 0;
  fail = false;
  await load();
  prime(state());
});

describe('telling the other tabs', () => {
  it('waits until the write has actually landed', async () => {
    persist(state({ myName: 'Harrison' }), () => order.push('told'));
    // Before the debounce settles, nothing has been written and nobody is told.
    expect(order).toEqual([]);

    await flushNow();
    // Both steps recorded where they happened — the write inside the mocked
    // `write`, the telling inside the callback — so this is the real order and
    // not one this test arranged afterwards.
    expect(order).toEqual(['wrote', 'told']);
  });

  it('says nothing when there was nothing to write', async () => {
    let told = 0;
    // The same state it was primed with: the diff is empty.
    persist(state(), () => { told += 1; });
    await flushNow();
    expect(written).toEqual([]);
    expect(told).toBe(0);
  });

  it('says nothing when the write failed', async () => {
    // A tab told to re-read a disk that did not take the change would hydrate
    // the old copy and write it back — the failure would spread rather than
    // stay put.
    fail = true;
    let told = 0;
    persist(state({ myName: 'Harrison' }), () => { told += 1; });
    await flushNow();
    expect(told).toBe(0);
  });

  it('tells once for a run of changes, not once per change', async () => {
    let told = 0;
    const say = () => { told += 1; };
    persist(state({ myName: 'H' }), say);
    persist(state({ myName: 'Ha' }), say);
    persist(state({ myName: 'Harrison' }), say);
    await flushNow();
    expect(written.length).toBe(1);
    expect(told).toBe(1);
  });

  it('still writes for a caller that does not want to tell anyone', async () => {
    // Which is what a tab does when the change came from another tab's nudge:
    // it may hold changes of its own that the merge kept, and those belong on
    // disk. Only the telling stops.
    persist(state({ myName: 'Harrison' }));
    await flushNow();
    expect(written.length).toBe(1);
  });
});

/**
 * Somebody actually asks for the last write.
 *
 * The same shape of mistake as the service worker in `lib/worker.test.ts`:
 * `flushNow` is written, correct, exported, and its own docblock says what it
 * is for — "For a tab closing, and for tests" — and nothing but the tests ever
 * called it. Nothing failed, because a write a quarter of a second late is
 * invisible until the page does not last a quarter of a second.
 *
 * Measured in a browser: a note typed and the tab closed 120ms later came back
 * with an empty title. The row was there, because creating the note had
 * settled; the words were not.
 *
 * A source-level check, for the reason `worker.test.ts` gives about
 * `main.tsx`: the store boots a DOM, a database and an OAuth redemption, so
 * importing it in a unit test would test the harness. Reading it catches the
 * shape of the mistake, which is the invisible part.
 */
describe('the write that is still owing when the page goes', () => {
  const store = readFileSync('src/state/store.tsx', 'utf8');

  it('is asked for by somebody', () => {
    expect(
      store,
      'nothing calls flushNow, so a change made in the last quarter second ' +
        'before a tab closes is never written',
    ).toMatch(/flushNow\(\)/);
  });

  it('is asked for on both ways out of a page', () => {
    // Backgrounding on a phone fires `visibilitychange` and may never fire
    // anything else before the page is discarded; `pagehide` catches the
    // ordinary close. `lib/draft.hook.ts` uses the same pair for the draft
    // text and writes out why.
    expect(store).toMatch(/addEventListener\('pagehide'/);
    expect(store).toMatch(/addEventListener\('visibilitychange'/);
    expect(store).toMatch(/visibilityState === 'hidden'/);
  });
});
