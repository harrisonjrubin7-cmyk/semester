import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A nudge is never answered with a nudge.
 *
 * `lib/tabs.ts` states the rule this holds in place: "A tab that receives a
 * nudge takes what is on disk. It never pushes back, never merges, and never
 * argues." Answering a nudge with a nudge is pushing back, and two tabs doing
 * it to each other is a loop with no exit.
 *
 * ## What this test can and cannot do
 *
 * It cannot open two tabs: that needs a browser, and there is no
 * `@testing-library/react` in this suite to render the provider even once. The
 * measuring was done in Chromium, two pages in one context, with
 * `BroadcastChannel.postMessage` counted:
 *
 *     one tab,  idle 4s     tab A: sent 0,  received 0
 *     two tabs, idle 4s     tab A: sent 65, received 131
 *                           tab B: sent 66, received 130
 *
 * — about forty-three round trips a second with the app doing nothing at all.
 * The cost was not the noise. `persist` clears its timer on every call, so the
 * quarter second never elapsed and `flush` never ran:
 *
 *     one tab,  a note typed     notes in IndexedDB: ["NOTE-WITH-1-TAB"]
 *     two tabs, a note typed     notes in IndexedDB: []
 *
 * The note drew on screen, stayed in memory, and was gone on reload — and
 * closing the second tab started saving again, which is what made it easy to
 * disbelieve. After: 0 messages either way, both notes land, and two tabs each
 * adding one end with both in the database rather than neither.
 *
 * What this *can* do is hold the mechanism: that the flag exists, that the
 * nudge path sets it, and that the write path spends it — so a later edit
 * cannot drop one of the three and leave the other two looking correct.
 */
const store = readFileSync('src/state/store.tsx', 'utf8');

describe('two tabs of the same app', () => {
  it('marks a hydrate that came from another tab', () => {
    // Inside the `onOtherTab` handler, on both the database and the
    // localStorage path — a device with no usable database loops just as
    // readily as one with it.
    const from = store.indexOf('onOtherTab(');
    const handler = store.slice(from, store.indexOf('}),', from));
    expect(handler.length, 'the onOtherTab handler should be findable').toBeGreaterThan(100);
    expect(
      handler.match(/fromOtherTab\.current = true/g) ?? [],
      'both the db and the localStorage path must mark it',
    ).toHaveLength(2);
  });

  it('spends the mark on the write it causes, on both paths', () => {
    // Read *and* cleared, so the next write — this tab's own — speaks again.
    // A flag that is set and never cleared silences the tab for good, which
    // loses the other tab's updates instead of looping: quieter, and worse.
    expect(store.match(/fromOtherTab\.current = false/g) ?? []).toHaveLength(2);
  });

  it('never announces a write on the way in', () => {
    // The database write is asynchronous. Telling the other tab before it
    // lands sends it to read a disk a quarter of a second behind, and what it
    // reads it writes back — over the change that had not landed yet. The
    // announcement is handed to `persist` and made by `flush`.
    expect(store).toContain('persistToDb(picked, quiet ? undefined : tellOtherTabs)');
    // The localStorage path is synchronous and already finished, so it may
    // still call directly — but only when the write was this tab's own.
    expect(store).toContain('if (!quiet) tellOtherTabs();');
    // And nowhere unguarded.
    for (const call of store.match(/^\s*tellOtherTabs\(\);/gm) ?? []) {
      expect.fail(`an unguarded ${call.trim()} would loop`);
    }
  });

  it('asks for the last write before the page goes away', () => {
    // `flushNow` is written, exported, and its own docblock says what it is
    // for — "For a tab closing, and for tests" — and for a while nothing but
    // the tests called it. A note typed and the tab closed 120ms later came
    // back with an empty title.
    expect(store).toContain('flushNow');
    expect(store, 'backgrounding on a phone may fire nothing else').toContain(
      "document.addEventListener('visibilitychange', hidden)",
    );
    expect(store).toContain("window.addEventListener('beforeunload', last)");
  });
});
