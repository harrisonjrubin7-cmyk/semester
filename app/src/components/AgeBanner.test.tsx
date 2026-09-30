// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { StoreProvider } from '../state/store';
import type { AgeStatus } from '../lib/cloud';
import { AgeBanner } from './AgeBanner';

/**
 * The line under the header that asks a signed-in account for its date of
 * birth until it gives one (D-139), and says nothing to anyone else.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeAll(async () => {
  // The store's own seed import must have settled before the file ends.
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  // Going to Account writes the screen into the URL, and jsdom keeps the URL
  // between tests: the next test would open on Account, where the line is
  // rightly not drawn. Put it back.
  window.history.replaceState(null, '', '/');
});

const never = () => () => {};

async function show(signedIn: boolean, status: AgeStatus | Error) {
  const read = async () => {
    if (status instanceof Error) throw status;
    return status;
  };
  let reads = 0;
  const counted = async () => {
    try {
      return await read();
    } finally {
      reads += 1;
    }
  };
  await act(async () => {
    root.render(
      <StoreProvider>
        <AgeBanner signedIn={async () => signedIn} status={counted} watch={never} />
      </StoreProvider>,
    );
  });
  // The banner's two reads resolve after render returns. Wait for the read
  // itself rather than a fixed tick, then one more turn for the state it sets.
  // A signed-out device never reads.
  for (let i = 0; i < 50 && signedIn && reads === 0; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const banner = () => host.querySelector('[data-age-banner]');

describe('the age banner', () => {
  it('asks a signed-in account that never said, and says what waits on it', async () => {
    await show(true, 'unknown');
    expect(banner()).not.toBeNull();
    expect(banner()!.textContent).toMatch(/Classmates, community and mentoring stay off/);
    expect(banner()!.textContent).toMatch(/the date is not kept/);
  });

  it('takes the student to Account, where the question is', async () => {
    await show(true, 'unknown');
    const add = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Add it')!;
    await act(async () => add.click());
    // On Account the line is not drawn: Account asks already.
    expect(banner()).toBeNull();
  });

  it.each(['adult', 'minor', 'under_minimum'] as const)('says nothing to an account that is %s', async (status) => {
    await show(true, status);
    expect(banner()).toBeNull();
  });

  it('says nothing to a device with no account', async () => {
    await show(false, 'unknown');
    expect(banner()).toBeNull();
  });

  it('says nothing when the standing cannot be read', async () => {
    await show(true, new Error('offline'));
    expect(banner()).toBeNull();
  });
});
