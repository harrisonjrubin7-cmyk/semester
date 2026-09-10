import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Telling the other tabs, and when.
 *
 * `lib/tabs.ts` reasons that there is "no ordering problem between a broadcast
 * and a write". That is true of the localStorage path, where the write is
 * synchronous and finished before anyone is told. It is not true of this one,
 * and the two tabs paid for it twice over:
 *
 * Announcing on the way *in* sent the other tab to read a disk still a quarter
 * of a second behind, and what it read it wrote back — over the change that
 * had not landed yet. A note created in one tab reached the database with an
 * empty title.
 *
 * And announcing when there was *nothing* to write is the first step of a
 * loop rather than an update. Measured in Chromium with both tabs sitting
 * idle: 0 messages with one tab open, about 65 posted and 131 received per tab
 * per four seconds with two. `persist` clears its timer on every call, so at
 * that rate the quarter second never elapsed, `flush` never ran, and a note
 * typed in either tab was drawn, held in memory, and gone on reload — while
 * closing the second tab started saving again.
 *
 * So: after the write, only when there was something to write, and never after
 * one that failed.
 */

/*
 * `Promise<boolean>`, because that is what the real one answers.
 *
 * This double was typed `Promise<void>` and defaulted to `undefined`, and
 * `db.ts` resolves `false` on an error, on an abort and on a synchronous
 * throw — it never rejects. The difference is what hid the bug these tests
 * now cover: `flush` guarded the call with a `try`/`catch` that could
 * therefore never run, so every write counted as a success, and the failure
 * path existed only in this file.
 */
const write = vi.fn<(w: unknown[]) => Promise<boolean>>();

vi.mock('./db', async () => {
  const real = await vi.importActual<typeof import('./db')>('./db');
  return { ...real, open: vi.fn(async () => ({}) as unknown), write: (w: unknown[]) => write(w) };
});

// Imported after the mock is registered, so the module binds the fake `write`.
const { persist, prime, flushNow, stopWriting, whileWriting } = await import('./index');
const { load } = await import('./index');

beforeEach(async () => {
  write.mockReset();
  write.mockResolvedValue(true);
  // `persist` is inert until the database has opened. `load` is what sets
  // that, and the mocked `open` makes it succeed without a real IndexedDB.
  await load().catch(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('when the other tabs are told', () => {
  it('tells them after the write, not before it', async () => {
    const order: string[] = [];
    write.mockImplementation(async () => {
      order.push('wrote');
      return true;
    });
    prime({ notes: [] });
    persist({ notes: [{ id: 'n1', title: 'A note' }] } as never, () => order.push('told'));
    await flushNow();
    expect(order).toEqual(['wrote', 'told']);
  });

  it('says nothing when there was nothing to write', async () => {
    const told = vi.fn();
    const same = [{ id: 'n1', title: 'A note' }];
    prime({ notes: same } as never);
    // The same records by reference, which is what a dispatch that changed
    // something else entirely leaves behind.
    persist({ notes: same } as never, told);
    await flushNow();
    expect(write).not.toHaveBeenCalled();
    expect(told).not.toHaveBeenCalled();
  });

  it('says nothing when the write failed', async () => {
    const told = vi.fn();
    // False rather than a throw: that is how the real one reports a refusal.
    write.mockResolvedValue(false);
    prime({ notes: [] });
    persist({ notes: [{ id: 'n1', title: 'A note' }] } as never, told);
    await flushNow();
    expect(write).toHaveBeenCalled();
    // A tab sent to re-read a disk that did not take the change would spread
    // the failure rather than leave it where it was.
    expect(told).not.toHaveBeenCalled();
  });

  it('tells them once for a burst of keystrokes, not once each', async () => {
    const told = vi.fn();
    prime({ notes: [] });
    for (const title of ['A', 'A n', 'A no', 'A not', 'A note']) {
      persist({ notes: [{ id: 'n1', title }] } as never, told);
    }
    await flushNow();
    expect(write).toHaveBeenCalledOnce();
    expect(told).toHaveBeenCalledOnce();
  });

  it('says out loud that a write failed, and that a later one landed', async () => {
    /*
     * `App.tsx` draws a banner for exactly this and argues for it above:
     * *"Until it is fixed, everything the person does is being lost on the
     * next reload."* Nothing but `navigator.storage.estimate()` could turn it
     * on — a guess about a quota rather than news about a write. Measured on
     * the production build with the database refusing writes: a task drew,
     * stayed in memory, and was gone after a reload, with nothing said either
     * time.
     */
    const heard: boolean[] = [];
    whileWriting((failing) => heard.push(failing));

    write.mockResolvedValue(false);
    prime({ notes: [] });
    persist({ notes: [{ id: 'n1', title: 'A note' }] } as never);
    await flushNow();
    expect(heard).toEqual([true]);

    write.mockResolvedValue(true);
    persist({ notes: [{ id: 'n1', title: 'A note' }, { id: 'n2', title: 'Another' }] } as never);
    await flushNow();
    expect(heard).toEqual([true, false]);

    whileWriting(null);
  });

  it('carries a refused change into the next write rather than dropping it', async () => {
    /*
     * `last` had already moved on to what the database *would* have held, so
     * the next flush diffed against a state that was never written and the
     * refused change was never retried — not even when the refusal was one
     * transaction losing one race.
     */
    // The same array by reference in both calls, so `writesFor` sees the notes
    // as unchanged the second time and only a retry can put the row back in.
    const notes = [{ id: 'n1', title: 'A note' }];
    write.mockResolvedValue(false);
    prime({ notes: [] });
    persist({ notes } as never);
    await flushNow();

    write.mockResolvedValue(true);
    write.mockClear();
    persist({ notes, myName: 'Harrison' } as never);
    await flushNow();

    const keys = (write.mock.calls[0]?.[0] ?? []).map((w) => (w as { key: string }).key);
    // Both: the row the database refused — collections are written a row at a
    // time, so it is the note's own id — and the setting changed after it.
    expect(keys).toContain('n1');
    expect(keys).toContain('myName');
  });

  it('does not tell anyone after a write that was refused', async () => {
    // A tab sent to re-read a disk that did not take the change would spread
    // the failure rather than leave it where it is.
    const told = vi.fn();
    write.mockResolvedValue(false);
    prime({ notes: [] });
    persist({ notes: [{ id: 'n1', title: 'A note' }] } as never, told);
    await flushNow();
    expect(write).toHaveBeenCalled();
    expect(told).not.toHaveBeenCalled();
  });

  it('carries on writing for a caller that does not want telling', async () => {
    prime({ notes: [] });
    // The quiet path: a tab writing what it took from another tab still
    // writes, because the merge may have kept something of its own.
    persist({ notes: [{ id: 'n1', title: 'A note' }] } as never);
    await flushNow();
    expect(write).toHaveBeenCalledOnce();
  });

  it('forgets who to tell when writing stops for good', async () => {
    const told = vi.fn();
    prime({ notes: [] });
    persist({ notes: [{ id: 'n1', title: 'A note' }] } as never, told);
    stopWriting();
    await flushNow();
    expect(told).not.toHaveBeenCalled();
  });
});
