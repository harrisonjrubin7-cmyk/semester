// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { STORAGE_KEY } from '../state/shape';
import { SoftTop } from './soft/SoftTop';
/*
 * Imported here only to put the module in the registry before the gate asks
 * for it, and never referenced below.
 *
 * Vitest's module runner will not settle an `import()` fired from a
 * `useEffect` inside `act()` — traced with a counter in the gate: the effect
 * runs with `soft === true` and the promise it creates neither resolves nor
 * rejects, through fifty macrotasks. The same `import()` awaited directly from
 * a test resolves fine, and the real browser fetches the chunk and draws the
 * hero (checked on the production build across all three shells).
 *
 * So this is the environment's limit, not the gate's, and the static import
 * takes the timing out of it. What is asserted below is unchanged: the gate
 * still has to ask for the module, store what comes back and render it — a
 * gate that returned null, or never called `loadBody`, fails these.
 */
import './soft/SoftTopBody';
import { loadSeed } from '../data/seed';

/**
 * The hero is drawn on one shell and fetched on one shell.
 *
 * `App.tsx` renders `<SoftTop />` in all three, and the component decides. It
 * used to decide *inside* the module that draws it, which meant every shell
 * paid for the deciding: `lib/softtop.ts` and the ten modules behind it parsed
 * before the first render, and the spec — which walks the term's deadlines —
 * built and thrown away on every render, because the hook that builds it sat
 * above the early return.
 *
 * Now the gate is a file of its own and the body arrives behind an `import()`.
 * The two things worth holding it to are the two halves of that sentence, and
 * neither was covered before: nothing in the suite rendered this component at
 * all, which is why the split could be made without a single test noticing.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

/**
 * Past onboarding, on the named shell, on Today, with the sample term loaded.
 *
 * `nav: 'tabs'` rather than the default, and it is not decoration: the default
 * navigation is the workspace, which opens on the search page — and search has
 * no hero, so every one of these would have passed by drawing nothing for the
 * wrong reason. `schemaVersion` matters for the same class of reason: without
 * it the migrations treat this as a version-1 copy and rewrite `nav`.
 */
function launch(shell: 'plain' | 'grouped' | 'soft') {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ schemaVersion: 6, seenOnboarding: true, shell, nav: 'tabs' }),
  );
}

function mount() {
  act(() => {
    root.render(
      <StoreProvider>
        <SoftTop />
      </StoreProvider>,
    );
  });
}

/**
 * Let the gate's effect and the state it sets flush before looking.
 *
 * Real macrotasks rather than a microtask or two. A hero checked too early is
 * a hero that is correctly absent, which would make the two negative cases
 * below pass for a reason that has nothing to do with the gate — so they are
 * checked after the same wait as the positive one.
 */
async function settle() {
  /*
   * The seed, awaited rather than raced.
   *
   * `StoreProvider` starts `loadSeed()` on mount, and that dynamically imports
   * four course modules. Left to finish on its own it outlives this test's
   * environment, and vitest ends the run with three unhandled
   * `EnvironmentTeardownError`s and a non-zero exit — a green suite that fails
   * anyway. `loadSeed` memoises its promise, so awaiting it here is the same
   * work the provider is already doing rather than a second copy of it.
   */
  await loadSeed().catch(() => []);
  for (let i = 0; i < 6; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

beforeEach(() => {
  /*
   * The address, before the storage.
   *
   * `store.tsx` reads `fromHash(window.location.hash)` at init and the URL
   * wins over what storage says — and it writes the current screen back into
   * the hash as it goes. Under `isolate: false` the jsdom `location` outlives
   * the file that moved it, so any earlier test that landed on a screen leaves
   * its name in the address and this store starts there however clean the
   * storage written below is. The hero is then correctly drawn for that screen
   * — "Sheets / No sheets yet" off `#/sheet` — and a test about Today's hero
   * fails holding a hero that is right about the wrong screen.
   *
   * Same fault and same fix as `splash.test.tsx`, which has the long version:
   * `replaceState` rather than `location.hash = ''`, because that leaves a
   * bare `#` behind and fires a `hashchange` at a store listening for one.
   */
  history.replaceState(null, '', '/');
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('the soft shell’s hero', () => {
  it('draws on the Soft shell, once the body has arrived', async () => {
    launch('soft');
    mount();
    await settle();

    const top = host.querySelector('.soft-top');
    expect(top, 'the hero should be drawn on the Soft shell').not.toBeNull();
    /*
     * Today's own facts, off the courses the app ships with — the same three
     * stats the production build draws, checked in a browser on this shell:
     * "Next class tomorrow 11:00a BUS 1600 / Due today 0 / This week 6 /
     * Overdue 8". The labels rather than the numbers, because the numbers move
     * with the real clock and the point here is that the body mounted and read
     * the store, not what the term happens to contain today.
     */
    expect(host.textContent).toContain('Next class');
    expect(host.textContent).toContain('Due today');
    expect(host.textContent).toContain('Overdue');
  });

  /*
   * The two shells that must not pay for it.
   *
   * Asserted after the same settle as the case above, so this is not passing
   * merely because the import had not resolved yet — it is the gate declining
   * to ask for it at all.
   */
  for (const shell of ['plain', 'grouped'] as const) {
    it(`draws nothing on the ${shell} shell, and asks for nothing`, async () => {
      launch(shell);
      mount();
      await settle();

      expect(host.querySelector('.soft-top')).toBeNull();
      expect(host.innerHTML).toBe('');
    });
  }
});
