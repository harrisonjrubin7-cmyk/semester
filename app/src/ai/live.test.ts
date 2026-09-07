// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  dropThread,
  flight,
  keepTurns,
  liveNow,
  newThread,
  openThread,
  resetLive,
  sender,
  setLive,
  watchLive,
} from './live';

/**
 * One conversation, and the way it stopped being one.
 *
 * The bug this guards against did not look like a bug in any single file.
 * Every file involved was correct on its own, and three of them said in their
 * headers that the sheet and the full chat were two views of one
 * conversation. They were not: `useConversation` held the turns in
 * `useState`, so each caller had its own, and the only thing joining them was
 * a write to `localStorage` that nobody was listening to.
 *
 * It is worth a test rather than a comment because it is invisible with one
 * surface open. Everything works until somebody asks a question on one
 * surface and looks for it on the other — which is exactly what "expand this"
 * means.
 */

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

beforeEach(() => {
  localStorage.clear();
  resetLive();
});

describe('the conversation is shared, not copied', () => {
  it('answers every reader with the same object', () => {
    setLive('turns', [{ role: 'user', content: 'when is the ECON final?' }]);
    // Two readers, one value — the whole claim, and the reason this reads a
    // module rather than a hook.
    expect(liveNow()).toBe(liveNow());
    expect(liveNow().turns).toHaveLength(1);
  });

  it('keeps the request where both surfaces can stop it', () => {
    // Stop is a button on the sheet and a button on the chat, and there is
    // one request. A controller in a `useRef` belongs to whichever component
    // made it, which left Stop on the other surface doing nothing at all.
    const c = new AbortController();
    flight.abort = c;
    flight.abort.abort();
    expect(c.signal.aborted).toBe(true);
  });

  it('resets to nothing, so a new conversation is new on both', () => {
    setLive('turns', [{ role: 'user', content: 'anything' }]);
    setLive('busy', true);
    setLive('streaming', 'half an answ');
    resetLive();
    expect(liveNow().turns).toEqual([]);
    expect(liveNow().busy).toBe(false);
    expect(liveNow().streaming).toBe('');
    expect(flight.abort).toBe(null);
  });

  it('tells its watchers, which is the part localStorage could not do', () => {
    // The old design persisted every change and still went stale, because a
    // write is not a notification: anything already mounted never heard it.
    let woke = 0;
    const stop = watchLive(() => (woke += 1));
    setLive('busy', true);
    setLive('streaming', 'a');
    stop();
    setLive('streaming', 'b');
    expect(woke).toBe(2);
  });

  it('says nothing when nothing changed', () => {
    // `useSyncExternalStore` re-renders on every notification, so a setter
    // that fired for an unchanged value would turn each streamed token into a
    // render of the whole transcript.
    let woke = 0;
    const stop = watchLive(() => (woke += 1));
    setLive('busy', false);
    setLive('streaming', '');
    stop();
    expect(woke).toBe(0);
  });

  it('replaces the object it hands out, so a reader can tell it changed', () => {
    // Mutating in place would leave `useSyncExternalStore` comparing a value
    // with itself and skipping the render.
    const was = liveNow();
    setLive('busy', true);
    expect(liveNow()).not.toBe(was);
    expect(was.busy).toBe(false);
  });

  it('starts the retry with something safe to call', async () => {
    await expect(sender.run('nothing has set this yet')).resolves.toBeUndefined();
  });
});

