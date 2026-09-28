// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Both ends of a sign-in that leaves the page.
 *
 * Leaving: pressing a provider button writes down where the student was — or,
 * on Account, where they came to Account from. Coming back: the tab arrives
 * at the bare app address with a session, and the store sends it to what was
 * written down. Unless the page was opened on a link, which wins.
 */

const session = {
  user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'google' } },
  access_token: 'tok',
} as unknown as Session;

let signedIn: Session | null = null;
const signInWith = vi.fn(async () => {});

vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  accountOf: (s: Session | null) =>
    s?.user ? { id: s.user.id, email: s.user.email ?? '', via: 'google' } : null,
  currentSession: async () => signedIn,
  onAuthChange: () => () => {},
  explainSyncError: (e: unknown) => String(e),
  explainSync: (e: unknown) => ({ said: String(e), code: 'INTERNAL_ERROR', ref: 'SEM-TEST' }),
  isStale: () => false,
  pull: async () => ({ state: null, courses: [], updated: 0, seen: { courses: {} } }),
  push: async () => ({ courses: {} }),
  // What Credentials needs.
  appUrl: () => 'https://example.test/',
  institutionSsoConfig: async () => null,
  PROVIDER_LABEL: { google: 'Google', azure: 'Microsoft', apple: 'Apple' },
  namesSaid: (n: string[]) => n.join(', '),
  providersOn: async () => ['google'],
  sendReset: async () => '',
  signIn: async () => {},
  signInWith: (...a: unknown[]) => signInWith(...(a as [])),
  signInWithSSO: async () => {},
  signUp: async () => ({ said: '', signedIn: false }),
}));

const { StoreProvider, useStore } = await import('./store');
const { Credentials } = await import('../components/Credentials');
const { RETURN_KEY, rememberReturn } = await import('../lib/returnto');
const { loadSeed } = await import('../data/seed');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

let go: (screen: 'account') => void = () => {};

function Screen() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    go = (screen) => dispatch({ type: 'go', screen });
  });
  return <div data-screen={state.screen} />;
}

async function mount(extra: React.ReactNode = null) {
  await act(async () => {
    root.render(
      <StoreProvider>
        <Screen />
        {extra}
      </StoreProvider>,
    );
  });
  // The session is asked for after first paint (a timeout here, since jsdom
  // has no requestIdleCallback), then the hash change lands.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 500));
  });
}

const screen = () => host.querySelector('[data-screen]')?.getAttribute('data-screen');

beforeEach(async () => {
  await loadSeed().catch(() => []);
  localStorage.clear();
  localStorage.setItem('semester.v1', JSON.stringify({ schemaVersion: 6, seenOnboarding: true, registered: true }));
  localStorage.setItem('semester.seen', JSON.stringify({ courses: {} }));
  signInWith.mockClear();
  signedIn = null;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  history.replaceState(null, '', '/');
});

describe('coming back from the provider', () => {
  it('lands where the sign-in was started', async () => {
    rememberReturn('#/mail');
    history.replaceState(null, '', '/?code=abc'); // the bare address, as a provider returns it
    signedIn = session;
    await mount();
    expect(window.location.hash).toBe('#/mail');
    expect(screen()).toBe('mail');
    expect(localStorage.getItem(RETURN_KEY)).toBeNull();
  });

  it('goes where a link says instead, and still uses the point up', async () => {
    rememberReturn('#/mail');
    history.replaceState(null, '', '/#/calendar');
    signedIn = session;
    await mount();
    expect(screen()).toBe('calendar');
    expect(localStorage.getItem(RETURN_KEY)).toBeNull();
  });

  it('does nothing without a session — the control', async () => {
    rememberReturn('#/mail');
    history.replaceState(null, '', '/');
    signedIn = null;
    await mount();
    expect(screen()).not.toBe('mail');
    // Still there for the sign-in that has not happened yet.
    expect(localStorage.getItem(RETURN_KEY)).not.toBeNull();
  });
});

describe('leaving for the provider', () => {
  it('writes down the screen the student came to Account from', async () => {
    history.replaceState(null, '', '/#/mail');
    await mount(<Credentials />);
    // Onto Account the way the app gets there, which pushes Mail onto the
    // history — a hash change would land without one.
    await act(async () => go('account'));
    expect(window.location.hash).toBe('#/account');
    const google = [...host.querySelectorAll('button')].find((b) => /google/i.test(b.textContent ?? ''));
    expect(google, 'no Google button').toBeTruthy();
    await act(async () => google!.click());
    expect(signInWith).toHaveBeenCalledWith('google');
    expect(JSON.parse(localStorage.getItem(RETURN_KEY)!).hash).toBe('#/mail');
  });
});
