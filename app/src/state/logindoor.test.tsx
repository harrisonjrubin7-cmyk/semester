// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider, useStore } from './store';
import { loadSeed } from '../data/seed';

/**
 * The company site's "Log in", opened by somebody who has never been here.
 *
 * A first visit opens on onboarding whatever the address says, so a link to
 * the sign-in form landed on the welcome carousel instead — on the demo build
 * that read as "Log in takes me to the demo, not a sign-in page". The account
 * screen is now the one place a first visit may open directly; everything else
 * still meets onboarding first, which is the control below.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

function Where() {
  const { state } = useStore();
  return <span data-screen={state.screen} data-door={state.accountDoor ?? ''} />;
}

async function openCold(hash: string): Promise<string | null> {
  window.history.replaceState(null, '', `/${hash}`);
  await act(async () => {
    root.render(
      <StoreProvider>
        <Where />
      </StoreProvider>,
    );
  });
  return host.querySelector('span')!.getAttribute('data-screen');
}

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.history.replaceState(null, '', '/');
});

describe('a first visit through a sign-in link', () => {
  for (const hash of ['#/login', '#/signin', '#/signup', '#/account']) {
    it(`${hash} opens the account screen, not onboarding`, async () => {
      expect(await openCold(hash)).toBe('account');
    });
  }

  it('turns the form the way the button meant, after the address has changed', async () => {
    // The account screen is lazy: its form mounts after the store has already
    // rewritten `#/login` to `#/account`, so the answer has to be in state.
    await openCold('#/login');
    expect(host.querySelector('span')!.getAttribute('data-door')).toBe('in');
    await act(async () => root.unmount());
    root = createRoot(host);
    await openCold('#/signup');
    expect(host.querySelector('span')!.getAttribute('data-door')).toBe('up');
  });

  it('lands on the ordinary address once it has arrived', async () => {
    await openCold('#/login');
    expect(window.location.hash).toBe('#/account');
  });

  it('control: any other address still meets onboarding first', async () => {
    expect(await openCold('#/study')).toBe('onboarding');
    expect(await openCold('')).toBe('onboarding');
  });
});