describe('more than one conversation', () => {
  it('keeps the old one when a new one starts', () => {
    /*
     * The whole point of threads. "New chat" used to empty the only
     * transcript there was and delete its key, so a revision plan worked out
     * on Sunday did not survive an unrelated question on Tuesday — and
     * nothing warned anybody, because from the app's side nothing was lost.
     */
    keepTurns([{ role: 'user', content: 'Sunday plan' }]);
    const first = liveNow().openId;
    newThread();

    expect(liveNow().turns).toEqual([]);
    expect(liveNow().openId).not.toBe(first);
    const old = liveNow().threads.find((t) => t.id === first);
    expect(old?.turns).toEqual([{ role: 'user', content: 'Sunday plan' }]);
    expect(old?.title).toBe('Sunday plan');
  });

  it('reuses an empty thread rather than stacking blank rows', () => {
    // Pressing new twice should not leave two "New conversation" rows.
    newThread();
    const after = liveNow().openId;
    newThread();
    expect(liveNow().openId).toBe(after);
    expect(liveNow().threads.filter((t) => t.turns.length === 0)).toHaveLength(1);
  });

  it('swaps the transcript when you switch, not just the title', () => {
    // The failure this guards: `openId` moving while `turns` stays, which
    // shows one conversation's name over another's text.
    keepTurns([{ role: 'user', content: 'first' }]);
    const a = liveNow().openId;
    newThread();
    keepTurns([{ role: 'user', content: 'second' }]);
    const b = liveNow().openId;

    openThread(a);
    expect(liveNow().turns).toEqual([{ role: 'user', content: 'first' }]);
    openThread(b);
    expect(liveNow().turns).toEqual([{ role: 'user', content: 'second' }]);
  });

  it('leaves no proposal or undo behind when the thread changes', () => {
    /*
     * A proposal is an offer about one answer, and an undo belongs to the
     * exchange that produced it. Carrying either across would put a live
     * button under an answer that never asked for it — and, for `applied`, a
     * working Undo for a change made in a conversation nobody is looking at.
     */
    keepTurns([{ role: 'user', content: 'first' }]);
    const a = liveNow().openId;
    newThread();
    setLive('proposals', [{ id: 'p1' } as never]);
    setLive('applied', [{ p: { id: 'p1' }, before: {} } as never]);
    setLive('busy', true);
    setLive('streaming', 'half');

    openThread(a);
    expect(liveNow().proposals).toEqual([]);
    expect(liveNow().applied).toEqual([]);
    expect(liveNow().busy).toBe(false);
    expect(liveNow().streaming).toBe('');
  });

  it('lands somewhere when you delete the one you are in', () => {
    // The surfaces render `turns` unconditionally: there is no "no
    // conversation" state to fall into.
    keepTurns([{ role: 'user', content: 'first' }]);
    const a = liveNow().openId;
    newThread();
    keepTurns([{ role: 'user', content: 'second' }]);
    const b = liveNow().openId;

    dropThread(b);
    expect(liveNow().openId).toBe(a);
    expect(liveNow().turns).toEqual([{ role: 'user', content: 'first' }]);
    expect(liveNow().threads.map((t) => t.id)).not.toContain(b);
  });

  it('leaves a fresh one when the last is deleted', () => {
    keepTurns([{ role: 'user', content: 'only' }]);
    dropThread(liveNow().openId);
    expect(liveNow().threads).toHaveLength(1);
    expect(liveNow().turns).toEqual([]);
  });

  it('deleting one you are not in leaves you where you are', () => {
    keepTurns([{ role: 'user', content: 'first' }]);
    const a = liveNow().openId;
    newThread();
    keepTurns([{ role: 'user', content: 'second' }]);
    const b = liveNow().openId;

    dropThread(a);
    expect(liveNow().openId).toBe(b);
    expect(liveNow().turns).toEqual([{ role: 'user', content: 'second' }]);
  });

  it('survives a reload', () => {
    keepTurns([{ role: 'user', content: 'kept' }]);
    newThread();
    keepTurns([{ role: 'user', content: 'also kept' }]);
    // `resetLive` re-reads the store, which is what a fresh page load does.
    resetLive();
    expect(liveNow().threads.filter((t) => t.turns.length > 0)).toHaveLength(2);
    expect(liveNow().turns).toEqual([{ role: 'user', content: 'also kept' }]);
  });
});

describe('nobody keeps a second copy', () => {
  it('leaves no conversation state in the hook', () => {
    /*
     * Read out of the source rather than asserted through the UI, because the
     * failure is a shape and not a behaviour: the moment `useConversation`
     * holds a turn in `useState` again there are two conversations, and every
     * test that opens one surface still passes.
     */
    const converse = source('./converse.ts');
    // A call, not a mention: the header explains at length what `useState`
    // used to do here, and a test that cannot tell the explanation from the
    // thing being explained would fail on its own documentation.
    expect(converse.match(/\buseState\s*[<(]/g)).toBe(null);
    expect(converse).toContain('useLive()');
  });

  it('and no surface reaches around it to the saved log', () => {
    // `chatlog` is for coming back tomorrow. A surface that seeded itself
    // from it directly would be reading a snapshot again.
    for (const file of ['./Chat.tsx', './Assistant.tsx']) {
      expect(source(file)).not.toContain('chatlog');
    }
  });

  it('and both surfaces draw a turn with the same component', () => {
    // Two implementations of a message is how the two surfaces start looking
    // like different products, which makes expanding read as going somewhere
    // else rather than as the same conversation getting more room.
    for (const file of ['./Chat.tsx', './Assistant.tsx']) {
      expect(source(file)).toContain("from './Turns'");
      expect(source(file)).toContain("from './Composer'");
    }
  });
});
